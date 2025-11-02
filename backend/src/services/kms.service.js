const crypto = require('crypto');
const logger = require('../utils/logger');
const db = require('../config/database');
const cacheService = require('./cache.service');
const AppError = require('../utils/AppError');
const { ERROR_CODES } = require('../config/error-codes');

/**
 * 密钥管理服务
 *
 * 提供企业级密钥管理功能：
 * - 密钥生成和管理
 * - 数据加密和解密
 * - 密钥轮换和版本控制
 * - 访问控制和审计
 * - 密钥生命周期管理
 */
class KMSService {
  constructor() {
    this.initialized = false;
    this.cachePrefix = 'kms:';
    this.cacheTTL = 300; // 5分钟缓存
    this.keyCache = new Map(); // 内存密钥缓存
    this.masterKey = null; // 主密钥（从环境变量或安全存储获取）
    this.algorithmMap = {
      'AES-256-GCM': { type: 'AES', keySize: 256, mode: 'GCM' },
      'AES-256-CBC': { type: 'AES', keySize: 256, mode: 'CBC' },
      'AES-128-GCM': { type: 'AES', keySize: 128, mode: 'GCM' },
      'RSA-2048': { type: 'RSA', keySize: 2048 },
      'RSA-3072': { type: 'RSA', keySize: 3072 },
      'RSA-4096': { type: 'RSA', keySize: 4096 },
      'HMAC-SHA256': { type: 'HMAC', keySize: 256 },
      'HMAC-SHA512': { type: 'HMAC', keySize: 512 }
    };
  }

  /**
   * 初始化KMS服务
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('[KMSService] Initializing KMS service...');

      // 测试数据库连接
      await db('encryption_keys').select(1).first();

      // 加载主密钥（实际应用中应从安全存储获取）
      await this.loadMasterKey();

      // 预加载活跃密钥到内存
      await this.loadActiveKeys();

      // 启动密钥轮换检查定时器
      this.startKeyRotationChecker();

      this.initialized = true;
      logger.info('[KMSService] KMS service initialized successfully');

    } catch (error) {
      logger.error('[KMSService] Failed to initialize KMS service:', error);
      throw error;
    }
  }

  /**
   * 生成密钥
   * @param {Object} keyConfig - 密钥配置
   * @returns {Object} 生成的密钥信息
   */
  async generateKey(keyConfig) {
    try {
      const {
        keyName,
        keyAlias = null,
        keyType = 'AES',
        keyPurpose = 'data_encryption',
        keySize = 256,
        algorithm = 'AES-256-GCM',
        metadata = {},
        notAfter = null
      } = keyConfig;

      // 检查密钥名称是否已存在
      const existingKey = await this.getActiveKey(keyName);
      if (existingKey) {
        throw AppError.create(ERROR_CODES.DUPLICATE_RESOURCE, {
          message: `密钥名称 ${keyName} 已存在`
        });
      }

      const now = new Date();
      let keyMaterial = {};
      let keyId = crypto.randomUUID();

      switch (keyType) {
        case 'AES':
          keyMaterial = await this.generateAESKey(keySize);
          break;
        case 'RSA':
          keyMaterial = await this.generateRSAKey(keySize);
          break;
        case 'HMAC':
          keyMaterial = await this.generateHMACKey(keySize);
          break;
        default:
          throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
            message: `不支持的密钥类型: ${keyType}`
          });
      }

      // 加密存储密钥材料
      const encryptedPrivateKey = keyMaterial.privateKey ?
        await this.encryptKeyMaterial(keyMaterial.privateKey) : null;
      const encryptedSymmetricKey = keyMaterial.symmetricKey ?
        await this.encryptKeyMaterial(keyMaterial.symmetricKey) : null;

      // 创建数据库记录
      const [key] = await db('encryption_keys')
        .insert({
          id: keyId,
          key_name: keyName,
          key_alias: keyAlias,
          key_type: keyType,
          key_purpose: keyPurpose,
          key_size: keySize,
          key_algorithm: algorithm,
          public_key: keyMaterial.publicKey || null,
          private_key: encryptedPrivateKey,
          symmetric_key: encryptedSymmetricKey,
          key_version: '1',
          status: 'active',
          is_primary: true,
          key_metadata: metadata,
          not_before: now,
          not_after: notAfter,
          created_at: now,
          updated_at: now
        })
        .returning('*');

      // 记录操作日志
      await this.logKeyOperation(keyId, 'generate', '密钥生成成功', {
        keyType,
        keySize,
        algorithm
      });

      // 缓存密钥到内存
      this.keyCache.set(keyId, {
        ...keyMaterial,
        ...key,
        loadedAt: now
      });

      logger.info(`[KMSService] Generated ${keyType} key: ${keyName}`);

      // 返回不包含敏感信息的密钥数据
      return {
        id: key.id,
        keyName: key.key_name,
        keyAlias: key.key_alias,
        keyType: key.key_type,
        keyPurpose: key.key_purpose,
        keySize: key.key_size,
        algorithm: key.key_algorithm,
        keyVersion: key.key_version,
        status: key.status,
        isPrimary: key.is_primary,
        notBefore: key.not_before,
        notAfter: key.not_after,
        publicKey: key.public_key
      };

    } catch (error) {
      logger.error('[KMSService] Failed to generate key:', error);
      throw AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 加密数据
   * @param {string} data - 要加密的数据
   * @param {string} keyNameOrId - 密钥名称或ID
   * @param {Object} options - 加密选项
   * @returns {Object} 加密结果
   */
  async encrypt(data, keyNameOrId, options = {}) {
    try {
      const key = await this.getKeyForEncryption(keyNameOrId);
      if (!key) {
        throw AppError.create(ERROR_CODES.RESOURCE_NOT_FOUND, {
          message: '密钥不存在或不可用'
        });
      }

      let encryptedData;
      const additionalData = options.additionalData || '';

      switch (key.key_type) {
        case 'AES':
          encryptedData = await this.encryptWithAES(data, key, additionalData);
          break;
        case 'RSA':
          encryptedData = await this.encryptWithRSA(data, key);
          break;
        default:
          throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
            message: `不支持的加密类型: ${key.key_type}`
          });
      }

      // 保存加密数据记录
      const [encryptedRecord] = await db('encrypted_data')
        .insert({
          key_id: key.id,
          data_type: options.dataType || 'general',
          resource_id: options.resourceId,
          resource_type: options.resourceType,
          encrypted_data: encryptedData.encrypted,
          encryption_metadata: JSON.stringify(encryptedData.metadata),
          encryption_algorithm: encryptedData.algorithm,
          iv: encryptedData.iv,
          tag: encryptedData.tag,
          key_version: key.key_version,
          additional_data: additionalData,
          created_by: options.createdBy,
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*');

      // 记录操作日志
      await this.logKeyOperation(key.id, 'encrypt', '数据加密成功', {
        dataType: options.dataType,
        algorithm: encryptedData.algorithm
      });

      logger.info(`[KMSService] Encrypted data with key: ${key.key_name}`);

      return {
        id: encryptedRecord.id,
        encryptedData: encryptedData.encrypted,
        algorithm: encryptedData.algorithm,
        keyId: key.id,
        keyVersion: key.key_version,
        metadata: encryptedData.metadata
      };

    } catch (error) {
      logger.error('[KMSService] Failed to encrypt data:', error);
      throw AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 解密数据
   * @param {string} encryptedDataId - 加密数据ID或加密数据
   * @param {Object} options - 解密选项
   * @returns {string} 解密后的数据
   */
  async decrypt(encryptedDataId, options = {}) {
    try {
      let encryptedRecord;

      // 如果传入的是加密数据ID，从数据库获取记录
      if (typeof encryptedDataId === 'string' && encryptedDataId.length === 36) {
        encryptedRecord = await db('encrypted_data')
          .where('id', encryptedDataId)
          .first();
      } else {
        // 如果传入的是加密数据，直接使用
        encryptedRecord = {
          key_id: options.keyId,
          encrypted_data: encryptedDataId,
          encryption_algorithm: options.algorithm,
          iv: options.iv,
          tag: options.tag,
          key_version: options.keyVersion,
          additional_data: options.additionalData
        };
      }

      if (!encryptedRecord) {
        throw AppError.create(ERROR_CODES.RESOURCE_NOT_FOUND, {
          message: '加密数据不存在'
        });
      }

      const key = await this.getKeyForDecryption(encryptedRecord.key_id, encryptedRecord.key_version);
      if (!key) {
        throw AppError.create(ERROR_CODES.RESOURCE_NOT_FOUND, {
          message: '解密密钥不存在或不可用'
        });
      }

      let decryptedData;

      switch (key.key_type) {
        case 'AES':
          decryptedData = await this.decryptWithAES(encryptedRecord, key);
          break;
        case 'RSA':
          decryptedData = await this.decryptWithRSA(encryptedRecord, key);
          break;
        default:
          throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
            message: `不支持的解密类型: ${key.key_type}`
          });
      }

      // 记录操作日志
      await this.logKeyOperation(key.id, 'decrypt', '数据解密成功', {
        algorithm: encryptedRecord.encryption_algorithm
      });

      logger.info(`[KMSService] Decrypted data with key: ${key.key_name}`);

      return decryptedData;

    } catch (error) {
      logger.error('[KMSService] Failed to decrypt data:', error);
      throw AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 轮换密钥
   * @param {string} keyName - 密钥名称
   * @param {Object} options - 轮换选项
   * @returns {Object} 轮换结果
   */
  async rotateKey(keyName, options = {}) {
    try {
      const currentKey = await this.getActiveKey(keyName);
      if (!currentKey) {
        throw AppError.create(ERROR_CODES.RESOURCE_NOT_FOUND, {
          message: `密钥 ${keyName} 不存在`
        });
      }

      // 创建新密钥
      const newKeyConfig = {
        keyName,
        keyAlias: options.keyAlias,
        keyType: currentKey.key_type,
        keyPurpose: currentKey.key_purpose,
        keySize: currentKey.key_size,
        algorithm: currentKey.key_algorithm,
        metadata: options.metadata || {}
      };

      const newKey = await this.generateKey(newKeyConfig);

      // 更新旧密钥状态
      await db('encryption_keys')
        .where('id', currentKey.id)
        .update({
          is_primary: false,
          status: 'deprecated',
          updated_at: new Date()
        });

      // 创建轮换历史记录
      await db('key_rotation_history')
        .insert({
          key_name: keyName,
          old_key_id: currentKey.id,
          new_key_id: newKey.id,
          rotation_reason: options.reason || 'manual',
          rotation_description: options.description || '手动密钥轮换',
          status: 'completed',
          performed_by: options.performedBy,
          rotation_started_at: new Date(),
          rotation_completed_at: new Date(),
          created_at: new Date(),
          updated_at: new Date()
        });

      // 更新轮换计划
      await this.updateRotationSchedule(keyName, newKey.id);

      // 记录操作日志
      await this.logKeyOperation(newKey.id, 'rotate', '密钥轮换成功', {
        oldKeyId: currentKey.id,
        rotationReason: options.reason
      });

      // 从缓存中移除旧密钥
      this.keyCache.delete(currentKey.id);

      logger.info(`[KMSService] Rotated key: ${keyName} from v${currentKey.key_version} to v${newKey.keyVersion}`);

      return {
        oldKey: {
          id: currentKey.id,
          keyVersion: currentKey.key_version
        },
        newKey: {
          id: newKey.id,
          keyVersion: newKey.keyVersion
        }
      };

    } catch (error) {
      logger.error('[KMSService] Failed to rotate key:', error);
      throw AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 获取密钥信息
   * @param {string} keyNameOrId - 密钥名称或ID
   * @returns {Object} 密钥信息
   */
  async getKeyInfo(keyNameOrId) {
    try {
      let query = db('encryption_keys')
        .select('id', 'key_name', 'key_alias', 'key_type', 'key_purpose',
                'key_size', 'key_algorithm', 'key_version', 'status', 'is_primary',
                'not_before', 'not_after', 'key_metadata', 'created_at', 'updated_at');

      // 判断是名称还是ID
      if (keyNameOrId.length === 36) {
        query = query.where('id', keyNameOrId);
      } else {
        query = query.where('key_name', keyNameOrId);
      }

      const keys = await query.orderBy('key_version', 'desc');

      return keys.map(key => ({
        ...key,
        keyMetadata: key.key_metadata ? JSON.parse(key.key_metadata) : null
      }));

    } catch (error) {
      logger.error('[KMSService] Failed to get key info:', error);
      throw AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 删除密钥
   * @param {string} keyNameOrId - 密钥名称或ID
   * @param {Object} options - 删除选项
   * @returns {boolean} 是否删除成功
   */
  async deleteKey(keyNameOrId, options = {}) {
    try {
      const key = await this.getKeyByKeyNameOrId(keyNameOrId);
      if (!key) {
        throw AppError.create(ERROR_CODES.RESOURCE_NOT_FOUND, {
          message: '密钥不存在'
        });
      }

      // 检查是否有数据依赖
      const dataCount = await db('encrypted_data')
        .where('key_id', key.id)
        .count('* as count')
        .first();

      if (parseInt(dataCount.count) > 0 && !options.force) {
        throw AppError.create(ERROR_CODES.RESOURCE_IN_USE, {
          message: '密钥正在使用中，无法删除'
        });
      }

      // 软删除密钥
      await db('encryption_keys')
        .where('id', key.id)
        .update({
          status: 'destroyed',
          updated_at: new Date()
        });

      // 从缓存中移除
      this.keyCache.delete(key.id);

      // 记录操作日志
      await this.logKeyOperation(key.id, 'delete', '密钥删除成功', {
        force: options.force || false,
        dataCount: parseInt(dataCount.count)
      });

      logger.info(`[KMSService] Deleted key: ${key.key_name}`);

      return true;

    } catch (error) {
      logger.error('[KMSService] Failed to delete key:', error);
      throw AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 生成AES密钥
   * @param {number} keySize - 密钥长度
   * @returns {Object} 密钥材料
   */
  async generateAESKey(keySize) {
    const key = crypto.randomBytes(keySize / 8);
    return {
      symmetricKey: key.toString('base64'),
      keySize
    };
  }

  /**
   * 生成RSA密钥对
   * @param {number} keySize - 密钥长度
   * @returns {Object} 密钥材料
   */
  async generateRSAKey(keySize) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: keySize,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    return {
      publicKey,
      privateKey,
      keySize
    };
  }

  /**
   * 生成HMAC密钥
   * @param {number} keySize - 密钥长度
   * @returns {Object} 密钥材料
   */
  async generateHMACKey(keySize) {
    const key = crypto.randomBytes(keySize / 8);
    return {
      symmetricKey: key.toString('base64'),
      keySize
    };
  }

  /**
   * 使用AES加密
   * @param {string} data - 要加密的数据
   * @param {Object} key - 密钥信息
   * @param {string} additionalData - 附加数据
   * @returns {Object} 加密结果
   */
  async encryptWithAES(data, key, additionalData = '') {
    const keyMaterial = Buffer.from(key.symmetricKey, 'base64');
    const iv = crypto.randomBytes(16); // AES-GCM需要16字节的IV

    let cipher;
    let encrypted;
    let tag;

    if (key.key_algorithm.includes('GCM')) {
      cipher = crypto.createCipher('aes-256-gcm', keyMaterial);
      cipher.setAAD(Buffer.from(additionalData));
      encrypted = Buffer.concat([
        cipher.update(data, 'utf8'),
        cipher.final()
      ]);
      tag = cipher.getAuthTag();
    } else {
      cipher = crypto.createCipher('aes-256-cbc', keyMaterial);
      encrypted = Buffer.concat([
        cipher.update(data, 'utf8'),
        cipher.final()
      ]);
    }

    return {
      encrypted: encrypted.toString('base64'),
      algorithm: key.key_algorithm,
      iv: iv.toString('base64'),
      tag: tag ? tag.toString('base64') : null,
      metadata: {
        ivLength: iv.length,
        tagLength: tag ? tag.length : 0,
        additionalDataLength: additionalData.length
      }
    };
  }

  /**
   * 使用AES解密
   * @param {Object} encryptedRecord - 加密记录
   * @param {Object} key - 密钥信息
   * @returns {string} 解密后的数据
   */
  async decryptWithAES(encryptedRecord, key) {
    const keyMaterial = Buffer.from(key.symmetricKey, 'base64');
    const encrypted = Buffer.from(encryptedRecord.encrypted_data, 'base64');
    const iv = Buffer.from(encryptedRecord.iv, 'base64');
    const tag = encryptedRecord.tag ? Buffer.from(encryptedRecord.tag, 'base64') : null;

    let decipher;
    let decrypted;

    if (encryptedRecord.encryption_algorithm.includes('GCM')) {
      decipher = crypto.createDecipher('aes-256-gcm', keyMaterial);
      decipher.setAAD(Buffer.from(encryptedRecord.additional_data || ''));
      if (tag) {
        decipher.setAuthTag(tag);
      }
      decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
    } else {
      decipher = crypto.createDecipher('aes-256-cbc', keyMaterial);
      decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
    }

    return decrypted.toString('utf8');
  }

  /**
   * 使用RSA加密
   * @param {string} data - 要加密的数据
   * @param {Object} key - 密钥信息
   * @returns {Object} 加密结果
   */
  async encryptWithRSA(data, key) {
    const publicKey = key.public_key;
    const encrypted = crypto.publicEncrypt(publicKey, Buffer.from(data));

    return {
      encrypted: encrypted.toString('base64'),
      algorithm: key.key_algorithm,
      metadata: {
        keySize: key.key_size
      }
    };
  }

  /**
   * 使用RSA解密
   * @param {Object} encryptedRecord - 加密记录
   * @param {Object} key - 密钥信息
   * @returns {string} 解密后的数据
   */
  async decryptWithRSA(encryptedRecord, key) {
    const privateKey = Buffer.from(key.private_key, 'base64');
    const encrypted = Buffer.from(encryptedRecord.encrypted_data, 'base64');
    const decrypted = crypto.privateDecrypt(privateKey, encrypted);

    return decrypted.toString('utf8');
  }

  /**
   * 加密密钥材料
   * @param {string} keyMaterial - 密钥材料
   * @returns {string} 加密后的密钥材料
   */
  async encryptKeyMaterial(keyMaterial) {
    if (!this.masterKey) {
      throw new Error('Master key not available');
    }

    const cipher = crypto.createCipher('aes-256-cbc', this.masterKey);
    let encrypted = cipher.update(keyMaterial);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return encrypted.toString('base64');
  }

  /**
   * 解密密钥材料
   * @param {string} encryptedKeyMaterial - 加密的密钥材料
   * @returns {string} 解密后的密钥材料
   */
  async decryptKeyMaterial(encryptedKeyMaterial) {
    if (!this.masterKey) {
      throw new Error('Master key not available');
    }

    const decipher = crypto.createDecipher('aes-256-cbc', this.masterKey);
    let decrypted = decipher.update(Buffer.from(encryptedKeyMaterial, 'base64'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString();
  }

  /**
   * 加载主密钥
   */
  async loadMasterKey() {
    // 实际应用中应从安全存储（如HSM、KMS）获取
    // 这里使用环境变量作为演示
    const masterKeyHex = process.env.KMS_MASTER_KEY;
    if (!masterKeyHex) {
      // 生成临时主密钥（仅用于开发环境）
      this.masterKey = crypto.randomBytes(32).toString('hex');
      logger.warn('[KMSService] Using temporary master key for development');
    } else {
      this.masterKey = Buffer.from(masterKeyHex, 'hex');
    }
  }

  /**
   * 加载活跃密钥
   */
  async loadActiveKeys() {
    try {
      const activeKeys = await db('encryption_keys')
        .where('status', 'active')
        .where('is_primary', true)
        .select('*');

      for (const key of activeKeys) {
        if (key.symmetric_key) {
          key.symmetricKey = await this.decryptKeyMaterial(key.symmetric_key);
        }
        if (key.private_key) {
          key.privateKey = await this.decryptKeyMaterial(key.private_key);
        }

        this.keyCache.set(key.id, {
          ...key,
          loadedAt: new Date()
        });
      }

      logger.info(`[KMSService] Loaded ${activeKeys.length} active keys into memory`);

    } catch (error) {
      logger.error('[KMSService] Failed to load active keys:', error);
    }
  }

  /**
   * 获取用于加密的密钥
   * @param {string} keyNameOrId - 密钥名称或ID
   * @returns {Object} 密钥信息
   */
  async getKeyForEncryption(keyNameOrId) {
    // 先从缓存查找
    for (const [keyId, key] of this.keyCache.entries()) {
      if ((key.key_name === keyNameOrId || keyId === keyNameOrId) &&
          key.status === 'active' && key.is_primary) {
        return key;
      }
    }

    // 从数据库查找
    let key;
    if (keyNameOrId.length === 36) {
      key = await db('encryption_keys')
        .where('id', keyNameOrId)
        .where('status', 'active')
        .where('is_primary', true)
        .first();
    } else {
      key = await db('encryption_keys')
        .where('key_name', keyNameOrId)
        .where('status', 'active')
        .where('is_primary', true)
        .first();
    }

    if (!key) {
      return null;
    }

    // 解密密钥材料
    if (key.symmetric_key) {
      key.symmetricKey = await this.decryptKeyMaterial(key.symmetric_key);
    }
    if (key.private_key) {
      key.privateKey = await this.decryptKeyMaterial(key.private_key);
    }

    // 缓存到内存
    this.keyCache.set(key.id, {
      ...key,
      loadedAt: new Date()
    });

    return key;
  }

  /**
   * 获取用于解密的密钥
   * @param {string} keyId - 密钥ID
   * @param {string} keyVersion - 密钥版本
   * @returns {Object} 密钥信息
   */
  async getKeyForDecryption(keyId, keyVersion) {
    // 先从缓存查找
    if (this.keyCache.has(keyId)) {
      const key = this.keyCache.get(keyId);
      if (key.key_version === keyVersion) {
        return key;
      }
    }

    // 从数据库查找
    const key = await db('encryption_keys')
      .where('id', keyId)
      .where('key_version', keyVersion)
      .first();

    if (!key) {
      return null;
    }

    // 解密密钥材料
    if (key.symmetric_key) {
      key.symmetricKey = await this.decryptKeyMaterial(key.symmetric_key);
    }
    if (key.private_key) {
      key.privateKey = await this.decryptKeyMaterial(key.private_key);
    }

    // 缓存到内存
    this.keyCache.set(keyId, {
      ...key,
      loadedAt: new Date()
    });

    return key;
  }

  /**
   * 获取活跃密钥
   * @param {string} keyName - 密钥名称
   * @returns {Object} 密钥信息
   */
  async getActiveKey(keyName) {
    return await this.getKeyForEncryption(keyName);
  }

  /**
   * 根据名称或ID获取密钥
   * @param {string} keyNameOrId - 密钥名称或ID
   * @returns {Object} 密钥信息
   */
  async getKeyByKeyNameOrId(keyNameOrId) {
    let key;
    if (keyNameOrId.length === 36) {
      key = await db('encryption_keys').where('id', keyNameOrId).first();
    } else {
      key = await db('encryption_keys').where('key_name', keyNameOrId).first();
    }
    return key;
  }

  /**
   * 记录密钥操作日志
   * @param {string} keyId - 密钥ID
   * @param {string} operationType - 操作类型
   * @param {string} description - 操作描述
   * @param {Object} operationData - 操作数据
   */
  async logKeyOperation(keyId, operationType, description, operationData = {}) {
    try {
      await db('key_operation_logs')
        .insert({
          key_id: keyId,
          operation_type: operationType,
          operation_description: description,
          operator_type: 'service',
          status: 'success',
          operation_data: operationData,
          operation_time: new Date()
        });
    } catch (error) {
      logger.error('[KMSService] Failed to log key operation:', error);
    }
  }

  /**
   * 更新轮换计划
   * @param {string} keyName - 密钥名称
   * @param {string} newKeyId - 新密钥ID
   */
  async updateRotationSchedule(keyName, newKeyId) {
    try {
      await db('key_rotation_schedules')
        .insert({
          key_name: keyName,
          current_key_id: newKeyId,
          rotation_type: 'manual',
          rotation_interval_days: 365,
          next_rotation_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        })
        .onConflict('key_name')
        .merge({
          current_key_id: newKeyId,
          next_rotation_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          updated_at: new Date()
        });
    } catch (error) {
      logger.error('[KMSService] Failed to update rotation schedule:', error);
    }
  }

  /**
   * 启动密钥轮换检查定时器
   */
  startKeyRotationChecker() {
    // 每小时检查一次是否需要轮换密钥
    setInterval(async () => {
      try {
        await this.checkKeyRotations();
      } catch (error) {
        logger.error('[KMSService] Key rotation check failed:', error);
      }
    }, 60 * 60 * 1000);
  }

  /**
   * 检查密钥轮换
   */
  async checkKeyRotations() {
    try {
      const schedules = await db('key_rotation_schedules')
        .where('is_active', true)
        .where('next_rotation_at', '<=', new Date())
        .select('*');

      for (const schedule of schedules) {
        logger.info(`[KMSService] Auto-rotating key: ${schedule.key_name}`);
        await this.rotateKey(schedule.key_name, {
          reason: 'scheduled',
          description: '定时密钥轮换'
        });
      }
    } catch (error) {
      logger.error('[KMSService] Failed to check key rotations:', error);
    }
  }

  /**
   * 关闭服务
   */
  async close() {
    try {
      // 清理内存缓存
      this.keyCache.clear();

      this.initialized = false;
      logger.info('[KMSService] KMS service closed');
    } catch (error) {
      logger.error('[KMSService] Error closing KMS service:', error);
    }
  }
}

module.exports = new KMSService();