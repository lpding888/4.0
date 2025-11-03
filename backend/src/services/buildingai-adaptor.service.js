const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const { ERROR_CODES } = require('../config/error-codes');
const axios = require('axios');
const crypto = require('crypto');

/**
 * BuildingAI侧车适配层服务
 *
 * 为AI功能提供统一的适配接口：
 * - 统一的API调用格式
 * - 请求/响应转换
 * - 错误处理和重试
 * - 限流和缓存
 * - 监控和统计
 */
class BuildingAIAdaptorService {
  constructor() {
    this.initialized = false;
    this.baseURL = process.env.BUILDING_AI_BASE_URL || 'https://api.buildingai.com';
    this.apiKey = process.env.BUILDING_AI_API_KEY;
    this.timeout = parseInt(process.env.BUILDING_AI_TIMEOUT) || 30000;
    this.retryAttempts = parseInt(process.env.BUILDING_AI_RETRY_ATTEMPTS) || 3;
    this.retryDelay = parseInt(process.env.BUILDING_AI_RETRY_DELAY) || 1000;

    // 请求限流配置
    this.rateLimit = {
      requests: parseInt(process.env.BUILDING_AI_RATE_LIMIT) || 100,
      window: parseInt(process.env.BUILDING_AI_RATE_WINDOW) || 60000, // 1分钟
      current: 0,
      resetTime: Date.now() + 60000
    };

    // 统计信息
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalResponseTime: 0,
      averageResponseTime: 0,
      lastRequestTime: null,
      errorsByType: {}
    };

    // 功能映射表
    this.featureMapping = {
      'image_enhance': '/v1/image/enhance',
      'image_generate': '/v1/image/generate',
      'image_edit': '/v1/image/edit',
      'text_generate': '/v1/text/generate',
      'text_translate': '/v1/text/translate',
      'text_summarize': '/v1/text/summarize',
      'audio_transcribe': '/v1/audio/transcribe',
      'video_analyze': '/v1/video/analyze',
      'data_analyze': '/v1/data/analyze'
    };
  }

  /**
   * 初始化BuildingAI适配服务
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('[BuildingAIAdaptor] Initializing BuildingAI adaptor service...');

      // 验证配置
      this.validateConfiguration();

      // 设置Axios实例
      this.httpClient = axios.create({
        baseURL: this.baseURL,
        timeout: this.timeout,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'AI-Photo-Processor/1.0'
        }
      });

      // 设置请求和响应拦截器
      this.setupInterceptors();

      // 测试连接
      await this.testConnection();

      this.initialized = true;
      logger.info('[BuildingAIAdaptor] BuildingAI adaptor service initialized successfully');

    } catch (error) {
      logger.error('[BuildingAIAdaptor] Failed to initialize BuildingAI adaptor service:', error);
      throw error;
    }
  }

  /**
   * 验证配置
   */
  validateConfiguration() {
    if (!this.apiKey) {
      throw new Error('BUILDING_AI_API_KEY is required');
    }

    if (!this.baseURL) {
      throw new Error('BUILDING_AI_BASE_URL is required');
    }

    try {
      new URL(this.baseURL);
    } catch (error) {
      throw new Error('Invalid BUILDING_AI_BASE_URL format');
    }
  }

  /**
   * 设置HTTP拦截器
   */
  setupInterceptors() {
    // 请求拦截器
    this.httpClient.interceptors.request.use(
      (config) => {
        // 添加请求ID和时间戳
        config.headers['X-Request-ID'] = crypto.randomUUID();
        config.headers['X-Request-Time'] = new Date().toISOString();

        // 记录请求开始时间
        config.metadata = { startTime: Date.now() };

        logger.debug(`[BuildingAIAdaptor] Sending request to ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('[BuildingAIAdaptor] Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.httpClient.interceptors.response.use(
      (response) => {
        // 计算响应时间
        const responseTime = Date.now() - response.config.metadata.startTime;
        response.metadata = { responseTime };

        // 更新统计信息
        this.updateStats(responseTime, true);

        logger.debug(`[BuildingAIAdaptor] Response received from ${response.config.url} in ${responseTime}ms`);
        return response;
      },
      (error) => {
        // 计算响应时间
        const responseTime = error.config?.metadata?.startTime
          ? Date.now() - error.config.metadata.startTime
          : 0;

        // 更新统计信息
        this.updateStats(responseTime, false, error);

        logger.error(`[BuildingAIAdaptor] Request failed: ${error.message}`);
        return Promise.reject(error);
      }
    );
  }

  /**
   * 测试连接
   */
  async testConnection() {
    try {
      const response = await this.httpClient.get('/v1/health');
      if (response.status !== 200) {
        throw new Error(`Health check failed with status ${response.status}`);
      }
      logger.info('[BuildingAIAdaptor] Connection test successful');
    } catch (error) {
      logger.error('[BuildingAIAdaptor] Connection test failed:', error);
      throw new Error('BuildingAI service is not accessible');
    }
  }

  /**
   * 检查限流
   */
  checkRateLimit() {
    const now = Date.now();

    // 重置计数器
    if (now > this.rateLimit.resetTime) {
      this.rateLimit.current = 0;
      this.rateLimit.resetTime = now + this.rateLimit.window;
    }

    // 检查是否超过限制
    if (this.rateLimit.current >= this.rateLimit.requests) {
      const waitTime = this.rateLimit.resetTime - now;
      throw AppError.create(ERROR_CODES.RATE_LIMIT_EXCEEDED, {
        service: 'BuildingAI',
        waitTime: Math.ceil(waitTime / 1000),
        limit: this.rateLimit.requests,
        window: this.rateLimit.window / 1000
      });
    }

    this.rateLimit.current++;
  }

  /**
   * 调用BuildingAI API
   * @param {string} feature - 功能类型
   * @param {Object} data - 请求数据
   * @param {Object} options - 请求选项
   * @returns {Object} 响应数据
   */
  async callAPI(feature, data, options = {}) {
    try {
      // 检查限流
      this.checkRateLimit();

      // 获取API端点
      const endpoint = this.getEndpoint(feature);
      if (!endpoint) {
        throw AppError.create(ERROR_CODES.TASK_NOT_FOUND, {
          feature,
          message: 'Unsupported feature'
        });
      }

      // 转换请求数据
      const requestData = this.transformRequest(feature, data);

      // 发送请求
      const response = await this.makeRequest(endpoint, requestData, options);

      // 转换响应数据
      const result = this.transformResponse(feature, response.data);

      logger.info(`[BuildingAIAdaptor] Successfully processed ${feature} request`);
      return result;

    } catch (error) {
      logger.error(`[BuildingAIAdaptor] Failed to process ${feature} request:`, error);
      throw this.handleError(error, feature);
    }
  }

  /**
   * 获取API端点
   * @param {string} feature - 功能类型
   * @returns {string} API端点
   */
  getEndpoint(feature) {
    return this.featureMapping[feature];
  }

  /**
   * 转换请求数据
   * @param {string} feature - 功能类型
   * @param {Object} data - 原始数据
   * @returns {Object} 转换后的数据
   */
  transformRequest(feature, data) {
    switch (feature) {
      case 'image_enhance':
        return {
          image: data.imageUrl || data.imageBase64,
          enhancement_level: data.level || 'medium',
          output_format: data.outputFormat || 'png'
        };

      case 'image_generate':
        return {
          prompt: data.prompt,
          style: data.style || 'realistic',
          size: data.size || '1024x1024',
          quality: data.quality || 'standard'
        };

      case 'image_edit':
        return {
          image: data.imageUrl || data.imageBase64,
          mask: data.maskUrl || data.maskBase64,
          prompt: data.prompt,
          n: data.count || 1
        };

      case 'text_generate':
        return {
          prompt: data.prompt,
          max_tokens: data.maxTokens || 500,
          temperature: data.temperature || 0.7,
          model: data.model || 'gpt-3.5-turbo'
        };

      case 'text_translate':
        return {
          text: data.text,
          source_language: data.sourceLanguage || 'auto',
          target_language: data.targetLanguage,
          format: data.format || 'text'
        };

      case 'text_summarize':
        return {
          text: data.text,
          summary_length: data.length || 'medium',
          style: data.style || 'professional'
        };

      case 'audio_transcribe':
        return {
          audio: data.audioUrl || data.audioBase64,
          language: data.language || 'auto',
          format: data.outputFormat || 'text'
        };

      case 'video_analyze':
        return {
          video: data.videoUrl || data.videoBase64,
          analysis_type: data.analysisType || 'content',
          detail_level: data.detailLevel || 'medium'
        };

      case 'data_analyze':
        return {
          data: data.data,
          analysis_type: data.analysisType || 'statistical',
          output_format: data.outputFormat || 'json'
        };

      default:
        return data;
    }
  }

  /**
   * 转换响应数据
   * @param {string} feature - 功能类型
   * @param {Object} response - 原始响应
   * @returns {Object} 转换后的数据
   */
  transformResponse(feature, response) {
    switch (feature) {
      case 'image_enhance':
        return {
          success: true,
          enhancedImage: response.output_url || response.image,
          metadata: {
            originalSize: response.original_size,
            enhancedSize: response.enhanced_size,
            processingTime: response.processing_time
          }
        };

      case 'image_generate':
        return {
          success: true,
          images: response.data?.map(img => ({
            url: img.url,
            size: img.size,
            revisedPrompt: img.revised_prompt
          })) || [],
          metadata: {
            count: response.data?.length || 0,
            model: response.model,
            processingTime: response.processing_time
          }
        };

      case 'image_edit':
        return {
          success: true,
          images: response.data?.map(img => ({
            url: img.url,
            size: img.size
          })) || [],
          metadata: {
            count: response.data?.length || 0,
            processingTime: response.processing_time
          }
        };

      case 'text_generate':
        return {
          success: true,
          text: response.choices?.[0]?.text?.trim() || response.text,
          metadata: {
            model: response.model,
            usage: response.usage,
            finishReason: response.choices?.[0]?.finish_reason
          }
        };

      case 'text_translate':
        return {
          success: true,
          translatedText: response.translated_text,
          metadata: {
            sourceLanguage: response.source_language,
            targetLanguage: response.target_language,
            confidence: response.confidence
          }
        };

      case 'text_summarize':
        return {
          success: true,
          summary: response.summary,
          metadata: {
            originalLength: response.original_length,
            summaryLength: response.summary_length,
            compressionRatio: response.compression_ratio
          }
        };

      case 'audio_transcribe':
        return {
          success: true,
          transcript: response.text,
          metadata: {
            language: response.language,
            duration: response.duration,
            confidence: response.confidence
          }
        };

      case 'video_analyze':
        return {
          success: true,
          analysis: response.analysis,
          metadata: {
            duration: response.duration,
            frameCount: response.frame_count,
            processingTime: response.processing_time
          }
        };

      case 'data_analyze':
        return {
          success: true,
          results: response.results,
          metadata: {
            dataType: response.data_type,
            recordCount: response.record_count,
            processingTime: response.processing_time
          }
        };

      default:
        return {
          success: true,
          data: response
        };
    }
  }

  /**
   * 发送HTTP请求
   * @param {string} endpoint - API端点
   * @param {Object} data - 请求数据
   * @param {Object} options - 请求选项
   * @returns {Object} HTTP响应
   */
  async makeRequest(endpoint, data, options = {}) {
    const {
      method = 'POST',
      retries = this.retryAttempts,
      retryDelay = this.retryDelay
    } = options;

    let lastError;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await this.httpClient.request({
          method,
          url: endpoint,
          data: method === 'GET' ? undefined : data,
          params: method === 'GET' ? data : undefined
        });

        return response;

      } catch (error) {
        lastError = error;

        // 如果是最后一次尝试或者不需要重试的错误，直接抛出
        if (attempt === retries || !this.shouldRetry(error)) {
          throw error;
        }

        // 等待后重试
        const delay = retryDelay * attempt;
        logger.warn(`[BuildingAIAdaptor] Request failed, retrying in ${delay}ms (attempt ${attempt}/${retries})`);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * 判断是否应该重试
   * @param {Error} error - 错误对象
   * @returns {boolean} 是否应该重试
   */
  shouldRetry(error) {
    // 网络错误或超时应该重试
    if (error.code === 'ECONNRESET' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND') {
      return true;
    }

    // HTTP状态码 5xx 应该重试
    if (error.response?.status >= 500) {
      return true;
    }

    // 429 (Too Many Requests) 应该重试
    if (error.response?.status === 429) {
      return true;
    }

    return false;
  }

  /**
   * 睡眠函数
   * @param {number} ms - 睡眠时间（毫秒）
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 处理错误
   * @param {Error} error - 原始错误
   * @param {string} feature - 功能类型
   * @returns {AppError} 转换后的错误
   */
  handleError(error, feature) {
    if (error.response) {
      // HTTP错误响应
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 400:
          return AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
            feature,
            service: 'BuildingAI',
            details: data?.message || 'Bad request'
          });

        case 401:
          return AppError.create(ERROR_CODES.UNAUTHORIZED, {
            feature,
            service: 'BuildingAI',
            details: 'Invalid API key'
          });

        case 403:
          return AppError.create(ERROR_CODES.PERMISSION_DENIED, {
            feature,
            service: 'BuildingAI',
            details: 'Access forbidden'
          });

        case 404:
          return AppError.create(ERROR_CODES.TASK_NOT_FOUND, {
            feature,
            service: 'BuildingAI',
            details: 'Feature not found'
          });

        case 429:
          return AppError.create(ERROR_CODES.RATE_LIMIT_EXCEEDED, {
            feature,
            service: 'BuildingAI',
            details: data?.message || 'Rate limit exceeded',
            retryAfter: error.response.headers['retry-after']
          });

        case 500:
          return AppError.create(ERROR_CODES.EXTERNAL_SERVICE_ERROR, {
            feature,
            service: 'BuildingAI',
            details: 'Internal server error'
          });

        case 502:
          return AppError.create(ERROR_CODES.EXTERNAL_SERVICE_ERROR, {
            feature,
            service: 'BuildingAI',
            details: 'Bad gateway'
          });

        case 503:
          return AppError.create(ERROR_CODES.SERVICE_UNAVAILABLE, {
            feature,
            service: 'BuildingAI',
            details: 'Service unavailable'
          });

        default:
          return AppError.create(ERROR_CODES.EXTERNAL_SERVICE_ERROR, {
            feature,
            service: 'BuildingAI',
            status,
            details: data?.message || `HTTP ${status}`
          });
      }
    } else if (error.request) {
      // 网络错误
      return AppError.create(ERROR_CODES.CONNECTION_FAILED, {
        feature,
        service: 'BuildingAI',
        details: 'Network connection failed'
      });
    } else {
      // 其他错误
      return AppError.fromError(error, ERROR_CODES.EXTERNAL_SERVICE_ERROR, {
        feature,
        service: 'BuildingAI'
      });
    }
  }

  /**
   * 更新统计信息
   * @param {number} responseTime - 响应时间
   * @param {boolean} success - 是否成功
   * @param {Error} error - 错误对象（可选）
   */
  updateStats(responseTime, success, error = null) {
    this.stats.totalRequests++;
    this.stats.lastRequestTime = new Date();

    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;

      // 记录错误类型
      const errorType = error?.response?.status || 'network';
      this.stats.errorsByType[errorType] = (this.stats.errorsByType[errorType] || 0) + 1;
    }

    // 更新响应时间统计
    this.stats.totalResponseTime += responseTime;
    this.stats.averageResponseTime = this.stats.totalResponseTime / this.stats.totalRequests;
  }

  /**
   * 获取支持的特性列表
   * @returns {Array} 特性列表
   */
  getSupportedFeatures() {
    return Object.keys(this.featureMapping);
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      ...this.stats,
      initialized: this.initialized,
      rateLimit: {
        current: this.rateLimit.current,
        limit: this.rateLimit.requests,
        window: this.rateLimit.window / 1000,
        resetTime: new Date(this.rateLimit.resetTime)
      },
      supportedFeatures: this.getSupportedFeatures()
    };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalResponseTime: 0,
      averageResponseTime: 0,
      lastRequestTime: null,
      errorsByType: {}
    };
    logger.info('[BuildingAIAdaptor] Statistics reset');
  }

  /**
   * 关闭服务
   */
  async close() {
    try {
      this.initialized = false;
      logger.info('[BuildingAIAdaptor] BuildingAI adaptor service closed');
    } catch (error) {
      logger.error('[BuildingAIAdaptor] Error closing BuildingAI adaptor service:', error);
    }
  }
}

module.exports = new BuildingAIAdaptorService();