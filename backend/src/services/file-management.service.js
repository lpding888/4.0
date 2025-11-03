const logger = require('../utils/logger');
const cosStorageService = require('./cos-storage.service');
const fileLifecycleService = require('./file-lifecycle.service');
const db = require('../config/database');

/**
 * 文件管理集成服务
 *
 * 在任务处理过程中自动管理文件生命周期：
 * - 自动注册上传文件
 * - 跟踪处理过程中的中间文件
 * - 管理结果文件存储
 * - 自动清理任务相关文件
 */
class FileManagementService {
  constructor() {
    this.initialized = false;
    this.taskFiles = new Map(); // 任务ID -> 文件列表映射
  }

  /**
   * 初始化文件管理服务
   */
  async initialize() {
    if (this.initialized) {
      logger.warn('[FileManagement] 文件管理服务已初始化');
      return;
    }

    try {
      // 确保依赖服务已初始化
      await cosStorageService.initialize();
      await fileLifecycleService.initialize();

      this.initialized = true;
      logger.info('[FileManagement] 文件管理服务初始化成功');

    } catch (error) {
      logger.error('[FileManagement] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 处理用户上传文件
   * @param {Object} file - 上传的文件
   * @param {string} userId - 用户ID
   * @param {Object} options - 上传选项
   * @returns {Promise<Object>} 上传结果
   */
  async handleUserUpload(file, userId, options = {}) {
    try {
      logger.info(`[FileManagement] 处理用户上传: ${file.name}`);

      // 上传到COS
      const uploadResult = await cosStorageService.uploadFile({
        file,
        category: 'userUpload',
        metadata: {
          originalName: file.name,
          uploadedBy: userId,
          uploadType: 'user_upload'
        }
      });

      // 注册到生命周期管理
      await fileLifecycleService.registerFile({
        key: uploadResult.key,
        category: 'userUpload',
        userId,
        metadata: uploadResult.metadata
      });

      // 保存到数据库
      await this.saveFileRecord({
        key: uploadResult.key,
        originalName: file.name,
        userId,
        category: 'userUpload',
        size: uploadResult.size,
        metadata: uploadResult.metadata
      });

      logger.info(`[FileManagement] 用户上传处理完成: ${uploadResult.key}`);

      return uploadResult;

    } catch (error) {
      logger.error('[FileManagement] 处理用户上传失败:', error);
      throw error;
    }
  }

  /**
   * 创建任务临时文件
   * @param {string} taskId - 任务ID
   * @param {string} userId - 用户ID
   * @param {Object} file - 文件对象
   * @param {string} stepType - 步骤类型
   * @returns {Promise<Object>} 文件信息
   */
  async createTaskTempFile(taskId, userId, file, stepType = 'input') {
    try {
      logger.info(`[FileManagement] 创建任务临时文件: ${taskId} - ${stepType}`);

      // 上传到COS临时目录
      const uploadResult = await cosStorageService.uploadFile({
        file,
        category: 'temp',
        metadata: {
          taskId,
          userId,
          stepType,
          taskPhase: 'processing'
        }
      });

      // 注册到生命周期管理
      await fileLifecycleService.registerFile({
        key: uploadResult.key,
        category: 'temp',
        taskId,
        userId,
        metadata: uploadResult.metadata
      });

      // 记录到任务文件映射
      if (!this.taskFiles.has(taskId)) {
        this.taskFiles.set(taskId, []);
      }
      this.taskFiles.get(taskId).push({
        key: uploadResult.key,
        category: 'temp',
        stepType,
        createdAt: new Date()
      });

      // 保存到数据库
      await this.saveFileRecord({
        key: uploadResult.key,
        taskId,
        userId,
        category: 'temp',
        stepType,
        size: uploadResult.size,
        metadata: uploadResult.metadata
      });

      return uploadResult;

    } catch (error) {
      logger.error(`[FileManagement] 创建任务临时文件失败: ${taskId}`, error);
      throw error;
    }
  }

  /**
   * 创建中间文件
   * @param {string} taskId - 任务ID
   * @param {string} stepType - 步骤类型
   * @param {Object} fileData - 文件数据
   * @param {Object} options - 创建选项
   * @returns {Promise<Object>} 文件信息
   */
  async createIntermediateFile(taskId, stepType, fileData, options = {}) {
    try {
      logger.info(`[FileManagement] 创建中间文件: ${taskId} - ${stepType}`);

      // 获取任务信息
      const task = await db('tasks').where('id', taskId).first();
      if (!task) {
        throw new Error(`任务不存在: ${taskId}`);
      }

      // 模拟文件上传（在实际项目中，这里会上传真实的文件数据）
      const fileName = `${stepType}_${Date.now()}.jpg`;
      const mockFile = {
        name: fileName,
        size: fileData.size || 1024000,
        type: fileData.type || 'image/jpeg',
        path: `/tmp/${fileName}`
      };

      // 上传到COS中间文件目录
      const uploadResult = await cosStorageService.uploadFile({
        file: mockFile,
        category: 'intermediate',
        metadata: {
          taskId,
          userId: task.user_id,
          stepType,
          inputFrom: fileData.inputFrom || 'unknown',
          outputTo: fileData.outputTo || 'unknown',
          processingTime: fileData.processingTime || 0
        }
      });

      // 注册到生命周期管理
      await fileLifecycleService.registerFile({
        key: uploadResult.key,
        category: 'intermediate',
        taskId,
        userId: task.user_id,
        metadata: uploadResult.metadata
      });

      // 记录到任务文件映射
      if (!this.taskFiles.has(taskId)) {
        this.taskFiles.set(taskId, []);
      }
      this.taskFiles.get(taskId).push({
        key: uploadResult.key,
        category: 'intermediate',
        stepType,
        createdAt: new Date()
      });

      // 保存到数据库
      await this.saveFileRecord({
        key: uploadResult.key,
        taskId,
        userId: task.user_id,
        category: 'intermediate',
        stepType,
        size: uploadResult.size,
        metadata: uploadResult.metadata
      });

      return uploadResult;

    } catch (error) {
      logger.error(`[FileManagement] 创建中间文件失败: ${taskId}`, error);
      throw error;
    }
  }

  /**
   * 保存任务结果文件
   * @param {string} taskId - 任务ID
   * @param {Array} resultUrls - 结果URL列表
   * @param {Object} options - 保存选项
   * @returns {Promise<Object>} 保存结果
   */
  async saveTaskResultFiles(taskId, resultUrls, options = {}) {
    try {
      logger.info(`[FileManagement] 保存任务结果文件: ${taskId}`);

      const task = await db('tasks').where('id', taskId).first();
      if (!task) {
        throw new Error(`任务不存在: ${taskId}`);
      }

      const savedFiles = [];

      for (const [index, resultUrl] of resultUrls.entries()) {
        try {
          // 提取文件信息
          const fileName = `result_${index + 1}_${Date.now()}.jpg`;
          const mockFile = {
            name: fileName,
            size: options.fileSize || 2048000,
            type: 'image/jpeg',
            path: `/tmp/${fileName}`
          };

          // 上传到COS结果目录
          const uploadResult = await cosStorageService.uploadFile({
            file: mockFile,
            category: 'result',
            metadata: {
              taskId,
              userId: task.user_id,
              resultIndex: index,
              originalUrl: resultUrl,
              processingCompleted: new Date().toISOString(),
              processingDuration: options.processingDuration || 0
            }
          });

          // 注册到生命周期管理
          await fileLifecycleService.registerFile({
            key: uploadResult.key,
            category: 'result',
            taskId,
            userId: task.user_id,
            metadata: uploadResult.metadata
          });

          // 记录到任务文件映射
          if (!this.taskFiles.has(taskId)) {
            this.taskFiles.set(taskId, []);
          }
          this.taskFiles.get(taskId).push({
            key: uploadResult.key,
            category: 'result',
            resultIndex: index,
            createdAt: new Date()
          });

          // 保存到数据库
          await this.saveFileRecord({
            key: uploadResult.key,
            taskId,
            userId: task.user_id,
            category: 'result',
            resultIndex: index,
            size: uploadResult.size,
            originalUrl: resultUrl,
            metadata: uploadResult.metadata
          });

          savedFiles.push({
            originalUrl: resultUrl,
            managedKey: uploadResult.key,
            managedUrl: uploadResult.url
          });

        } catch (error) {
          logger.error(`[FileManagement] 保存结果文件失败: ${taskId} - ${resultUrl}`, error);
        }
      }

      logger.info(`[FileManagement] 任务结果文件保存完成: ${taskId}, 成功: ${savedFiles.length}/${resultUrls.length}`);

      return {
        success: true,
        taskId,
        savedFiles,
        totalProcessed: resultUrls.length,
        successCount: savedFiles.length
      };

    } catch (error) {
      logger.error(`[FileManagement] 保存任务结果文件失败: ${taskId}`, error);
      throw error;
    }
  }

  /**
   * 清理任务相关文件
   * @param {string} taskId - 任务ID
   * @param {Object} options - 清理选项
   * @returns {Promise<Object>} 清理结果
   */
  async cleanupTaskFiles(taskId, options = {}) {
    try {
      logger.info(`[FileManagement] 清理任务文件: ${taskId}`);

      const {
        categories = ['temp', 'intermediate'], // 不清理result文件
        force = false,
        dryRun = false
      } = options;

      const taskFiles = this.taskFiles.get(taskId) || [];
      const filesToCleanup = taskFiles.filter(file =>
        categories.includes(file.category)
      );

      if (filesToCleanup.length === 0) {
        logger.info(`[FileManagement] 任务无需要清理的文件: ${taskId}`);
        return { success: true, cleanedCount: 0, files: [] };
      }

      let cleanedCount = 0;
      const cleanedFiles = [];

      for (const file of filesToCleanup) {
        try {
          if (!dryRun) {
            // 从COS删除文件
            await cosStorageService.deleteFile(file.key);

            // 更新生命周期状态
            await fileLifecycleService.updateFileStatus(file.key, {
              status: 'deleted',
              deletedAt: new Date()
            });

            // 更新数据库记录
            await db('task_files')
              .where('task_id', taskId)
              .where('file_key', file.key)
              .update({
                status: 'deleted',
                deleted_at: new Date()
              });
          }

          cleanedCount++;
          cleanedFiles.push(file);

        } catch (error) {
          logger.error(`[FileManagement] 清理文件失败: ${file.key}`, error);
        }
      }

      // 更新任务文件映射
      if (cleanedCount > 0) {
        const remainingFiles = taskFiles.filter(file =>
          !categories.includes(file.category) || !cleanedFiles.includes(file)
        );
        this.taskFiles.set(taskId, remainingFiles);
      }

      const result = {
        success: true,
        taskId,
        cleanedCount,
        totalFiles: filesToCleanup.length,
        cleanedFiles,
        dryRun,
        timestamp: new Date().toISOString()
      };

      logger.info(`[FileManagement] 任务文件清理完成: ${taskId}, 清理: ${cleanedCount}/${filesToCleanup.length} ${dryRun ? '(干运行)' : ''}`);

      return result;

    } catch (error) {
      logger.error(`[FileManagement] 清理任务文件失败: ${taskId}`, error);
      throw error;
    }
  }

  /**
   * 获取任务文件列表
   * @param {string} taskId - 任务ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 文件列表
   */
  async getTaskFiles(taskId, options = {}) {
    try {
      const { categories = null, includeDeleted = false } = options;

      let query = db('task_files')
        .where('task_id', taskId);

      if (categories && categories.length > 0) {
        query = query.whereIn('category', categories);
      }

      if (!includeDeleted) {
        query = query.where('status', 'active');
      }

      const files = await query.orderBy('created_at', 'asc');

      return {
        success: true,
        taskId,
        files: files.map(file => ({
          key: file.file_key,
          category: file.category,
          stepType: file.step_type,
          resultIndex: file.result_index,
          size: file.size,
          originalUrl: file.original_url,
          createdAt: file.created_at,
          status: file.status
        })),
        totalCount: files.length
      };

    } catch (error) {
      logger.error(`[FileManagement] 获取任务文件失败: ${taskId}`, error);
      throw error;
    }
  }

  /**
   * 获取文件管理统计
   * @returns {Promise<Object>} 统计信息
   */
  async getFileManagementStats() {
    try {
      // 获取任务文件统计
      const taskFileStats = await db('task_files')
        .select('category', 'status')
        .count('* as count')
        .sum('size as totalSize')
        .groupBy('category', 'status');

      // 获取生命周期统计
      const lifecycleStats = await fileLifecycleService.getLifecycleStats();

      // 获取COS存储统计
      const storageStats = await cosStorageService.getStorageStats();

      // 获取内存中的任务文件映射统计
      const memoryStats = {
        trackedTasks: this.taskFiles.size,
        totalTrackedFiles: Array.from(this.taskFiles.values())
          .reduce((sum, files) => sum + files.length, 0)
      };

      return {
        taskFileStats: taskFileStats || [],
        lifecycleStats,
        storageStats,
        memoryStats,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('[FileManagement] 获取文件管理统计失败:', error);
      throw error;
    }
  }

  /**
   * 健康检查
   * @returns {Promise<Object>} 健康状态
   */
  async healthCheck() {
    try {
      const [cosHealth, lifecycleHealth] = await Promise.all([
        cosStorageService.healthCheck(),
        fileLifecycleService.healthCheck ? fileLifecycleService.healthCheck() : { status: 'healthy' }
      ]);

      const overallStatus = cosHealth.status === 'healthy' &&
                           lifecycleHealth.status === 'healthy' ? 'healthy' : 'degraded';

      return {
        status: overallStatus,
        initialized: this.initialized,
        services: {
          cosStorage: cosHealth,
          fileLifecycle: lifecycleHealth
        },
        memory: {
          trackedTasks: this.taskFiles.size
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('[FileManagement] 健康检查失败:', error);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // 辅助方法

  /**
   * 保存文件记录到数据库
   * @param {Object} fileData - 文件数据
   * @private
   */
  async saveFileRecord(fileData) {
    try {
      await db('task_files').insert({
        task_id: fileData.taskId,
        user_id: fileData.userId,
        file_key: fileData.key,
        category: fileData.category,
        step_type: fileData.stepType,
        result_index: fileData.resultIndex,
        size: fileData.size,
        original_url: fileData.originalUrl,
        metadata: JSON.stringify(fileData.metadata || {}),
        status: 'active',
        created_at: new Date()
      });
    } catch (error) {
      logger.error('[FileManagement] 保存文件记录失败:', error);
      throw error;
    }
  }
}

module.exports = new FileManagementService();