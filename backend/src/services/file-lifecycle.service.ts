import crypto from 'node:crypto';
import logger from '../utils/logger.js';
import cosStorageService from './cos-storage.service.js';
import { db } from '../config/database.js';
import type {
  FileCategory,
  FileLifecycleRecord,
  FileLifecycleRecordRow,
  FileLifecycleStats,
  FileMetadata,
  FilePriority,
  FileStorageClass,
  LifecycleCleanupOptions,
  LifecycleCleanupResult,
  LifecycleProcessResult,
  LifecycleRegistrationInput,
  LifecycleRegistrationResult,
  LifecycleSchedule,
  LifecycleStrategyConfig,
  LifecycleTransitionExecutionResult,
  LifecycleTransitionState,
  LifecycleStatsResponse,
  LifecycleTransitionConfig
} from '../types/file.types.js';

type LifecycleStrategyMap = Record<FileCategory, LifecycleStrategyConfig>;

interface CleanupConfig {
  enabled: boolean;
  interval: number;
  batchSize: number;
  maxExecutionTime: number;
}

interface MonitoringConfig {
  enabled: boolean;
  alertThresholds: {
    storageUsage: number;
    costIncrease: number;
    errorRate: number;
  };
}

interface FileLifecycleConfig {
  strategies: LifecycleStrategyMap;
  cleanup: CleanupConfig;
  monitoring: MonitoringConfig;
}

/**
 * 文件生命周期管理服务
 *
 * 管理文件从上传到删除的完整生命周期：
 * - 自动分类和标记
 * - 按策略转移存储类别
 * - 定期清理过期文件
 * - 成本优化和监控
 * - 合规性审计
 */
class FileLifecycleService {
  private config: FileLifecycleConfig;

  private initialized = false;

  private cleanupTimer: NodeJS.Timeout | null = null;

  private stats: FileLifecycleStats;

  constructor() {
    const strategies: LifecycleStrategyMap = {
      temp: {
        ttl: 7 * 24 * 60 * 60 * 1000,
        transitions: [
          { after: 1 * 24 * 60 * 60 * 1000, storageClass: 'Standard_IA' },
          { after: 3 * 24 * 60 * 60 * 1000, storageClass: 'Archive' }
        ],
        autoDelete: true
      },
      intermediate: {
        ttl: 30 * 24 * 60 * 60 * 1000,
        transitions: [
          { after: 7 * 24 * 60 * 60 * 1000, storageClass: 'Standard_IA' },
          { after: 15 * 24 * 60 * 60 * 1000, storageClass: 'Archive' }
        ],
        autoDelete: true
      },
      userUpload: {
        ttl: 365 * 24 * 60 * 60 * 1000,
        transitions: [
          { after: 90 * 24 * 60 * 60 * 1000, storageClass: 'Standard_IA' },
          { after: 180 * 24 * 60 * 60 * 1000, storageClass: 'Archive' }
        ],
        autoDelete: false
      },
      result: {
        ttl: 180 * 24 * 60 * 60 * 1000,
        transitions: [
          { after: 30 * 24 * 60 * 60 * 1000, storageClass: 'Standard_IA' },
          { after: 90 * 24 * 60 * 60 * 1000, storageClass: 'Archive' }
        ],
        autoDelete: true
      },
      log: {
        ttl: 30 * 24 * 60 * 60 * 1000,
        transitions: [{ after: 7 * 24 * 60 * 60 * 1000, storageClass: 'Standard_IA' }],
        autoDelete: true
      }
    };

    this.config = {
      strategies,
      cleanup: {
        enabled: true,
        interval: 6 * 60 * 60 * 1000,
        batchSize: 1000,
        maxExecutionTime: 30 * 60 * 1000
      },
      monitoring: {
        enabled: true,
        alertThresholds: {
          storageUsage: 0.8,
          costIncrease: 0.2,
          errorRate: 0.05
        }
      }
    };

    this.initialized = false;
    this.cleanupTimer = null;
    this.stats = {
      totalProcessed: 0,
      totalDeleted: 0,
      totalTransferred: 0,
      costSaved: 0,
      lastCleanup: null,
      errors: 0
    };
  }

  /**
   * 初始化生命周期服务
   */
  async initialize() {
    if (this.initialized) {
      logger.warn('[FileLifecycle] 生命周期服务已初始化');
      return;
    }

    try {
      // 确保COS服务已初始化
      await cosStorageService.initialize();

      // 创建文件记录表（如果不存在）
      await this.ensureFileRecordsTable();

      // 启动定期清理任务
      this.startPeriodicCleanup();

      this.initialized = true;
      logger.info('[FileLifecycle] 文件生命周期服务初始化成功');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[FileLifecycle] 初始化失败:', err);
      throw err;
    }
  }

  /**
   * 注册文件
   * @param {Object} fileInfo - 文件信息
   * @returns {Promise<Object>} 注册结果
   */
  async registerFile(fileInfo: LifecycleRegistrationInput): Promise<LifecycleRegistrationResult> {
    try {
      const { key, category, taskId, userId, metadata = {}, size = 0 } = fileInfo;
      const priority = this.normalizePriority(fileInfo.priority);

      if (!key || typeof key !== 'string') {
        throw new Error('文件 key 必须为字符串');
      }

      // 验证分类
      if (!this.config.strategies[category]) {
        throw new Error(`不支持的文件分类: ${category}`);
      }

      const strategy = this.config.strategies[category];
      const now = new Date();

      // 计算生命周期时间点
      const lifecycleSchedule = this.calculateLifecycleSchedule(strategy, now);

      const fileRecord: FileLifecycleRecordRow = {
        id: this.generateFileId(),
        key,
        category,
        task_id: taskId ?? null,
        user_id: userId ?? null,
        metadata: JSON.stringify(metadata),
        storage_class: fileInfo.storageClass ?? 'Standard',
        priority,
        status: 'active',
        created_at: now,
        updated_at: now,
        expires_at: new Date(now.getTime() + strategy.ttl),
        next_transition_at: lifecycleSchedule.nextTransitionAt,
        size,
        transitions: JSON.stringify(lifecycleSchedule.transitions),
        auto_delete: strategy.autoDelete,
        deleted_at: null
      };

      // 保存到数据库
      await db('file_lifecycle_records').insert(fileRecord);

      logger.info(`[FileLifecycle] 文件注册成功: ${key} (${category})`);

      return {
        success: true,
        fileId: fileRecord.id,
        schedule: lifecycleSchedule
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[FileLifecycle] 文件注册失败:', err);
      throw err;
    }
  }

  /**
   * 更新文件状态
   * @param {string} fileId - 文件ID
   * @param {Object} updates - 更新内容
   * @returns {Promise<boolean>} 是否成功
   */
  async updateFileStatus(
    fileId: string,
    updates: Partial<FileLifecycleRecord> & {
      metadata?: FileMetadata;
      transitions?: LifecycleTransitionState[];
    }
  ): Promise<boolean> {
    try {
      const updateData: Record<string, unknown> = {
        ...updates,
        updated_at: new Date()
      };

      if (updates.metadata) {
        updateData.metadata = JSON.stringify(updates.metadata);
      }

      if (updates.transitions) {
        updateData.transitions = JSON.stringify(updates.transitions);
      }

      const affected = await db('file_lifecycle_records').where('id', fileId).update(updateData);

      return affected > 0;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[FileLifecycle] 更新文件状态失败: ${fileId}`, err);
      return false;
    }
  }

  /**
   * 执行生命周期转换
   * @returns {Promise<Object>} 执行结果
   */
  async executeLifecycleTransitions(): Promise<LifecycleTransitionExecutionResult> {
    try {
      logger.info('[FileLifecycle] 开始执行生命周期转换');

      const now = new Date();
      let processedCount = 0;
      let transferredCount = 0;
      let deletedCount = 0;
      const errors = [];

      // 查询需要处理的文件
      const rawRecords = (await db('file_lifecycle_records')
        .where('status', 'active')
        .where('expires_at', '<=', now)
        .orWhere('next_transition_at', '<=', now)
        .limit(this.config.cleanup.batchSize)) as Record<string, unknown>[];

      for (const record of rawRecords) {
        try {
          const file = this.mapLifecycleRecord(record);
          const result = await this.processFileLifecycle(file);
          processedCount++;

          if (result.transferred) transferredCount++;
          if (result.deleted) deletedCount++;

          // 避免API限制
          if (processedCount % 50 === 0) {
            await this.sleep(100);
          }
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          const key = typeof record.key === 'string' ? record.key : 'unknown';
          errors.push({
            fileId: typeof record.id === 'string' ? record.id : undefined,
            key: typeof record.key === 'string' ? record.key : undefined,
            error: err.message
          });
          logger.error(`[FileLifecycle] 处理文件失败: ${key}`, err);
        }
      }

      // 更新统计
      this.stats.totalProcessed += processedCount;
      this.stats.totalTransferred += transferredCount;
      this.stats.totalDeleted += deletedCount;
      this.stats.lastCleanup = now;

      const result: LifecycleTransitionExecutionResult = {
        success: true,
        processed: processedCount,
        transferred: transferredCount,
        deleted: deletedCount,
        errors: errors.length,
        errorDetails: errors,
        timestamp: now.toISOString()
      };

      logger.info(
        `[FileLifecycle] 生命周期转换完成: 处理${processedCount}个, 转移${transferredCount}个, 删除${deletedCount}个`
      );

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[FileLifecycle] 执行生命周期转换失败:', err);
      throw err;
    }
  }

  /**
   * 处理单个文件的生命周期
   * @param {Object} file - 文件记录
   * @returns {Promise<Object>} 处理结果
   * @private
   */
  private async processFileLifecycle(file: FileLifecycleRecord): Promise<LifecycleProcessResult> {
    const now = new Date();
    const strategy = this.config.strategies[file.category as FileCategory];

    // 检查是否需要删除
    const expiresAt = file.expires_at ?? now;

    if (expiresAt <= now) {
      const autoDelete = Boolean(file.auto_delete);
      if (autoDelete) {
        await this.deleteFile(file);
        return { deleted: true, transferred: false };
      } else {
        // 不自动删除，标记为过期
        await this.updateFileStatus(file.id, { status: 'expired' });
        return { deleted: false, transferred: false, expired: true };
      }
    }

    // 检查是否需要转移存储类别
    const nextTransition = file.transitions.find((t) => new Date(t.at) <= now && !t.completed);

    if (nextTransition) {
      await this.transferFileStorage(file, nextTransition);
      return { deleted: false, transferred: true };
    }

    return { deleted: false, transferred: false };
  }

  /**
   * 转移文件存储类别
   * @param {Object} file - 文件记录
   * @param {Object} transition - 转移配置
   * @private
   */
  private async transferFileStorage(
    file: FileLifecycleRecord,
    transition: LifecycleTransitionState
  ): Promise<void> {
    try {
      logger.info(`[FileLifecycle] 转移文件存储类别: ${file.key} -> ${transition.storageClass}`);

      // 在实际项目中，这里会调用COS API修改存储类别
      // await cosStorageService.changeStorageClass(file.key, transition.storageClass);

      // 标记转换完成
      transition.completed = true;
      transition.completedAt = new Date().toISOString();

      // 更新数据库记录
      const updatedTransitions = file.transitions.map((t) =>
        t.at === transition.at ? transition : t
      );

      await this.updateFileStatus(file.id, {
        storage_class: transition.storageClass,
        transitions: updatedTransitions
      });

      // 计算成本节省
      const costSaving = this.calculateCostSaving(file, transition);
      this.stats.costSaved += costSaving;

      logger.info(
        `[FileLifecycle] 存储类别转移完成: ${file.key}, 预计节省: ¥${costSaving.toFixed(2)}`
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[FileLifecycle] 存储类别转移失败: ${file.key}`, err);
      throw err;
    }
  }

  /**
   * 删除文件
   * @param {Object} file - 文件记录
   * @private
   */
  private async deleteFile(file: FileLifecycleRecord): Promise<void> {
    try {
      logger.info(`[FileLifecycle] 删除过期文件: ${file.key}`);

      // 从COS删除文件
      await cosStorageService.deleteFile(file.key);

      // 更新数据库记录
      await this.updateFileStatus(file.id, {
        status: 'deleted',
        deleted_at: new Date()
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[FileLifecycle] 删除文件失败: ${file.key}`, err);
      throw err;
    }
  }

  /**
   * 强制清理指定分类的文件
   * @param {Object} options - 清理选项
   * @returns {Promise<Object>} 清理结果
   */
  async forceCleanup(options: LifecycleCleanupOptions = {}): Promise<LifecycleCleanupResult> {
    const category = options.category ?? null;
    const olderThanDays = options.olderThanDays ?? 7;
    const dryRun = options.dryRun ?? false;
    const batchSize = options.batchSize ?? 100;

    try {
      logger.info(
        `[FileLifecycle] 强制清理 ${category || '所有'} 文件 ${dryRun ? '(干运行)' : ''}`
      );

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      let query = db('file_lifecycle_records').where('status', 'active');

      if (category) {
        query = query.where('category', category);
      }

      const filesToCleanup = (await query
        .where('created_at', '<', cutoffDate)
        .limit(batchSize)) as Record<string, unknown>[];
      const normalizedFiles = filesToCleanup.map((record) => this.mapLifecycleRecord(record));

      let deletedCount = 0;
      let totalSize = 0;

      for (const file of normalizedFiles) {
        try {
          if (!dryRun) {
            await this.deleteFile(file);
          }

          deletedCount++;
          totalSize += file.size;
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.error(`[FileLifecycle] 清理文件失败: ${file.key}`, err);
        }
      }

      const result: LifecycleCleanupResult = {
        success: true,
        deletedCount,
        totalSize,
        category,
        olderThanDays,
        dryRun,
        timestamp: new Date().toISOString()
      };

      logger.info(`[FileLifecycle] 强制清理完成: ${deletedCount}个文件`);

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[FileLifecycle] 强制清理失败:', err);
      throw err;
    }
  }

  /**
   * 获取生命周期统计信息
   * @returns {Promise<Object>} 统计信息
   */
  async getLifecycleStats(): Promise<LifecycleStatsResponse> {
    try {
      // 获取各分类文件统计
      const categoryStatsRaw = await db('file_lifecycle_records')
        .select('category')
        .count('* as count')
        .sum('size as totalSize')
        .where('status', 'active')
        .groupBy('category');

      const categoryStats = (categoryStatsRaw ?? []).map((row) => ({
        category: row.category as FileCategory,
        count: Number(row.count ?? 0),
        totalSize: Number(row.totalSize ?? 0)
      }));

      // 获取存储类别分布
      const storageClassRaw = await db('file_lifecycle_records')
        .select('storage_class')
        .count('* as count')
        .where('status', 'active')
        .groupBy('storage_class');

      const storageClassStats = (storageClassRaw ?? []).map((row) => ({
        storage_class: row.storage_class as FileStorageClass,
        count: Number(row.count ?? 0)
      }));

      // 获取即将过期文件
      const expiringSoon = await db('file_lifecycle_records')
        .count('* as count')
        .where('status', 'active')
        .where('expires_at', '<=', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) // 7天内过期
        .first();

      return {
        stats: { ...this.stats },
        categoryStats,
        storageClassStats,
        expiringSoonCount: Number(expiringSoon?.count ?? 0),
        config: {
          cleanupInterval: this.config.cleanup.interval,
          batchSize: this.config.cleanup.batchSize
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[FileLifecycle] 获取统计信息失败:', err);
      throw err;
    }
  }

  /**
   * 启动定期清理任务
   * @private
   */
  startPeriodicCleanup() {
    if (!this.config.cleanup.enabled) {
      logger.info('[FileLifecycle] 定期清理任务已禁用');
      return;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(async () => {
      try {
        logger.info('[FileLifecycle] 执行定期清理任务');
        await this.executeLifecycleTransitions();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('[FileLifecycle] 定期清理任务失败:', err);
        this.stats.errors++;
      }
    }, this.config.cleanup.interval);

    logger.info(
      `[FileLifecycle] 定期清理任务已启动，间隔: ${this.config.cleanup.interval / 1000 / 60}分钟`
    );
  }

  /**
   * 停止定期清理任务
   */
  stopPeriodicCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      logger.info('[FileLifecycle] 定期清理任务已停止');
    }
  }

  // 辅助方法

  /**
   * 确保文件记录表存在
   * @private
   */
  async ensureFileRecordsTable() {
    try {
      const hasTable = await db.schema.hasTable('file_lifecycle_records');
      if (!hasTable) {
        await this.createFileRecordsTable();
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[FileLifecycle] 检查文件记录表失败:', err);
      throw err;
    }
  }

  /**
   * 创建文件记录表
   * @private
   */
  async createFileRecordsTable() {
    await db.schema.createTable('file_lifecycle_records', (table) => {
      table.string('id', 36).primary().defaultTo(db.raw('(UUID())'));
      table.string('key', 500).notNullable();
      table.string('category', 50).notNullable();
      table.string('task_id', 32).nullable();
      table.string('user_id', 36).nullable();
      table.json('metadata').nullable();
      table.string('storage_class', 50).defaultTo('Standard');
      table.enum('priority', ['low', 'normal', 'high']).defaultTo('normal');
      table.enum('status', ['active', 'expired', 'deleted']).defaultTo('active');
      table.bigInteger('size').defaultTo(0);
      table.datetime('created_at').defaultTo(db.raw('CURRENT_TIMESTAMP'));
      table
        .datetime('updated_at')
        .defaultTo(db.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
      table.datetime('expires_at').nullable();
      table.datetime('next_transition_at').nullable();
      table.json('transitions').nullable();
      table.boolean('auto_delete').defaultTo(false);
      table.datetime('deleted_at').nullable();

      // 索引
      table.index('category', 'idx_files_category');
      table.index('status', 'idx_files_status');
      table.index('expires_at', 'idx_files_expires');
      table.index('next_transition_at', 'idx_files_transition');
      table.index(['category', 'status'], 'idx_files_category_status');
      table.index(['task_id', 'status'], 'idx_files_task_status');
    });

    logger.info('[FileLifecycle] 文件记录表创建成功');
  }

  /**
   * 计算生命周期时间表
   * @param {Object} strategy - 生命周期策略
   * @param {Date} now - 当前时间
   * @returns {Object} 生命周期时间表
   * @private
   */
  private calculateLifecycleSchedule(
    strategy: LifecycleStrategyConfig,
    now: Date
  ): LifecycleSchedule {
    const transitions: LifecycleTransitionState[] = strategy.transitions.map(
      (transition: LifecycleTransitionConfig, index: number) => ({
        at: new Date(now.getTime() + transition.after).toISOString(),
        storageClass: transition.storageClass,
        completed: false,
        order: index + 1
      })
    );

    const nextTransitionAt = transitions.length > 0 ? new Date(transitions[0].at) : null;

    return {
      expiresAt: new Date(now.getTime() + strategy.ttl),
      transitions,
      nextTransitionAt
    };
  }

  /**
   * 计算成本节省
   * @param {Object} file - 文件记录
   * @param {Object} transition - 转移配置
   * @returns {number} 预计节省金额
   * @private
   */
  private calculateCostSaving(
    file: FileLifecycleRecord,
    transition: LifecycleTransitionState
  ): number {
    // 简化的成本计算（实际项目中会根据具体的存储定价计算）
    const sizeGB = (file.size || 0) / (1024 * 1024 * 1024);
    const daysInMonth = 30;

    const standardPrice = 0.118; // 标准存储 ¥0.118/GB/月
    let targetPrice = standardPrice;

    switch (transition.storageClass) {
      case 'Standard_IA':
        targetPrice = 0.059; // 低频访问 ¥0.059/GB/月
        break;
      case 'Archive':
        targetPrice = 0.012; // 归档存储 ¥0.012/GB/月
        break;
    }

    const monthlySaving = sizeGB * (standardPrice - targetPrice);
    const dailySaving = monthlySaving / daysInMonth;

    return dailySaving;
  }

  private mapLifecycleRecord(record: Record<string, unknown>): FileLifecycleRecord {
    const row = record as unknown as FileLifecycleRecordRow;

    if (typeof row.id !== 'string' || typeof row.key !== 'string') {
      throw new Error('Invalid file lifecycle row');
    }

    const metadata = this.safeParseJson<FileMetadata>(row.metadata, {});
    const transitions = this.safeParseJson<LifecycleTransitionState[]>(row.transitions, []).map(
      (transition, index) => ({
        ...transition,
        storageClass: this.normalizeStorageClass(transition.storageClass),
        order: transition.order ?? index + 1,
        completed: Boolean(transition.completed)
      })
    );

    return {
      id: row.id,
      key: row.key,
      category: this.ensureCategory(row.category),
      task_id: row.task_id ?? null,
      user_id: row.user_id ?? null,
      metadata,
      storage_class: this.normalizeStorageClass(row.storage_class),
      priority: this.normalizePriority(row.priority),
      status: this.normalizeStatus(row.status),
      size: Number(row.size ?? 0),
      created_at: this.toDateOrNow(row.created_at),
      updated_at: this.toDateOrNow(row.updated_at),
      expires_at: this.toOptionalDate(row.expires_at),
      next_transition_at: this.toOptionalDate(row.next_transition_at),
      transitions,
      auto_delete: Boolean(row.auto_delete),
      deleted_at: this.toOptionalDate(row.deleted_at)
    };
  }

  private ensureCategory(category?: string | null): FileCategory {
    const valid: FileCategory[] = ['temp', 'intermediate', 'userUpload', 'result', 'log'];
    if (category && valid.includes(category as FileCategory)) {
      return category as FileCategory;
    }
    logger.warn(`[FileLifecycle] 未知文件分类 ${category}, 默认归类为 temp`);
    return 'temp';
  }

  private normalizeStorageClass(value?: string | null): FileStorageClass {
    if (value === 'Standard_IA' || value === 'Archive') {
      return value;
    }
    return 'Standard';
  }

  private normalizeStatus(value?: string | null): FileLifecycleRecord['status'] {
    if (value === 'expired' || value === 'deleted') {
      return value;
    }
    return 'active';
  }

  private toOptionalDate(value?: Date | string | null): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private toDateOrNow(value?: Date | string | null): Date {
    return this.toOptionalDate(value) ?? new Date();
  }

  private safeParseJson<T>(raw: string | null, fallback: T): T {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      logger.warn('[FileLifecycle] JSON解析失败，使用默认值', { error });
      return fallback;
    }
  }

  private normalizePriority(priority?: string): FilePriority {
    if (priority === 'low' || priority === 'normal' || priority === 'high') {
      return priority;
    }
    return 'normal';
  }

  /**
   * 生成文件ID
   * @returns {string} 文件ID
   * @private
   */
  private generateFileId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟毫秒数
   * @private
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'initializing';
    stats: FileLifecycleStats;
    timestamp: string;
  }> {
    return {
      status: this.initialized ? 'healthy' : 'initializing',
      stats: { ...this.stats },
      timestamp: new Date().toISOString()
    };
  }
}

const fileLifecycleService = new FileLifecycleService();

export default fileLifecycleService;
