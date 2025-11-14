/**
 * TencentCI Provider 单元测试
 * 艹，测试覆盖参数校验/占位实现/错误处理！
 */

import { TencentCiProvider } from '../../../src/providers/handlers/tencentCi.handler.ts';
import {
  ExecContext,
  ProviderErrorCode,
  type ExecResult
} from '../../../src/providers/types.ts';
import { ILogger } from '../../../src/providers/base/base-provider.ts';

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

describe('TencentCI Provider - 单元测试', () => {
  let provider: TencentCiProvider;
  let mockLogger: MockLogger;
  type TencentCiResult = {
    message: string;
    action: string;
    bucket: string;
    region: string;
    objectKey: string;
    params: Record<string, unknown>;
  };

  beforeEach(() => {
    mockLogger = new MockLogger();
    provider = new TencentCiProvider(undefined, mockLogger);
  });

  afterEach(() => {
    mockLogger.clear();
  });

  const executeProvider = (context: ExecContext) =>
    provider.execute(context) as Promise<ExecResult<TencentCiResult>>;

  const expectSuccess = (result: ExecResult<TencentCiResult>): TencentCiResult => {
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    return result.data as TencentCiResult;
  };

  describe('参数校验', () => {
    test('应该拒绝空输入', () => {
      expect(provider.validate(null)).toContain('输入参数必须是对象');
      expect(provider.validate(undefined)).toContain('输入参数必须是对象');
      expect(provider.validate('string')).toContain('输入参数必须是对象');
    });

    test('应该拒绝缺少action', () => {
      const input = {
        bucket: 'test-bucket',
        region: 'ap-guangzhou',
        objectKey: 'test.jpg',
        params: {}
      };
      expect(provider.validate(input)).toContain('缺少或无效的action字段');
    });

    test('应该拒绝无效的action类型', () => {
      const input = {
        action: 123, // 应该是string
        bucket: 'test-bucket',
        region: 'ap-guangzhou',
        objectKey: 'test.jpg',
        params: {}
      };
      expect(provider.validate(input)).toContain('缺少或无效的action字段');
    });

    test('应该拒绝缺少bucket', () => {
      const input = {
        action: 'imageProcess',
        region: 'ap-guangzhou',
        objectKey: 'test.jpg',
        params: {}
      };
      expect(provider.validate(input)).toContain('缺少或无效的bucket字段');
    });

    test('应该拒绝无效的bucket类型', () => {
      const input = {
        action: 'imageProcess',
        bucket: 123, // 应该是string
        region: 'ap-guangzhou',
        objectKey: 'test.jpg',
        params: {}
      };
      expect(provider.validate(input)).toContain('缺少或无效的bucket字段');
    });

    test('应该拒绝缺少region', () => {
      const input = {
        action: 'imageProcess',
        bucket: 'test-bucket',
        objectKey: 'test.jpg',
        params: {}
      };
      expect(provider.validate(input)).toContain('缺少或无效的region字段');
    });

    test('应该拒绝无效的region格式', () => {
      const input = {
        action: 'imageProcess',
        bucket: 'test-bucket',
        region: 'INVALID123', // 大写字母和数字，不符合格式
        objectKey: 'test.jpg',
        params: {}
      };
      expect(provider.validate(input)).toContain('region格式无效');
    });

    test('应该拒绝缺少objectKey', () => {
      const input = {
        action: 'imageProcess',
        bucket: 'test-bucket',
        region: 'ap-guangzhou',
        params: {}
      };
      expect(provider.validate(input)).toContain('缺少或无效的objectKey字段');
    });

    test('应该拒绝无效的objectKey类型', () => {
      const input = {
        action: 'imageProcess',
        bucket: 'test-bucket',
        region: 'ap-guangzhou',
        objectKey: 123, // 应该是string
        params: {}
      };
      expect(provider.validate(input)).toContain('缺少或无效的objectKey字段');
    });

    test('应该拒绝缺少params', () => {
      const input = {
        action: 'imageProcess',
        bucket: 'test-bucket',
        region: 'ap-guangzhou',
        objectKey: 'test.jpg'
      };
      expect(provider.validate(input)).toContain('缺少或无效的params字段');
    });

    test('应该拒绝无效的params类型', () => {
      const input = {
        action: 'imageProcess',
        bucket: 'test-bucket',
        region: 'ap-guangzhou',
        objectKey: 'test.jpg',
        params: 'invalid' // 应该是object
      };
      expect(provider.validate(input)).toContain('缺少或无效的params字段');
    });

    test('应该拒绝不完整的auth配置', () => {
      const input = {
        action: 'imageProcess',
        bucket: 'test-bucket',
        region: 'ap-guangzhou',
        objectKey: 'test.jpg',
        params: {},
        auth: {
          secretId: 'id'
          // 缺少secretKey
        }
      };
      expect(provider.validate(input)).toContain('auth配置不完整');
    });

    test('应该接受有效输入（不带auth）', () => {
      const input = {
        action: 'imageProcess',
        bucket: 'test-bucket',
        region: 'ap-guangzhou',
        objectKey: 'test.jpg',
        params: {
          width: 800,
          height: 600
        }
      };
      expect(provider.validate(input)).toBeNull();
    });

    test('应该接受有效输入（带auth）', () => {
      const input = {
        action: 'imageCompress',
        bucket: 'test-bucket',
        region: 'ap-shanghai',
        objectKey: 'images/test.jpg',
        params: {
          quality: 80
        },
        auth: {
          secretId: 'test-id',
          secretKey: 'test-key',
          token: 'test-token'
        }
      };
      expect(provider.validate(input)).toBeNull();
    });

    test('应该接受各种有效的region格式', () => {
      const validRegions = ['ap-guangzhou', 'ap-shanghai', 'ap-beijing-1', 'na-siliconvalley'];

      validRegions.forEach((region) => {
        const input = {
          action: 'imageProcess',
          bucket: 'test-bucket',
          region,
          objectKey: 'test.jpg',
          params: {}
        };
        expect(provider.validate(input)).toBeNull();
      });
    });
  });

  describe('占位实现执行', () => {
    test('应该成功执行图片处理（占位）', async () => {
      const input = {
        action: 'imageProcess',
        bucket: 'test-bucket-123',
        region: 'ap-guangzhou',
        objectKey: 'images/test.jpg',
        params: {
          width: 800,
          height: 600,
          mode: 'crop'
        }
      };

      const context: ExecContext = {
        taskId: 'task-ci-001',
        input
      };

      const result = await executeProvider(context);

      // 验证结果
      const data = expectSuccess(result);
      expect(data.message).toContain('TencentCiProvider尚未实现');
      expect(data.action).toBe('imageProcess');
      expect(data.bucket).toBe('test-bucket-123');
      expect(data.region).toBe('ap-guangzhou');
      expect(data.objectKey).toBe('images/test.jpg');
      expect(data.params).toEqual(input.params);
    });

    test('应该成功执行视频处理（占位）', async () => {
      const input = {
        action: 'videoProcess',
        bucket: 'video-bucket',
        region: 'ap-shanghai',
        objectKey: 'videos/test.mp4',
        params: {
          codec: 'h264',
          bitrate: '1000k'
        }
      };

      const context: ExecContext = {
        taskId: 'task-ci-002',
        input
      };

      const result = await executeProvider(context);
      const data = expectSuccess(result);
      expect(data.action).toBe('videoProcess');
    });

    test('应该成功执行内容审核（占位）', async () => {
      const input = {
        action: 'contentAudit',
        bucket: 'audit-bucket',
        region: 'ap-guangzhou',
        objectKey: 'content/test.jpg',
        params: {
          detectType: ['porn', 'terrorism']
        },
        auth: {
          secretId: 'test-id',
          secretKey: 'test-key'
        }
      };

      const context: ExecContext = {
        taskId: 'task-ci-003',
        input
      };

      const result = await executeProvider(context);
      const data = expectSuccess(result);
      expect(data.action).toBe('contentAudit');
    });

    test('应该记录warning日志提示未实现', async () => {
      const input = {
        action: 'imageCompress',
        bucket: 'test-bucket',
        region: 'ap-guangzhou',
        objectKey: 'test.jpg',
        params: {}
      };

      const context: ExecContext = {
        taskId: 'task-ci-004',
        input
      };

      await executeProvider(context);

      // 验证日志
      const warnLogs = mockLogger.logs.filter((log) => log.level === 'warn');
      expect(warnLogs.length).toBeGreaterThan(0);
      expect(warnLogs[0].message).toContain('TencentCiProvider尚未实现');
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
        action: 'imageProcess',
        bucket: 'test-bucket'
      };

      const context: ExecContext = {
        taskId: 'task-ci-error-001',
        input
      };

      const result = await executeProvider(context);

      // 参数校验失败应该返回错误
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe(ProviderErrorCode.ERR_PROVIDER_VALIDATION_FAILED);
    });
  });
});
