/**
 * 表单Schema管理控制器
 * 艹！支持版本控制、发布管理、历史追溯！
 */

const db = require('../../config/database');

/**
 * 获取表单Schema列表
 * GET /admin/form-schemas
 */
async function listFormSchemas(req, res) {
  try {
    const { limit = 20, offset = 0, publish_status } = req.query;

    let query = db('form_schemas')
      .select(
        'schema_id',
        'version',
        'is_current',
        'version_description',
        'publish_status',
        'created_by',
        'created_at',
        'updated_at'
      )
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    if (publish_status) {
      query = query.where({ publish_status });
    }

    const schemas = await query;
    const totalQuery = db('form_schemas').count('* as count');
    if (publish_status) {
      totalQuery.where({ publish_status });
    }
    const [{ count }] = await totalQuery;

    return res.json({
      success: true,
      data: {
        schemas,
        total: parseInt(count),
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('[表单Schema] 列表查询失败', error);
    return res.status(500).json({
      success: false,
      error: { message: '查询失败', details: error.message },
    });
  }
}

/**
 * 获取单个Schema（当前版本）
 * GET /admin/form-schemas/:schemaId
 */
async function getFormSchema(req, res) {
  const { schemaId } = req.params;
  const { version } = req.query;

  try {
    let query = db('form_schemas').where({ schema_id: schemaId });

    if (version) {
      query = query.where({ version: parseInt(version) });
    } else {
      query = query.where({ is_current: true });
    }

    const schema = await query.first();

    if (!schema) {
      return res.status(404).json({
        success: false,
        error: { message: 'Schema不存在' },
      });
    }

    return res.json({
      success: true,
      data: schema,
    });
  } catch (error) {
    console.error('[表单Schema] 查询失败', error);
    return res.status(500).json({
      success: false,
      error: { message: '查询失败', details: error.message },
    });
  }
}

/**
 * 获取Schema所有版本
 * GET /admin/form-schemas/:schemaId/versions
 */
async function getFormSchemaVersions(req, res) {
  const { schemaId } = req.params;

  try {
    const versions = await db('form_schemas')
      .where({ schema_id: schemaId })
      .orderBy('version', 'desc')
      .select('version', 'version_description', 'publish_status', 'is_current', 'created_at');

    return res.json({
      success: true,
      data: {
        versions,
        total: versions.length,
      },
    });
  } catch (error) {
    console.error('[表单Schema] 版本列表查询失败', error);
    return res.status(500).json({
      success: false,
      error: { message: '查询失败', details: error.message },
    });
  }
}

/**
 * 创建新Schema
 * POST /admin/form-schemas
 */
async function createFormSchema(req, res) {
  const { schema_id, fields, version_description } = req.body;
  const userId = req.user?.user_id || 'system';

  // 艹！必填字段校验
  if (!schema_id || !fields) {
    return res.status(400).json({
      success: false,
      error: { message: 'schema_id和fields为必填项' },
    });
  }

  try {
    // 检查schema_id是否已存在
    const existing = await db('form_schemas').where({ schema_id }).first();

    if (existing) {
      return res.status(409).json({
        success: false,
        error: { message: 'Schema ID已存在，请使用不同的ID或创建新版本' },
      });
    }

    // 创建新Schema
    await db('form_schemas').insert({
      schema_id,
      fields: JSON.stringify(fields),
      version: 1,
      is_current: true,
      version_description,
      publish_status: 'draft',
      created_by: userId,
    });

    const newSchema = await db('form_schemas')
      .where({ schema_id, version: 1 })
      .first();

    return res.status(201).json({
      success: true,
      data: newSchema,
    });
  } catch (error) {
    console.error('[表单Schema] 创建失败', error);
    return res.status(500).json({
      success: false,
      error: { message: '创建失败', details: error.message },
    });
  }
}

/**
 * 创建新版本
 * POST /admin/form-schemas/:schemaId/versions
 */
async function createFormSchemaVersion(req, res) {
  const { schemaId } = req.params;
  const { fields, version_description } = req.body;
  const userId = req.user?.user_id || 'system';

  if (!fields) {
    return res.status(400).json({
      success: false,
      error: { message: 'fields为必填项' },
    });
  }

  try {
    // 获取当前最大版本号
    const maxVersionRow = await db('form_schemas')
      .where({ schema_id: schemaId })
      .max('version as max_version')
      .first();

    const newVersion = (maxVersionRow.max_version || 0) + 1;

    // 将所有旧版本的is_current设为false
    await db('form_schemas')
      .where({ schema_id: schemaId })
      .update({ is_current: false });

    // 创建新版本
    await db('form_schemas').insert({
      schema_id: schemaId,
      fields: JSON.stringify(fields),
      version: newVersion,
      is_current: true,
      version_description,
      publish_status: 'draft',
      created_by: userId,
    });

    const newSchema = await db('form_schemas')
      .where({ schema_id: schemaId, version: newVersion })
      .first();

    return res.status(201).json({
      success: true,
      data: newSchema,
    });
  } catch (error) {
    console.error('[表单Schema] 创建版本失败', error);
    return res.status(500).json({
      success: false,
      error: { message: '创建版本失败', details: error.message },
    });
  }
}

/**
 * 发布Schema版本
 * PATCH /admin/form-schemas/:schemaId/versions/:version/publish
 */
async function publishFormSchemaVersion(req, res) {
  const { schemaId, version } = req.params;

  try {
    const updated = await db('form_schemas')
      .where({ schema_id: schemaId, version: parseInt(version) })
      .update({ publish_status: 'published', updated_at: db.fn.now() });

    if (updated === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Schema版本不存在' },
      });
    }

    return res.json({
      success: true,
      message: 'Schema已发布',
    });
  } catch (error) {
    console.error('[表单Schema] 发布失败', error);
    return res.status(500).json({
      success: false,
      error: { message: '发布失败', details: error.message },
    });
  }
}

/**
 * 切换当前版本
 * PATCH /admin/form-schemas/:schemaId/versions/:version/switch
 */
async function switchFormSchemaVersion(req, res) {
  const { schemaId, version } = req.params;

  try {
    // 检查目标版本是否存在
    const targetVersion = await db('form_schemas')
      .where({ schema_id: schemaId, version: parseInt(version) })
      .first();

    if (!targetVersion) {
      return res.status(404).json({
        success: false,
        error: { message: 'Schema版本不存在' },
      });
    }

    // 将所有版本的is_current设为false
    await db('form_schemas')
      .where({ schema_id: schemaId })
      .update({ is_current: false });

    // 将目标版本设为当前版本
    await db('form_schemas')
      .where({ schema_id: schemaId, version: parseInt(version) })
      .update({ is_current: true, updated_at: db.fn.now() });

    return res.json({
      success: true,
      message: `已切换到版本${version}`,
    });
  } catch (error) {
    console.error('[表单Schema] 切换版本失败', error);
    return res.status(500).json({
      success: false,
      error: { message: '切换版本失败', details: error.message },
    });
  }
}

/**
 * 删除Schema（软删除，归档）
 * DELETE /admin/form-schemas/:schemaId
 */
async function deleteFormSchema(req, res) {
  const { schemaId } = req.params;

  try {
    // 归档所有版本
    const updated = await db('form_schemas')
      .where({ schema_id: schemaId })
      .update({ publish_status: 'archived', updated_at: db.fn.now() });

    if (updated === 0) {
      return res.status(404).json({
        success: false,
        error: { message: 'Schema不存在' },
      });
    }

    return res.json({
      success: true,
      message: 'Schema已归档',
    });
  } catch (error) {
    console.error('[表单Schema] 删除失败', error);
    return res.status(500).json({
      success: false,
      error: { message: '删除失败', details: error.message },
    });
  }
}

module.exports = {
  listFormSchemas,
  getFormSchema,
  getFormSchemaVersions,
  createFormSchema,
  createFormSchemaVersion,
  publishFormSchemaVersion,
  switchFormSchemaVersion,
  deleteFormSchema,
};
