const cacheService = require('./cache.service');
const logger = require('../utils/logger');

/**
 * 缓存订阅服务
 *
 * 处理缓存失效事件，支持：
 * - 版本更新订阅
 * - 自定义缓存失效
 * - 分布式缓存同步
 * - 缓存预热管理
 */
class CacheSubscriberService {
  constructor() {
    this.subscribers = new Map();
    this.isRunning = false;
    this.reconnectInterval = 5000;
    this.maxReconnectAttempts = 10;
    this.reconnectAttempts = 0;

    // 预热任务队列
    this.preloadQueue = [];
    this.isPreloading = false;
  }

  /**
   * 启动订阅服务
   * @returns {Promise<void>}
   */
  async start() {
    try {
      if (this.isRunning) {
        logger.warn('[CacheSubscriberService] 订阅服务已在运行');
        return;
      }

      logger.info('[CacheSubscriberService] 启动缓存订阅服务');

      // 订阅版本更新事件
      await this.subscribeToVersionUpdates();

      // 订阅自定义失效事件
      await this.subscribeToCustomInvalidation();

      // 订阅缓存预热事件
      await this.subscribeToPreloadEvents();

      // 订阅健康检查事件
      await this.subscribeToHealthEvents();

      this.isRunning = true;
      this.reconnectAttempts = 0;

      logger.info('[CacheSubscriberService] 缓存订阅服务启动成功');

    } catch (error) {
      logger.error('[CacheSubscriberService] 启动订阅服务失败', error);
      this.handleReconnect();
    }
  }

  /**
   * 停止订阅服务
   * @returns {Promise<void>}
   */
  async stop() {
    try {
      this.isRunning = false;

      // 关闭所有订阅
      for (const [channel, subscriber] of this.subscribers) {
        try {
          await subscriber.quit();
          logger.debug(`[CacheSubscriberService] 关闭订阅: ${channel}`);
        } catch (error) {
          logger.warn(`[CacheSubscriberService] 关闭订阅失败: ${channel}`, error);
        }
      }

      this.subscribers.clear();

      logger.info('[CacheSubscriberService] 缓存订阅服务已停止');

    } catch (error) {
      logger.error('[CacheSubscriberService] 停止订阅服务失败', error);
    }
  }

  /**
   * 订阅版本更新事件
   * @private
   */
  async subscribeToVersionUpdates() {
    const subscriber = await cacheService.subscribe('version_update', async (channel, data) => {
      try {
        logger.debug(`[CacheSubscriberService] 收到版本更新事件: ${data.namespace} v${data.version}`);

        // 清理相关的内存缓存
        await this.clearMemoryCacheForNamespace(data.namespace);

        // 触发预热（如果配置了）
        await this.triggerPreload(data.namespace);

        // 发布清理完成事件
        await cacheService.publish('cache_cleared', {
          namespace: data.namespace,
          version: data.version,
          type: 'version_update',
          timestamp: Date.now()
        });

      } catch (error) {
        logger.error('[CacheSubscriberService] 处理版本更新事件失败', error);
      }
    });

    this.subscribers.set('version_update', subscriber);
  }

  /**
   * 订阅自定义失效事件
   * @private
   */
  async subscribeToCustomInvalidation() {
    const subscriber = await cacheService.subscribe('cache_invalidate', async (channel, data) => {
      try {
        const { pattern, namespace, reason } = data;
        logger.info(`[CacheSubscriberService] 收到自定义失效事件: ${pattern}, 原因: ${reason}`);

        // 删除匹配的缓存
        const deleteCount = await cacheService.deletePattern(`${namespace}:${pattern}*`);

        // 清理内存缓存
        await this.clearMemoryCacheForPattern(`${namespace}:${pattern}*`);

        logger.info(`[CacheSubscriberService] 自定义失效完成: 删除 ${deleteCount} 个缓存项`);

        // 发布失效完成事件
        await cacheService.publish('cache_invalidated', {
          pattern,
          namespace,
          deleteCount,
          reason,
          timestamp: Date.now()
        });

      } catch (error) {
        logger.error('[CacheSubscriberService] 处理自定义失效事件失败', error);
      }
    });

    this.subscribers.set('cache_invalidate', subscriber);
  }

  /**
   * 订阅缓存预热事件
   * @private
   */
  async subscribeToPreloadEvents() {
    const subscriber = await cacheService.subscribe('cache_preload', async (channel, data) => {
      try {
        const { namespace, items, priority = 'normal' } = data;
        logger.info(`[CacheSubscriberService] 收到预热事件: ${namespace}, 项数: ${items.length}`);

        // 添加到预热队列
        this.addToPreloadQueue(namespace, items, priority);

        // 处理预热队列
        this.processPreloadQueue();

      } catch (error) {
        logger.error('[CacheSubscriberService] 处理预热事件失败', error);
      }
    });

    this.subscribers.set('cache_preload', subscriber);
  }

  /**
   * 订阅健康检查事件
   * @private
   */
  async subscribeToHealthEvents() {
    const subscriber = await cacheService.subscribe('health_check', async (channel, data) => {
      try {
        logger.debug(`[CacheSubscriberService] 收到健康检查事件`);

        // 执行健康检查
        const health = await cacheService.healthCheck();

        // 发布健康状态
        await cacheService.publish('health_status', {
          ...health,
          nodeId: process.env.NODE_ID || 'unknown',
          timestamp: Date.now()
        });

      } catch (error) {
        logger.error('[CacheSubscriberService] 处理健康检查事件失败', error);
      }
    });

    this.subscribers.set('health_check', subscriber);
  }

  /**
   * 手动触发缓存失效
   * @param {string} namespace - 命名空间
   * @param {string} pattern - 匹配模式
   * @param {string} reason - 失效原因
   * @returns {Promise<void>}
   */
  async invalidateCache(namespace, pattern, reason = 'manual') {
    try {
      await cacheService.publish('cache_invalidate', {
        namespace,
        pattern,
        reason,
        timestamp: Date.now()
      });

      logger.info(`[CacheSubscriberService] 触发缓存失效: ${namespace}:${pattern}, 原因: ${reason}`);

    } catch (error) {
      logger.error('[CacheSubscriberService] 触发缓存失效失败', error);
    }
  }

  /**
   * 手动触发版本更新
   * @param {string} namespace - 命名空间
   * @returns {Promise<number>} 新版本号
   */
  async updateVersion(namespace) {
    try {
      const newVersion = await cacheService.incrementVersion(namespace);
      logger.info(`[CacheSubscriberService] 触发版本更新: ${namespace} -> ${newVersion}`);
      return newVersion;

    } catch (error) {
      logger.error('[CacheSubscriberService] 触发版本更新失败', error);
      throw error;
    }
  }

  /**
   * 触发缓存预热
   * @param {string} namespace - 命名空间
   * @param {Array} items - 预热项目
   * @param {string} priority - 优先级
   * @returns {Promise<void>}
   */
  async triggerPreload(namespace, items = [], priority = 'normal') {
    try {
      await cacheService.publish('cache_preload', {
        namespace,
        items,
        priority,
        timestamp: Date.now()
      });

      logger.info(`[CacheSubscriberService] 触发缓存预热: ${namespace}, 项数: ${items.length}`);

    } catch (error) {
      logger.error('[CacheSubscriberService] 触发缓存预热失败', error);
    }
  }

  /**
   * 添加到预热队列
   * @param {string} namespace - 命名空间
   * @param {Array} items - 预热项目
   * @param {string} priority - 优先级
   * @private
   */
  addToPreloadQueue(namespace, items, priority) {
    this.preloadQueue.push({
      namespace,
      items,
      priority,
      addedAt: Date.now()
    });

    // 按优先级排序
    this.preloadQueue.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
    });
  }

  /**
   * 处理预热队列
   * @private
   */
  async processPreloadQueue() {
    if (this.isPreloading || this.preloadQueue.length === 0) {
      return;
    }

    this.isPreloading = true;

    try {
      while (this.preloadQueue.length > 0) {
        const task = this.preloadQueue.shift();
        await this.executePreloadTask(task);
      }

    } catch (error) {
      logger.error('[CacheSubscriberService] 处理预热队列失败', error);
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * 执行预热任务
   * @param {Object} task - 预热任务
   * @private
   */
  async executePreloadTask(task) {
    try {
      const { namespace, items, priority } = task;
      const startTime = Date.now();

      logger.debug(`[CacheSubscriberService] 开始预热: ${namespace}, 优先级: ${priority}`);

      const successCount = await cacheService.preload(items);

      const duration = Date.now() - startTime;
      logger.info(`[CacheSubscriberService] 预热完成: ${namespace}, 成功: ${successCount}/${items.length}, 耗时: ${duration}ms`);

      // 发布预热完成事件
      await cacheService.publish('preload_completed', {
        namespace,
        totalCount: items.length,
        successCount,
        priority,
        duration,
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('[CacheSubscriberService] 执行预热任务失败', error);
    }
  }

  /**
   * 清理指定命名空间的内存缓存
   * @param {string} namespace - 命名空间
   * @private
   */
  async clearMemoryCacheForNamespace(namespace) {
    try {
      // 这里需要访问CacheService的memoryCache
      // 由于是私有属性，我们通过发布一个特殊事件来处理
      await cacheService.publish('clear_memory_cache', {
        namespace,
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error(`[CacheSubscriberService] 清理内存缓存失败: ${namespace}`, error);
    }
  }

  /**
   * 清理匹配模式的内存缓存
   * @param {string} pattern - 匹配模式
   * @private
   */
  async clearMemoryCacheForPattern(pattern) {
    try {
      await cacheService.publish('clear_memory_cache', {
        pattern,
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error(`[CacheSubscriberService] 清理内存缓存失败: ${pattern}`, error);
    }
  }

  /**
   * 处理重连逻辑
   * @private
   */
  async handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('[CacheSubscriberService] 重连次数已达上限，停止重连');
      return;
    }

    this.reconnectAttempts++;
    logger.info(`[CacheSubscriberService] 尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(async () => {
      try {
        await this.start();
      } catch (error) {
        logger.error('[CacheSubscriberService] 重连失败', error);
        this.handleReconnect();
      }
    }, this.reconnectInterval);
  }

  /**
   * 获取订阅服务状态
   * @returns {Object} 状态信息
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      subscriberCount: this.subscribers.size,
      preloadQueueSize: this.preloadQueue.length,
      isPreloading: this.isPreloading,
      reconnectAttempts: this.reconnectAttempts,
      uptime: process.uptime()
    };
  }

  /**
   * 广播健康检查
   * @returns {Promise<void>}
   */
  async broadcastHealthCheck() {
    try {
      await cacheService.publish('health_check', {
        nodeId: process.env.NODE_ID || 'unknown',
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('[CacheSubscriberService] 广播健康检查失败', error);
    }
  }

  /**
   * 定期健康检查
   * @private
   */
  startHealthCheck() {
    setInterval(async () => {
      if (this.isRunning) {
        await this.broadcastHealthCheck();
      }
    }, 30000); // 每30秒检查一次
  }
}

module.exports = new CacheSubscriberService();