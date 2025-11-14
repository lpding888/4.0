/* eslint-disable @typescript-eslint/no-explicit-any */
import logger from '../utils/logger.js';
import { db } from '../config/database.js';
import cacheService from './cache.service.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES } from '../config/error-codes.js';
import type { Knex } from 'knex';

/**
 * 功能目录服务类
 *
 * 管理应用中的所有功能特性：
 * - 功能定义和元数据管理
 * - 功能配置和参数管理
 * - 功能权限控制
 * - 功能版本管理
 * - 功能使用统计
 */
type FeatureQueryOptions = {
  category?: string;
  type?: string;
  isPublic?: boolean;
  is_active?: boolean;
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

type UsageFilterOptions = {
  userId?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  limit?: number;
  offset?: number;
};

type FeatureUsageStatus = 'success' | 'failed' | 'partial';

export type FeatureMetricValue = string | number | boolean | null;

export type FeatureUsageMetrics = Record<string, FeatureMetricValue>;

export type FeatureUsageError = Record<string, unknown> | Record<string, unknown>[] | null;

interface FeatureUsageRecordInput {
  usageCount?: number;
  cost?: number;
  metrics?: FeatureUsageMetrics;
  status?: FeatureUsageStatus;
  errorDetails?: FeatureUsageError;
}

type AccessContext = {
  userId?: string;
  role?: string;
  roles?: string[];
  permissions?: Record<string, boolean>;
  membershipTier?: string;
  membership?: string;
  organizationId?: string;
  [key: string]: unknown;
};

interface FeatureUsageStatsOptions {
  featureKey?: string;
  userId?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  groupBy?: 'feature' | 'user' | 'day';
}

interface FeatureUsageStatSummary {
  featureId: string;
  featureKey: string;
  featureName: string;
  category: string;
  usageDate: string | null;
  userId: string | null;
  totalUsage: number;
  totalCost: number;
  activeDays: number;
}

type FeatureDefinitionRecord = Record<string, any>;
type FeatureDefinitionCacheEntry = FeatureDefinitionRecord & {
  configurations: Map<string, any>;
  permissions: Map<string, any>;
};

class FeatureCatalogService {
  private initialized: boolean;
  private readonly cachePrefix: string;
  private readonly cacheTTL: number;
  private readonly featureDefinitions: Map<string, FeatureDefinitionCacheEntry>;
  private lastCacheUpdate: number;
  private readonly cacheUpdateInterval: number;
  private cacheRefreshTimer?: ReturnType<typeof setInterval>;

  constructor() {
    this.initialized = false;
    this.cachePrefix = 'feature_catalog:';
    this.cacheTTL = 3600; // 1小时缓存
    this.featureDefinitions = new Map(); // 内存缓存
    this.lastCacheUpdate = 0;
    this.cacheUpdateInterval = 300000; // 5分钟更新一次
    this.cacheRefreshTimer = undefined;
  }

  /**
   * 初始化功能目录服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info('[FeatureCatalogService] Initializing feature catalog service...');

      // 加载所有功能定义到内存
      await this.loadFeatureDefinitions();

      // 设置定时缓存更新
      this.setupCacheRefresh();

      this.initialized = true;
      logger.info('[FeatureCatalogService] Feature catalog service initialized successfully');
    } catch (error) {
      logger.error('[FeatureCatalogService] Failed to initialize feature catalog service:', error);
      throw error;
    }
  }

  /**
   * 加载所有功能定义
   */
  async loadFeatureDefinitions(): Promise<void> {
    try {
      const features = await db('feature_definitions')
        .where('is_active', true)
        .orderBy('category', 'asc')
        .orderBy('name', 'asc');

      this.featureDefinitions.clear();
      for (const feature of features) {
        this.featureDefinitions.set(feature.feature_key, {
          ...feature,
          configurations: new Map(),
          permissions: new Map()
        });
      }

      this.lastCacheUpdate = Date.now();
      logger.info(`[FeatureCatalogService] Loaded ${features.length} feature definitions`);
    } catch (error) {
      logger.error('[FeatureCatalogService] Failed to load feature definitions:', error);
      throw error;
    }
  }

  /**
   * 设置定时缓存刷新
   */
  setupCacheRefresh(): void {
    if (this.cacheRefreshTimer) {
      clearInterval(this.cacheRefreshTimer);
    }

    this.cacheRefreshTimer = setInterval(async () => {
      try {
        await this.loadFeatureDefinitions();
        logger.debug('[FeatureCatalogService] Feature definitions cache refreshed');
      } catch (error) {
        logger.error('[FeatureCatalogService] Failed to refresh feature definitions cache:', error);
      }
    }, this.cacheUpdateInterval);
  }

  /**
   * 获取功能列表
   * @param {Object} options - 查询选项
   * @returns {Array} 功能列表
   */
  async getFeatures(options: FeatureQueryOptions = {}): Promise<any[]> {
    const {
      category,
      type,
      isPublic,
      is_active = true,
      tags,
      limit = 50,
      offset = 0,
      sortBy = 'name',
      sortOrder = 'asc'
    } = options;

    try {
      let query = db('feature_definitions');

      // 应用过滤条件
      if (category) {
        query = query.where('category', category);
      }
      if (type) {
        query = query.where('type', type);
      }
      if (typeof isPublic === 'boolean') {
        query = query.where('is_public', isPublic);
      }
      if (typeof is_active === 'boolean') {
        query = query.where('is_active', is_active);
      }
      if (tags && tags.length > 0) {
        query = query.whereRaw('JSON_CONTAINS(tags, ?)', [JSON.stringify(tags)]);
      }

      // 应用排序
      const validSortFields = ['name', 'category', 'type', 'released_at', 'created_at'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'name';
      query = query.orderBy(sortField, sortOrder === 'desc' ? 'desc' : 'asc');

      // 应用分页
      query = query.limit(limit).offset(offset);

      const features = await query;

      // 为每个功能添加配置和权限信息
      const featuresWithDetails = await Promise.all(
        features.map(async (feature) => {
          const [configurations, permissions] = await Promise.all([
            this.getFeatureConfigurations(feature.id),
            this.getFeaturePermissions(feature.id)
          ]);

          return {
            ...feature,
            configurations,
            permissions
          };
        })
      );

      return featuresWithDetails;
    } catch (error) {
      logger.error('[FeatureCatalogService] Failed to get features:', error);
      throw AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 根据key获取功能定义
   * @param {string} featureKey - 功能key
   * @returns {Object|null} 功能定义
   */
  async getFeatureByKey(featureKey: string): Promise<any> {
    try {
      // 先从内存缓存查找
      if (this.featureDefinitions.has(featureKey)) {
        return this.featureDefinitions.get(featureKey);
      }

      // 从数据库查找
      const feature = await db('feature_definitions').where('feature_key', featureKey).first();

      if (!feature) {
        return null;
      }

      // 添加到内存缓存
      this.featureDefinitions.set(featureKey, feature);

      return feature;
    } catch (error) {
      logger.error('[FeatureCatalogService] Failed to get feature by key:', error);
      throw AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 创建功能定义
   * @param {Object} featureData - 功能数据
   * @returns {Object} 创建的功能
   */
  async createFeature(featureData: Record<string, any>): Promise<any> {
    try {
      const {
        feature_key,
        name,
        description,
        category,
        type = 'basic',
        is_active = true,
        is_public = true,
        tags,
        metadata,
        icon,
        version = '1.0.0',
        requirements,
        limits,
        pricing
      } = featureData;

      // 检查功能key是否已存在
      const existingFeature = await this.getFeatureByKey(feature_key);
      if (existingFeature) {
        throw AppError.create(ERROR_CODES.USER_ALREADY_EXISTS, {
          field: 'feature_key',
          value: feature_key,
          message: 'Feature key already exists'
        });
      }

      // 插入功能定义
      const [feature] = await db('feature_definitions')
        .insert({
          feature_key,
          name,
          description,
          category,
          type,
          is_active,
          is_public,
          tags: tags ? JSON.stringify(tags) : null,
          metadata: metadata ? JSON.stringify(metadata) : null,
          icon,
          version,
          requirements: requirements ? JSON.stringify(requirements) : null,
          limits: limits ? JSON.stringify(limits) : null,
          pricing: pricing ? JSON.stringify(pricing) : null,
          released_at: new Date()
        })
        .returning('*');

      // 更新内存缓存
      this.featureDefinitions.set(feature_key, feature);

      logger.info(`[FeatureCatalogService] Created feature: ${feature_key}`);

      return feature;
    } catch (error) {
      logger.error('[FeatureCatalogService] Failed to create feature:', error);
      throw AppError.fromError(error, ERROR_CODES.TASK_CREATION_FAILED);
    }
  }

  /**
   * 更新功能定义
   * @param {string} featureKey - 功能key
   * @param {Object} updateData - 更新数据
   * @returns {Object} 更新后的功能
   */
  async updateFeature(
    featureKey: string,
    updateData: Record<string, any>
  ): Promise<Record<string, any>> {
    try {
      const feature = await this.getFeatureByKey(featureKey);
      if (!feature) {
        throw AppError.create(ERROR_CODES.TASK_NOT_FOUND, {
          feature_key: featureKey,
          resource: 'feature'
        });
      }

      // 处理JSON字段
      const processedData = { ...updateData };
      const jsonFields = ['tags', 'metadata', 'requirements', 'limits', 'pricing'];
      for (const field of jsonFields) {
        if (processedData[field] !== undefined) {
          processedData[field] = processedData[field] ? JSON.stringify(processedData[field]) : null;
        }
      }

      // 更新功能定义
      const [updatedFeature] = await db('feature_definitions')
        .where('feature_key', featureKey)
        .update(processedData)
        .returning('*');

      // 更新内存缓存
      this.featureDefinitions.set(featureKey, updatedFeature);

      logger.info(`[FeatureCatalogService] Updated feature: ${featureKey}`);

      return updatedFeature;
    } catch (error) {
      logger.error('[FeatureCatalogService] Failed to update feature:', error);
      throw AppError.fromError(error, ERROR_CODES.TASK_PROCESSING_FAILED);
    }
  }

  /**
   * 删除功能定义
   * @param {string} featureKey - 功能key
   * @returns {boolean} 是否删除成功
   */
  async deleteFeature(featureKey: string): Promise<boolean> {
    try {
      const feature = await this.getFeatureByKey(featureKey);
      if (!feature) {
        throw AppError.create(ERROR_CODES.TASK_NOT_FOUND, {
          feature_key: featureKey,
          resource: 'feature'
        });
      }

      // 软删除：设置为不活跃
      await db('feature_definitions').where('feature_key', featureKey).update({
        is_active: false,
        deprecated_at: new Date()
      });

      // 从内存缓存中移除
      this.featureDefinitions.delete(featureKey);

      logger.info(`[FeatureCatalogService] Deleted feature: ${featureKey}`);

      return true;
    } catch (error) {
      logger.error('[FeatureCatalogService] Failed to delete feature:', error);
      throw AppError.fromError(error, ERROR_CODES.TASK_PROCESSING_FAILED);
    }
  }

  /**
   * 获取功能配置
   * @param {string} featureId - 功能ID
   * @returns {Array} 配置列表
   */
  async getFeatureConfigurations(featureId: string): Promise<any[]> {
    try {
      const cacheKey = `${this.cachePrefix}config:${featureId}`;

      // 尝试从缓存获取
      const cached = await cacheService.get(cacheKey);
      if (Array.isArray(cached)) {
        return cached;
      }

      const configurations = await db('feature_configurations')
        .where('feature_id', featureId)
        .orderBy('sort_order', 'asc')
        .orderBy('config_key', 'asc');

      // 缓存结果
      await cacheService.set(cacheKey, configurations, this.cacheTTL);

      return configurations;
    } catch (error) {
      logger.error('[FeatureCatalogService] Failed to get feature configurations:', error);
      throw AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 设置功能配置
   * @param {string} featureId - 功能ID
   * @param {Array} configurations - 配置列表
   * @returns {Array} 设置后的配置
   */
  async setFeatureConfigurations(
    featureId: string,
    configurations: Array<Record<string, any>>
  ): Promise<any[]> {
    try {
      const trx = await db.transaction();

      try {
        // 删除现有配置
        await trx('feature_configurations').where('feature_id', featureId).del();

        // 插入新配置
        const configData = configurations.map((config: Record<string, any>, index: number) => ({
          feature_id: featureId,
          config_key: config.config_key,
          config_value: config.config_value,
          data_type: config.data_type || 'string',
          description: config.description,
          is_required: config.is_required || false,
          is_sensitive: config.is_sensitive || false,
          validation_rules: config.validation_rules
            ? JSON.stringify(config.validation_rules)
            : null,
          default_value: config.default_value,
          enum_values: config.enum_values ? JSON.stringify(config.enum_values) : null,
          sort_order: config.sort_order || index
        }));

        const insertedConfigurations = await trx('feature_configurations')
          .insert(configData)
          .returning('*');

        await trx.commit();

        // 清除缓存
        await cacheService.delete(`${this.cachePrefix}config:${featureId}`);

        logger.info(
          `[FeatureCatalogService] Set ${insertedConfigurations.length} configurations for feature: ${featureId}`
        );

        return insertedConfigurations;
      } catch (error) {
        await trx.rollback();
        throw error;
      }
    } catch (error) {
      logger.error('[FeatureCatalogService] Failed to set feature configurations:', error);
      throw AppError.fromError(error, ERROR_CODES.TASK_PROCESSING_FAILED);
    }
  }

  /**
   * 获取功能权限
   * @param {string} featureId - 功能ID
   * @returns {Array} 权限列表
   */
  async getFeaturePermissions(featureId: string): Promise<any[]> {
    try {
      const cacheKey = `${this.cachePrefix}permissions:${featureId}`;

      // 尝试从缓存获取
      const cached = await cacheService.get(cacheKey);
      if (Array.isArray(cached)) {
        return cached;
      }

      const permissions = await db('feature_permissions')
        .where('feature_id', featureId)
        .where('expires_at', '>', new Date())
        .orWhere('expires_at', null)
        .orderBy('permission_type', 'asc')
        .orderBy('permission_value', 'asc');

      // 缓存结果
      await cacheService.set(cacheKey, permissions, this.cacheTTL);

      return permissions;
    } catch (error) {
      logger.error('[FeatureCatalogService] Failed to get feature permissions:', error);
      throw AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 检查用户是否有功能访问权限
   * @param {string} featureKey - 功能key
   * @param {string} userId - 用户ID
   * @param {Object} userContext - 用户上下文信息
   * @returns {boolean} 是否有权限
   */
  async checkFeatureAccess(
    featureKey: string,
    userId: string,
    userContext: AccessContext = {}
  ): Promise<boolean> {
    try {
      const feature = await this.getFeatureByKey(featureKey);
      if (!feature) {
        return false;
      }

      // 如果功能不活跃或未公开，拒绝访问
      if (!feature.is_active || !feature.is_public) {
        return false;
      }

      // 获取功能权限设置
      const permissions = await this.getFeaturePermissions(feature.id);
      if (permissions.length === 0) {
        // 没有特定权限设置，默认允许访问公开功能
        return feature.is_public;
      }

      // 检查用户权限
      for (const permission of permissions) {
        if (!permission.is_granted) {
          continue;
        }

        const hasPermission = await this.evaluatePermission(permission, userId, userContext);
        if (hasPermission) {
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('[FeatureCatalogService] Failed to check feature access:', error);
      return false;
    }
  }

  /**
   * 评估权限
   * @param {Object} permission - 权限对象
   * @param {string} userId - 用户ID
   * @param {Object} userContext - 用户上下文
   * @returns {boolean} 是否有权限
   */
  async evaluatePermission(
    permission: Record<string, any>,
    userId: string,
    userContext: AccessContext = {}
  ): Promise<boolean> {
    try {
      switch (permission.permission_type) {
        case 'user':
          return permission.permission_value === userId;

        case 'role':
          return Boolean(userContext.roles?.includes(permission.permission_value));

        case 'membership':
          return userContext.membership === permission.permission_value;

        case 'custom':
          // 自定义权限条件
          if (permission.conditions) {
            return this.evaluateCustomConditions(permission.conditions, userContext);
          }
          return false;

        default:
          return false;
      }
    } catch (error) {
      logger.error('[FeatureCatalogService] Failed to evaluate permission:', error);
      return false;
    }
  }

  /**
   * 评估自定义条件
   * @param {Object} conditions - 条件对象
   * @param {Object} userContext - 用户上下文
   * @returns {boolean} 是否满足条件
   */
  evaluateCustomConditions(
    conditions: Record<string, any>,
    userContext: AccessContext = {}
  ): boolean {
    try {
      const conditionsStr = JSON.stringify(conditions);

      // 简单的条件评估（实际项目中可能需要更复杂的表达式解析器）
      for (const [key, value] of Object.entries(conditions)) {
        if (userContext[key] !== value) {
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('[FeatureCatalogService] Failed to evaluate custom conditions:', error);
      return false;
    }
  }

  private parseUsageMetrics(raw: unknown): FeatureUsageMetrics {
    if (!raw) return {};
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as FeatureUsageMetrics;
      } catch (error) {
        logger.warn('[FeatureCatalogService] 解析 usage_metrics 失败，返回空对象', { error });
        return {};
      }
    }
    if (typeof raw === 'object') {
      return raw as FeatureUsageMetrics;
    }
    return {};
  }

  /**
   * 记录功能使用统计
   * @param {string} featureKey - 功能key
   * @param {string} userId - 用户ID
   * @param {Object} usageData - 使用数据
   */
  async recordFeatureUsage(
    featureKey: string,
    userId: string,
    usageData: FeatureUsageRecordInput = {}
  ): Promise<void> {
    try {
      const feature = await this.getFeatureByKey(featureKey);
      if (!feature) {
        return;
      }

      const {
        usageCount = 1,
        metrics = {} as FeatureUsageMetrics,
        cost = 0,
        status = 'success' as FeatureUsageStatus,
        errorDetails = null
      } = usageData;

      const usageDate = new Date().toISOString().split('T')[0];

      // 使用事务确保数据一致性
      await db.transaction(async (trx) => {
        // 检查是否已有今天的统计记录
        const existingStat = await trx('feature_usage_stats')
          .where({
            feature_id: feature.id,
            user_id: userId,
            usage_date: usageDate
          })
          .first();

        if (existingStat) {
          const existingMetrics = this.parseUsageMetrics(existingStat.usage_metrics);
          // 更新现有记录
          await trx('feature_usage_stats')
            .where('id', existingStat.id)
            .update({
              usage_count: existingStat.usage_count + usageCount,
              usage_metrics: JSON.stringify({
                ...existingMetrics,
                ...metrics
              }),
              total_cost: Number(existingStat.total_cost ?? 0) + Number(cost ?? 0),
              status: status === 'failed' ? 'failed' : existingStat.status,
              error_details: errorDetails
                ? JSON.stringify(errorDetails)
                : existingStat.error_details,
              updated_at: new Date()
            });
        } else {
          // 创建新记录
          await trx('feature_usage_stats').insert({
            feature_id: feature.id,
            user_id: userId,
            usage_date: usageDate,
            usage_count: usageCount,
            usage_metrics: JSON.stringify(metrics),
            total_cost: cost,
            status,
            error_details: errorDetails ? JSON.stringify(errorDetails) : null
          });
        }
      });

      logger.debug(
        `[FeatureCatalogService] Recorded usage for feature: ${featureKey}, user: ${userId}`
      );
    } catch (error) {
      logger.error('[FeatureCatalogService] Failed to record feature usage:', error);
      // 记录失败不应该影响主要功能，所以这里只记录日志
    }
  }

  /**
   * 获取功能使用统计
   * @param {Object} options - 查询选项
   * @returns {Array} 统计数据
   */
  async getUsageStats(options: FeatureUsageStatsOptions = {}): Promise<FeatureUsageStatSummary[]> {
    try {
      const { featureKey, userId, startDate, endDate, groupBy = 'day' } = options;

      let query = db('feature_usage_stats as fus')
        .select(
          'fus.feature_id',
          'fd.feature_key',
          'fd.name as feature_name',
          'fd.category',
          'fus.usage_date',
          db.raw('SUM(fus.usage_count) as total_usage'),
          db.raw('SUM(fus.total_cost) as total_cost'),
          db.raw('COUNT(*) as active_days')
        )
        .join('feature_definitions as fd', 'fus.feature_id', '=', 'fd.id')
        .where('fd.is_active', true);

      // 应用过滤条件
      if (featureKey) {
        query = query.where('fd.feature_key', featureKey);
      }
      if (userId) {
        query = query.where('fus.user_id', userId);
      }
      if (startDate) {
        query = query.where('fus.usage_date', '>=', startDate);
      }
      if (endDate) {
        query = query.where('fus.usage_date', '<=', endDate);
      }

      // 应用分组
      switch (groupBy) {
        case 'feature':
          query = query.groupBy('fus.feature_id', 'fd.feature_key', 'fd.name', 'fd.category');
          break;
        case 'user':
          query = query
            .select('fus.user_id')
            .groupBy('fus.user_id', 'fus.feature_id', 'fd.feature_key', 'fd.name', 'fd.category');
          break;
        case 'day':
        default:
          query = query.groupBy(
            'fus.usage_date',
            'fus.feature_id',
            'fd.feature_key',
            'fd.name',
            'fd.category'
          );
          break;
      }

      const stats = await query.orderBy('fus.usage_date', 'desc');

      return stats.map((row) => ({
        featureId: row.feature_id,
        featureKey: row.feature_key,
        featureName: row.feature_name,
        category: row.category,
        usageDate: row.usage_date ? new Date(row.usage_date).toISOString().split('T')[0] : null,
        userId: row.user_id ?? null,
        totalUsage: Number(row.total_usage ?? 0),
        totalCost: Number(row.total_cost ?? 0),
        activeDays: Number(row.active_days ?? 0)
      }));
    } catch (error) {
      logger.error('[FeatureCatalogService] Failed to get usage stats:', error);
      throw AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 获取服务统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      initialized: this.initialized,
      cachedFeatures: this.featureDefinitions.size,
      lastCacheUpdate: this.lastCacheUpdate,
      cacheUpdateInterval: this.cacheUpdateInterval,
      cachePrefix: this.cachePrefix,
      cacheTTL: this.cacheTTL
    };
  }

  /**
   * 关闭服务
   */
  async close(): Promise<void> {
    try {
      if (this.cacheRefreshTimer) {
        clearInterval(this.cacheRefreshTimer);
        this.cacheRefreshTimer = undefined;
      }
      this.featureDefinitions.clear();
      this.initialized = false;
      logger.info('[FeatureCatalogService] Feature catalog service closed');
    } catch (error) {
      logger.error('[FeatureCatalogService] Error closing feature catalog service:', error);
    }
  }
}

const featureCatalogService = new FeatureCatalogService();
export default featureCatalogService;
