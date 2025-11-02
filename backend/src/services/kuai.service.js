const axios = require('axios');
const logger = require('../utils/logger');

/**
 * KUAI API服务 - 快影视频生成
 */
class KuaiService {
  constructor() {
    // 延迟初始化，不在构造函数中强制检查配置
    this._initialized = false;
  }

  /**
   * 初始化配置（懒加载）
   */
  _initialize() {
    if (this._initialized) return;

    this.apiKey = process.env.KUAI_API_KEY;
    this.baseUrl = 'https://apis.kuai.host';

    if (!this.apiKey) {
      logger.error('[KuaiService] KUAI API密钥未配置');
      throw new Error('KUAI API密钥未配置，请在.env文件中配置KUAI_API_KEY');
    }

    this._initialized = true;
    logger.info('[KuaiService] KUAI服务初始化成功');
  }

  /**
   * 创建视频生成任务
   * @param {string} script - 拍摄脚本
   * @param {string} imageUrl - 服装图片URL
   * @param {Object} params - 额外参数
   * @returns {Promise<Object>} 包含vendorTaskId的响应
   */
  async createVideoTask(script, imageUrl, params = {}) {
    this._initialize();
    try {
      const requestData = {
        model: params.model || 'veo3-fast',
        prompt: script,
        images: [imageUrl],
        aspect_ratio: '16:9',
        enhance_prompt: true,    // 自动中文转英文
        enable_upsample: false   // 保持720p
      };

      logger.info('[KuaiService] 开始创建视频任务', {
        imageUrl,
        model: requestData.model,
        scriptLength: script.length
      });

      const response = await axios.post(
        `${this.baseUrl}/v1/video/create`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 15000 // 15秒超时
        }
      );

      if (response.data && response.data.id) {
        logger.info('[KuaiService] 视频任务创建成功', {
          vendorTaskId: response.data.id,
          status: response.data.status
        });

        return {
          vendorTaskId: response.data.id,
          status: response.data.status,
          enhancedPrompt: response.data.enhanced_prompt
        };
      } else {
        throw new Error('KUAI API返回格式异常');
      }

    } catch (error) {
      logger.error('[KuaiService] 创建视频任务失败', {
        imageUrl,
        error: error.message,
        response: error.response?.data
      });

      if (error.code === 'ECONNABORTED') {
        throw new Error('KUAI API调用超时');
      }

      if (error.response?.status === 401) {
        throw new Error('KUAI API密钥无效');
      }

      if (error.response?.status === 429) {
        throw new Error('KUAI API调用频率限制');
      }

      throw new Error(`视频任务创建失败: ${error.message}`);
    }
  }

  /**
   * 查询视频任务状态
   * @param {string} vendorTaskId - KUAI返回的任务ID
   * @returns {Promise<Object>} 任务状态信息
   */
  async queryVideoStatus(vendorTaskId) {
    this._initialize();

    try {
      logger.info('[KuaiService] 查询视频任务状态', { vendorTaskId });

      const response = await axios.get(
        `${this.baseUrl}/v1/video/query?id=${vendorTaskId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Accept': 'application/json'
          },
          timeout: 10000 // 10秒超时
        }
      );

      if (response.data) {
        const { id, status, video_url, error_message, status_update_time } = response.data;

        logger.info('[KuaiService] 视频状态查询成功', {
          vendorTaskId: id,
          status,
          hasVideo: !!video_url,
          hasError: !!error_message
        });

        return {
          vendorTaskId: id,
          status, // pending/processing/success/failed
          videoUrl: video_url,
          errorMessage: error_message,
          statusUpdateTime: status_update_time
        };
      } else {
        throw new Error('KUAI API返回格式异常');
      }

    } catch (error) {
      logger.error('[KuaiService] 查询视频状态失败', {
        vendorTaskId,
        error: error.message,
        response: error.response?.data
      });

      if (error.code === 'ECONNABORTED') {
        throw new Error('KUAI API调用超时');
      }

      throw new Error(`视频状态查询失败: ${error.message}`);
    }
  }

  /**
   * 检查任务是否超时
   * @param {Date} createdAt - 任务创建时间
   * @param {number} timeoutHours - 超时小时数
   * @returns {boolean} 是否超时
   */
  isTimeout(createdAt, timeoutHours = 2) {
    const now = new Date();
    const timeoutMs = timeoutHours * 60 * 60 * 1000;
    return (now - createdAt) > timeoutMs;
  }

  /**
   * 获取错误信息的友好描述
   * @param {string} errorCode - 错误代码
   * @returns {string} 友好的错误描述
   */
  getErrorMessage(errorCode) {
    const errorMap = {
      'KUAI_GENERATION_FAILED': '视频生成失败，请重试',
      'CONTENT_VIOLATION': '生成内容违规，请更换图片',
      'API_RATE_LIMIT': 'API调用频率限制，请稍后重试',
      'TIMEOUT': '处理超时，请重试',
      'NETWORK_ERROR': '网络连接失败，请重试'
    };

    return errorMap[errorCode] || '视频生成失败，请重试';
  }
}

module.exports = new KuaiService();