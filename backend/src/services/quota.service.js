const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * 配额管理服务
 * 
 * 关键约束: NON-NEGATIVE GUARANTEE
 * 配额扣减必须使用事务+行锁,确保quota_remaining不会变成负数
 */
class QuotaService {
  /**
   * 扣减配额(事务级,带行锁)
   * @param {string} userId - 用户ID
   * @param {number} amount - 扣减数量(默认1)
   * @returns {Promise<{remaining: number}>}
   */
  async deduct(userId, amount = 1, trx = null) {
    const execute = async (transaction) => {
      const user = await transaction('users')
        .where('id', userId)
        .forUpdate()
        .first();

      if (!user) {
        throw { statusCode: 404, errorCode: 1004, message: '用户不存在' };
      }

      if (!user.isMember) {
        throw { statusCode: 403, errorCode: 1002, message: '请先购买会员' };
      }

      if (user.quota_remaining < amount) {
        throw { statusCode: 403, errorCode: 1003, message: '配额不足,请续费' };
      }

      await transaction('users')
        .where('id', userId)
        .decrement('quota_remaining', amount);

      const remaining = user.quota_remaining - amount;
      logger.info(`配额扣减成功: userId=${userId}, amount=${amount}, remaining=${remaining}`);

      return { remaining };
    };

    if (trx) {
      return await execute(trx);
    } else {
      return await db.transaction(execute);
    }
  }

  /**
   * 返还配额(任务失败时)
   * 艹！必须检查eligible_for_refund和refunded，防止重复返还！
   *
   * @param {string} taskId - 任务ID（用于检查是否已返还）
   * @param {string} userId - 用户ID
   * @param {number} amount - 返还数量(默认1)
   * @param {string} reason - 返还原因
   * @returns {Promise<{remaining: number, refunded: boolean}>}
   */
  async refund(taskId, userId, amount = 1, reason = '') {
    return await db.transaction(async (trx) => {
      // 1. 检查任务是否有资格返还，并且没有返还过
      const task = await trx('tasks')
        .where('id', taskId)
        .forUpdate() // 🔥 行锁，防止并发重复返还
        .first();

      if (!task) {
        throw { errorCode: 4004, message: '任务不存在' };
      }

      // 2. 检查是否有资格返还
      if (!task.eligible_for_refund) {
        logger.warn(`配额返还失败: 任务无资格返还 taskId=${taskId}`);
        return { remaining: 0, refunded: false };
      }

      // 3. 检查是否已经返还过（防止重复返还）
      if (task.refunded) {
        logger.warn(`配额返还失败: 任务已返还过配额 taskId=${taskId}`);
        return { remaining: 0, refunded: false };
      }

      // 4. 返还配额
      await trx('users')
        .where('id', userId)
        .increment('quota_remaining', amount);

      // 5. 标记任务为已返还
      await trx('tasks')
        .where('id', taskId)
        .update({
          refunded: true,
          refunded_at: new Date()
        });

      // 6. 获取返还后的配额
      const user = await trx('users')
        .where('id', userId)
        .first();

      logger.info(`配额返还成功: taskId=${taskId}, userId=${userId}, amount=${amount}, reason=${reason}, remaining=${user.quota_remaining}`);

      return { remaining: user.quota_remaining, refunded: true };
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
        errorCode: 1004,
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
}

module.exports = new QuotaService();
