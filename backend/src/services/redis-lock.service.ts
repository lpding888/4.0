/**
 * Redis分布式锁服务 - TypeScript ESM版本
 * 艹！使用SET NX EX实现分布式锁,防止并发问题（P0-004核心功能）
 *
 * 核心用途：
 * 1. 防止配额并发超卖（多实例部署场景）
 * 2. 保证跨服务器的原子操作
 * 3. 使用Lua脚本确保释放锁的原子性
 */

import crypto from 'crypto';
import { redis } from '../config/redis.js';
import logger from '../utils/logger.js';

interface LockOptions {
  ttl?: number; // 锁的过期时间(秒),默认10秒
  retry?: number; // 重试次数,默认3次
  retryDelay?: number; // 重试延迟(毫秒),默认100ms
}

class RedisLockService {
  /**
   * 获取分布式锁
   * 艹！使用SET NX EX原子操作，防止死锁
   */
  async acquire(key: string, ttl = 10, retry = 3, retryDelay = 100): Promise<string | null> {
    const lockKey = `lock:${key}`;
    const lockValue = crypto.randomBytes(16).toString('hex'); // 唯一标识

    for (let i = 0; i <= retry; i++) {
      try {
        // SET key value NX EX ttl
        // NX: 只在key不存在时设置
        // EX: 设置过期时间(秒)
        const result = await redis.set(lockKey, lockValue, 'EX', ttl, 'NX');

        if (result === 'OK') {
          logger.debug(`[REDIS-LOCK] ✅ 获取锁成功: ${lockKey}`);
          return lockValue;
        }

        // 获取锁失败,等待后重试
        if (i < retry) {
          await this.sleep(retryDelay);
        }
      } catch (error: any) {
        logger.error(`[REDIS-LOCK] ❌ 获取锁异常: ${lockKey}`, error);
        throw error;
      }
    }

    logger.warn(`[REDIS-LOCK] ⚠️  获取锁失败(重试${retry}次): ${lockKey}`);
    return null;
  }

  /**
   * 释放分布式锁
   * 艹！使用Lua脚本保证原子性,只有持有锁的进程才能释放
   */
  async release(key: string, lockValue: string): Promise<boolean> {
    const lockKey = `lock:${key}`;

    try {
      // 使用Lua脚本保证原子性:只有持有锁的进程才能释放
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = (await redis.eval(script, 1, lockKey, lockValue)) as number;

      if (result === 1) {
        logger.debug(`[REDIS-LOCK] ✅ 释放锁成功: ${lockKey}`);
        return true;
      } else {
        logger.warn(`[REDIS-LOCK] ⚠️  释放锁失败(锁不存在或已过期): ${lockKey}`);
        return false;
      }
    } catch (error: any) {
      logger.error(`[REDIS-LOCK] ❌ 释放锁异常: ${lockKey}`, error);
      throw error;
    }
  }

  /**
   * 使用锁执行任务(推荐方式) - P0-004核心方法
   * 艹！自动获取锁、执行任务、释放锁,finally确保锁一定会被释放
   *
   * @example
   * await redisLock.withLock('quota:deduct:user123', async () => {
   *   // 这里的代码被分布式锁保护
   *   await deductQuota(userId, amount);
   * }, { ttl: 10, retry: 3 });
   */
  async withLock<T>(key: string, task: () => Promise<T>, options: LockOptions = {}): Promise<T> {
    const { ttl = 10, retry = 3, retryDelay = 100 } = options;

    const lockValue = await this.acquire(key, ttl, retry, retryDelay);

    if (!lockValue) {
      throw new Error(`无法获取锁: ${key}`);
    }

    try {
      // 执行任务
      const result = await task();
      return result;
    } finally {
      // 确保锁一定会被释放
      await this.release(key, lockValue);
    }
  }

  /**
   * 检查锁是否存在
   */
  async exists(key: string): Promise<boolean> {
    const lockKey = `lock:${key}`;
    const result = await redis.exists(lockKey);
    return result === 1;
  }

  /**
   * 获取锁的剩余过期时间
   * @returns 剩余秒数,-1表示永不过期,-2表示key不存在
   */
  async ttl(key: string): Promise<number> {
    const lockKey = `lock:${key}`;
    return await redis.ttl(lockKey);
  }

  /**
   * 延长锁的过期时间(续租)
   * 艹！用于长时间任务,防止锁过期
   */
  async renew(key: string, lockValue: string, ttl: number): Promise<boolean> {
    const lockKey = `lock:${key}`;

    try {
      // 使用Lua脚本保证原子性:只有持有锁的进程才能续租
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("expire", KEYS[1], ARGV[2])
        else
          return 0
        end
      `;

      const result = (await redis.eval(script, 1, lockKey, lockValue, ttl)) as number;

      if (result === 1) {
        logger.debug(`[REDIS-LOCK] ✅ 续租锁成功: ${lockKey}, ttl=${ttl}s`);
        return true;
      } else {
        logger.warn(`[REDIS-LOCK] ⚠️  续租锁失败(锁不存在或已过期): ${lockKey}`);
        return false;
      }
    } catch (error: any) {
      logger.error(`[REDIS-LOCK] ❌ 续租锁异常: ${lockKey}`, error);
      throw error;
    }
  }

  /**
   * 辅助方法:延迟
   * 艹！等待后重试,避免疯狂轮询
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 导出单例
export const redisLockService = new RedisLockService();
export default redisLockService;
