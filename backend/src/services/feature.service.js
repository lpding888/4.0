const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Feature Service - 功能卡片服务
 * 负责功能卡片的查询、权限过滤等
 */
class FeatureService {
  /**
   * 获取所有启用的功能卡片（公开接口，无需登录）
   * @returns {Promise<Array>} 功能卡片列表
   */
  async getAllEnabledFeatures() {
    try {
      // 查询所有启用且未删除的功能卡片
      const allFeatures = await db('feature_definitions')
        .where('is_enabled', true)
        .whereNull('deleted_at')
        .select(
          'feature_id',
          'display_name',
          'category',
          'description',
          'plan_required',
          'quota_cost',
          'rate_limit_policy',
          'output_type',
          'save_to_asset_library'
        );

      logger.info(`[FeatureService] 获取所有启用功能 count=${allFeatures.length}`);
      return allFeatures;

    } catch (error) {
      logger.error(`[FeatureService] 获取所有启用功能失败: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * 获取用户可用的功能卡片列表
   * @param {string} userId - 用户ID
   * @returns {Promise<Array>} 功能卡片列表
   */
  async getAvailableFeatures(userId) {
    try {
      // 1. 获取用户信息(包括会员等级)
      const user = await db('users').where('id', userId).first();
      if (!user) {
        throw { statusCode: 404, errorCode: 1004, message: '用户不存在' };
      }

      // 2. 查询所有启用且未删除的功能卡片
      const allFeatures = await db('feature_definitions')
        .where('is_enabled', true)
        .whereNull('deleted_at')
        .select('*');

      // 3. 根据access_scope和用户权限过滤
      const availableFeatures = allFeatures.filter(feature => {
        // 如果是plan模式,检查用户会员等级
        if (feature.access_scope === 'plan') {
          return this.checkPlanAccess(user, feature.plan_required);
        }

        // 如果是whitelist模式,检查用户是否在白名单中
        if (feature.access_scope === 'whitelist') {
          return this.checkWhitelistAccess(userId, feature.allowed_accounts);
        }

        // 默认不可访问
        return false;
      });

      // 4. 格式化返回数据(不包含内部字段)
      const formattedFeatures = availableFeatures.map(feature => ({
        feature_id: feature.feature_id,
        display_name: feature.display_name,
        category: feature.category,
        description: feature.description,
        plan_required: feature.plan_required,
        quota_cost: feature.quota_cost,
        rate_limit_policy: feature.rate_limit_policy,
        output_type: feature.output_type,
        save_to_asset_library: feature.save_to_asset_library
      }));

      logger.info(`[FeatureService] 获取用户可用功能 userId=${userId} count=${formattedFeatures.length}`);
      return formattedFeatures;

    } catch (error) {
      logger.error(`[FeatureService] 获取可用功能失败: ${error.message}`, { userId, error });
      throw error;
    }
  }

  /**
   * 获取功能的表单Schema
   * @param {string} featureId - 功能ID
   * @param {string} userId - 用户ID(用于权限验证)
   * @returns {Promise<Object>} 表单Schema
   */
  async getFormSchema(featureId, userId) {
    try {
      // 1. 查询功能定义
      const feature = await db('feature_definitions')
        .where('feature_id', featureId)
        .first();

      if (!feature) {
        throw { statusCode: 404, errorCode: 4001, message: '功能不存在' };
      }

      if (!feature.is_enabled || feature.deleted_at) {
        throw { statusCode: 403, errorCode: 4002, message: '功能已下线' };
      }

      // 2. 验证用户权限
      const user = await db('users').where('id', userId).first();
      if (!user) {
        throw { statusCode: 404, errorCode: 1004, message: '用户不存在' };
      }

      const hasAccess = this.checkFeatureAccess(user, userId, feature);
      if (!hasAccess) {
        throw { statusCode: 403, errorCode: 4003, message: '无权访问该功能' };
      }

      // 3. 查询表单Schema
      const formSchema = await db('form_schemas')
        .where('schema_id', feature.form_schema_ref)
        .first();

      if (!formSchema) {
        throw { statusCode: 500, errorCode: 5001, message: '表单Schema不存在' };
      }

      logger.info(`[FeatureService] 获取表单Schema featureId=${featureId} userId=${userId}`);
      return {
        schema_id: formSchema.schema_id,
        fields: formSchema.fields
      };

    } catch (error) {
      logger.error(`[FeatureService] 获取表单Schema失败: ${error.message}`, { featureId, userId, error });
      throw error;
    }
  }

  /**
   * 检查套餐权限
   * @param {Object} user - 用户对象
   * @param {string} planRequired - 所需套餐级别
   * @returns {boolean}
   */
  checkPlanAccess(user, planRequired) {
    // 如果不是会员,无法访问
    if (!user.isMember) {
      return false;
    }

    // TODO: 这里可以根据实际的套餐等级进行更精细的判断
    // 目前简化处理:只要是会员就可以访问
    // 未来可以扩展: 基础会员/PRO会员/企业会员等
    return true;
  }

  /**
   * 检查白名单权限
   * @param {string} userId - 用户ID
   * @param {string} allowedAccountsJson - 白名单JSON字符串
   * @returns {boolean}
   */
  checkWhitelistAccess(userId, allowedAccountsJson) {
    if (!allowedAccountsJson) {
      return false;
    }

    try {
      const allowedAccounts = JSON.parse(allowedAccountsJson);
      return allowedAccounts.includes(userId);
    } catch (error) {
      logger.error(`[FeatureService] 解析白名单失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 检查用户对功能的访问权限
   * @param {Object} user - 用户对象
   * @param {string} userId - 用户ID
   * @param {Object} feature - 功能对象
   * @returns {boolean}
   */
  checkFeatureAccess(user, userId, feature) {
    if (feature.access_scope === 'plan') {
      return this.checkPlanAccess(user, feature.plan_required);
    }

    if (feature.access_scope === 'whitelist') {
      return this.checkWhitelistAccess(userId, feature.allowed_accounts);
    }

    return false;
  }

  /**
   * 检查用户访问权限(异步版本,用于TaskService)
   * @param {string} userId - 用户ID
   * @param {Object} feature - 功能对象
   * @returns {Promise<boolean>}
   */
  async checkUserAccess(userId, feature) {
    try {
      const user = await db('users').where('id', userId).first();
      if (!user) {
        return false;
      }

      return this.checkFeatureAccess(user, userId, feature);

    } catch (error) {
      logger.error(`[FeatureService] 检查用户权限失败: ${error.message}`, { userId, error });
      return false;
    }
  }

  /**
   * 获取功能定义(内部使用,包含完整信息)
   * @param {string} featureId - 功能ID
   * @returns {Promise<Object>}
   */
  async getFeatureDefinition(featureId) {
    try {
      const feature = await db('feature_definitions')
        .where('feature_id', featureId)
        .first();

      if (!feature) {
        throw { statusCode: 404, errorCode: 4001, message: '功能不存在' };
      }

      if (!feature.is_enabled || feature.deleted_at) {
        throw { statusCode: 403, errorCode: 4002, message: '功能已下线' };
      }

      return feature;

    } catch (error) {
      logger.error(`[FeatureService] 获取功能定义失败: ${error.message}`, { featureId, error });
      throw error;
    }
  }

  /**
   * 获取Pipeline Schema(内部使用)
   * @param {string} pipelineId - Pipeline ID
   * @returns {Promise<Object>}
   */
  async getPipelineSchema(pipelineId) {
    try {
      const pipeline = await db('pipeline_schemas')
        .where('pipeline_id', pipelineId)
        .first();

      if (!pipeline) {
        throw { statusCode: 500, errorCode: 5002, message: 'Pipeline Schema不存在' };
      }

      return pipeline;

    } catch (error) {
      logger.error(`[FeatureService] 获取Pipeline Schema失败: ${error.message}`, { pipelineId, error });
      throw error;
    }
  }
}

module.exports = new FeatureService();
