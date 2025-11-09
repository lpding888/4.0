import quotaService from '../src/services/quota.service.js';
import { db } from '../src/config/database.js';
import { AppError } from '../src/utils/AppError.js';
import { ERROR_CODES } from '../src/config/error-codes.js';

// 兼容旧代码中的ErrorCode引用
const ErrorCode = ERROR_CODES;

// Mock数据库
jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: {
    transaction: jest.fn(),
    raw: jest.fn(),
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    first: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    increment: jest.fn().mockReturnThis(),
  },
}));

// Mock UUID
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234'),
}));

describe('QuotaService', () => {
  const mockDb = db as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('reserve', () => {
    it('应该成功预留配额', async () => {
      // 准备测试数据
      const userId = 'user123';
      const taskId = 'task123';
      const amount = 2;
      const mockUser = { id: userId, quota_remaining: 10 };

      // Mock数据库事务
      const mockTrx = {
        where: jest.fn().mockReturnThis(),
        forUpdate: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockUser),
        insert: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
      } as any;

      mockDb.transaction.mockImplementation(async (callback: any) => {
        await callback(mockTrx);
      });

      // 执行测试
      await quotaService.reserve(userId, taskId, amount);

      // 验证调用
      expect(mockTrx.where).toHaveBeenCalledWith({ id: userId });
      expect(mockTrx.forUpdate).toHaveBeenCalled();
      expect(mockTrx.first).toHaveBeenCalled();
      expect(mockTrx.update).toHaveBeenCalledWith({
        quota_remaining: 8, // 10 - 2
      });
      expect(mockTrx.insert).toHaveBeenCalledWith({
        id: 'mock-uuid-1234',
        task_id: taskId,
        user_id: userId,
        amount,
        phase: 'reserved',
        idempotent_done: true,
      });
    });

    it('应该抛出配额不足错误', async () => {
      // 准备测试数据
      const userId = 'user123';
      const taskId = 'task123';
      const amount = 5;
      const mockUser = { id: userId, quota_remaining: 2 }; // 配额不足

      // Mock数据库事务
      const mockTrx = {
        where: jest.fn().mockReturnThis(),
        forUpdate: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockUser),
      } as any;

      mockDb.transaction.mockImplementation(async (callback: any) => {
        await callback(mockTrx);
      });

      // 执行测试并验证异常
      await expect(quotaService.reserve(userId, taskId, amount)).rejects.toThrow(
        new AppError(ErrorCode.USER_QUOTA_EXCEEDED, '配额不足,请续费')
      );
    });

    it('应该抛出用户不存在错误', async () => {
      // 准备测试数据
      const userId = 'user123';
      const taskId = 'task123';
      const amount = 1;

      // Mock数据库事务
      const mockTrx = {
        where: jest.fn().mockReturnThis(),
        forUpdate: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null), // 用户不存在
      } as any;

      mockDb.transaction.mockImplementation(async (callback: any) => {
        await callback(mockTrx);
      });

      // 执行测试并验证异常
      await expect(quotaService.reserve(userId, taskId, amount)).rejects.toThrow(
        new AppError(ErrorCode.USER_QUOTA_EXCEEDED, '配额不足,请续费')
      );
    });
  });

  describe('confirm', () => {
    it('应该成功确认配额扣减', async () => {
      // 准备测试数据
      const taskId = 'task123';
      const mockRecord = {
        task_id: taskId,
        phase: 'reserved',
        idempotent_done: true,
      };

      // Mock数据库查询
      const whereMock = jest.fn().mockReturnThis();
      const firstMock = jest.fn().mockResolvedValue(mockRecord);
      const updateMock = jest.fn().mockResolvedValue(undefined);
      
      mockDb.where = whereMock;
      mockDb.first = firstMock;
      mockDb.update = updateMock;

      // 执行测试
      await quotaService.confirm(taskId);

      // 验证调用
      expect(whereMock).toHaveBeenCalledWith({ task_id: taskId, phase: 'reserved' });
      expect(firstMock).toHaveBeenCalled();
      expect(updateMock).toHaveBeenCalledWith({ phase: 'confirmed' });
    });

    it('应该处理幂等性检查 - 记录不存在', async () => {
      // 准备测试数据
      const taskId = 'task123';

      // Mock数据库查询
      const whereMock = jest.fn().mockReturnThis();
      const firstMock = jest.fn().mockResolvedValue(null); // 记录不存在
      const updateMock = jest.fn().mockResolvedValue(undefined);
      
      mockDb.where = whereMock;
      mockDb.first = firstMock;
      mockDb.update = updateMock;

      // 执行测试
      await quotaService.confirm(taskId);

      // 验证调用
      expect(whereMock).toHaveBeenCalledWith({ task_id: taskId, phase: 'reserved' });
      expect(firstMock).toHaveBeenCalled();
      expect(updateMock).not.toHaveBeenCalled();
    });

    it('应该处理幂等性检查 - idempotent_done为false', async () => {
      // 准备测试数据
      const taskId = 'task123';
      const mockRecord = {
        task_id: taskId,
        phase: 'confirmed', // 不是reserved状态
        idempotent_done: false,
      };

      // Mock数据库查询
      const whereMock = jest.fn().mockReturnThis();
      const firstMock = jest.fn().mockResolvedValue(mockRecord);
      const updateMock = jest.fn().mockResolvedValue(undefined);
      
      mockDb.where = whereMock;
      mockDb.first = firstMock;
      mockDb.update = updateMock;

      // 执行测试
      await quotaService.cancel(taskId);

      // 验证调用
      expect(whereMock).toHaveBeenCalledWith({ task_id: taskId, phase: 'reserved' });
      expect(firstMock).toHaveBeenCalled();
      expect(updateMock).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('应该成功取消配额预留', async () => {
      // 准备测试数据
      const taskId = 'task123';
      const userId = 'user123';
      const amount = 2;
      const mockRecord = {
        task_id: taskId,
        user_id: userId,
        amount,
        phase: 'reserved',
      };

      // Mock数据库事务
      const whereCalls: any[] = [];
      const whereMock = jest.fn().mockImplementation((query: any) => {
        whereCalls.push(query);
        return {
          first: jest.fn().mockResolvedValue(mockRecord),
          increment: jest.fn().mockResolvedValue(undefined),
          update: jest.fn().mockResolvedValue(undefined),
        };
      });
      
      const mockTrx = {
        where: whereMock,
        first: jest.fn().mockResolvedValue(mockRecord),
        increment: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
      } as any;

      mockDb.transaction.mockImplementation(async (callback: any) => {
        await callback(mockTrx);
      });

      // 执行测试
      await quotaService.cancel(taskId);

      // 验证调用
      expect(whereCalls).toContainEqual({ task_id: taskId, phase: 'reserved' });
      expect(whereCalls).toContainEqual({ id: userId });
      expect(whereCalls).toContainEqual({ task_id: taskId });
    });

    it('应该处理幂等性检查 - 记录不存在', async () => {
      // 准备测试数据
      const taskId = 'task123';

      // Mock数据库事务
      const mockTrx = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null), // 记录不存在
      } as any;

      mockDb.transaction.mockImplementation(async (callback: any) => {
        await callback(mockTrx);
      });

      // 执行测试
      await quotaService.cancel(taskId);

      // 验证调用
      expect(mockTrx.where).toHaveBeenCalledWith({ task_id: taskId, phase: 'reserved' });
      expect(mockTrx.first).toHaveBeenCalled();
      expect(mockTrx.increment).not.toHaveBeenCalled();
      expect(mockTrx.update).not.toHaveBeenCalled();
    });

    it('应该处理幂等性检查 - 状态不是reserved', async () => {
      // 准备测试数据
      const taskId = 'task123';
      const mockRecord = {
        task_id: taskId,
        phase: 'confirmed', // 状态不是reserved
      };

      // Mock数据库事务
      const mockTrx = {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockRecord),
      } as any;

      mockDb.transaction.mockImplementation(async (callback: any) => {
        await callback(mockTrx);
      });

      // 执行测试
      await quotaService.cancel(taskId);

      // 验证调用
      expect(mockTrx.where).toHaveBeenCalledWith({ task_id: taskId, phase: 'reserved' });
      expect(mockTrx.first).toHaveBeenCalled();
      expect(mockTrx.increment).not.toHaveBeenCalled();
      expect(mockTrx.update).not.toHaveBeenCalled();
    });
  });
});