// Jest 测试环境配置
const { knex } = require('../src/config/database');

// 测试前设置
beforeAll(async () => {
  // 设置测试环境变量
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key';
  process.env.DB_HOST = 'localhost';
  process.env.DB_NAME = 'test_ai_photo';

  console.log('🧪 测试环境已初始化');
});

// 每个测试后清理数据库
afterEach(async () => {
  if (process.env.NODE_ENV === 'test') {
    // 清理测试数据，保持数据库干净
    const tables = ['tasks', 'orders', 'verification_codes', 'users'];

    for (const table of tables) {
      try {
        await knex(table).del();
      } catch (error) {
        console.warn(`清理表 ${table} 失败:`, error.message);
      }
    }
  }
});

// 所有测试结束后关闭数据库连接
afterAll(async () => {
  if (knex && typeof knex.destroy === "function") { await knex.destroy(); }
  console.log('🧪 测试环境已清理');
});

// 全局测试工具函数
global.createTestUser = async (overrides = {}) => {
  const defaultUser = {
    id: 'test-user-id',
    phone: '13800138000',
    isMember: true,
    quota_remaining: 10,
    quota_expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后过期
    created_at: new Date()
  };

  const user = { ...defaultUser, ...overrides };
  await knex('users').insert(user);
  return user;
};

global.createTestTask = async (userId, overrides = {}) => {
  const defaultTask = {
    id: 'test-task-id',
    userId,
    type: 'video_generate',
    status: 'pending',
    inputImageUrl: 'https://test.com/input.jpg',
    params: JSON.stringify({ duration: 10 }),
    created_at: new Date(),
    updated_at: new Date()
  };

  const task = { ...defaultTask, ...overrides };
  await knex('tasks').insert(task);
  return task;
};

global.generateTestJWT = (userId) => {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

// 禁用控制台输出以保持测试输出清洁
if (process.env.NODE_ENV === 'test') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}