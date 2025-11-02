const logger = require('../utils/logger');
const kmsService = require('../services/kms.service');
const AppError = require('../utils/AppError');
const { ERROR_CODES } = require('../config/error-codes');

/**
 * 密钥管理服务控制器
 *
 * 处理密钥管理相关的HTTP请求：
 * - 密钥生成和管理
 * - 数据加密和解密
 * - 密钥轮换
 * - 密钥信息查询
 * - 操作审计
 */
class KMSController {
  /**
   * 生成密钥
   */
  async generateKey(req, res, next) {
    try {
      const {
        keyName,
        keyAlias,
        keyType = 'AES',
        keyPurpose = 'data_encryption',
        keySize,
        algorithm,
        metadata = {},
        notAfter
      } = req.body;

      // 参数验证
      if (!keyName || !keyName.trim()) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'keyName',
          message: '密钥名称不能为空'
        });
      }

      if (!['AES', 'RSA', 'HMAC'].includes(keyType)) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'keyType',
          message: '无效的密钥类型'
        });
      }

      if (!['data_encryption', 'signing', 'verification', 'key_exchange'].includes(keyPurpose)) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'keyPurpose',
          message: '无效的密钥用途'
        });
      }

      // 验证密钥大小
      let validKeySize = keySize;
      if (!validKeySize) {
        switch (keyType) {
          case 'AES':
            validKeySize = 256;
            break;
          case 'RSA':
            validKeySize = 2048;
            break;
          case 'HMAC':
            validKeySize = 256;
            break;
        }
      }

      const keyConfig = {
        keyName: keyName.trim(),
        keyAlias,
        keyType,
        keyPurpose,
        keySize: validKeySize,
        algorithm: algorithm || `${keyType}-${validKeySize}${keyType === 'AES' ? '-GCM' : ''}`,
        metadata,
        notAfter: notAfter ? new Date(notAfter) : null
      };

      const key = await kmsService.generateKey(keyConfig);

      logger.info(`[KMSController] User ${req.user?.id} generated key: ${keyName}`);

      res.json({
        success: true,
        message: '密钥生成成功',
        data: key
      });

    } catch (error) {
      logger.error('[KMSController] Failed to generate key:', error);
      next(error);
    }
  }

  /**
   * 加密数据
   */
  async encrypt(req, res, next) {
    try {
      const {
        data,
        keyNameOrId,
        dataType = 'general',
        resourceId,
        resourceType,
        additionalData = ''
      } = req.body;

      // 参数验证
      if (!data || typeof data !== 'string') {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'data',
          message: '要加密的数据不能为空'
        });
      }

      if (!keyNameOrId || !keyNameOrId.trim()) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'keyNameOrId',
          message: '密钥名称或ID不能为空'
        });
      }

      const options = {
        dataType,
        resourceId,
        resourceType,
        additionalData,
        createdBy: req.user?.id
      };

      const result = await kmsService.encrypt(data, keyNameOrId.trim(), options);

      logger.info(`[KMSController] User ${req.user?.id} encrypted data with key: ${keyNameOrId}`);

      res.json({
        success: true,
        message: '数据加密成功',
        data: result
      });

    } catch (error) {
      logger.error('[KMSController] Failed to encrypt data:', error);
      next(error);
    }
  }

  /**
   * 解密数据
   */
  async decrypt(req, res, next) {
    try {
      const {
        encryptedDataId,
        keyId,
        algorithm,
        iv,
        tag,
        keyVersion,
        additionalData = ''
      } = req.body;

      // 参数验证
      if (!encryptedDataId) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'encryptedDataId',
          message: '加密数据ID不能为空'
        });
      }

      const options = {
        keyId,
        algorithm,
        iv,
        tag,
        keyVersion,
        additionalData
      };

      const decryptedData = await kmsService.decrypt(encryptedDataId, options);

      logger.info(`[KMSController] User ${req.user?.id} decrypted data`);

      res.json({
        success: true,
        message: '数据解密成功',
        data: decryptedData
      });

    } catch (error) {
      logger.error('[KMSController] Failed to decrypt data:', error);
      next(error);
    }
  }

  /**
   * 轮换密钥
   */
  async rotateKey(req, res, next) {
    try {
      const { keyName } = req.params;
      const {
        keyAlias,
        reason = 'manual',
        description,
        metadata = {}
      } = req.body;

      // 参数验证
      if (!keyName || !keyName.trim()) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'keyName',
          message: '密钥名称不能为空'
        });
      }

      const options = {
        keyAlias,
        reason,
        description,
        metadata,
        performedBy: req.user?.id
      };

      const result = await kmsService.rotateKey(keyName.trim(), options);

      logger.info(`[KMSController] User ${req.user?.id} rotated key: ${keyName}`);

      res.json({
        success: true,
        message: '密钥轮换成功',
        data: result
      });

    } catch (error) {
      logger.error('[KMSController] Failed to rotate key:', error);
      next(error);
    }
  }

  /**
   * 获取密钥信息
   */
  async getKeyInfo(req, res, next) {
    try {
      const { keyNameOrId } = req.params;

      // 参数验证
      if (!keyNameOrId || !keyNameOrId.trim()) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'keyNameOrId',
          message: '密钥名称或ID不能为空'
        });
      }

      const keys = await kmsService.getKeyInfo(keyNameOrId.trim());

      if (keys.length === 0) {
        throw AppError.create(ERROR_CODES.RESOURCE_NOT_FOUND, {
          message: '密钥不存在'
        });
      }

      res.json({
        success: true,
        data: {
          keys,
          total: keys.length
        }
      });

    } catch (error) {
      logger.error('[KMSController] Failed to get key info:', error);
      next(error);
    }
  }

  /**
   * 删除密钥
   */
  async deleteKey(req, res, next) {
    try {
      const { keyNameOrId } = req.params;
      const { force = false } = req.query;

      // 参数验证
      if (!keyNameOrId || !keyNameOrId.trim()) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'keyNameOrId',
          message: '密钥名称或ID不能为空'
        });
      }

      const options = {
        force: force === 'true' || force === true
      };

      const success = await kmsService.deleteKey(keyNameOrId.trim(), options);

      if (!success) {
        throw AppError.create(ERROR_CODES.OPERATION_FAILED, {
          message: '密钥删除失败'
        });
      }

      logger.info(`[KMSController] User ${req.user?.id} deleted key: ${keyNameOrId}`);

      res.json({
        success: true,
        message: '密钥删除成功'
      });

    } catch (error) {
      logger.error('[KMSController] Failed to delete key:', error);
      next(error);
    }
  }

  /**
   * 获取密钥列表
   */
  async listKeys(req, res, next) {
    try {
      const {
        keyType,
        keyPurpose,
        status,
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.query;

      const db = require('../config/database');
      let query = db('encryption_keys')
        .select('id', 'key_name', 'key_alias', 'key_type', 'key_purpose',
                'key_size', 'key_algorithm', 'key_version', 'status', 'is_primary',
                'not_before', 'not_after', 'created_at', 'updated_at');

      // 应用过滤条件
      if (keyType) {
        query = query.where('key_type', keyType);
      }
      if (keyPurpose) {
        query = query.where('key_purpose', keyPurpose);
      }
      if (status) {
        query = query.where('status', status);
      }

      // 应用排序
      const validSortFields = ['created_at', 'updated_at', 'key_name', 'key_type'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
      query = query.orderBy(sortField, sortOrder === 'asc' ? 'asc' : 'desc');

      // 应用分页
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;
      query = query.limit(limitNum).offset(offset);

      const keys = await query;

      // 获取总数
      let countQuery = db('encryption_keys');
      if (keyType) countQuery = countQuery.where('key_type', keyType);
      if (keyPurpose) countQuery = countQuery.where('key_purpose', keyPurpose);
      if (status) countQuery = countQuery.where('status', status);
      const totalCount = await countQuery.count('* as count').first();

      res.json({
        success: true,
        data: {
          keys,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: parseInt(totalCount.count)
          }
        }
      });

    } catch (error) {
      logger.error('[KMSController] Failed to list keys:', error);
      next(error);
    }
  }

  /**
   * 获取加密数据列表
   */
  async listEncryptedData(req, res, next) {
    try {
      const {
        keyId,
        dataType,
        resourceType,
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.query;

      const db = require('../config/database');
      let query = db('encrypted_data')
        .select('id', 'key_id', 'data_type', 'resource_id', 'resource_type',
                'encryption_algorithm', 'key_version', 'created_at', 'updated_at');

      // 应用过滤条件
      if (keyId) {
        query = query.where('key_id', keyId);
      }
      if (dataType) {
        query = query.where('data_type', dataType);
      }
      if (resourceType) {
        query = query.where('resource_type', resourceType);
      }

      // 应用排序
      const validSortFields = ['created_at', 'updated_at', 'data_type'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
      query = query.orderBy(sortField, sortOrder === 'asc' ? 'asc' : 'desc');

      // 应用分页
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;
      query = query.limit(limitNum).offset(offset);

      const encryptedData = await query;

      // 获取总数
      let countQuery = db('encrypted_data');
      if (keyId) countQuery = countQuery.where('key_id', keyId);
      if (dataType) countQuery = countQuery.where('data_type', dataType);
      if (resourceType) countQuery = countQuery.where('resource_type', resourceType);
      const totalCount = await countQuery.count('* as count').first();

      res.json({
        success: true,
        data: {
          encryptedData,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: parseInt(totalCount.count)
          }
        }
      });

    } catch (error) {
      logger.error('[KMSController] Failed to list encrypted data:', error);
      next(error);
    }
  }

  /**
   * 获取操作日志
   */
  async getOperationLogs(req, res, next) {
    try {
      const {
        keyId,
        operationType,
        status,
        page = 1,
        limit = 50,
        sortBy = 'operation_time',
        sortOrder = 'desc'
      } = req.query;

      const db = require('../config/database');
      let query = db('key_operation_logs')
        .select('*');

      // 应用过滤条件
      if (keyId) {
        query = query.where('key_id', keyId);
      }
      if (operationType) {
        query = query.where('operation_type', operationType);
      }
      if (status) {
        query = query.where('status', status);
      }

      // 应用排序
      const validSortFields = ['operation_time', 'operation_type', 'status'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'operation_time';
      query = query.orderBy(sortField, sortOrder === 'asc' ? 'asc' : 'desc');

      // 应用分页
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;
      query = query.limit(limitNum).offset(offset);

      const logs = await query;

      // 获取总数
      let countQuery = db('key_operation_logs');
      if (keyId) countQuery = countQuery.where('key_id', keyId);
      if (operationType) countQuery = countQuery.where('operation_type', operationType);
      if (status) countQuery = countQuery.where('status', status);
      const totalCount = await countQuery.count('* as count').first();

      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: parseInt(totalCount.count)
          }
        }
      });

    } catch (error) {
      logger.error('[KMSController] Failed to get operation logs:', error);
      next(error);
    }
  }

  /**
   * 获取密钥统计信息
   */
  async getKeyStatistics(req, res, next) {
    try {
      const db = require('../config/database');

      // 基础统计
      const [
        totalKeys,
        activeKeys,
        inactiveKeys,
        deprecatedKeys,
        primaryKeys
      ] = await Promise.all([
        db('encryption_keys').count('* as count'),
        db('encryption_keys').where('status', 'active').count('* as count'),
        db('encryption_keys').where('status', 'inactive').count('* as count'),
        db('encryption_keys').where('status', 'deprecated').count('* as count'),
        db('encryption_keys').where('is_primary', true).count('* as count')
      ]);

      // 按类型统计
      const keysByType = await db('encryption_keys')
        .select('key_type')
        .count('* as count')
        .groupBy('key_type');

      // 按用途统计
      const keysByPurpose = await db('encryption_keys')
        .select('key_purpose')
        .count('* as count')
        .groupBy('key_purpose');

      // 按算法统计
      const keysByAlgorithm = await db('encryption_keys')
        .select('key_algorithm')
        .count('* as count')
        .groupBy('key_algorithm');

      // 加密数据统计
      const [
        totalEncryptedData,
        encryptedDataByKeyType
      ] = await Promise.all([
        db('encrypted_data').count('* as count'),
        db('encrypted_data')
          .join('encryption_keys', 'encrypted_data.key_id', '=', 'encryption_keys.id')
          .select('encryption_keys.key_type')
          .count('* as count')
          .groupBy('encryption_keys.key_type')
      ]);

      // 操作日志统计（最近7天）
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentOperations = await db('key_operation_logs')
        .where('operation_time', '>=', sevenDaysAgo)
        .select('operation_type')
        .count('* as count')
        .groupBy('operation_type');

      res.json({
        success: true,
        data: {
          summary: {
            totalKeys: parseInt(totalKeys.count),
            activeKeys: parseInt(activeKeys.count),
            inactiveKeys: parseInt(inactiveKeys.count),
            deprecatedKeys: parseInt(deprecatedKeys.count),
            primaryKeys: parseInt(primaryKeys.count),
            totalEncryptedData: parseInt(totalEncryptedData.count)
          },
          keysByType: keysByType.reduce((acc, item) => {
            acc[item.key_type] = parseInt(item.count);
            return acc;
          }, {}),
          keysByPurpose: keysByPurpose.reduce((acc, item) => {
            acc[item.key_purpose] = parseInt(item.count);
            return acc;
          }, {}),
          keysByAlgorithm: keysByAlgorithm.reduce((acc, item) => {
            acc[item.key_algorithm] = parseInt(item.count);
            return acc;
          }, {}),
          encryptedDataByKeyType: encryptedDataByKeyType.reduce((acc, item) => {
            acc[item.key_type] = parseInt(item.count);
            return acc;
          }, {}),
          recentOperations: recentOperations.reduce((acc, item) => {
            acc[item.operation_type] = parseInt(item.count);
            return acc;
          }, {})
        }
      });

    } catch (error) {
      logger.error('[KMSController] Failed to get key statistics:', error);
      next(error);
    }
  }

  /**
   * 获取系统配置
   */
  async getSystemConfig(req, res, next) {
    try {
      const db = require('../config/database');
      const configs = await db('kms_system_config')
        .select('*')
        .orderBy('config_key');

      const configMap = {};
      configs.forEach(config => {
        let value = config.config_value;
        if (config.config_type === 'json') {
          try {
            value = JSON.parse(value);
          } catch (e) {
            value = value;
          }
        } else if (config.config_type === 'number') {
          value = parseInt(value);
        } else if (config.config_type === 'boolean') {
          value = value === 'true';
        }

        configMap[config.config_key] = {
          value,
          type: config.config_type,
          description: config.config_description,
          isSensitive: config.is_sensitive,
          updatedAt: config.updated_at
        };
      });

      res.json({
        success: true,
        data: configMap
      });

    } catch (error) {
      logger.error('[KMSController] Failed to get system config:', error);
      next(error);
    }
  }

  /**
   * 更新系统配置
   */
  async updateSystemConfig(req, res, next) {
    try {
      const { configKey, configValue } = req.body;

      // 参数验证
      if (!configKey || !configKey.trim()) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'configKey',
          message: '配置键不能为空'
        });
      }

      const db = require('../config/database');

      // 获取现有配置
      const existingConfig = await db('kms_system_config')
        .where('config_key', configKey.trim())
        .first();

      if (!existingConfig) {
        throw AppError.create(ERROR_CODES.RESOURCE_NOT_FOUND, {
          message: '配置不存在'
        });
      }

      // 转换值
      let processedValue = configValue;
      if (existingConfig.config_type === 'json') {
        processedValue = typeof configValue === 'string' ? configValue : JSON.stringify(configValue);
      } else if (existingConfig.config_type === 'boolean') {
        processedValue = configValue.toString();
      } else if (existingConfig.config_type === 'number') {
        processedValue = configValue.toString();
      } else {
        processedValue = configValue.toString();
      }

      // 更新配置
      await db('kms_system_config')
        .where('config_key', configKey.trim())
        .update({
          config_value: processedValue,
          updated_by: req.user?.id,
          updated_at: new Date()
        });

      logger.info(`[KMSController] User ${req.user?.id} updated system config: ${configKey}`);

      res.json({
        success: true,
        message: '系统配置更新成功'
      });

    } catch (error) {
      logger.error('[KMSController] Failed to update system config:', error);
      next(error);
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(req, res, next) {
    try {
      const db = require('../config/database');

      // 检查数据库连接
      await db('encryption_keys').select(1).first();

      // 检查服务状态
      const serviceStatus = {
        initialized: kmsService.initialized,
        cacheSize: kmsService.keyCache.size,
        masterKeyLoaded: !!kmsService.masterKey
      };

      // 检查活跃密钥数量
      const activeKeyCount = await db('encryption_keys')
        .where('status', 'active')
        .where('is_primary', true)
        .count('* as count')
        .first();

      res.json({
        success: true,
        data: {
          status: 'healthy',
          service: serviceStatus,
          activeKeyCount: parseInt(activeKeyCount.count),
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('[KMSController] Health check failed:', error);
      res.status(503).json({
        success: false,
        error: 'KMS service unhealthy',
        details: error.message
      });
    }
  }
}

module.exports = new KMSController();