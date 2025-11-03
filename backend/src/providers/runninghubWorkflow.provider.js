const logger = require('../utils/logger');
const aiModelService = require('../services/aiModel.service');

/**
 * RunningHub工作流Provider
 * 兼容ProviderRegistry的execute方法
 */
class RunninghubWorkflowProvider {
  constructor(providerRef) {
    this.providerRef = providerRef;
    this.type = 'RUNNINGHUB_WORKFLOW';
  }

  /**
   * 执行AI工作流
   * @param {Object} input - 输入数据
   * @param {string} taskId - 任务ID
   * @returns {Promise<Object>} 处理结果
   */
  async execute(input, taskId) {
    try {
      logger.info(`[RunninghubWorkflowProvider] 开始处理 taskId=${taskId} providerRef=${this.providerRef}`);

      const { imageUrl, params, modelType } = input;

      if (!imageUrl && modelType !== 'ai_generate') {
        throw new Error('缺少imageUrl参数');
      }

      if (!modelType) {
        throw new Error('缺少模型类型参数');
      }

      let result;
      switch (modelType) {
        case 'model_pose12':
          result = await aiModelService.createModelTask(taskId, imageUrl, params || {});
          break;
        case 'ai_enhance':
          result = await aiModelService.enhanceImage(taskId, imageUrl, params || {});
          break;
        case 'ai_generate':
          result = await aiModelService.generateImage(taskId, params || {});
          break;
        default:
          throw new Error(`不支持的AI模型类型: ${modelType}`);
      }

      logger.info(`[RunninghubWorkflowProvider] 处理完成 taskId=${taskId} modelType=${modelType}`);

      return {
        success: true,
        modelType,
        resultUrls: result,
        taskId,
        providerRef: this.providerRef,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`[RunninghubWorkflowProvider] 处理失败 taskId=${taskId}`, error);
      throw error;
    }
  }
}

module.exports = RunninghubWorkflowProvider;