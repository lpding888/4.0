import { Queue, QueueEvents, type JobsOptions, type BulkJobOptions, Worker, Job } from 'bullmq';
import { Redis as IORedis } from 'ioredis';
import pLimit from 'p-limit';
import logger from '../utils/logger.js';
import type { QueuesHealthReport } from './health.service.js';
import { bullJobDefaults, bullQueueSettings, createBullConnection } from '../config/bullmq.js';
import metricsService from './metrics.service.js';

interface JobData {
  [key: string]: unknown;
}

type ProcessorFn = (job: Job<JobData>) => Promise<unknown> | unknown;

interface ProcessorEntry {
  processor: ProcessorFn;
  concurrency: number;
  options?: Record<string, unknown>;
}

class QueueService {
  private queues = new Map<string, Queue>();
  private queueEvents = new Map<string, QueueEvents>();
  private workers = new Map<string, Worker>();
  private processors = new Map<string, ProcessorEntry>(); // key: `${queue}:${jobName}`
  private universalProcessor = new Map<string, ProcessorEntry>(); // key: queueName
  private concurrencyControllers = new Map<string, ReturnType<typeof pLimit>>(); // per-queue control
  private concurrencyLimits = new Map<string, number>();
  private queueMetricsTimer?: NodeJS.Timeout;

  private defaultConcurrency = 5;
  private maxConcurrency = 20;

  public stats = {
    totalQueued: 0,
    totalProcessed: 0,
    totalFailed: 0,
    totalCompleted: 0,
    activeJobs: 0,
    waitingJobs: 0
  };

  constructor() {
    this.initializeQueues();
  }

  private buildConnection(role: string, queueName: string): IORedis {
    return createBullConnection({
      connectionName: `${bullQueueSettings.prefix}:${queueName}:${role}`
    });
  }

  private mergeJobDefaults(overrides?: JobsOptions): JobsOptions {
    return {
      ...bullJobDefaults,
      ...overrides,
      removeOnComplete: overrides?.removeOnComplete ?? bullJobDefaults.removeOnComplete,
      removeOnFail: overrides?.removeOnFail ?? bullJobDefaults.removeOnFail,
      attempts: overrides?.attempts ?? bullJobDefaults.attempts,
      backoff: overrides?.backoff ?? bullJobDefaults.backoff
    };
  }

  private ensureQueueInfrastructure(queueName: string, opts?: { defaultJobOptions?: JobsOptions }) {
    if (this.queues.has(queueName)) {
      return;
    }

    const defaultJobOptions = this.mergeJobDefaults(opts?.defaultJobOptions);
    const queue = new Queue(queueName, {
      connection: this.buildConnection('queue', queueName),
      defaultJobOptions,
      prefix: bullQueueSettings.prefix
    });

    const events = new QueueEvents(queueName, {
      connection: this.buildConnection('events', queueName),
      prefix: bullQueueSettings.prefix
    });

    events.on('completed', ({ jobId }) => {
      this.stats.totalCompleted++;
      this.stats.activeJobs = Math.max(0, this.stats.activeJobs - 1);
      logger.debug(`[QueueService] 任务完成: ${queueName}:${jobId}`);
    });

    events.on('failed', ({ jobId, failedReason }) => {
      this.stats.totalFailed++;
      this.stats.activeJobs = Math.max(0, this.stats.activeJobs - 1);
      logger.error(`[QueueService] 任务失败: ${queueName}:${jobId}`, { failedReason });
    });

    // Note: QueueScheduler已在BullMQ v5中移除，延迟任务现由Queue自动处理

    this.queues.set(queueName, queue);
    this.queueEvents.set(queueName, events);

    if (!this.concurrencyControllers.has(queueName)) {
      this.concurrencyControllers.set(queueName, pLimit(this.getConcurrencyLimit(queueName)));
    }

    const worker = new Worker(
      queueName,
      async (job) => {
        const procKey = `${queueName}:${job.name}`;
        const entry = this.processors.get(procKey) || this.universalProcessor.get(queueName);
        if (!entry) {
          logger.warn(`[QueueService] 未注册处理器: ${procKey}`);
          return;
        }
        const limiter = this.concurrencyControllers.get(queueName)!;
        const start = Date.now();
        try {
          this.stats.activeJobs++;
          const result = await limiter(() => entry.processor(job));
          const duration = Date.now() - start;
          this.stats.totalProcessed++;
          const metricTaskType = `${queueName}:${job.name}`;
          metricsService.recordTaskCompleted(metricTaskType, duration / 1000);
          logger.info(`[QueueService] 任务完成: ${queueName}:${job.id}:${job.name}`, {
            duration
          });
          return result;
        } catch (error: unknown) {
          const err = error as Error;
          metricsService.recordTaskFailed(`${queueName}:${job.name}`, err?.name ?? 'error');
          logger.error(`[QueueService] 任务处理失败: ${queueName}:${job.id}:${job.name}`, {
            error: err?.message
          });
          throw error;
        }
      },
      {
        concurrency: this.getConcurrencyLimit(queueName),
        connection: this.buildConnection('worker', queueName),
        prefix: bullQueueSettings.prefix
      }
    );

    this.workers.set(queueName, worker);
    this.startQueueMetricsCollector();
    void this.updateQueueMetrics(queueName, queue);
    logger.info(`[QueueService] 队列创建成功: ${queueName}`);
  }

  private startQueueMetricsCollector(): void {
    if (this.queueMetricsTimer) {
      return;
    }
    this.queueMetricsTimer = setInterval(() => {
      void this.collectQueueMetrics();
    }, 15000);
    this.queueMetricsTimer.unref?.();
  }

  private async collectQueueMetrics(): Promise<void> {
    await Promise.all(
      Array.from(this.queues.entries()).map(([name, queue]) => this.updateQueueMetrics(name, queue))
    );
  }

  private async updateQueueMetrics(queueName: string, queue?: Queue): Promise<void> {
    const targetQueue = queue ?? this.queues.get(queueName);
    if (!targetQueue) {
      return;
    }
    try {
      const counts = await targetQueue.getJobCounts(
        'active',
        'waiting',
        'completed',
        'failed',
        'delayed',
        'paused'
      );
      metricsService.setQueueStats(queueName, {
        active: counts.active ?? 0,
        waiting: counts.waiting ?? 0,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        delayed: counts.delayed ?? 0,
        paused: counts.paused ?? 0
      });
    } catch (error) {
      logger.warn(`[QueueService] 队列指标更新失败: ${queueName}`, error);
    }
  }

  private initializeQueues() {
    try {
      // 与旧实现保持一致的默认队列集合
      this.createQueue('task_processing', {
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 50,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 }
        }
      });
      this.createQueue('image_processing', {
        defaultJobOptions: {
          removeOnComplete: 5,
          removeOnFail: 20,
          attempts: 2,
          backoff: { type: 'fixed', delay: 5000 }
        }
      });
      this.createQueue('ai_processing', {
        defaultJobOptions: {
          removeOnComplete: 5,
          removeOnFail: 20,
          attempts: 2,
          backoff: { type: 'fixed', delay: 10000 }
        }
      });
      this.createQueue('notifications', {
        defaultJobOptions: {
          removeOnComplete: 20,
          removeOnFail: 10,
          attempts: 5,
          backoff: { type: 'exponential', delay: 1000 }
        }
      });
      this.createQueue('cleanup', {
        defaultJobOptions: {
          removeOnComplete: 5,
          removeOnFail: 5,
          attempts: 1
        }
      });
    } catch (error) {
      logger.error('[QueueService] 队列初始化失败', error);
    }
  }

  public createQueue(name: string, options?: { defaultJobOptions?: JobsOptions }) {
    this.ensureQueueInfrastructure(name, { defaultJobOptions: options?.defaultJobOptions });
  }

  public async addJob(
    queueName: string,
    jobName: string,
    data: JobData,
    options: JobsOptions = {}
  ) {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`队列不存在: ${queueName}`);
    const jobOptions = this.mergeJobDefaults({
      priority: 0,
      delay: 0,
      ...options
    });
    const job = await queue.add(jobName, data, jobOptions);
    this.stats.totalQueued++;
    metricsService.recordTaskCreated(`${queueName}:${jobName}`);
    void this.updateQueueMetrics(queueName, queue);
    logger.info(`[QueueService] 任务已添加: ${queueName}:${job.id}`, { jobName });
    return job;
  }

  public async addDelayedJob(
    queueName: string,
    jobName: string,
    data: JobData,
    delayMs: number,
    options: JobsOptions = {}
  ) {
    return this.addJob(queueName, jobName, data, { ...options, delay: delayMs });
  }

  public async addHighPriorityJob(
    queueName: string,
    jobName: string,
    data: JobData,
    options: JobsOptions = {}
  ) {
    return this.addJob(queueName, jobName, data, { ...options, priority: 10 });
  }

  public async addBulkJobs(
    queueName: string,
    jobs: Array<{ name: string; data: JobData; options?: JobsOptions }>
  ) {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`队列不存在: ${queueName}`);
    const bulk: Array<{ name: string; data: JobData; opts: JobsOptions }> = jobs.map((j) => ({
      name: j.name,
      data: j.data,
      opts: j.options || {}
    }));
    const added = await queue.addBulk(bulk);
    this.stats.totalQueued += added.length;
    logger.info(`[QueueService] 批量添加任务: ${queueName}, 数量: ${added.length}`);
    return added;
  }

  public registerProcessor(
    queueName: string,
    jobName: string,
    processor: ProcessorFn,
    options: { concurrency?: number } = {}
  ) {
    this.ensureQueueInfrastructure(queueName);
    const concurrency = options.concurrency || this.defaultConcurrency;
    this.concurrencyLimits.set(queueName, concurrency);
    this.concurrencyControllers.set(queueName, pLimit(concurrency));
    const key = `${queueName}:${jobName}`;
    this.processors.set(key, { processor, concurrency, options });
    logger.info(`[QueueService] 处理器注册成功: ${key}, 并发: ${concurrency}`);
  }

  public registerUniversalProcessor(
    queueName: string,
    processor: ProcessorFn,
    options: { concurrency?: number } = {}
  ) {
    this.ensureQueueInfrastructure(queueName);
    const concurrency = options.concurrency || this.defaultConcurrency;
    this.concurrencyLimits.set(queueName, concurrency);
    this.concurrencyControllers.set(queueName, pLimit(concurrency));
    this.universalProcessor.set(queueName, { processor, concurrency, options });
    logger.info(`[QueueService] 通用处理器注册成功: ${queueName}, 并发: ${concurrency}`);
  }

  public async getJobStatus(queueName: string, jobId: string) {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`队列不存在: ${queueName}`);
    const job = await queue.getJob(jobId);
    if (!job) return { exists: false };
    const state = await job.getState();
    const jobWithProgress = job as Job<JobData> & { progress?: number };
    const progress = jobWithProgress.progress ?? 0;
    return {
      exists: true,
      id: job.id,
      name: job.name,
      data: job.data,
      state,
      progress,
      createdAt: job.timestamp ? new Date(job.timestamp) : null,
      processedOn: job.processedOn ? new Date(job.processedOn) : null,
      finishedOn: job.finishedOn ? new Date(job.finishedOn) : null,
      attemptsMade: job.attemptsMade,
      opts: job.opts
    };
  }

  public async getQueueStats(queueName: string) {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`队列不存在: ${queueName}`);
    const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
    return {
      queueName,
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
      total:
        (counts.waiting ?? 0) +
        (counts.active ?? 0) +
        (counts.completed ?? 0) +
        (counts.failed ?? 0) +
        (counts.delayed ?? 0)
    };
  }

  public async getAllQueueStats() {
    const names = Array.from(this.queues.keys());
    const stats: Record<string, unknown> = {};
    for (const name of names) {
      try {
        stats[name] = await this.getQueueStats(name);
      } catch (e: unknown) {
        const err = e as Error;
        logger.warn(`[QueueService] 获取队列统计失败: ${name}`, e);
        stats[name] = { error: err?.message };
      }
    }
    return { queues: stats, global: this.stats, timestamp: new Date().toISOString() };
  }

  public async pauseQueue(queueName: string) {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`队列不存在: ${queueName}`);
    await queue.pause();
    logger.info(`[QueueService] 队列已暂停: ${queueName}`);
  }

  public async resumeQueue(queueName: string) {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`队列不存在: ${queueName}`);
    await queue.resume();
    logger.info(`[QueueService] 队列已恢复: ${queueName}`);
  }

  public async cleanQueue(queueName: string) {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`队列不存在: ${queueName}`);
    // BullMQ 建议使用 drain + removeJobs pattern
    await queue.drain(true);
    logger.info(`[QueueService] 队列已清空: ${queueName}`);
  }

  public async close() {
    try {
      await Promise.all(
        Array.from(this.workers.values()).map(async (w) => {
          try {
            await w.close();
          } catch {}
        })
      );
      await Promise.all(
        Array.from(this.queueEvents.values()).map(async (e) => {
          try {
            await e.close();
          } catch {}
        })
      );
      await Promise.all(
        Array.from(this.queues.values()).map(async (q) => {
          try {
            await q.close();
          } catch {}
        })
      );
      this.workers.clear();
      this.queueEvents.clear();
      this.queues.clear();
      this.processors.clear();
      this.concurrencyControllers.clear();
      logger.info('[QueueService] 队列服务已关闭');
    } catch (error) {
      logger.error('[QueueService] 关闭队列服务失败', error);
    }
  }

  public async healthCheck(): Promise<QueuesHealthReport> {
    try {
      const queueStats = await this.getAllQueueStats();
      const activeQueues = Object.keys(queueStats.queues).length;
      interface QueueStatsEntry {
        total?: number;
      }
      const totalJobs = Object.values(queueStats.queues as Record<string, QueueStatsEntry>).reduce(
        (sum: number, s: QueueStatsEntry) => sum + (s.total || 0),
        0
      );
      return {
        status: 'healthy',
        activeQueues,
        totalJobs,
        globalStats: this.stats,
        timestamp: new Date().toISOString()
      };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('[QueueService] 健康检查失败', error);
      return {
        status: 'unhealthy',
        error: err?.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  public setConcurrencyLimit(queueName: string, concurrency: number) {
    const limited = Math.min(Math.max(concurrency, 1), this.maxConcurrency);
    this.concurrencyLimits.set(queueName, limited);
    this.concurrencyControllers.set(queueName, pLimit(limited));
    logger.info(`[QueueService] 设置并发限制: ${queueName} -> ${limited}`);
  }

  public getConcurrencyLimit(queueName: string) {
    return this.concurrencyLimits.get(queueName) ?? this.defaultConcurrency;
  }
}

export default new QueueService();
