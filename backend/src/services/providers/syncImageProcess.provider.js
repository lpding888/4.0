const logger = require('../../utils/logger');
const imageProcessService = require('../imageProcess.service');

/**
 * SyncImageProcess Provider
 * 同步图片处理Provider - 直接调用腾讯云数据万象等同步API
 */
class SyncImageProcessProvider {
  constructor(providerRef) {
    this.providerRef = providerRef; // 例如: "tencent_ci_basic_clean"
    logger.info(`[SyncImageProcessProvider] 初始化 providerRef=${providerRef}`);
  }

  /**
   * 执行同步图片处理
   * @param {Object} input - 输入数据 {imageUrl, params}
   * @param {string} taskId - 任务ID
   * @returns {Promise<Object>} 处理结果 {resultUrls, ...}
   */
  async execute(input, taskId) {
    try {
      logger.info(
        `[SyncImageProcessProvider] 开始执行 taskId=${taskId} ` +
        `providerRef=${this.providerRef}`
      );

      const { imageUrl, params } = input;

      if (!imageUrl) {
        throw new Error('缺少必要参数: imageUrl');
      }

      // 根据providerRef选择处理方法
      let result;
      switch (this.providerRef) {
        case 'tencent_ci_basic_clean':
          // 调用现有的基础修图服务
          result = await imageProcessService.processBasicClean(taskId, imageUrl, params || {});
          break;

        case 'tencent_ci_advanced':
          // TODO: 实现高级图片处理
          throw new Error('高级图片处理尚未实现');

        default:
          throw new Error(`未知的providerRef: ${this.providerRef}`);
      }

      logger.info(`[SyncImageProcessProvider] 执行成功 taskId=${taskId}`);

      return {
        resultUrls: result.resultUrls || [],
        metadata: result.metadata || {}
      };

    } catch (error) {
      logger.error(
        `[SyncImageProcessProvider] 执行失败 taskId=${taskId} error=${error.message}`,
        { taskId, error }
      );
      throw error;
    }
  }
}

module.exports = SyncImageProcessProvider;
