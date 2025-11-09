/**
 * Account Controller
 * 艹！账户相关操作：额度查询、额度消费等！
 */

import { Request, Response, NextFunction } from 'express';
import quotaService from '../services/quota.service.js';

export class AccountController {
  /**
   * 获取用户额度信息
   * GET /api/account/quota
   * 艹！查看剩余额度，避免用户懵逼！
   */
  async getQuota(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as any)?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '未登录' }
        });
        return;
      }

      const quotaInfo = await quotaService.getQuota(userId);

      res.json({
        success: true,
        data: quotaInfo
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 消费额度
   * POST /api/account/quota/consume
   * 艹！执行任务前扣除额度，防止白嫖！
   */
  async consumeQuota(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as any)?.userId;
      const { action_type, quota_cost } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '未登录' }
        });
        return;
      }

      if (!action_type || quota_cost === undefined) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_PARAMS', message: '缺少action_type或quota_cost参数' }
        });
        return;
      }

      // 检查额度是否足够
      const hasEnough = await quotaService.checkQuota(userId, quota_cost);
      if (!hasEnough) {
        res.status(402).json({
          success: false,
          error: { code: 'INSUFFICIENT_QUOTA', message: '额度不足' }
        });
        return;
      }

      const quotaInfo = await quotaService.consumeImmediate(userId, quota_cost);

      res.json({
        success: true,
        message: '额度消费成功',
        data: {
          action_type,
          quota_cost,
          remaining: quotaInfo.remaining
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new AccountController();
