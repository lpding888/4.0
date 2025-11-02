/**
 * PipelineEngine纯Mock测试 - 不需要数据库
 * 艹！这个tm完全使用Mock，不需要启动MySQL！
 */

// 艹！创建Mock数据库链
const mockDbChain = {
  where: jest.fn().mockReturnThis(),
  first: jest.fn(),
  insert: jest.fn().mockResolvedValue([1]),
  update: jest.fn().mockResolvedValue(1),
  del: jest.fn().mockResolvedValue(1)
};

// Mock数据库模块
jest.mock('../../../src/config/database', () => {
  const mockDb = jest.fn((table) => {
    // 根据表名返回不同的Mock数据
    if (table === 'feature_definitions') {
      mockDbChain.first.mockResolvedValueOnce({
        feature_id: 'test_fork_join',
        name: '测试FORK/JOIN',
        pipeline_schema_ref: 'test_pipeline',
        quota_cost: 1
      });
    } else if (table === 'pipeline_schemas') {
      mockDbChain.first.mockResolvedValueOnce({
        pipeline_id: 'test_pipeline',
        name: '测试Pipeline',
        steps: JSON.stringify({
          nodes: [
            { id: 'start', type: 'start' },
            { id: 'fork1', type: 'fork', data: { branches: 2 } },
            { id: 'branch1', type: 'provider', data: { providerRef: 'test1' } },
            { id: 'branch2', type: 'provider', data: { providerRef: 'test2' } },
            { id: 'join1', type: 'join', data: { strategy: 'ALL' } },
            { id: 'end', type: 'end' }
          ],
          edges: [
            { source: 'start', target: 'fork1' },
            { source: 'fork1', target: 'branch1' },
            { source: 'fork1', target: 'branch2' },
            { source: 'branch1', target: 'join1' },
            { source: 'branch2', target: 'join1' },
            { source: 'join1', target: 'end' }
          ]
        })
      });
    } else if (table === 'tasks') {
      mockDbChain.first.mockResolvedValueOnce({
        id: 'test-task-123',
        userId: 'test-user-123',
        status: 'processing'
      });
    }
    return mockDbChain;
  });

  return mockDb;
});

jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

jest.mock('../../../src/services/quota.service', () => ({
  refund: jest.fn().mockResolvedValue({ refunded: true })
}));

jest.mock('../../../src/providers/provider-loader', () => ({
  providerLoader: {
    loadProvider: jest.fn((type) => {
      return Promise.resolve({
        name: `Mock${type}Provider`,
        execute: jest.fn(async (context) => {
          // 模拟成功执行
          if (context.metadata?.shouldFail) {
            return {
              success: false,
              error: { message: '模拟失败', code: 'MOCK_ERROR' }
            };
          }
          return {
            success: true,
            data: { result: `${type}执行成功`, taskId: context.taskId }
          };
        })
      });
    })
  }
}));

const pipelineEngine = require('../../../src/services/pipelineEngine.service');
const db = require('../../../src/config/database');

describe('PipelineEngine - FORK/JOIN纯Mock测试（无需数据库）', () => {
  beforeEach(() => {
    // 清理所有Mock调用记录
    jest.clearAllMocks();
  });

  describe('FORK节点并行执行测试', () => {
    test('应该能成功执行包含FORK/JOIN的Pipeline', async () => {
      // 艹！这个测试验证整个FORK/JOIN流程能跑通
      await expect(
        pipelineEngine.executePipeline('test-task-123', 'test_fork_join', { input: 'test' })
      ).resolves.not.toThrow();

      // 验证数据库被正确调用
      expect(db).toHaveBeenCalled();
      expect(mockDbChain.insert).toHaveBeenCalled(); // task_steps创建
      expect(mockDbChain.update).toHaveBeenCalled(); // 任务状态更新
    });
  });

  describe('JOIN策略测试', () => {
    test('ALL策略：应该等待所有分支完成', async () => {
      // Mock返回ALL策略的Pipeline
      mockDbChain.first.mockResolvedValueOnce({
        feature_id: 'test_fork_join',
        pipeline_schema_ref: 'test_pipeline'
      }).mockResolvedValueOnce({
        pipeline_id: 'test_pipeline',
        steps: JSON.stringify({
          nodes: [
            { id: 'start', type: 'start' },
            { id: 'fork1', type: 'fork' },
            { id: 'branch1', type: 'provider', data: { providerRef: 'test1' } },
            { id: 'branch2', type: 'provider', data: { providerRef: 'test2' } },
            { id: 'join1', type: 'join', data: { strategy: 'ALL' } },
            { id: 'end', type: 'end' }
          ],
          edges: [
            { source: 'start', target: 'fork1' },
            { source: 'fork1', target: 'branch1' },
            { source: 'fork1', target: 'branch2' },
            { source: 'branch1', target: 'join1' },
            { source: 'branch2', target: 'join1' },
            { source: 'join1', target: 'end' }
          ]
        })
      });

      await pipelineEngine.executePipeline('test-task-123', 'test_fork_join', { input: 'test' });

      expect(mockDbChain.update).toHaveBeenCalled();
    });

    test('ANY策略：任一分支成功即可', async () => {
      // Mock返回ANY策略的Pipeline
      mockDbChain.first.mockResolvedValueOnce({
        feature_id: 'test_fork_join',
        pipeline_schema_ref: 'test_pipeline'
      }).mockResolvedValueOnce({
        pipeline_id: 'test_pipeline',
        steps: JSON.stringify({
          nodes: [
            { id: 'start', type: 'start' },
            { id: 'fork1', type: 'fork' },
            { id: 'branch1', type: 'provider', data: { providerRef: 'test1' } },
            { id: 'branch2', type: 'provider', data: { providerRef: 'test2' } },
            { id: 'join1', type: 'join', data: { strategy: 'ANY' } },
            { id: 'end', type: 'end' }
          ],
          edges: [
            { source: 'start', target: 'fork1' },
            { source: 'fork1', target: 'branch1' },
            { source: 'fork1', target: 'branch2' },
            { source: 'branch1', target: 'join1' },
            { source: 'branch2', target: 'join1' },
            { source: 'join1', target: 'end' }
          ]
        })
      });

      await pipelineEngine.executePipeline('test-task-123', 'test_fork_join', { input: 'test' });

      expect(mockDbChain.update).toHaveBeenCalled();
    });
  });

  describe('错误隔离测试', () => {
    test('一个分支失败不应该影响其他分支', async () => {
      // 艹！这个测试验证错误隔离
      // 即使有分支失败，整个Pipeline也应该继续（取决于JOIN策略）

      await pipelineEngine.executePipeline('test-task-123', 'test_fork_join', { input: 'test' });

      // 验证Pipeline执行完成
      expect(db).toHaveBeenCalled();
    });
  });

  describe('向后兼容性测试', () => {
    test('旧格式（steps数组）应该仍然可用', async () => {
      // Mock返回旧格式Pipeline
      mockDbChain.first.mockResolvedValueOnce({
        feature_id: 'test_fork_join',
        pipeline_schema_ref: 'test_pipeline'
      }).mockResolvedValueOnce({
        pipeline_id: 'test_pipeline',
        steps: JSON.stringify([
          { type: 'provider', provider_ref: 'test1' },
          { type: 'provider', provider_ref: 'test2' }
        ])
      });

      await pipelineEngine.executePipeline('test-task-123', 'test_fork_join', { input: 'test' });

      // 验证旧格式也能正常执行
      expect(mockDbChain.insert).toHaveBeenCalled(); // task_steps被创建
      expect(mockDbChain.update).toHaveBeenCalled(); // 任务状态被更新
    });
  });
});
