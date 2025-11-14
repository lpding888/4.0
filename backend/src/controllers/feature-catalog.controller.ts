import type { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES } from '../config/error-codes.js';
import type { SupportedLanguageCode } from '../config/i18n-messages.js';
import featureCatalogService, {
  type FeatureUsageMetrics,
  type FeatureUsageError,
  type FeatureMetricValue
} from '../services/feature-catalog.service.js';

type FeatureListQuery = {
  category?: string;
  type?: string;
  is_public?: string;
  tags?: string;
  limit?: string;
  offset?: string;
  sort_by?: string;
  sort_order?: string;
};

type FeatureUsageBody = {
  usageCount?: number;
  metrics?: Record<string, unknown>;
  cost?: number;
  status?: string;
  errorDetails?: unknown;
};

const timestamp = (): string => new Date().toISOString();

const respondValidationError = (
  req: Request,
  res: Response,
  code: number = ERROR_CODES.INVALID_PARAMETERS,
  fallback = 'Invalid parameters'
): boolean => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return false;
  }

  res.status(400).json({
    success: false,
    error: {
      code,
      message: req.i18n?.getErrorMessage?.(code) ?? fallback,
      details: errors.array()
    },
    timestamp: timestamp()
  });
  return true;
};

const respondUnauthorized = (req: Request, res: Response): void => {
  res.status(401).json({
    success: false,
    error: {
      code: ERROR_CODES.UNAUTHORIZED,
      message: req.i18n?.getErrorMessage?.(ERROR_CODES.UNAUTHORIZED) ?? 'Authentication required'
    },
    timestamp: timestamp()
  });
};

const sanitizeUsageMetrics = (metrics?: Record<string, unknown> | null): FeatureUsageMetrics => {
  if (!metrics) {
    return {};
  }
  const sanitized: FeatureUsageMetrics = {};
  for (const [key, value] of Object.entries(metrics)) {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      sanitized[key] = value as FeatureMetricValue;
    }
  }
  return sanitized;
};

const sanitizeUsageError = (value: unknown): FeatureUsageError | undefined => {
  if (value == null) {
    return null;
  }

  const toRecord = (input: unknown): Record<string, unknown> | undefined =>
    input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : undefined;

  if (Array.isArray(value)) {
    const records = value.map(toRecord).filter((item): item is Record<string, unknown> => !!item);
    return records.length > 0 ? records : undefined;
  }

  return toRecord(value) ?? undefined;
};

const respondNotFound = (req: Request, res: Response, code: number, fallback: string): void => {
  res.status(404).json({
    success: false,
    error: {
      code,
      message: req.i18n?.getErrorMessage?.(code) ?? fallback
    },
    timestamp: timestamp()
  });
};

const respondForbidden = (req: Request, res: Response, code: number, fallback: string): void => {
  res.status(403).json({
    success: false,
    error: {
      code,
      message: req.i18n?.getErrorMessage?.(code) ?? fallback
    },
    timestamp: timestamp()
  });
};

const respondGenericSuccess = (
  res: Response,
  data?: unknown,
  message?: string
): Response<Record<string, unknown>> => {
  return res.json({
    success: true,
    ...(data !== undefined ? { data } : {}),
    ...(message ? { message } : {}),
    timestamp: timestamp()
  });
};

const parseBoolean = (value: string | undefined): boolean | undefined => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};

const parseInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getLocale = (req: Request): SupportedLanguageCode | undefined => {
  const locale = req.i18n?.locale;
  if (locale === 'zh-CN' || locale === 'en-US' || locale === 'ja-JP') {
    return locale;
  }
  return undefined;
};

class FeatureCatalogController {
  async getFeatures(req: Request, res: Response) {
    try {
      if (respondValidationError(req, res)) {
        return;
      }

      const {
        category,
        type,
        is_public,
        tags,
        limit = '20',
        offset = '0',
        sort_by = 'name',
        sort_order = 'asc'
      } = req.query as FeatureListQuery;

      const normalizedSortOrder: 'asc' | 'desc' =
        (sort_order?.toLowerCase() as 'asc' | 'desc') === 'desc' ? 'desc' : 'asc';

      const options = {
        category,
        type,
        isPublic: parseBoolean(is_public),
        tags: tags ? tags.split(',').map((tag) => tag.trim()) : undefined,
        limit: parseInteger(limit, 20),
        offset: parseInteger(offset, 0),
        sortBy: sort_by ?? 'name',
        sortOrder: normalizedSortOrder
      };

      const features = await featureCatalogService.getFeatures(options);

      respondGenericSuccess(
        res,
        {
          features,
          pagination: {
            limit: options.limit,
            offset: options.offset,
            total: features.length
          }
        },
        req.i18n?.getMessage?.('features.retrieved_success') ?? 'Features retrieved successfully'
      );
    } catch (error) {
      logger.error('[FeatureCatalogController] Failed to get features:', error);
      const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
      res.status(appError.statusCode).json(appError.toJSON(getLocale(req)));
    }
  }

  async getFeatureByKey(req: Request<{ featureKey: string }>, res: Response) {
    try {
      const { featureKey } = req.params;

      const feature = await featureCatalogService.getFeatureByKey(featureKey);
      if (!feature) {
        respondNotFound(req, res, ERROR_CODES.TASK_NOT_FOUND, 'Feature not found');
        return;
      }

      if (req.user) {
        const roles = Array.isArray((req.user as unknown as Record<string, unknown>)?.roles)
          ? ((req.user as unknown as Record<string, unknown>).roles as string[])
          : undefined;
        const membership =
          typeof (req.user as unknown as Record<string, unknown>)?.membership === 'string'
            ? ((req.user as unknown as Record<string, unknown>).membership as string)
            : undefined;

        const hasAccess = await featureCatalogService.checkFeatureAccess(featureKey, req.user.id, {
          roles,
          membership,
          ...req.user
        });

        if (!hasAccess) {
          respondForbidden(req, res, ERROR_CODES.PERMISSION_DENIED, 'Access denied');
          return;
        }
      }

      const [configurations, permissions] = await Promise.all([
        featureCatalogService.getFeatureConfigurations(feature.id),
        featureCatalogService.getFeaturePermissions(feature.id)
      ]);

      respondGenericSuccess(res, {
        ...feature,
        configurations,
        permissions,
        hasAccess: true
      });
    } catch (error) {
      logger.error('[FeatureCatalogController] Failed to get feature by key:', error);
      const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
      res.status(appError.statusCode).json(appError.toJSON(getLocale(req)));
    }
  }

  async getFeatureById(req: Request<{ id: string }>, res: Response) {
    try {
      const featureKey = req.params.id;

      const feature = await featureCatalogService.getFeatureByKey(featureKey);
      if (!feature) {
        respondNotFound(req, res, ERROR_CODES.TASK_NOT_FOUND, 'Feature not found');
        return;
      }

      const [configurations, permissions] = await Promise.all([
        featureCatalogService.getFeatureConfigurations(feature.id),
        featureCatalogService.getFeaturePermissions(feature.id)
      ]);

      respondGenericSuccess(res, {
        ...feature,
        configurations,
        permissions
      });
    } catch (error) {
      logger.error('[FeatureCatalogController] Failed to get feature by id:', error);
      const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
      res.status(appError.statusCode).json(appError.toJSON(getLocale(req)));
    }
  }

  async createFeature(req: Request, res: Response) {
    try {
      if (
        respondValidationError(req, res, ERROR_CODES.DATA_VALIDATION_FAILED, 'Validation failed')
      ) {
        return;
      }

      if (!req.user) {
        respondUnauthorized(req, res);
        return;
      }

      const featureData = {
        ...req.body,
        created_by: req.user.id
      };

      const feature = await featureCatalogService.createFeature(featureData);

      res.status(201).json({
        success: true,
        data: feature,
        message:
          req.i18n?.getMessage?.('feature.created_success') ?? 'Feature created successfully',
        timestamp: timestamp()
      });
    } catch (error) {
      logger.error('[FeatureCatalogController] Failed to create feature:', error);
      const appError = AppError.fromError(error, ERROR_CODES.TASK_CREATION_FAILED);
      res.status(appError.statusCode).json(appError.toJSON(getLocale(req)));
    }
  }

  async updateFeature(req: Request<{ featureKey: string }>, res: Response) {
    try {
      if (
        respondValidationError(req, res, ERROR_CODES.DATA_VALIDATION_FAILED, 'Validation failed')
      ) {
        return;
      }

      if (!req.user) {
        respondUnauthorized(req, res);
        return;
      }

      const { featureKey } = req.params;

      const updateData = {
        ...req.body,
        updated_by: req.user.id,
        updated_at: new Date()
      };

      const feature = await featureCatalogService.updateFeature(featureKey, updateData);

      respondGenericSuccess(
        res,
        feature,
        req.i18n?.getMessage?.('feature.updated_success') ?? 'Feature updated successfully'
      );
    } catch (error) {
      logger.error('[FeatureCatalogController] Failed to update feature:', error);
      const appError = AppError.fromError(error, ERROR_CODES.TASK_PROCESSING_FAILED);
      res.status(appError.statusCode).json(appError.toJSON(getLocale(req)));
    }
  }

  async deleteFeature(req: Request<{ featureKey: string }>, res: Response) {
    try {
      const { featureKey } = req.params;

      const result = await featureCatalogService.deleteFeature(featureKey);

      respondGenericSuccess(
        res,
        { deleted: result },
        req.i18n?.getMessage?.('feature.deleted_success') ?? 'Feature deleted successfully'
      );
    } catch (error) {
      logger.error('[FeatureCatalogController] Failed to delete feature:', error);
      const appError = AppError.fromError(error, ERROR_CODES.TASK_PROCESSING_FAILED);
      res.status(appError.statusCode).json(appError.toJSON(getLocale(req)));
    }
  }

  async setFeatureConfigurations(req: Request<{ featureKey: string }>, res: Response) {
    try {
      const { featureKey } = req.params;
      const { configurations } = req.body as { configurations?: unknown };

      if (!Array.isArray(configurations)) {
        res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.INVALID_PARAMETERS,
            message:
              req.i18n?.getErrorMessage?.(ERROR_CODES.INVALID_PARAMETERS) ??
              'Configurations must be an array'
          },
          timestamp: timestamp()
        });
        return;
      }

      const feature = await featureCatalogService.getFeatureByKey(featureKey);
      if (!feature) {
        respondNotFound(req, res, ERROR_CODES.TASK_NOT_FOUND, 'Feature not found');
        return;
      }

      const result = await featureCatalogService.setFeatureConfigurations(
        feature.id,
        configurations
      );

      respondGenericSuccess(
        res,
        result,
        req.i18n?.getMessage?.('feature.configurations_set_success') ??
          'Feature configurations set successfully'
      );
    } catch (error) {
      logger.error('[FeatureCatalogController] Failed to set feature configurations:', error);
      const appError = AppError.fromError(error, ERROR_CODES.TASK_PROCESSING_FAILED);
      res.status(appError.statusCode).json(appError.toJSON(getLocale(req)));
    }
  }

  async checkFeatureAccess(req: Request<{ featureKey: string }>, res: Response) {
    try {
      if (!req.user) {
        respondUnauthorized(req, res);
        return;
      }

      const { featureKey } = req.params;

      const roles = Array.isArray((req.user as unknown as Record<string, unknown>)?.roles)
        ? ((req.user as unknown as Record<string, unknown>).roles as string[])
        : undefined;
      const membership =
        typeof (req.user as unknown as Record<string, unknown>)?.membership === 'string'
          ? ((req.user as unknown as Record<string, unknown>).membership as string)
          : undefined;

      const hasAccess = await featureCatalogService.checkFeatureAccess(featureKey, req.user.id, {
        roles,
        membership,
        ...req.user
      });

      respondGenericSuccess(res, {
        featureKey,
        hasAccess,
        userId: req.user.id
      });
    } catch (error) {
      logger.error('[FeatureCatalogController] Failed to check feature access:', error);
      const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
      res.status(appError.statusCode).json(appError.toJSON(getLocale(req)));
    }
  }

  async recordFeatureUsage(
    req: Request<{ featureKey: string }, unknown, FeatureUsageBody>,
    res: Response
  ) {
    try {
      if (!req.user) {
        respondUnauthorized(req, res);
        return;
      }

      const { featureKey } = req.params;
      const {
        usageCount = 1,
        metrics = {},
        cost = 0,
        status = 'success',
        errorDetails = null
      } = req.body;

      const normalizedStatus: 'success' | 'failed' = status === 'failed' ? 'failed' : 'success';

      const sanitizedMetrics = sanitizeUsageMetrics(metrics);
      const normalizedErrorDetails = sanitizeUsageError(errorDetails);

      await featureCatalogService.recordFeatureUsage(featureKey, req.user.id, {
        usageCount,
        metrics: sanitizedMetrics,
        cost,
        status: normalizedStatus,
        errorDetails: normalizedErrorDetails
      });

      respondGenericSuccess(
        res,
        undefined,
        req.i18n?.getMessage?.('feature.usage_recorded') ?? 'Feature usage recorded successfully'
      );
    } catch (error) {
      logger.error('[FeatureCatalogController] Failed to record feature usage:', error);
      const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
      res.status(appError.statusCode).json(appError.toJSON(getLocale(req)));
    }
  }

  async getUsageStats(req: Request, res: Response) {
    try {
      const {
        feature_key,
        user_id,
        start_date,
        end_date,
        group_by = 'day'
      } = req.query as Record<string, string | undefined>;

      const normalizedGroupBy: 'day' | 'feature' | 'user' =
        group_by === 'feature' ? 'feature' : group_by === 'user' ? 'user' : 'day';

      const options = {
        featureKey: feature_key,
        userId: user_id,
        startDate: start_date,
        endDate: end_date,
        groupBy: normalizedGroupBy
      };

      const stats = await featureCatalogService.getUsageStats(options);

      respondGenericSuccess(res, {
        stats,
        filters: options
      });
    } catch (error) {
      logger.error('[FeatureCatalogController] Failed to get usage stats:', error);
      const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
      res.status(appError.statusCode).json(appError.toJSON(getLocale(req)));
    }
  }

  async getServiceStats(req: Request, res: Response) {
    try {
      const stats = featureCatalogService.getStats();
      respondGenericSuccess(res, stats);
    } catch (error) {
      logger.error('[FeatureCatalogController] Failed to get service stats:', error);
      const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
      res.status(appError.statusCode).json(appError.toJSON(getLocale(req)));
    }
  }

  async getFeatureCategories(req: Request, res: Response) {
    try {
      const categories = [
        { value: 'image_processing', label: '图片处理', description: '图像编辑、滤镜、增强等' },
        { value: 'ai_generation', label: 'AI生成', description: '文本生成、图像生成、音频生成等' },
        { value: 'video_processing', label: '视频处理', description: '视频编辑、转换、压缩等' },
        { value: 'audio_processing', label: '音频处理', description: '音频编辑、转换、降噪等' },
        { value: 'text_processing', label: '文本处理', description: '文本分析、翻译、摘要等' },
        { value: 'data_analysis', label: '数据分析', description: '数据可视化、统计分析等' },
        { value: 'file_management', label: '文件管理', description: '文件上传、存储、转换等' },
        { value: 'user_management', label: '用户管理', description: '用户认证、权限管理等' },
        { value: 'payment', label: '支付功能', description: '支付处理、订单管理等' },
        { value: 'integration', label: '集成功能', description: '第三方服务集成、API对接等' }
      ];

      respondGenericSuccess(res, categories);
    } catch (error) {
      logger.error('[FeatureCatalogController] Failed to get feature categories:', error);
      const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
      res.status(appError.statusCode).json(appError.toJSON(getLocale(req)));
    }
  }
}

const featureCatalogController = new FeatureCatalogController();
export default featureCatalogController;
