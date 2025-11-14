import logger from '../utils/logger.js';
import websocketService from './websocket.service.js';
import { db } from '../config/database.js';
import cacheService from './cache.service.js';

type AnyObject = Record<string, unknown>;

type TaskProgressPayload = {
  percentage: number;
  currentStep: string;
  totalSteps: number;
  message: string;
  eta: unknown;
  details: AnyObject;
  timestamp: number;
};

type PushQueueItem = {
  taskId: string;
  progress: TaskProgressPayload;
  source: string;
  timestamp: number;
  targetUsers?: string[];
};

type UpdateProgressOptions = {
  force?: boolean;
  source?: string;
};

type OfflineMessage = {
  type: string;
  data: AnyObject;
  timestamp: number;
};

type OfflineMessagePayload = Omit<OfflineMessage, 'timestamp'>;

type TaskProgressStats = {
  totalPushes: number;
  successfulPushes: number;
  failedPushes: number;
  offlinePushes: number;
  batchPushes: number;
  subscribers: number;
  lastReset: number;
};

type TaskProgressConfig = {
  minProgressInterval: number;
  maxOfflineMessages: number;
  offlineMessageTTL: number;
  progressCacheTTL: number;
  subscriptionTTL: number;
  batchPush: boolean;
  batchInterval: number;
  retryAttempts: number;
  retryDelay: number;
};

/**
 * 任务进度推送服务
 *
 * 管理任务进度的实时推送：
 * - 进度更新推送
 * - 状态变更通知
 * - 多客户端同步
 * - 离线消息缓存
 * - 推送历史记录
 */
class TaskProgressService {
  private initialized = false;

  private progressCache: Map<string, TaskProgressPayload>;

  private subscribers: Map<string, Set<string>>;

  private offlineMessages: Map<string, OfflineMessage[]>;

  private config: TaskProgressConfig;

  private stats: TaskProgressStats;

  private pushQueue: PushQueueItem[];

  private batchTimer: NodeJS.Timeout | null;

  constructor() {
    this.progressCache = new Map();
    this.subscribers = new Map();
    this.offlineMessages = new Map();

    this.config = {
      // 推送频率限制
      minProgressInterval: 1000, // 最小推送间隔1秒
      maxOfflineMessages: 100, // 最大离线消息数
      offlineMessageTTL: 7 * 24 * 60 * 60 * 1000, // 7天

      // 缓存配置
      progressCacheTTL: 30 * 60 * 1000, // 30分钟
      subscriptionTTL: 60 * 60 * 1000, // 1小时

      // 推送策略
      batchPush: true,
      batchInterval: 500, // 500ms批量推送
      retryAttempts: 3,
      retryDelay: 1000
    };

    // 统计信息
    this.stats = {
      totalPushes: 0,
      successfulPushes: 0,
      failedPushes: 0,
      offlinePushes: 0,
      batchPushes: 0,
      subscribers: 0,
      lastReset: Date.now()
    };

    // 批量推送队列
    this.pushQueue = [];
    this.batchTimer = null;
  }

  /**
   * 初始化任务进度推送服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('[TaskProgress] 任务进度推送服务已初始化');
      return;
    }

    try {
      // 确保WebSocket服务已初始化
      if (!websocketService.initialized) {
        logger.warn('[TaskProgress] WebSocket服务未初始化，将使用离线模式');
      }

      // 启动批量推送定时器
      this.startBatchPusher();

      this.initialized = true;
      logger.info('[TaskProgress] 任务进度推送服务初始化成功');
    } catch (error) {
      logger.error('[TaskProgress] 服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 订阅任务进度
   * @param {string} userId - 用户ID
   * @param {string} taskId - 任务ID
   * @returns {Promise<boolean>} 是否订阅成功
   */
  async subscribeTaskProgress(userId: string, taskId: string): Promise<boolean> {
    try {
      // 验证任务是否属于用户
      const hasAccess = await this.verifyTaskAccess(userId, taskId);
      if (!hasAccess) {
        logger.warn(`[TaskProgress] 用户无权订阅任务进度: userId=${userId}, taskId=${taskId}`);
        return false;
      }

      // 添加到订阅列表
      let subscribers = this.subscribers.get(taskId);
      if (!subscribers) {
        subscribers = new Set<string>();
        this.subscribers.set(taskId, subscribers);
      }
      subscribers.add(userId);

      // 缓存订阅关系
      const cacheKey = `task_progress_subscription:${userId}:${taskId}`;
      await cacheService.set(cacheKey, true, this.config.subscriptionTTL);

      // 如果任务已有进度，立即推送
      const cachedProgress = this.progressCache.get(taskId);
      if (cachedProgress) {
        await this.pushProgressToUser(userId, taskId, cachedProgress);
      }

      logger.info(`[TaskProgress] 用户订阅任务进度: userId=${userId}, taskId=${taskId}`);
      return true;
    } catch (error) {
      logger.error(`[TaskProgress] 订阅任务进度失败: userId=${userId}, taskId=${taskId}`, error);
      return false;
    }
  }

  /**
   * 取消订阅任务进度
   * @param {string} userId - 用户ID
   * @param {string} taskId - 任务ID
   * @returns {Promise<boolean>} 是否取消成功
   */
  async unsubscribeTaskProgress(userId: string, taskId: string): Promise<boolean> {
    try {
      const taskSubscribers = this.subscribers.get(taskId);
      if (taskSubscribers) {
        taskSubscribers.delete(userId);
        if (taskSubscribers.size === 0) {
          this.subscribers.delete(taskId);
        }
      }

      // 删除缓存
      const cacheKey = `task_progress_subscription:${userId}:${taskId}`;
      await cacheService.delete(cacheKey);

      logger.info(`[TaskProgress] 用户取消订阅: userId=${userId}, taskId=${taskId}`);
      return true;
    } catch (error) {
      logger.error(`[TaskProgress] 取消订阅失败: userId=${userId}, taskId=${taskId}`, error);
      return false;
    }
  }

  /**
   * 更新任务进度
   * @param {string} taskId - 任务ID
   * @param {Object} progressData - 进度数据
   * @param {Object} options - 更新选项
   */
  async updateTaskProgress(
    taskId: string,
    progressData: AnyObject,
    options: UpdateProgressOptions = {}
  ): Promise<boolean> {
    try {
      const {
        force = false,
        source = 'system' // progress, status_change, system
      } = options;

      // 验证进度数据
      const validatedProgress = this.validateProgressData(progressData);
      if (!validatedProgress) {
        logger.warn(`[TaskProgress] 无效的进度数据: taskId=${taskId}`);
        return false;
      }

      // 检查是否需要推送
      const currentProgress = this.progressCache.get(taskId);
      const shouldPush = force || this.shouldPushProgress(currentProgress, validatedProgress);

      if (!shouldPush) {
        return false;
      }

      // 更新缓存
      this.progressCache.set(taskId, validatedProgress);
      const cacheKey = `task_progress:${taskId}`;
      await cacheService.set(
        cacheKey,
        JSON.stringify(validatedProgress),
        this.config.progressCacheTTL
      );

      // 添加到推送队列
      this.queuePush(taskId, validatedProgress, source);

      logger.debug(
        `[TaskProgress] 任务进度更新: taskId=${taskId}, progress=${validatedProgress.percentage}%`
      );
      return true;
    } catch (error) {
      logger.error(`[TaskProgress] 更新任务进度失败: taskId=${taskId}`, error);
      return false;
    }
  }

  /**
   * 推送任务状态变更
   * @param {string} taskId - 任务ID
   * @param {string} newStatus - 新状态
   * @param {Object} extraData - 额外数据
   */
  async pushTaskStatusChange(
    taskId: string,
    newStatus: string,
    extraData: AnyObject = {}
  ): Promise<boolean> {
    try {
      // 获取任务信息
      const task = await db('tasks').where('id', taskId).first();
      if (!task) {
        logger.warn(`[TaskProgress] 任务不存在: ${taskId}`);
        return false;
      }

      // 构建状态变更消息
      const statusMessage = {
        taskId,
        userId: task.user_id,
        oldStatus: task.status,
        newStatus,
        timestamp: Date.now(),
        ...extraData
      };

      // 获取订阅者
      const subscribers = this.subscribers.get(taskId) || new Set();

      // 如果任务没有订阅者，添加任务所有者
      if (subscribers.size === 0) {
        subscribers.add(task.user_id);
      }

      // 推送给所有订阅者
      let successCount = 0;
      for (const userId of subscribers) {
        try {
          // 使用WebSocket服务推送
          const sent = websocketService.pushTaskStatusChange(
            userId,
            taskId,
            newStatus,
            statusMessage
          );
          if (sent > 0) {
            successCount++;
          } else {
            // 用户离线，添加到离线消息
            this.addOfflineMessage(userId, {
              type: 'task_status_change',
              data: statusMessage
            });
          }
        } catch (error) {
          logger.error(
            `[TaskProgress] 推送状态变更失败: userId=${userId}, taskId=${taskId}`,
            error
          );
        }
      }

      // 更新统计
      this.stats.totalPushes++;
      this.stats.successfulPushes += successCount;

      logger.info(
        `[TaskProgress] 任务状态变更推送完成: taskId=${taskId}, status=${newStatus}, sent=${successCount}`
      );
      return successCount > 0;
    } catch (error) {
      logger.error(`[TaskProgress] 推送任务状态变更失败: taskId=${taskId}`, error);
      this.stats.failedPushes++;
      return false;
    }
  }

  /**
   * 获取任务进度
   * @param {string} taskId - 任务ID
   * @returns {Object|null} 进度数据
   */
  getTaskProgress(taskId: string): AnyObject | null {
    return this.progressCache.get(taskId) || null;
  }

  /**
   * 获取用户订阅的任务列表
   * @param {string} userId - 用户ID
   * @returns {string[]} 任务ID列表
   */
  async getUserSubscribedTasks(userId: string): Promise<string[]> {
    const subscribedTasks = [];

    for (const [taskId, subscribers] of this.subscribers) {
      if (subscribers.has(userId)) {
        subscribedTasks.push(taskId);
      }
    }

    return subscribedTasks;
  }

  /**
   * 清理过期数据
   */
  async cleanupExpiredData(): Promise<number> {
    try {
      const now = Date.now();
      let cleanedCount = 0;

      // 清理过期的进度缓存
      for (const [taskId, progress] of this.progressCache) {
        if (now - progress.timestamp > this.config.progressCacheTTL) {
          this.progressCache.delete(taskId);
          cleanedCount++;

          // 删除数据库缓存
          await cacheService.delete(`task_progress:${taskId}`);
        }
      }

      // 清理过期的离线消息
      for (const [userId, messages] of this.offlineMessages) {
        const validMessages = messages.filter(
          (msg) => now - msg.timestamp < this.config.offlineMessageTTL
        );

        if (validMessages.length !== messages.length) {
          this.offlineMessages.set(userId, validMessages);
          cleanedCount += messages.length - validMessages.length;
        }
      }

      logger.info(`[TaskProgress] 清理过期数据完成: ${cleanedCount}条`);
      return cleanedCount;
    } catch (error) {
      logger.error('[TaskProgress] 清理过期数据失败:', error);
      return 0;
    }
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const now = Date.now();
    const uptime = now - this.stats.lastReset;

    return {
      ...this.stats,
      uptime,
      activeTasks: this.progressCache.size,
      totalSubscriptions: Array.from(this.subscribers.values()).reduce(
        (sum, set) => sum + set.size,
        0
      ),
      queuedPushes: this.pushQueue.length,
      offlineMessages: Array.from(this.offlineMessages.values()).reduce(
        (sum, messages) => sum + messages.length,
        0
      ),
      pushSuccessRate:
        this.stats.totalPushes > 0
          ? ((this.stats.successfulPushes / this.stats.totalPushes) * 100).toFixed(2) + '%'
          : '0%',
      timestamp: new Date().toISOString()
    };
  }

  // 私有方法

  /**
   * 验证任务访问权限
   * @param {string} userId - 用户ID
   * @param {string} taskId - 任务ID
   * @returns {Promise<boolean>} 是否有权限
   * @private
   */
  async verifyTaskAccess(userId: string, taskId: string): Promise<boolean> {
    try {
      const task = await db('tasks').where('id', taskId).where('user_id', userId).first();

      return !!task;
    } catch (error) {
      logger.error(
        `[TaskProgress] 验证任务访问权限失败: userId=${userId}, taskId=${taskId}`,
        error
      );
      return false;
    }
  }

  /**
   * 验证进度数据
   * @param {Object} progressData - 进度数据
   * @returns {Object|null} 验证后的进度数据
   * @private
   */
  validateProgressData(progressData: AnyObject): TaskProgressPayload | null {
    try {
      const percentage = Number(progressData.percentage);
      const normalizedPercentage = Number.isFinite(percentage)
        ? Math.max(0, Math.min(100, percentage))
        : 0;
      return {
        percentage: normalizedPercentage,
        currentStep: typeof progressData.currentStep === 'string' ? progressData.currentStep : '',
        totalSteps: Number.isFinite(Number(progressData.totalSteps))
          ? Number(progressData.totalSteps)
          : 0,
        message: typeof progressData.message === 'string' ? progressData.message : '',
        eta: progressData.eta ?? null,
        details:
          progressData.details && typeof progressData.details === 'object'
            ? (progressData.details as AnyObject)
            : {},
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('[TaskProgress] 进度数据验证失败:', error);
      return null;
    }
  }

  /**
   * 判断是否应该推送进度
   * @param {Object} currentProgress - 当前进度
   * @param {Object} newProgress - 新进度
   * @returns {boolean} 是否应该推送
   * @private
   */
  shouldPushProgress(
    currentProgress: TaskProgressPayload | undefined,
    newProgress: TaskProgressPayload
  ): boolean {
    if (!currentProgress) {
      return true; // 首次推送
    }

    // 检查时间间隔
    const timeDiff = newProgress.timestamp - currentProgress.timestamp;
    if (timeDiff < this.config.minProgressInterval) {
      return false;
    }

    // 检查进度变化
    const progressDiff = Math.abs(newProgress.percentage - currentProgress.percentage);
    return progressDiff >= 1; // 进度变化至少1%
  }

  /**
   * 推送进度到用户
   * @param {string} userId - 用户ID
   * @param {string} taskId - 任务ID
   * @param {Object} progress - 进度数据
   * @returns {Promise<number>} 推送数量
   * @private
   */
  async pushProgressToUser(
    userId: string,
    taskId: string,
    progress: TaskProgressPayload
  ): Promise<number> {
    try {
      const sent = websocketService.pushTaskProgress(userId, taskId, progress);

      if (sent === 0) {
        // 用户离线，添加到离线消息
        this.addOfflineMessage(userId, {
          type: 'task_progress',
          data: { taskId, progress }
        });
        this.stats.offlinePushes++;
      }

      return sent;
    } catch (error) {
      logger.error(`[TaskProgress] 推送进度失败: userId=${userId}, taskId=${taskId}`, error);
      this.stats.failedPushes++;
      return 0;
    }
  }

  /**
   * 添加离线消息
   * @param {string} userId - 用户ID
   * @param {Object} message - 消息内容
   * @private
   */
  addOfflineMessage(userId: string, message: OfflineMessagePayload): void {
    if (!this.offlineMessages.has(userId)) {
      this.offlineMessages.set(userId, []);
    }

    const messages = this.offlineMessages.get(userId) ?? [];
    if (!this.offlineMessages.has(userId)) {
      this.offlineMessages.set(userId, messages);
    }

    const payload: OfflineMessage = {
      ...message,
      timestamp: Date.now()
    };

    messages.push(payload);

    // 限制消息数量
    if (messages.length > this.config.maxOfflineMessages) {
      messages.splice(0, messages.length - this.config.maxOfflineMessages);
    }
  }

  /**
   * 获取用户离线消息
   * @param {string} userId - 用户ID
   * @returns {Array} 离线消息列表
   */
  getUserOfflineMessages(userId: string): OfflineMessage[] {
    const messages = this.offlineMessages.get(userId) ?? [];
    this.offlineMessages.set(userId, []); // 清空已获取的消息
    return messages;
  }

  /**
   * 添加到推送队列
   * @param {string} taskId - 任务ID
   * @param {Object} progress - 进度数据
   * @param {string} source - 推送来源
   * @private
   */
  queuePush(taskId: string, progress: TaskProgressPayload, source: string): void {
    this.pushQueue.push({
      taskId,
      progress,
      source,
      timestamp: Date.now()
    });

    if (!this.config.batchPush) {
      this.processPushQueue();
    }
  }

  /**
   * 启动批量推送器
   * @private
   */
  startBatchPusher(): void {
    if (!this.config.batchPush) {
      return;
    }

    this.batchTimer = setInterval(() => {
      if (this.pushQueue.length > 0) {
        this.processPushQueue();
      }
    }, this.config.batchInterval);

    logger.info(`[TaskProgress] 批量推送器已启动，间隔: ${this.config.batchInterval}ms`);
  }

  /**
   * 处理推送队列
   * @private
   */
  async processPushQueue(): Promise<void> {
    if (this.pushQueue.length === 0) {
      return;
    }

    const batch = this.pushQueue.splice(0); // 取出所有待推送消息
    this.stats.batchPushes++;

    logger.debug(`[TaskProgress] 处理推送队列: ${batch.length}条消息`);

    for (const pushItem of batch) {
      const { taskId, progress } = pushItem;
      const subscribers = this.subscribers.get(taskId) || new Set();

      for (const userId of subscribers) {
        try {
          await this.pushProgressToUser(userId, taskId, progress);
        } catch (error) {
          logger.error(`[TaskProgress] 批量推送失败: userId=${userId}, taskId=${taskId}`, error);
        }
      }
    }
  }
}

const taskProgressService = new TaskProgressService();

export default taskProgressService;
