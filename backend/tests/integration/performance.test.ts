/**
 * 性能测试 - 任务卡要求的！
 * 测试并发用户、响应时间、资源占用等
 */

import request from 'supertest';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { performance } from 'perf_hooks';
import jwt from 'jsonwebtoken';
import taskRoutes from '../../src/routes/task.routes.js';

declare const global: any;

function createTestApp(): Express {
  const app = express();
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

  app.use('/task', authenticateToken, taskRoutes);

  return app;
}

describe('性能测试', () => {
  let app: any;
  let testUsers: any[] = [];
  let authTokens: any[] = [];

  beforeAll(async () => {
    app = createTestApp();

    // 创建多个测试用户
    for (let i = 0; i < 10; i++) {
      const user = await global.createTestUser({
        phone: `138001380${20 + i}`,
        quota_remaining: 20,
        isMember: true
      });
      testUsers.push(user);
      authTokens.push(global.generateTestJWT(user.id));
    }
  });

  describe('API响应时间测试', () => {
    test('任务列表查询应该在200ms内完成', async () => {
      // 先创建一些任务数据
      for (let i = 0; i < 5; i++) {
        await global.createTestTask(testUsers[0].id, {
          id: `perf-task-${i}`,
          status: 'success'
        });
      }

      const startTime = performance.now();

      const response = await request(app)
        .get('/task/list')
        .set('Authorization', `Bearer ${authTokens[0]}`);

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(200); // 200ms以内
      console.log(`任务列表查询响应时间: ${responseTime.toFixed(2)}ms`);
    });

    test('任务详情查询应该在100ms内完成', async () => {
      const testTask = await global.createTestTask(testUsers[0].id);

      const startTime = performance.now();

      const response = await request(app)
        .get(`/task/${testTask.id}`)
        .set('Authorization', `Bearer ${authTokens[0]}`);

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(100); // 100ms以内
      console.log(`任务详情查询响应时间: ${responseTime.toFixed(2)}ms`);
    });

    test('任务创建应该在500ms内完成', async () => {
      const startTime = performance.now();

      const response = await request(app)
        .post('/task/create')
        .set('Authorization', `Bearer ${authTokens[0]}`)
        .send({
          type: 'basic_clean',
          inputImageUrl: 'https://test.com/perf-input.jpg',
          params: { quality: 'high' }
        });

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(500); // 500ms以内
      console.log(`任务创建响应时间: ${responseTime.toFixed(2)}ms`);
    });
  });

  describe('并发用户测试', () => {
    test('应该支持10个并发用户同时查询任务列表', async () => {
      const concurrentRequests = authTokens.map((token) =>
        request(app).get('/task/list').set('Authorization', `Bearer ${token}`)
      );

      const startTime = performance.now();

      const results = await Promise.allSettled(concurrentRequests);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // 统计成功和失败的请求
      const successful = results.filter((r) => r.status === 'fulfilled' && r.value.status === 200);
      const failed = results.filter((r) => r.status === 'rejected' || r.value.status >= 400);

      expect(successful.length).toBeGreaterThan(8); // 至少80%成功
      expect(failed.length).toBeLessThan(2); // 最多20%失败

      console.log(`并发测试结果:`);
      console.log(`- 总请求数: ${results.length}`);
      console.log(`- 成功: ${successful.length}`);
      console.log(`- 失败: ${failed.length}`);
      console.log(`- 总耗时: ${totalTime.toFixed(2)}ms`);
      console.log(`- 平均响应时间: ${(totalTime / results.length).toFixed(2)}ms`);
    }, 15000);

    test('应该支持5个并发用户同时创建任务', async () => {
      const createTasks = authTokens.slice(0, 5).map((token, index) =>
        request(app)
          .post('/task/create')
          .set('Authorization', `Bearer ${token}`)
          .send({
            type: 'basic_clean',
            inputImageUrl: `https://test.com/concurrent-${index}.jpg`,
            params: { quality: 'standard' }
          })
      );

      const startTime = performance.now();

      const results = await Promise.allSettled(createTasks);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      const successful = results.filter((r) => r.status === 'fulfilled' && r.value.status === 200);

      expect(successful.length).toBeGreaterThan(3); // 至少60%成功

      console.log(`并发任务创建结果:`);
      console.log(`- 成功创建: ${successful.length}`);
      console.log(`- 总耗时: ${totalTime.toFixed(2)}ms`);
    }, 20000);
  });

  describe('数据库查询性能测试', () => {
    test('大量任务数据查询性能', async () => {
      // 创建大量任务数据
      const userId = testUsers[1].id;
      const taskCount = 50;

      console.log(`创建 ${taskCount} 条测试任务数据...`);
      const createStartTime = performance.now();

      for (let i = 0; i < taskCount; i++) {
        await global.createTestTask(userId, {
          id: `bulk-task-${i}`,
          status: i % 3 === 0 ? 'success' : i % 3 === 1 ? 'processing' : 'failed',
          created_at: new Date(Date.now() - i * 1000 * 60) // 每个任务间隔1分钟
        });
      }

      const createEndTime = performance.now();
      console.log(`数据创建耗时: ${(createEndTime - createStartTime).toFixed(2)}ms`);

      // 测试分页查询性能
      const pageSizes = [10, 20, 50];

      for (const pageSize of pageSizes) {
        const queryStartTime = performance.now();

        const response = await request(app)
          .get(`/task/list?limit=${pageSize}`)
          .set('Authorization', `Bearer ${authTokens[1]}`);

        const queryEndTime = performance.now();
        const queryTime = queryEndTime - queryStartTime;

        expect(response.status).toBe(200);
        expect(response.body.data.tasks).toHaveLength(pageSize);

        console.log(`分页查询(每页${pageSize}条)耗时: ${queryTime.toFixed(2)}ms`);
        expect(queryTime).toBeLessThan(300); // 300ms以内
      }

      // 测试条件筛选查询性能
      const filterStartTime = performance.now();

      const filterResponse = await request(app)
        .get('/task/list?status=success&limit=20')
        .set('Authorization', `Bearer ${authTokens[1]}`);

      const filterEndTime = performance.now();
      const filterTime = filterEndTime - filterStartTime;

      expect(filterResponse.status).toBe(200);
      console.log(`条件筛选查询耗时: ${filterTime.toFixed(2)}ms`);
      expect(filterTime).toBeLessThan(200); // 200ms以内
    }, 30000);

    test('复杂查询性能测试', async () => {
      // 创建不同类型的任务
      const userId = testUsers[2].id;
      const taskTypes = ['basic_clean', 'model_pose12', 'video_generate'];

      for (let i = 0; i < 30; i++) {
        await global.createTestTask(userId, {
          id: `complex-task-${i}`,
          type: taskTypes[i % 3],
          status: ['success', 'processing', 'failed'][i % 3],
          params: JSON.stringify({
            complexity: 'high',
            steps: Array.from({ length: 10 }, (_, j) => `step-${j}`)
          })
        });
      }

      // 测试复杂查询
      const complexQueries = [
        'type=video_generate',
        'status=success',
        'type=video_generate&status=processing',
        'limit=15&offset=5'
      ];

      for (const query of complexQueries) {
        const startTime = performance.now();

        const response = await request(app)
          .get(`/task/list?${query}`)
          .set('Authorization', `Bearer ${authTokens[2]}`);

        const endTime = performance.now();
        const queryTime = endTime - startTime;

        expect(response.status).toBe(200);
        console.log(`复杂查询(${query})耗时: ${queryTime.toFixed(2)}ms`);
        expect(queryTime).toBeLessThan(250); // 250ms以内
      }
    }, 20000);
  });

  describe('内存使用测试', () => {
    test('大量请求不应该造成内存泄漏', async () => {
      const initialMemory = process.memoryUsage();
      console.log('初始内存使用:', {
        rss: `${(initialMemory.rss / 1024 / 1024).toFixed(2)}MB`,
        heapUsed: `${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`
      });

      // 执行大量请求
      const requestCount = 100;
      const requests = Array.from({ length: requestCount }, (_, i) =>
        request(app)
          .get('/task/list')
          .set('Authorization', `Bearer ${authTokens[i % authTokens.length]}`)
      );

      // 分批执行以避免过载
      const batchSize = 10;
      for (let i = 0; i < requests.length; i += batchSize) {
        const batch = requests.slice(i, i + batchSize);
        await Promise.allSettled(batch);

        // 强制垃圾回收（如果可用）
        if (global.gc) {
          global.gc();
        }
      }

      // 检查最终内存使用
      const finalMemory = process.memoryUsage();
      console.log('最终内存使用:', {
        rss: `${(finalMemory.rss / 1024 / 1024).toFixed(2)}MB`,
        heapUsed: `${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`
      });

      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      console.log(`内存增长: ${memoryIncreaseMB.toFixed(2)}MB`);

      // 内存增长不应该超过50MB
      expect(memoryIncreaseMB).toBeLessThan(50);
    }, 30000);
  });

  describe('配额操作并发性能测试', () => {
    test('并发配额扣减应该是安全的', async () => {
      const user = await global.createTestUser({
        phone: '13800138099',
        quota_remaining: 20,
        isMember: true
      });
      const token = global.generateTestJWT(user.id);

      // 创建并发任务请求
      const concurrentTasks = Array.from({ length: 15 }, (_, i) =>
        request(app)
          .post('/task/create')
          .set('Authorization', `Bearer ${token}`)
          .send({
            type: 'basic_clean',
            inputImageUrl: `https://test.com/concurrent-quota-${i}.jpg`
          })
      );

      const startTime = performance.now();

      const results = await Promise.allSettled(concurrentTasks);

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      const successful = results.filter((r) => r.status === 'fulfilled' && r.value.status === 200);

      console.log(`并发配额操作结果:`);
      console.log(`- 成功: ${successful.length}`);
      console.log(`- 总耗时: ${totalTime.toFixed(2)}ms`);
      console.log(`- 平均每次操作: ${(totalTime / results.length).toFixed(2)}ms`);

      // 验证配额没有被过度扣减
      const { knex } = require('../../src/config/database');
      const finalUser = await knex('users').where('id', user.id).first();
      expect(finalUser.quota_remaining).toBe(20 - successful.length);
      expect(finalUser.quota_remaining).toBeGreaterThanOrEqual(0); // 不能是负数
    }, 20000);
  });

  describe('错误处理性能测试', () => {
    test('错误响应应该快速返回', async () => {
      const errorScenarios = [
        // 无效token
        request(app).get('/task/list').set('Authorization', 'Bearer invalid'),
        // 任务不存在
        request(app).get('/task/nonexistent').set('Authorization', `Bearer ${authTokens[0]}`),
        // 无效请求体
        request(app).post('/task/create').set('Authorization', `Bearer ${authTokens[0]}`).send({})
      ];

      const responseTimes = [];

      for (const scenario of errorScenarios) {
        const startTime = performance.now();
        const response = await scenario;
        const endTime = performance.now();
        const responseTime = endTime - startTime;

        responseTimes.push(responseTime);
        expect([400, 401, 403, 404]).toContain(response.status);
        expect(responseTime).toBeLessThan(100); // 错误响应应该更快
      }

      const avgErrorTime = responseTimes.reduce((a, b) => a + b) / responseTimes.length;
      console.log(`平均错误响应时间: ${avgErrorTime.toFixed(2)}ms`);
      expect(avgErrorTime).toBeLessThan(50); // 平均应该在50ms以内
    });
  });
});
