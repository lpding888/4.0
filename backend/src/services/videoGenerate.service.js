const hunyuanService = require('./hunyuan.service');
const kuaiService = require('./kuai.service');
const logger = require('../utils/logger');

/**
 * 视频生成服务 - 整合混元脚本生成和KUAI视频生成
 */
class VideoGenerateService {
  /**
   * 处理视频生成任务
   * @param {string} taskId - 任务ID
   * @param {string} imageUrl - 输入图片URL
   * @param {Object} params - 任务参数
   * @returns {Promise<Object>} 包含vendorTaskId的结果
   */
  async processVideoTask(taskId, imageUrl, params = {}) {
    try {
      logger.info('[VideoGenerateService] 开始处理视频任务', {
        taskId,
        imageUrl,
        params
      });

      // 第1步：生成拍摄脚本
      const shootingScript = await this.generateShootingScript(imageUrl, params);

      // 第2步：创建KUAI视频任务
      const kuaiResult = await this.createKuaiVideoTask(shootingScript, imageUrl, params);

      logger.info('[VideoGenerateService] 视频任务处理完成', {
        taskId,
        vendorTaskId: kuaiResult.vendorTaskId,
        status: kuaiResult.status
      });

      return {
        vendorTaskId: kuaiResult.vendorTaskId,
        status: kuaiResult.status,
        shootingScript: shootingScript,
        enhancedPrompt: kuaiResult.enhancedPrompt
      };

    } catch (error) {
      logger.error('[VideoGenerateService] 视频任务处理失败', {
        taskId,
        imageUrl,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 生成拍摄脚本
   * @param {string} imageUrl - 输入图片URL
   * @param {Object} params - 参数
   * @returns {Promise<string>} 拍摄脚本
   */
  async generateShootingScript(imageUrl, params) {
    try {
      logger.info('[VideoGenerateService] 生成拍摄脚本', { imageUrl });

      const script = await hunyuanService.generateShootingScript(imageUrl, params);

      // 验证脚本质量
      if (!hunyuanService.validateScript(script)) {
        throw new Error('生成的拍摄脚本质量不符合要求');
      }

      logger.info('[VideoGenerateService] 拍摄脚本生成成功', {
        imageUrl,
        scriptLength: script.length
      });

      return script;

    } catch (error) {
      logger.error('[VideoGenerateService] 拍摄脚本生成失败', {
        imageUrl,
        error: error.message
      });
      throw new Error(`拍摄脚本生成失败: ${error.message}`);
    }
  }

  /**
   * 创建KUAI视频任务
   * @param {string} script - 拍摄脚本
   * @param {string} imageUrl - 图片URL
   * @param {Object} params - 参数
   * @returns {Promise<Object>} KUAI任务结果
   */
  async createKuaiVideoTask(script, imageUrl, params) {
    try {
      logger.info('[VideoGenerateService] 创建KUAI视频任务', {
        imageUrl,
        scriptLength: script.length,
        model: params.model
      });

      const result = await kuaiService.createVideoTask(script, imageUrl, params);

      logger.info('[VideoGenerateService] KUAI视频任务创建成功', {
        vendorTaskId: result.vendorTaskId,
        status: result.status
      });

      return result;

    } catch (error) {
      logger.error('[VideoGenerateService] KUAI视频任务创建失败', {
        imageUrl,
        error: error.message
      });
      throw new Error(`视频任务创建失败: ${error.message}`);
    }
  }

  /**
   * 轮询视频任务状态
   * @param {string} vendorTaskId - KUAI任务ID
   * @returns {Promise<Object>} 任务状态
   */
  async pollVideoStatus(vendorTaskId) {
    try {
      return await kuaiService.queryVideoStatus(vendorTaskId);
    } catch (error) {
      logger.error('[VideoGenerateService] 轮询视频状态失败', {
        vendorTaskId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 检查任务是否超时
   * @param {Date} createdAt - 创建时间
   * @returns {boolean} 是否超时
   */
  isTimeout(createdAt) {
    return kuaiService.isTimeout(createdAt, 2); // 2小时超时
  }

  /**
   * 获取友好的错误信息
   * @param {string} errorType - 错误类型
   * @returns {string} 友好错误信息
   */
  getErrorMessage(errorType) {
    return kuaiService.getErrorMessage(errorType);
  }
}

module.exports = new VideoGenerateService();