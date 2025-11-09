import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database.js';
import logger from '../utils/logger.js';
import redisLock from './redis-lock.service.js'; // P0-004: Redis分布式锁

type UserQuotaRecord = {
  id: string;
  quota_remaining: number;
  isMember: boolean;
  quota_expireAt?: string | Date | null;
};

type QuotaTransactionPhase = 'reserved' | 'confirmed' | 'cancelled';

type QuotaTransactionRecord = {
  id: string;
  task_id: string;
  user_id: string;
  amount: number;
  phase: QuotaTransactionPhase;
  idempotent_done?: boolean;
  created_at: Date;
  updated_at: Date;
};

type QuotaInfo = {
  remaining: number;
  isMember: boolean;
  expireAt?: string | Date | null;
};

type QuotaTransactionStatus = {
  taskId: string;
  userId: string;
  amount: number;
  phase: QuotaTransactionPhase;
  createdAt: Date;
  updatedAt: Date;
};

class QuotaService {
  /**
   * 预留配额 - Saga第一步
   * P0-004关键优化: 使用Redis分布式锁防止并发超卖
   * 艹！多实例部署时,数据库行锁不够,必须加Redis锁！
   *
   * 三层并发防护:
   * 1. Redis分布式锁: 跨服务器实例的并发控制
   * 2. 数据库事务: 单服务器内的ACID保证
   * 3. 数据库行锁(forUpdate): 进程内的并发保护
   */
  async reserve(userId: string, taskId: string, amount = 1): Promise<void> {
    // P0-004: 使用Redis分布式锁包裹整个事务
    await redisLock.withLock(
      `quota:reserve:${userId}`, // 锁的key:按userId加锁
      async () => {
        await db.transaction(async (trx) => {
          logger.info(`开始预留配额: userId=${userId}, taskId=${taskId}, amount=${amount}`);

          const user = (await trx<UserQuotaRecord>('users')
            .where({ id: userId })
            .forUpdate() // 数据库行锁
            .first()) as UserQuotaRecord | undefined;

          if (!user) {
            throw { statusCode: 404, errorCode: 'USER_NOT_FOUND', message: '用户不存在' };
          }

          if (!user.isMember) {
            throw { statusCode: 403, errorCode: 'NOT_MEMBER', message: '请先购买会员' };
          }

          if (user.quota_remaining < amount) {
            throw {
              statusCode: 403,
              errorCode: 'QUOTA_INSUFFICIENT',
              message: '配额不足,请续费',
              details: { remaining: user.quota_remaining, requested: amount }
            };
          }

          await trx('users').where({ id: userId }).decrement('quota_remaining', amount);

          await trx<QuotaTransactionRecord>('quota_transactions').insert({
            id: uuidv4().replace(/-/g, ''),
            task_id: taskId,
            user_id: userId,
            amount,
            phase: 'reserved',
            idempotent_done: true,
            created_at: new Date(),
            updated_at: new Date()
          });

          const remaining = user.quota_remaining - amount;
          logger.info(
            `配额预留成功: userId=${userId}, taskId=${taskId}, amount=${amount}, remaining=${remaining}`
          );
        });
      },
      { ttl: 10, retry: 3, retryDelay: 100 } // Redis锁配置:10秒超时,重试3次
    );
  }

  /**
   * 确认扣减 - Saga第二步（成功路径）
   */
  async confirm(taskId: string): Promise<void> {
    logger.info(`开始确认配额扣减: taskId=${taskId}`);

    const record = (await db<QuotaTransactionRecord>('quota_transactions')
      .where({ task_id: taskId, phase: 'reserved' })
      .first()) as QuotaTransactionRecord | undefined;

    if (!record) {
      logger.warn(`配额确认跳过: 未找到reserved状态的记录, taskId=${taskId}`);
      return;
    }

    await db('quota_transactions').where({ task_id: taskId, phase: 'reserved' }).update({
      phase: 'confirmed',
      updated_at: new Date()
    });

    logger.info(
      `配额确认成功: taskId=${taskId}, userId=${record.user_id}, amount=${record.amount}`
    );
  }

  /**
   * 退还配额 - Saga第二步（失败路径）
   */
  async cancel(taskId: string): Promise<void> {
    logger.info(`开始退还配额: taskId=${taskId}`);

    await db.transaction(async (trx) => {
      const record = (await trx<QuotaTransactionRecord>('quota_transactions')
        .where({ task_id: taskId, phase: 'reserved' })
        .forUpdate()
        .first()) as QuotaTransactionRecord | undefined;

      if (!record) {
        logger.warn(`配额退还跳过: 未找到reserved状态的记录, taskId=${taskId}`);
        return;
      }

      await trx('users').where({ id: record.user_id }).increment('quota_remaining', record.amount);

      await trx('quota_transactions').where({ task_id: taskId, phase: 'reserved' }).update({
        phase: 'cancelled',
        updated_at: new Date()
      });

      const user = (await trx<UserQuotaRecord>('users').where({ id: record.user_id }).first()) as
        | UserQuotaRecord
        | undefined;

      const remaining = user?.quota_remaining ?? 0;
      logger.info(
        `配额退还成功: taskId=${taskId}, userId=${record.user_id}, amount=${record.amount}, remaining=${remaining}`
      );
    });
  }

  /**
   * 获取配额信息
   */
  async getQuota(userId: string): Promise<QuotaInfo> {
    const user = (await db<UserQuotaRecord>('users').where('id', userId).first()) as
      | UserQuotaRecord
      | undefined;

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
      expireAt: user.quota_expireAt ?? null
    };
  }

  /**
   * 检查配额是否足够
   */
  async checkQuota(userId: string, amount = 1): Promise<boolean> {
    const user = (await db<UserQuotaRecord>('users').where('id', userId).first()) as
      | UserQuotaRecord
      | undefined;

    if (!user || !user.isMember) {
      return false;
    }

    return user.quota_remaining >= amount;
  }

  /**
   * 获取事务状态 - 用于监控和调试
   */
  async getTransactionStatus(taskId: string): Promise<QuotaTransactionStatus | null> {
    const record = (await db<QuotaTransactionRecord>('quota_transactions')
      .where('task_id', taskId)
      .first()) as QuotaTransactionRecord | undefined;

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
   */
  async cleanupExpiredTransactions(hours = 24): Promise<number> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hours);

    const deleted = await db('quota_transactions')
      .where('created_at', '<', cutoffTime)
      .whereIn('phase', ['confirmed', 'cancelled'])
      .del();

    logger.info(`清理过期配额事务记录: 删除${deleted}条记录`);
    return deleted;
  }
}

const quotaService = new QuotaService();
export default quotaService;
