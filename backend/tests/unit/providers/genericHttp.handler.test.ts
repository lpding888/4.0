/**
 * GenericHTTP Provider 单元测试
 * 艹，测试覆盖模板替换/超时/重试/extractPath！
 */

import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { GenericHttpProvider } from '../../../src/providers/handlers/genericHttp.handler';
import {
  ExecContext,
  RetryPolicy,
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

describe('GenericHTTP Provider - 单元测试', () => {
  let provider: GenericHttpProvider;
  let mockLogger: MockLogger;
  let mockAxios: MockAdapter;

  beforeEach(() => {
    mockLogger = new MockLogger();
    provider = new GenericHttpProvider(undefined, mockLogger);

    // 创建axios mock
    mockAxios = new MockAdapter(axios);
  });

  afterEach(() => {
    mockAxios.restore();
    mockLogger.clear();
  });

  describe('参数校验', () => {
    test('应该拒绝空输入', () => {
      expect(provider.validate(null)).toContain('输入参数必须是对象');
      expect(provider.validate(undefined)).toContain('输入参数必须是对象');
      expect(provider.validate('string')).toContain('输入参数必须是对象');
    });

    test('应该拒绝缺少req_template', () => {
      const input = { variables: {} };
      expect(provider.validate(input)).toContain('缺少必填字段: req_template');
    });

    test('应该拒绝缺少method', () => {
      const input = { req_template: { url: 'http://example.com' } };
      expect(provider.validate(input)).toContain('缺少必填字段: req_template.method');
    });

    test('应该拒绝缺少url', () => {
      const input = { req_template: { method: 'GET' } };
      expect(provider.validate(input)).toContain('缺少必填字段: req_template.url');
    });

    test('应该拒绝不支持的HTTP方法', () => {
      const input = {
        req_template: {
          method: 'INVALID',
          url: 'http://example.com',
        },
      };
      expect(provider.validate(input)).toContain('不支持的HTTP方法');
    });

    test('应该接受有效输入', () => {
      const input = {
        req_template: {
          method: 'GET',
          url: 'http://example.com',
        },
      };
      expect(provider.validate(input)).toBeNull();
    });
  });

  describe('GET请求', () => {
    test('应该发送简单的GET请求', async () => {
      mockAxios.onGet('http://example.com/api').reply(200, {
        success: true,
        data: 'test-data',
      });

      const context: ExecContext = {
        taskId: 'test-001',
        input: {
          req_template: {
            method: 'GET',
            url: 'http://example.com/api',
          },
        },
      };

      const result = await provider.execute(context);

      expect(result.success).toBe(true);
      expect(result.data?.statusCode).toBe(200);
      expect(result.data?.body).toEqual({ success: true, data: 'test-data' });
    });

    test('应该替换URL中的变量', async () => {
      mockAxios.onGet('http://example.com/users/123').reply(200, {
        id: 123,
        name: '老王',
      });

      const context: ExecContext = {
        taskId: 'test-002',
        input: {
          req_template: {
            method: 'GET',
            url: 'http://example.com/users/{{userId}}',
          },
          variables: {
            userId: '123',
          },
        },
      };

      const result = await provider.execute(context);

      expect(result.success).toBe(true);
      expect(result.data?.body.id).toBe(123);
    });

    test('应该替换headers中的变量', async () => {
      let capturedHeaders: any;

      mockAxios.onGet('http://example.com/api').reply((config) => {
        capturedHeaders = config.headers;
        return [200, { success: true }];
      });

      const context: ExecContext = {
        taskId: 'test-003',
        input: {
          req_template: {
            method: 'GET',
            url: 'http://example.com/api',
            headers: {
              Authorization: 'Bearer {{token}}',
              'X-User-Id': '{{userId}}',
            },
          },
          variables: {
            token: 'secret-token-123',
            userId: 'user-456',
          },
        },
      };

      const result = await provider.execute(context);

      expect(result.success).toBe(true);
      expect(capturedHeaders?.['Authorization']).toBe('Bearer secret-token-123');
      expect(capturedHeaders?.['X-User-Id']).toBe('user-456');
    });

    test('应该替换params中的变量', async () => {
      mockAxios.onGet('http://example.com/api').reply((config) => {
        expect(config.params).toEqual({ page: '1', limit: '20' });
        return [200, { items: [] }];
      });

      const context: ExecContext = {
        taskId: 'test-004',
        input: {
          req_template: {
            method: 'GET',
            url: 'http://example.com/api',
            params: {
              page: '{{page}}',
              limit: '{{limit}}',
            },
          },
          variables: {
            page: '1',
            limit: '20',
          },
        },
      };

      const result = await provider.execute(context);
      expect(result.success).toBe(true);
    });
  });

  describe('POST请求', () => {
    test('应该发送POST请求with body', async () => {
      let capturedBody: any;

      mockAxios.onPost('http://example.com/api').reply((config) => {
        capturedBody = JSON.parse(config.data);
        return [201, { id: 1, ...capturedBody }];
      });

      const context: ExecContext = {
        taskId: 'test-005',
        input: {
          req_template: {
            method: 'POST',
            url: 'http://example.com/api',
            body: {
              name: '老王',
              age: 35,
            },
          },
        },
      };

      const result = await provider.execute(context);

      expect(result.success).toBe(true);
      expect(capturedBody.name).toBe('老王');
      expect(capturedBody.age).toBe(35);
    });

    test('应该替换body中的变量', async () => {
      let capturedBody: any;

      mockAxios.onPost('http://example.com/users').reply((config) => {
        capturedBody = JSON.parse(config.data);
        return [201, { id: 1, ...capturedBody }];
      });

      const context: ExecContext = {
        taskId: 'test-006',
        input: {
          req_template: {
            method: 'POST',
            url: 'http://example.com/users',
            body: {
              name: '{{user.name}}',
              age: '{{user.age}}',
            },
          },
          variables: {
            user: {
              name: '老王',
              age: '35',
            },
          },
        },
      };

      const result = await provider.execute(context);

      expect(result.success).toBe(true);
      expect(capturedBody.name).toBe('老王');
      expect(capturedBody.age).toBe('35');
    });
  });

  describe('extractPath功能', () => {
    test('应该从响应中提取指定路径的数据', async () => {
      mockAxios.onGet('http://example.com/api').reply(200, {
        success: true,
        result: {
          user: {
            id: 123,
            name: '老王',
          },
        },
      });

      const context: ExecContext = {
        taskId: 'test-007',
        input: {
          req_template: {
            method: 'GET',
            url: 'http://example.com/api',
            extractPath: 'result.user',
          },
        },
      };

      const result = await provider.execute(context);

      expect(result.success).toBe(true);
      expect(result.data?.body).toEqual({ id: 123, name: '老王' });
      // fullResponse应该保留完整响应
      expect(result.data?.fullResponse.success).toBe(true);
    });

    test('extractPath不存在时应该返回undefined', async () => {
      mockAxios.onGet('http://example.com/api').reply(200, {
        success: true,
      });

      const context: ExecContext = {
        taskId: 'test-008',
        input: {
          req_template: {
            method: 'GET',
            url: 'http://example.com/api',
            extractPath: 'notexist.path',
          },
        },
      };

      const result = await provider.execute(context);

      expect(result.success).toBe(true);
      expect(result.data?.body).toBeUndefined();
    });
  });

  describe('HTTP错误处理', () => {
    test('应该处理4xx客户端错误', async () => {
      mockAxios.onGet('http://example.com/api').reply(404, {
        error: 'Not Found',
      });

      const context: ExecContext = {
        taskId: 'test-009',
        input: {
          req_template: {
            method: 'GET',
            url: 'http://example.com/api',
          },
        },
      };

      const result = await provider.execute(context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(
        ProviderErrorCode.ERR_PROVIDER_EXECUTION_FAILED
      );
      expect(result.error?.message).toContain('404');
      expect(result.error?.details?.statusCode).toBe(404);
    });

    test('应该处理5xx服务器错误', async () => {
      mockAxios.onGet('http://example.com/api').reply(500, {
        error: 'Internal Server Error',
      });

      const context: ExecContext = {
        taskId: 'test-010',
        input: {
          req_template: {
            method: 'GET',
            url: 'http://example.com/api',
          },
        },
      };

      const result = await provider.execute(context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(
        ProviderErrorCode.ERR_PROVIDER_EXECUTION_FAILED
      );
      expect(result.error?.message).toContain('500');
    });

    test('应该处理网络错误', async () => {
      mockAxios.onGet('http://example.com/api').networkError();

      const context: ExecContext = {
        taskId: 'test-011',
        input: {
          req_template: {
            method: 'GET',
            url: 'http://example.com/api',
          },
        },
      };

      const result = await provider.execute(context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(
        ProviderErrorCode.ERR_PROVIDER_EXECUTION_FAILED
      );
      expect(result.error?.message).toContain('网络错误');
    });
  });

  describe('超时控制', () => {
    test('应该在超时时中止请求', async () => {
      // 艹，axios-mock-adapter的超时模拟不够真实
      // 这里使用超时错误来模拟
      mockAxios.onGet('http://example.com/api').timeout();

      const context: ExecContext = {
        taskId: 'test-012',
        input: {
          req_template: {
            method: 'GET',
            url: 'http://example.com/api',
            timeout: 50, // 50ms超时
          },
        },
      };

      const result = await provider.execute(context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ProviderErrorCode.ERR_PROVIDER_TIMEOUT);
      expect(result.error?.message).toContain('超时');
    });
  });

  describe('重试逻辑', () => {
    test('请求失败时应该按照重试策略重试', async () => {
      let attemptCount = 0;

      mockAxios.onGet('http://example.com/api').reply(() => {
        attemptCount++;
        return [500, { error: 'Server Error' }];
      });

      const retryPolicy: RetryPolicy = {
        maxRetries: 3,
        initialDelay: 10,
        maxDelay: 100,
        backoffMultiplier: 2,
      };

      provider = new GenericHttpProvider(retryPolicy, mockLogger);

      const context: ExecContext = {
        taskId: 'test-013',
        input: {
          req_template: {
            method: 'GET',
            url: 'http://example.com/api',
          },
        },
      };

      const result = await provider.execute(context);

      expect(result.success).toBe(false);
      expect(attemptCount).toBeGreaterThan(1); // 应该有重试
    });
  });

  describe('healthCheck', () => {
    test('默认健康检查应该返回true', async () => {
      const result = await provider.healthCheck();
      expect(result).toBe(true);
    });
  });
});
