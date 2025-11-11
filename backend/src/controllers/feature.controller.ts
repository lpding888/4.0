import type { Request, Response } from 'express';
import featureService from '../services/feature.service.js';
import logger from '../utils/logger.js';
import type { AuthRequest } from '../middlewares/auth.middleware.js';

interface FeatureError {
  statusCode?: number;
  errorCode?: number;
  message?: string;
}

/**
 * Feature Controller - 功能卡片控制器（TS版）
 * 处理功能卡片相关的HTTP请求
 */
class FeatureController {
  // 这个SB函数处理获取功能列表，未登录返回启用的功能，已登录按权限过滤
  async getFeatures(req: Request, res: Response): Promise<void> {
    try {
      let features;

      // 未登录：返回所有启用的功能（首页展示用）
      const authReq = req as AuthRequest;

      if (!authReq.user) {
        features = await featureService.getAllEnabledFeatures();
      } else {
        // 已登录：根据权限返回可用功能
        const userId = authReq.user.id;
        features = await featureService.getAvailableFeatures(userId);
      }

      res.json({ success: true, data: features });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      const featureErr = error as unknown as FeatureError;
      logger.error(`[FeatureController] 获取功能列表失败: ${featureErr?.message}`, { error });
      res.status(featureErr?.statusCode ?? 500).json({
        success: false,
        errorCode: featureErr?.errorCode ?? 5000,
        message: featureErr?.message ?? '获取功能列表失败'
      });
    }
  }

  // 这个SB函数返回某个功能的表单Schema，需要登录
  async getFormSchema(req: Request, res: Response): Promise<void> {
    try {
      const { featureId } = req.params as { featureId: string };
      const authReq = req as AuthRequest;
      const userId = authReq.user?.id ?? '';

      const formSchema = await featureService.getFormSchema(featureId, userId);

      res.json({ success: true, ...formSchema });
    } catch (error: unknown) {
      const featureErr = error as unknown as FeatureError;
      logger.error(`[FeatureController] 获取表单Schema失败: ${featureErr?.message}`, { error });
      res.status(featureErr?.statusCode ?? 500).json({
        success: false,
        errorCode: featureErr?.errorCode ?? 5000,
        message: featureErr?.message ?? '获取表单Schema失败'
      });
    }
  }
}

export default new FeatureController();
