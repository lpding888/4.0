const featureService = require('../services/feature.service');
const logger = require('../utils/logger');

/**
 * Feature Controller - 功能卡片控制器
 * 处理功能卡片相关的HTTP请求
 */
class FeatureController {
  /**
   * GET /api/features
   * 获取功能卡片列表
   * 艹！未登录返回所有启用的功能，已登录返回用户可用的功能！
   */
  async getFeatures(req, res) {
    try {
      let features;

      // 如果未登录，返回所有启用的功能（首页展示用）
      if (!req.user) {
        features = await featureService.getAllEnabledFeatures();
      } else {
        // 如果已登录，返回用户可用的功能（根据权限过滤）
        const userId = req.user.id;
        features = await featureService.getAvailableFeatures(userId);
      }

      res.json({
        success: true,
        data: features
      });

    } catch (error) {
      logger.error(`[FeatureController] 获取功能列表失败: ${error.message}`, { error });
      res.status(error.statusCode || 500).json({
        success: false,
        errorCode: error.errorCode || 5000,
        message: error.message || '获取功能列表失败'
      });
    }
  }

  /**
   * GET /api/features/:featureId/form-schema
   * 获取功能的表单Schema
   */
  async getFormSchema(req, res) {
    try {
      const { featureId } = req.params;
      const userId = req.user.id;

      const formSchema = await featureService.getFormSchema(featureId, userId);

      res.json({
        success: true,
        ...formSchema
      });

    } catch (error) {
      logger.error(`[FeatureController] 获取表单Schema失败: ${error.message}`, { error });
      res.status(error.statusCode || 500).json({
        success: false,
        errorCode: error.errorCode || 5000,
        message: error.message || '获取表单Schema失败'
      });
    }
  }
}

module.exports = new FeatureController();
