import { Redis as RedisClient, type RedisOptions } from 'ioredis';
import logger from '../utils/logger.js';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  current: number;
}

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const isTestEnvironment = process.env.NODE_ENV === 'test';

export const redisConfig: RedisOptions = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseNumber(process.env.REDIS_PORT, 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseNumber(process.env.REDIS_DB, 0),
  retryStrategy: (times): number => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: isTestEnvironment
};

export const redis = new RedisClient(redisConfig as RedisOptions);

export const createRedisClient = (overrides: Partial<RedisOptions> = {}): RedisClient =>
  new RedisClient({
    ...redisConfig,
    ...overrides
  } as RedisOptions);

redis.on('connect', () => {
  logger.info('[Redis] 连接成功');
});

redis.on('ready', () => {
  logger.info('[Redis] 准备就绪');
});

redis.on('error', (err) => {
  logger.error(`[Redis] 连接错误: ${err.message}`);
});

redis.on('close', () => {
  logger.warn('[Redis] 连接关闭');
});

redis.on('reconnecting', () => {
  logger.info('[Redis] 正在重连...');
});

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  try {
    const multi = redis.multi();
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    multi.zremrangebyscore(key, 0, windowStart);
    multi.zadd(key, now, `${now}`);
    multi.zcard(key);
    multi.expire(key, windowSeconds);

    const results = (await multi.exec()) ?? [];
    const count = Number(results[2]?.[1] ?? 0);

    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);
    const resetAt = now + windowSeconds * 1000;

    return {
      allowed,
      remaining,
      resetAt,
      current: count
    };
  } catch (error) {
    logger.error(`[Redis] 限流检查失败: ${(error as Error).message}`);
    return {
      allowed: true,
      remaining: limit,
      resetAt: Date.now() + windowSeconds * 1000,
      current: 0
    };
  }
}

export async function closeRedis(): Promise<void> {
  try {
    await redis.quit();
    logger.info('[Redis] 连接已关闭');
  } catch (error) {
    logger.error(`[Redis] 关闭连接失败: ${(error as Error).message}`);
  }
}
