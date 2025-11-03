/**
 * 安全服务单元测试
 */

const securityService = require('../../src/services/security.service');

describe('SecurityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('应该允许在限制内的请求', async () => {
      const key = 'test-key';
      const config = {
        windowMs: 60000,
        maxRequests: 10
      };

      // 模拟Redis客户端
      const mockRedis = require('../../utils/redis');
      mockRedis.zremrangebyscore = jest.fn().mockResolvedValue(0);
      mockRedis.zcard = jest.fn().mockResolvedValue(2); // 当前有2个请求
      mockRedis.zadd = jest.fn().mockResolvedValue(1);
      mockRedis.expire = jest.fn().mockResolvedValue(1);
      mockRedis.ttl = jest.fn().mockResolvedValue(60);

      // 执行测试
      const result = await securityService.checkRateLimit(key, config);

      // 验证结果
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(10);
      expect(result.remaining).toBe(7); // 10 - 2 - 1
    });

    it('应该拒绝超过限制的请求', async () => {
      const key = 'test-key';
      const config = {
        windowMs: 60000,
        maxRequests: 5
      };

      // 模拟Redis客户端
      const mockRedis = require('../../utils/redis');
      mockRedis.zremrangebyscore = jest.fn().mockResolvedValue(0);
      mockRedis.zcard = jest.fn().mockResolvedValue(5); // 已达到限制
      mockRedis.ttl = jest.fn().mockResolvedValue(60);

      // 执行测试
      const result = await securityService.checkRateLimit(key, config);

      // 验证结果
      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(5);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
    });

    it('应该处理Redis错误', async () => {
      const key = 'test-key';
      const config = {
        windowMs: 60000,
        maxRequests: 10
      };

      // 模拟Redis错误
      const mockRedis = require('../../utils/redis');
      mockRedis.zremrangebyscore = jest.fn().mockRejectedValue(new Error('Redis error'));

      // 执行测试
      const result = await securityService.checkRateLimit(key, config);

      // 验证错误处理 - 应该允许请求通过
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(10);
    });
  });

  describe('resetRateLimit', () => {
    it('应该成功重置频率限制', async () => {
      const key = 'test-key';

      // 模拟Redis客户端
      const mockRedis = require('../../utils/redis');
      mockRedis.del = jest.fn().mockResolvedValue(1);

      // 执行测试
      const result = await securityService.resetRateLimit(key);

      // 验证结果
      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('rate_limit:test-key');
    });

    it('应该处理重置失败', async () => {
      const key = 'test-key';

      // 模拟Redis错误
      const mockRedis = require('../../utils/redis');
      mockRedis.del = jest.fn().mockRejectedValue(new Error('Redis error'));

      // 执行测试
      const result = await securityService.resetRateLimit(key);

      // 验证错误处理
      expect(result).toBe(false);
    });
  });

  describe('maskData', () => {
    it('应该正确脱敏邮箱', () => {
      const data = {
        email: 'user@example.com',
        name: 'John Doe'
      };
      const rules = [
        { field: 'email', type: 'email' }
      ];

      const result = securityService.maskData(data, rules);

      expect(result.email).toMatch(/^\w{2}\*+@\w+\.com$/);
      expect(result.name).toBe('John Doe');
    });

    it('应该正确脱敏手机号', () => {
      const data = {
        phone: '13812345678',
        email: 'test@example.com'
      };
      const rules = [
        { field: 'phone', type: 'phone' }
      ];

      const result = securityService.maskData(data, rules);

      expect(result.phone).toBe('138****5678');
      expect(result.email).toBe('test@example.com');
    });

    it('应该正确脱敏身份证', () => {
      const data = {
        idCard: '123456789012345678',
        name: 'John Doe'
      };
      const rules = [
        { field: 'idCard', type: 'id_card' }
      ];

      const result = securityService.maskData(data, rules);

      expect(result.idCard).toBe('1234****5678');
      expect(result.name).toBe('John Doe');
    });

    it('应该正确脱敏银行卡', () => {
      const data = {
        bankCard: '6222021234567890123',
        name: 'John Doe'
      };
      const rules = [
        { field: 'bankCard', type: 'bank_card' }
      ];

      const result = securityService.maskData(data, rules);

      expect(result.bankCard).toBe('6222****0123');
      expect(result.name).toBe('John Doe');
    });

    it('应该正确脱敏密码', () => {
      const data = {
        password: 'mypassword123',
        username: 'john'
      };
      const rules = [
        { field: 'password', type: 'password' }
      ];

      const result = securityService.maskData(data, rules);

      expect(result.password).toBe('********************');
      expect(result.username).toBe('john');
    });

    it('应该正确脱敏Token', () => {
      const data = {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        userId: '123'
      };
      const rules = [
        { field: 'token', type: 'token' }
      ];

      const result = securityService.maskData(data, rules);

      expect(result.token).toMatch(/^....\*+....$/);
      expect(result.userId).toBe('123');
    });

    it('应该处理嵌套对象', () => {
      const data = {
        user: {
          email: 'user@example.com',
          profile: {
            phone: '13812345678'
          }
        },
        sessionId: 'abc123'
      };
      const rules = [
        { field: 'email', type: 'email' },
        { field: 'phone', type: 'phone' }
      ];

      const result = securityService.maskData(data, rules);

      expect(result.user.email).toMatch(/^\w{2}\*+@\w+\.com$/);
      expect(result.user.profile.phone).toBe('138****5678');
      expect(result.sessionId).toBe('abc123');
    });

    it('应该处理数组数据', () => {
      const data = [
        { email: 'user1@example.com', name: 'User 1' },
        { email: 'user2@example.com', name: 'User 2' }
      ];
      const rules = [
        { field: 'email', type: 'email' }
      ];

      const result = securityService.maskData(data, rules);

      expect(result[0].email).toMatch(/^\w{2}\*+@\w+\.com$/);
      expect(result[0].name).toBe('User 1');
      expect(result[1].email).toMatch(/^\w{2}\*+@\w+\.com$/);
      expect(result[1].name).toBe('User 2');
    });
  });

  describe('performHealthChecks', () => {
    it('应该执行完整的健康检查', async () => {
      // 模拟数据库检查
      const mockKnex = require('../../db/connection').knex;
      mockKnex.raw = jest.fn().mockResolvedValue([{ 1: 1 }]);

      // 模拟Redis检查
      const mockRedis = require('../../utils/redis');
      mockRedis.ping = jest.fn().mockResolvedValue('PONG');

      // 模拟系统信息
      jest.mock('os', () => ({
        totalmem: jest.fn().mockReturnValue(8000000000),
        freemem: jest.fn().mockReturnValue(4000000000)
      }));

      // 执行测试
      const result = await securityService.performHealthChecks();

      // 验证结果
      expect(result.overall).toBeDefined();
      expect(result.checks).toHaveLength(5); // database, redis, memory, disk, external_services
      expect(result.checks[0].name).toBe('database');
      expect(result.checks[1].name).toBe('redis');
      expect(result.checks[2].name).toBe('memory');
      expect(result.checks[3].name).toBe('disk');
      expect(result.checks[4].name).toBe('external_services');

      // 恢复原始模块
      require('os') = originalOS;
    });

    it('应该处理健康检查失败', async () => {
      // 模拟数据库错误
      const mockKnex = require('../../db/connection').knex;
      mockKnex.raw = jest.fn().mockRejectedValue(new Error('Database error'));

      // 模拟Redis错误
      const mockRedis = require('../../utils/redis');
      mockRedis.ping = jest.fn().mockRejectedValue(new Error('Redis error'));

      // 执行测试
      const result = await securityService.performHealthChecks();

      // 验证错误处理
      expect(result.overall).toBe('unhealthy');
      expect(result.checks.some(check => check.status === 'unhealthy')).toBe(true);
    });
  });

  describe('logSecurityEvent', () => {
    it('应该记录安全事件到Redis', async () => {
      const event = {
        type: 'rate_limit',
        severity: 'medium',
        ip: '127.0.0.1',
        endpoint: '/api/test',
        method: 'GET',
        details: { reason: 'Too many requests' }
      };

      // 模拟Redis客户端
      const mockRedis = require('../../utils/redis');
      mockRedis.setex = jest.fn().mockResolvedValue('OK');

      // 执行测试
      await securityService.logSecurityEvent(event);

      // 验证Redis调用
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('应该将高严重级别事件记录到数据库', async () => {
      const event = {
        type: 'suspicious_activity',
        severity: 'high',
        ip: '127.0.0.1',
        endpoint: '/api/admin',
        method: 'POST',
        details: { suspicious: true }
      };

      // 模拟Redis客户端
      const mockRedis = require('../../utils/redis');
      mockRedis.setex = jest.fn().mockResolvedValue('OK');

      // 模拟数据库插入
      const mockKnex = require('../../db/connection').knex;
      mockKnex.insert = jest.fn().mockResolvedValue();

      // 执行测试
      await securityService.logSecurityEvent(event);

      // 验证数据库调用
      expect(mockKnex.insert).toHaveBeenCalled();
    });
  });

  describe('detectSuspiciousActivity', () => {
    it('应该检测到可疑活动', async () => {
      const ip = '192.168.1.100';
      const timeWindowMs = 300000;

      // 模拟Redis查询返回大量活动记录
      const mockRedis = require('../../utils/redis');
      mockRedis.zrangebyscore = jest.fn().mockResolvedValue([
        'activity1',
        'activity2',
        // ... 模拟1000个活动
        ...Array(998).fill('activity')
      ]);

      // 执行测试
      const result = await securityService.detectSuspiciousActivity(ip, timeWindowMs);

      // 验证结果
      expect(result.suspicious).toBe(true);
      expect(result.riskScore).toBeGreaterThan(50);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('应该检测正常活动', async () => {
      const ip = '192.168.1.100';
      const timeWindowMs = 300000;

      // 模拟Redis查询返回少量活动记录
      const mockRedis = require('../../utils/redis');
      mockRedis.zrangebyscore = jest.fn().mockResolvedValue([
        'activity1',
        'activity2',
        'activity3'
      ]);

      // 执行测试
      const result = await securityService.detectSuspiciousActivity(ip, timeWindowMs);

      // 验证结果
      expect(result.suspicious).toBe(false);
      expect(result.riskScore).toBeLessThan(50);
      expect(result.reasons).toHaveLength(0);
    });

    it('应该处理检测错误', async () => {
      const ip = '192.168.1.100';
      const timeWindowMs = 300000;

      // 模拟Redis错误
      const mockRedis = require('../../utils/redis');
      mockRedis.zrangebyscore = jest.fn().mockRejectedValue(new Error('Redis error'));

      // 执行测试
      const result = await securityService.detectSuspiciousActivity(ip, timeWindowMs);

      // 验证错误处理
      expect(result.suspicious).toBe(false);
      expect(result.riskScore).toBe(0);
    });
  });

  describe('getSecurityStats', () => {
    it('应该返回安全统计信息', async () => {
      // 模拟各个统计数据
      jest.spyOn(securityService, 'getAuditStats').mockResolvedValue({
        byType: { 'rate_limit': 10, 'auth_attempt': 5 },
        bySeverity: { 'medium': 8, 'high': 2 },
        last24h: 15
      });

      jest.spyOn(securityService, 'getRateLimitStats').mockResolvedValue({
        activeLimits: 5,
        blockedRequests: 25,
        topBlockedIPs: ['192.168.1.1', '192.168.1.2']
      });

      jest.spyOn(securityService, 'getHealthStats').mockResolvedValue({
        overall: 'healthy',
        checks: {
          database: 'healthy',
          redis: 'healthy',
          memory: 'warning'
        }
      });

      // 执行测试
      const result = await securityService.getSecurityStats();

      // 验证结果
      expect(result.audit).toBeDefined();
      expect(result.rateLimit).toBeDefined();
      expect(result.health).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });
  });
});