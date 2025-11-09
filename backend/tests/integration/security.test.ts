/**
 * 安全测试 - 老王我重点关注的！
 * 测试权限控制、XSS防护、SQL注入防护等
 */

import request from 'supertest';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import authRoutes from '../../src/routes/auth.routes.js';
import taskRoutes from '../../src/routes/task.routes.js';

declare const global: any;

function createTestApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  // JWT验证中间件
  const authenticateToken = (
    req: Request & { userId?: string },
    res: Response,
    next: NextFunction
  ) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: '缺少访问令牌' });
    }

    jwt.verify(token, process.env.JWT_SECRET ?? '', (err, user: any) => {
      if (err) {
        return res.status(403).json({ error: '无效的访问令牌' });
      }
      req.userId = user.userId;
      next();
    });
  };

  // 导入路由

  app.use('/auth', authRoutes);
  app.use('/task', authenticateToken, taskRoutes);

  // 错误处理中间件
  app.use((error: any, req: Request, res: Response, next: NextFunction) => {
    const statusCode = error.statusCode || 500;
    const errorCode = error.errorCode || 'INTERNAL_ERROR';
    const message = error.message || '服务器内部错误';

    res.status(statusCode).json({
      error: message,
      errorCode,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  });

  return app;
}

describe('安全测试', () => {
  let app: any;
  let testUser: any;
  let authToken: any;
  let otherUser: any;
  let otherToken: any;

  beforeAll(async () => {
    app = createTestApp();
    testUser = await global.createTestUser({
      phone: '13800138010',
      quota_remaining: 10,
      isMember: true
    });
    authToken = global.generateTestJWT(testUser.id);

    otherUser = await global.createTestUser({
      phone: '13800138011',
      quota_remaining: 5,
      isMember: true
    });
    otherToken = global.generateTestJWT(otherUser.id);
  });

  describe('权限控制测试', () => {
    test('用户不能访问其他人的任务', async () => {
      // 创建其他用户的任务
      const otherTask = await global.createTestTask(otherUser.id, {
        status: 'success',
        resultUrls: JSON.stringify(['https://test.com/secret.mp4'])
      });

      // 尝试用testUser的token访问otherUser的任务
      const response = await request(app)
        .get(`/task/${otherTask.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('无权访问');
    });

    test('用户不能查看其他人的任务列表', async () => {
      // 创建其他用户的任务
      await global.createTestTask(otherUser.id, {
        id: 'other-user-task',
        status: 'success'
      });

      // testUser获取自己的任务列表，不应该包含otherUser的任务
      const response = await request(app)
        .get('/task/list')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.tasks).toEqual(
        expect.not.arrayContaining([expect.objectContaining({ id: 'other-user-task' })])
      );
    });

    test('用户不能创建超过配额的任务', async () => {
      const poorUser = await global.createTestUser({
        phone: '13800138012',
        quota_remaining: 0,
        isMember: true
      });
      const poorToken = global.generateTestJWT(poorUser.id);

      const response = await request(app)
        .post('/task/create')
        .set('Authorization', `Bearer ${poorToken}`)
        .send({
          type: 'basic_clean',
          inputImageUrl: 'https://test.com/input.jpg'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('配额不足');
    });

    test('非会员用户不能创建任务', async () => {
      const nonMemberUser = await global.createTestUser({
        phone: '13800138013',
        isMember: false,
        quota_remaining: 100
      });
      const nonMemberToken = global.generateTestJWT(nonMemberUser.id);

      const response = await request(app)
        .post('/task/create')
        .set('Authorization', `Bearer ${nonMemberToken}`)
        .send({
          type: 'basic_clean',
          inputImageUrl: 'https://test.com/input.jpg'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('请先购买会员');
    });
  });

  describe('XSS攻击防护测试', () => {
    test('应该过滤输入中的XSS代码', async () => {
      const xssPayload = '<script>alert("xss")</script>';

      const response = await request(app)
        .post('/task/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'video_generate',
          inputImageUrl: `https://test.com/${xssPayload}.jpg`,
          params: {
            description: xssPayload,
            effects: [xssPayload]
          }
        });

      // 如果请求成功，验证XSS代码被正确处理
      if (response.status === 200) {
        const taskId = response.body.data.taskId;

        // 获取任务详情，检查XSS代码是否被过滤
        const taskResponse = await request(app)
          .get(`/task/${taskId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(taskResponse.body.data.params.description).not.toContain('<script>');
      }
    });

    test('应该正确处理URL编码的XSS', async () => {
      const encodedXss = '%3Cscript%3Ealert%28%22xss%22%29%3C%2Fscript%3E';

      const response = await request(app)
        .post('/task/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'basic_clean',
          inputImageUrl: `https://test.com/image.jpg?xss=${encodedXss}`
        });

      expect([200, 400]).toContain(response.status);
    });
  });

  describe('SQL注入防护测试', () => {
    test('应该防止SQL注入攻击', async () => {
      const sqlInjection = "'; DROP TABLE users; --";

      // 尝试通过任务ID进行SQL注入
      const response = await request(app)
        .get(`/task/${sqlInjection}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('任务不存在');

      // 验证users表仍然存在
      const { knex } = require('../../src/config/database');
      const userCount = await knex('users').count('* as count').first();
      expect(parseInt(userCount.count)).toBeGreaterThan(0);
    });

    test('应该防止通过参数进行SQL注入', async () => {
      const maliciousInput = "1' OR '1'='1";

      const response = await request(app)
        .get(`/task/list?status=${maliciousInput}`)
        .set('Authorization', `Bearer ${authToken}`);

      // 应该正常处理或返回验证错误，不应该泄露数据库信息
      expect([200, 400]).toContain(response.status);

      if (response.status === 200) {
        // 如果成功返回，结果应该是空列表或正常列表，不应该返回所有数据
        expect(Array.isArray(response.body.data.tasks)).toBe(true);
      }
    });
  });

  describe('认证和授权测试', () => {
    test('无效token应该被拒绝', async () => {
      const invalidTokens = [
        'invalid.token.here',
        'Bearer invalid',
        'completely-fake-token',
        'null',
        ''
      ];

      for (const token of invalidTokens) {
        const response = await request(app).get('/task/list').set('Authorization', token);

        expect([401, 403]).toContain(response.status);
      }
    });

    test('过期的token应该被拒绝', async () => {
      const expiredToken = jwt.sign(
        { userId: testUser.id },
        process.env.JWT_SECRET ?? 'test-secret',
        { expiresIn: '-1h' } // 已过期
      );

      const response = await request(app)
        .get('/task/list')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('无效的访问令牌');
    });

    test('被篡改的token应该被拒绝', async () => {
      const validToken = global.generateTestJWT(testUser.id);
      const tamperedToken = validToken.slice(0, -10) + 'tampered';

      const response = await request(app)
        .get('/task/list')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('无效的访问令牌');
    });
  });

  describe('敏感信息泄露测试', () => {
    test('不应该返回内部错误详情', async () => {
      const response = await request(app)
        .get('/task/nonexistent-task-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();

      // 确保不返回堆栈跟踪等内部信息
      expect(response.body.stack).toBeUndefined();
      expect(response.body.error).not.toContain('Error:');
      expect(response.body.error).not.toContain('at ');
    });

    test('不应该暴露数据库字段名', async () => {
      const response = await request(app)
        .get('/task/list')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);

      // 检查响应中不包含内部数据库字段名
      const responseStr = JSON.stringify(response.body);
      expect(responseStr).not.toContain('password');
      expect(responseStr).not.toContain('internal_');
      expect(responseStr).not.toContain('_temp');
    });

    test('不应该暴露API密钥或内部配置', async () => {
      const response = await request(app)
        .post('/task/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'video_generate',
          inputImageUrl: 'https://test.com/input.jpg'
        });

      expect(response.status).toBe(200);

      const responseStr = JSON.stringify(response.body);
      expect(responseStr).not.toContain('API_KEY');
      expect(responseStr).not.toContain('SECRET');
      expect(responseStr).not.toContain('DATABASE_URL');
    });
  });

  describe('请求频率限制测试', () => {
    test('应该限制高频请求', async () => {
      const requests = Array.from({ length: 20 }, () =>
        request(app).get('/task/list').set('Authorization', `Bearer ${authToken}`)
      );

      const results = await Promise.allSettled(requests);
      const rejected = results.filter((r) => r.status === 'rejected' || r.value.status >= 400);

      // 应该有一些请求被限制
      expect(rejected.length).toBeGreaterThan(0);
    }, 15000);
  });

  describe('文件上传安全测试', () => {
    test('应该验证图片URL格式', async () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://malicious.com/file.jpg',
        'javascript:alert("xss")',
        'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIi8+',
        'file:///etc/passwd'
      ];

      for (const url of invalidUrls) {
        const response = await request(app)
          .post('/task/create')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'basic_clean',
            inputImageUrl: url
          });

        expect([400, 422]).toContain(response.status);
      }
    });

    test('应该限制URL长度', async () => {
      const longUrl = 'https://test.com/' + 'a'.repeat(10000);

      const response = await request(app)
        .post('/task/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'basic_clean',
          inputImageUrl: longUrl
        });

      expect([400, 413]).toContain(response.status);
    });
  });

  describe('HTTP头安全测试', () => {
    test('应该设置安全相关的HTTP头', async () => {
      const response = await request(app)
        .get('/task/list')
        .set('Authorization', `Bearer ${authToken}`);

      // 检查安全头
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
      expect(response.headers['strict-transport-security']).toBeDefined();
    });

    test('不应该泄露服务器信息', async () => {
      const response = await request(app)
        .get('/task/list')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.headers['server']).toBeUndefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });
});
