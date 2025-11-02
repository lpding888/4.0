/**
 * Pipeline校验控制器 (CMS-204)
 * 艹！提供Pipeline拓扑校验API！
 */

const pipelineValidator = require('../../services/pipelineValidator.service');
const logger = require('../../utils/logger');

/**
 * 校验Pipeline拓扑结构
 * POST /admin/pipelines/validate
 *
 * Body: {
 *   nodes: [...],
 *   edges: [...]
 * }
 */
async function validatePipeline(req, res, next) {
  try {
    const { nodes, edges } = req.body;

    // 参数校验
    if (!Array.isArray(nodes)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 4001,
          message: '缺少必要参数: nodes (数组)',
        },
      });
    }

    if (!Array.isArray(edges)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 4001,
          message: '缺少必要参数: edges (数组)',
        },
      });
    }

    // 执行校验
    const validation = pipelineValidator.validatePipelineTopology({
      nodes,
      edges,
    });

    logger.info('[PipelinesValidateController] 校验完成', {
      nodesCount: nodes.length,
      edgesCount: edges.length,
      valid: validation.valid,
      errorsCount: validation.errors.length,
      warningsCount: validation.warnings.length,
    });

    res.json({
      success: true,
      data: {
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
        summary: {
          nodesCount: nodes.length,
          edgesCount: edges.length,
          errorsCount: validation.errors.length,
          warningsCount: validation.warnings.length,
        },
      },
    });
  } catch (error) {
    logger.error('[PipelinesValidateController] 校验失败', error);
    next(error);
  }
}

/**
 * 获取Pipeline拓扑排序
 * POST /admin/pipelines/topological-order
 *
 * Body: {
 *   nodes: [...],
 *   edges: [...]
 * }
 */
async function getTopologicalOrder(req, res, next) {
  try {
    const { nodes, edges } = req.body;

    if (!Array.isArray(nodes) || !Array.isArray(edges)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 4001,
          message: '缺少必要参数: nodes, edges',
        },
      });
    }

    // 执行Kahn算法
    const result = pipelineValidator.detectCyclesUsingKahn(nodes, edges);

    res.json({
      success: true,
      data: {
        isDAG: result.isDAG,
        topologicalOrder: result.topologicalOrder,
        remainingNodes: result.remainingNodes,
        hasCycle: !result.isDAG,
      },
    });
  } catch (error) {
    logger.error('[PipelinesValidateController] 获取拓扑排序失败', error);
    next(error);
  }
}

module.exports = {
  validatePipeline,
  getTopologicalOrder,
};
