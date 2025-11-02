/**
 * 通用错误处理器
 * 标准化错误响应格式
 */

const logger = require('./logger');

/**
 * SCF 自定义错误类
 */
class SCFError extends Error {
  constructor(message, code = 500) {
    super(message);
    this.name = 'SCFError';
    this.code = code;
  }
}

/**
 * 处理错误并返回标准响应
 * @param {Error} error - 错误对象
 * @param {Object} context - 上下文信息（taskId, stepIndex等）
 * @returns {Object} 标准化错误响应
 */
async function handleError(error, context = {}) {
  // 记录错误日志
  logger.error('SCF执行失败', {
    error: error.message,
    stack: error.stack,
    code: error.code || 500,
    context: context
  });

  // 返回标准错误响应
  return {
    statusCode: error.code || 500,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    })
  };
}

/**
 * 包装异步函数，自动捕获错误
 * @param {Function} handler - 异步处理函数
 * @returns {Function} 包装后的函数
 */
function wrapHandler(handler) {
  return async (event, context) => {
    try {
      return await handler(event, context);
    } catch (error) {
      return await handleError(error, {
        requestId: context.request_id,
        functionName: context.function_name
      });
    }
  };
}

module.exports = {
  SCFError,
  handleError,
  wrapHandler
};
