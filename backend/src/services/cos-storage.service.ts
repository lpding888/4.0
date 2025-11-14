import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import logger from '../utils/logger.js';
import type {
  FileCategory,
  FileMetadata,
  FileStorageClass,
  StorageCleanupOptions,
  StorageCleanupResult,
  StorageDeleteResult,
  StorageFileInfo,
  StorageFileListResult,
  StorageStats,
  StorageUploadMetadata,
  StorageUploadOptions,
  StorageUploadResult,
  UploadFileDescriptor,
  UploadProgress
} from '../types/file.types.js';

type UnknownRecord = Record<string, unknown>;

interface LifecycleRuleConfig {
  days: number;
  storageClass?: FileStorageClass;
}

type LifecycleRuleMap = Partial<Record<FileCategory, LifecycleRuleConfig>>;

interface CosServiceConfig {
  SecretId?: string;
  SecretKey?: string;
  Region: string;
  Bucket?: string;
  Domain?: string;
  lifecycleRules: LifecycleRuleMap;
}

interface CosClient {
  uploadFile: (options: UnknownRecord) => Promise<UnknownRecord>;
  downloadFile: (options: UnknownRecord) => Promise<UnknownRecord>;
  deleteFile: (options: UnknownRecord) => Promise<{ deleted: boolean }>;
  getFileList: (options: UnknownRecord) => Promise<UnknownRecord>;
  getFileMeta: (options: UnknownRecord) => Promise<UnknownRecord>;
  updateLifecycle: (rules: UnknownRecord[]) => Promise<{ success: boolean }>;
}

/**
 * COS对象存储服务
 *
 * 提供腾讯云COS集成，支持：
 * - 文件上传/下载
 * - 生命周期管理
 * - 中间文件清理
 * - 存储成本优化
 * - 多媒体处理
 */
interface StorageRuntimeStats {
  totalFiles: number;
  totalSize: number;
  uploadCount: number;
  downloadCount: number;
  deleteCount: number;
  lastCleanup: Date | null;
}

interface StorageHealthStatus {
  status: 'healthy' | 'unhealthy';
  initialized: boolean;
  config: {
    region: string;
    bucket?: string;
  };
  stats: {
    uploadCount: number;
    downloadCount: number;
    deleteCount: number;
    lastCleanup: string | null;
  };
  timestamp: string;
  error?: string;
}

class CosStorageService {
  private config: CosServiceConfig;

  private cosClient: CosClient | null = null;

  private initialized = false;

  private stats: StorageRuntimeStats;

  constructor() {
    this.config = {
      SecretId: process.env.COS_SECRET_ID,
      SecretKey: process.env.COS_SECRET_KEY,
      Region: process.env.COS_REGION || 'ap-guangzhou',
      Bucket: process.env.COS_BUCKET,
      Domain: process.env.COS_DOMAIN,
      // 生命周期配置
      lifecycleRules: {
        // 临时文件：7天后删除
        temp: { days: 7 },
        // 中间文件：30天后删除
        intermediate: { days: 30 },
        // 用户上传：90天后转为低频访问
        userUpload: { days: 90, storageClass: 'Standard_IA' },
        // 处理结果：180天后转为归档存储
        result: { days: 180, storageClass: 'Archive' },
        // 日志文件：30天后删除
        log: { days: 30 }
      }
    };

    // COS客户端（模拟实现）
    this.cosClient = null;
    this.initialized = false;

    // 存储统计
    this.stats = {
      totalFiles: 0,
      totalSize: 0,
      uploadCount: 0,
      downloadCount: 0,
      deleteCount: 0,
      lastCleanup: null
    };
  }

  /**
   * 初始化COS服务
   */
  async initialize() {
    if (this.initialized) {
      logger.warn('[CosStorage] COS服务已初始化');
      return;
    }

    try {
      // 验证配置
      this.validateConfig();

      // 初始化COS客户端（模拟）
      this.cosClient = this.createCosClient();

      // 设置生命周期规则
      await this.setupLifecycleRules();

      this.initialized = true;
      logger.info('[CosStorage] COS服务初始化成功');
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[CosStorage] COS服务初始化失败:', err);
      throw err;
    }
  }

  /**
   * 验证配置
   * @private
   */
  validateConfig() {
    const missing: string[] = [];
    if (!this.config.SecretId) missing.push('SecretId');
    if (!this.config.SecretKey) missing.push('SecretKey');
    if (!this.config.Region) missing.push('Region');
    if (!this.config.Bucket) missing.push('Bucket');
    if (missing.length > 0) {
      throw new Error(`COS配置缺少必要参数: ${missing.join(', ')}`);
    }
  }

  /**
   * 创建COS客户端（模拟）
   * @private
   */
  private createCosClient(): CosClient {
    // 在实际项目中，这里会初始化真实的COS SDK
    return {
      uploadFile: async (options: UnknownRecord) => this.mockUploadFile(options),
      downloadFile: async (options: UnknownRecord) => this.mockDownloadFile(options),
      deleteFile: async (options: UnknownRecord) => this.mockDeleteFile(options),
      getFileList: async (options: UnknownRecord) => this.mockGetFileList(options),
      getFileMeta: async (options: UnknownRecord) => this.mockGetFileMeta(options),
      updateLifecycle: async (rules: UnknownRecord[]) => this.mockUpdateLifecycle(rules)
    };
  }

  private getCosClient(): CosClient {
    if (!this.cosClient) {
      throw new Error('COS client is not initialized');
    }
    return this.cosClient;
  }

  /**
   * 设置生命周期规则
   * @private
   */
  async setupLifecycleRules() {
    try {
      const rules = this.buildLifecycleRules();
      const client = this.getCosClient();
      await client.updateLifecycle(rules);
      logger.info('[CosStorage] 生命周期规则设置完成');
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[CosStorage] 设置生命周期规则失败:', err);
      throw err;
    }
  }

  /**
   * 构建生命周期规则
   * @returns {Array} 生命周期规则列表
   * @private
   */
  buildLifecycleRules(): UnknownRecord[] {
    const rules: UnknownRecord[] = [];

    Object.entries(this.config.lifecycleRules ?? {}).forEach(([prefix, config]) => {
      if (!config) return;
      const rule: UnknownRecord = {
        ID: `rule_${prefix}`,
        Status: 'Enabled',
        Filter: {
          Prefix: `${prefix}/`
        },
        Transitions: [] as UnknownRecord[]
      };

      if (config.storageClass) {
        (rule.Transitions as UnknownRecord[]).push({
          Days: config.days,
          StorageClass: config.storageClass
        });
      }

      // 删除规则
      if (!config.storageClass || config.storageClass === 'Archive') {
        rule.Expiration = {
          Days: (config.days || 0) + (config.storageClass === 'Archive' ? 365 : 0)
        };
      }

      rules.push(rule);
    });

    return rules;
  }

  /**
   * 上传文件
   * @param {Object} options - 上传选项
   * @returns {Promise<Object>} 上传结果
   */
  async uploadFile(options: StorageUploadOptions): Promise<StorageUploadResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const { file, category, metadata = {}, key } = options;
    if (!file || typeof file.name !== 'string' || typeof file.size !== 'number') {
      throw new Error('上传文件必须包含有效的 name 和 size');
    }

    const uploadTime = new Date().toISOString();
    const fileMetadata: StorageUploadMetadata = {
      ...metadata,
      category,
      uploadTime,
      originalName: file.name,
      fileSize: file.size,
      fileType: file.type ?? 'application/octet-stream',
      checksum: await this.calculateChecksum(file)
    };

    try {
      const fileKey = key || this.generateFileKey(file.name, category);
      logger.info(`[CosStorage] 开始上传文件: ${fileKey}`);

      const client = this.getCosClient();
      const onProgress = options.onProgress
        ? (progress: UnknownRecord) => {
            const percent =
              typeof progress === 'number'
                ? Number(progress)
                : Number((progress as { percent?: number }).percent ?? 0);
            const loadedValue = (progress as { loaded?: number }).loaded;
            const totalValue = (progress as { total?: number }).total;
            const payload: UploadProgress = {
              percent,
              loaded: typeof loadedValue === 'number' ? loadedValue : 0,
              total: typeof totalValue === 'number' ? totalValue : undefined
            };
            logger.debug(`[CosStorage] 上传进度 ${fileKey}: ${payload.percent}%`);
            options.onProgress?.(payload);
          }
        : undefined;

      await client.uploadFile({
        file,
        key: fileKey,
        metadata: fileMetadata,
        onProgress
      });

      this.stats.uploadCount++;
      this.stats.totalFiles++;
      this.stats.totalSize += file.size;

      logger.info(`[CosStorage] 文件上传成功: ${fileKey}`);

      return {
        success: true,
        key: fileKey,
        url: this.getFileUrl(fileKey),
        metadata: fileMetadata,
        size: file.size,
        uploadTime
      };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[CosStorage] 文件上传失败:', err);
      throw err;
    }
  }

  /**
   * 下载文件
   * @param {string} key - 文件Key
   * @param {Object} options - 下载选项
   * @returns {Promise<Object>} 下载结果
   */
  async downloadFile(key: string, options: UnknownRecord = {}): Promise<UnknownRecord> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      logger.info(`[CosStorage] 开始下载文件: ${key}`);

      const downloadOptions: UnknownRecord = options ?? {};
      const client = this.getCosClient();
      const result = await client.downloadFile({
        key,
        range: downloadOptions.range,
        onProgress: downloadOptions.onProgress
      });

      // 更新统计
      this.stats.downloadCount++;

      logger.info(`[CosStorage] 文件下载成功: ${key}`);

      return {
        success: true,
        key,
        data: result.data,
        metadata: result.metadata,
        size: result.size
      };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[CosStorage] 文件下载失败: ${key}`, err);
      throw err;
    }
  }

  /**
   * 删除文件
   * @param {string|string[]} keys - 文件Key或Key数组
   * @returns {Promise<Object>} 删除结果
   */
  async deleteFile(keys: string | string[]): Promise<StorageDeleteResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const keyArray = Array.isArray(keys) ? keys : [keys];
    const results: StorageDeleteResult['results'] = [];

    try {
      for (const key of keyArray) {
        logger.info(`[CosStorage] 删除文件: ${key}`);

        const client = this.getCosClient();
        const result = await client.deleteFile({ key });

        results.push({
          key,
          success: true,
          deleted: Boolean(result.deleted)
        });

        if (result.deleted) {
          // 更新统计
          this.stats.deleteCount++;
        }
      }

      logger.info(
        `[CosStorage] 批量删除完成，成功: ${results.filter((r) => r.success).length}/${results.length}`
      );

      return {
        success: true,
        results,
        total: keyArray.length,
        deleted: results.filter((r) => r.deleted).length
      };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[CosStorage] 文件删除失败:', err);
      throw err;
    }
  }

  /**
   * 获取文件列表
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 文件列表
   */
  async getFileList(options: UnknownRecord = {}): Promise<StorageFileListResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const listOptions: UnknownRecord = options ?? {};
    const prefix = typeof listOptions.prefix === 'string' ? listOptions.prefix : '';
    const category =
      typeof listOptions.category === 'string' && this.isFileCategory(listOptions.category)
        ? listOptions.category
        : undefined;
    const maxKeysValue =
      typeof listOptions.maxKeys === 'number'
        ? listOptions.maxKeys
        : Number(listOptions.maxKeys ?? 1000);
    const marker = typeof listOptions.marker === 'string' ? listOptions.marker : '';
    const delimiter = typeof listOptions.delimiter === 'string' ? listOptions.delimiter : '';
    const maxKeys = Number.isFinite(maxKeysValue)
      ? Math.max(1, Math.min(1000, maxKeysValue))
      : 1000;

    try {
      const searchPrefix = category ? `${category}/` : prefix;

      const client = this.getCosClient();
      const result = (await client.getFileList({
        prefix: searchPrefix,
        maxKeys,
        marker,
        delimiter
      })) as UnknownRecord;

      const files: UnknownRecord[] = Array.isArray(result.files) ? result.files : [];
      const directories = Array.isArray(result.directories)
        ? result.directories.filter((item): item is string => typeof item === 'string')
        : [];

      return {
        success: true,
        files: files.map((file) => this.toStorageFileInfo(file)),
        directories,
        isTruncated: Boolean(result.isTruncated),
        nextMarker: typeof result.nextMarker === 'string' ? result.nextMarker : null,
        totalCount: files.length
      };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[CosStorage] 获取文件列表失败:', err);
      throw err;
    }
  }

  /**
   * 清理过期文件
   * @param {Object} options - 清理选项
   * @returns {Promise<Object>} 清理结果
   */
  async cleanupExpiredFiles(options: StorageCleanupOptions = {}): Promise<StorageCleanupResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const categories: FileCategory[] =
      Array.isArray(options.categories) && options.categories.length
        ? options.categories
        : ['temp', 'intermediate'];
    const olderThanDays = options.olderThanDays ?? 7;
    const dryRun = options.dryRun ?? false;
    const batchSize = options.batchSize ?? 100;

    try {
      logger.info(`[CosStorage] 开始清理过期文件 ${dryRun ? '(干运行)' : ''}`);

      const cleanupDate = new Date();
      cleanupDate.setDate(cleanupDate.getDate() - olderThanDays);

      let totalCleaned = 0;
      let totalSize = 0;
      const errors = [];

      for (const category of categories) {
        logger.info(`[CosStorage] 清理类别: ${category}`);

        let marker = '';
        let hasMore = true;

        while (hasMore) {
          const fileList = await this.getFileList({
            category,
            maxKeys: batchSize,
            marker
          });

          const expiredFiles = fileList.files.filter(
            (file) => new Date(file.lastModified) < cleanupDate
          );

          if (expiredFiles.length > 0) {
            if (!dryRun) {
              const deleteResult = await this.deleteFile(expiredFiles.map((file) => file.key));

              const deletedCount = Number(deleteResult.deleted ?? 0);
              totalCleaned += deletedCount;
              totalSize += expiredFiles.reduce((sum, file) => sum + (file.size || 0), 0);

              logger.info(`[CosStorage] 已删除 ${deletedCount} 个${category ?? '全部'}文件`);
            } else {
              totalCleaned += expiredFiles.length;
              totalSize += expiredFiles.reduce((sum, file) => sum + (file.size || 0), 0);
              logger.info(
                `[CosStorage] [干运行] 将删除 ${expiredFiles.length} 个${category ?? '全部'}文件`
              );
            }
          }

          hasMore = Boolean(fileList.isTruncated);
          marker = fileList.nextMarker || '';

          // 避免API限制
          if (hasMore) {
            await this.sleep(100);
          }
        }
      }

      this.stats.lastCleanup = new Date();

      const result = {
        success: true,
        totalCleaned,
        totalSize,
        categories,
        olderThanDays,
        dryRun,
        cleanupDate: cleanupDate.toISOString()
      };

      logger.info(
        `[CosStorage] 清理完成: ${totalCleaned}个文件, 释放空间: ${this.formatBytes(totalSize)}`
      );

      return result;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[CosStorage] 清理过期文件失败:', err);
      throw err;
    }
  }

  /**
   * 获取存储统计信息
   * @returns {Promise<Object>} 统计信息
   */
  async getStorageStats(): Promise<StorageStats> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const categories: FileCategory[] = ['temp', 'intermediate', 'userUpload', 'result', 'log'];
      const categoryStats = {} as StorageStats['categoryStats'];

      for (const category of categories) {
        const fileList = await this.getFileList({ category, maxKeys: 1000 });
        const files = fileList.files;
        const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
        categoryStats[category] = {
          count: files.length,
          totalSize,
          averageSize: files.length > 0 ? totalSize / files.length : 0
        };
      }

      const overallTotals = Object.values(categoryStats).reduce(
        (acc, stat) => {
          acc.totalFiles += stat.count;
          acc.totalSize += stat.totalSize;
          return acc;
        },
        { totalFiles: 0, totalSize: 0 }
      );

      return {
        categoryStats,
        overall: {
          totalFiles: overallTotals.totalFiles,
          totalSize: overallTotals.totalSize,
          averageSize:
            overallTotals.totalFiles > 0 ? overallTotals.totalSize / overallTotals.totalFiles : 0
        },
        storageClassDistribution: await this.getStorageClassDistribution(),
        lastCleanup: this.stats.lastCleanup ? this.stats.lastCleanup.toISOString() : null
      };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[CosStorage] 获取存储统计失败:', err);
      throw err;
    }
  }

  /**
   * 健康检查
   * @returns {Promise<Object>} 健康状态
   */
  async healthCheck(): Promise<StorageHealthStatus> {
    try {
      if (!this.initialized) {
        return {
          status: 'unhealthy',
          initialized: false,
          config: {
            region: this.config.Region,
            bucket: this.config.Bucket
          },
          stats: {
            uploadCount: 0,
            downloadCount: 0,
            deleteCount: 0,
            lastCleanup: null
          },
          timestamp: new Date().toISOString(),
          error: 'COS服务未初始化'
        };
      }

      await this.getFileList({ maxKeys: 1 });

      return {
        status: 'healthy',
        initialized: true,
        config: {
          region: this.config.Region,
          bucket: this.config.Bucket
        },
        stats: {
          uploadCount: this.stats.uploadCount,
          downloadCount: this.stats.downloadCount,
          deleteCount: this.stats.deleteCount,
          lastCleanup: this.stats.lastCleanup ? this.stats.lastCleanup.toISOString() : null
        },
        timestamp: new Date().toISOString()
      };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[CosStorage] 健康检查失败:', err);
      return {
        status: 'unhealthy',
        initialized: this.initialized,
        config: {
          region: this.config.Region,
          bucket: this.config.Bucket
        },
        stats: {
          uploadCount: this.stats.uploadCount,
          downloadCount: this.stats.downloadCount,
          deleteCount: this.stats.deleteCount,
          lastCleanup: this.stats.lastCleanup ? this.stats.lastCleanup.toISOString() : null
        },
        timestamp: new Date().toISOString(),
        error: err.message
      };
    }
  }

  // 辅助方法

  /**
   * 生成文件Key
   * @param {string} originalName - 原始文件名
   * @param {string} category - 文件分类
   * @returns {string} 文件Key
   * @private
   */
  generateFileKey(originalName: string, category: FileCategory): string {
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const extension = originalName.split('.').pop();

    return `${category}/${timestamp}_${randomId}.${extension}`;
  }

  /**
   * 计算文件校验和
   * @param {Object} file - 文件对象
   * @returns {Promise<string>} MD5校验和
   * @private
   */
  async calculateChecksum(file: UploadFileDescriptor): Promise<string> {
    const hash = crypto.createHash('md5');

    if (file.buffer) {
      hash.update(file.buffer);
      return hash.digest('hex');
    }

    if (!file.path) {
      hash.update(`${file.name}-${file.size}`);
      return hash.digest('hex');
    }

    return new Promise((resolve, reject) => {
      const stream = createReadStream(file.path as string);
      stream.on('data', (chunk: string | Buffer) => {
        hash.update(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      });
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * 获取文件URL
   * @param {string} key - 文件Key
   * @returns {string} 文件URL
   * @private
   */
  getFileUrl(key: string): string {
    if (this.config.Domain) {
      return `https://${this.config.Domain}/${key}`;
    }
    return `https://${this.config.Bucket}.cos.${this.config.Region}.myqcloud.com/${key}`;
  }

  private toStorageFileInfo(file: UnknownRecord): StorageFileInfo {
    const key = typeof file.key === 'string' ? file.key : '';
    const sizeRaw = (file as { size?: number }).size;
    const lastModifiedRaw = (file as { lastModified?: string }).lastModified;
    const etagRaw = (file as { etag?: string }).etag;
    const storageClassRaw = (file as { storageClass?: string }).storageClass;

    return {
      key,
      size: typeof sizeRaw === 'number' ? sizeRaw : 0,
      lastModified:
        typeof lastModifiedRaw === 'string' ? lastModifiedRaw : new Date().toISOString(),
      etag: typeof etagRaw === 'string' ? etagRaw : '',
      storageClass: this.toStorageClass(storageClassRaw),
      category: this.extractCategory(key)
    };
  }

  private toStorageClass(value: unknown): FileStorageClass {
    if (value === 'Standard_IA' || value === 'Archive') {
      return value;
    }
    return 'Standard';
  }

  private extractCategory(key: string): FileCategory | 'unknown' {
    const parts = key.split('/');
    const candidate = parts[0] || 'unknown';
    return this.isFileCategory(candidate) ? candidate : 'unknown';
  }

  private isFileCategory(value: string): value is FileCategory {
    return (['temp', 'intermediate', 'userUpload', 'result', 'log'] as FileCategory[]).includes(
      value as FileCategory
    );
  }

  /**
   * 格式化字节数
   * @param {number} bytes - 字节数
   * @returns {string} 格式化后的大小
   * @private
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 获取存储类别分布
   * @returns {Promise<Object>} 存储类别分布
   * @private
   */
  async getStorageClassDistribution(): Promise<Record<FileStorageClass, number>> {
    // 模拟实现
    return {
      Standard: 60,
      Standard_IA: 30,
      Archive: 10
    };
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟毫秒数
   * @private
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 模拟方法（在实际项目中会被真实COS SDK调用替换）

  async mockUploadFile(options: UnknownRecord): Promise<UnknownRecord> {
    await this.sleep(Math.random() * 2000 + 1000);
    const key = typeof options.key === 'string' ? options.key : '';
    return {
      key,
      etag: crypto.randomBytes(16).toString('hex'),
      location: this.getFileUrl(key)
    };
  }

  async mockDownloadFile(options: UnknownRecord): Promise<UnknownRecord> {
    await this.sleep(Math.random() * 1000 + 500);
    return {
      data: Buffer.from('mock file data'),
      metadata: { category: 'temp' },
      size: 1024
    };
  }

  async mockDeleteFile(options: UnknownRecord): Promise<{ deleted: boolean }> {
    await this.sleep(100);
    return { deleted: true };
  }

  async mockGetFileList(options: UnknownRecord): Promise<UnknownRecord> {
    await this.sleep(500);
    const mockFiles: UnknownRecord[] = [];
    const maxKeys = Number(options.maxKeys ?? 10) || 10;
    const count = Math.min(maxKeys, 50);
    const prefix = typeof options.prefix === 'string' ? options.prefix : 'temp/';

    for (let i = 0; i < count; i++) {
      mockFiles.push({
        key: `${prefix}file_${i}.jpg`,
        size: Math.floor(Math.random() * 1000000) + 100000,
        lastModified: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        etag: crypto.randomBytes(16).toString('hex'),
        storageClass: 'Standard'
      });
    }

    return {
      files: mockFiles,
      isTruncated: count >= maxKeys,
      nextMarker: count >= maxKeys ? 'next_marker' : null
    };
  }

  async mockGetFileMeta(options: UnknownRecord): Promise<UnknownRecord> {
    return {
      key: options.key,
      size: 1024000,
      lastModified: new Date().toISOString(),
      metadata: { category: 'temp' }
    };
  }

  async mockUpdateLifecycle(rules: UnknownRecord[]): Promise<{ success: boolean }> {
    await this.sleep(1000);
    return { success: true };
  }
}

const cosStorageService = new CosStorageService();

export default cosStorageService;
