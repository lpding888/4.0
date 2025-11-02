const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const { ERROR_CODES } = require('../config/error-codes');
const { DEFAULT_LANGUAGE } = require('../config/i18n-messages');

/**
 * 增强的错误处理中间件
 *
 * 提供统一的错误处理机制：
 * - AppError统一处理
 * - 国际化错误消息
 * - 详细的错误日志
 * - 安全的错误响应
 * - 错误统计和监控
 */
class EnhancedErrorHandler {
  constructor() {
    this.errorStats = new Map(); // 错误统计
    this.criticalErrors = new Set(); // 严重错误记录
    this.lastCleanup = Date.now();
  }

  /**
   * 处理错误的中间件
   * @returns {Function} Express错误处理中间件
   */
  handler() {
    return (error, req, res, next) => {
      try {
        // 记录错误开始时间
        const startTime = Date.now();

        // 将普通错误转换为AppError
        const appError = AppError.fromError(error, ERROR_CODES.UNKNOWN_ERROR, {
          requestId: req.id,
          userId: req.user?.id,
          method: req.method,
          url: req.url,
          userAgent: req.get('User-Agent'),
          ip: req.ip || req.connection.remoteAddress
        });

        // 设置请求ID到错误对象
        appError.requestId = req.id;

        // 获取客户端语言
        const language = this.getClientLanguage(req);

        // 统计错误
        this.recordError(appError);

        // 记录错误日志
        this.logError(appError, req);

        // 检查是否需要发送通知
        if (appError.options.shouldNotify) {
          this.sendErrorNotification(appError, req);
        }

        // 清理旧的统计数据
        this.cleanupOldStats();

        // 构建响应
        const response = this.buildErrorResponse(appError, language, req);

        // 记录响应时间
        const responseTime = Date.now() - startTime;
        logger.debug(`[ErrorHandler] Error processed in ${responseTime}ms`);

        // 发送响应
        res.status(appError.statusCode).json(response);

      } catch (handlingError) {
        // 如果错误处理失败，记录并发送基础响应
        logger.error('[ErrorHandler] Error in error handler:', handlingError);

        res.status(500).json({
          success: false,
          error: {
            code: ERROR_CODES.INTERNAL_SERVER_ERROR,
            message: 'Internal server error',
            timestamp: new Date().toISOString()
          }
        });
      }
    };
  }

  /**
   * 获取客户端语言
   * @param {Object} req - Express请求对象
   * @returns {string} 语言代码
   */
  getClientLanguage(req) {
    // 优先级：请求中的i18n对象 > Accept-Language > 默认语言
    if (req.i18n && req.i18n.locale) {
      return req.i18n.locale;
    }

    // 从Accept-Language头解析
    const acceptLanguage = req.headers['accept-language'];
    if (acceptLanguage) {
      const supportedLanguages = ['zh-CN', 'en-US', 'ja-JP'];
      const preferred = acceptLanguage
        .split(',')
        .map(lang => lang.split(';')[0].trim().toLowerCase())
        .find(lang => supportedLanguages.includes(lang));

      if (preferred) {
        return preferred;
      }
    }

    return DEFAULT_LANGUAGE;
  }

  /**
   * 记录错误统计
   * @param {AppError} appError - 应用错误
   */
  recordError(appError) {
    const key = `${appError.code}:${appError.metadata.category}`;

    if (!this.errorStats.has(key)) {
      this.errorStats.set(key, {
        code: appError.code,
        category: appError.metadata.category,
        severity: appError.metadata.severity,
        count: 0,
        firstOccurrence: Date.now(),
        lastOccurrence: Date.now(),
        sampleMessages: [] // 保存最近几条错误消息
      });
    }

    const stats = this.errorStats.get(key);
    stats.count++;
    stats.lastOccurrence = Date.now();

    // 保存示例消息（最多5条）
    if (stats.sampleMessages.length < 5) {
      stats.sampleMessages.push({
        message: appError.message,
        timestamp: appError.timestamp,
        context: appError.context
      });
    } else {
      // 替换最旧的消息
      stats.sampleMessages.shift();
      stats.sampleMessages.push({
        message: appError.message,
        timestamp: appError.timestamp,
        context: appError.context
      });
    }

    // 记录严重错误
    if (appError.metadata.severity === 'critical') {
      this.criticalErrors.add(key);
    }
  }

  /**
   * 记录错误日志
   * @param {AppError} appError - 应用错误
   * @param {Object} req - Express请求对象
   */
  logError(appError, req) {
    const logData = appError.toLogFormat();
    logData.request = {
      method: req.method,
      url: req.url,
      headers: this.sanitizeHeaders(req.headers),
      query: req.query,
      body: this.sanitizeBody(req.body)
    };

    // 根据严重程度选择日志级别
    switch (appError.metadata.severity) {
      case 'critical':
        logger.error('[CRITICAL]', logData);
        break;
      case 'high':
        logger.error('[HIGH]', logData);
        break;
      case 'medium':
        logger.warn('[MEDIUM]', logData);
        break;
      case 'low':
        logger.info('[LOW]', logData);
        break;
      default:
        logger.error('[UNKNOWN]', logData);
    }
  }

  /**
   * 清理请求头中的敏感信息
   * @param {Object} headers - 请求头
   * @returns {Object} 清理后的请求头
   */
  sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];

    for (const header of sensitiveHeaders) {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * 清理请求体中的敏感信息
   * @param {Object} body - 请求体
   * @returns {Object} 清理后的请求体
   */
  sanitizeBody(body) {
    if (!body) return body;

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'creditCard'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * 发送错误通知
   * @param {AppError} appError - 应用错误
   * @param {Object} req - Express请求对象
   */
  async sendErrorNotification(appError, req) {
    try {
      // 这里可以集成各种通知方式
      // 例如：邮件、Slack、钉钉、企业微信等

      const notification = {
        type: 'error',
        severity: appError.metadata.severity,
        code: appError.code,
        message: appError.message,
        requestId: req.id,
        userId: req.user?.id,
        url: req.url,
        method: req.method,
        timestamp: appError.timestamp,
        context: appError.context
      };

      // 根据严重程度选择通知渠道
      if (appError.metadata.severity === 'critical') {
        // 发送紧急通知
        await this.sendCriticalNotification(notification);
      } else if (appError.metadata.severity === 'high') {
        // 发送普通通知
        await this.sendHighSeverityNotification(notification);
      }

      logger.info(`[ErrorHandler] Error notification sent for code ${appError.code}`);
    } catch (notificationError) {
      logger.error('[ErrorHandler] Failed to send error notification:', notificationError);
    }
  }

  /**
   * 发送严重错误通知
   * @param {Object} notification - 通知对象
   */
  async sendCriticalNotification(notification) {
    // 实现严重错误通知逻辑
    // 可以发送邮件、短信、Slack等
    logger.error('[CRITICAL_NOTIFICATION]', notification);
  }

  /**
   * 发送高严重性错误通知
   * @param {Object} notification - 通知对象
   */
  async sendHighSeverityNotification(notification) {
    // 实现高严重性错误通知逻辑
    logger.warn('[HIGH_SEVERITY_NOTIFICATION]', notification);
  }

  /**
   * 构建错误响应
   * @param {AppError} appError - 应用错误
   * @param {string} language - 语言代码
   * @param {Object} req - Express请求对象
   * @returns {Object} 错误响应对象
   */
  buildErrorResponse(appError, language, req) {
    const baseResponse = {
      success: false,
      error: {
        code: appError.code,
        message: appError.getLocalizedMessage(language),
        timestamp: appError.timestamp
      },
      metadata: {
        category: appError.metadata.category,
        severity: appError.metadata.severity
      }
    };

    // 添加请求ID
    if (appError.requestId) {
      baseResponse.requestId = appError.requestId;
    }

    // 在开发环境中添加调试信息
    if (process.env.NODE_ENV === 'development') {
      baseResponse.debug = {
        context: appError.context,
        stack: appError.stack,
        statusCode: appError.statusCode,
        originalError: appError.context.originalError
      };
    }

    // 添加恢复建议（如果有的话）
    const suggestion = this.getErrorSuggestion(appError.code, language);
    if (suggestion) {
      baseResponse.suggestion = suggestion;
    }

    // 添加重试信息
    if (this.shouldRetry(appError)) {
      baseResponse.retry = {
        retryable: true,
        after: this.getRetryDelay(appError),
        maxAttempts: this.getMaxRetryAttempts(appError)
      };
    }

    return baseResponse;
  }

  /**
   * 获取错误建议
   * @param {number} code - 错误码
   * @param {string} language - 语言代码
   * @returns {string|null} 错误建议
   */
  getErrorSuggestion(code, language) {
    const suggestions = {
      'zh-CN': {
        [ERROR_CODES.RATE_LIMIT_EXCEEDED]: '请求过于频繁，请稍后重试',
        [ERROR_CODES.TOKEN_EXPIRED]: '登录已过期，请重新登录',
        [ERROR_CODES.PAYMENT_REQUIRED]: '请完成付费后再试',
        [ERROR_CODES.FILE_TOO_LARGE]: '请选择较小的文件上传',
        [ERROR_CODES.FILE_TYPE_NOT_SUPPORTED]: '请选择支持的文件格式'
      },
      'en-US': {
        [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Too many requests, please try again later',
        [ERROR_CODES.TOKEN_EXPIRED]: 'Login expired, please log in again',
        [ERROR_CODES.PAYMENT_REQUIRED]: 'Please complete payment before trying again',
        [ERROR_CODES.FILE_TOO_LARGE]: 'Please select a smaller file to upload',
        [ERROR_CODES.FILE_TYPE_NOT_SUPPORTED]: 'Please select a supported file format'
      }
    };

    return suggestions[language]?.[code] || null;
  }

  /**
   * 判断是否应该重试
   * @param {AppError} appError - 应用错误
   * @returns {boolean}
   */
  shouldRetry(appError) {
    // 可以重试的错误类型
    const retryableErrors = [
      ERROR_CODES.RATE_LIMIT_EXCEEDED,
      ERROR_CODES.REQUEST_TIMEOUT,
      ERROR_CODES.CONNECTION_FAILED,
      ERROR_CODES.EXTERNAL_SERVICE_ERROR,
      ERROR_CODES.DATABASE_ERROR,
      ERROR_CODES.CACHE_ERROR,
      ERROR_CODES.QUEUE_ERROR
    ];

    return retryableErrors.includes(appError.code) &&
           appError.metadata.category !== 'validation';
  }

  /**
   * 获取重试延迟
   * @param {AppError} appError - 应用错误
   * @returns {number} 延迟时间（毫秒）
   */
  getRetryDelay(appError) {
    switch (appError.code) {
      case ERROR_CODES.RATE_LIMIT_EXCEEDED:
        return 60000; // 1分钟
      case ERROR_CODES.REQUEST_TIMEOUT:
        return 5000; // 5秒
      case ERROR_CODES.CONNECTION_FAILED:
        return 10000; // 10秒
      default:
        return 3000; // 3秒
    }
  }

  /**
   * 获取最大重试次数
   * @param {AppError} appError - 应用错误
   * @returns {number} 最大重试次数
   */
  getMaxRetryAttempts(appError) {
    switch (appError.code) {
      case ERROR_CODES.RATE_LIMIT_EXCEEDED:
        return 3;
      case ERROR_CODES.REQUEST_TIMEOUT:
        return 5;
      case ERROR_CODES.CONNECTION_FAILED:
        return 3;
      default:
        return 2;
    }
  }

  /**
   * 清理旧的统计数据
   */
  cleanupOldStats() {
    const now = Date.now();
    const cleanupInterval = 24 * 60 * 60 * 1000; // 24小时

    if (now - this.lastCleanup > cleanupInterval) {
      const cutoffTime = now - (7 * 24 * 60 * 60 * 1000); // 7天前

      for (const [key, stats] of this.errorStats.entries()) {
        if (stats.lastOccurrence < cutoffTime) {
          this.errorStats.delete(key);
        }
      }

      // 清理严重错误记录
      for (const errorKey of this.criticalErrors) {
        if (!this.errorStats.has(errorKey)) {
          this.criticalErrors.delete(errorKey);
        }
      }

      this.lastCleanup = now;
      logger.debug('[ErrorHandler] Cleaned up old error statistics');
    }
  }

  /**
   * 获取错误统计信息
   * @returns {Object} 统计信息
   */
  getErrorStats() {
    const stats = {
      totalErrors: 0,
      byCategory: {},
      bySeverity: {},
      criticalErrors: this.criticalErrors.size,
      topErrors: []
    };

    for (const [key, errorStats] of this.errorStats.entries()) {
      stats.totalErrors += errorStats.count;

      // 按分类统计
      if (!stats.byCategory[errorStats.category]) {
        stats.byCategory[errorStats.category] = 0;
      }
      stats.byCategory[errorStats.category] += errorStats.count;

      // 按严重程度统计
      if (!stats.bySeverity[errorStats.severity]) {
        stats.bySeverity[errorStats.severity] = 0;
      }
      stats.bySeverity[errorStats.severity] += errorStats.count;
    }

    // 获取最频繁的错误（前10个）
    stats.topErrors = Array.from(this.errorStats.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([key, errorStats]) => ({
        code: errorStats.code,
        category: errorStats.category,
        severity: errorStats.severity,
        count: errorStats.count,
        lastOccurrence: errorStats.lastOccurrence
      }));

    return stats;
  }

  /**
   * 重置统计数据
   */
  resetStats() {
    this.errorStats.clear();
    this.criticalErrors.clear();
    this.lastCleanup = Date.now();
    logger.info('[ErrorHandler] Error statistics reset');
  }
}

module.exports = new EnhancedErrorHandler();