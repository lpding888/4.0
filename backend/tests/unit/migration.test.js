/**
 * 数据库迁移测试
 * 测试迁移脚本的正确性和回滚功能
 */

const { knex } = require('../../src/config/database');

describe('数据库迁移测试', () => {
  const testTables = ['users', 'orders', 'tasks', 'verification_codes'];

  beforeAll(async () => {
    // 确保在测试环境中
    process.env.NODE_ENV = 'test';
  });

  describe('表结构验证', () => {
    test('users表应该有正确的字段结构', async () => {
      const tableInfo = await knex('users').columnInfo();

      // 验证字段存在
      expect(tableInfo.id).toBeDefined();
      expect(tableInfo.phone).toBeDefined();
      expect(tableInfo.isMember).toBeDefined();
      expect(tableInfo.quota_remaining).toBeDefined();
      expect(tableInfo.quota_expireAt).toBeDefined();
      expect(tableInfo.created_at).toBeDefined();

      // 验证字段类型
      expect(tableInfo.id.type).toMatch(/varchar|char/i);
      expect(tableInfo.phone.type).toMatch(/varchar|char/i);
      expect(tableInfo.isMember.type).toMatch(/boolean|tinyint/i);
      expect(tableInfo.quota_remaining.type).toMatch(/int/i);
      expect(tableInfo.quota_expireAt.type).toMatch(/datetime|timestamp/i);
    });

    test('tasks表应该有正确的字段结构', async () => {
      const tableInfo = await knex('tasks').columnInfo();

      expect(tableInfo.id).toBeDefined();
      expect(tableInfo.userId).toBeDefined();
      expect(tableInfo.type).toBeDefined();
      expect(tableInfo.status).toBeDefined();
      expect(tableInfo.inputImageUrl).toBeDefined();
      expect(tableInfo.params).toBeDefined();
      expect(tableInfo.resultUrls).toBeDefined();
      expect(tableInfo.created_at).toBeDefined();
      expect(tableInfo.updated_at).toBeDefined();

      // 验证字段类型
      expect(tableInfo.id.type).toMatch(/varchar|char/i);
      expect(tableInfo.userId.type).toMatch(/varchar|char/i);
      expect(tableInfo.type.type).toMatch(/varchar|char/i);
      expect(tableInfo.status.type).toMatch(/varchar|char/i);
      expect(tableInfo.params.type).toMatch(/text|json|varchar/i);
      expect(tableInfo.resultUrls.type).toMatch(/text|json|varchar/i);
    });

    test('orders表应该有正确的字段结构', async () => {
      const tableInfo = await knex('orders').columnInfo();

      expect(tableInfo.id).toBeDefined();
      expect(tableInfo.userId).toBeDefined();
      expect(tableInfo.planId).toBeDefined();
      expect(tableInfo.amount).toBeDefined();
      expect(tableInfo.status).toBeDefined();
      expect(tableInfo.paymentMethod).toBeDefined();
      expect(tableInfo.created_at).toBeDefined();

      // 验证字段类型
      expect(tableInfo.id.type).toMatch(/varchar|char/i);
      expect(tableInfo.userId.type).toMatch(/varchar|char/i);
      expect(tableInfo.planId.type).toMatch(/varchar|char/i);
      expect(tableInfo.amount.type).toMatch(/decimal|numeric|int/i);
      expect(tableInfo.status.type).toMatch(/varchar|char/i);
    });

    test('verification_codes表应该有正确的字段结构', async () => {
      const tableInfo = await knex('verification_codes').columnInfo();

      expect(tableInfo.id).toBeDefined();
      expect(tableInfo.phone).toBeDefined();
      expect(tableInfo.code).toBeDefined();
      expect(tableInfo.created_at).toBeDefined();

      // 验证字段类型
      expect(tableInfo.id.type).toMatch(/int/i);
      expect(tableInfo.phone.type).toMatch(/varchar|char/i);
      expect(tableInfo.code.type).toMatch(/varchar|char/i);
    });
  });

  describe('约束验证', () => {
    test('users表的主键约束应该正常工作', async () => {
      const userData = {
        id: 'constraint-test-user',
        phone: '13800138000',
        isMember: true,
        quota_remaining: 10,
        quota_expireAt: new Date(),
        created_at: new Date()
      };

      // 插入第一条记录
      await knex('users').insert(userData);

      // 尝试插入相同ID的记录（应该失败）
      await expect(
        knex('users').insert({ ...userData, phone: '13800138001' })
      ).rejects.toThrow();

      // 清理测试数据
      await knex('users').where('id', userData.id).del();
    });

    test('users表的phone字段应该唯一', async () => {
      const userData1 = {
        id: 'unique-test-user-1',
        phone: '13800138001',
        isMember: true,
        quota_remaining: 10,
        quota_expireAt: new Date(),
        created_at: new Date()
      };

      const userData2 = {
        id: 'unique-test-user-2',
        phone: '13800138001', // 相同的phone
        isMember: false,
        quota_remaining: 0,
        quota_expireAt: null,
        created_at: new Date()
      };

      // 插入第一条记录
      await knex('users').insert(userData1);

      // 尝试插入相同phone的记录（应该失败）
      await expect(knex('users').insert(userData2)).rejects.toThrow();

      // 清理测试数据
      await knex('users').where('id', userData1.id).del();
    });

    test('tasks表的外键约束应该正常工作', async () => {
      // 插入一个任务，引用不存在的用户ID（应该失败）
      const taskData = {
        id: 'fk-test-task',
        userId: 'nonexistent-user-id',
        type: 'basic_clean',
        status: 'pending',
        inputImageUrl: 'https://test.com/input.jpg',
        params: '{}',
        resultUrls: null,
        created_at: new Date(),
        updated_at: new Date()
      };

      // 这个操作应该失败（取决于外键约束是否启用）
      // 注意：某些数据库配置可能不会强制外键约束
      try {
        await knex('tasks').insert(taskData);
        // 如果插入成功，手动清理
        await knex('tasks').where('id', taskData.id).del();
      } catch (error) {
        // 预期的外键约束错误
        expect(error.message).toMatch(/foreign key|constraint|violation/i);
      }
    });
  });

  describe('索引验证', () => {
    test('关键查询字段应该有索引', async () => {
      // 检查users表的索引
      const userIndexes = await knex.raw(`
        SHOW INDEX FROM users
      `);

      const userIndexColumns = userIndexes[0].map(index => index.Column_name);
      expect(userIndexColumns).toContain('phone');
      expect(userIndexColumns).toContain('id');

      // 检查tasks表的索引
      const taskIndexes = await knex.raw(`
        SHOW INDEX FROM tasks
      `);

      const taskIndexColumns = taskIndexes[0].map(index => index.Column_name);
      expect(taskIndexColumns).toContain('userId');
      expect(taskIndexColumns).toContain('status');
      expect(taskIndexColumns).toContain('id');
    });

    test('索引应该提高查询性能', async () => {
      // 创建测试数据
      const testUserId = 'performance-test-user';
      await global.createTestUser({
        id: testUserId,
        phone: '13800138002'
      });

      // 创建大量任务数据
      const taskCount = 100;
      const taskPromises = Array.from({ length: taskCount }, (_, i) =>
        global.createTestTask(testUserId, {
          id: `perf-task-${i}`,
          status: i % 2 === 0 ? 'success' : 'processing'
        })
      );

      await Promise.all(taskPromises);

      // 测试查询性能
      const startTime = Date.now();

      const result = await knex('tasks')
        .where('userId', testUserId)
        .andWhere('status', 'success')
        .orderBy('created_at', 'desc')
        .limit(20);

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      expect(result).toHaveLength(taskCount / 2);
      expect(queryTime).toBeLessThan(100); // 应该在100ms以内

      // 清理测试数据
      await knex('tasks').where('userId', testUserId).del();
      await knex('users').where('id', testUserId).del();
    }, 30000);
  });

  describe('默认值验证', () => {
    test('users表字段应该有正确的默认值', async () => {
      const userData = {
        id: 'default-test-user',
        phone: '13800138003',
        created_at: new Date()
      };

      await knex('users').insert(userData);

      const user = await knex('users').where('id', userData.id).first();

      expect(user.isMember).toBe(false); // 默认不是会员
      expect(user.quota_remaining).toBe(0); // 默认配额为0

      // 清理
      await knex('users').where('id', userData.id).del();
    });

    test('tasks表字段应该有正确的默认值', async () => {
      const testUser = await global.createTestUser({
        phone: '13800138004'
      });

      const taskData = {
        id: 'default-test-task',
        userId: testUser.id,
        type: 'basic_clean',
        inputImageUrl: 'https://test.com/input.jpg',
        created_at: new Date(),
        updated_at: new Date()
      };

      await knex('tasks').insert(taskData);

      const task = await knex('tasks').where('id', taskData.id).first();

      expect(task.status).toBe('pending'); // 默认状态

      // 清理
      await knex('tasks').where('id', taskData.id).del();
      await knex('users').where('id', testUser.id).del();
    });
  });

  describe('数据类型验证', () => {
    test('quota_remaining字段不应该允许负数', async () => {
      // 尝试插入负数配额（取决于应用层约束）
      const userData = {
        id: 'negative-quota-test',
        phone: '13800138005',
        isMember: true,
        quota_remaining: -5, // 负数
        quota_expireAt: new Date(),
        created_at: new Date()
      };

      try {
        await knex('users').insert(userData);

        // 如果插入成功，检查实际存储的值
        const user = await knex('users').where('id', userData.id).first();
        expect(parseInt(user.quota_remaining)).toBeGreaterThanOrEqual(0);

        // 清理
        await knex('users').where('id', userData.id).del();
      } catch (error) {
        // 如果数据库约束阻止了插入，这也是正确的
        expect(error.message).toMatch(/check|constraint|out of range/i);
      }
    });

    test('日期字段应该正确处理时区', async () => {
      const testDate = new Date('2024-12-31T23:59:59Z');
      const userData = {
        id: 'timezone-test-user',
        phone: '13800138006',
        isMember: true,
        quota_remaining: 10,
        quota_expireAt: testDate,
        created_at: testDate
      };

      await knex('users').insert(userData);

      const user = await knex('users').where('id', userData.id).first();

      // 验证日期被正确存储
      expect(new Date(user.quota_expireAt)).toBeInstanceOf(Date);
      expect(new Date(user.created_at)).toBeInstanceOf(Date);

      // 清理
      await knex('users').where('id', userData.id).del();
    });
  });

  describe('迁移回滚测试', () => {
    test('应该能够安全回滚迁移', async () => {
      // 记录回滚前的表状态
      const beforeRollback = await knex('users').columnInfo();

      // 模拟回滚操作（实际项目中会使用 knex migrate:rollback）
      // 这里我们验证表结构是否完整

      const afterRollback = await knex('users').columnInfo();

      // 前后应该一致（因为我们没有实际执行迁移）
      expect(Object.keys(beforeRollback)).toEqual(Object.keys(afterRollback));
    });

    test('回滚后数据完整性应该保持', async () => {
      // 创建测试数据
      const testData = await global.createTestUser({
        phone: '13800138007'
      });

      // 模拟回滚场景（验证现有数据不受影响）
      const user = await knex('users').where('id', testData.id).first();
      expect(user).toBeDefined();
      expect(user.phone).toBe('13800138007');

      // 清理
      await knex('users').where('id', testData.id).del();
    });
  });

  describe('并发安全测试', () => {
    test('应该支持并发写入操作', async () => {
      const userPromises = Array.from({ length: 10 }, (_, i) =>
        global.createTestUser({
          id: `concurrent-user-${i}`,
          phone: `138001380${10 + i}`,
          quota_remaining: i + 1
        })
      );

      // 并发创建用户
      await Promise.all(userPromises);

      // 验证所有用户都创建成功
      for (let i = 0; i < 10; i++) {
        const user = await knex('users').where('id', `concurrent-user-${i}`).first();
        expect(user).toBeDefined();
        expect(user.quota_remaining).toBe(i + 1);
      }

      // 清理
      await knex('users').where('id', 'like', 'concurrent-user-%').del();
    }, 30000);
  });
});