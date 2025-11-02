/**
 * Asset Controller - 素材库控制器
 * 处理素材相关HTTP请求
 */

const assetService = require('../services/asset.service');
const logger = require('../utils/logger');

class AssetController {
  /**
   * 获取用户素材列表
   * GET /api/assets
   * 查询参数: type, featureId, startDate, endDate, page, limit
   */
  async getAssets(req, res, next) {
    try {
      const userId = req.user.id;
      const { type, featureId, startDate, endDate, page, limit } = req.query;

      const result = await assetService.getAssets({
        userId,
        type,
        featureId,
        startDate,
        endDate,
        page,
        limit
      });

      res.json({
        success: true,
        ...result
      });

    } catch (error) {
      logger.error(`[AssetController] 获取素材列表失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 删除素材
   * DELETE /api/assets/:assetId
   */
  async deleteAsset(req, res, next) {
    try {
      const userId = req.user.id;
      const { assetId } = req.params;

      if (!assetId) {
        return res.status(400).json({
          success: false,
          error: { code: 4001, message: '缺少素材ID' }
        });
      }

      await assetService.deleteAsset(assetId, userId);

      res.json({
        success: true,
        message: '素材已删除'
      });

    } catch (error) {
      if (error.errorCode === 4004) {
        return res.status(404).json({
          success: false,
          error: { code: 4004, message: error.message }
        });
      }

      logger.error(`[AssetController] 删除素材失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 获取所有用户素材列表（管理员专用）
   * GET /api/admin/assets
   * 查询参数: userId, type, featureId, startDate, endDate, page, limit
   */
  async getAllAssets(req, res, next) {
    try {
      const { userId, type, featureId, startDate, endDate, page, limit } = req.query;

      const result = await assetService.getAllAssets({
        userId,
        type,
        featureId,
        startDate,
        endDate,
        page,
        limit
      });

      res.json({
        success: true,
        ...result
      });

    } catch (error) {
      logger.error(`[AssetController] 管理员获取素材列表失败: ${error.message}`, error);
      next(error);
    }
  }
}

module.exports = new AssetController();
