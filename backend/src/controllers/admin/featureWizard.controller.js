/**
 * Feature向导控制器 (CMS-208)
 * 艹！专门处理向导页面提交的Feature创建！
 */

const db = require('../../config/database');
const logger = require('../../utils/logger');

/**
 * 通过Feature Wizard创建Feature
 * POST /api/admin/features/wizard
 *
 * 请求体格式：
 * {
 *   // Step 1: 基本信息
 *   feature_id, display_name, description, category, icon,
 *   plan_required, access_scope, quota_cost, rate_limit_policy,
 *
 *   // Step 2: Form Schema (引用已存在的)
 *   form_schema_id,
 *
 *   // Step 3: Pipeline Schema (React Flow格式)
 *   pipeline_schema_id,
 *   pipeline_schema_data: { nodes, edges }
 * }
 */
async function createFeatureFromWizard(req, res, next) {
  try {
    const {
      // Step 1
      feature_id,
      display_name,
      description,
      category,
      icon,
      plan_required,
      access_scope,
      quota_cost,
      rate_limit_policy,

      // Step 2
      form_schema_id,

      // Step 3
      pipeline_schema_id,
      pipeline_schema_data, // { nodes, edges }
    } = req.body;

    // 参数校验
    if (!feature_id || !display_name || !pipeline_schema_id || !pipeline_schema_data) {
      return res.status(400).json({
        success: false,
        error: {
          code: 4001,
          message: '缺少必要参数: feature_id, display_name, pipeline_schema_id, pipeline_schema_data',
        },
      });
    }

    // 检查feature_id是否已存在
    const existingFeature = await db('feature_definitions')
      .where('feature_id', feature_id)
      .whereNull('deleted_at')
      .first();

    if (existingFeature) {
      return res.status(409).json({
        success: false,
        error: {
          code: 4009,
          message: `Feature ID已存在: ${feature_id}`,
        },
      });
    }

    // 如果指定了form_schema_id，检查是否存在
    if (form_schema_id) {
      const existingFormSchema = await db('form_schemas')
        .where('schema_id', form_schema_id)
        .where('is_current', true)
        .first();

      if (!existingFormSchema) {
        return res.status(404).json({
          success: false,
          error: {
            code: 4004,
            message: `Form Schema不存在: ${form_schema_id}`,
          },
        });
      }
    }

    // 转换React Flow数据为steps数组
    const steps = convertReactFlowToSteps(pipeline_schema_data);

    if (!steps || steps.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 4001,
          message: 'Pipeline为空，至少需要一个步骤节点',
        },
      });
    }

    // 在事务中创建Feature
    await db.transaction(async (trx) => {
      // 1. 插入pipeline_schema
      await trx('pipeline_schemas').insert({
        pipeline_id: pipeline_schema_id,
        steps: JSON.stringify(steps),
        created_at: new Date(),
        updated_at: new Date(),
      });

      // 2. 插入feature_definition
      await trx('feature_definitions').insert({
        feature_id,
        display_name,
        description,
        category: category || '图片处理',
        icon: icon || 'picture',
        plan_required: plan_required || 'free',
        access_scope: access_scope || 'plan',
        quota_cost: quota_cost || 1,
        rate_limit_policy: rate_limit_policy || null,
        form_schema_ref: form_schema_id || null,
        pipeline_schema_ref: pipeline_schema_id,
        is_enabled: false, // 默认禁用，管理员需要手动启用
        created_at: new Date(),
        updated_at: new Date(),
      });
    });

    logger.info(`[FeatureWizard] Feature创建成功 feature_id=${feature_id} steps=${steps.length}`);

    res.json({
      success: true,
      message: 'Feature创建成功',
      data: {
        feature_id,
        pipeline_steps: steps.length,
      },
    });
  } catch (error) {
    logger.error(`[FeatureWizard] 创建失败: ${error.message}`, error);
    next(error);
  }
}

/**
 * 将React Flow的nodes/edges转换为Pipeline steps数组
 * 艹！这个tm的转换逻辑很重要！
 *
 * React Flow格式：
 * {
 *   nodes: [ { id, type, position, data: { label, providerRef } }, ... ],
 *   edges: [ { id, source, target }, ... ]
 * }
 *
 * Steps数组格式：
 * [
 *   { type: 'provider', provider_ref: 'xxx', timeout: 30000, retry_policy: {} },
 *   ...
 * ]
 */
function convertReactFlowToSteps(pipelineData) {
  const { nodes, edges } = pipelineData;

  if (!nodes || !Array.isArray(nodes)) {
    throw new Error('Invalid pipeline_schema_data.nodes');
  }

  if (!edges || !Array.isArray(edges)) {
    // edges可以为空数组
    pipelineData.edges = [];
  }

  // 艹！从start节点开始，按连线顺序构建步骤
  const startNode = nodes.find((n) => n.type === 'start');
  if (!startNode) {
    throw new Error('Pipeline必须包含一个start节点');
  }

  // 构建邻接表
  const adjacencyMap = new Map();
  edges.forEach((edge) => {
    if (!adjacencyMap.has(edge.source)) {
      adjacencyMap.set(edge.source, []);
    }
    adjacencyMap.get(edge.source).push(edge.target);
  });

  // 从start节点开始遍历
  const steps = [];
  const visited = new Set();
  let currentNodeId = startNode.id;

  while (currentNodeId) {
    // 防止死循环
    if (visited.has(currentNodeId)) {
      logger.warn(`[FeatureWizard] 检测到循环依赖 node=${currentNodeId}`);
      break;
    }
    visited.add(currentNodeId);

    // 找到当前节点
    const currentNode = nodes.find((n) => n.id === currentNodeId);
    if (!currentNode) break;

    // 如果不是start节点，添加到steps（start节点不执行，只是起点）
    if (currentNode.type !== 'start') {
      const step = {
        type: currentNode.type || 'provider',
        provider_ref: currentNode.data?.providerRef || currentNode.data?.provider_ref || '',
        timeout: currentNode.data?.timeout || 30000,
        retry_policy: currentNode.data?.retry_policy || currentNode.data?.retryPolicy || {},
      };

      // 校验provider_ref
      if (step.type === 'provider' && !step.provider_ref) {
        throw new Error(`节点 ${currentNode.id} 缺少provider_ref配置`);
      }

      steps.push(step);
    }

    // 找到下一个节点
    const nextNodes = adjacencyMap.get(currentNodeId);
    if (!nextNodes || nextNodes.length === 0) {
      // 没有下一个节点，结束
      break;
    }

    // 如果有多个下一个节点（分支），只取第一个（暂不支持并行）
    if (nextNodes.length > 1) {
      logger.warn(
        `[FeatureWizard] 节点 ${currentNodeId} 有多个后续节点，暂不支持并行，只取第一个`
      );
    }
    currentNodeId = nextNodes[0];
  }

  logger.info(`[FeatureWizard] 转换Pipeline: ${nodes.length}个节点 -> ${steps.length}个步骤`);

  return steps;
}

module.exports = {
  createFeatureFromWizard,
};
