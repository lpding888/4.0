/**
 * RunningHub Provider 单元测试
 * 艹，测试覆盖参数校验/占位实现/错误处理！
 */

import { RunningHubProvider } from '../../../src/providers/handlers/runninghub.handler';
import {
  ExecContext,
  ProviderErrorCode,
} from '../../../src/providers/types';
import { ILogger } from '../../../src/providers/base/base-provider';

// Mock Logger
class MockLogger implements ILogger {
  public logs: any[] = [];

  info(message: string, meta?: any): void {
    this.logs.push({ level: 'info', message, meta });
  }

  warn(message: string, meta?: any): void {
    this.logs.push({ level: 'warn', message, meta });
  }

  error(message: string, meta?: any): void {
    this.logs.push({ level: 'error', message, meta });
  }

  debug(message: string, meta?: any): void {
    this.logs.push({ level: 'debug', message, meta });
  }

  clear(): void {
    this.logs = [];
  }
}

describe('RunningHub Provider - 单元测试', () => {
  let provider: RunningHubProvider;
  let mockLogger: MockLogger;

  beforeEach(() => {
    mockLogger = new MockLogger();
    provider = new RunningHubProvider(undefined, mockLogger);
  });

  afterEach(() => {
    mockLogger.clear();
  });

  describe('参数校验', () => {
    test('应该拒绝空输入', () => {
      expect(provider.validate(null)).toContain('输入参数必须是对象');
      expect(provider.validate(undefined)).toContain('输入参数必须是对象');
      expect(provider.validate('string')).toContain('输入参数必须是对象');
    });

    test('应该拒绝缺少workflowId', () => {
      const input = {
        apiKey: 'test-key',
        params: {},
      };
      expect(provider.validate(input)).toContain('缺少或无效的workflowId字段');
    });

    test('应该拒绝无效的workflowId类型', () => {
      const input = {
        workflowId: 123, // 应该是string
        apiKey: 'test-key',
        params: {},
      };
      expect(provider.validate(input)).toContain('缺少或无效的workflowId字段');
    });

    test('应该拒绝缺少apiKey', () => {
      const input = {
        workflowId: 'workflow-123',
        params: {},
      };
      expect(provider.validate(input)).toContain('缺少或无效的apiKey字段');
    });

    test('应该拒绝无效的apiKey类型', () => {
      const input = {
        workflowId: 'workflow-123',
        apiKey: 123, // 应该是string
        params: {},
      };
      expect(provider.validate(input)).toContain('缺少或无效的apiKey字段');
    });

    test('应该拒绝缺少params', () => {
      const input = {
        workflowId: 'workflow-123',
        apiKey: 'test-key',
      };
      expect(provider.validate(input)).toContain('缺少或无效的params字段');
    });

    test('应该拒绝无效的params类型', () => {
      const input = {
        workflowId: 'workflow-123',
        apiKey: 'test-key',
        params: 'invalid', // 应该是object
      };
      expect(provider.validate(input)).toContain('缺少或无效的params字段');
    });

    test('应该拒绝pollInterval小于1000ms', () => {
      const input = {
        workflowId: 'workflow-123',
        apiKey: 'test-key',
        params: {},
        pollInterval: 500, // 小于1000ms
      };
      expect(provider.validate(input)).toContain('pollInterval必须是数字且不小于1000ms');
    });

    test('应该拒绝无效的pollInterval类型', () => {
      const input = {
        workflowId: 'workflow-123',
        apiKey: 'test-key',
        params: {},
        pollInterval: 'invalid', // 应该是number
      };
      expect(provider.validate(input)).toContain('pollInterval必须是数字且不小于1000ms');
    });

    test('应该拒绝maxPollTime小于10000ms', () => {
      const input = {
        workflowId: 'workflow-123',
        apiKey: 'test-key',
        params: {},
        maxPollTime: 5000, // 小于10000ms
      };
      expect(provider.validate(input)).toContain('maxPollTime必须是数字且不小于10000ms');
    });

    test('应该拒绝无效的maxPollTime类型', () => {
      const input = {
        workflowId: 'workflow-123',
        apiKey: 'test-key',
        params: {},
        maxPollTime: 'invalid', // 应该是number
      };
      expect(provider.validate(input)).toContain('maxPollTime必须是数字且不小于10000ms');
    });

    test('应该接受有效输入（最小配置）', () => {
      const input = {
        workflowId: 'workflow-123',
        apiKey: 'test-api-key',
        params: {
          input1: 'value1',
        },
      };
      expect(provider.validate(input)).toBeNull();
    });

    test('应该接受有效输入（完整配置）', () => {
      const input = {
        workflowId: 'workflow-456',
        apiKey: 'test-api-key',
        params: {
          input1: 'value1',
          input2: 'value2',
        },
        pollInterval: 3000,
        maxPollTime: 60000,
        baseUrl: 'https://api.runninghub.com',
      };
      expect(provider.validate(input)).toBeNull();
    });

    test('应该接受边界值的pollInterval（1000ms）', () => {
      const input = {
        workflowId: 'workflow-123',
        apiKey: 'test-key',
        params: {},
        pollInterval: 1000,
      };
      expect(provider.validate(input)).toBeNull();
    });

    test('应该接受边界值的maxPollTime（10000ms）', () => {
      const input = {
        workflowId: 'workflow-123',
        apiKey: 'test-key',
        params: {},
        maxPollTime: 10000,
      };
      expect(provider.validate(input)).toBeNull();
    });
  });

  describe('占位实现执行', () => {
    test('应该成功执行工作流（占位）', async () => {
      const input = {
        workflowId: 'workflow-123',
        apiKey: 'test-api-key',
        params: {
          imageUrl: 'https://example.com/image.jpg',
          operation: 'resize',
        },
      };

      const context: ExecContext = {
        taskId: 'task-rh-001',
        input,
      };

      const result = await provider.execute(context);

      // 验证结果
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.message).toContain('RunningHubProvider尚未实现');
      expect(result.data.workflowId).toBe('workflow-123');
      expect(result.data.params).toEqual(input.params);
      expect(result.data.pollInterval).toBe(5000); // 默认值
      expect(result.data.maxPollTime).toBe(300000); // 默认值
    });

    test('应该使用自定义的pollInterval和maxPollTime', async () => {
      const input = {
        workflowId: 'workflow-456',
        apiKey: 'test-api-key',
        params: {
          data: 'test',
        },
        pollInterval: 2000,
        maxPollTime: 60000,
      };

      const context: ExecContext = {
        taskId: 'task-rh-002',
        input,
      };

      const result = await provider.execute(context);

      expect(result.success).toBe(true);
      expect(result.data.pollInterval).toBe(2000);
      expect(result.data.maxPollTime).toBe(60000);
    });

    test('应该支持自定义baseUrl', async () => {
      const input = {
        workflowId: 'workflow-789',
        apiKey: 'test-api-key',
        params: {},
        baseUrl: 'https://custom.runninghub.com',
      };

      const context: ExecContext = {
        taskId: 'task-rh-003',
        input,
      };

      const result = await provider.execute(context);

      expect(result.success).toBe(true);
      expect(result.data.workflowId).toBe('workflow-789');
    });

    test('应该记录warning日志提示未实现', async () => {
      const input = {
        workflowId: 'workflow-test',
        apiKey: 'test-key',
        params: {},
      };

      const context: ExecContext = {
        taskId: 'task-rh-004',
        input,
      };

      await provider.execute(context);

      // 验证日志
      const warnLogs = mockLogger.logs.filter((log) => log.level === 'warn');
      expect(warnLogs.length).toBeGreaterThan(0);
      expect(warnLogs[0].message).toContain('RunningHubProvider尚未实现');
    });

    test('应该记录info日志包含taskId和workflowId', async () => {
      const input = {
        workflowId: 'workflow-log-test',
        apiKey: 'test-key',
        params: {},
      };

      const context: ExecContext = {
        taskId: 'task-rh-005',
        input,
      };

      await provider.execute(context);

      // 验证日志
      const infoLogs = mockLogger.logs.filter((log) => log.level === 'info');
      expect(infoLogs.length).toBeGreaterThan(0);
      expect(infoLogs[0].message).toContain('RunningHub工作流');
      expect(infoLogs[0].meta.taskId).toBe('task-rh-005');
      expect(infoLogs[0].meta.workflowId).toBe('workflow-log-test');
    });
  });

  describe('健康检查', () => {
    test('应该返回健康状态', async () => {
      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });

  describe('错误处理', () => {
    test('应该处理参数校验失败', async () => {
      const input = {
        // 缺少必填字段
        workflowId: 'workflow-123',
      };

      const context: ExecContext = {
        taskId: 'task-rh-error-001',
        input,
      };

      const result = await provider.execute(context);

      // 参数校验失败应该返回错误
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe(ProviderErrorCode.ERR_PROVIDER_VALIDATION_FAILED);
    });
  });

  describe('边界条件测试', () => {
    test('应该处理空的params对象', async () => {
      const input = {
        workflowId: 'workflow-empty-params',
        apiKey: 'test-key',
        params: {},
      };

      const context: ExecContext = {
        taskId: 'task-rh-006',
        input,
      };

      const result = await provider.execute(context);

      expect(result.success).toBe(true);
      expect(result.data.params).toEqual({});
    });

    test('应该处理复杂的params对象', async () => {
      const input = {
        workflowId: 'workflow-complex-params',
        apiKey: 'test-key',
        params: {
          nested: {
            level1: {
              level2: 'value',
            },
          },
          array: [1, 2, 3],
          boolean: true,
          number: 123,
          null: null,
        },
      };

      const context: ExecContext = {
        taskId: 'task-rh-007',
        input,
      };

      const result = await provider.execute(context);

      expect(result.success).toBe(true);
      expect(result.data.params).toEqual(input.params);
    });

    test('应该处理很长的workflowId', async () => {
      const longWorkflowId = 'a'.repeat(1000);
      const input = {
        workflowId: longWorkflowId,
        apiKey: 'test-key',
        params: {},
      };

      const context: ExecContext = {
        taskId: 'task-rh-008',
        input,
      };

      const result = await provider.execute(context);

      expect(result.success).toBe(true);
      expect(result.data.workflowId).toBe(longWorkflowId);
    });
  });
});
