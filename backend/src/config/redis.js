const Redis = require('ioredis');
const logger = require('../utils/logger');

/**
 * Redis配置和连接管理
 * 用于限流、缓存、Bull队列等场景
 */

// Redis配置
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
};

// 创建Redis客户端
const redis = new Redis(redisConfig);

// 连接事件监听
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

/**
 * 限流检查
 * @param {string} key - 限流键
 * @param {number} limit - 限制次数
 * @param {number} windowSeconds - 时间窗口(秒)
 * @returns {Promise<{allowed: boolean, remaining: number, resetAt: number}>}
 */
async function checkRateLimit(key, limit, windowSeconds) {
  try {
    const multi = redis.multi();
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    // 移除过期的记录
    multi.zremrangebyscore(key, 0, windowStart);
    // 添加当前请求
    multi.zadd(key, now, `${now}`);
    // 统计窗口内的请求数
    multi.zcard(key);
    // 设置过期时间
    multi.expire(key, windowSeconds);

    const results = await multi.exec();
    const count = results[2][1]; // zcard结果

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
    logger.error(`[Redis] 限流检查失败: ${error.message}`);
    // 限流检查失败时允许通过,避免影响正常业务
    return {
      allowed: true,
      remaining: limit,
      resetAt: Date.now() + windowSeconds * 1000,
      current: 0
    };
  }
}

/**
 * 设置缓存
 * @param {string} key - 缓存键
 * @param {any} value - 缓存值
 * @param {number} ttl - 过期时间(秒)
 */
async function setCache(key, value, ttl = 60) {
  try {
    const serialized = JSON.stringify(value);
    if (ttl > 0) {
      await redis.setex(key, ttl, serialized);
    } else {
      await redis.set(key, serialized);
    }
    return true;
  } catch (error) {
    logger.error(`[Redis] 设置缓存失败: ${error.message}`, { key });
    return false;
  }
}

/**
 * 获取缓存
 * @param {string} key - 缓存键
 * @returns {Promise<any>}
 */
async function getCache(key) {
  try {
    const cached = await redis.get(key);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch (error) {
    logger.error(`[Redis] 获取缓存失败: ${error.message}`, { key });
    return null;
  }
}

/**
 * 删除缓存
 * @param {string} key - 缓存键
 */
async function delCache(key) {
  try {
    await redis.del(key);
    return true;
  } catch (error) {
    logger.error(`[Redis] 删除缓存失败: ${error.message}`, { key });
    return false;
  }
}

/**
 * 批量删除缓存(支持通配符)
 * @param {string} pattern - 缓存键模式(例如: user:*)
 */
async function delCachePattern(pattern) {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    return keys.length;
  } catch (error) {
    logger.error(`[Redis] 批量删除缓存失败: ${error.message}`, { pattern });
    return 0;
  }
}

/**
 * 优雅关闭Redis连接
 */
async function closeRedis() {
  try {
    await redis.quit();
    logger.info('[Redis] 连接已关闭');
  } catch (error) {
    logger.error(`[Redis] 关闭连接失败: ${error.message}`);
  }
}

module.exports = {
  redis,
  redisConfig,
  checkRateLimit,
  setCache,
  getCache,
  delCache,
  delCachePattern,
  closeRedis
};
