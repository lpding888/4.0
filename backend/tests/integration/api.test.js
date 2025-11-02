/**
 * API集成测试
 * 测试完整的HTTP接口调用流程
 */

const request = require('supertest');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// 模拟服务器
function createTestApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  // JWT验证中间件
  const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: '缺少访问令牌' });
    }

    const jwt = require('jsonwebtoken');
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({ error: '无效的访问令牌' });
      }
      req.userId = user.userId;
      next();
    });
  };

  // 导入路由
  const authRoutes = require('../../src/routes/auth');
  const taskRoutes = require('../../src/routes/task');
  const membershipRoutes = require('../../src/routes/membership');

  app.use('/auth', authRoutes);
  app.use('/task', authenticateToken, taskRoutes);
  app.use('/membership', authenticateToken, membershipRoutes);

  // 错误处理中间件
  app.use((error, req, res, next) => {
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

describe('API集成测试', () => {
  let app;
  let testUser;
  let authToken;

  beforeAll(async () => {
    app = createTestApp();
    testUser = await global.createTestUser({
      phone: '13800138001',
      quota_remaining: 10,
      isMember: true
    });
    authToken = global.generateTestJWT(testUser.id);
  });

  describe('认证接口', () => {
    describe('POST /auth/login', () => {
      test('验证码登录应该成功', async () => {
        // 创建验证码
        const { knex } = require('../../src/config/database');
        await knex('verification_codes').insert({
          phone: '13800138002',
          code: '123456',
          created_at: new Date()
        });

        const response = await request(app)
          .post('/auth/login')
          .send({
            phone: '13800138002',
            code: '123456'
          });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          data: {
            token: expect.any(String),
            user: expect.objectContaining({
              phone: '13800138002',
              isMember: expect.any(Boolean),
              quota_remaining: expect.any(Number)
            })
          }
        });
      });

      test('无效验证码应该返回错误', async () => {
        const response = await request(app)
          .post('/auth/login')
          .send({
            phone: '13800138003',
            code: '999999'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('验证码错误');
      });

      test('缺少参数应该返回验证错误', async () => {
        const response = await request(app)
          .post('/auth/login')
          .send({
            phone: '13800138004'
            // 缺少 code
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
      });
    });

    describe('GET /auth/me', () => {
      test('有效token应该返回用户信息', async () => {
        const response = await request(app)
          .get('/auth/me')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          data: {
            id: testUser.id,
            phone: testUser.phone,
            isMember: testUser.isMember,
            quota_remaining: testUser.quota_remaining
          }
        });
      });

      test('无效token应该返回401错误', async () => {
        const response = await request(app)
          .get('/auth/me')
          .set('Authorization', 'Bearer invalid-token');

        expect(response.status).toBe(403);
        expect(response.body.error).toContain('无效的访问令牌');
      });

      test('缺少token应该返回401错误', async () => {
        const response = await request(app)
          .get('/auth/me');

        expect(response.status).toBe(401);
        expect(response.body.error).toContain('缺少访问令牌');
      });
    });
  });

  describe('任务接口', () => {
    describe('POST /task/create', () => {
      test('应该成功创建视频生成任务', async () => {
        const response = await request(app)
          .post('/task/create')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'video_generate',
            inputImageUrl: 'https://test.com/input.jpg',
            params: {
              duration: 10,
              quality: 'high'
            }
          });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          data: {
            taskId: expect.any(String),
            type: 'video_generate',
            status: 'pending'
          }
        });
      });

      test('非会员用户创建任务应该失败', async () => {
        const nonMemberUser = await global.createTestUser({
          phone: '13800138005',
          isMember: false
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

      test('配额不足应该失败', async () => {
        const poorUser = await global.createTestUser({
          phone: '13800138006',
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

      test('无效任务类型应该失败', async () => {
        const response = await request(app)
          .post('/task/create')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'invalid_type',
            inputImageUrl: 'https://test.com/input.jpg'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('无效的任务类型');
      });
    });

    describe('GET /task/:taskId', () => {
      let testTask;

      beforeEach(async () => {
        testTask = await global.createTestTask(testUser.id, {
          status: 'success',
          resultUrls: JSON.stringify(['https://test.com/result.mp4'])
        });
      });

      test('应该返回任务详情', async () => {
        const response = await request(app)
          .get(`/task/${testTask.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          data: {
            id: testTask.id,
            type: 'video_generate',
            status: 'success',
            inputImageUrl: 'https://test.com/input.jpg',
            resultUrls: ['https://test.com/result.mp4']
          }
        });
      });

      test('用户不能访问其他人的任务', async () => {
        const otherUser = await global.createTestUser({
          phone: '13800138007'
        });
        const otherTask = await global.createTestTask(otherUser.id);
        const otherToken = global.generateTestJWT(otherUser.id);

        const response = await request(app)
          .get(`/task/${otherTask.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toContain('无权访问');
      });

      test('任务不存在应该返回404', async () => {
        const response = await request(app)
          .get('/task/nonexistent-task')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(404);
        expect(response.body.error).toContain('任务不存在');
      });
    });

    describe('GET /task/list', () => {
      beforeEach(async () => {
        // 创建多个测试任务
        await global.createTestTask(testUser.id, {
          id: 'list-task-1',
          status: 'success'
        });
        await global.createTestTask(testUser.id, {
          id: 'list-task-2',
          status: 'processing'
        });
      });

      test('应该返回任务列表', async () => {
        const response = await request(app)
          .get('/task/list')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          data: {
            tasks: expect.any(Array),
            total: expect.any(Number),
            limit: expect.any(Number),
            offset: expect.any(Number)
          }
        });

        expect(response.body.data.tasks.length).toBeGreaterThan(0);
      });

      test('应该支持状态筛选', async () => {
        const response = await request(app)
          .get('/task/list?status=success')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        response.body.data.tasks.forEach(task => {
          expect(task.status).toBe('success');
        });
      });

      test('应该支持分页', async () => {
        const response = await request(app)
          .get('/task/list?limit=1&offset=0')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.tasks).toHaveLength(1);
        expect(response.body.data.limit).toBe(1);
        expect(response.body.data.offset).toBe(0);
      });
    });
  });

  describe('会员接口', () => {
    describe('GET /membership/status', () => {
      test('应该返回会员状态信息', async () => {
        const response = await request(app)
          .get('/membership/status')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          data: {
            isMember: testUser.isMember,
            quota_remaining: testUser.quota_remaining,
            quota_expireAt: expect.any(String)
          }
        });
      });
    });

    describe('POST /membership/purchase', () => {
      test('应该创建会员购买订单', async () => {
        const response = await request(app)
          .post('/membership/purchase')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            planId: 'monthly_premium',
            paymentMethod: 'wechat'
          });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
          success: true,
          data: {
            orderId: expect.any(String),
            paymentUrl: expect.any(String)
          }
        });
      });
    });
  });

  describe('错误处理', () => {
    test('应该正确处理无效的JSON', async () => {
      const response = await request(app)
        .post('/task/create')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
    });

    test('应该正确处理超大请求体', async () => {
      const largeData = {
        type: 'video_generate',
        inputImageUrl: 'https://test.com/input.jpg',
        params: {
          data: 'x'.repeat(1000000) // 1MB数据
        }
      };

      const response = await request(app)
        .post('/task/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send(largeData);

      // 应该能处理或返回适当的错误
      expect([200, 400, 413]).toContain(response.status);
    });

    test('应该包含CORS头', async () => {
      const response = await request(app)
        .options('/auth/login');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });
});