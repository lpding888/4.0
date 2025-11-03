const logger = require('../utils/logger');

/**
 * SCF后处理Provider
 * 兼容ProviderRegistry的execute方法
 */
class ScfPostProcessProvider {
  constructor(providerRef) {
    this.providerRef = providerRef;
    this.type = 'SCF_POST_PROCESS';
  }

  /**
   * 执行SCF后处理
   * @param {Object} input - 输入数据
   * @param {string} taskId - 任务ID
   * @returns {Promise<Object>} 处理结果
   */
  async execute(input, taskId) {
    try {
      logger.info(`[ScfPostProcessProvider] 开始处理 taskId=${taskId} providerRef=${this.providerRef}`);

      const { resultUrls, params } = input;

      if (!resultUrls || !Array.isArray(resultUrls)) {
        throw new Error('缺少resultUrls参数或格式错误');
      }

      // 模拟SCF后处理逻辑
      // 在实际应用中，这里会调用SCF函数进行后处理
      await this.simulateSCFProcessing(resultUrls, params || {});

      const processedUrls = resultUrls.map(url => {
        // 模拟处理后的URL（例如添加水印、压缩等）
        return {
          original: url,
          processed: url.replace(/(\.[^.]+)$/, '_processed$1'),
          size: Math.floor(Math.random() * 1000000) + 500000, // 模拟文件大小
          format: 'jpeg'
        };
      });

      logger.info(`[ScfPostProcessProvider] 处理完成 taskId=${taskId} processedCount=${processedUrls.length}`);

      return {
        success: true,
        processedUrls,
        originalUrls: resultUrls,
        taskId,
        providerRef: this.providerRef,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`[ScfPostProcessProvider] 处理失败 taskId=${taskId}`, error);
      throw error;
    }
  }

  /**
   * 模拟SCF处理
   * @param {Array} urls - URL列表
   * @param {Object} params - 处理参数
   * @private
   */
  async simulateSCFProcessing(urls, params) {
    // 模拟处理延迟
    const processingTime = Math.random() * 2000 + 1000; // 1-3秒
    await new Promise(resolve => setTimeout(resolve, processingTime));

    logger.debug(`[ScfPostProcessProvider] SCF处理模拟完成 耗时=${processingTime}ms`);
  }
}

module.exports = ScfPostProcessProvider;