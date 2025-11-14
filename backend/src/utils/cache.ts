/**
 * 两层缓存系统
 * 艹，这个tm实现L1(LRU内存) + L2(Redis)的多层缓存！
 *
 * 架构：
 * - L1: 本地LRU内存缓存（快，容量小，进程级）
 * - L2: Redis缓存（慢，容量大，分布式共享）
 *
 * 读取策略：
 * 1. 先查L1，命中则返回
 * 2. L1 miss，查L2
 * 3. L2命中，回写L1，返回
 * 4. L2 miss，返回null
 *
 * 写入策略：
 * - 同时写L1和L2（write-through）
 *
 * 失效策略：
 * - 同时失效L1和L2
 */

import { LRUCache } from 'lru-cache';
import { Redis } from 'ioredis';

/**
 * 缓存配置
 */
export interface CacheConfig {
  /** L1缓存最大条目数 */
  l1MaxSize?: number;
  /** L1缓存默认TTL（毫秒） */
  l1DefaultTtl?: number;
  /** L2缓存默认TTL（秒） */
  l2DefaultTtl?: number;
  /** Redis配置 */
  redisConfig?: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
  };
  /** 缓存命名空间（前缀） */
  namespace?: string;
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
  l1Hits: number;
  l1Misses: number;
  l2Hits: number;
  l2Misses: number;
  l1Size: number;
}

/**
 * 两层缓存管理器
 */
type L1CacheEntry = {
  value: unknown;
};

export class CacheManager {
  private l1Cache: LRUCache<string, L1CacheEntry, never>;
  private l2Cache: Redis | null = null;
  private namespace: string;
  private l2DefaultTtl: number;

  // 统计信息
  private stats: Omit<CacheStats, 'l1Size'> = {
    l1Hits: 0,
    l1Misses: 0,
    l2Hits: 0,
    l2Misses: 0
  };

  constructor(config: CacheConfig = {}) {
    const {
      l1MaxSize = 1000,
      l1DefaultTtl = 5 * 60 * 1000, // 5分钟
      l2DefaultTtl = 30 * 60, // 30分钟
      redisConfig,
      namespace = 'cache'
    } = config;

    this.namespace = namespace;
    this.l2DefaultTtl = l2DefaultTtl;

    // 初始化L1缓存（LRU）
    this.l1Cache = new LRUCache<string, L1CacheEntry, never>({
      max: l1MaxSize,
      ttl: l1DefaultTtl,
      updateAgeOnGet: true // 访问时更新age
    } satisfies LRUCache.Options<string, L1CacheEntry, never>);

    // 初始化L2缓存（Redis）
    if (redisConfig || process.env.REDIS_HOST) {
      try {
        this.l2Cache = new Redis({
          host: redisConfig?.host || process.env.REDIS_HOST || 'localhost',
          port: redisConfig?.port || parseInt(process.env.REDIS_PORT || '6379'),
          password: redisConfig?.password || process.env.REDIS_PASSWORD,
          db: redisConfig?.db || parseInt(process.env.REDIS_DB || '0'),
          retryStrategy: (times: number) => {
            // 重试策略：最多重试3次，延迟递增
            if (times > 3) {
              console.error('[CACHE] Redis连接失败，超过最大重试次数');
              return null; // 停止重试
            }
            return Math.min(times * 100, 2000); // 延迟100ms, 200ms, 300ms
          }
        });

        this.l2Cache.on('connect', () => {
          console.log('[CACHE] Redis连接成功');
        });

        this.l2Cache.on('error', (err: unknown) => {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error('[CACHE] Redis错误:', errMsg);
        });
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[CACHE] 初始化Redis失败:', errMsg);
        this.l2Cache = null;
      }
    } else {
      console.warn('[CACHE] 未配置Redis，仅使用L1内存缓存');
    }
  }

  /**
   * 构造完整的缓存key（带namespace）
   */
  private buildKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  /**
   * 获取缓存值
   * @param key - 缓存key
   * @returns 缓存值，未找到返回null
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    const fullKey = this.buildKey(key);

    // 1. 先查L1缓存
    const l1Value = this.l1Cache.get(fullKey);
    if (l1Value !== undefined) {
      this.stats.l1Hits++;
      console.log(`[CACHE] L1命中: ${key}`);
      return l1Value.value as T;
    }
    this.stats.l1Misses++;

    // 2. L1 miss，查L2缓存
    if (this.l2Cache) {
      try {
        const l2ValueStr = await this.l2Cache.get(fullKey);
        if (l2ValueStr) {
          this.stats.l2Hits++;
          console.log(`[CACHE] L2命中: ${key}`);

          // 解析JSON
          const l2Value = JSON.parse(l2ValueStr) as T;

          // 回写L1
          this.l1Cache.set(fullKey, { value: l2Value });

          return l2Value;
        }
        this.stats.l2Misses++;
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(`[CACHE] L2读取失败: ${errMsg}`);
      }
    }

    console.log(`[CACHE] 缓存未命中: ${key}`);
    return null;
  }

  /**
   * 设置缓存值
   * @param key - 缓存key
   * @param value - 缓存值
   * @param ttl - TTL（秒），不传则使用默认值
   */
  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    const fullKey = this.buildKey(key);

    // 1. 写L1缓存
    const l1Ttl = ttl ? ttl * 1000 : undefined; // 转换为毫秒
    this.l1Cache.set(fullKey, { value }, { ttl: l1Ttl });

    // 2. 写L2缓存
    if (this.l2Cache) {
      try {
        const valueStr = JSON.stringify(value);
        const l2Ttl = ttl || this.l2DefaultTtl;

        await this.l2Cache.setex(fullKey, l2Ttl, valueStr);
        console.log(`[CACHE] 写入缓存: ${key} (TTL: ${l2Ttl}s)`);
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(`[CACHE] L2写入失败: ${errMsg}`);
      }
    }
  }

  /**
   * 删除缓存
   * @param key - 缓存key
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.buildKey(key);

    // 1. 删除L1
    this.l1Cache.delete(fullKey);

    // 2. 删除L2
    if (this.l2Cache) {
      try {
        await this.l2Cache.del(fullKey);
        console.log(`[CACHE] 删除缓存: ${key}`);
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(`[CACHE] L2删除失败: ${errMsg}`);
      }
    }
  }

  /**
   * 批量删除缓存（支持模糊匹配）
   * @param pattern - key模式，如 "user:*"
   */
  async deletePattern(pattern: string): Promise<number> {
    const fullPattern = this.buildKey(pattern);
    let deletedCount = 0;

    // 1. 清空L1（艹，LRU不支持模糊删除，直接清空）
    this.l1Cache.clear();
    console.log('[CACHE] L1缓存已清空');

    // 2. 删除L2中匹配的key
    if (this.l2Cache) {
      try {
        const keys = await this.l2Cache.keys(fullPattern);
        if (keys.length > 0) {
          deletedCount = await this.l2Cache.del(...keys);
          console.log(`[CACHE] 删除${deletedCount}个匹配的key: ${pattern}`);
        }
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(`[CACHE] 批量删除失败: ${errMsg}`);
      }
    }

    return deletedCount;
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    // 1. 清空L1
    this.l1Cache.clear();

    // 2. 清空L2中当前namespace的所有key
    if (this.l2Cache) {
      try {
        const pattern = this.buildKey('*');
        const keys = await this.l2Cache.keys(pattern);
        if (keys.length > 0) {
          await this.l2Cache.del(...keys);
          console.log(`[CACHE] 清空缓存，删除${keys.length}个key`);
        }
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(`[CACHE] 清空缓存失败: ${errMsg}`);
      }
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    return {
      ...this.stats,
      l1Size: this.l1Cache.size
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      l1Hits: 0,
      l1Misses: 0,
      l2Hits: 0,
      l2Misses: 0
    };
  }

  /**
   * 计算缓存命中率
   */
  getHitRate(): { l1: number; l2: number; overall: number } {
    const l1Total = this.stats.l1Hits + this.stats.l1Misses;
    const l2Total = this.stats.l2Hits + this.stats.l2Misses;
    const overallHits = this.stats.l1Hits + this.stats.l2Hits;
    const overallTotal = l1Total;

    return {
      l1: l1Total > 0 ? this.stats.l1Hits / l1Total : 0,
      l2: l2Total > 0 ? this.stats.l2Hits / l2Total : 0,
      overall: overallTotal > 0 ? overallHits / overallTotal : 0
    };
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    if (this.l2Cache) {
      await this.l2Cache.quit();
      console.log('[CACHE] Redis连接已关闭');
    }
  }
}

// 导出全局单例实例
export const globalCache = new CacheManager({
  namespace: 'cms',
  l1MaxSize: 500,
  l1DefaultTtl: 5 * 60 * 1000, // 5分钟
  l2DefaultTtl: 30 * 60 // 30分钟
});
