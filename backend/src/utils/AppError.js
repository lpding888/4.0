const { ERROR_CODES, ERROR_METADATA } = require('../config/error-codes');
const { DEFAULT_LANGUAGE } = require('../config/i18n-messages');

/**
 * 应用程序自定义错误类
 *
 * 提供统一的错误处理机制，支持：
 * - 错误码和国际化消息
 * - 错误元数据（分类、严重程度）
 * - 详细的错误信息和上下文
 * - 堆栈跟踪和调试信息
 */
class AppError extends Error {
  /**
   * 构造函数
   * @param {number} code - 错误码
   * @param {string} [customMessage] - 自定义错误消息（可选）
   * @param {Object} [context] - 错误上下文信息
   * @param {Object} [options] - 额外选项
   */
  constructor(code, customMessage = null, context = {}, options = {}) {
    // 使用自定义消息或默认消息
    const message = customMessage || this.getDefaultMessage(code);

    super(message);

    // 确保错误名称正确
    this.name = this.constructor.name;

    // 错误码
    this.code = code;

    // 错误元数据
    this.metadata = ERROR_METADATA[code] || {
      category: 'unknown',
      severity: 'medium'
    };

    // 错误上下文
    this.context = context;

    // 时间戳
    this.timestamp = new Date().toISOString();

    // 请求ID（用于追踪）
    this.requestId = context.requestId || null;

    // 用户ID（如果相关）
    this.userId = context.userId || null;

    // 额外选项
    this.options = {
      isOperational: true, // 是否为可预期的业务错误
      shouldLog: true,     // 是否应该记录日志
      shouldNotify: false, // 是否应该发送通知
      ...options
    };

    // HTTP状态码映射
    this.statusCode = this.getStatusCode(code);

    // 是否应该暴露给客户端
    this.exposeToClient = this.shouldExposeToClient(code);

    // 错误堆栈
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * 获取默认错误消息
   * @param {number} code - 错误码
   * @param {string} [language] - 语言代码
   * @returns {string} 错误消息
   */
  getDefaultMessage(code, language = DEFAULT_LANGUAGE) {
    const { SUPPORTED_LANGUAGES } = require('../config/i18n-messages');
    const langConfig = SUPPORTED_LANGUAGES[language] || SUPPORTED_LANGUAGES[DEFAULT_LANGUAGE];
    return langConfig.messages[code] || '未知错误';
  }

  /**
   * 获取本地化错误消息
   * @param {string} language - 语言代码
   * @returns {string} 本地化错误消息
   */
  getLocalizedMessage(language) {
    return this.getDefaultMessage(this.code, language);
  }

  /**
   * 获取HTTP状态码
   * @param {number} code - 错误码
   * @returns {number} HTTP状态码
   */
  getStatusCode(code) {
    // 根据错误码范围映射HTTP状态码
    if (code === 0) return 200;

    // 1xxx 通用错误
    if (code >= 1000 && code < 1999) {
      switch (code) {
        case 1001: return 400; // INVALID_REQUEST
        case 1002: return 400; // MISSING_PARAMETERS
        case 1003: return 400; // INVALID_PARAMETERS
        case 1004: return 429; // RATE_LIMIT_EXCEEDED
        case 1500: return 500; // INTERNAL_SERVER_ERROR
        case 1501: return 500; // DATABASE_ERROR
        case 1502: return 500; // CACHE_ERROR
        case 1503: return 500; // QUEUE_ERROR
        case 1504: return 502; // EXTERNAL_SERVICE_ERROR
        default: return 500;
      }
    }

    // 2xxx 认证错误
    if (code >= 2000 && code < 2999) {
      switch (code) {
        case 2000: return 401; // UNAUTHORIZED
        case 2001: return 401; // INVALID_TOKEN
        case 2002: return 401; // TOKEN_EXPIRED
        case 2003: return 401; // TOKEN_BLACKLISTED
        case 2004: return 401; // INVALID_CREDENTIALS
        case 2005: return 423; // ACCOUNT_LOCKED
        case 2006: return 403; // ACCOUNT_DISABLED
        case 2007: return 404; // ACCOUNT_NOT_FOUND
        case 2008: return 401; // PASSWORD_INCORRECT
        case 2009: return 401; // LOGIN_REQUIRED
        case 2100: return 429; // LOGIN_ATTEMPTS_EXCEEDED
        case 2101: return 400; // LOGIN_METHOD_NOT_SUPPORTED
        case 2102: return 400; // LOGIN_METHOD_NOT_BOUND
        case 2103: return 400; // VERIFICATION_CODE_INVALID
        case 2104: return 400; // VERIFICATION_CODE_EXPIRED
        case 2105: return 429; // VERIFICATION_SEND_LIMIT
        case 2106: return 409; // EMAIL_ALREADY_EXISTS
        case 2107: return 409; // PHONE_ALREADY_EXISTS
        case 2108: return 400; // SOCIAL_LOGIN_FAILED
        case 2200: return 403; // PERMISSION_DENIED
        case 2201: return 403; // INSUFFICIENT_PERMISSIONS
        case 2202: return 404; // ROLE_NOT_FOUND
        case 2203: return 500; // ROLE_ASSIGNMENT_FAILED
        case 2204: return 403; // RESOURCE_ACCESS_DENIED
        case 2205: return 403; // ADMIN_REQUIRED
        default: return 401;
      }
    }

    // 3xxx 用户错误
    if (code >= 3000 && code < 3999) {
      switch (code) {
        case 3000: return 404; // USER_NOT_FOUND
        case 3001: return 409; // USER_ALREADY_EXISTS
        case 3002: return 400; // USER_PROFILE_INCOMPLETE
        case 3003: return 403; // USER_QUOTA_EXCEEDED
        case 3004: return 403; // USER_MEMBERSHIP_EXPIRED
        case 3005: return 403; // USER_SUBSCRIPTION_INACTIVE
        case 3006: return 400; // INVITE_CODE_INVALID
        case 3007: return 409; // INVITE_CODE_USED
        case 3008: return 400; // INVITE_CODE_EXPIRED
        case 3009: return 400; // REFERRAL_CODE_INVALID
        case 3010: return 404; // REFERRAL_NOT_FOUND
        default: return 400;
      }
    }

    // 4xxx 任务错误
    if (code >= 4000 && code < 4999) {
      switch (code) {
        case 4000: return 404; // TASK_NOT_FOUND
        case 4001: return 500; // TASK_CREATION_FAILED
        case 4002: return 500; // TASK_PROCESSING_FAILED
        case 4003: return 408; // TASK_TIMEOUT
        case 4004: return 400; // TASK_CANCELLED
        case 4005: return 403; // TASK_QUOTA_EXCEEDED
        case 4006: return 400; // TASK_INVALID_PARAMETERS
        case 4007: return 503; // TASK_PROCESSOR_UNAVAILABLE
        case 4008: return 500; // TASK_DEPENDENCY_FAILED
        case 4009: return 410; // TASK_RESULT_EXPIRED
        case 4100: return 404; // FILE_NOT_FOUND
        case 4101: return 413; // FILE_TOO_LARGE
        case 4102: return 415; // FILE_TYPE_NOT_SUPPORTED
        case 4103: return 500; // FILE_UPLOAD_FAILED
        case 4104: return 500; // FILE_PROCESSING_FAILED
        case 4105: return 500; // FILE_DOWNLOAD_FAILED
        case 4106: return 400; // FILE_CORRUPTED
        case 4107: return 403; // STORAGE_QUOTA_EXCEEDED
        case 4200: return 500; // AI_PROCESSING_FAILED
        case 4201: return 503; // AI_SERVICE_UNAVAILABLE
        case 4202: return 403; // AI_QUOTA_EXCEEDED
        case 4203: return 400; // AI_CONTENT_POLICY_VIOLATION
        case 4204: return 408; // AI_PROCESSING_TIMEOUT
        case 4205: return 400; // AI_INVALID_INPUT_FORMAT
        default: return 500;
      }
    }

    // 5xxx 支付错误
    if (code >= 5000 && code < 5999) {
      switch (code) {
        case 5000: return 402; // PAYMENT_REQUIRED
        case 5001: return 400; // PAYMENT_FAILED
        case 5002: return 400; // PAYMENT_CANCELLED
        case 5003: return 408; // PAYMENT_TIMEOUT
        case 5004: return 400; // PAYMENT_METHOD_NOT_SUPPORTED
        case 5005: return 404; // ORDER_NOT_FOUND
        case 5006: return 410; // ORDER_EXPIRED
        case 5007: return 409; // ORDER_ALREADY_PAID
        case 5008: return 500; // REFUND_FAILED
        case 5009: return 400; // REFUND_AMOUNT_INVALID
        case 5010: return 502; // PAYMENT_GATEWAY_ERROR
        case 5011: return 402; // INSUFFICIENT_BALANCE
        case 5012: return 400; // PAYMENT_VERIFICATION_FAILED
        default: return 400;
      }
    }

    // 6xxx 分销错误
    if (code >= 6000 && code < 6999) {
      switch (code) {
        case 6000: return 404; // DISTRIBUTOR_NOT_FOUND
        case 6001: return 403; // DISTRIBUTION_NOT_ACTIVE
        case 6002: return 500; // COMMISSION_CALCULATION_FAILED
        case 6003: return 500; // WITHDRAWAL_FAILED
        case 6004: return 400; // WITHDRAWAL_AMOUNT_INVALID
        case 6005: return 403; // WITHDRAWAL_LIMIT_EXCEEDED
        case 6006: return 404; // DISTRIBUTION_RULE_NOT_FOUND
        case 6007: return 500; // COMMISSION_FREEZE_FAILED
        case 6008: return 500; // COMMISSION_UNFREEZE_FAILED
        default: return 400;
      }
    }

    // 7xxx 系统错误
    if (code >= 7000 && code < 7999) {
      switch (code) {
        case 7000: return 404; // CONFIG_NOT_FOUND
        case 7001: return 500; // CONFIG_VALIDATION_FAILED
        case 7002: return 403; // FEATURE_NOT_ENABLED
        case 7003: return 403; // FEATURE_NOT_AVAILABLE
        case 7004: return 503; // SYSTEM_MAINTENANCE
        case 7005: return 503; // SERVICE_UNAVAILABLE
        case 7006: return 500; // RATE_LIMIT_CONFIG_INVALID
        case 7007: return 500; // CACHE_VERSION_CONFLICT
        case 7008: return 500; // DATABASE_MIGRATION_FAILED
        case 7009: return 500; // ENVIRONMENT_VARIABLE_MISSING
        default: return 500;
      }
    }

    // 8xxx 网络错误
    if (code >= 8000 && code < 8999) {
      switch (code) {
        case 8000: return 502; // CONNECTION_FAILED
        case 8001: return 408; // REQUEST_TIMEOUT
        case 8002: return 502; // DNS_RESOLUTION_FAILED
        case 8003: return 502; // SSL_VERIFICATION_FAILED
        case 8004: return 502; // PROXY_ERROR
        case 8005: return 429; // BANDWIDTH_LIMIT_EXCEEDED
        case 8006: return 500; // WEBSOCKET_CONNECTION_FAILED
        case 8007: return 500; // NOTIFICATION_SEND_FAILED
        default: return 502;
      }
    }

    // 9xxx 验证错误
    if (code >= 9000 && code < 9999) {
      return 400; // 大部分验证错误都是400
    }

    // 默认返回500
    return 500;
  }

  /**
   * 判断是否应该暴露给客户端
   * @param {number} code - 错误码
   * @returns {boolean}
   */
  shouldExposeToClient(code) {
    // 系统级错误不应该暴露详细信息
    const systemErrors = [1500, 1501, 1502, 1503, 1504, 4001, 4002, 4007, 4008, 5008, 5010, 6002, 6003, 6007, 6008, 7001, 7006, 7007, 7008, 7009, 8000, 8001, 8002, 8003, 8004, 8006, 8007];
    return !systemErrors.includes(code);
  }

  /**
   * 转换为JSON响应格式
   * @param {string} [language] - 语言代码
   * @returns {Object} 响应对象
   */
  toJSON(language = DEFAULT_LANGUAGE) {
    const response = {
      success: false,
      error: {
        code: this.code,
        message: this.getLocalizedMessage(language),
        timestamp: this.timestamp
      },
      metadata: {
        category: this.metadata.category,
        severity: this.metadata.severity
      }
    };

    // 添加请求ID（如果有）
    if (this.requestId) {
      response.requestId = this.requestId;
    }

    // 在开发环境中添加调试信息
    if (process.env.NODE_ENV === 'development') {
      response.debug = {
        context: this.context,
        stack: this.stack,
        statusCode: this.statusCode
      };
    }

    return response;
  }

  /**
   * 转换为日志格式
   * @returns {Object} 日志对象
   */
  toLogFormat() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      category: this.metadata.category,
      severity: this.metadata.severity,
      context: this.context,
      requestId: this.requestId,
      userId: this.userId,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }

  /**
   * 静态方法：创建已知错误
   * @param {number} code - 错误码
   * @param {Object} [context] - 错误上下文
   * @param {Object} [options] - 额外选项
   * @returns {AppError} 应用错误实例
   */
  static create(code, context = {}, options = {}) {
    return new AppError(code, null, context, options);
  }

  /**
   * 静态方法：创建自定义错误
   * @param {number} code - 错误码
   * @param {string} message - 自定义消息
   * @param {Object} [context] - 错误上下文
   * @param {Object} [options] - 额外选项
   * @returns {AppError} 应用错误实例
   */
  static custom(code, message, context = {}, options = {}) {
    return new AppError(code, message, context, options);
  }

  /**
   * 静态方法：从现有错误创建AppError
   * @param {Error} error - 原始错误
   * @param {number} [fallbackCode] - 回退错误码
   * @param {Object} [context] - 错误上下文
   * @returns {AppError} 应用错误实例
   */
  static fromError(error, fallbackCode = ERROR_CODES.UNKNOWN_ERROR, context = {}) {
    if (error instanceof AppError) {
      return error;
    }

    const message = error.message || '未知错误';
    const enhancedContext = {
      originalError: error.name,
      originalMessage: error.message,
      ...context
    };

    return new AppError(fallbackCode, message, enhancedContext, {
      shouldLog: true,
      isOperational: false
    });
  }

  /**
   * 静态方法：验证是否为AppError实例
   * @param {Error} error - 错误对象
   * @returns {boolean}
   */
  static isAppError(error) {
    return error instanceof AppError;
  }
}

module.exports = AppError;