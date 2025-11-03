const logger = require('../utils/logger');
const crypto = require('crypto');

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
class CosStorageService {
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

    } catch (error) {
      logger.error('[CosStorage] COS服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 验证配置
   * @private
   */
  validateConfig() {
    const required = ['SecretId', 'SecretKey', 'Region', 'Bucket'];
    const missing = required.filter(key => !this.config[key]);

    if (missing.length > 0) {
      throw new Error(`COS配置缺少必要参数: ${missing.join(', ')}`);
    }
  }

  /**
   * 创建COS客户端（模拟）
   * @private
   */
  createCosClient() {
    // 在实际项目中，这里会初始化真实的COS SDK
    return {
      uploadFile: async (options) => this.mockUploadFile(options),
      downloadFile: async (options) => this.mockDownloadFile(options),
      deleteFile: async (options) => this.mockDeleteFile(options),
      getFileList: async (options) => this.mockGetFileList(options),
      getFileMeta: async (options) => this.mockGetFileMeta(options),
      updateLifecycle: async (rules) => this.mockUpdateLifecycle(rules)
    };
  }

  /**
   * 设置生命周期规则
   * @private
   */
  async setupLifecycleRules() {
    try {
      const rules = this.buildLifecycleRules();
      await this.cosClient.updateLifecycle(rules);
      logger.info('[CosStorage] 生命周期规则设置完成');
    } catch (error) {
      logger.error('[CosStorage] 设置生命周期规则失败:', error);
      throw error;
    }
  }

  /**
   * 构建生命周期规则
   * @returns {Array} 生命周期规则列表
   * @private
   */
  buildLifecycleRules() {
    const rules = [];

    Object.entries(this.config.lifecycleRules).forEach(([prefix, config]) => {
      const rule = {
        ID: `rule_${prefix}`,
        Status: 'Enabled',
        Filter: {
          Prefix: `${prefix}/`
        },
        Transitions: []
      };

      if (config.storageClass) {
        rule.Transitions.push({
          Days: config.days,
          StorageClass: config.storageClass
        });
      }

      // 删除规则
      if (!config.storageClass || config.storageClass === 'Archive') {
        rule.Expiration = {
          Days: config.days + (config.storageClass === 'Archive' ? 365 : 0)
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
  async uploadFile(options) {
    if (!this.initialized) {
      await this.initialize();
    }

    const {
      file,
      key,
      category = 'temp', // temp, intermediate, userUpload, result, log
      metadata = {},
      onProgress
    } = options;

    try {
      // 生成唯一Key
      const fileKey = key || this.generateFileKey(file.name, category);

      // 添加文件元数据
      const fileMetadata = {
        ...metadata,
        category,
        uploadTime: new Date().toISOString(),
        originalName: file.name,
        fileSize: file.size,
        fileType: file.type,
        checksum: await this.calculateChecksum(file)
      };

      logger.info(`[CosStorage] 开始上传文件: ${fileKey}`);

      const result = await this.cosClient.uploadFile({
        file,
        key: fileKey,
        metadata: fileMetadata,
        onProgress: (progress) => {
          logger.debug(`[CosStorage] 上传进度 ${fileKey}: ${progress}%`);
          if (onProgress) onProgress(progress);
        }
      });

      // 更新统计
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
        uploadTime: fileMetadata.uploadTime
      };

    } catch (error) {
      logger.error('[CosStorage] 文件上传失败:', error);
      throw error;
    }
  }

  /**
   * 下载文件
   * @param {string} key - 文件Key
   * @param {Object} options - 下载选项
   * @returns {Promise<Object>} 下载结果
   */
  async downloadFile(key, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      logger.info(`[CosStorage] 开始下载文件: ${key}`);

      const result = await this.cosClient.downloadFile({
        key,
        range: options.range,
        onProgress: options.onProgress
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

    } catch (error) {
      logger.error(`[CosStorage] 文件下载失败: ${key}`, error);
      throw error;
    }
  }

  /**
   * 删除文件
   * @param {string|string[]} keys - 文件Key或Key数组
   * @returns {Promise<Object>} 删除结果
   */
  async deleteFile(keys) {
    if (!this.initialized) {
      await this.initialize();
    }

    const keyArray = Array.isArray(keys) ? keys : [keys];
    const results = [];

    try {
      for (const key of keyArray) {
        logger.info(`[CosStorage] 删除文件: ${key}`);

        const result = await this.cosClient.deleteFile({ key });

        results.push({
          key,
          success: true,
          deleted: result.deleted
        });

        if (result.deleted) {
          // 更新统计
          this.stats.deleteCount++;
        }
      }

      logger.info(`[CosStorage] 批量删除完成，成功: ${results.filter(r => r.success).length}/${results.length}`);

      return {
        success: true,
        results,
        total: keyArray.length,
        deleted: results.filter(r => r.deleted).length
      };

    } catch (error) {
      logger.error('[CosStorage] 文件删除失败:', error);
      throw error;
    }
  }

  /**
   * 获取文件列表
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 文件列表
   */
  async getFileList(options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const {
      prefix = '',
      category,
      maxKeys = 1000,
      marker = '',
      delimiter = ''
    } = options;

    try {
      const searchPrefix = category ? `${category}/` : prefix;

      const result = await this.cosClient.getFileList({
        prefix: searchPrefix,
        maxKeys,
        marker,
        delimiter
      });

      return {
        success: true,
        files: result.files.map(file => ({
          key: file.key,
          size: file.size,
          lastModified: file.lastModified,
          etag: file.etag,
          storageClass: file.storageClass,
          category: this.extractCategory(file.key)
        })),
        directories: result.directories || [],
        isTruncated: result.isTruncated,
        nextMarker: result.nextMarker,
        totalCount: result.files.length
      };

    } catch (error) {
      logger.error('[CosStorage] 获取文件列表失败:', error);
      throw error;
    }
  }

  /**
   * 清理过期文件
   * @param {Object} options - 清理选项
   * @returns {Promise<Object>} 清理结果
   */
  async cleanupExpiredFiles(options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const {
      categories = ['temp', 'intermediate'],
      olderThanDays = 7,
      dryRun = false,
      batchSize = 100
    } = options;

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

          // 过滤过期文件
          const expiredFiles = fileList.files.filter(file =>
            new Date(file.lastModified) < cleanupDate
          );

          if (expiredFiles.length > 0) {
            if (!dryRun) {
              const deleteResult = await this.deleteFile(
                expiredFiles.map(file => file.key)
              );

              totalCleaned += deleteResult.deleted;
              totalSize += expiredFiles.reduce((sum, file) => sum + file.size, 0);

              logger.info(`[CosStorage] 已删除 ${deleteResult.deleted} 个${category}文件`);
            } else {
              totalCleaned += expiredFiles.length;
              totalSize += expiredFiles.reduce((sum, file) => sum + file.size, 0);
              logger.info(`[CosStorage] [干运行] 将删除 ${expiredFiles.length} 个${category}文件`);
            }
          }

          hasMore = fileList.isTruncated;
          marker = fileList.nextMarker;

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

      logger.info(`[CosStorage] 清理完成: ${totalCleaned}个文件, 释放空间: ${this.formatBytes(totalSize)}`);

      return result;

    } catch (error) {
      logger.error('[CosStorage] 清理过期文件失败:', error);
      throw error;
    }
  }

  /**
   * 获取存储统计信息
   * @returns {Promise<Object>} 统计信息
   */
  async getStorageStats() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // 获取各分类文件统计
      const categoryStats = {};
      const categories = ['temp', 'intermediate', 'userUpload', 'result', 'log'];

      for (const category of categories) {
        const fileList = await this.getFileList({ category, maxKeys: 1000 });
        categoryStats[category] = {
          count: fileList.files.length,
          totalSize: fileList.files.reduce((sum, file) => sum + file.size, 0),
          avgSize: fileList.files.length > 0 ?
            fileList.files.reduce((sum, file) => sum + file.size, 0) / fileList.files.length : 0
        };
      }

      return {
        ...this.stats,
        categoryStats,
        storageClassDistribution: await this.getStorageClassDistribution(),
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      logger.error('[CosStorage] 获取存储统计失败:', error);
      throw error;
    }
  }

  /**
   * 健康检查
   * @returns {Promise<Object>} 健康状态
   */
  async healthCheck() {
    try {
      if (!this.initialized) {
        return {
          status: 'unhealthy',
          error: 'COS服务未初始化',
          timestamp: new Date().toISOString()
        };
      }

      // 尝试获取一个小的文件列表来测试连接
      await this.getFileList({ maxKeys: 1 });

      return {
        status: 'healthy',
        initialized: this.initialized,
        config: {
          region: this.config.Region,
          bucket: this.config.Bucket
        },
        stats: {
          uploadCount: this.stats.uploadCount,
          downloadCount: this.stats.downloadCount,
          deleteCount: this.stats.deleteCount,
          lastCleanup: this.stats.lastCleanup
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('[CosStorage] 健康检查失败:', error);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
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
  generateFileKey(originalName, category) {
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
  async calculateChecksum(file) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const stream = require('fs').createReadStream(file.path);

      stream.on('data', (data) => hash.update(data));
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
  getFileUrl(key) {
    if (this.config.Domain) {
      return `https://${this.config.Domain}/${key}`;
    }
    return `https://${this.config.Bucket}.cos.${this.config.Region}.myqcloud.com/${key}`;
  }

  /**
   * 从Key中提取分类
   * @param {string} key - 文件Key
   * @returns {string} 分类
   * @private
   */
  extractCategory(key) {
    const parts = key.split('/');
    return parts[0] || 'unknown';
  }

  /**
   * 格式化字节数
   * @param {number} bytes - 字节数
   * @returns {string} 格式化后的大小
   * @private
   */
  formatBytes(bytes) {
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
  async getStorageClassDistribution() {
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
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 模拟方法（在实际项目中会被真实COS SDK调用替换）

  async mockUploadFile(options) {
    await this.sleep(Math.random() * 2000 + 1000);
    return {
      key: options.key,
      etag: crypto.randomBytes(16).toString('hex'),
      location: this.getFileUrl(options.key)
    };
  }

  async mockDownloadFile(options) {
    await this.sleep(Math.random() * 1000 + 500);
    return {
      data: Buffer.from('mock file data'),
      metadata: { category: 'temp' },
      size: 1024
    };
  }

  async mockDeleteFile(options) {
    await this.sleep(100);
    return { deleted: true };
  }

  async mockGetFileList(options) {
    await this.sleep(500);
    const mockFiles = [];
    const count = Math.min(parseInt(options.maxKeys) || 10, 50);

    for (let i = 0; i < count; i++) {
      mockFiles.push({
        key: `${options.prefix || 'temp/'}file_${i}.jpg`,
        size: Math.floor(Math.random() * 1000000) + 100000,
        lastModified: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        etag: crypto.randomBytes(16).toString('hex'),
        storageClass: 'Standard'
      });
    }

    return {
      files: mockFiles,
      isTruncated: count >= parseInt(options.maxKeys),
      nextMarker: count >= parseInt(options.maxKeys) ? 'next_marker' : null
    };
  }

  async mockGetFileMeta(options) {
    return {
      key: options.key,
      size: 1024000,
      lastModified: new Date().toISOString(),
      metadata: { category: 'temp' }
    };
  }

  async mockUpdateLifecycle(rules) {
    await this.sleep(1000);
    return { success: true };
  }
}

module.exports = new CosStorageService();