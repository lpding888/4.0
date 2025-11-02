/**
 * AuditLogsController 单元测试
 * 艹，快速覆盖核心逻辑！
 */

import { Request, Response, NextFunction } from 'express';
import { AuditLogsController } from '../../../src/controllers/auditLogs.controller';
import * as auditRepo from '../../../src/repositories/auditLogs.repo';

jest.mock('../../../src/repositories/auditLogs.repo');

describe('AuditLogsController - 单元测试', () => {
  let controller: AuditLogsController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    controller = new AuditLogsController();
    mockReq = { params: {}, query: {}, body: {} };
    mockRes = { json: jest.fn().mockReturnThis(), status: jest.fn().mockReturnThis() };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('listAuditLogs', () => {
    test('应该成功列出审计日志', async () => {
      const mockLogs = [{ id: 1, entity_type: 'announcement', action: 'create' }];
      (auditRepo.listAuditLogs as jest.Mock).mockResolvedValue(mockLogs);
      (auditRepo.countAuditLogs as jest.Mock).mockResolvedValue(10);

      await controller.listAuditLogs(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          items: mockLogs,
          total: 10,
        }),
      });
    });
  });

  describe('getEntityHistory', () => {
    test('应该成功获取实体历史', async () => {
      const mockHistory = [
        { id: 1, entity_type: 'announcement', entity_id: 1, action: 'create' },
      ];
      (auditRepo.getEntityHistory as jest.Mock).mockResolvedValue(mockHistory);

      mockReq.params = { entity_type: 'announcement', entity_id: '1' };

      await controller.getEntityHistory(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockHistory,
      });
    });
  });

  describe('getUserHistory', () => {
    test('应该成功获取用户历史', async () => {
      const mockHistory = [{ id: 1, user_id: 1, action: 'create' }];
      (auditRepo.getUserHistory as jest.Mock).mockResolvedValue(mockHistory);

      mockReq.params = { user_id: '1' };
      mockReq.query = {};

      await controller.getUserHistory(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockHistory,
      });
    });
  });

  describe('getAuditLog', () => {
    test('应该成功获取单条审计日志', async () => {
      const mock = { id: 1, entity_type: 'announcement', action: 'create' };
      (auditRepo.getAuditLogById as jest.Mock).mockResolvedValue(mock);

      mockReq.params = { id: '1' };

      await controller.getAuditLog(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: mock });
    });

    test('审计日志不存在应该返回404', async () => {
      (auditRepo.getAuditLogById as jest.Mock).mockResolvedValue(null);

      mockReq.params = { id: '999' };

      await controller.getAuditLog(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });
});
