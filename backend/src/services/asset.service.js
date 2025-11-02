/**
 * Asset Service - 素材库管理
 * 处理用户素材的查询和删除
 */

const db = require('../config/database');
const logger = require('../utils/logger');

class AssetService {
  /**
   * 查询用户素材列表
   * @param {Object} params - 查询参数
   * @param {string} params.userId - 用户ID
   * @param {string} params.type - 素材类型过滤
   * @param {string} params.featureId - 功能ID过滤
   * @param {string} params.startDate - 开始日期
   * @param {string} params.endDate - 结束日期
   * @param {number} params.page - 页码
   * @param {number} params.limit - 每页数量
   * @returns {Promise<Object>} 素材列表和分页信息
   */
  async getAssets(params) {
    const {
      userId,
      type,
      featureId,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = params;

    try {
      // 构建查询
      let query = db('assets')
        .leftJoin('feature_definitions', 'assets.feature_id', 'feature_definitions.feature_id')
        .select(
          'assets.asset_id',
          'assets.task_id',
          'assets.feature_id',
          'feature_definitions.display_name as feature_name',
          'assets.type',
          'assets.url',
          'assets.thumbnail_url',
          'assets.metadata',
          'assets.created_at'
        )
        .where('assets.user_id', userId)
        .orderBy('assets.created_at', 'desc');

      // 按类型过滤
      if (type) {
        query = query.where('assets.type', type);
      }

      // 按功能过滤
      if (featureId) {
        query = query.where('assets.feature_id', featureId);
      }

      // 按时间范围过滤
      if (startDate) {
        query = query.where('assets.created_at', '>=', startDate);
      }
      if (endDate) {
        query = query.where('assets.created_at', '<=', endDate);
      }

      // 分页
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const assets = await query.limit(parseInt(limit)).offset(offset);

      // 获取总数
      let countQuery = db('assets').where('user_id', userId);
      if (type) countQuery = countQuery.where('type', type);
      if (featureId) countQuery = countQuery.where('feature_id', featureId);
      if (startDate) countQuery = countQuery.where('created_at', '>=', startDate);
      if (endDate) countQuery = countQuery.where('created_at', '<=', endDate);

      const [{ count }] = await countQuery.count('* as count');

      return {
        assets,
        total: parseInt(count),
        page: parseInt(page),
        limit: parseInt(limit)
      };

    } catch (error) {
      logger.error(`[AssetService] 查询素材列表失败: ${error.message}`, { userId, error });
      throw error;
    }
  }

  /**
   * 删除素材
   * @param {string} assetId - 素材ID
   * @param {string} userId - 用户ID（用于权限验证）
   * @returns {Promise<boolean>} 删除成功返回true
   */
  async deleteAsset(assetId, userId) {
    try {
      // 检查素材是否属于该用户
      const asset = await db('assets')
        .where('asset_id', assetId)
        .where('user_id', userId)
        .first();

      if (!asset) {
        throw { errorCode: 4004, message: '素材不存在或无权删除' };
      }

      // 物理删除素材记录
      await db('assets').where('asset_id', assetId).delete();

      logger.info(`[AssetService] 素材删除成功 assetId=${assetId} userId=${userId}`);

      // TODO: 可选择删除COS文件
      // await cosService.deleteFile(asset.url);

      return true;

    } catch (error) {
      logger.error(`[AssetService] 删除素材失败: ${error.message}`, { assetId, userId, error });
      throw error;
    }
  }

  /**
   * 查询所有用户素材（仅管理员）
   * @param {Object} params - 查询参数
   * @returns {Promise<Object>} 素材列表和分页信息
   */
  async getAllAssets(params) {
    const {
      userId,  // 可选：特定用户ID
      type,
      featureId,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = params;

    try {
      // 构建查询
      let query = db('assets')
        .leftJoin('feature_definitions', 'assets.feature_id', 'feature_definitions.feature_id')
        .leftJoin('users', 'assets.user_id', 'users.id')
        .select(
          'assets.asset_id',
          'assets.user_id',
          'users.phone as user_phone',
          'assets.task_id',
          'assets.feature_id',
          'feature_definitions.display_name as feature_name',
          'assets.type',
          'assets.url',
          'assets.thumbnail_url',
          'assets.metadata',
          'assets.created_at'
        )
        .orderBy('assets.created_at', 'desc');

      // 按用户过滤（可选）
      if (userId && userId !== 'all') {
        query = query.where('assets.user_id', userId);
      }

      // 按类型过滤
      if (type) {
        query = query.where('assets.type', type);
      }

      // 按功能过滤
      if (featureId) {
        query = query.where('assets.feature_id', featureId);
      }

      // 按时间范围过滤
      if (startDate) {
        query = query.where('assets.created_at', '>=', startDate);
      }
      if (endDate) {
        query = query.where('assets.created_at', '<=', endDate);
      }

      // 分页
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const assets = await query.limit(parseInt(limit)).offset(offset);

      // 获取总数
      let countQuery = db('assets');
      if (userId && userId !== 'all') countQuery = countQuery.where('user_id', userId);
      if (type) countQuery = countQuery.where('type', type);
      if (featureId) countQuery = countQuery.where('feature_id', featureId);
      if (startDate) countQuery = countQuery.where('created_at', '>=', startDate);
      if (endDate) countQuery = countQuery.where('created_at', '<=', endDate);

      const [{ count }] = await countQuery.count('* as count');

      return {
        assets,
        total: parseInt(count),
        page: parseInt(page),
        limit: parseInt(limit)
      };

    } catch (error) {
      logger.error(`[AssetService] 查询所有素材列表失败: ${error.message}`, error);
      throw error;
    }
  }
}

module.exports = new AssetService();
