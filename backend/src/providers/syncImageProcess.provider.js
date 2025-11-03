const logger = require('../utils/logger');
const imageProcessService = require('../services/imageProcess.service');

/**
 * 同步图像处理Provider
 * 兼容ProviderRegistry的execute方法
 */
class SyncImageProcessProvider {
  constructor(providerRef) {
    this.providerRef = providerRef;
    this.type = 'SYNC_IMAGE_PROCESS';
  }

  /**
   * 执行图像处理
   * @param {Object} input - 输入数据
   * @param {string} taskId - 任务ID
   * @returns {Promise<Object>} 处理结果
   */
  async execute(input, taskId) {
    try {
      logger.info(`[SyncImageProcessProvider] 开始处理 taskId=${taskId} providerRef=${this.providerRef}`);

      const { imageUrl, params, type } = input;

      if (!imageUrl) {
        throw new Error('缺少imageUrl参数');
      }

      if (!type) {
        throw new Error('缺少处理类型参数');
      }

      let result;
      switch (type) {
        case 'basic_clean':
          result = await imageProcessService.processBasicClean(taskId, imageUrl, params || {});
          break;
        case 'enhance':
          result = await imageProcessService.processEnhance(taskId, imageUrl, params || {});
          break;
        case 'background_remove':
          result = await imageProcessService.processBackgroundRemove(taskId, imageUrl, params || {});
          break;
        default:
          throw new Error(`不支持的图像处理类型: ${type}`);
      }

      logger.info(`[SyncImageProcessProvider] 处理完成 taskId=${taskId} type=${type}`);

      return {
        success: true,
        type,
        resultUrls: result,
        taskId,
        providerRef: this.providerRef,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`[SyncImageProcessProvider] 处理失败 taskId=${taskId}`, error);
      throw error;
    }
  }
}

module.exports = SyncImageProcessProvider;