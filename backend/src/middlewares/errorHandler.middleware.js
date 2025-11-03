const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const { ERROR_CODES } = require('../config/error-codes');
const enhancedErrorHandler = require('./enhanced-error-handler.middleware');

/**
 * 全局错误处理中间件（使用增强版本）
 */
function errorHandler(err, req, res, next) {
  // 使用增强的错误处理器
  return enhancedErrorHandler.handler()(err, req, res, next);
}

/**
 * 404处理中间件（使用AppError）
 */
function notFoundHandler(req, res, next) {
  const error = AppError.create(ERROR_CODES.TASK_NOT_FOUND, {
    method: req.method,
    url: req.url,
    message: `API endpoint not found: ${req.method} ${req.url}`
  });
  next(error);
}

module.exports = {
  errorHandler,
  notFoundHandler
};
