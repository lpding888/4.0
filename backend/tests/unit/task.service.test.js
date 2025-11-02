/**
 * 任务服务单元测试
 * 测试任务创建、状态更新、查询等功能
 */

const taskService = require('../../src/services/task.service');
const quotaService = require('../../src/services/quota.service');

describe('任务服务测试', () => {
  let testUser;

  beforeEach(async () => {
    testUser = await global.createTestUser({
      quota_remaining: 10,
      isMember: true
    });
  });

  describe('任务创建', () => {
    test('应该成功创建视频生成任务', async () => {
      const taskData = {
        type: 'video_generate',
        inputImageUrl: 'https://test.com/input.jpg',
        params: { duration: 10, quality: 'high' }
      };

      const result = await taskService.create(
        testUser.id,
        taskData.type,
        taskData.inputImageUrl,
        taskData.params
      );

      expect(result).toMatchObject({
        taskId: expect.any(String),
        type: 'video_generate',
        status: 'pending',
        createdAt: expect.any(String)
      });

      // 验证配额被正确扣减（视频生成默认扣减1次）
      const quota = await quotaService.getQuota(testUser.id);
      expect(quota.remaining).toBe(9);
    });

    test('应该支持基础修图任务', async () => {
      const taskData = {
        type: 'basic_clean',
        inputImageUrl: 'https://test.com/input.jpg',
        params: { brightness: 1.2 }
      };

      const result = await taskService.create(
        testUser.id,
        taskData.type,
        taskData.inputImageUrl,
        taskData.params
      );

      expect(result.type).toBe('basic_clean');
      expect(result.status).toBe('pending');
    });

    test('应该支持AI模特12分镜任务', async () => {
      const taskData = {
        type: 'model_pose12',
        inputImageUrl: 'https://test.com/input.jpg',
        params: { style: 'fashion' }
      };

      const result = await taskService.create(
        testUser.id,
        taskData.type,
        taskData.inputImageUrl,
        taskData.params
      );

      expect(result.type).toBe('model_pose12');
      expect(result.status).toBe('pending');
    });

    test('无效任务类型应该抛出错误', async () => {
      await expect(
        taskService.create(
          testUser.id,
          'invalid_type',
          'https://test.com/input.jpg',
          {}
        )
      ).rejects.toThrow('无效的任务类型');
    });

    test('非会员用户创建任务应该失败', async () => {
      const nonMemberUser = await global.createTestUser({
        isMember: false,
        quota_remaining: 10
      });

      await expect(
        taskService.create(
          nonMemberUser.id,
          'basic_clean',
          'https://test.com/input.jpg',
          {}
        )
      ).rejects.toThrow('请先购买会员');
    });

    test('配额不足时创建任务应该失败', async () => {
      const poorUser = await global.createTestUser({
        quota_remaining: 0,
        isMember: true
      });

      await expect(
        taskService.create(
          poorUser.id,
          'basic_clean',
          'https://test.com/input.jpg',
          {}
        )
      ).rejects.toThrow('配额不足,请续费');
    });
  });

  describe('任务查询', () => {
    let testTask;

    beforeEach(async () => {
      testTask = await global.createTestTask(testUser.id, {
        status: 'processing'
      });
    });

    test('应该正确返回任务详情', async () => {
      const result = await taskService.get(testTask.id, testUser.id);

      expect(result).toMatchObject({
        id: testTask.id,
        type: 'video_generate',
        status: 'processing',
        inputImageUrl: 'https://test.com/input.jpg',
        params: { duration: 10 },
        resultUrls: [],
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      });
    });

    test('应该正确解析JSON字段', async () => {
      const taskWithComplexParams = await global.createTestTask(testUser.id, {
        params: JSON.stringify({
          duration: 15,
          quality: 'ultra',
          effects: ['blur', 'fade']
        }),
        resultUrls: JSON.stringify([
          'https://test.com/result1.mp4',
          'https://test.com/result2.mp4'
        ])
      });

      const result = await taskService.get(taskWithComplexParams.id, testUser.id);

      expect(result.params).toEqual({
        duration: 15,
        quality: 'ultra',
        effects: ['blur', 'fade']
      });
      expect(result.resultUrls).toEqual([
        'https://test.com/result1.mp4',
        'https://test.com/result2.mp4'
      ]);
    });

    test('用户不能访问其他人的任务', async () => {
      const otherUser = await global.createTestUser({
        phone: '13900139000'
      });
      const otherTask = await global.createTestTask(otherUser.id);

      await expect(taskService.get(otherTask.id, testUser.id))
        .rejects.toThrow('无权访问该任务');
    });

    test('任务不存在应该抛出错误', async () => {
      await expect(taskService.get('nonexistent-task', testUser.id))
        .rejects.toThrow('任务不存在');
    });
  });

  describe('任务状态更新', () => {
    let testTask;

    beforeEach(async () => {
      testTask = await global.createTestTask(testUser.id);
    });

    test('应该成功更新任务状态为成功', async () => {
      const result = await taskService.updateStatus(testTask.id, 'success', {
        resultUrls: ['https://test.com/result.mp4']
      });

      expect(result).toBe(true);

      // 验证任务状态已更新
      const updatedTask = await taskService.get(testTask.id, testUser.id);
      expect(updatedTask.status).toBe('success');
      expect(updatedTask.resultUrls).toEqual(['https://test.com/result.mp4']);
      expect(updatedTask.completedAt).toBeDefined();
    });

    test('应该成功更新任务状态为失败', async () => {
      const result = await taskService.updateStatus(testTask.id, 'failed', {
        errorMessage: '处理失败：网络错误'
      });

      expect(result).toBe(true);

      // 验证任务状态已更新
      const updatedTask = await taskService.get(testTask.id, testUser.id);
      expect(updatedTask.status).toBe('failed');
      expect(updatedTask.errorMessage).toBe('处理失败：网络错误');
      expect(updatedTask.completedAt).toBeDefined();

      // 验证配额已返还
      const quota = await quotaService.getQuota(testUser.id);
      expect(quota.remaining).toBe(11); // 原来10个，创建任务扣1个，失败返还1个
    });

    test('任务失败时配额返还应该正确', async () => {
      // 记录任务创建前的配额
      const initialQuota = await quotaService.getQuota(testUser.id);
      const initialRemaining = initialQuota.remaining;

      // 创建任务（扣减配额）
      const task = await taskService.create(
        testUser.id,
        'basic_clean',
        'https://test.com/input.jpg',
        {}
      );

      // 任务创建后配额应该减少
      const afterCreateQuota = await quotaService.getQuota(testUser.id);
      expect(afterCreateQuota.remaining).toBe(initialRemaining - 1);

      // 标记任务失败（返还配额）
      await taskService.updateStatus(task.taskId, 'failed', {
        errorMessage: '测试失败'
      });

      // 配额应该被返还
      const finalQuota = await quotaService.getQuota(testUser.id);
      expect(finalQuota.remaining).toBe(initialRemaining);
    });

    test('应该支持更新任务状态为处理中', async () => {
      const result = await taskService.updateStatus(testTask.id, 'processing');

      expect(result).toBe(true);

      const updatedTask = await taskService.get(testTask.id, testUser.id);
      expect(updatedTask.status).toBe('processing');
      expect(updatedTask.completedAt).toBeUndefined(); // processing状态不应该有完成时间
    });
  });

  describe('任务列表查询', () => {
    beforeEach(async () => {
      // 创建多个测试任务
      await global.createTestTask(testUser.id, {
        id: 'task-1',
        status: 'success',
        created_at: new Date(Date.now() - 1000 * 60 * 5) // 5分钟前
      });

      await global.createTestTask(testUser.id, {
        id: 'task-2',
        status: 'processing',
        created_at: new Date(Date.now() - 1000 * 60 * 2) // 2分钟前
      });

      await global.createTestTask(testUser.id, {
        id: 'task-3',
        status: 'failed',
        created_at: new Date(Date.now() - 1000 * 60) // 1分钟前
      });
    });

    test('应该返回用户的所有任务', async () => {
      const result = await taskService.list(testUser.id);

      expect(result.tasks).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.limit).toBe(10); // 默认limit
      expect(result.offset).toBe(0); // 默认offset

      // 任务应该按创建时间倒序排列
      expect(result.tasks[0].id).toBe('task-3'); // 最新的
      expect(result.tasks[1].id).toBe('task-2');
      expect(result.tasks[2].id).toBe('task-1'); // 最旧的
    });

    test('应该支持按状态筛选', async () => {
      const result = await taskService.list(testUser.id, {
        status: 'success'
      });

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].status).toBe('success');
      expect(result.total).toBe(1);
    });

    test('应该支持按类型筛选', async () => {
      const otherUser = await global.createTestUser({
        phone: '13900139000'
      });
      await global.createTestTask(otherUser.id, {
        id: 'other-task',
        type: 'basic_clean'
      });

      const result = await taskService.list(testUser.id, {
        type: 'video_generate'
      });

      // 只有testUser的video_generate任务
      expect(result.tasks).toHaveLength(3);
      result.tasks.forEach(task => {
        expect(task.type).toBe('video_generate');
      });
    });

    test('应该支持分页', async () => {
      const result = await taskService.list(testUser.id, {
        limit: 2,
        offset: 0
      });

      expect(result.tasks).toHaveLength(2);
      expect(result.limit).toBe(2);
      expect(result.offset).toBe(0);

      const secondPage = await taskService.list(testUser.id, {
        limit: 2,
        offset: 2
      });

      expect(secondPage.tasks).toHaveLength(1);
      expect(secondPage.limit).toBe(2);
      expect(secondPage.offset).toBe(2);
    });
  });

  describe('工具方法', () => {
    test('getQuotaCost应该返回正确的配额消耗', () => {
      // 设置环境变量测试
      process.env.QUOTA_COST_VIDEO_GENERATE = '2';
      process.env.QUOTA_COST_BASIC_CLEAN = '1';

      expect(taskService.getQuotaCost('video_generate')).toBe(2);
      expect(taskService.getQuotaCost('basic_clean')).toBe(1);
      expect(taskService.getQuotaCost('model_pose12')).toBe(1); // 默认值
    });

    test('getTaskTypeLabel应该返回正确的中文名称', () => {
      expect(taskService.getTaskTypeLabel('basic_clean')).toBe('基础修图');
      expect(taskService.getTaskTypeLabel('model_pose12')).toBe('AI模特12分镜');
      expect(taskService.getTaskTypeLabel('video_generate')).toBe('服装视频生成');
      expect(taskService.getTaskTypeLabel('unknown_type')).toBe('unknown_type');
    });
  });
});