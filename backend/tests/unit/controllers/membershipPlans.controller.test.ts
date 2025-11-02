/**
 * MembershipPlansController 单元测试
 * 艹，快速覆盖核心逻辑！
 */

import { Request, Response, NextFunction } from 'express';
import { MembershipPlansController } from '../../../src/controllers/membershipPlans.controller';
import * as planRepo from '../../../src/repositories/membershipPlans.repo';

jest.mock('../../../src/repositories/membershipPlans.repo');

describe('MembershipPlansController - 单元测试', () => {
  let controller: MembershipPlansController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    controller = new MembershipPlansController();
    mockReq = { params: {}, query: {}, body: {} };
    mockRes = { json: jest.fn().mockReturnThis(), status: jest.fn().mockReturnThis() };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('listPlans', () => {
    test('应该成功列出套餐', async () => {
      const mockPlans = [{ id: 1, name: '基础套餐', slug: 'basic' }];
      (planRepo.listPlans as jest.Mock).mockResolvedValue(mockPlans);

      await controller.listPlans(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ items: mockPlans }),
      });
    });
  });

  describe('createPlan', () => {
    test('应该成功创建套餐', async () => {
      const input = { name: '高级套餐', slug: 'premium', price: 99.0, duration_days: 30 };
      const created = { id: 1, ...input };
      (planRepo.createPlan as jest.Mock).mockResolvedValue(created);

      mockReq.body = input;

      await controller.createPlan(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: created });
    });

    test('套餐名称为空应该返回400', async () => {
      mockReq.body = { name: '', slug: 'test', price: 99, duration_days: 30 };

      await controller.createPlan(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('slug为空应该返回400', async () => {
      mockReq.body = { name: '测试', slug: '', price: 99, duration_days: 30 };

      await controller.createPlan(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('价格为负数应该返回400', async () => {
      mockReq.body = { name: '测试', slug: 'test', price: -10, duration_days: 30 };

      await controller.createPlan(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('有效期小于等于0应该返回400', async () => {
      mockReq.body = { name: '测试', slug: 'test', price: 99, duration_days: 0 };

      await controller.createPlan(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getPlan', () => {
    test('应该成功获取套餐', async () => {
      const mock = { id: 1, name: '测试', benefits: [] };
      (planRepo.getPlanWithBenefits as jest.Mock).mockResolvedValue(mock);

      mockReq.params = { id: '1' };

      await controller.getPlan(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: mock });
    });

    test('套餐不存在应该返回404', async () => {
      (planRepo.getPlanWithBenefits as jest.Mock).mockResolvedValue(null);

      mockReq.params = { id: '999' };

      await controller.getPlan(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('updatePlan', () => {
    test('应该成功更新套餐', async () => {
      const updated = { id: 1, name: '更新后' };
      (planRepo.updatePlan as jest.Mock).mockResolvedValue(updated);

      mockReq.params = { id: '1' };
      mockReq.body = { name: '更新后' };

      await controller.updatePlan(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: updated });
    });
  });

  describe('deletePlan', () => {
    test('应该成功删除套餐', async () => {
      (planRepo.deletePlan as jest.Mock).mockResolvedValue(true);

      mockReq.params = { id: '1' };

      await controller.deletePlan(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, message: '套餐已删除' });
    });

    test('删除不存在的套餐应该返回404', async () => {
      (planRepo.deletePlan as jest.Mock).mockResolvedValue(false);

      mockReq.params = { id: '999' };

      await controller.deletePlan(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('setPlanBenefits', () => {
    test('应该成功设置套餐权益', async () => {
      (planRepo.setBenefitsForPlan as jest.Mock).mockResolvedValue(undefined);

      mockReq.params = { id: '1' };
      mockReq.body = { benefits: [{ benefit_id: 1, sort_order: 0 }] };

      await controller.setPlanBenefits(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, message: '套餐权益设置成功' });
    });

    test('benefits不是数组应该返回400', async () => {
      mockReq.params = { id: '1' };
      mockReq.body = { benefits: 'not-array' };

      await controller.setPlanBenefits(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });
});
