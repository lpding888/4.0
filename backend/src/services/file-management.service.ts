import logger from '../utils/logger.js';
import cosStorageService from './cos-storage.service.js';
import fileLifecycleService from './file-lifecycle.service.js';
import { db } from '../config/database.js';
import type {
  FileCategory,
  FileMetadata,
  StorageUploadOptions,
  StorageUploadResult,
  TaskFileCleanupOptions,
  TaskFileCleanupResult,
  TaskFileListOptions,
  TaskFileListResponse,
  TaskFileRecord,
  TaskFileRecordInput,
  TaskFileRecordSummary,
  UploadFileDescriptor
} from '../types/file.types.js';

interface FileOptions {
  fileSize?: number;
  processingDuration?: number;
  categories?: FileCategory[];
  force?: boolean;
  dryRun?: boolean;
  includeDeleted?: boolean;
}

interface IntermediateFilePayload extends TaskFileRecordInput {
  inputFrom?: string;
  outputTo?: string;
  processingTime?: number;
  type?: string;
}

interface ManagedResultFile {
  originalUrl: string | Record<string, unknown>;
  managedKey: string;
  managedUrl?: string;
}

interface SaveResultSummary {
  success: boolean;
  taskId: string;
  savedFiles: ManagedResultFile[];
  totalProcessed: number;
  successCount: number;
}

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
  private initialized = false;

  private taskFiles: Map<string, TaskFileRecordSummary[]> = new Map();

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
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('[FileManagement] 初始化失败:', err);
      throw err;
    }
  }

  /**
   * 处理用户上传文件
   * @param {Object} file - 上传的文件
   * @param {string} userId - 用户ID
   * @param {Object} options - 上传选项
   * @returns {Promise<Object>} 上传结果
   */
  async handleUserUpload(
    file: UploadFileDescriptor,
    userId: string,
    _options: FileOptions = {}
  ): Promise<StorageUploadResult> {
    try {
      logger.info(`[FileManagement] 处理用户上传: ${file.name}`);

      // 上传到COS
      const uploadResult = await this.uploadToCos({
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
        metadata: uploadResult.metadata,
        size: uploadResult.size
      });

      logger.info(`[FileManagement] 用户上传处理完成: ${uploadResult.key}`);

      return uploadResult;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('[FileManagement] 处理用户上传失败:', err);
      throw err;
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
  async createTaskTempFile(
    taskId: string,
    userId: string,
    file: UploadFileDescriptor,
    stepType = 'input'
  ): Promise<StorageUploadResult> {
    try {
      logger.info(`[FileManagement] 创建任务临时文件: ${taskId} - ${stepType}`);

      // 上传到COS临时目录
      const uploadResult = await this.uploadToCos({
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
      const lifecycleRegistration = await fileLifecycleService.registerFile({
        key: uploadResult.key,
        category: 'temp',
        taskId,
        userId,
        metadata: uploadResult.metadata,
        size: uploadResult.size
      });

      // 记录到任务文件映射
      const taskFiles = this.taskFiles.get(taskId) ?? [];
      taskFiles.push({
        key: uploadResult.key,
        category: 'temp',
        stepType,
        createdAt: new Date(),
        lifecycleId: lifecycleRegistration.fileId
      });
      this.taskFiles.set(taskId, taskFiles);

      // 保存到数据库
      await this.saveFileRecord({
        key: uploadResult.key,
        taskId,
        userId,
        category: 'temp',
        stepType,
        size: uploadResult.size,
        originalUrl: file.path,
        metadata: uploadResult.metadata
      });

      return uploadResult;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error(`[FileManagement] 创建任务临时文件失败: ${taskId}`, err);
      throw err;
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
  async createIntermediateFile(
    taskId: string,
    stepType: string,
    fileData: TaskFileRecordInput,
    options: FileOptions = {}
  ): Promise<StorageUploadResult> {
    try {
      logger.info(`[FileManagement] 创建中间文件: ${taskId} - ${stepType}`);

      // 获取任务信息
      const task = await db('tasks').where('id', taskId).first();
      if (!task) {
        throw new Error(`任务不存在: ${taskId}`);
      }

      // 模拟文件上传（在实际项目中，这里会上传真实的文件数据）
      const fileName = `${stepType}_${Date.now()}.jpg`;
      const mockFile: UploadFileDescriptor = {
        name: fileName,
        size: fileData.size || 1024000,
        type:
          fileData.type ||
          (typeof fileData.metadata?.fileType === 'string'
            ? (fileData.metadata.fileType as string)
            : 'image/jpeg'),
        path: `/tmp/${fileName}`
      };

      // 上传到COS中间文件目录
      const uploadResult = await this.uploadToCos({
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
      const lifecycleRegistration = await fileLifecycleService.registerFile({
        key: uploadResult.key,
        category: 'intermediate',
        taskId,
        userId: task.user_id,
        metadata: uploadResult.metadata,
        size: uploadResult.size
      });

      // 记录到任务文件映射
      const intermediateFiles = this.taskFiles.get(taskId) ?? [];
      intermediateFiles.push({
        key: uploadResult.key,
        category: 'intermediate',
        stepType,
        createdAt: new Date(),
        lifecycleId: lifecycleRegistration.fileId
      });
      this.taskFiles.set(taskId, intermediateFiles);

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
    } catch (error: unknown) {
      const err = error as Error;
      logger.error(`[FileManagement] 创建中间文件失败: ${taskId}`, err);
      throw err;
    }
  }

  /**
   * 保存任务结果文件
   * @param {string} taskId - 任务ID
   * @param {Array} resultUrls - 结果URL列表
   * @param {Object} options - 保存选项
   * @returns {Promise<Object>} 保存结果
   */
  async saveTaskResultFiles(
    taskId: string,
    resultUrls: Array<string | Record<string, unknown>> = [],
    options: FileOptions = {}
  ): Promise<SaveResultSummary> {
    try {
      logger.info(`[FileManagement] 保存任务结果文件: ${taskId}`);

      const task = await db('tasks').where('id', taskId).first();
      if (!task) {
        throw new Error(`任务不存在: ${taskId}`);
      }

      const savedFiles: ManagedResultFile[] = [];
      const normalizedResultUrls = Array.isArray(resultUrls) ? resultUrls : [resultUrls];

      for (const [index, resultUrl] of normalizedResultUrls.entries()) {
        try {
          const normalizedUrl =
            typeof resultUrl === 'string' ? resultUrl : JSON.stringify(resultUrl ?? {});
          // 提取文件信息
          const fileName = `result_${index + 1}_${Date.now()}.jpg`;
          const mockFile: UploadFileDescriptor = {
            name: fileName,
            size: options.fileSize || 2048000,
            type: 'image/jpeg',
            path: `/tmp/${fileName}`
          };

          // 上传到COS结果目录
          const uploadResult = await this.uploadToCos({
            file: mockFile,
            category: 'result',
            metadata: {
              taskId,
              userId: task.user_id,
              resultIndex: index,
              originalUrl: normalizedUrl,
              processingCompleted: new Date().toISOString(),
              processingDuration: options.processingDuration || 0
            }
          });

          // 注册到生命周期管理
          const lifecycleRegistration = await fileLifecycleService.registerFile({
            key: uploadResult.key,
            category: 'result',
            taskId,
            userId: task.user_id,
            metadata: uploadResult.metadata,
            size: uploadResult.size
          });

          // 记录到任务文件映射
          const resultTaskFiles = this.taskFiles.get(taskId) ?? [];
          resultTaskFiles.push({
            key: uploadResult.key,
            category: 'result',
            resultIndex: index,
            createdAt: new Date(),
            lifecycleId: lifecycleRegistration.fileId
          });
          this.taskFiles.set(taskId, resultTaskFiles);

          // 保存到数据库
          await this.saveFileRecord({
            key: uploadResult.key,
            taskId,
            userId: task.user_id,
            category: 'result',
            resultIndex: index,
            size: uploadResult.size,
            originalUrl: typeof resultUrl === 'string' ? resultUrl : JSON.stringify(resultUrl),
            metadata: uploadResult.metadata
          });

          savedFiles.push({
            originalUrl: resultUrl,
            managedKey: uploadResult.key,
            managedUrl: uploadResult.url
          });
        } catch (error: unknown) {
          const err = error as Error;
          logger.error(`[FileManagement] 保存结果文件失败: ${taskId} - ${resultUrl}`, err);
        }
      }

      logger.info(
        `[FileManagement] 任务结果文件保存完成: ${taskId}, 成功: ${savedFiles.length}/${resultUrls.length}`
      );

      return {
        success: true,
        taskId,
        savedFiles,
        totalProcessed: resultUrls.length,
        successCount: savedFiles.length
      };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error(`[FileManagement] 保存任务结果文件失败: ${taskId}`, err);
      throw err;
    }
  }

  /**
   * 清理任务相关文件
   * @param {string} taskId - 任务ID
   * @param {Object} options - 清理选项
   * @returns {Promise<Object>} 清理结果
   */
  async cleanupTaskFiles(
    taskId: string,
    options: TaskFileCleanupOptions = {}
  ): Promise<TaskFileCleanupResult> {
    try {
      logger.info(`[FileManagement] 清理任务文件: ${taskId}`);

      const { categories = ['temp', 'intermediate'], dryRun = false } = options;

      const taskFiles = this.taskFiles.get(taskId) ?? [];
      const filesToCleanup = taskFiles.filter((file) => categories.includes(file.category));

      if (filesToCleanup.length === 0) {
        logger.info(`[FileManagement] 任务无需要清理的文件: ${taskId}`);
        return {
          success: true,
          taskId,
          cleanedCount: 0,
          totalFiles: 0,
          cleanedFiles: [],
          dryRun,
          timestamp: new Date().toISOString()
        };
      }

      let cleanedCount = 0;
      const cleanedFiles: TaskFileRecordSummary[] = [];

      for (const file of filesToCleanup) {
        try {
          if (!dryRun) {
            // 从COS删除文件
            await cosStorageService.deleteFile(file.key);

            // 更新生命周期状态
            await this.markLifecycleDeleted(file);

            // 更新数据库记录
            await db('task_files').where('task_id', taskId).where('file_key', file.key).update({
              status: 'deleted',
              deleted_at: new Date()
            });
          }

          cleanedCount++;
          cleanedFiles.push(file);
        } catch (error: unknown) {
          const err = error as Error;
          logger.error(`[FileManagement] 清理文件失败: ${file.key}`, err);
        }
      }

      // 更新任务文件映射
      if (cleanedCount > 0) {
        const remainingFiles = taskFiles.filter(
          (file) => !categories.includes(file.category) || !cleanedFiles.includes(file)
        );
        this.taskFiles.set(taskId, remainingFiles);
      }

      const result: TaskFileCleanupResult = {
        success: true,
        taskId,
        cleanedCount,
        totalFiles: filesToCleanup.length,
        cleanedFiles,
        dryRun,
        timestamp: new Date().toISOString()
      };

      logger.info(
        `[FileManagement] 任务文件清理完成: ${taskId}, 清理: ${cleanedCount}/${filesToCleanup.length} ${dryRun ? '(干运行)' : ''}`
      );

      return result;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error(`[FileManagement] 清理任务文件失败: ${taskId}`, err);
      throw err;
    }
  }

  /**
   * 获取任务文件列表
   * @param {string} taskId - 任务ID
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 文件列表
   */
  async getTaskFiles(
    taskId: string,
    options: TaskFileListOptions = {}
  ): Promise<TaskFileListResponse> {
    try {
      const { categories = null, includeDeleted = false } = options;

      let query = db('task_files').where('task_id', taskId);

      if (categories && categories.length > 0) {
        query = query.whereIn('category', categories);
      }

      if (!includeDeleted) {
        query = query.where('status', 'active');
      }

      const rows = await query.orderBy('created_at', 'asc');
      const files: TaskFileRecord[] = rows.map((file) => ({
        id: file.id,
        task_id: file.task_id,
        user_id: file.user_id,
        file_key: file.file_key,
        category: file.category,
        step_type: file.step_type,
        result_index: file.result_index,
        size: file.size,
        original_url: file.original_url,
        metadata: this.parseMetadata(file.metadata),
        status: file.status,
        created_at: file.created_at,
        updated_at: file.updated_at,
        deleted_at: file.deleted_at
      }));

      return {
        files,
        totalCount: files.length
      };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error(`[FileManagement] 获取任务文件失败: ${taskId}`, err);
      throw err;
    }
  }

  /**
   * 获取文件管理统计
   * @returns {Promise<Object>} 统计信息
   */
  async getFileManagementStats(): Promise<Record<string, unknown>> {
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
        totalTrackedFiles: Array.from(this.taskFiles.values()).reduce(
          (sum, files) => sum + files.length,
          0
        )
      };

      return {
        taskFileStats: taskFileStats || [],
        lifecycleStats,
        storageStats,
        memoryStats,
        timestamp: new Date().toISOString()
      };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('[FileManagement] 获取文件管理统计失败:', err);
      throw err;
    }
  }

  /**
   * 健康检查
   * @returns {Promise<Object>} 健康状态
   */
  async healthCheck(): Promise<Record<string, unknown>> {
    try {
      const [cosHealth, lifecycleHealth] = await Promise.all([
        cosStorageService.healthCheck(),
        fileLifecycleService.healthCheck()
      ]);

      const overallStatus =
        cosHealth.status === 'healthy' && lifecycleHealth.status === 'healthy'
          ? 'healthy'
          : 'degraded';

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
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('[FileManagement] 健康检查失败:', err);
      return {
        status: 'unhealthy',
        error: err.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // 辅助方法

  private uploadToCos(options: StorageUploadOptions): Promise<StorageUploadResult> {
    return cosStorageService.uploadFile(options);
  }

  private parseMetadata(raw: unknown): FileMetadata {
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as FileMetadata;
      } catch (error) {
        logger.warn('[FileManagement] 解析文件元数据失败，返回空对象', { error });
        return {};
      }
    }
    return (raw as FileMetadata) ?? {};
  }

  private async markLifecycleDeleted(file: TaskFileRecordSummary): Promise<void> {
    const payload = {
      status: 'deleted' as const,
      deleted_at: new Date()
    };

    if (file.lifecycleId) {
      await fileLifecycleService.updateFileStatus(file.lifecycleId, payload);
      return;
    }

    const lifecycleRecord = await db('file_lifecycle_records')
      .select('id')
      .where('key', file.key)
      .first();

    if (lifecycleRecord?.id) {
      await fileLifecycleService.updateFileStatus(lifecycleRecord.id, payload);
    }
  }

  /**
   * 保存文件记录到数据库
   * @param {Object} fileData - 文件数据
   * @private
   */
  async saveFileRecord(fileData: TaskFileRecordInput): Promise<void> {
    try {
      if (!fileData.taskId) {
        throw new Error('任务文件记录必须包含 taskId');
      }

      await db('task_files').insert({
        task_id: fileData.taskId,
        user_id: fileData.userId,
        file_key: fileData.key,
        category: fileData.category,
        step_type: fileData.stepType,
        result_index: fileData.resultIndex,
        size: fileData.size,
        original_url: fileData.originalUrl,
        metadata: JSON.stringify(fileData.metadata ?? {}),
        status: 'active',
        created_at: new Date()
      });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('[FileManagement] 保存文件记录失败:', err);
      throw err;
    }
  }
}

const fileManagementService = new FileManagementService();

export default fileManagementService;
