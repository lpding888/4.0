const db = require('../config/database');
const logger = require('../utils/logger');
const { v4: uuid } = require('uuid');

/**
 * Saga模式配额管理服务
 *
 * 实现三阶段事务补偿:
 * 1. reserve() - 预留配额
 * 2. confirm() - 确认扣减
 * 3. cancel() - 退还配额
 *
 * 关键特性:
 * - 使用Knex事务确保原子性
 * - 使用forUpdate()行级锁防止并发超卖
 * - 幂等性设计：同一任务的confirm/cancel只执行一次
 */
class QuotaService {
  /**
   * 预留配额 - Saga第一步
   * @param {string} userId - 用户ID
   * @param {string} taskId - 任务ID
   * @param {number} amount - 配额数量，默认1
   * @returns {Promise<void>}
   */
  async reserve(userId, taskId, amount = 1) {
    return await db.transaction(async (trx) => {
      logger.info(`开始预留配额: userId=${userId}, taskId=${taskId}, amount=${amount}`);

      // 1. 使用forUpdate锁定用户行，防止并发超卖
      const user = await trx('users')
        .where({ id: userId })
        .forUpdate() // 行级锁
        .first();

      // 2. 检查用户是否存在
      if (!user) {
        throw { statusCode: 404, errorCode: 'USER_NOT_FOUND', message: '用户不存在' };
      }

      // 3. 检查是否为会员
      if (!user.isMember) {
        throw { statusCode: 403, errorCode: 'NOT_MEMBER', message: '请先购买会员' };
      }

      // 4. 检查配额是否充足
      if (user.quota_remaining < amount) {
        throw {
          statusCode: 403,
          errorCode: 'QUOTA_INSUFFICIENT',
          message: '配额不足,请续费',
          details: { remaining: user.quota_remaining, requested: amount }
        };
      }

      // 5. 扣减配额
      await trx('users')
        .where({ id: userId })
        .decrement('quota_remaining', amount);

      // 6. 记录Reserved状态到quota_transactions表
      await trx('quota_transactions').insert({
        id: uuid().replace(/-/g, ''), // 移除连字符
        task_id: taskId,
        user_id: userId,
        amount,
        phase: 'reserved',
        idempotent_done: true,
        created_at: new Date(),
        updated_at: new Date()
      });

      const remaining = user.quota_remaining - amount;
      logger.info(`配额预留成功: userId=${userId}, taskId=${taskId}, amount=${amount}, remaining=${remaining}`);
    });
  }

  /**
   * 确认扣减 - Saga第二步（成功路径）
   * @param {string} taskId - 任务ID
   * @returns {Promise<void>}
   */
  async confirm(taskId) {
    logger.info(`开始确认配额扣减: taskId=${taskId}`);

    // 查找reserved状态的记录
    const record = await db('quota_transactions')
      .where({ task_id: taskId, phase: 'reserved' })
      .first();

    // 幂等性检查：如果记录不存在或已经不是reserved状态，直接返回
    if (!record) {
      logger.warn(`配额确认跳过: 未找到reserved状态的记录, taskId=${taskId}`);
      return;
    }

    // 更新状态为confirmed
    await db('quota_transactions')
      .where({ task_id: taskId, phase: 'reserved' })
      .update({
        phase: 'confirmed',
        updated_at: new Date()
      });

    logger.info(`配额确认成功: taskId=${taskId}, userId=${record.user_id}, amount=${record.amount}`);
  }

  /**
   * 退还配额 - Saga第二步（失败路径）
   * @param {string} taskId - 任务ID
   * @returns {Promise<void>}
   */
  async cancel(taskId) {
    logger.info(`开始退还配额: taskId=${taskId}`);

    return await db.transaction(async (trx) => {
      // 查找reserved状态的记录并加锁
      const record = await trx('quota_transactions')
        .where({ task_id: taskId, phase: 'reserved' })
        .forUpdate()
        .first();

      // 幂等性检查：如果记录不存在或已经不是reserved状态，直接返回
      if (!record) {
        logger.warn(`配额退还跳过: 未找到reserved状态的记录, taskId=${taskId}`);
        return;
      }

      // 退还配额给用户
      await trx('users')
        .where({ id: record.user_id })
        .increment('quota_remaining', record.amount);

      // 更新状态为cancelled
      await trx('quota_transactions')
        .where({ task_id: taskId, phase: 'reserved' })
        .update({
          phase: 'cancelled',
          updated_at: new Date()
        });

      // 获取退还后的配额余额用于日志
      const user = await trx('users')
        .where({ id: record.user_id })
        .first();

      logger.info(`配额退还成功: taskId=${taskId}, userId=${record.user_id}, amount=${record.amount}, remaining=${user.quota_remaining}`);
    });
  }

  /**
   * 获取配额信息
   * @param {string} userId - 用户ID
   * @returns {Promise<{remaining: number, isMember: boolean, expireAt: string}>}
   */
  async getQuota(userId) {
    const user = await db('users').where('id', userId).first();

    if (!user) {
      throw {
        statusCode: 404,
        errorCode: 'USER_NOT_FOUND',
        message: '用户不存在'
      };
    }

    return {
      remaining: user.quota_remaining,
      isMember: user.isMember,
      expireAt: user.quota_expireAt
    };
  }

  /**
   * 检查配额是否足够
   * @param {string} userId - 用户ID
   * @param {number} amount - 需要的数量
   * @returns {Promise<boolean>}
   */
  async checkQuota(userId, amount = 1) {
    const user = await db('users').where('id', userId).first();

    if (!user || !user.isMember) {
      return false;
    }

    return user.quota_remaining >= amount;
  }

  /**
   * 获取事务状态 - 用于监控和调试
   * @param {string} taskId - 任务ID
   * @returns {Promise<Object|null>}
   */
  async getTransactionStatus(taskId) {
    const record = await db('quota_transactions')
      .where('task_id', taskId)
      .first();

    if (!record) {
      return null;
    }

    return {
      taskId: record.task_id,
      userId: record.user_id,
      amount: record.amount,
      phase: record.phase,
      createdAt: record.created_at,
      updatedAt: record.updated_at
    };
  }

  /**
   * 清理过期的事务记录 - 定时任务调用
   * @param {number} hours - 清理多少小时前的记录，默认24小时
   * @returns {Promise<number>} 删除的记录数
   */
  async cleanupExpiredTransactions(hours = 24) {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hours);

    const result = await db('quota_transactions')
      .where('created_at', '<', cutoffTime)
      .whereIn('phase', ['confirmed', 'cancelled'])
      .del();

    logger.info(`清理过期配额事务记录: 删除${result}条记录`);
    return result;
  }
}

module.exports = new QuotaService();