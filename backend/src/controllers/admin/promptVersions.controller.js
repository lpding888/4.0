/**
 * Prompt版本管理控制器 (CMS-304)
 * 艹！提供完整的Prompt版本CRUD和版本控制！
 */

const db = require('../../db');
const logger = require('../../utils/logger');

/**
 * 列出所有Prompt（只显示当前版本）
 * GET /admin/prompts
 */
async function listPrompts(req, res, next) {
  try {
    const { status, search } = req.query;

    let query = db('prompt_versions').where('is_current', true);

    // 状态过滤
    if (status) {
      query = query.where('publish_status', status);
    }

    // 搜索过滤
    if (search) {
      query = query.where((builder) => {
        builder.where('prompt_id', 'like', `%${search}%`).orWhere('description', 'like', `%${search}%`);
      });
    }

    const prompts = await query.select('*').orderBy('created_at', 'desc');

    logger.info('[PromptVersionsController] 获取Prompt列表', {
      count: prompts.length,
      status,
      search,
    });

    res.json({
      success: true,
      data: {
        prompts,
        total: prompts.length,
      },
    });
  } catch (error) {
    logger.error('[PromptVersionsController] 获取列表失败', error);
    next(error);
  }
}

/**
 * 获取Prompt当前版本
 * GET /admin/prompts/:promptId
 */
async function getPrompt(req, res, next) {
  try {
    const { promptId } = req.params;

    const prompt = await db('prompt_versions').where({ prompt_id: promptId, is_current: true }).first();

    if (!prompt) {
      return res.status(404).json({
        success: false,
        error: {
          code: 4004,
          message: `Prompt "${promptId}" 不存在`,
        },
      });
    }

    logger.info('[PromptVersionsController] 获取Prompt详情', { promptId, version: prompt.version });

    res.json({
      success: true,
      data: prompt,
    });
  } catch (error) {
    logger.error('[PromptVersionsController] 获取详情失败', error);
    next(error);
  }
}

/**
 * 获取Prompt所有版本
 * GET /admin/prompts/:promptId/versions
 */
async function getPromptVersions(req, res, next) {
  try {
    const { promptId } = req.params;

    const versions = await db('prompt_versions').where('prompt_id', promptId).orderBy('version', 'desc');

    if (versions.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 4004,
          message: `Prompt "${promptId}" 不存在`,
        },
      });
    }

    logger.info('[PromptVersionsController] 获取版本列表', {
      promptId,
      versionsCount: versions.length,
    });

    res.json({
      success: true,
      data: {
        prompt_id: promptId,
        versions,
        total: versions.length,
      },
    });
  } catch (error) {
    logger.error('[PromptVersionsController] 获取版本列表失败', error);
    next(error);
  }
}

/**
 * 创建新Prompt（第1版）
 * POST /admin/prompts
 *
 * Body: {
 *   prompt_id: string,
 *   template: string,
 *   variables_schema?: object,
 *   description?: string,
 *   author?: string
 * }
 */
async function createPrompt(req, res, next) {
  try {
    const { prompt_id, template, variables_schema, description, author } = req.body;

    // 参数校验
    if (!prompt_id || typeof prompt_id !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 4001,
          message: '缺少必要参数: prompt_id',
        },
      });
    }

    if (!template || typeof template !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 4001,
          message: '缺少必要参数: template',
        },
      });
    }

    // 检查是否已存在
    const existing = await db('prompt_versions').where('prompt_id', prompt_id).first();

    if (existing) {
      return res.status(409).json({
        success: false,
        error: {
          code: 4009,
          message: `Prompt "${prompt_id}" 已存在，请使用版本创建接口`,
        },
      });
    }

    // 创建第1版
    const [id] = await db('prompt_versions').insert({
      prompt_id,
      version: 1,
      is_current: true,
      publish_status: 'draft',
      template,
      variables_schema: variables_schema ? JSON.stringify(variables_schema) : null,
      description: description || `初始版本`,
      author: author || 'admin',
      created_at: new Date(),
      updated_at: new Date(),
    });

    const newPrompt = await db('prompt_versions').where('id', id).first();

    logger.info('[PromptVersionsController] 创建Prompt成功', {
      prompt_id,
      version: 1,
      id,
    });

    res.status(201).json({
      success: true,
      data: newPrompt,
    });
  } catch (error) {
    logger.error('[PromptVersionsController] 创建Prompt失败', error);
    next(error);
  }
}

/**
 * 创建新版本
 * POST /admin/prompts/:promptId/versions
 *
 * Body: {
 *   template: string,
 *   variables_schema?: object,
 *   description?: string,
 *   author?: string
 * }
 */
async function createPromptVersion(req, res, next) {
  try {
    const { promptId } = req.params;
    const { template, variables_schema, description, author } = req.body;

    // 参数校验
    if (!template || typeof template !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 4001,
          message: '缺少必要参数: template',
        },
      });
    }

    // 检查Prompt是否存在
    const existing = await db('prompt_versions').where('prompt_id', promptId).first();

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: {
          code: 4004,
          message: `Prompt "${promptId}" 不存在`,
        },
      });
    }

    // 获取最新版本号
    const latestVersion = await db('prompt_versions')
      .where('prompt_id', promptId)
      .max('version as max_version')
      .first();

    const newVersionNumber = (latestVersion.max_version || 0) + 1;

    // 创建新版本
    const [id] = await db('prompt_versions').insert({
      prompt_id: promptId,
      version: newVersionNumber,
      is_current: false, // 新版本默认不是当前版本
      publish_status: 'draft',
      template,
      variables_schema: variables_schema ? JSON.stringify(variables_schema) : null,
      description: description || `版本 ${newVersionNumber}`,
      author: author || 'admin',
      created_at: new Date(),
      updated_at: new Date(),
    });

    const newVersion = await db('prompt_versions').where('id', id).first();

    logger.info('[PromptVersionsController] 创建新版本成功', {
      promptId,
      version: newVersionNumber,
      id,
    });

    res.status(201).json({
      success: true,
      data: newVersion,
    });
  } catch (error) {
    logger.error('[PromptVersionsController] 创建版本失败', error);
    next(error);
  }
}

/**
 * 发布Prompt版本
 * PATCH /admin/prompts/:promptId/versions/:version/publish
 */
async function publishPromptVersion(req, res, next) {
  try {
    const { promptId, version } = req.params;

    const versionRecord = await db('prompt_versions')
      .where({
        prompt_id: promptId,
        version: parseInt(version, 10),
      })
      .first();

    if (!versionRecord) {
      return res.status(404).json({
        success: false,
        error: {
          code: 4004,
          message: `版本 ${version} 不存在`,
        },
      });
    }

    // 更新状态为published
    await db('prompt_versions')
      .where({
        prompt_id: promptId,
        version: parseInt(version, 10),
      })
      .update({
        publish_status: 'published',
        updated_at: new Date(),
      });

    const updatedVersion = await db('prompt_versions')
      .where({
        prompt_id: promptId,
        version: parseInt(version, 10),
      })
      .first();

    logger.info('[PromptVersionsController] 发布版本成功', {
      promptId,
      version,
    });

    res.json({
      success: true,
      data: updatedVersion,
    });
  } catch (error) {
    logger.error('[PromptVersionsController] 发布版本失败', error);
    next(error);
  }
}

/**
 * 切换当前版本（回滚功能）
 * PATCH /admin/prompts/:promptId/versions/:version/switch
 */
async function switchPromptVersion(req, res, next) {
  try {
    const { promptId, version } = req.params;

    const versionRecord = await db('prompt_versions')
      .where({
        prompt_id: promptId,
        version: parseInt(version, 10),
      })
      .first();

    if (!versionRecord) {
      return res.status(404).json({
        success: false,
        error: {
          code: 4004,
          message: `版本 ${version} 不存在`,
        },
      });
    }

    await db.transaction(async (trx) => {
      // 1. 将当前所有版本的is_current设为false
      await trx('prompt_versions').where('prompt_id', promptId).update({
        is_current: false,
        updated_at: new Date(),
      });

      // 2. 将指定版本的is_current设为true
      await trx('prompt_versions')
        .where({
          prompt_id: promptId,
          version: parseInt(version, 10),
        })
        .update({
          is_current: true,
          updated_at: new Date(),
        });
    });

    const updatedVersion = await db('prompt_versions')
      .where({
        prompt_id: promptId,
        version: parseInt(version, 10),
      })
      .first();

    logger.info('[PromptVersionsController] 切换版本成功', {
      promptId,
      version,
    });

    res.json({
      success: true,
      data: updatedVersion,
      message: `已切换到版本 ${version}`,
    });
  } catch (error) {
    logger.error('[PromptVersionsController] 切换版本失败', error);
    next(error);
  }
}

/**
 * 删除Prompt（归档所有版本）
 * DELETE /admin/prompts/:promptId
 */
async function deletePrompt(req, res, next) {
  try {
    const { promptId } = req.params;

    const versions = await db('prompt_versions').where('prompt_id', promptId);

    if (versions.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 4004,
          message: `Prompt "${promptId}" 不存在`,
        },
      });
    }

    // 将所有版本标记为archived
    await db('prompt_versions').where('prompt_id', promptId).update({
      publish_status: 'archived',
      is_current: false,
      updated_at: new Date(),
    });

    logger.info('[PromptVersionsController] 删除Prompt成功（归档）', {
      promptId,
      versionsCount: versions.length,
    });

    res.json({
      success: true,
      message: `Prompt "${promptId}" 已归档（${versions.length}个版本）`,
    });
  } catch (error) {
    logger.error('[PromptVersionsController] 删除Prompt失败', error);
    next(error);
  }
}

module.exports = {
  listPrompts,
  getPrompt,
  getPromptVersions,
  createPrompt,
  createPromptVersion,
  publishPromptVersion,
  switchPromptVersion,
  deletePrompt,
};
