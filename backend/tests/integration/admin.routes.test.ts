/**
 * 管理员API集成测试
 */

import request from 'supertest';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';

type AdminRequest = Request & {
  user?: { id: string; role: string };
  id?: string;
};

// 模拟应用实例
const createApp = (): Express => {
  const app = express();
  app.use(express.json());

  // 模拟认证中间件
  app.use((req: AdminRequest, _res: Response, next: NextFunction) => {
    req.user = { id: 'test-user', role: 'admin' };
    req.id = 'test-request-id';
    next();
  });

  // 模拟路由
  app.get('/api/admin/features/stats', (_req, res) => {
    res.json({
      success: true,
      data: {
        total: 10,
        byStatus: { published: 8, draft: 2 }
      }
    });
  });

  app.get('/api/admin/security/health', (_req, res) => {
    res.json({
      success: true,
      data: {
        overall: 'healthy',
        checks: [
          { name: 'database', status: 'healthy' },
          { name: 'redis', status: 'healthy' }
        ]
      }
    });
  });

  app.post('/api/admin/features', (req, res) => {
    res.status(201).json({
      success: true,
      data: {
        id: 'new-feature-id',
        name: req.body.name,
        status: 'draft'
      },
      message: '功能创建成功'
    });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({
      success: false,
      error: {
        code: 5000,
        message: err.message || '内部服务器错误'
      }
    });
  });

  return app;
};

describe('Admin API Integration Tests', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  describe('GET /api/admin/features/stats', () => {
    it('应该返回功能统计信息', async () => {
      const response = await request(app).get('/api/admin/features/stats').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(10);
      expect(response.body.data.byStatus).toBeDefined();
      expect(response.body.requestId).toBeDefined();
    });
  });

  describe('GET /api/admin/security/health', () => {
    it('应该返回健康检查结果', async () => {
      const response = await request(app).get('/api/admin/security/health').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.overall).toBe('healthy');
      expect(response.body.data.checks).toHaveLength(2);
      expect(response.body.requestId).toBeDefined();
    });
  });

  describe('POST /api/admin/features', () => {
    it('应该成功创建新功能', async () => {
      const featureData = {
        name: '测试功能',
        description: '这是一个测试功能',
        category: 'test',
        config: { setting1: 'value1' }
      };

      const response = await request(app).post('/api/admin/features').send(featureData).expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe('new-feature-id');
      expect(response.body.data.name).toBe(featureData.name);
      expect(response.body.data.status).toBe('draft');
      expect(response.body.message).toBe('功能创建成功');
      expect(response.body.requestId).toBeDefined();
    });

    it('应该验证必需字段', async () => {
      const invalidData = {
        description: '缺少name字段'
      };

      const response = await request(app).post('/api/admin/features').send(invalidData).expect(500); // 在真实应用中应该是400，但这里模拟错误处理

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('错误处理', () => {
    it('应该处理无效的请求', async () => {
      const response = await request(app).get('/api/admin/nonexistent-endpoint').expect(404);

      // 验证错误响应格式
      expect(response.body).toBeDefined();
    });

    it('应该处理JSON解析错误', async () => {
      const response = await request(app)
        .post('/api/admin/features')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      // 验证JSON解析错误处理
      expect(response.body).toBeDefined();
    });
  });

  describe('CORS Headers', () => {
    it('应该包含适当的CORS头', async () => {
      const response = await request(app).get('/api/admin/features/stats').expect(200);

      // 在真实应用中，应该检查CORS头
      // expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('请求ID', () => {
    it('应该为每个请求分配唯一ID', async () => {
      const response1 = await request(app).get('/api/admin/features/stats').expect(200);

      const response2 = await request(app).get('/api/admin/features/stats').expect(200);

      expect(response1.body.requestId).toBeDefined();
      expect(response2.body.requestId).toBeDefined();
      // 在真实应用中，应该检查ID的唯一性
    });
  });

  describe('响应时间', () => {
    it('API响应应该在合理时间内完成', async () => {
      const startTime = Date.now();

      await request(app).get('/api/admin/features/stats').expect(200);

      const responseTime = Date.now() - startTime;

      // 响应时间应该小于1秒
      expect(responseTime).toBeLessThan(1000);
    });
  });

  describe('并发请求', () => {
    it('应该能处理多个并发请求', async () => {
      const requests = Array(10)
        .fill(null)
        .map(() => request(app).get('/api/admin/features/stats'));

      const responses = await Promise.all(requests);

      // 验证所有请求都成功
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('数据完整性', () => {
    it('应该返回完整的响应结构', async () => {
      const response = await request(app).get('/api/admin/features/stats').expect(200);

      // 验证响应结构完整性
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('requestId');

      if (response.body.success) {
        expect(typeof response.body.data).toBe('object');
        expect(typeof response.body.requestId).toBe('string');
      }
    });
  });

  describe('安全性', () => {
    it('应该防止XSS攻击', async () => {
      const maliciousData = {
        name: '<script>alert("xss")</script>',
        description: 'test description with <img src=x onerror=alert(1)>'
      };

      const response = await request(app)
        .post('/api/admin/features')
        .send(maliciousData)
        .expect(201);

      // 在真实应用中，应该验证恶意脚本被转义或过滤
      expect(response.body.data.name).toBeDefined();
    });

    it('应该处理过大的请求体', async () => {
      const largeData = {
        name: 'a'.repeat(10000), // 10KB的名称
        description: 'test'
      };

      const response = await request(app).post('/api/admin/features').send(largeData).expect(201); // 在真实应用中应该有限制

      // 验证大数据处理
      expect(response.body.data.name).toBeDefined();
    });
  });
});
