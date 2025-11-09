import { jest } from '@jest/globals';

// ========================================
// 🔴 P0修复：Mock定时任务（防止Jest卡死）
// 艹！这些Mock必须在import任何src模块之前！
// ========================================
jest.mock('../src/services/announcementScheduler.service.js', () => ({
  startAnnouncementScheduler: jest.fn(() => {
    // 返回假的timeout ID，但不真的启动定时器
    return null;
  })
}));

jest.mock('../src/services/bannerScheduler.service.js', () => ({
  startBannerScheduler: jest.fn(() => {
    // 返回假的timeout ID，但不真的启动定时器
    return null;
  })
}));

jest.mock('../src/services/cronJobs.service.js', () => ({
  default: {
    startAll: jest.fn(),
    stopAll: jest.fn()
  }
}));

// ========================================
// 🔴 Mock Redis（防止真实连接）
// ========================================
jest.mock('../src/utils/redis.js', () => ({
  RedisManager: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    expire: jest.fn(),
    zadd: jest.fn(),
    zcard: jest.fn(),
    zremrangebyscore: jest.fn(),
    ttl: jest.fn(),
    // @ts-expect-error - Mock类型兼容性
    keys: jest.fn().mockResolvedValue([])
  })),
  default: {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    // @ts-expect-error - Mock类型兼容性
    keys: jest.fn().mockResolvedValue([])
  }
}));

// ========================================
// 🔴 Mock winston（Logger依赖它，必须Mock winston而不是logger）
// ========================================
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    add: jest.fn()
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn()
  },
  transports: {
    File: jest.fn(),
    Console: jest.fn()
  }
}));

// ========================================
// 🔴 P0修复：Mock 腾讯云SDK（防止contentAudit等服务初始化失败）
// 艹！contentAudit.service.ts构造函数会访问tencentcloud.ims
// ========================================
jest.mock('tencentcloud-sdk-nodejs', () => ({
  scf: {
    v20180416: {
      Client: jest.fn().mockImplementation(() => ({
        // @ts-expect-error - Mock类型兼容性
        Invoke: jest.fn().mockResolvedValue({
          Result: {
            RetMsg: JSON.stringify({ success: true })
          }
        })
      }))
    }
  },
  ims: {
    v20201229: {
      Client: jest.fn().mockImplementation(() => ({
        // @ts-expect-error - Mock类型兼容性
        ImageModeration: jest.fn().mockResolvedValue({
          Suggestion: 'Pass',
          Label: 'Normal'
        })
      }))
    },
    v20200307: {
      Client: jest.fn().mockImplementation(() => ({
        // @ts-expect-error - Mock类型兼容性
        ImageModeration: jest.fn().mockResolvedValue({
          Suggestion: 'Pass',
          Label: 'Normal'
        })
      }))
    }
  },
  common: {
    Credential: jest.fn().mockImplementation(() => ({})),
    ClientProfile: jest.fn().mockImplementation(() => ({})),
    HttpProfile: jest.fn().mockImplementation(() => ({}))
  }
}));

// ========================================
// 环境变量配置
// ========================================
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key';
process.env.REDIS_URL = 'redis://localhost:6379/1';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockKnex: any = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  whereIn: jest.fn().mockReturnThis(),
  whereNot: jest.fn().mockReturnThis(),
  whereRaw: jest.fn().mockReturnThis(),
  whereLike: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  orderByRaw: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  first: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  del: jest.fn().mockReturnThis(),
  count: jest.fn().mockReturnThis(),
  avg: jest.fn().mockReturnThis(),
  sum: jest.fn().mockReturnThis(),
  max: jest.fn().mockReturnThis(),
  min: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  having: jest.fn().mockReturnThis(),
  join: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  rightJoin: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  transaction: jest.fn().mockImplementation(() => Promise.resolve(null as any)), // 艹，用mockImplementation避免never类型！
  raw: jest.fn().mockReturnThis(),
  clearSelect: jest.fn().mockReturnThis()
};

// 艹！database.ts是`export const db = knex(config);`，所以Mock要返回{ db: mockKnex }
jest.mock('../src/config/database.js', () => ({ db: mockKnex }), { virtual: true });

afterEach(() => {
  jest.clearAllMocks();
});

// ========================================
// 🔴 P0修复：Global Test Helpers
// 艹！basic.test.ts需要这些helper函数！
// ========================================
declare global {
  function createMockUser(overrides?: any): any;
  function createMockFeature(overrides?: any): any;
  function randomString(length?: number): string;
}

/**
 * 创建Mock用户对象
 */
(global as any).createMockUser = (overrides: any = {}) => ({
  id: 'test-user-' + Math.random().toString(36).substring(7),
  phone: '13800138000',
  quota_remaining: 100,
  isMember: true,
  membership_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后过期
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides
});

/**
 * 创建Mock功能配置对象
 */
(global as any).createMockFeature = (overrides: any = {}) => ({
  id: 'test-feature-' + Math.random().toString(36).substring(7),
  feature_key: 'test_feature_' + Math.random().toString(36).substring(7),
  display_name: '测试功能',
  is_active: true,
  is_public: false,
  quota_cost: 1,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides
});

/**
 * 生成随机字符串
 */
(global as any).randomString = (length: number = 10): string => {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length);
};

export {};
