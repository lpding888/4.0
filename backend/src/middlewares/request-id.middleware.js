const { v4: uuidv4 } = require('uuid');

/**
 * 请求ID中间件
 *
 * 为每个请求生成唯一ID，用于：
 * - 错误追踪
 * - 日志关联
 * - 请求调试
 * - 性能监控
 */
function requestIdMiddleware(req, res, next) {
  // 生成请求ID
  req.id = uuidv4();

  // 在响应头中添加请求ID
  res.setHeader('X-Request-ID', req.id);

  // 在日志中添加请求ID
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  const originalConsoleInfo = console.info;

  // 为控制台输出添加请求ID（仅用于开发调试）
  if (process.env.NODE_ENV === 'development') {
    const logWithRequestId = (originalMethod) => {
      return (...args) => {
        if (req.id) {
          originalMethod(`[${req.id}]`, ...args);
        } else {
          originalMethod(...args);
        }
      };
    };

    console.log = logWithRequestId(originalConsoleLog);
    console.error = logWithRequestId(originalConsoleError);
    console.warn = logWithRequestId(originalConsoleWarn);
    console.info = logWithRequestId(originalConsoleInfo);
  }

  // 清理函数
  res.on('finish', () => {
    if (process.env.NODE_ENV === 'development') {
      // 恢复原始控制台方法
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
      console.info = originalConsoleInfo;
    }
  });

  next();
}

module.exports = requestIdMiddleware;