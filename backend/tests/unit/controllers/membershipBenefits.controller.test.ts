/**
 * MembershipBenefitsController 单元测试
 * 艹，快速覆盖核心逻辑！
 */

import { Request, Response, NextFunction } from 'express';
import { MembershipBenefitsController } from '../../../src/controllers/membershipBenefits.controller';
import * as benefitRepo from '../../../src/repositories/membershipBenefits.repo';

jest.mock('../../../src/repositories/membershipBenefits.repo');

describe('MembershipBenefitsController - 单元测试', () => {
  let controller: MembershipBenefitsController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    controller = new MembershipBenefitsController();
    mockReq = { params: {}, query: {}, body: {} };
    mockRes = { json: jest.fn().mockReturnThis(), status: jest.fn().mockReturnThis() };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('listBenefits', () => {
    test('应该成功列出权益', async () => {
      const mockBenefits = [{ id: 1, name: '无限上传', key: 'unlimited_upload' }];
      (benefitRepo.listBenefits as jest.Mock).mockResolvedValue(mockBenefits);

      await controller.listBenefits(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ items: mockBenefits }),
      });
    });
  });

  describe('createBenefit', () => {
    test('应该成功创建权益', async () => {
      const input = { name: '优先支持', key: 'priority_support', type: 'service' as const };
      const created = { id: 1, ...input };
      (benefitRepo.createBenefit as jest.Mock).mockResolvedValue(created);

      mockReq.body = input;

      await controller.createBenefit(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: created });
    });

    test('权益名称为空应该返回400', async () => {
      mockReq.body = { name: '', key: 'test', type: 'feature' };

      await controller.createBenefit(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('key为空应该返回400', async () => {
      mockReq.body = { name: '测试', key: '', type: 'feature' };

      await controller.createBenefit(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('type无效应该返回400', async () => {
      mockReq.body = { name: '测试', key: 'test', type: 'invalid' };

      await controller.createBenefit(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getBenefit', () => {
    test('应该成功获取权益', async () => {
      const mock = { id: 1, name: '测试', key: 'test' };
      (benefitRepo.getBenefitById as jest.Mock).mockResolvedValue(mock);

      mockReq.params = { id: '1' };

      await controller.getBenefit(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: mock });
    });

    test('权益不存在应该返回404', async () => {
      (benefitRepo.getBenefitById as jest.Mock).mockResolvedValue(null);

      mockReq.params = { id: '999' };

      await controller.getBenefit(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('updateBenefit', () => {
    test('应该成功更新权益', async () => {
      const updated = { id: 1, name: '更新后' };
      (benefitRepo.updateBenefit as jest.Mock).mockResolvedValue(updated);

      mockReq.params = { id: '1' };
      mockReq.body = { name: '更新后' };

      await controller.updateBenefit(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: updated });
    });
  });

  describe('deleteBenefit', () => {
    test('应该成功删除权益', async () => {
      (benefitRepo.deleteBenefit as jest.Mock).mockResolvedValue(true);

      mockReq.params = { id: '1' };

      await controller.deleteBenefit(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, message: '权益已删除' });
    });

    test('删除不存在的权益应该返回404', async () => {
      (benefitRepo.deleteBenefit as jest.Mock).mockResolvedValue(false);

      mockReq.params = { id: '999' };

      await controller.deleteBenefit(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });
});
