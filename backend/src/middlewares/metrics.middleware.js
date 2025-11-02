const metricsService = require('../services/metrics.service');

/**
 * Prometheus指标收集中间件 (P1-014)
 * 艹！记录每个HTTP请求的指标
 */
function metricsMiddleware(req, res, next) {
  const start = Date.now();

  // 监听响应完成事件
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000; // 转换为秒
    const path = req.route ? req.route.path : req.path; // 使用路由路径而不是实际请求路径（避免路径爆炸）
    const method = req.method;
    const statusCode = res.statusCode;

    // 记录HTTP请求指标
    metricsService.recordHttpRequest(method, path, statusCode, duration);
  });

  next();
}

module.exports = metricsMiddleware;
