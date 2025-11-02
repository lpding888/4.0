/**
 * 缓存失效广播系统（Redis Pub/Sub）
 * 艹，这个tm用于多实例间同步缓存失效！
 *
 * 场景：
 * - 实例A更新配置 → 删除自己的缓存 → 发布失效消息
 * - 实例B/C/D收到消息 → 删除各自的缓存
 *
 * 消息格式：
 * {
 *   type: 'invalidate' | 'clear',
 *   keys: string[], // 精准失效的key列表
 *   pattern: string, // 模糊失效的pattern（可选）
 *   namespace: string,
 *   timestamp: number
 * }
 */

import Redis from 'ioredis';
import { CacheManager } from './cache';

/**
 * 缓存失效消息类型
 */
export interface CacheInvalidationMessage {
  /** 操作类型 */
  type: 'invalidate' | 'clear' | 'pattern';
  /** 要失效的key列表（精准失效） */
  keys?: string[];
  /** 要失效的pattern（模糊失效） */
  pattern?: string;
  /** 命名空间 */
  namespace: string;
  /** 时间戳 */
  timestamp: number;
  /** 来源实例ID（避免重复处理） */
  source?: string;
}

/**
 * 缓存失效广播管理器
 */
export class CacheInvalidationManager {
  private publisher: Redis | null = null;
  private subscriber: Redis | null = null;
  private cacheManager: CacheManager;
  private channel: string;
  private instanceId: string;
  private isReady: boolean = false;

  constructor(
    cacheManager: CacheManager,
    config: {
      channel?: string;
      redisConfig?: {
        host?: string;
        port?: number;
        password?: string;
        db?: number;
      };
    } = {}
  ) {
    this.cacheManager = cacheManager;
    this.channel = config.channel || 'cache:invalidation';
    this.instanceId = this.generateInstanceId();

    // 初始化Redis连接
    const redisOptions = {
      host: config.redisConfig?.host || process.env.REDIS_HOST || 'localhost',
      port:
        config.redisConfig?.port || parseInt(process.env.REDIS_PORT || '6379'),
      password: config.redisConfig?.password || process.env.REDIS_PASSWORD,
      db: config.redisConfig?.db || parseInt(process.env.REDIS_DB || '0'),
    };

    if (process.env.REDIS_HOST || config.redisConfig) {
      try {
        // 发布者连接
        this.publisher = new Redis(redisOptions);

        // 订阅者连接（必须独立）
        this.subscriber = new Redis(redisOptions);

        this.setupSubscriber();

        this.publisher.on('connect', () => {
          console.log('[CACHE_INVALIDATION] Publisher连接成功');
          this.isReady = true;
        });

        this.publisher.on('error', (err) => {
          console.error('[CACHE_INVALIDATION] Publisher错误:', err.message);
        });
      } catch (error: any) {
        console.error('[CACHE_INVALIDATION] 初始化失败:', error.message);
      }
    } else {
      console.warn('[CACHE_INVALIDATION] 未配置Redis，缓存失效广播不可用');
    }
  }

  /**
   * 生成实例ID
   */
  private generateInstanceId(): string {
    return `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  /**
   * 设置订阅者
   */
  private setupSubscriber(): void {
    if (!this.subscriber) return;

    this.subscriber.subscribe(this.channel, (err) => {
      if (err) {
        console.error('[CACHE_INVALIDATION] 订阅失败:', err.message);
      } else {
        console.log(`[CACHE_INVALIDATION] 已订阅频道: ${this.channel}`);
      }
    });

    this.subscriber.on('message', async (channel, message) => {
      if (channel !== this.channel) return;

      try {
        const msg: CacheInvalidationMessage = JSON.parse(message);

        // 艹，忽略自己发布的消息（避免重复处理）
        if (msg.source === this.instanceId) {
          return;
        }

        console.log(
          `[CACHE_INVALIDATION] 收到失效消息: ${msg.type}`,
          msg.keys || msg.pattern
        );

        await this.handleInvalidationMessage(msg);
      } catch (error: any) {
        console.error('[CACHE_INVALIDATION] 处理消息失败:', error.message);
      }
    });

    this.subscriber.on('error', (err) => {
      console.error('[CACHE_INVALIDATION] Subscriber错误:', err.message);
    });
  }

  /**
   * 处理失效消息
   */
  private async handleInvalidationMessage(
    msg: CacheInvalidationMessage
  ): Promise<void> {
    switch (msg.type) {
      case 'invalidate':
        // 精准失效指定key
        if (msg.keys && msg.keys.length > 0) {
          for (const key of msg.keys) {
            await this.cacheManager.delete(key);
          }
        }
        break;

      case 'pattern':
        // 模糊失效（pattern）
        if (msg.pattern) {
          await this.cacheManager.deletePattern(msg.pattern);
        }
        break;

      case 'clear':
        // 清空所有缓存
        await this.cacheManager.clear();
        break;
    }
  }

  /**
   * 发布精准失效消息
   * @param keys - 要失效的key列表
   * @param namespace - 命名空间（默认使用cacheManager的namespace）
   */
  async invalidate(keys: string[], namespace?: string): Promise<void> {
    if (!this.isReady || !this.publisher) {
      console.warn('[CACHE_INVALIDATION] Publisher未就绪，跳过广播');
      return;
    }

    const message: CacheInvalidationMessage = {
      type: 'invalidate',
      keys,
      namespace: namespace || 'cms',
      timestamp: Date.now(),
      source: this.instanceId,
    };

    try {
      await this.publisher.publish(this.channel, JSON.stringify(message));
      console.log(`[CACHE_INVALIDATION] 已发布失效消息: ${keys.join(', ')}`);
    } catch (error: any) {
      console.error('[CACHE_INVALIDATION] 发布失败:', error.message);
    }
  }

  /**
   * 发布模糊失效消息
   * @param pattern - key模式，如 "user:*"
   * @param namespace - 命名空间
   */
  async invalidatePattern(pattern: string, namespace?: string): Promise<void> {
    if (!this.isReady || !this.publisher) {
      console.warn('[CACHE_INVALIDATION] Publisher未就绪，跳过广播');
      return;
    }

    const message: CacheInvalidationMessage = {
      type: 'pattern',
      pattern,
      namespace: namespace || 'cms',
      timestamp: Date.now(),
      source: this.instanceId,
    };

    try {
      await this.publisher.publish(this.channel, JSON.stringify(message));
      console.log(`[CACHE_INVALIDATION] 已发布模糊失效消息: ${pattern}`);
    } catch (error: any) {
      console.error('[CACHE_INVALIDATION] 发布失败:', error.message);
    }
  }

  /**
   * 发布清空缓存消息
   * @param namespace - 命名空间
   */
  async clear(namespace?: string): Promise<void> {
    if (!this.isReady || !this.publisher) {
      console.warn('[CACHE_INVALIDATION] Publisher未就绪，跳过广播');
      return;
    }

    const message: CacheInvalidationMessage = {
      type: 'clear',
      namespace: namespace || 'cms',
      timestamp: Date.now(),
      source: this.instanceId,
    };

    try {
      await this.publisher.publish(this.channel, JSON.stringify(message));
      console.log('[CACHE_INVALIDATION] 已发布清空缓存消息');
    } catch (error: any) {
      console.error('[CACHE_INVALIDATION] 发布失败:', error.message);
    }
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit();
      console.log('[CACHE_INVALIDATION] Subscriber已关闭');
    }
    if (this.publisher) {
      await this.publisher.quit();
      console.log('[CACHE_INVALIDATION] Publisher已关闭');
    }
  }
}

// 导出全局单例实例
import { globalCache } from './cache';

export const globalInvalidation = new CacheInvalidationManager(globalCache, {
  channel: 'cache:invalidation',
});
