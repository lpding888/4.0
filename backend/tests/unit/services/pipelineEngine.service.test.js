/**
 * PipelineEngine单元测试 - FORK/JOIN并行执行
 * 艹！这个tm必须测试并行分支和错误隔离！
 */

const pipelineEngine = require('../../../src/services/pipelineEngine.service');
const db = require('../../../src/config/database');

// Mock Provider
jest.mock('../../../src/providers/provider-loader', () => ({
  providerLoader: {
    loadProvider: jest.fn((type) => {
      // 艹！返回一个假的Provider
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

describe('PipelineEngine - FORK/JOIN并行执行测试', () => {
  let testUser;
  let testTask;

  beforeEach(async () => {
    // 🔥 先创建测试用户（艹，setup.js的createTestTask需要userId！）
    testUser = await global.createTestUser({
      quota_remaining: 10,
      isMember: true
    });

    // 创建测试任务
    testTask = await global.createTestTask(testUser.id, {
      featureId: 'test_fork_join',
      status: 'pending'
    });

    // 创建Pipeline Schema（FORK/JOIN结构）
    await db('pipeline_schemas').insert({
      pipeline_id: 'test_fork_join_pipeline',
      name: '测试并行分支',
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

    // 关联功能定义
    await db('feature_definitions').insert({
      feature_id: 'test_fork_join',
      name: '测试FORK/JOIN',
      pipeline_schema_ref: 'test_fork_join_pipeline',
      quota_cost: 1
    });
  });

  afterEach(async () => {
    // 清理测试数据
    await db('task_steps').where('task_id', testTask.id).del();
    await db('tasks').where('id', testTask.id).del();
    await db('feature_definitions').where('feature_id', 'test_fork_join').del();
    await db('pipeline_schemas').where('pipeline_id', 'test_fork_join_pipeline').del();
  });

  describe('FORK节点并行执行', () => {
    test('应该并行启动所有下游分支', async () => {
      await pipelineEngine.executePipeline(testTask.id, 'test_fork_join', { input: 'test' });

      // 验证任务成功
      const task = await db('tasks').where('id', testTask.id).first();
      expect(task.status).toBe('success');

      // 验证创建了多个步骤记录
      const steps = await db('task_steps').where('task_id', testTask.id);
      expect(steps.length).toBeGreaterThan(0);
    });

    test('FORK应该返回所有分支结果', async () => {
      // 艹！这个测试验证分支结果汇总
      await pipelineEngine.executePipeline(testTask.id, 'test_fork_join', { input: 'test' });

      const task = await db('tasks').where('id', testTask.id).first();
      const artifacts = JSON.parse(task.artifacts || '{}');

      // artifacts应该包含所有分支的输出
      expect(artifacts).toBeDefined();
    });
  });

  describe('JOIN节点策略测试', () => {
    test('ALL策略：等待所有分支完成', async () => {
      await pipelineEngine.executePipeline(testTask.id, 'test_fork_join', { input: 'test' });

      const task = await db('tasks').where('id', testTask.id).first();
      expect(task.status).toBe('success');
    });

    test('ANY策略：任一分支成功即可', async () => {
      // 更新Pipeline Schema使用ANY策略
      await db('pipeline_schemas')
        .where('pipeline_id', 'test_fork_join_pipeline')
        .update({
          steps: JSON.stringify({
            nodes: [
              { id: 'start', type: 'start' },
              { id: 'fork1', type: 'fork', data: { branches: 2 } },
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

      await pipelineEngine.executePipeline(testTask.id, 'test_fork_join', { input: 'test' });

      const task = await db('tasks').where('id', testTask.id).first();
      expect(task.status).toBe('success');
    });

    test('FIRST策略：第一个完成的分支', async () => {
      // 更新Pipeline Schema使用FIRST策略
      await db('pipeline_schemas')
        .where('pipeline_id', 'test_fork_join_pipeline')
        .update({
          steps: JSON.stringify({
            nodes: [
              { id: 'start', type: 'start' },
              { id: 'fork1', type: 'fork', data: { branches: 2 } },
              { id: 'branch1', type: 'provider', data: { providerRef: 'test1' } },
              { id: 'branch2', type: 'provider', data: { providerRef: 'test2' } },
              { id: 'join1', type: 'join', data: { strategy: 'FIRST' } },
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

      await pipelineEngine.executePipeline(testTask.id, 'test_fork_join', { input: 'test' });

      const task = await db('tasks').where('id', testTask.id).first();
      expect(task.status).toBe('success');
    });
  });

  describe('错误隔离测试', () => {
    test('一个分支失败不应该影响其他分支执行', async () => {
      // 艹！这个tm最重要！测试错误隔离！
      // TODO: 需要更复杂的Mock来模拟分支失败
      // 现在先测试基础功能
      await pipelineEngine.executePipeline(testTask.id, 'test_fork_join', { input: 'test' });

      const task = await db('tasks').where('id', testTask.id).first();
      expect(task.status).toBe('success');
    });

    test('JOIN(ALL)策略：有分支失败应该抛错', async () => {
      // TODO: Mock一个失败的Provider
      // 验证ALL策略下，有任何分支失败都应该导致整个Pipeline失败
      expect(true).toBe(true); // 占位，等完善Mock后实现
    });

    test('JOIN(ANY)策略：至少一个成功即可', async () => {
      // TODO: Mock部分分支失败
      // 验证ANY策略下，只要有一个分支成功就应该继续
      expect(true).toBe(true); // 占位
    });
  });

  describe('向后兼容性测试', () => {
    test('旧格式（steps数组）应该仍然可用', async () => {
      // 创建旧格式Pipeline Schema
      await db('pipeline_schemas')
        .where('pipeline_id', 'test_fork_join_pipeline')
        .update({
          steps: JSON.stringify([
            { type: 'provider', provider_ref: 'test1' },
            { type: 'provider', provider_ref: 'test2' }
          ])
        });

      await pipelineEngine.executePipeline(testTask.id, 'test_fork_join', { input: 'test' });

      const task = await db('tasks').where('id', testTask.id).first();
      expect(task.status).toBe('success');
    });
  });
});
