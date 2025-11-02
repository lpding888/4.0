const logger = require('../../utils/logger');
const aiModelService = require('../aiModel.service');

/**
 * RunningHub Workflow Provider
 * 异步工作流Provider - 提交到RunningHub后通过轮询获取结果
 */
class RunninghubWorkflowProvider {
  constructor(providerRef) {
    this.providerRef = providerRef; // 例如: "runninghub_model_pose12"
    logger.info(`[RunninghubWorkflowProvider] 初始化 providerRef=${providerRef}`);
  }

  /**
   * 执行异步工作流
   * @param {Object} input - 输入数据 {imageUrl, params}
   * @param {string} taskId - 任务ID
   * @returns {Promise<Object>} 提交结果 {vendorTaskId, status}
   */
  async execute(input, taskId) {
    try {
      logger.info(
        `[RunninghubWorkflowProvider] 开始执行 taskId=${taskId} ` +
        `providerRef=${this.providerRef}`
      );

      const { imageUrl, params } = input;

      if (!imageUrl) {
        throw new Error('缺少必要参数: imageUrl');
      }

      // 根据providerRef选择工作流
      let result;
      switch (this.providerRef) {
        case 'runninghub_model_pose12':
          // 调用现有的AI模特服务
          result = await aiModelService.createModelTask(taskId, imageUrl, params || {});
          break;

        case 'runninghub_custom_workflow':
          // TODO: 实现自定义工作流
          throw new Error('自定义工作流尚未实现');

        default:
          throw new Error(`未知的providerRef: ${this.providerRef}`);
      }

      logger.info(
        `[RunninghubWorkflowProvider] 提交成功 taskId=${taskId} ` +
        `vendorTaskId=${result.vendorTaskId}`
      );

      // 返回vendorTaskId供后续轮询使用
      return {
        vendorTaskId: result.vendorTaskId,
        status: 'submitted',
        message: '任务已提交,等待轮询服务获取结果'
      };

    } catch (error) {
      logger.error(
        `[RunninghubWorkflowProvider] 执行失败 taskId=${taskId} error=${error.message}`,
        { taskId, error }
      );
      throw error;
    }
  }
}

module.exports = RunninghubWorkflowProvider;
