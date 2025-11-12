import type { NextFunction, Request, Response } from 'express';
import logger from '../utils/logger.js';

type RequestWithId = Request & { id?: string };

const DEFAULT_SLOW_THRESHOLD = Number.parseInt(
  process.env.HTTP_SLOW_THRESHOLD_MS ?? '1000',
  10
);

/**
 * HTTP请求日志中间件
 * 结合 requestIdMiddleware，把每个请求的耗时和状态写进结构化日志。
 */
export function requestLoggerMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level =
      res.statusCode >= 500
        ? 'error'
        : res.statusCode >= 400 || duration >= DEFAULT_SLOW_THRESHOLD
          ? 'warn'
          : 'info';

    const message =
      level === 'warn' && duration >= DEFAULT_SLOW_THRESHOLD
        ? '[HTTP] 慢请求'
        : '[HTTP] 请求完成';

    (logger[level] ?? logger.info).call(logger, message, {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: duration,
      userAgent: req.headers['user-agent']
    });
  });

  next();
}

export default requestLoggerMiddleware;
