/**
 * 配额服务单元测试 - 老王我重点关注的！
 * 测试配额扣减、返还的原子性和安全性
 */

const quotaService = require('../../src/services/quota.service');

describe('配额服务测试', () => {
  let testUser;

  beforeEach(async () => {
    testUser = await global.createTestUser({
      quota_remaining: 10,
      isMember: true
    });
  });

  describe('配额扣减', () => {
    test('会员用户有足够配额时应该成功扣减', async () => {
      const result = await quotaService.deduct(testUser.id, 3);

      expect(result.remaining).toBe(7);

      // 验证数据库中的配额确实被扣减
      const { knex } = require('../../src/config/database');
      const user = await knex('users').where('id', testUser.id).first();
      expect(user.quota_remaining).toBe(7);
    });

    test('非会员用户扣减配额应该抛出错误', async () => {
      const nonMemberUser = await global.createTestUser({
        isMember: false,
        quota_remaining: 10
      });

      await expect(quotaService.deduct(nonMemberUser.id, 1))
        .rejects.toThrow('请先购买会员');
    });

    test('配额不足时应该抛出错误', async () => {
      const poorUser = await global.createTestUser({
        quota_remaining: 1,
        isMember: true
      });

      await expect(quotaService.deduct(poorUser.id, 5))
        .rejects.toThrow('配额不足,请续费');
    });

    test('用户不存在时应该抛出错误', async () => {
      await expect(quotaService.deduct('nonexistent-user', 1))
        .rejects.toThrow('用户不存在');
    });

    test('配额不能变成负数（最重要的安全检查）', async () => {
      const poorUser = await global.createTestUser({
        quota_remaining: 2,
        isMember: true
      });

      // 尝试扣减比现有配额更多的数量
      await expect(quotaService.deduct(poorUser.id, 5))
        .rejects.toThrow('配额不足,请续费');

      // 验证配额没有被扣减
      const { knex } = require('../../src/config/database');
      const user = await knex('users').where('id', poorUser.id).first();
      expect(user.quota_remaining).toBe(2); // 应该还是原来的数量
    });
  });

  describe('配额返还', () => {
    test('任务失败时应该正确返还配额', async () => {
      // 先扣减配额
      await quotaService.deduct(testUser.id, 3);

      // 然后返还
      const result = await quotaService.refund(testUser.id, 3, '测试任务失败');

      expect(result.remaining).toBe(10); // 应该回到原来的数量

      // 验证数据库中的配额确实被返还
      const { knex } = require('../../src/config/database');
      const user = await knex('users').where('id', testUser.id).first();
      expect(user.quota_remaining).toBe(10);
    });

    test('用户不存在时返还应该抛出错误', async () => {
      await expect(quotaService.refund('nonexistent-user', 1))
        .rejects.toThrow();
    });

    test('返还配额应该在事务中执行', async () => {
      // 测试返还过程的原子性
      const { knex } = require('../../src/config/database');

      // 开始一个手动事务来模拟失败场景
      let transactionFailed = false;

      try {
        await knex.transaction(async (trx) => {
          // 先扣减配额
          await quotaService.deduct(testUser.id, 3, trx);

          // 模拟事务失败
          transactionFailed = true;
          throw new Error('模拟事务失败');
        });
      } catch (error) {
        // 事务应该失败
        expect(transactionFailed).toBe(true);
      }

      // 验证配额没有被扣减（事务回滚了）
      const user = await knex('users').where('id', testUser.id).first();
      expect(user.quota_remaining).toBe(10);
    });
  });

  describe('配额查询', () => {
    test('应该正确返回用户配额信息', async () => {
      const result = await quotaService.getQuota(testUser.id);

      expect(result).toEqual({
        remaining: 10,
        isMember: true,
        expireAt: expect.any(Date)
      });
    });

    test('用户不存在时应该抛出错误', async () => {
      await expect(quotaService.getQuota('nonexistent-user'))
        .rejects.toThrow('用户不存在');
    });
  });

  describe('配额检查', () => {
    test('会员有足够配额时应该返回true', async () => {
      const result = await quotaService.checkQuota(testUser.id, 5);
      expect(result).toBe(true);
    });

    test('非会员用户应该返回false', async () => {
      const nonMemberUser = await global.createTestUser({
        isMember: false,
        quota_remaining: 100
      });

      const result = await quotaService.checkQuota(nonMemberUser.id, 1);
      expect(result).toBe(false);
    });

    test('配额不足时应该返回false', async () => {
      const poorUser = await global.createTestUser({
        quota_remaining: 1,
        isMember: true
      });

      const result = await quotaService.checkQuota(poorUser.id, 5);
      expect(result).toBe(false);
    });

    test('用户不存在时应该返回false', async () => {
      const result = await quotaService.checkQuota('nonexistent-user', 1);
      expect(result).toBe(false);
    });
  });

  describe('并发安全测试', () => {
    test('并发扣减配额应该是安全的', async () => {
      const concurrentUser = await global.createTestUser({
        quota_remaining: 5,
        isMember: true
      });

      // 模拟5个并发请求，每个扣减1次配额
      const promises = Array.from({ length: 5 }, () =>
        quotaService.deduct(concurrentUser.id, 1)
      );

      // 等待所有请求完成
      const results = await Promise.allSettled(promises);

      // 应该有5个成功，0个失败（因为初始配额是5）
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful.length).toBe(5);
      expect(failed.length).toBe(0);

      // 验证最终配额为0
      const finalQuota = await quotaService.getQuota(concurrentUser.id);
      expect(finalQuota.remaining).toBe(0);
    });

    test('并发扣减超出配额应该安全失败', async () => {
      const poorUser = await global.createTestUser({
        quota_remaining: 2,
        isMember: true
      });

      // 模拟5个并发请求，但只有2次配额
      const promises = Array.from({ length: 5 }, () =>
        quotaService.deduct(poorUser.id, 1)
      );

      const results = await Promise.allSettled(promises);

      // 应该有2个成功，3个失败
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful.length).toBe(2);
      expect(failed.length).toBe(3);

      // 验证最终配额为0，不能是负数
      const finalQuota = await quotaService.getQuota(poorUser.id);
      expect(finalQuota.remaining).toBe(0);
    });
  });
});