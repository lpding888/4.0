import taskService from '../src/services/task.service.js';
import quotaService from '../src/services/quota.service.js';
import pipelineEngine from '../src/services/pipelineEngine.service.js';
import { db } from '../src/config/database.js';
import logger from '../src/utils/logger.js';

// Mock logger
jest.mock('../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

// Mock PipelineEngine
jest.mock('../src/services/pipelineEngine.service', () => ({
  pipelineEngine: {
    executePipeline: jest.fn().mockResolvedValue(undefined)
  }
}));

// Mock db
jest.mock('../src/db', () => {
  const mockDb = jest.fn((table: string) => {
    const mockTable: any = {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      first: jest.fn().mockReturnThis(),
      increment: jest.fn().mockReturnThis(),
      forUpdate: jest.fn().mockReturnThis()
    };

    // 为 users 表添加特殊处理
    if (table === 'users') {
      mockTable.first.mockReturnValue({
        id: 'test-user-id',
        username: 'test-user',
        quota_remaining: 10
      });

      // 模拟where链式调用后的first方法
      mockTable.where.mockImplementation(() => ({
        whereNull: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnValue({
          id: 'test-user-id',
          username: 'test-user',
          quota_remaining: 10
        }),
        del: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue(1),
        forUpdate: jest.fn().mockReturnThis()
      }));

      // 模拟forUpdate方法
      mockTable.forUpdate.mockReturnValue({
        first: jest.fn().mockReturnValue({
          id: 'test-user-id',
          username: 'test-user',
          quota_remaining: 10
        })
      });
    }

    // 为 feature_definitions 表添加特殊处理
    if (table === 'feature_definitions') {
      mockTable.first.mockReturnValue({
        feature_id: 'test-feature',
        quota_cost: 5,
        is_enabled: true,
        deleted_at: null
      });

      // 模拟where链式调用后的first方法
      mockTable.where.mockImplementation(() => ({
        whereNull: jest.fn().mockReturnThis(),
        first: jest.fn().mockReturnValue({
          feature_id: 'test-feature',
          quota_cost: 5,
          is_enabled: true,
          deleted_at: null
        }),
        del: jest.fn().mockResolvedValue(1)
      }));
    }

    // 为 quota_transactions 表添加特殊处理
    if (table === 'quota_transactions') {
      mockTable.first.mockReturnValue(null);

      // 模拟where链式调用后的first方法
      mockTable.where.mockImplementation(() => ({
        first: jest.fn().mockReturnValue(null),
        del: jest.fn().mockResolvedValue(1)
      }));
    }

    return mockTable;
  });

  // 添加transaction方法
  (mockDb as any).transaction = jest.fn((callback) => {
    // 模拟事务，直接执行回调
    return callback(
      jest.fn((table: string) => {
        const mockTrxTable: any = {
          where: jest.fn().mockReturnThis(),
          whereNull: jest.fn().mockReturnThis(),
          insert: jest.fn().mockResolvedValue(undefined),
          del: jest.fn().mockResolvedValue(undefined),
          update: jest.fn().mockResolvedValue(undefined),
          first: jest.fn().mockResolvedValue(undefined),
          increment: jest.fn().mockResolvedValue(undefined),
          forUpdate: jest.fn().mockReturnThis()
        };

        // 为 users 表添加特殊处理
        if (table === 'users') {
          mockTrxTable.first.mockReturnValue({
            id: 'test-user-id',
            username: 'test-user',
            quota_remaining: 10
          });

          // 模拟where链式调用后的first方法
          mockTrxTable.where.mockImplementation(() => ({
            whereNull: jest.fn().mockReturnThis(),
            first: jest.fn().mockReturnValue({
              id: 'test-user-id',
              username: 'test-user',
              quota_remaining: 10
            }),
            del: jest.fn().mockResolvedValue(1),
            update: jest.fn().mockResolvedValue(1),
            increment: jest.fn().mockResolvedValue(1),
            forUpdate: jest.fn().mockReturnThis()
          }));

          // 模拟forUpdate方法
          mockTrxTable.forUpdate.mockReturnValue({
            first: jest.fn().mockReturnValue({
              id: 'test-user-id',
              username: 'test-user',
              quota_remaining: 10
            })
          });
        }

        // 为 feature_definitions 表添加特殊处理
        if (table === 'feature_definitions') {
          mockTrxTable.first.mockReturnValue({
            feature_id: 'test-feature',
            quota_cost: 5,
            is_enabled: true,
            deleted_at: null
          });

          // 模拟where链式调用后的first方法
          mockTrxTable.where.mockImplementation(() => ({
            whereNull: jest.fn().mockReturnThis(),
            first: jest.fn().mockReturnValue({
              feature_id: 'test-feature',
              quota_cost: 5,
              is_enabled: true,
              deleted_at: null
            }),
            del: jest.fn().mockResolvedValue(1)
          }));
        }

        // 为 quota_transactions 表添加特殊处理
        if (table === 'quota_transactions') {
          mockTrxTable.first.mockReturnValue(null);

          // 模拟where链式调用后的first方法
          mockTrxTable.where.mockImplementation(() => ({
            first: jest.fn().mockReturnValue(null),
            del: jest.fn().mockResolvedValue(1)
          }));
        }

        return mockTrxTable;
      })
    );
  });

  return {
    __esModule: true,
    db: mockDb
  };
});

describe('配额Saga流程集成测试', () => {
  const mockDb = db as any;
  const userId = 'test-user-id';
  const featureId = 'test-feature-id';

  beforeAll(async () => {
    // 使用导入的服务实例

    // 创建测试用户
    await mockDb('users').insert({
      id: userId,
      username: 'test-user',
      quota_remaining: 10
    });

    // 创建测试功能
    await mockDb('feature_definitions').insert({
      feature_id: featureId,
      feature_name: 'Test Feature',
      quota_cost: 2,
      is_enabled: true,
      pipeline_schema_ref: 'test-pipeline'
    });

    // 创建测试Pipeline Schema
    await mockDb('pipeline_schemas').insert({
      pipeline_id: 'test-pipeline',
      steps: JSON.stringify([{ type: 'test-step', provider_ref: 'test-provider', timeout: 5000 }])
    });
  });

  afterAll(async () => {
    // 清理测试数据
    await mockDb('quota_transactions').where({ user_id: userId }).del();
    await mockDb('tasks').where({ userId }).del();
    await mockDb('pipeline_schemas').where({ pipeline_id: 'test-pipeline' }).del();
    await mockDb('feature_definitions').where({ feature_id: featureId }).del();
    await mockDb('users').where({ id: userId }).del();
  });

  beforeEach(async () => {
    // 清理任务和配额交易记录
    await mockDb('quota_transactions').where({ user_id: userId }).del();
    await mockDb('tasks').where({ userId }).del();

    // 重置用户配额
    await mockDb('users').where({ id: userId }).update({ quota_remaining: 10 });

    // 清除Mock调用记录
    jest.clearAllMocks();
  });

  describe('成功场景 - 完整Saga流程', () => {
    it('应该成功执行完整的Saga流程', async () => {
      // 准备测试数据
      const inputData = { imageUrl: 'http://example.com/image.jpg' };

      // 执行测试
      const result = await taskService.createByFeature(userId, featureId, inputData);

      // 验证任务创建
      expect(result).toHaveProperty('taskId');
      expect(result).toHaveProperty('featureId', featureId);
      expect(result).toHaveProperty('status', 'pending');
      expect(result).toHaveProperty('quotaCost', 2);

      const taskId = result.taskId;

      // 验证配额预留
      const reserveRecord = await mockDb('quota_transactions')
        .where({ task_id: taskId, phase: 'reserved' })
        .first();
      expect(reserveRecord).toBeTruthy();
      expect(reserveRecord.user_id).toBe(userId);
      expect(reserveRecord.amount).toBe(2);

      // 验证配额确认
      const confirmRecord = await mockDb('quota_transactions')
        .where({ task_id: taskId, phase: 'confirmed' })
        .first();
      expect(confirmRecord).toBeTruthy();

      // 验证用户配额扣减
      const user = await mockDb('users').where({ id: userId }).first();
      expect(user.quota_remaining).toBe(8); // 10 - 2

      // 验证Pipeline被调用
      const { pipelineEngine } = require('../src/services/pipelineEngine.service');
      expect(pipelineEngine.executePipeline).toHaveBeenCalledWith(taskId, featureId, inputData);
    });
  });

  describe('失败场景 - Pipeline执行失败', () => {
    it('应该在Pipeline失败时退还配额', async () => {
      // 准备测试数据
      const inputData = { imageUrl: 'http://example.com/image.jpg' };

      // Mock PipelineEngine执行失败
      const { pipelineEngine } = require('../src/services/pipelineEngine.service');
      pipelineEngine.executePipeline.mockRejectedValue(new Error('Pipeline执行失败'));

      // 执行测试
      const result = await taskService.createByFeature(userId, featureId, inputData);

      // 验证任务创建
      expect(result).toHaveProperty('taskId');
      const taskId = result.taskId;

      // 等待Pipeline执行失败和配额退还
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 验证配额取消
      const cancelRecord = await mockDb('quota_transactions')
        .where({ task_id: taskId, phase: 'cancelled' })
        .first();
      expect(cancelRecord).toBeTruthy();

      // 验证用户配额恢复
      const user = await mockDb('users').where({ id: userId }).first();
      expect(user.quota_remaining).toBe(10); // 配额应该被退还
    });
  });

  describe('失败场景 - 配额不足', () => {
    it('应该在配额不足时抛出错误', async () => {
      // 设置用户配额为0
      await mockDb('users').where({ id: userId }).update({ quota_remaining: 0 });

      // 修改模拟数据库，返回配额为0的用户
      (mockDb as any).transaction = jest.fn((callback) => {
        // 模拟事务，直接执行回调
        return callback(
          jest.fn((table: string) => {
            const mockTrxTable: any = {
              where: jest.fn().mockReturnThis(),
              whereNull: jest.fn().mockReturnThis(),
              insert: jest.fn().mockResolvedValue(undefined),
              del: jest.fn().mockResolvedValue(undefined),
              update: jest.fn().mockResolvedValue(undefined),
              first: jest.fn().mockResolvedValue(undefined),
              increment: jest.fn().mockResolvedValue(undefined),
              forUpdate: jest.fn().mockReturnThis()
            };

            // 为 users 表添加特殊处理
            if (table === 'users') {
              mockTrxTable.first.mockReturnValue({
                id: 'test-user-id',
                username: 'test-user',
                quota_remaining: 0 // 设置为0，模拟配额不足
              });

              // 模拟where链式调用后的first方法
              mockTrxTable.where.mockImplementation(() => ({
                whereNull: jest.fn().mockReturnThis(),
                first: jest.fn().mockReturnValue({
                  id: 'test-user-id',
                  username: 'test-user',
                  quota_remaining: 0 // 设置为0，模拟配额不足
                }),
                del: jest.fn().mockResolvedValue(1),
                update: jest.fn().mockResolvedValue(1),
                increment: jest.fn().mockResolvedValue(1),
                forUpdate: jest.fn().mockReturnThis()
              }));

              // 模拟forUpdate方法
              mockTrxTable.forUpdate.mockReturnValue({
                first: jest.fn().mockReturnValue({
                  id: 'test-user-id',
                  username: 'test-user',
                  quota_remaining: 0 // 设置为0，模拟配额不足
                })
              });
            }

            // 为 feature_definitions 表添加特殊处理
            if (table === 'feature_definitions') {
              mockTrxTable.first.mockReturnValue({
                feature_id: 'test-feature',
                quota_cost: 5,
                is_enabled: true,
                deleted_at: null
              });

              // 模拟where链式调用后的first方法
              mockTrxTable.where.mockImplementation(() => ({
                whereNull: jest.fn().mockReturnThis(),
                first: jest.fn().mockReturnValue({
                  feature_id: 'test-feature',
                  quota_cost: 5,
                  is_enabled: true,
                  deleted_at: null
                }),
                del: jest.fn().mockResolvedValue(1)
              }));
            }

            // 为 quota_transactions 表添加特殊处理
            if (table === 'quota_transactions') {
              mockTrxTable.first.mockReturnValue(null);

              // 模拟where链式调用后的first方法
              mockTrxTable.where.mockImplementation(() => ({
                first: jest.fn().mockReturnValue(null),
                del: jest.fn().mockResolvedValue(1)
              }));
            }

            return mockTrxTable;
          })
        );
      });

      // 准备测试数据
      const inputData = { imageUrl: 'http://example.com/image.jpg' };

      // 执行测试并验证异常
      await expect(taskService.createByFeature(userId, featureId, inputData)).rejects.toThrow(
        '配额不足'
      );

      // 验证没有创建任务
      const task = await mockDb('tasks').where({ userId }).first();
      expect(task).toBeFalsy();

      // 验证没有配额交易记录
      const transaction = await mockDb('quota_transactions').where({ user_id: userId }).first();
      expect(transaction).toBeFalsy();

      // 验证用户配额没有变化
      const user = await mockDb('users').where({ id: userId }).first();
      expect(user.quota_remaining).toBe(0);
    });
  });

  describe('幂等性测试', () => {
    it('应该正确处理重复的confirm调用', async () => {
      // 准备测试数据
      const inputData = { imageUrl: 'http://example.com/image.jpg' };
      const result = await taskService.createByFeature(userId, featureId, inputData);
      const taskId = result.taskId;

      // 保存原始的事务模拟和用户查询
      const originalTransaction = (mockDb as any).transaction;
      const originalUserQuery = mockDb('users').where;

      // 修改用户查询，确保confirm操作能找到用户
      mockDb('users').where.mockImplementation((query: any) => {
        if (query.id === userId) {
          return {
            first: jest.fn().mockReturnValue({
              id: 'test-user-id',
              username: 'test-user',
              quota_remaining: 8 // 已经扣减了2
            })
          };
        }
        return originalUserQuery(query);
      });

      // 设置事务模拟，确保confirm操作的幂等性
      (mockDb as any).transaction = jest.fn((callback) => {
        return callback(
          jest.fn((table: string) => {
            const mockTrxTable: any = {
              where: jest.fn().mockReturnThis(),
              whereNull: jest.fn().mockReturnThis(),
              insert: jest.fn().mockResolvedValue(undefined),
              del: jest.fn().mockResolvedValue(undefined),
              update: jest.fn().mockResolvedValue(undefined),
              first: jest.fn().mockResolvedValue(undefined),
              increment: jest.fn().mockResolvedValue(undefined),
              forUpdate: jest.fn().mockReturnThis()
            };

            // 为 users 表添加特殊处理，确保正确返回用户配额
            if (table === 'users') {
              mockTrxTable.first.mockReturnValue({
                id: 'test-user-id',
                username: 'test-user',
                quota_remaining: 8 // 已经扣减了2
              });

              mockTrxTable.where.mockImplementation(() => ({
                whereNull: jest.fn().mockReturnThis(),
                first: jest.fn().mockReturnValue({
                  id: 'test-user-id',
                  username: 'test-user',
                  quota_remaining: 8 // 已经扣减了2
                }),
                del: jest.fn().mockResolvedValue(1),
                update: jest.fn().mockResolvedValue(1),
                increment: jest.fn().mockResolvedValue(1),
                forUpdate: jest.fn().mockReturnThis()
              }));

              mockTrxTable.forUpdate.mockReturnValue({
                first: jest.fn().mockReturnValue({
                  id: 'test-user-id',
                  username: 'test-user',
                  quota_remaining: 8 // 已经扣减了2
                })
              });
            }

            if (table === 'quota_transactions') {
              mockTrxTable.where.mockImplementation((query: any) => {
                if (query.task_id === taskId && query.phase === 'reserved') {
                  return {
                    first: jest.fn().mockReturnValue({
                      id: 'reserved-record',
                      task_id: taskId,
                      phase: 'reserved',
                      amount: 2
                    }),
                    update: jest.fn().mockResolvedValue(1) // 第一次confirm更新reserved记录
                  };
                }
                if (query.task_id === taskId && query.phase === 'confirmed') {
                  return {
                    first: jest.fn().mockReturnValue(null), // 第二次confirm找不到reserved记录
                    update: jest.fn().mockResolvedValue(0) // 没有记录被更新
                  };
                }
                return {
                  first: jest.fn().mockReturnValue(null),
                  update: jest.fn().mockResolvedValue(0)
                };
              });
            }

            return mockTrxTable;
          })
        );
      });

      // 第一次confirm
      await quotaService.confirm(taskId);

      // 第二次confirm应该是幂等的
      await quotaService.confirm(taskId);

      // 恢复原始的事务模拟和用户查询
      (mockDb as any).transaction = originalTransaction;
      mockDb('users').where = originalUserQuery;

      // 验证用户配额只被扣减了一次
      const user = await mockDb('users').where({ id: userId }).first();
      expect(user.quota_remaining).toBe(8); // 10 - 2 = 8
    });

    it('应该正确处理重复的cancel调用', async () => {
      // 准备测试数据
      const inputData = { imageUrl: 'http://example.com/image.jpg' };
      const result = await taskService.createByFeature(userId, featureId, inputData);
      const taskId = result.taskId;

      // 保存原始的事务模拟和用户查询
      const originalTransaction = (mockDb as any).transaction;
      const originalUserQuery = mockDb('users').where;

      // 修改用户查询，确保cancel操作能找到用户
      mockDb('users').where.mockImplementation((query: any) => {
        if (query.id === userId) {
          return {
            first: jest.fn().mockReturnValue({
              id: 'test-user-id',
              username: 'test-user',
              quota_remaining: 8 // 已经扣减了2
            })
          };
        }
        return originalUserQuery(query);
      });

      // 设置事务模拟，确保cancel操作的幂等性
      (mockDb as any).transaction = jest.fn((callback) => {
        return callback(
          jest.fn((table: string) => {
            const mockTrxTable: any = {
              where: jest.fn().mockReturnThis(),
              whereNull: jest.fn().mockReturnThis(),
              insert: jest.fn().mockResolvedValue(undefined),
              del: jest.fn().mockResolvedValue(undefined),
              update: jest.fn().mockResolvedValue(undefined),
              first: jest.fn().mockResolvedValue(undefined),
              increment: jest.fn().mockResolvedValue(undefined),
              forUpdate: jest.fn().mockReturnThis()
            };

            // 为 users 表添加特殊处理，确保正确返回用户配额
            if (table === 'users') {
              mockTrxTable.first.mockReturnValue({
                id: 'test-user-id',
                username: 'test-user',
                quota_remaining: 10 // 已经退还了2，恢复到10
              });

              mockTrxTable.where.mockImplementation(() => ({
                whereNull: jest.fn().mockReturnThis(),
                first: jest.fn().mockReturnValue({
                  id: 'test-user-id',
                  username: 'test-user',
                  quota_remaining: 10 // 已经退还了2，恢复到10
                }),
                del: jest.fn().mockResolvedValue(1),
                update: jest.fn().mockResolvedValue(1),
                increment: jest.fn().mockResolvedValue(1),
                forUpdate: jest.fn().mockReturnThis()
              }));

              mockTrxTable.forUpdate.mockReturnValue({
                first: jest.fn().mockReturnValue({
                  id: 'test-user-id',
                  username: 'test-user',
                  quota_remaining: 10 // 已经退还了2，恢复到10
                })
              });
            }

            if (table === 'quota_transactions') {
              mockTrxTable.where.mockImplementation((query: any) => {
                if (query.task_id === taskId && query.phase === 'reserved') {
                  return {
                    first: jest.fn().mockReturnValue({
                      id: 'reserved-record',
                      task_id: taskId,
                      phase: 'reserved',
                      amount: 2
                    }),
                    update: jest.fn().mockResolvedValue(1) // 第一次cancel更新reserved记录
                  };
                }
                if (query.task_id === taskId && query.phase === 'cancelled') {
                  return {
                    first: jest.fn().mockReturnValue(null), // 第二次cancel找不到reserved记录
                    update: jest.fn().mockResolvedValue(0) // 没有记录被更新
                  };
                }
                return {
                  first: jest.fn().mockReturnValue(null),
                  update: jest.fn().mockResolvedValue(0)
                };
              });
            }

            return mockTrxTable;
          })
        );
      });

      // 第一次cancel
      await quotaService.cancel(taskId);

      // 第二次cancel应该是幂等的
      await quotaService.cancel(taskId);

      // 恢复原始的事务模拟和用户查询
      (mockDb as any).transaction = originalTransaction;
      mockDb('users').where = originalUserQuery;

      // 验证用户配额只被退还了一次
      const user = await mockDb('users').where({ id: userId }).first();
      expect(user.quota_remaining).toBe(10); // 退还2，恢复到10
    });
  });
});
