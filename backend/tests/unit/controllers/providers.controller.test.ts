/**
 * ProvidersController 单元测试
 * 艹，测试Controller的业务逻辑，mock所有外部依赖！
 */

import { Request, Response, NextFunction } from 'express';
import { ProvidersController } from '../../../src/controllers/providers.controller';
import * as providerRepo from '../../../src/repositories/providerEndpoints.repo';

// Mock providerRepo
jest.mock('../../../src/repositories/providerEndpoints.repo');

describe('ProvidersController - 单元测试', () => {
  let controller: ProvidersController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    controller = new ProvidersController();

    mockReq = {
      params: {},
      query: {},
      body: {},
      user: { id: 1 }, // Mock user
    };

    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    // 清除所有mock调用记录
    jest.clearAllMocks();
  });

  describe('listProviders', () => {
    test('应该成功列出所有Provider', async () => {
      const mockProviders = [
        {
          provider_ref: 'test-001',
          provider_name: '测试Provider1',
          endpoint_url: 'https://api1.example.com',
          credentials_encrypted: { key: 'value1' },
          auth_type: 'api_key',
        },
        {
          provider_ref: 'test-002',
          provider_name: '测试Provider2',
          endpoint_url: 'https://api2.example.com',
          credentials_encrypted: { key: 'value2' },
          auth_type: 'bearer',
        },
      ];

      (providerRepo.listProviderEndpoints as jest.Mock)
        .mockResolvedValueOnce(mockProviders) // 第一次调用返回分页数据
        .mockResolvedValueOnce(mockProviders); // 第二次调用返回总数

      mockReq.query = { limit: '10', offset: '0' };

      await controller.listProviders(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          items: mockProviders,
          total: 2,
          limit: 10,
          offset: 0,
        },
      });
    });

    test('应该支持auth_type过滤', async () => {
      mockReq.query = { auth_type: 'api_key' };

      (providerRepo.listProviderEndpoints as jest.Mock).mockResolvedValue([]);

      await controller.listProviders(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(providerRepo.listProviderEndpoints).toHaveBeenCalledWith(
        expect.objectContaining({
          authType: 'api_key',
        })
      );
    });
  });

  describe('getProvider', () => {
    test('应该成功获取单个Provider', async () => {
      const mockProvider = {
        provider_ref: 'test-001',
        provider_name: '测试Provider',
        endpoint_url: 'https://api.example.com',
        credentials_encrypted: { key: 'value' },
        auth_type: 'api_key',
      };

      (providerRepo.getProviderEndpoint as jest.Mock).mockResolvedValue(
        mockProvider
      );

      mockReq.params = { provider_ref: 'test-001' };

      await controller.getProvider(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockProvider,
      });
    });

    test('Provider不存在时应该返回404', async () => {
      (providerRepo.getProviderEndpoint as jest.Mock).mockResolvedValue(null);

      mockReq.params = { provider_ref: 'non-existent' };

      await controller.getProvider(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Provider端点不存在: non-existent',
        },
      });
    });
  });

  describe('createProvider', () => {
    test('应该成功创建Provider', async () => {
      const inputData = {
        provider_ref: 'new-provider',
        provider_name: '新Provider',
        endpoint_url: 'https://new-api.example.com',
        credentials: { apiKey: 'secret-key' },
        auth_type: 'api_key',
      };

      const createdProvider = {
        ...inputData,
        credentials_encrypted: inputData.credentials,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (providerRepo.providerEndpointExists as jest.Mock).mockResolvedValue(
        false
      );
      (providerRepo.createProviderEndpoint as jest.Mock).mockResolvedValue(
        createdProvider
      );

      mockReq.body = inputData;

      await controller.createProvider(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: createdProvider,
      });
    });

    test('缺少必填字段应该返回400', async () => {
      mockReq.body = {
        provider_ref: 'test',
        // 缺少其他必填字段
      };

      await controller.createProvider(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
          }),
        })
      );
    });

    test('provider_ref格式错误应该返回400', async () => {
      mockReq.body = {
        provider_ref: 'invalid ref!', // 包含非法字符
        provider_name: '测试',
        endpoint_url: 'https://api.example.com',
        credentials: { key: 'value' },
        auth_type: 'api_key',
      };

      await controller.createProvider(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: expect.stringContaining('只能包含'),
          }),
        })
      );
    });

    test('Provider已存在应该返回409', async () => {
      (providerRepo.providerEndpointExists as jest.Mock).mockResolvedValue(
        true
      );

      mockReq.body = {
        provider_ref: 'existing-provider',
        provider_name: '测试',
        endpoint_url: 'https://api.example.com',
        credentials: { key: 'value' },
        auth_type: 'api_key',
      };

      await controller.createProvider(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'CONFLICT',
          }),
        })
      );
    });
  });

  describe('updateProvider', () => {
    test('应该成功更新Provider', async () => {
      const updates = {
        provider_name: '更新后的名字',
        endpoint_url: 'https://updated-api.example.com',
      };

      const updatedProvider = {
        provider_ref: 'test-001',
        ...updates,
        credentials_encrypted: { key: 'value' },
        auth_type: 'api_key',
      };

      (providerRepo.updateProviderEndpoint as jest.Mock).mockResolvedValue(
        updatedProvider
      );

      mockReq.params = { provider_ref: 'test-001' };
      mockReq.body = updates;

      await controller.updateProvider(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: updatedProvider,
      });
    });

    test('更新不存在的Provider应该返回404', async () => {
      (providerRepo.updateProviderEndpoint as jest.Mock).mockRejectedValue(
        new Error('Provider端点不存在: test-999')
      );

      mockReq.params = { provider_ref: 'test-999' };
      mockReq.body = { provider_name: '新名字' };

      await controller.updateProvider(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
          }),
        })
      );
    });
  });

  describe('deleteProvider', () => {
    test('应该成功删除Provider', async () => {
      (providerRepo.deleteProviderEndpoint as jest.Mock).mockResolvedValue(
        true
      );

      mockReq.params = { provider_ref: 'test-001' };

      await controller.deleteProvider(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Provider端点已删除',
      });
    });

    test('删除不存在的Provider应该返回404', async () => {
      (providerRepo.deleteProviderEndpoint as jest.Mock).mockResolvedValue(
        false
      );

      mockReq.params = { provider_ref: 'non-existent' };

      await controller.deleteProvider(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
          }),
        })
      );
    });
  });

  describe('testConnection', () => {
    test('应该成功测试连接', async () => {
      const mockProvider = {
        provider_ref: 'test-001',
        provider_name: '测试Provider',
        endpoint_url: 'https://api.example.com',
        credentials_encrypted: { key: 'value' },
        auth_type: 'api_key',
      };

      (providerRepo.getProviderEndpoint as jest.Mock).mockResolvedValue(
        mockProvider
      );

      mockReq.params = { provider_ref: 'test-001' };

      await controller.testConnection(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          healthy: true,
          message: expect.any(String),
          tested_at: expect.any(String),
        }),
      });
    });

    test('测试不存在的Provider应该返回404', async () => {
      (providerRepo.getProviderEndpoint as jest.Mock).mockResolvedValue(null);

      mockReq.params = { provider_ref: 'non-existent' };

      await controller.testConnection(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('错误处理', () => {
    test('意外错误应该传递给next中间件', async () => {
      const testError = new Error('数据库连接失败');
      (providerRepo.listProviderEndpoints as jest.Mock).mockRejectedValue(
        testError
      );

      await controller.listProviders(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(testError);
    });
  });
});
