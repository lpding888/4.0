const logger = require('../utils/logger');
const cosStorageService = require('./cos-storage.service');
const db = require('../config/database');

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
  constructor() {
    this.config = {
      // 生命周期策略
      strategies: {
        // 临时文件（上传、处理中）
        temp: {
          ttl: 7 * 24 * 60 * 60 * 1000, // 7天
          transitions: [
            { after: 1 * 24 * 60 * 60 * 1000, storageClass: 'Standard_IA' }, // 1天后转低频
            { after: 3 * 24 * 60 * 60 * 1000, storageClass: 'Archive' }      // 3天后转归档
          ],
          autoDelete: true
        },

        // 中间文件（处理过程的中间结果）
        intermediate: {
          ttl: 30 * 24 * 60 * 60 * 1000, // 30天
          transitions: [
            { after: 7 * 24 * 60 * 60 * 1000, storageClass: 'Standard_IA' }, // 7天后转低频
            { after: 15 * 24 * 60 * 60 * 1000, storageClass: 'Archive' }     // 15天后转归档
          ],
          autoDelete: true
        },

        // 用户上传文件
        userUpload: {
          ttl: 365 * 24 * 60 * 60 * 1000, // 1年
          transitions: [
            { after: 90 * 24 * 60 * 60 * 1000, storageClass: 'Standard_IA' }, // 90天后转低频
            { after: 180 * 24 * 60 * 60 * 1000, storageClass: 'Archive' }    // 180天后转归档
          ],
          autoDelete: false
        },

        // 处理结果文件
        result: {
          ttl: 180 * 24 * 60 * 60 * 1000, // 180天
          transitions: [
            { after: 30 * 24 * 60 * 60 * 1000, storageClass: 'Standard_IA' }, // 30天后转低频
            { after: 90 * 24 * 60 * 60 * 1000, storageClass: 'Archive' }     // 90天后转归档
          ],
          autoDelete: true
        },

        // 日志文件
        log: {
          ttl: 30 * 24 * 60 * 60 * 1000, // 30天
          transitions: [
            { after: 7 * 24 * 60 * 60 * 1000, storageClass: 'Standard_IA' } // 7天后转低频
          ],
          autoDelete: true
        }
      },

      // 清理任务配置
      cleanup: {
        enabled: true,
        interval: 6 * 60 * 60 * 1000, // 6小时执行一次
        batchSize: 1000, // 每批处理1000个文件
        maxExecutionTime: 30 * 60 * 1000 // 最大执行时间30分钟
      },

      // 监控配置
      monitoring: {
        enabled: true,
        alertThresholds: {
          storageUsage: 0.8, // 存储使用率超过80%告警
          costIncrease: 0.2,  // 成本增长超过20%告警
          errorRate: 0.05     // 错误率超过5%告警
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
      logger.error('[FileLifecycle] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 注册文件
   * @param {Object} fileInfo - 文件信息
   * @returns {Promise<Object>} 注册结果
   */
  async registerFile(fileInfo) {
    try {
      const {
        key,
        category,
        taskId,
        userId,
        metadata = {},
        priority = 'normal'
      } = fileInfo;

      // 验证分类
      if (!this.config.strategies[category]) {
        throw new Error(`不支持的文件分类: ${category}`);
      }

      const strategy = this.config.strategies[category];
      const now = new Date();

      // 计算生命周期时间点
      const lifecycleSchedule = this.calculateLifecycleSchedule(strategy, now);

      const fileRecord = {
        id: this.generateFileId(),
        key,
        category,
        task_id: taskId,
        user_id: userId,
        metadata: JSON.stringify(metadata),
        storage_class: 'Standard',
        priority,
        status: 'active',
        created_at: now,
        updated_at: now,
        expires_at: new Date(now.getTime() + strategy.ttl),
        transitions: JSON.stringify(lifecycleSchedule.transitions),
        auto_delete: strategy.autoDelete
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
      logger.error('[FileLifecycle] 文件注册失败:', error);
      throw error;
    }
  }

  /**
   * 更新文件状态
   * @param {string} fileId - 文件ID
   * @param {Object} updates - 更新内容
   * @returns {Promise<boolean>} 是否成功
   */
  async updateFileStatus(fileId, updates) {
    try {
      const updateData = {
        ...updates,
        updated_at: new Date()
      };

      if (updates.metadata) {
        updateData.metadata = JSON.stringify(updates.metadata);
      }

      const affected = await db('file_lifecycle_records')
        .where('id', fileId)
        .update(updateData);

      return affected > 0;

    } catch (error) {
      logger.error(`[FileLifecycle] 更新文件状态失败: ${fileId}`, error);
      return false;
    }
  }

  /**
   * 执行生命周期转换
   * @returns {Promise<Object>} 执行结果
   */
  async executeLifecycleTransitions() {
    try {
      logger.info('[FileLifecycle] 开始执行生命周期转换');

      const now = new Date();
      let processedCount = 0;
      let transferredCount = 0;
      let deletedCount = 0;
      const errors = [];

      // 查询需要处理的文件
      const filesToProcess = await db('file_lifecycle_records')
        .where('status', 'active')
        .where('expires_at', '<=', now)
        .orWhere('next_transition_at', '<=', now)
        .limit(this.config.cleanup.batchSize);

      for (const file of filesToProcess) {
        try {
          const result = await this.processFileLifecycle(file);
          processedCount++;

          if (result.transferred) transferredCount++;
          if (result.deleted) deletedCount++;

          // 避免API限制
          if (processedCount % 50 === 0) {
            await this.sleep(100);
          }

        } catch (error) {
          errors.push({
            fileId: file.id,
            key: file.key,
            error: error.message
          });
          logger.error(`[FileLifecycle] 处理文件失败: ${file.key}`, error);
        }
      }

      // 更新统计
      this.stats.totalProcessed += processedCount;
      this.stats.totalTransferred += transferredCount;
      this.stats.totalDeleted += deletedCount;
      this.stats.lastCleanup = now;

      const result = {
        success: true,
        processed: processedCount,
        transferred: transferredCount,
        deleted: deletedCount,
        errors: errors.length,
        errorDetails: errors,
        timestamp: now.toISOString()
      };

      logger.info(`[FileLifecycle] 生命周期转换完成: 处理${processedCount}个, 转移${transferredCount}个, 删除${deletedCount}个`);

      return result;

    } catch (error) {
      logger.error('[FileLifecycle] 执行生命周期转换失败:', error);
      throw error;
    }
  }

  /**
   * 处理单个文件的生命周期
   * @param {Object} file - 文件记录
   * @returns {Promise<Object>} 处理结果
   * @private
   */
  async processFileLifecycle(file) {
    const now = new Date();
    const strategy = this.config.strategies[file.category];

    // 检查是否需要删除
    if (file.expires_at <= now) {
      if (file.auto_delete) {
        await this.deleteFile(file);
        return { deleted: true, transferred: false };
      } else {
        // 不自动删除，标记为过期
        await this.updateFileStatus(file.id, { status: 'expired' });
        return { deleted: false, transferred: false, expired: true };
      }
    }

    // 检查是否需要转移存储类别
    const transitions = JSON.parse(file.transitions || '[]');
    const nextTransition = transitions.find(t => new Date(t.at) <= now && !t.completed);

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
  async transferFileStorage(file, transition) {
    try {
      logger.info(`[FileLifecycle] 转移文件存储类别: ${file.key} -> ${transition.storageClass}`);

      // 在实际项目中，这里会调用COS API修改存储类别
      // await cosStorageService.changeStorageClass(file.key, transition.storageClass);

      // 标记转换完成
      transition.completed = true;
      transition.completedAt = new Date().toISOString();

      // 更新数据库记录
      await this.updateFileStatus(file.id, {
        storage_class: transition.storageClass,
        transitions: JSON.stringify(JSON.parse(file.transitions).map(t =>
          t.at === transition.at ? transition : t
        ))
      });

      // 计算成本节省
      const costSaving = this.calculateCostSaving(file, transition);
      this.stats.costSaved += costSaving;

      logger.info(`[FileLifecycle] 存储类别转移完成: ${file.key}, 预计节省: ¥${costSaving.toFixed(2)}`);

    } catch (error) {
      logger.error(`[FileLifecycle] 存储类别转移失败: ${file.key}`, error);
      throw error;
    }
  }

  /**
   * 删除文件
   * @param {Object} file - 文件记录
   * @private
   */
  async deleteFile(file) {
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
      logger.error(`[FileLifecycle] 删除文件失败: ${file.key}`, error);
      throw error;
    }
  }

  /**
   * 强制清理指定分类的文件
   * @param {Object} options - 清理选项
   * @returns {Promise<Object>} 清理结果
   */
  async forceCleanup(options = {}) {
    const {
      category,
      olderThanDays = 7,
      dryRun = false,
      batchSize = 100
    } = options;

    try {
      logger.info(`[FileLifecycle] 强制清理 ${category || '所有'} 文件 ${dryRun ? '(干运行)' : ''}`);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      let query = db('file_lifecycle_records').where('status', 'active');

      if (category) {
        query = query.where('category', category);
      }

      const filesToCleanup = await query
        .where('created_at', '<', cutoffDate)
        .limit(batchSize);

      let deletedCount = 0;
      let totalSize = 0;

      for (const file of filesToCleanup) {
        try {
          if (!dryRun) {
            await this.deleteFile(file);
          }

          deletedCount++;
          // TODO: 获取文件大小并累加到totalSize

        } catch (error) {
          logger.error(`[FileLifecycle] 清理文件失败: ${file.key}`, error);
        }
      }

      const result = {
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
      logger.error('[FileLifecycle] 强制清理失败:', error);
      throw error;
    }
  }

  /**
   * 获取生命周期统计信息
   * @returns {Promise<Object>} 统计信息
   */
  async getLifecycleStats() {
    try {
      // 获取各分类文件统计
      const categoryStats = await db('file_lifecycle_records')
        .select('category')
        .count('* as count')
        .sum('size as totalSize')
        .where('status', 'active')
        .groupBy('category');

      // 获取存储类别分布
      const storageClassStats = await db('file_lifecycle_records')
        .select('storage_class')
        .count('* as count')
        .where('status', 'active')
        .groupBy('storage_class');

      // 获取即将过期文件
      const expiringSoon = await db('file_lifecycle_records')
        .count('* as count')
        .where('status', 'active')
        .where('expires_at', '<=', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) // 7天内过期
        .first();

      return {
        stats: this.stats,
        categoryStats: categoryStats || [],
        storageClassStats: storageClassStats || [],
        expiringSoonCount: expiringSoon?.count || 0,
        config: {
          cleanupInterval: this.config.cleanup.interval,
          batchSize: this.config.cleanup.batchSize
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('[FileLifecycle] 获取统计信息失败:', error);
      throw error;
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
        logger.error('[FileLifecycle] 定期清理任务失败:', error);
        this.stats.errors++;
      }
    }, this.config.cleanup.interval);

    logger.info(`[FileLifecycle] 定期清理任务已启动，间隔: ${this.config.cleanup.interval / 1000 / 60}分钟`);
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
      logger.error('[FileLifecycle] 检查文件记录表失败:', error);
      throw error;
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
      table.datetime('updated_at').defaultTo(db.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
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
  calculateLifecycleSchedule(strategy, now) {
    const transitions = strategy.transitions.map((transition, index) => ({
      at: new Date(now.getTime() + transition.after).toISOString(),
      storageClass: transition.storageClass,
      completed: false,
      order: index + 1
    }));

    const nextTransitionAt = transitions.length > 0 ?
      new Date(transitions[0].at) : null;

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
  calculateCostSaving(file, transition) {
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

  /**
   * 生成文件ID
   * @returns {string} 文件ID
   * @private
   */
  generateFileId() {
    return require('crypto').randomBytes(16).toString('hex');
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟毫秒数
   * @private
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new FileLifecycleService();