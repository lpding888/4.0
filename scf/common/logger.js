/**
 * 通用日志工具 - 自动脱敏处理
 * 严格禁止打印敏感信息到日志
 */

const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

/**
 * 脱敏处理 - 移除敏感字段
 * @param {Object} data - 原始数据
 * @returns {Object} 脱敏后的数据
 */
function sanitize(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sanitized = { ...data };

  // 敏感字段列表（全部移除）
  const sensitiveFields = [
    'credentials',
    'secret',
    'password',
    'secretKey',
    'secretId',
    'INTERNAL_CALLBACK_SECRET',
    'TENCENT_SECRET_ID',
    'TENCENT_SECRET_KEY',
    'apiKey',
    'token',
    'authorization'
  ];

  // 递归移除敏感字段
  for (const key in sanitized) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitize(sanitized[key]);
    }
  }

  return sanitized;
}

module.exports = {
  info: (message, data = {}) => {
    logger.info(message, sanitize(data));
  },

  error: (message, data = {}) => {
    logger.error(message, sanitize(data));
  },

  warn: (message, data = {}) => {
    logger.warn(message, sanitize(data));
  },

  debug: (message, data = {}) => {
    logger.debug(message, sanitize(data));
  }
};
