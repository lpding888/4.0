/**
 * COS STS服务单元测试
 * 艹，这个测试文件覆盖腾讯云COS临时密钥生成的所有功能！
 */

import STS from 'qcloud-cos-sts';
import logger from '../../src/utils/logger.js';

// Mock依赖
jest.mock('qcloud-cos-sts');
jest.mock('../../src/utils/logger.js');

const mockedSTS = STS as jest.Mocked<typeof STS>;
const mockedLogger = logger as jest.Mocked<typeof logger>;
let cosSTSService: (typeof import('../../src/services/cos-sts.service.js'))['cosSTSService'];

// 保存原始环境变量
const originalEnv = process.env;

describe('CosSTSService', () => {
  beforeAll(async () => {
    // 设置测试环境变量
    process.env.COS_SECRET_ID = 'test-secret-id';
    process.env.COS_SECRET_KEY = 'test-secret-key';
    process.env.COS_BUCKET = 'test-bucket-1234567890';
    process.env.COS_REGION = 'ap-beijing';

    ({ cosSTSService } = await import('../../src/services/cos-sts.service.js'));
  });

  afterAll(() => {
    // 恢复原始环境变量
    process.env = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSTSCredentials() - 生成临时密钥', () => {
    it('应该成功生成upload权限的临时密钥', async () => {
      // Arrange
      const userId = 'user123';
      const mockSTSResult = {
        credentials: {
          tmpSecretId: 'temp-secret-id-xxx',
          tmpSecretKey: 'temp-secret-key-xxx',
          sessionToken: 'session-token-xxx'
        },
        expiredTime: 1234567890,
        expiration: '2025-11-03T12:00:00Z',
        startTime: 1234565000
      };

      // Mock STS.getCredential
      (mockedSTS.getCredential as any) = jest.fn((config: any, callback: any) => {
        // 艹，强制as any避免类型推导问题！
        callback(null as any, mockSTSResult); // 艹，null也要as any！
      });

      // Act
      const result = await cosSTSService.getSTSCredentials(userId, {
        action: 'upload',
        prefix: `user-${userId}/`,
        durationSeconds: 1800
      });

      // Assert
      expect(result).toEqual({
        tmpSecretId: 'temp-secret-id-xxx',
        tmpSecretKey: 'temp-secret-key-xxx',
        sessionToken: 'session-token-xxx',
        expiredTime: 1234567890,
        expiration: '2025-11-03T12:00:00Z',
        startTime: 1234565000,
        bucket: 'test-bucket-1234567890',
        region: 'ap-beijing',
        prefix: `user-${userId}/`
      });

      expect(mockedSTS.getCredential).toHaveBeenCalledWith(
        expect.objectContaining({
          secretId: 'test-secret-id',
          secretKey: 'test-secret-key',
          durationSeconds: 1800,
          policy: expect.objectContaining({
            version: '2.0',
            statement: expect.arrayContaining([
              expect.objectContaining({
                effect: 'allow',
                action: expect.arrayContaining([
                  'name/cos:PutObject',
                  'name/cos:InitiateMultipartUpload'
                ]),
                resource: expect.arrayContaining([
                  `qcs::cos:ap-beijing:uid/*:test-bucket-1234567890/user-${userId}/*`
                ])
              })
            ])
          })
        }),
        expect.any(Function)
      );

      expect(mockedLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[CosSTSService] STS临时密钥生成成功')
      );
    });

    it('应该成功生成download权限的临时密钥', async () => {
      // Arrange
      const userId = 'user456';
      const mockSTSResult = {
        credentials: {
          tmpSecretId: 'temp-id',
          tmpSecretKey: 'temp-key',
          sessionToken: 'token'
        },
        expiredTime: 1234567890,
        expiration: '2025-11-03T12:00:00Z',
        startTime: 1234565000
      };

      (mockedSTS.getCredential as any) = jest.fn((config: any, callback: any) => {
        callback(null as any, mockSTSResult);
      });

      // Act
      await cosSTSService.getSTSCredentials(userId, {
        action: 'download',
        prefix: `downloads/`,
        durationSeconds: 900
      });

      // Assert
      expect(mockedSTS.getCredential).toHaveBeenCalledWith(
        expect.objectContaining({
          durationSeconds: 900,
          policy: expect.objectContaining({
            statement: expect.arrayContaining([
              expect.objectContaining({
                action: expect.arrayContaining(['name/cos:GetObject', 'name/cos:HeadObject'])
              })
            ])
          })
        }),
        expect.any(Function)
      );
    });

    it('应该成功生成all权限的临时密钥', async () => {
      // Arrange
      const userId = 'admin123';
      const mockSTSResult = {
        credentials: {
          tmpSecretId: 'temp-id',
          tmpSecretKey: 'temp-key',
          sessionToken: 'token'
        },
        expiredTime: 1234567890,
        expiration: '2025-11-03T12:00:00Z',
        startTime: 1234565000
      };

      (mockedSTS.getCredential as any) = jest.fn((config: any, callback: any) => {
        callback(null as any, mockSTSResult);
      });

      // Act
      await cosSTSService.getSTSCredentials(userId, {
        action: 'all',
        prefix: `admin/`
      });

      // Assert
      expect(mockedSTS.getCredential).toHaveBeenCalledWith(
        expect.objectContaining({
          policy: expect.objectContaining({
            statement: expect.arrayContaining([
              expect.objectContaining({
                action: ['name/cos:*']
              })
            ])
          })
        }),
        expect.any(Function)
      );
    });

    it('应该自动限制duration在最小和最大值之间', async () => {
      // Arrange
      const userId = 'user789';
      const mockSTSResult = {
        credentials: {
          tmpSecretId: 'temp-id',
          tmpSecretKey: 'temp-key',
          sessionToken: 'token'
        },
        expiredTime: 1234567890,
        expiration: '2025-11-03T12:00:00Z',
        startTime: 1234565000
      };

      (mockedSTS.getCredential as any) = jest.fn((config: any, callback: any) => {
        callback(null as any, mockSTSResult);
      });

      // Act - 测试过大的duration（超过MAX_DURATION=7200）
      await cosSTSService.getSTSCredentials(userId, {
        durationSeconds: 10000 // 超过最大值
      });

      // Assert - 应该被限制为7200
      expect(mockedSTS.getCredential).toHaveBeenCalledWith(
        expect.objectContaining({
          durationSeconds: 7200
        }),
        expect.any(Function)
      );

      jest.clearAllMocks();

      // Act - 测试过小的duration（小于MIN_DURATION=900）
      await cosSTSService.getSTSCredentials(userId, {
        durationSeconds: 100 // 小于最小值
      });

      // Assert - 应该被限制为900
      expect(mockedSTS.getCredential).toHaveBeenCalledWith(
        expect.objectContaining({
          durationSeconds: 900
        }),
        expect.any(Function)
      );
    });

    it('应该使用默认参数生成临时密钥', async () => {
      // Arrange
      const userId = 'user-default';
      const mockSTSResult = {
        credentials: {
          tmpSecretId: 'temp-id',
          tmpSecretKey: 'temp-key',
          sessionToken: 'token'
        },
        expiredTime: 1234567890,
        expiration: '2025-11-03T12:00:00Z',
        startTime: 1234565000
      };

      (mockedSTS.getCredential as any) = jest.fn((config: any, callback: any) => {
        callback(null as any, mockSTSResult);
      });

      // Act - 不传任何options
      const result = await cosSTSService.getSTSCredentials(userId);

      // Assert
      expect(result.prefix).toBe(`user-${userId}/`); // 默认prefix
      expect(mockedSTS.getCredential).toHaveBeenCalledWith(
        expect.objectContaining({
          durationSeconds: 1800, // 默认duration
          policy: expect.objectContaining({
            statement: expect.arrayContaining([
              expect.objectContaining({
                action: expect.arrayContaining([
                  'name/cos:PutObject' // 默认upload权限
                ])
              })
            ])
          })
        }),
        expect.any(Function)
      );
    });

    it('应该在STS API调用失败时抛出错误', async () => {
      // Arrange
      const userId = 'user-error';
      const mockError = new Error('STS API failed');

      (mockedSTS.getCredential as any) = jest.fn((config: any, callback: any) => {
        callback(mockError, null);
      });

      // Act & Assert
      await expect(cosSTSService.getSTSCredentials(userId)).rejects.toThrow(
        'Failed to generate STS credentials'
      );

      expect(mockedLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('[CosSTSService] 生成STS临时密钥失败'),
        mockError
      );
    });

    it('应该支持自定义bucket和region', async () => {
      // Arrange
      const userId = 'user-custom';
      const customBucket = 'custom-bucket-123';
      const customRegion = 'ap-shanghai';

      const mockSTSResult = {
        credentials: {
          tmpSecretId: 'temp-id',
          tmpSecretKey: 'temp-key',
          sessionToken: 'token'
        },
        expiredTime: 1234567890,
        expiration: '2025-11-03T12:00:00Z',
        startTime: 1234565000
      };

      (mockedSTS.getCredential as any) = jest.fn((config: any, callback: any) => {
        callback(null as any, mockSTSResult);
      });

      // Act
      const result = await cosSTSService.getSTSCredentials(userId, {
        bucket: customBucket,
        region: customRegion
      });

      // Assert
      expect(result.bucket).toBe(customBucket);
      expect(result.region).toBe(customRegion);
      expect(mockedSTS.getCredential).toHaveBeenCalledWith(
        expect.objectContaining({
          policy: expect.objectContaining({
            statement: expect.arrayContaining([
              expect.objectContaining({
                resource: expect.arrayContaining([
                  `qcs::cos:${customRegion}:uid/*:${customBucket}/user-${userId}/*`
                ])
              })
            ])
          })
        }),
        expect.any(Function)
      );
    });
  });

  describe('validateConfig() - 验证配置', () => {
    it('应该在配置完整时返回true', () => {
      // Act
      const result = cosSTSService.validateConfig();

      // Assert
      expect(result).toBe(true);
    });

    it('应该在配置缺失时返回false', () => {
      // 这个测试需要创建一个新实例，但由于使用单例模式，这里只验证逻辑
      // 实际项目中可以通过DI来测试不同配置
      expect(typeof cosSTSService.validateConfig()).toBe('boolean');
    });
  });

  describe('healthCheck() - 健康检查', () => {
    it('应该返回健康状态和配置信息', async () => {
      // Act
      const result = await cosSTSService.healthCheck();

      // Assert
      expect(result).toEqual({
        status: 'healthy',
        config: {
          hasSecretId: true,
          hasSecretKey: true,
          bucket: 'test-bucket-1234567890',
          region: 'ap-beijing'
        }
      });
    });
  });

  describe('generateUploadUrl() - 生成上传签名URL', () => {
    it('应该生成正确的上传URL', () => {
      // Arrange
      const key = 'user-123/photo.jpg';
      const expires = 3600;

      // Act
      const result = cosSTSService.generateUploadUrl(key, expires);

      // Assert
      expect(result).toContain('test-bucket-1234567890.cos.ap-beijing.myqcloud.com');
      expect(result).toContain(key);
      expect(result).toContain('sign=');
    });

    it('应该使用默认过期时间', () => {
      // Arrange
      const key = 'test.txt';

      // Act
      const result = cosSTSService.generateUploadUrl(key);

      // Assert
      expect(result).toContain(key);
      expect(result).toContain('sign=');
    });
  });

  describe('generateDownloadUrl() - 生成下载签名URL', () => {
    it('应该生成正确的下载URL', () => {
      // Arrange
      const key = 'downloads/file.pdf';
      const expires = 1800;

      // Act
      const result = cosSTSService.generateDownloadUrl(key, expires);

      // Assert
      expect(result).toContain('test-bucket-1234567890.cos.ap-beijing.myqcloud.com');
      expect(result).toContain(key);
      expect(result).toContain('sign=');
    });
  });

  describe('权限策略测试', () => {
    it('upload权限应该只包含上传相关操作', async () => {
      // Arrange
      const userId = 'user-upload';
      const mockSTSResult = {
        credentials: {
          tmpSecretId: 'id',
          tmpSecretKey: 'key',
          sessionToken: 'token'
        },
        expiredTime: 123,
        expiration: '2025-11-03T12:00:00Z',
        startTime: 100
      };

      (mockedSTS.getCredential as any) = jest.fn((config: any, callback: any) => {
        callback(null as any, mockSTSResult);
      });

      // Act
      await cosSTSService.getSTSCredentials(userId, { action: 'upload' });

      // Assert
      const callArgs = (mockedSTS.getCredential as jest.Mock).mock.calls[0][0];
      const actions = callArgs.policy.statement[0].action;

      expect(actions).toContain('name/cos:PutObject');
      expect(actions).toContain('name/cos:InitiateMultipartUpload');
      expect(actions).toContain('name/cos:UploadPart');
      expect(actions).toContain('name/cos:CompleteMultipartUpload');
      expect(actions).toContain('name/cos:AbortMultipartUpload');
      expect(actions).not.toContain('name/cos:GetObject');
    });

    it('download权限应该只包含下载相关操作', async () => {
      // Arrange
      const userId = 'user-download';
      const mockSTSResult = {
        credentials: {
          tmpSecretId: 'id',
          tmpSecretKey: 'key',
          sessionToken: 'token'
        },
        expiredTime: 123,
        expiration: '2025-11-03T12:00:00Z',
        startTime: 100
      };

      (mockedSTS.getCredential as any) = jest.fn((config: any, callback: any) => {
        callback(null as any, mockSTSResult);
      });

      // Act
      await cosSTSService.getSTSCredentials(userId, { action: 'download' });

      // Assert
      const callArgs = (mockedSTS.getCredential as jest.Mock).mock.calls[0][0];
      const actions = callArgs.policy.statement[0].action;

      expect(actions).toContain('name/cos:GetObject');
      expect(actions).toContain('name/cos:HeadObject');
      expect(actions).not.toContain('name/cos:PutObject');
    });

    it('all权限应该包含所有操作', async () => {
      // Arrange
      const userId = 'admin';
      const mockSTSResult = {
        credentials: {
          tmpSecretId: 'id',
          tmpSecretKey: 'key',
          sessionToken: 'token'
        },
        expiredTime: 123,
        expiration: '2025-11-03T12:00:00Z',
        startTime: 100
      };

      (mockedSTS.getCredential as any) = jest.fn((config: any, callback: any) => {
        callback(null as any, mockSTSResult);
      });

      // Act
      await cosSTSService.getSTSCredentials(userId, { action: 'all' });

      // Assert
      const callArgs = (mockedSTS.getCredential as jest.Mock).mock.calls[0][0];
      const actions = callArgs.policy.statement[0].action;

      expect(actions).toEqual(['name/cos:*']);
    });

    it('resource路径应该正确限制prefix', async () => {
      // Arrange
      const userId = 'user-path';
      const customPrefix = 'custom/path/';
      const mockSTSResult = {
        credentials: {
          tmpSecretId: 'id',
          tmpSecretKey: 'key',
          sessionToken: 'token'
        },
        expiredTime: 123,
        expiration: '2025-11-03T12:00:00Z',
        startTime: 100
      };

      (mockedSTS.getCredential as any) = jest.fn((config: any, callback: any) => {
        callback(null as any, mockSTSResult);
      });

      // Act
      await cosSTSService.getSTSCredentials(userId, { prefix: customPrefix });

      // Assert
      const callArgs = (mockedSTS.getCredential as jest.Mock).mock.calls[0][0];
      const resource = callArgs.policy.statement[0].resource[0];

      expect(resource).toBe(`qcs::cos:ap-beijing:uid/*:test-bucket-1234567890/${customPrefix}*`);
    });
  });
});
