const logger = require('../../utils/logger');

/**
 * SCF Post-Process Provider
 * 云函数后处理Provider - 调用腾讯云SCF进行后处理(水印/裁剪/压缩等)
 */
class ScfPostProcessProvider {
  constructor(providerRef) {
    this.providerRef = providerRef; // 例如: "scf_watermark", "scf_compress"
    logger.info(`[ScfPostProcessProvider] 初始化 providerRef=${providerRef}`);
  }

  /**
   * 执行SCF后处理
   * @param {Object} input - 输入数据 {resultUrls, params}
   * @param {string} taskId - 任务ID
   * @returns {Promise<Object>} 处理结果 {resultUrls, ...}
   */
  async execute(input, taskId) {
    try {
      logger.info(
        `[ScfPostProcessProvider] 开始执行 taskId=${taskId} ` +
        `providerRef=${this.providerRef}`
      );

      const { resultUrls, params } = input;

      if (!resultUrls || !Array.isArray(resultUrls) || resultUrls.length === 0) {
        throw new Error('缺少必要参数: resultUrls');
      }

      // TODO: 实现实际的SCF调用逻辑
      // 根据providerRef选择不同的云函数
      let processedUrls;
      switch (this.providerRef) {
        case 'scf_watermark':
          // TODO: 调用水印云函数
          logger.warn(`[ScfPostProcessProvider] 水印功能尚未实现,直接返回原图`);
          processedUrls = resultUrls;
          break;

        case 'scf_compress':
          // TODO: 调用压缩云函数
          logger.warn(`[ScfPostProcessProvider] 压缩功能尚未实现,直接返回原图`);
          processedUrls = resultUrls;
          break;

        case 'scf_custom':
          // TODO: 调用自定义云函数
          throw new Error('自定义云函数尚未实现');

        default:
          throw new Error(`未知的providerRef: ${this.providerRef}`);
      }

      logger.info(`[ScfPostProcessProvider] 执行成功 taskId=${taskId}`);

      return {
        resultUrls: processedUrls,
        processed: true,
        providerRef: this.providerRef
      };

    } catch (error) {
      logger.error(
        `[ScfPostProcessProvider] 执行失败 taskId=${taskId} error=${error.message}`,
        { taskId, error }
      );
      throw error;
    }
  }
}

module.exports = ScfPostProcessProvider;
