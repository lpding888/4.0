import type { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES } from '../config/error-codes.js';
import { db as knex } from '../config/database.js';
import type {
  KeyGenerationConfig,
  KeyListQuery,
  EncryptRequest,
  DecryptRequest,
  DeleteKeyOptions
} from '../types/kms.types.js';
import type { Knex } from 'knex';
type KmsServiceInstance = typeof import('../services/kms.service.js').default;

const loadKmsService = async (): Promise<KmsServiceInstance> => {
  const module = await import('../services/kms.service.js');
  return (module.default ?? module) as KmsServiceInstance;
};

class KMSController {
  async generateKey(req: Request, res: Response, next: NextFunction): Promise<void> {
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
      } = (req.body ?? {}) as KeyGenerationConfig & { keyName: string };

      if (!keyName || !String(keyName).trim()) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'keyName',
          message: '密钥名称不能为空'
        });
      }
      if (!['AES', 'RSA', 'HMAC'].includes(String(keyType))) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'keyType',
          message: '无效的密钥类型'
        });
      }
      if (
        !['data_encryption', 'signing', 'verification', 'key_exchange'].includes(String(keyPurpose))
      ) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'keyPurpose',
          message: '无效的密钥用途'
        });
      }

      let validKeySize = keySize as number | undefined;
      if (!validKeySize) {
        if (keyType === 'AES' || keyType === 'HMAC') validKeySize = 256;
        else if (keyType === 'RSA') validKeySize = 2048;
      }

      const svc = await loadKmsService();
      const key = await svc.generateKey({
        keyName: String(keyName).trim(),
        keyAlias,
        keyType,
        keyPurpose,
        keySize: validKeySize,
        algorithm: algorithm || `${keyType}-${validKeySize}${keyType === 'AES' ? '-GCM' : ''}`,
        metadata,
        notAfter: notAfter ? new Date(notAfter) : null
      });

      logger.info(`[KMSController] User ${req.user?.id ?? 'unknown'} generated key: ${keyName}`);
      res.json({ success: true, message: '密钥生成成功', data: key });
    } catch (error) {
      logger.error('[KMSController] Failed to generate key:', error);
      next(error);
    }
  }

  async encrypt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        data,
        keyNameOrId,
        dataType = 'general',
        resourceId,
        resourceType,
        additionalData = ''
      } = (req.body ?? {}) as EncryptRequest;
      if (!data || typeof data !== 'string') {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'data',
          message: '要加密的数据不能为空'
        });
      }
      if (!keyNameOrId || !String(keyNameOrId).trim()) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'keyNameOrId',
          message: '密钥名称或ID不能为空'
        });
      }
      const svc = await loadKmsService();
      const result = await svc.encrypt(data, String(keyNameOrId).trim(), {
        dataType,
        resourceId,
        resourceType,
        additionalData
      });
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('[KMSController] Failed to encrypt:', error);
      next(error);
    }
  }

  async decrypt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        cipherText,
        keyNameOrId,
        dataType = 'general',
        resourceId,
        resourceType,
        additionalData = ''
      } = (req.body ?? {}) as DecryptRequest;
      if (!cipherText || typeof cipherText !== 'string') {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'cipherText',
          message: '密文不能为空'
        });
      }
      if (!keyNameOrId || !String(keyNameOrId).trim()) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'keyNameOrId',
          message: '密钥名称或ID不能为空'
        });
      }
      const svc = await loadKmsService();
      const result = await svc.decrypt(cipherText, {
        keyId: String(keyNameOrId).trim(),
        dataType,
        resourceId,
        resourceType,
        additionalData
      });
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('[KMSController] Failed to decrypt:', error);
      next(error);
    }
  }

  async deleteKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { keyNameOrId } = req.params as { keyNameOrId: string };
      const { force = false } = (req.query ?? {}) as Record<string, string | boolean>;
      if (!keyNameOrId || !String(keyNameOrId).trim()) {
        throw AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'keyNameOrId',
          message: '密钥名称或ID不能为空'
        });
      }
      const svc = await loadKmsService();
      const options: DeleteKeyOptions = {
        force: force === 'true' || force === true
      };
      const success = await svc.deleteKey(String(keyNameOrId).trim(), options);
      if (!success) {
        throw AppError.create(ERROR_CODES.INTERNAL_SERVER_ERROR, {
          message: '密钥删除失败'
        });
      }
      logger.info(`[KMSController] User ${req.user?.id ?? 'unknown'} deleted key: ${keyNameOrId}`);
      res.json({ success: true, message: '密钥删除成功' });
    } catch (error) {
      logger.error('[KMSController] Failed to delete key:', error);
      next(error);
    }
  }

  async listKeys(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        keyType,
        keyPurpose,
        status,
        page = '1',
        limit = '20',
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = (req.query ?? {}) as KeyListQuery;
      const validSortFields = ['created_at', 'updated_at', 'key_name', 'key_type'];
      const sortField = validSortFields.includes(String(sortBy)) ? sortBy : 'created_at';
      const pageNum = Number.parseInt(String(page), 10);
      const limitNum = Number.parseInt(String(limit), 10);
      const offset = (pageNum - 1) * limitNum;

      let query: Knex.QueryBuilder = knex('encryption_keys').select(
        'id',
        'key_name',
        'key_alias',
        'key_type',
        'key_purpose',
        'key_size',
        'key_algorithm',
        'key_version',
        'status',
        'is_primary',
        'not_before',
        'not_after',
        'created_at',
        'updated_at'
      );
      if (keyType) query = query.where('key_type', keyType);
      if (keyPurpose) query = query.where('key_purpose', keyPurpose);
      if (status) query = query.where('status', status);
      query = query
        .orderBy(sortField, sortOrder === 'asc' ? 'asc' : 'desc')
        .limit(limitNum)
        .offset(offset);

      const keys = await query;
      let countQuery: Knex.QueryBuilder = knex('encryption_keys');
      if (keyType) countQuery = countQuery.where('key_type', keyType);
      if (keyPurpose) countQuery = countQuery.where('key_purpose', keyPurpose);
      if (status) countQuery = countQuery.where('status', status);
      const totalCount = (await countQuery.count('* as count').first()) as
        | { count: number }
        | undefined;

      res.json({
        success: true,
        data: {
          keys,
          pagination: { page: pageNum, limit: limitNum, total: Number(totalCount?.count ?? 0) }
        }
      });
    } catch (error) {
      logger.error('[KMSController] Failed to list keys:', error);
      next(error);
    }
  }

  // 路由兼容方法（与 kms.routes.ts 对齐）
  async getKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const svc = await loadKmsService();
      const info = await svc.getKeyInfo?.(String(id));
      res.json({ success: true, data: info ?? [], requestId: req.id });
    } catch (error) {
      next(error);
    }
  }

  async createKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // 兼容：将 name 映射到 keyName
      const body = req.body as Record<string, unknown>;
      body.keyName = body.name ?? body.keyName;
      await this.generateKey(req, res, next);
    } catch (error) {
      next(error);
    }
  }

  async updateKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // 兼容：暂时返回成功，实际应调用 rotateKey
      res.json({ success: true, message: '密钥更新功能暂未实现（需要密钥轮换）' });
    } catch (error) {
      next(error);
    }
  }
}

export default new KMSController();
