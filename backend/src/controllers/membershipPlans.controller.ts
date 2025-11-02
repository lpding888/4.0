/**
 * Membership Plans Controller
 * 艹，会员套餐控制器！
 */

import { Request, Response, NextFunction } from 'express';
import * as planRepo from '../repositories/membershipPlans.repo';
import { CreatePlanInput } from '../repositories/membershipPlans.repo';

export class MembershipPlansController {
  /**
   * 列出套餐（管理端）
   */
  async listPlans(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, limit = 50, offset = 0 } = req.query;

      const plans = await planRepo.listPlans({
        status: status as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });

      res.json({
        success: true,
        data: {
          items: plans,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        },
      });
    } catch (error: any) {
      console.error('[PlansController] 列出套餐失败:', error.message);
      next(error);
    }
  }

  /**
   * 获取激活的套餐（前台）
   */
  async getActivePlans(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plans = await planRepo.getActivePlans();

      res.json({
        success: true,
        data: plans,
      });
    } catch (error: any) {
      console.error('[PlansController] 获取激活套餐失败:', error.message);
      next(error);
    }
  }

  /**
   * 获取单个套餐
   */
  async getPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const plan = await planRepo.getPlanWithBenefits(id);

      if (!plan) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '套餐不存在' },
        });
        return;
      }

      res.json({ success: true, data: plan });
    } catch (error: any) {
      console.error('[PlansController] 获取套餐失败:', error.message);
      next(error);
    }
  }

  /**
   * 根据slug获取套餐
   */
  async getPlanBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slug } = req.params;
      const plan = await planRepo.getPlanBySlug(slug);

      if (!plan) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '套餐不存在' },
        });
        return;
      }

      // 加载权益
      const withBenefits = await planRepo.getPlanWithBenefits(plan.id);

      res.json({ success: true, data: withBenefits });
    } catch (error: any) {
      console.error('[PlansController] 获取套餐失败:', error.message);
      next(error);
    }
  }

  /**
   * 创建套餐
   */
  async createPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input: CreatePlanInput = req.body;

      // 艹，基础校验
      if (!input.name?.trim()) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '套餐名称不能为空' },
        });
        return;
      }

      if (!input.slug?.trim()) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'slug不能为空' },
        });
        return;
      }

      if (typeof input.price !== 'number' || input.price < 0) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '价格必须是非负数' },
        });
        return;
      }

      if (!input.duration_days || input.duration_days <= 0) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '有效期必须大于0' },
        });
        return;
      }

      const plan = await planRepo.createPlan(input);

      res.status(201).json({ success: true, data: plan });
    } catch (error: any) {
      console.error('[PlansController] 创建套餐失败:', error.message);
      next(error);
    }
  }

  /**
   * 更新套餐
   */
  async updatePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;

      const plan = await planRepo.updatePlan(id, updates);

      res.json({ success: true, data: plan });
    } catch (error: any) {
      if (error.message.includes('不存在')) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: error.message },
        });
        return;
      }
      console.error('[PlansController] 更新套餐失败:', error.message);
      next(error);
    }
  }

  /**
   * 删除套餐
   */
  async deletePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const deleted = await planRepo.deletePlan(id);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '套餐不存在' },
        });
        return;
      }

      res.json({ success: true, message: '套餐已删除' });
    } catch (error: any) {
      console.error('[PlansController] 删除套餐失败:', error.message);
      next(error);
    }
  }

  /**
   * 设置套餐权益
   * 艹，批量更新权益！
   */
  async setPlanBenefits(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan_id = parseInt(req.params.id);
      const { benefits } = req.body;

      if (!Array.isArray(benefits)) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'benefits必须是数组' },
        });
        return;
      }

      await planRepo.setBenefitsForPlan(plan_id, benefits);

      res.json({ success: true, message: '套餐权益设置成功' });
    } catch (error: any) {
      console.error('[PlansController] 设置套餐权益失败:', error.message);
      next(error);
    }
  }
}

export default new MembershipPlansController();
