const logger = require('../utils/logger');
const featureCatalogService = require('../services/feature-catalog.service');
const { body, validationResult, query } = require('express-validator');
const AppError = require('../utils/AppError');
const { ERROR_CODES } = require('../config/error-codes');

/**
 * 功能目录控制器
 *
 * 处理功能目录相关的API请求：
 * - 功能定义的CRUD操作
 * - 功能配置管理
 * - 权限验证
 * - 使用统计查询
 */
class FeatureCatalogController {
  /**
   * 获取功能列表
   * GET /api/features
   */
  async getFeatures(req, res) {
    try {
      // 参数验证
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.INVALID_PARAMETERS,
            message: req.i18n ? req.i18n.getErrorMessage(ERROR_CODES.INVALID_PARAMETERS) : 'Invalid parameters',
            details: errors.array()
          },
          timestamp: new Date().toISOString()
        });
      }

      const {
        category,
        type,
        is_public,
        tags,
        limit = 20,
        offset = 0,
        sort_by = 'name',
        sort_order = 'asc'
      } = req.query;

      const options = {
        category,
        type,
        isPublic: is_public === 'true' ? true : is_public === 'false' ? false : undefined,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : undefined,
        limit: parseInt(limit) || 20,
        offset: parseInt(offset) || 0,
        sortBy: sort_by,
        sortOrder: sort_order
      };

      const features = await featureCatalogService.getFeatures(options);

      res.json({
        success: true,
        data: {
          features,
          pagination: {
            limit: options.limit,
            offset: options.offset,
            total: features.length
          }
        },
        message: req.i18n ? req.i18n.getMessage('features.retrieved_success') : 'Features retrieved successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[FeatureCatalogController] Failed to get features:', error);
      const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
      res.status(appError.statusCode).json(appError.toJSON(req.i18n?.locale));
    }
  }

  /**
   * 根据key获取功能详情
   * GET /api/features/:featureKey
   */
  async getFeatureByKey(req, res) {
    try {
      const { featureKey } = req.params;

      const feature = await featureCatalogService.getFeatureByKey(featureKey);
      if (!feature) {
        return res.status(404).json({
          success: false,
          error: {
            code: ERROR_CODES.TASK_NOT_FOUND,
            message: req.i18n ? req.i18n.getErrorMessage(ERROR_CODES.TASK_NOT_FOUND) : 'Feature not found',
            timestamp: new Date().toISOString()
          }
        });
      }

      // 检查用户是否有访问权限
      if (req.user) {
        const hasAccess = await featureCatalogService.checkFeatureAccess(
          featureKey,
          req.user.id,
          {
            roles: req.user.roles,
            membership: req.user.membership,
            ...req.user
          }
        );

        if (!hasAccess) {
          return res.status(403).json({
            success: false,
            error: {
              code: ERROR_CODES.PERMISSION_DENIED,
              message: req.i18n ? req.i18n.getErrorMessage(ERROR_CODES.PERMISSION_DENIED) : 'Access denied',
              timestamp: new Date().toISOString()
            }
          });
        }
      }

      // 获取功能的配置和权限信息
      const [configurations, permissions] = await Promise.all([
        featureCatalogService.getFeatureConfigurations(feature.id),
        featureCatalogService.getFeaturePermissions(feature.id)
      ]);

      res.json({
        success: true,
        data: {
          ...feature,
          configurations,
          permissions,
          hasAccess: true
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[FeatureCatalogController] Failed to get feature by key:', error);
      const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
      res.status(appError.statusCode).json(appError.toJSON(req.i18n?.locale));
    }
  }

  /**
   * 创建功能定义（管理员）
   * POST /api/admin/features
   */
  async createFeature(req, res) {
    try {
      // 参数验证
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: req.i18n ? req.i18n.getErrorMessage(ERROR_CODES.VALIDATION_ERROR) : 'Validation failed',
            details: errors.array()
          },
          timestamp: new Date().toISOString()
        });
      }

      const featureData = {
        ...req.body,
        created_by: req.user.id
      };

      const feature = await featureCatalogService.createFeature(featureData);

      res.status(201).json({
        success: true,
        data: feature,
        message: req.i18n ? req.i18n.getMessage('feature.created_success') : 'Feature created successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[FeatureCatalogController] Failed to create feature:', error);
      const appError = AppError.fromError(error, ERROR_CODES.TASK_CREATION_FAILED);
      res.status(appError.statusCode).json(appError.toJSON(req.i18n?.locale));
    }
  }

  /**
   * 更新功能定义（管理员）
   * PUT /api/admin/features/:featureKey
   */
  async updateFeature(req, res) {
    try {
      const { featureKey } = req.params;

      // 参数验证
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: req.i18n ? req.i18n.getErrorMessage(ERROR_CODES.VALIDATION_ERROR) : 'Validation failed',
            details: errors.array()
          },
          timestamp: new Date().toISOString()
        });
      }

      const updateData = {
        ...req.body,
        updated_by: req.user.id,
        updated_at: new Date()
      };

      const feature = await featureCatalogService.updateFeature(featureKey, updateData);

      res.json({
        success: true,
        data: feature,
        message: req.i18n ? req.i18n.getMessage('feature.updated_success') : 'Feature updated successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[FeatureCatalogController] Failed to update feature:', error);
      const appError = AppError.fromError(error, ERROR_CODES.TASK_PROCESSING_FAILED);
      res.status(appError.statusCode).json(appError.toJSON(req.i18n?.locale));
    }
  }

  /**
   * 删除功能定义（管理员）
   * DELETE /api/admin/features/:featureKey
   */
  async deleteFeature(req, res) {
    try {
      const { featureKey } = req.params;

      const result = await featureCatalogService.deleteFeature(featureKey);

      res.json({
        success: true,
        data: { deleted: result },
        message: req.i18n ? req.i18n.getMessage('feature.deleted_success') : 'Feature deleted successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[FeatureCatalogController] Failed to delete feature:', error);
      const appError = AppError.fromError(error, ERROR_CODES.TASK_PROCESSING_FAILED);
      res.status(appError.statusCode).json(appError.toJSON(req.i18n?.locale));
    }
  }

  /**
   * 设置功能配置（管理员）
   * POST /api/admin/features/:featureKey/configurations
   */
  async setFeatureConfigurations(req, res) {
    try {
      const { featureKey } = req.params;
      const { configurations } = req.body;

      if (!Array.isArray(configurations)) {
        return res.status(400).json({
          success: false,
          error: {
            code: ERROR_CODES.INVALID_PARAMETERS,
            message: req.i18n ? req.i18n.getErrorMessage(ERROR_CODES.INVALID_PARAMETERS) : 'Configurations must be an array',
            timestamp: new Date().toISOString()
          }
        });
      }

      // 获取功能ID
      const feature = await featureCatalogService.getFeatureByKey(featureKey);
      if (!feature) {
        return res.status(404).json({
          success: false,
          error: {
            code: ERROR_CODES.TASK_NOT_FOUND,
            message: req.i18n ? req.i18n.getErrorMessage(ERROR_CODES.TASK_NOT_FOUND) : 'Feature not found',
            timestamp: new Date().toISOString()
          }
        });
      }

      const result = await featureCatalogService.setFeatureConfigurations(feature.id, configurations);

      res.json({
        success: true,
        data: result,
        message: req.i18n ? req.i18n.getMessage('feature.configurations_set_success') : 'Feature configurations set successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[FeatureCatalogController] Failed to set feature configurations:', error);
      const appError = AppError.fromError(error, ERROR_CODES.TASK_PROCESSING_FAILED);
      res.status(appError.statusCode).json(appError.toJSON(req.i18n?.locale));
    }
  }

  /**
   * 检查功能访问权限
   * GET /api/features/:featureKey/access
   */
  async checkFeatureAccess(req, res) {
    try {
      const { featureKey } = req.params;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: ERROR_CODES.UNAUTHORIZED,
            message: req.i18n ? req.i18n.getErrorMessage(ERROR_CODES.UNAUTHORIZED) : 'Authentication required',
            timestamp: new Date().toISOString()
          }
        });
      }

      const hasAccess = await featureCatalogService.checkFeatureAccess(
        featureKey,
        req.user.id,
        {
          roles: req.user.roles,
          membership: req.user.membership,
          ...req.user
        }
      );

      res.json({
        success: true,
        data: {
          featureKey,
          hasAccess,
          userId: req.user.id
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[FeatureCatalogController] Failed to check feature access:', error);
      const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
      res.status(appError.statusCode).json(appError.toJSON(req.i18n?.locale));
    }
  }

  /**
   * 记录功能使用
   * POST /api/features/:featureKey/usage
   */
  async recordFeatureUsage(req, res) {
    try {
      const { featureKey } = req.params;
      const { usageCount = 1, metrics = {}, cost = 0, status = 'success', errorDetails = null } = req.body;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: ERROR_CODES.UNAUTHORIZED,
            message: req.i18n ? req.i18n.getErrorMessage(ERROR_CODES.UNAUTHORIZED) : 'Authentication required',
            timestamp: new Date().toISOString()
          }
        });
      }

      await featureCatalogService.recordFeatureUsage(featureKey, req.user.id, {
        usageCount,
        metrics,
        cost,
        status,
        errorDetails
      });

      res.json({
        success: true,
        message: req.i18n ? req.i18n.getMessage('feature.usage_recorded') : 'Feature usage recorded successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[FeatureCatalogController] Failed to record feature usage:', error);
      const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
      res.status(appError.statusCode).json(appError.toJSON(req.i18n?.locale));
    }
  }

  /**
   * 获取使用统计（管理员）
   * GET /api/admin/features/stats
   */
  async getUsageStats(req, res) {
    try {
      const {
        feature_key,
        user_id,
        start_date,
        end_date,
        group_by = 'day'
      } = req.query;

      const options = {
        featureKey: feature_key,
        userId: user_id,
        startDate: start_date,
        endDate: end_date,
        groupBy: group_by
      };

      const stats = await featureCatalogService.getUsageStats(options);

      res.json({
        success: true,
        data: {
          stats,
          filters: options
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[FeatureCatalogController] Failed to get usage stats:', error);
      const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
      res.status(appError.statusCode).json(appError.toJSON(req.i18n?.locale));
    }
  }

  /**
   * 获取功能目录服务统计信息（管理员）
   * GET /api/admin/features/service-stats
   */
  async getServiceStats(req, res) {
    try {
      const stats = featureCatalogService.getStats();

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[FeatureCatalogController] Failed to get service stats:', error);
      const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
      res.status(appError.statusCode).json(appError.toJSON(req.i18n?.locale));
    }
  }

  /**
   * 获取功能分类列表
   * GET /api/features/categories
   */
  async getFeatureCategories(req, res) {
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

      res.json({
        success: true,
        data: categories,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[FeatureCatalogController] Failed to get feature categories:', error);
      const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
      res.status(appError.statusCode).json(appError.toJSON(req.i18n?.locale));
    }
  }
}

module.exports = new FeatureCatalogController();