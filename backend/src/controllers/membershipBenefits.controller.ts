/**
 * Membership Benefits Controller
 * 艹，会员权益控制器！
 */

import { Request, Response, NextFunction } from 'express';
import * as benefitRepo from '../repositories/membershipBenefits.repo';
import { CreateBenefitInput } from '../repositories/membershipBenefits.repo';

export class MembershipBenefitsController {
  /**
   * 列出权益（管理端）
   */
  async listBenefits(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type, status, limit = 50, offset = 0 } = req.query;

      const benefits = await benefitRepo.listBenefits({
        type: type as string,
        status: status as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });

      res.json({
        success: true,
        data: {
          items: benefits,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        },
      });
    } catch (error: any) {
      console.error('[BenefitsController] 列出权益失败:', error.message);
      next(error);
    }
  }

  /**
   * 获取激活的权益（前台）
   */
  async getActiveBenefits(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type } = req.query;

      const benefits = await benefitRepo.getActiveBenefits({
        type: type as string,
      });

      res.json({
        success: true,
        data: benefits,
      });
    } catch (error: any) {
      console.error('[BenefitsController] 获取激活权益失败:', error.message);
      next(error);
    }
  }

  /**
   * 获取单个权益
   */
  async getBenefit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const benefit = await benefitRepo.getBenefitById(id);

      if (!benefit) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '权益不存在' },
        });
        return;
      }

      res.json({ success: true, data: benefit });
    } catch (error: any) {
      console.error('[BenefitsController] 获取权益失败:', error.message);
      next(error);
    }
  }

  /**
   * 创建权益
   */
  async createBenefit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input: CreateBenefitInput = req.body;

      // 艹，基础校验
      if (!input.name?.trim()) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '权益名称不能为空' },
        });
        return;
      }

      if (!input.key?.trim()) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'key不能为空' },
        });
        return;
      }

      if (!['feature', 'quota', 'service', 'discount'].includes(input.type)) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'type必须是feature/quota/service/discount之一' },
        });
        return;
      }

      const benefit = await benefitRepo.createBenefit(input);

      res.status(201).json({ success: true, data: benefit });
    } catch (error: any) {
      console.error('[BenefitsController] 创建权益失败:', error.message);
      next(error);
    }
  }

  /**
   * 更新权益
   */
  async updateBenefit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;

      const benefit = await benefitRepo.updateBenefit(id, updates);

      res.json({ success: true, data: benefit });
    } catch (error: any) {
      if (error.message.includes('不存在')) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: error.message },
        });
        return;
      }
      console.error('[BenefitsController] 更新权益失败:', error.message);
      next(error);
    }
  }

  /**
   * 删除权益
   */
  async deleteBenefit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const deleted = await benefitRepo.deleteBenefit(id);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '权益不存在' },
        });
        return;
      }

      res.json({ success: true, message: '权益已删除' });
    } catch (error: any) {
      console.error('[BenefitsController] 删除权益失败:', error.message);
      next(error);
    }
  }
}

export default new MembershipBenefitsController();
