const Queue = require('bull');
const Redis = require('ioredis');
const pLimit = require('p-limit');
const logger = require('../utils/logger');

/**
 * 异步队列服务
 *
 * 基于BullMQ和Redis实现任务队列，支持：
 * - 多队列管理
 * - 任务优先级
 * - 延迟任务
 * - 任务重试机制
 * - 并发控制
 * - 任务进度跟踪
 */
class QueueService {
  constructor() {
    // Redis连接配置
    this.redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: process.env.REDIS_DB || 2, // 使用DB2作为队列专用
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100
    };

    // 队列配置
    this.queues = new Map();
    this.processors = new Map();
    this.concurrencyLimits = new Map();

    // 默认并发限制
    this.defaultConcurrency = 5;
    this.maxConcurrency = 20;

    // 并发控制器
    this.concurrencyControllers = new Map();

    // 统计信息
    this.stats = {
      totalQueued: 0,
      totalProcessed: 0,
      totalFailed: 0,
      totalCompleted: 0,
      activeJobs: 0,
      waitingJobs: 0
    };

    // 初始化队列
    this.initializeQueues();
  }

  /**
   * 初始化队列
   * @private
   */
  initializeQueues() {
    try {
      // 创建Redis连接
      const redis = new Redis(this.redisConfig);
      const redisSubscriber = new Redis(this.redisConfig);

      // 任务处理队列
      this.createQueue('task_processing', {
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000
          }
        },
        settings: {
          stalledInterval: 30 * 1000,
          maxStalledCount: 1
        }
      });

      // 图像处理队列
      this.createQueue('image_processing', {
        defaultJobOptions: {
          removeOnComplete: 5,
          removeOnFail: 20,
          attempts: 2,
          backoff: {
            type: 'fixed',
            delay: 5000
          }
        }
      });

      // AI处理队列
      this.createQueue('ai_processing', {
        defaultJobOptions: {
          removeOnComplete: 5,
          removeOnFail: 20,
          attempts: 2,
          backoff: {
            type: 'fixed',
            delay: 10000
          }
        }
      });

      // 通知队列
      this.createQueue('notifications', {
        defaultJobOptions: {
          removeOnComplete: 20,
          removeOnFail: 10,
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 1000
          }
        }
      });

      // 清理队列
      this.createQueue('cleanup', {
        defaultJobOptions: {
          removeOnComplete: 5,
          removeOnFail: 5,
          attempts: 1
        }
      });

      logger.info('[QueueService] 队列初始化完成');

    } catch (error) {
      logger.error('[QueueService] 队列初始化失败', error);
    }
  }

  /**
   * 创建队列
   * @param {string} name - 队列名称
   * @param {Object} options - 队列选项
   * @private
   */
  createQueue(name, options = {}) {
    try {
      const queue = new Queue(name, {
        redis: this.redisConfig,
        defaultJobOptions: options.defaultJobOptions || {},
        settings: options.settings || {}
      });

      // 设置事件监听
      this.setupQueueEvents(queue, name);

      // 创建并发控制器
      this.concurrencyControllers.set(name, pLimit(options.concurrency || this.defaultConcurrency));

      // 保存队列引用
      this.queues.set(name, queue);

      logger.info(`[QueueService] 队列创建成功: ${name}`);

    } catch (error) {
      logger.error(`[QueueService] 队列创建失败: ${name}`, error);
    }
  }

  /**
   * 设置队列事件监听
   * @param {Queue} queue - 队列实例
   * @param {string} name - 队列名称
   * @private
   */
  setupQueueEvents(queue, name) {
    // 任务完成
    queue.on('completed', (job, result) => {
      this.stats.totalCompleted++;
      this.stats.activeJobs--;
      logger.debug(`[QueueService] 任务完成: ${name}:${job.id}`, {
        jobId: job.id,
        data: job.data,
        result
      });
    });

    // 任务失败
    queue.on('failed', (job, error) => {
      this.stats.totalFailed++;
      this.stats.activeJobs--;
      logger.error(`[QueueService] 任务失败: ${name}:${job.id}`, {
        jobId: job.id,
        data: job.data,
        error: error.message,
        attemptsMade: job.attemptsMade,
        attemptsLeft: job.opts.attempts - job.attemptsMade
      });
    });

    // 任务进入活动状态
    queue.on('active', (job) => {
      this.stats.activeJobs++;
      logger.debug(`[QueueService] 任务开始处理: ${name}:${job.id}`, {
        jobId: job.id,
        data: job.data
      });
    });

    // 任务进入等待状态
    queue.on('waiting', (jobId) => {
      this.stats.waitingJobs++;
      logger.debug(`[QueueService] 任务进入等待: ${name}:${jobId}`);
    });

    // 任务停滞
    queue.on('stalled', (job) => {
      logger.warn(`[QueueService] 任务停滞: ${name}:${job.id}`, {
        jobId: job.id,
        data: job.data
      });
    });

    // 队列错误
    queue.on('error', (error) => {
      logger.error(`[QueueService] 队列错误: ${name}`, error);
    });

    // 队列暂停
    queue.on('paused', () => {
      logger.info(`[QueueService] 队列已暂停: ${name}`);
    });

    // 队列恢复
    queue.on('resumed', () => {
      logger.info(`[QueueService] 队列已恢复: ${name}`);
    });
  }

  /**
   * 添加任务到队列
   * @param {string} queueName - 队列名称
   * @param {string} jobName - 任务名称
   * @param {Object} data - 任务数据
   * @param {Object} options - 任务选项
   * @returns {Promise<Job>} 任务实例
   */
  async addJob(queueName, jobName, data, options = {}) {
    try {
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`队列不存在: ${queueName}`);
      }

      // 默认选项
      const defaultOptions = {
        priority: 0,
        delay: 0,
        attempts: 3,
        removeOnComplete: 10,
        removeOnFail: 50
      };

      const jobOptions = { ...defaultOptions, ...options };

      const job = await queue.add(jobName, data, jobOptions);
      this.stats.totalQueued++;

      logger.info(`[QueueService] 任务已添加: ${queueName}:${job.id}`, {
        jobId: job.id,
        jobName,
        data,
        options: jobOptions
      });

      return job;

    } catch (error) {
      logger.error(`[QueueService] 添加任务失败: ${queueName}`, error);
      throw error;
    }
  }

  /**
   * 添加延迟任务
   * @param {string} queueName - 队列名称
   * @param {string} jobName - 任务名称
   * @param {Object} data - 任务数据
   * @param {number} delayMs - 延迟时间（毫秒）
   * @param {Object} options - 任务选项
   * @returns {Promise<Job>} 任务实例
   */
  async addDelayedJob(queueName, jobName, data, delayMs, options = {}) {
    return this.addJob(queueName, jobName, data, {
      ...options,
      delay: delayMs
    });
  }

  /**
   * 添加高优先级任务
   * @param {string} queueName - 队列名称
   * @param {string} jobName - 任务名称
   * @param {Object} data - 任务数据
   * @param {Object} options - 任务选项
   * @returns {Promise<Job>} 任务实例
   */
  async addHighPriorityJob(queueName, jobName, data, options = {}) {
    return this.addJob(queueName, jobName, data, {
      ...options,
      priority: 10
    });
  }

  /**
   * 批量添加任务
   * @param {string} queueName - 队列名称
   * @param {Array} jobs - 任务列表 [{name, data, options}]
   * @returns {Promise<Array>} 任务实例列表
   */
  async addBulkJobs(queueName, jobs) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`队列不存在: ${queueName}`);
    }

    const bulkJobs = jobs.map(job => ({
      name: job.name,
      data: job.data,
      opts: job.options || {}
    }));

    const addedJobs = await queue.addBulk(bulkJobs);
    this.stats.totalQueued += addedJobs.length;

    logger.info(`[QueueService] 批量添加任务: ${queueName}, 数量: ${addedJobs.length}`);

    return addedJobs;
  }

  /**
   * 注册任务处理器
   * @param {string} queueName - 队列名称
   * @param {string} jobName - 任务名称
   * @param {Function} processor - 处理函数
   * @param {Object} options - 处理器选项
   */
  registerProcessor(queueName, jobName, processor, options = {}) {
    try {
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`队列不存在: ${queueName}`);
      }

      const concurrency = options.concurrency || this.defaultConcurrency;
      const concurrencyController = this.concurrencyControllers.get(queueName);

      // 处理器包装函数
      const wrappedProcessor = async (job) => {
        try {
          logger.debug(`[QueueService] 开始处理任务: ${queueName}:${job.id}:${jobName}`);

          const startTime = Date.now();
          const result = await concurrencyController(() => processor(job));
          const duration = Date.now() - startTime;

          this.stats.totalProcessed++;

          logger.info(`[QueueService] 任务处理成功: ${queueName}:${job.id}:${jobName}`, {
            jobId: job.id,
            duration: `${duration}ms`,
            result: typeof result === 'object' ? 'object' : result
          });

          return result;

        } catch (error) {
          logger.error(`[QueueService] 任务处理失败: ${queueName}:${job.id}:${jobName}`, {
            jobId: job.id,
            error: error.message,
            stack: error.stack
          });
          throw error;
        }
      };

      // 注册处理器
      queue.process(jobName, concurrency, wrappedProcessor);

      // 保存处理器信息
      const processorKey = `${queueName}:${jobName}`;
      this.processors.set(processorKey, {
        processor: wrappedProcessor,
        concurrency,
        options
      });

      logger.info(`[QueueService] 处理器注册成功: ${processorKey}, 并发: ${concurrency}`);

    } catch (error) {
      logger.error(`[QueueService] 处理器注册失败: ${queueName}:${jobName}`, error);
    }
  }

  /**
   * 注册通用处理器（处理所有任务）
   * @param {string} queueName - 队列名称
   * @param {Function} processor - 处理函数
   * @param {Object} options - 处理器选项
   */
  registerUniversalProcessor(queueName, processor, options = {}) {
    try {
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`队列不存在: ${queueName}`);
      }

      const concurrency = options.concurrency || this.defaultConcurrency;
      const concurrencyController = this.concurrencyControllers.get(queueName);

      const wrappedProcessor = async (job) => {
        try {
          logger.debug(`[QueueService] 开始处理任务: ${queueName}:${job.id}`);

          const startTime = Date.now();
          const result = await concurrencyController(() => processor(job));
          const duration = Date.now() - startTime;

          this.stats.totalProcessed++;

          logger.info(`[QueueService] 通用处理器完成任务: ${queueName}:${job.id}`, {
            jobId: job.id,
            jobName: job.name,
            duration: `${duration}ms`
          });

          return result;

        } catch (error) {
          logger.error(`[QueueService] 通用处理器失败: ${queueName}:${job.id}`, {
            jobId: job.id,
            error: error.message
          });
          throw error;
        }
      };

      queue.process(concurrency, wrappedProcessor);

      logger.info(`[QueueService] 通用处理器注册成功: ${queueName}, 并发: ${concurrency}`);

    } catch (error) {
      logger.error(`[QueueService] 通用处理器注册失败: ${queueName}`, error);
    }
  }

  /**
   * 获取任务状态
   * @param {string} queueName - 队列名称
   * @param {string} jobId - 任务ID
   * @returns {Promise<Object>} 任务状态
   */
  async getJobStatus(queueName, jobId) {
    try {
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`队列不存在: ${queueName}`);
      }

      const job = await queue.getJob(jobId);
      if (!job) {
        return { exists: false };
      }

      const state = await job.getState();
      const progress = job.progress();

      return {
        exists: true,
        id: job.id,
        name: job.name,
        data: job.data,
        state,
        progress,
        createdAt: new Date(job.timestamp),
        processedOn: job.processedOn ? new Date(job.processedOn) : null,
        finishedOn: job.finishedOn ? new Date(job.finishedOn) : null,
        attemptsMade: job.attemptsMade,
        opts: job.opts
      };

    } catch (error) {
      logger.error(`[QueueService] 获取任务状态失败: ${queueName}:${jobId}`, error);
      throw error;
    }
  }

  /**
   * 获取队列统计信息
   * @param {string} queueName - 队列名称
   * @returns {Promise<Object>} 队列统计
   */
  async getQueueStats(queueName) {
    try {
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`队列不存在: ${queueName}`);
      }

      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
        queue.getDelayed()
      ]);

      return {
        queueName,
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        total: waiting.length + active.length + completed.length + failed.length + delayed.length
      };

    } catch (error) {
      logger.error(`[QueueService] 获取队列统计失败: ${queueName}`, error);
      throw error;
    }
  }

  /**
   * 获取所有队列统计
   * @returns {Promise<Object>} 所有队列统计
   */
  async getAllQueueStats() {
    try {
      const queueNames = Array.from(this.queues.keys());
      const stats = {};

      for (const queueName of queueNames) {
        try {
          stats[queueName] = await this.getQueueStats(queueName);
        } catch (error) {
          logger.warn(`[QueueService] 获取队列统计失败: ${queueName}`, error);
          stats[queueName] = { error: error.message };
        }
      }

      return {
        queues: stats,
        global: this.stats,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('[QueueService] 获取所有队列统计失败', error);
      throw error;
    }
  }

  /**
   * 暂停队列
   * @param {string} queueName - 队列名称
   * @returns {Promise<void>}
   */
  async pauseQueue(queueName) {
    try {
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`队列不存在: ${queueName}`);
      }

      await queue.pause();
      logger.info(`[QueueService] 队列已暂停: ${queueName}`);

    } catch (error) {
      logger.error(`[QueueService] 暂停队列失败: ${queueName}`, error);
      throw error;
    }
  }

  /**
   * 恢复队列
   * @param {string} queueName - 队列名称
   * @returns {Promise<void>}
   */
  async resumeQueue(queueName) {
    try {
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`队列不存在: ${queueName}`);
      }

      await queue.resume();
      logger.info(`[QueueService] 队列已恢复: ${queueName}`);

    } catch (error) {
      logger.error(`[QueueService] 恢复队列失败: ${queueName}`, error);
      throw error;
    }
  }

  /**
   * 清空队列
   * @param {string} queueName - 队列名称
   * @returns {Promise<void>}
   */
  async cleanQueue(queueName) {
    try {
      const queue = this.queues.get(queueName);
      if (!queue) {
        throw new Error(`队列不存在: ${queueName}`);
      }

      await queue.clean(0, 'completed');
      await queue.clean(0, 'failed');

      logger.info(`[QueueService] 队列已清空: ${queueName}`);

    } catch (error) {
      logger.error(`[QueueService] 清空队列失败: ${queueName}`, error);
      throw error;
    }
  }

  /**
   * 关闭队列服务
   * @returns {Promise<void>}
   */
  async close() {
    try {
      const closePromises = Array.from(this.queues.values()).map(queue => queue.close());
      await Promise.all(closePromises);

      this.queues.clear();
      this.processors.clear();
      this.concurrencyControllers.clear();

      logger.info('[QueueService] 队列服务已关闭');

    } catch (error) {
      logger.error('[QueueService] 关闭队列服务失败', error);
    }
  }

  /**
   * 健康检查
   * @returns {Promise<Object>} 健康状态
   */
  async healthCheck() {
    try {
      const queueStats = await this.getAllQueueStats();
      const activeQueues = Object.keys(queueStats.queues).length;
      const totalJobs = Object.values(queueStats.queues).reduce(
        (sum, stats) => sum + (stats.total || 0), 0
      );

      return {
        status: 'healthy',
        activeQueues,
        totalJobs,
        globalStats: this.stats,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('[QueueService] 健康检查失败', error);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 设置队列并发限制
   * @param {string} queueName - 队列名称
   * @param {number} concurrency - 并发数
   * @returns {void}
   */
  setConcurrencyLimit(queueName, concurrency) {
    const limitedConcurrency = Math.min(Math.max(concurrency, 1), this.maxConcurrency);
    this.concurrencyLimits.set(queueName, limitedConcurrency);

    // 更新并发控制器
    this.concurrencyControllers.set(queueName, pLimit(limitedConcurrency));

    logger.info(`[QueueService] 设置并发限制: ${queueName} -> ${limitedConcurrency}`);
  }

  /**
   * 获取队列并发限制
   * @param {string} queueName - 队列名称
   * @returns {number} 并发限制
   */
  getConcurrencyLimit(queueName) {
    return this.concurrencyLimits.get(queueName) || this.defaultConcurrency;
  }
}

module.exports = new QueueService();