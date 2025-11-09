/**
 * Prometheus指标收集中间件 - TypeScript ESM版本 (P1-014)
 * 艹！记录每个HTTP请求的指标，用于监控API性能
 */

import type { Request, Response, NextFunction } from 'express';
import metricsService from '../services/metrics.service.js';

/**
 * Prometheus指标收集中间件
 * 艹！监控所有HTTP请求的方法、路径、状态码和耗时
 *
 * @example
 * app.use(metricsMiddleware);
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
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

export default metricsMiddleware;
