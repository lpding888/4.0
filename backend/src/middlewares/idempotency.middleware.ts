import type { NextFunction, Request, Response } from 'express';
import { redis } from '../config/redis.js';
import logger from '../utils/logger.js';

type IdempotencyMeta = {
  redisKey: string;
  userId: string;
  category: string;
  key: string;
};

type StoredPayload = {
  body: unknown;
  statusCode?: number;
  createdAt: string;
  version: number;
};

const IDEMP_PREFIX = 'idempotency';

/**
 * 幂等中间件
 * 这个SB中间件干两件事：
 * 1. 在请求进入时，如果Redis里已有结果，直接返回缓存响应
 * 2. 把幂等信息挂到 res.locals，方便控制器在成功后保存结果
 */
export const idempotencyMiddleware =
  (category: string) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const headerKey = (req.header('Idempotency-Key') || req.header('idempotency-key'))?.trim();
      const bodyKey =
        req.body && typeof req.body === 'object'
          ? ((req.body as Record<string, unknown>).idempotencyKey as string | undefined)
          : undefined;
      const key = (headerKey || bodyKey)?.trim();

      if (!userId || !key) {
        return next();
      }

      const redisKey = `${IDEMP_PREFIX}:${category}:${userId}:${key}`;
      const cached = await redis.get(redisKey);

      if (cached) {
        let parsed: StoredPayload | null = null;
        try {
          parsed = JSON.parse(cached) as StoredPayload;
        } catch (err) {
          logger.warn('[Idempotency] 解析缓存失败，忽略幂等缓存', { category, userId, key, err });
        }

        if (parsed && parsed.body !== undefined) {
          logger.info('[Idempotency] 命中幂等缓存', { category, userId, key });
          if (parsed.statusCode && typeof parsed.statusCode === 'number') {
            res.status(parsed.statusCode);
          }
          return res.json(parsed.body);
        }
      }

      const meta: IdempotencyMeta = { redisKey, userId, category, key };
      res.locals.idempotency = meta;

      return next();
    } catch (error) {
      logger.error('[Idempotency] 检查失败，继续执行原始请求', error);
      return next();
    }
  };

/**
 * 保存幂等响应结果
 * 这个SB函数尽量别阻塞主流程，失败了就打个日志
 */
export async function saveIdempotencyResponse(
  res: Response,
  body: unknown,
  ttlSeconds = 60 * 60 * 24
): Promise<void> {
  try {
    const meta = res.locals.idempotency as IdempotencyMeta | undefined;
    if (!meta) return;

    const payload: StoredPayload = {
      body,
      statusCode: res.statusCode,
      createdAt: new Date().toISOString(),
      version: 1
    };

    await redis.set(meta.redisKey, JSON.stringify(payload), 'EX', ttlSeconds);
    logger.info('[Idempotency] 幂等结果已保存', {
      category: meta.category,
      userId: meta.userId,
      key: meta.key
    });
  } catch (error) {
    logger.error('[Idempotency] 保存幂等结果失败', error);
  }
}

