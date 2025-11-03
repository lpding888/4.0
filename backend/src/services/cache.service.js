const Redis = require('ioredis');
const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * Redis缓存服务
 *
 * 提供高性能缓存功能，支持：
 * - 多级缓存（L1内存 + L2Redis）
 * - 版本化缓存管理
 * - Pub/Sub缓存失效
 * - 缓存预热和智能刷新
 * - 缓存穿透保护
 */
class CacheService {
  constructor() {
    // Redis连接
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: process.env.REDIS_DB || 1, // 使用DB1作为缓存专用
      keyPrefix: 'cache:',
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    // 内存缓存（L1缓存）
    this.memoryCache = new Map();
    this.memoryCacheMaxSize = 1000;
    this.memoryCacheTTL = 60000; // 1分钟

    // 版本管理
    this.versions = new Map();
    this.versionKey = 'global_version';

    // 缓存配置
    this.defaultTTL = 300; // 5分钟
    this.maxTTL = 3600; // 1小时
    this.minTTL = 30; // 30秒

    // 穿透保护
    this.nullCachePrefix = 'null:';
    this.nullCacheTTL = 300; // 空值缓存5分钟

    // 统计信息
    this.stats = {
      hits: 0,
      misses: 0,
      memoryHits: 0,
      redisHits: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };

    // 定期清理内存缓存
    this.startMemoryCacheCleanup();

    // 监听Redis事件
    this.setupRedisListeners();
  }

  /**
   * 获取缓存
   * @param {string} key - 缓存键
   * @param {Object} options - 选项
   * @returns {Promise<any>} 缓存值
   */
  async get(key, options = {}) {
    try {
      const startTime = Date.now();

      // 1. 检查内存缓存（L1）
      if (this.memoryCache.has(key)) {
        const item = this.memoryCache.get(key);
        if (Date.now() < item.expiresAt) {
          this.stats.hits++;
          this.stats.memoryHits++;
          logger.debug(`[CacheService] 内存缓存命中: ${key}`);
          return item.value;
        } else {
          this.memoryCache.delete(key);
        }
      }

      // 2. 检查Redis缓存（L2）
      const redisValue = await this.redis.get(key);
      if (redisValue !== null) {
        this.stats.hits++;
        this.stats.redisHits++;

        // 解析缓存数据
        let parsedValue;
        try {
          parsedValue = JSON.parse(redisValue);
        } catch (error) {
          parsedValue = redisValue;
        }

        // 更新内存缓存
        this.setMemoryCache(key, parsedValue, options.memoryTTL);

        logger.debug(`[CacheService] Redis缓存命中: ${key}`);
        return parsedValue;
      }

      // 3. 缓存未命中
      this.stats.misses++;
      logger.debug(`[CacheService] 缓存未命中: ${key}`);

      const queryTime = Date.now() - startTime;
      if (queryTime > 100) {
        logger.warn(`[CacheService] 缓存查询缓慢: ${key}, 耗时: ${queryTime}ms`);
      }

      return null;

    } catch (error) {
      this.stats.errors++;
      logger.error(`[CacheService] 获取缓存失败: ${key}`, error);
      return null;
    }
  }

  /**
   * 设置缓存
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   * @param {number|Object} ttlOrOptions - TTL或选项
   * @returns {Promise<boolean>} 是否成功
   */
  async set(key, value, ttlOrOptions = {}) {
    try {
      let ttl = this.defaultTTL;
      let options = {};

      if (typeof ttlOrOptions === 'number') {
        ttl = Math.min(Math.max(ttlOrOptions, this.minTTL), this.maxTTL);
      } else if (typeof ttlOrOptions === 'object') {
        options = ttlOrOptions;
        ttl = Math.min(Math.max(options.ttl || this.defaultTTL, this.minTTL), this.maxTTL);
      }

      // 序列化值
      let serializedValue;
      try {
        serializedValue = JSON.stringify(value);
      } catch (error) {
        serializedValue = String(value);
      }

      // 设置Redis缓存
      const redisPromise = this.redis.setex(key, ttl, serializedValue);

      // 设置内存缓存
      const memoryPromise = this.setMemoryCache(key, value, options.memoryTTL);

      await Promise.all([redisPromise, memoryPromise]);

      this.stats.sets++;
      logger.debug(`[CacheService] 缓存设置成功: ${key}, TTL: ${ttl}s`);

      return true;

    } catch (error) {
      this.stats.errors++;
      logger.error(`[CacheService] 设置缓存失败: ${key}`, error);
      return false;
    }
  }

  /**
   * 删除缓存
   * @param {string} key - 缓存键
   * @returns {Promise<boolean>} 是否成功
   */
  async delete(key) {
    try {
      // 删除Redis缓存
      const redisPromise = this.redis.del(key);

      // 删除内存缓存
      const memoryPromise = Promise.resolve(this.memoryCache.delete(key));

      await Promise.all([redisPromise, memoryPromise]);

      this.stats.deletes++;
      logger.debug(`[CacheService] 缓存删除成功: ${key}`);

      return true;

    } catch (error) {
      this.stats.errors++;
      logger.error(`[CacheService] 删除缓存失败: ${key}`, error);
      return false;
    }
  }

  /**
   * 批量删除缓存（支持模式匹配）
   * @param {string} pattern - 匹配模式
   * @returns {Promise<number>} 删除数量
   */
  async deletePattern(pattern) {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      // 删除Redis缓存
      const redisPromise = this.redis.del(...keys);

      // 删除内存缓存
      keys.forEach(key => this.memoryCache.delete(key));

      await redisPromise;

      this.stats.deletes += keys.length;
      logger.debug(`[CacheService] 批量删除缓存成功: ${pattern}, 删除数量: ${keys.length}`);

      return keys.length;

    } catch (error) {
      this.stats.errors++;
      logger.error(`[CacheService] 批量删除缓存失败: ${pattern}`, error);
      return 0;
    }
  }

  /**
   * 设置空值缓存（防止穿透）
   * @param {string} key - 缓存键
   * @returns {Promise<boolean>} 是否成功
   */
  async setNull(key) {
    return this.set(this.nullCachePrefix + key, null, this.nullCacheTTL);
  }

  /**
   * 检查是否为空值缓存
   * @param {string} key - 缓存键
   * @returns {Promise<boolean>} 是否为空值
   */
  async isNull(key) {
    const nullValue = await this.get(this.nullCachePrefix + key);
    return nullValue === null;
  }

  /**
   * 版本化缓存获取
   * @param {string} namespace - 命名空间
   * @param {string} key - 缓存键
   * @param {Object} options - 选项
   * @returns {Promise<any>} 缓存值
   */
  async getWithVersion(namespace, key, options = {}) {
    try {
      // 获取当前版本
      const version = await this.getVersion(namespace);
      const versionedKey = `${namespace}:${version}:${key}`;

      return await this.get(versionedKey, options);

    } catch (error) {
      logger.error(`[CacheService] 版本化获取缓存失败: ${namespace}:${key}`, error);
      return null;
    }
  }

  /**
   * 版本化缓存设置
   * @param {string} namespace - 命名空间
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   * @param {number|Object} ttlOrOptions - TTL或选项
   * @returns {Promise<boolean>} 是否成功
   */
  async setWithVersion(namespace, key, value, ttlOrOptions = {}) {
    try {
      // 获取当前版本
      const version = await this.getVersion(namespace);
      const versionedKey = `${namespace}:${version}:${key}`;

      return await this.set(versionedKey, value, ttlOrOptions);

    } catch (error) {
      logger.error(`[CacheService] 版本化设置缓存失败: ${namespace}:${key}`, error);
      return false;
    }
  }

  /**
   * 获取版本号
   * @param {string} namespace - 命名空间
   * @returns {Promise<number>} 版本号
   */
  async getVersion(namespace) {
    try {
      const versionKey = `version:${namespace}`;
      let version = await this.redis.get(versionKey);

      if (version === null) {
        version = '1';
        await this.redis.set(versionKey, version);
      }

      return parseInt(version, 10);

    } catch (error) {
      logger.error(`[CacheService] 获取版本号失败: ${namespace}`, error);
      return 1;
    }
  }

  /**
   * 递增版本号（会清除该命名空间下的所有缓存）
   * @param {string} namespace - 命名空间
   * @returns {Promise<number>} 新版本号
   */
  async incrementVersion(namespace) {
    try {
      const versionKey = `version:${namespace}`;
      const newVersion = await this.redis.incr(versionKey);

      // 清理旧版本的缓存（异步）
      this.deletePattern(`${namespace}:*`).catch(error => {
        logger.warn(`[CacheService] 清理旧版本缓存失败: ${namespace}`, error);
      });

      // 发布版本更新事件
      await this.publish('version_update', {
        namespace,
        version: newVersion,
        timestamp: Date.now()
      });

      logger.info(`[CacheService] 版本更新: ${namespace} -> ${newVersion}`);
      return newVersion;

    } catch (error) {
      logger.error(`[CacheService] 版本更新失败: ${namespace}`, error);
      return 1;
    }
  }

  /**
   * 发布消息到频道
   * @param {string} channel - 频道名
   * @param {any} message - 消息内容
   * @returns {Promise<number>} 接收者数量
   */
  async publish(channel, message) {
    try {
      const messageStr = JSON.stringify({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        ...message
      });

      const result = await this.redis.publish(channel, messageStr);
      logger.debug(`[CacheService] 消息发布成功: ${channel}, 接收者: ${result}`);

      return result;

    } catch (error) {
      logger.error(`[CacheService] 消息发布失败: ${channel}`, error);
      return 0;
    }
  }

  /**
   * 订阅频道
   * @param {string} channel - 频道名
   * @param {Function} callback - 回调函数
   * @returns {Promise<void>}
   */
  async subscribe(channel, callback) {
    try {
      const subscriber = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: process.env.REDIS_DB || 1,
        keyPrefix: 'cache:',
        lazyConnect: true
      });

      await subscriber.subscribe(channel);

      subscriber.on('message', (chan, message) => {
        try {
          const data = JSON.parse(message);
          callback(chan, data);
        } catch (error) {
          logger.error(`[CacheService] 消息解析失败: ${channel}`, error);
        }
      });

      logger.info(`[CacheService] 频道订阅成功: ${channel}`);
      return subscriber;

    } catch (error) {
      logger.error(`[CacheService] 频道订阅失败: ${channel}`, error);
      throw error;
    }
  }

  /**
   * 缓存预热
   * @param {Array} preloadItems - 预热项目 [{key, value, ttl}]
   * @returns {Promise<number>} 成功数量
   */
  async preload(preloadItems) {
    if (!Array.isArray(preloadItems) || preloadItems.length === 0) {
      return 0;
    }

    const startTime = Date.now();
    let successCount = 0;

    const promises = preloadItems.map(async (item) => {
      try {
        const result = await this.set(item.key, item.value, item.ttl);
        if (result) {
          successCount++;
        }
      } catch (error) {
        logger.warn(`[CacheService] 预热失败: ${item.key}`, error);
      }
    });

    await Promise.all(promises);

    const loadTime = Date.now() - startTime;
    logger.info(`[CacheService] 缓存预热完成: ${successCount}/${preloadItems.length}, 耗时: ${loadTime}ms`);

    return successCount;
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;

    const memoryHitRate = this.stats.hits > 0
      ? (this.stats.memoryHits / this.stats.hits * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      memoryHitRate: `${memoryHitRate}%`,
      memoryCacheSize: this.memoryCache.size,
      uptime: process.uptime()
    };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      memoryHits: 0,
      redisHits: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
  }

  /**
   * 健康检查
   * @returns {Promise<Object>} 健康状态
   */
  async healthCheck() {
    try {
      const startTime = Date.now();
      const testKey = 'health_check_' + Date.now();
      const testValue = 'ok';

      // 测试Redis连接
      await this.redis.setex(testKey, 1, testValue);
      const retrievedValue = await this.redis.get(testKey);
      await this.redis.del(testKey);

      const responseTime = Date.now() - startTime;

      return {
        status: retrievedValue === testValue ? 'healthy' : 'unhealthy',
        responseTime: `${responseTime}ms`,
        redis: 'connected',
        memoryCache: 'active',
        stats: this.getStats()
      };

    } catch (error) {
      logger.error('[CacheService] 健康检查失败', error);
      return {
        status: 'unhealthy',
        error: error.message,
        redis: 'disconnected',
        memoryCache: 'active',
        stats: this.getStats()
      };
    }
  }

  /**
   * 设置内存缓存
   * @param {string} key - 键
   * @param {any} value - 值
   * @param {number} ttl - 生存时间（毫秒）
   * @private
   */
  setMemoryCache(key, value, ttl = this.memoryCacheTTL) {
    // 检查缓存大小限制
    if (this.memoryCache.size >= this.memoryCacheMaxSize) {
      // 删除最旧的缓存项（LRU）
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }

    this.memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now()
    });
  }

  /**
   * 启动内存缓存清理定时器
   * @private
   */
  startMemoryCacheCleanup() {
    setInterval(() => {
      const now = Date.now();
      const keysToDelete = [];

      this.memoryCache.forEach((item, key) => {
        if (now >= item.expiresAt) {
          keysToDelete.push(key);
        }
      });

      keysToDelete.forEach(key => this.memoryCache.delete(key));

      if (keysToDelete.length > 0) {
        logger.debug(`[CacheService] 内存缓存清理: ${keysToDelete.length} 项`);
      }
    }, 60000); // 每分钟清理一次
  }

  /**
   * 设置Redis事件监听
   * @private
   */
  setupRedisListeners() {
    this.redis.on('connect', () => {
      logger.info('[CacheService] Redis连接成功');
    });

    this.redis.on('error', (error) => {
      logger.error('[CacheService] Redis连接错误', error);
    });

    this.redis.on('close', () => {
      logger.warn('[CacheService] Redis连接关闭');
    });

    this.redis.on('reconnecting', () => {
      logger.info('[CacheService] Redis重连中...');
    });
  }

  /**
   * 关闭缓存服务
   * @returns {Promise<void>}
   */
  async close() {
    try {
      await this.redis.quit();
      this.memoryCache.clear();
      logger.info('[CacheService] 缓存服务已关闭');
    } catch (error) {
      logger.error('[CacheService] 关闭缓存服务失败', error);
    }
  }
}

module.exports = new CacheService();