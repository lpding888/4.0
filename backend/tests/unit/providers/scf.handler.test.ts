/**
 * SCF Provider 单元测试
 * 艹，测试覆盖参数校验/同步调用/异步调用/错误处理！
 */

import { ScfProvider } from '../../../src/providers/handlers/scf.handler.js';
import {
  ExecContext,
  RetryPolicy,
  ProviderErrorCode,
  type ExecResult
} from '../../../src/providers/types.js';
import { ILogger } from '../../../src/providers/base/base-provider.js';

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

// Mock腾讯云SCF SDK
let mockScfClient: any;
let mockInvokeResponse: any;
let mockInvokeError: any = null;

jest.mock('tencentcloud-sdk-nodejs', () => {
  return {
    scf: {
      v20180416: {
        Client: jest.fn().mockImplementation(() => {
          mockScfClient = {
            Invoke: jest.fn().mockImplementation(async (params) => {
              if (mockInvokeError) {
                throw mockInvokeError;
              }
              return mockInvokeResponse;
            })
          };
          return mockScfClient;
        })
      }
    }
  };
});

// 🟢 尝试修复：移除skip看实际错误
describe('SCF Provider - 单元测试', () => {
  let provider: ScfProvider;
  let mockLogger: MockLogger;
  type ScfResultPayload = {
    invokeType: string;
    functionName: string;
    requestId: string;
    result: unknown;
    namespace?: string;
    qualifier?: string;
  };

  beforeEach(() => {
    mockLogger = new MockLogger();
    provider = new ScfProvider(undefined, mockLogger);

    // 重置mock状态
    mockInvokeError = null;
    mockInvokeResponse = {
      RequestId: 'test-request-id-123',
      Result: JSON.stringify({ success: true, data: 'test-result' })
    };

    jest.clearAllMocks();
  });

  afterEach(() => {
    mockLogger.clear();
  });

  const executeProvider = (context: ExecContext) =>
    provider.execute(context) as Promise<ExecResult<ScfResultPayload>>;

  const expectSuccess = (result: ExecResult<ScfResultPayload>): ScfResultPayload => {
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    return result.data as ScfResultPayload;
  };

  describe('参数校验', () => {
    test('应该拒绝空输入', () => {
      expect(provider.validate(null)).toContain('输入参数必须是对象');
      expect(provider.validate(undefined)).toContain('输入参数必须是对象');
      expect(provider.validate('string')).toContain('输入参数必须是对象');
    });

    test('应该拒绝缺少auth', () => {
      const input = { params: {} };
      expect(provider.validate(input)).toContain('缺少必填字段: auth');
    });

    test('应该拒绝缺少auth.secretId', () => {
      const input = {
        auth: { secretKey: 'key', region: 'ap-guangzhou' },
        params: { functionName: 'test', invokeType: 'sync', payload: {} }
      };
      expect(provider.validate(input)).toContain('缺少或无效的auth.secretId');
    });

    test('应该拒绝缺少auth.secretKey', () => {
      const input = {
        auth: { secretId: 'id', region: 'ap-guangzhou' },
        params: { functionName: 'test', invokeType: 'sync', payload: {} }
      };
      expect(provider.validate(input)).toContain('缺少或无效的auth.secretKey');
    });

    test('应该拒绝缺少auth.region', () => {
      const input = {
        auth: { secretId: 'id', secretKey: 'key' },
        params: { functionName: 'test', invokeType: 'sync', payload: {} }
      };
      expect(provider.validate(input)).toContain('缺少或无效的auth.region');
    });

    test('应该拒绝无效的region格式', () => {
      const input = {
        auth: { secretId: 'id', secretKey: 'key', region: 'invalid' },
        params: { functionName: 'test', invokeType: 'sync', payload: {} }
      };
      expect(provider.validate(input)).toContain('region格式无效');
    });

    test('应该拒绝缺少params', () => {
      const input = {
        auth: { secretId: 'id', secretKey: 'key', region: 'ap-guangzhou' }
      };
      expect(provider.validate(input)).toContain('缺少必填字段: params');
    });

    test('应该拒绝缺少params.functionName', () => {
      const input = {
        auth: { secretId: 'id', secretKey: 'key', region: 'ap-guangzhou' },
        params: { invokeType: 'sync', payload: {} }
      };
      expect(provider.validate(input)).toContain('缺少或无效的params.functionName');
    });

    test('应该拒绝缺少params.invokeType', () => {
      const input = {
        auth: { secretId: 'id', secretKey: 'key', region: 'ap-guangzhou' },
        params: { functionName: 'test', payload: {} }
      };
      expect(provider.validate(input)).toContain('缺少必填字段: params.invokeType');
    });

    test('应该拒绝无效的invokeType', () => {
      const input = {
        auth: { secretId: 'id', secretKey: 'key', region: 'ap-guangzhou' },
        params: { functionName: 'test', invokeType: 'invalid', payload: {} }
      };
      expect(provider.validate(input)).toContain('invokeType无效');
    });

    test('应该拒绝缺少params.payload', () => {
      const input = {
        auth: { secretId: 'id', secretKey: 'key', region: 'ap-guangzhou' },
        params: { functionName: 'test', invokeType: 'sync' }
      };
      expect(provider.validate(input)).toContain('缺少必填字段: params.payload');
    });

    test('应该拒绝无效的logType', () => {
      const input = {
        auth: { secretId: 'id', secretKey: 'key', region: 'ap-guangzhou' },
        params: {
          functionName: 'test',
          invokeType: 'sync',
          payload: {},
          logType: 'invalid'
        }
      };
      expect(provider.validate(input)).toContain('logType无效');
    });

    test('应该接受有效输入（同步调用）', () => {
      const input = {
        auth: { secretId: 'id', secretKey: 'key', region: 'ap-guangzhou' },
        params: {
          functionName: 'test-function',
          invokeType: 'sync',
          payload: { key: 'value' }
        }
      };
      expect(provider.validate(input)).toBeNull();
    });

    test('应该接受有效输入（异步调用）', () => {
      const input = {
        auth: { secretId: 'id', secretKey: 'key', region: 'ap-shanghai' },
        params: {
          functionName: 'test-function',
          invokeType: 'async',
          payload: { key: 'value' },
          namespace: 'default',
          qualifier: '$LATEST',
          logType: 'Tail'
        }
      };
      expect(provider.validate(input)).toBeNull();
    });
  });

  describe('同步调用执行', () => {
    test('应该成功执行同步调用', async () => {
      const input = {
        auth: { secretId: 'test-id', secretKey: 'test-key', region: 'ap-guangzhou' },
        params: {
          functionName: 'test-function',
          invokeType: 'sync' as const,
          payload: { input: 'test-data' }
        }
      };

      const context: ExecContext = {
        taskId: 'task-123',
        input
      };

      const result = await executeProvider(context);

      // 验证结果
      const data = expectSuccess(result);
      expect(data.invokeType).toBe('sync');
      expect(data.functionName).toBe('test-function');
      expect(data.requestId).toBe('test-request-id-123');
      expect(data.result).toEqual({ success: true, data: 'test-result' });

      // 验证SCF客户端被正确调用
      expect(mockScfClient.Invoke).toHaveBeenCalledWith(
        expect.objectContaining({
          FunctionName: 'test-function',
          Namespace: 'default',
          Qualifier: '$LATEST',
          InvocationType: 'RequestResponse',
          LogType: 'None'
        })
      );
    });

    test('应该正确处理payload对象', async () => {
      const payload = { foo: 'bar', num: 123 };
      const input = {
        auth: { secretId: 'test-id', secretKey: 'test-key', region: 'ap-guangzhou' },
        params: {
          functionName: 'test-function',
          invokeType: 'sync' as const,
          payload
        }
      };

      const context: ExecContext = {
        taskId: 'task-123',
        input
      };

      await executeProvider(context);

      // 验证payload被转成JSON字符串
      expect(mockScfClient.Invoke).toHaveBeenCalledWith(
        expect.objectContaining({
          ClientContext: JSON.stringify(payload)
        })
      );
    });

    test('应该支持自定义namespace和qualifier', async () => {
      const input = {
        auth: { secretId: 'test-id', secretKey: 'test-key', region: 'ap-guangzhou' },
        params: {
          functionName: 'test-function',
          namespace: 'custom-ns',
          qualifier: 'v1.0.0',
          invokeType: 'sync' as const,
          payload: {}
        }
      };

      const context: ExecContext = {
        taskId: 'task-123',
        input
      };

      const result = await executeProvider(context);
      const data = expectSuccess(result);
      expect(data.namespace).toBe('custom-ns');
      expect(data.qualifier).toBe('v1.0.0');

      expect(mockScfClient.Invoke).toHaveBeenCalledWith(
        expect.objectContaining({
          Namespace: 'custom-ns',
          Qualifier: 'v1.0.0'
        })
      );
    });
  });

  describe('异步调用执行', () => {
    test('应该成功执行异步调用', async () => {
      mockInvokeResponse = {
        RequestId: 'async-request-123'
      };

      const input = {
        auth: { secretId: 'test-id', secretKey: 'test-key', region: 'ap-guangzhou' },
        params: {
          functionName: 'test-function',
          invokeType: 'async' as const,
          payload: { input: 'test-data' }
        }
      };

      const context: ExecContext = {
        taskId: 'task-456',
        input
      };

      const result = await executeProvider(context);

      // 验证结果
      const data = expectSuccess(result);
      expect(data.invokeType).toBe('async');
      expect((data.result as { message: string }).message).toContain('异步调用已提交');

      // 验证SCF客户端调用类型
      expect(mockScfClient.Invoke).toHaveBeenCalledWith(
        expect.objectContaining({
          InvocationType: 'Event'
        })
      );
    });
  });

  describe('错误处理', () => {
    test('应该处理认证失败错误', async () => {
      // 艹，禁用重试避免测试超时！
      const noRetryPolicy = { maxRetries: 0, initialDelay: 0, maxDelay: 0, backoffMultiplier: 1 };
      const testProvider = new ScfProvider(noRetryPolicy, mockLogger);

      mockInvokeError = {
        code: 'AuthFailure.SignatureFailure',
        message: '签名错误'
      };

      const input = {
        auth: { secretId: 'wrong-id', secretKey: 'wrong-key', region: 'ap-guangzhou' },
        params: {
          functionName: 'test-function',
          invokeType: 'sync' as const,
          payload: {}
        }
      };

      const context: ExecContext = {
        taskId: 'task-error-1',
        input
      };

      const result = await testProvider.execute(context);

      // 验证错误结果
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.message).toContain('认证失败');
      const details = result.error?.details as { category?: string } | undefined;
      expect(details?.category).toBe('auth');
    });

    test('应该处理权限不足错误', async () => {
      // 艹，禁用重试避免测试超时！
      const noRetryPolicy = { maxRetries: 0, initialDelay: 0, maxDelay: 0, backoffMultiplier: 1 };
      const testProvider = new ScfProvider(noRetryPolicy, mockLogger);

      mockInvokeError = {
        code: 'UnauthorizedOperation',
        message: '无权限调用该函数'
      };

      const input = {
        auth: { secretId: 'test-id', secretKey: 'test-key', region: 'ap-guangzhou' },
        params: {
          functionName: 'protected-function',
          invokeType: 'sync' as const,
          payload: {}
        }
      };

      const context: ExecContext = {
        taskId: 'task-error-2',
        input
      };

      const result = await testProvider.execute(context);

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('权限不足');
      const permDetails = result.error?.details as { category?: string } | undefined;
      expect(permDetails?.category).toBe('permission');
    });

    test('应该处理参数错误', async () => {
      mockInvokeError = {
        code: 'InvalidParameterValue',
        message: '参数值无效'
      };

      const input = {
        auth: { secretId: 'test-id', secretKey: 'test-key', region: 'ap-guangzhou' },
        params: {
          functionName: 'test-function',
          invokeType: 'sync' as const,
          payload: {}
        }
      };

      const context: ExecContext = {
        taskId: 'task-error-3',
        input
      };

      const result = await executeProvider(context);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe(ProviderErrorCode.ERR_PROVIDER_VALIDATION_FAILED);
      const paramDetails = result.error?.details as { category?: string } | undefined;
      expect(paramDetails?.category).toBe('parameter');
    });

    test('应该处理资源不存在错误', async () => {
      // 艹，禁用重试避免测试超时！
      const noRetryPolicy = { maxRetries: 0, initialDelay: 0, maxDelay: 0, backoffMultiplier: 1 };
      const testProvider = new ScfProvider(noRetryPolicy, mockLogger);

      mockInvokeError = {
        code: 'ResourceNotFound.Function',
        message: '函数不存在'
      };

      const input = {
        auth: { secretId: 'test-id', secretKey: 'test-key', region: 'ap-guangzhou' },
        params: {
          functionName: 'nonexistent-function',
          invokeType: 'sync' as const,
          payload: {}
        }
      };

      const context: ExecContext = {
        taskId: 'task-error-4',
        input
      };

      const result = await testProvider.execute(context);

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('资源不存在');
      const notFoundDetails = result.error?.details as { category?: string } | undefined;
      expect(notFoundDetails?.category).toBe('not_found');
    });

    test('应该处理内部错误（可重试）', async () => {
      // 艹，禁用重试避免测试超时！
      const noRetryPolicy = { maxRetries: 0, initialDelay: 0, maxDelay: 0, backoffMultiplier: 1 };
      const testProvider = new ScfProvider(noRetryPolicy, mockLogger);

      mockInvokeError = {
        code: 'InternalError.System',
        message: '系统内部错误'
      };

      const input = {
        auth: { secretId: 'test-id', secretKey: 'test-key', region: 'ap-guangzhou' },
        params: {
          functionName: 'test-function',
          invokeType: 'sync' as const,
          payload: {}
        }
      };

      const context: ExecContext = {
        taskId: 'task-error-5',
        input
      };

      const result = await testProvider.execute(context);

      expect(result.success).toBe(false);
      expect(result.error!.message).toContain('内部错误');
      const internalDetails = result.error?.details as { category?: string; retryable?: boolean } | undefined;
      expect(internalDetails?.category).toBe('internal');
      expect(internalDetails?.retryable).toBe(true);
    });
  });

  describe('健康检查', () => {
    test('应该返回健康状态', async () => {
      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });
});
