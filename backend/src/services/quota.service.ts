import { db } from '../db';
import { AppError, ErrorCode } from '../utils/errors';
import { v4 as uuid } from 'uuid';

export class QuotaService {
  // 预留配额
  async reserve(userId: string, taskId: string, amount = 1): Promise<void> {
    return db.transaction(async (trx) => {
      // 1. 使用forUpdate锁定用户行
      const user = await trx('users')
        .where({ id: userId })
        .forUpdate()
        .first();

      // 2. 检查配额
      if (!user || user.quota_remaining < amount) {
        throw new AppError(
          ErrorCode.QUOTA_INSUFFICIENT,
          '配额不足,请续费',
          403
        );
      }

      // 3. 扣减配额
      await trx('users')
        .where({ id: userId })
        .update({
          quota_remaining: user.quota_remaining - amount,
        });

      // 4. 记录Reserved状态
      await trx('quota_transactions').insert({
        id: uuid().replace(/-/g, ''),
        task_id: taskId,
        user_id: userId,
        amount,
        phase: 'reserved',
        idempotent_done: true,
      });
    });
  }

  // 确认扣减
  async confirm(taskId: string): Promise<void> {
    const record = await db('quota_transactions')
      .where({ task_id: taskId, phase: 'reserved' })
      .first();

    if (!record || record.idempotent_done !== true) {
      return; // 幂等性检查
    }

    await db('quota_transactions')
      .where({ task_id: taskId })
      .update({ phase: 'confirmed' });
  }

  // 退还配额
  async cancel(taskId: string): Promise<void> {
    return db.transaction(async (trx) => {
      const record = await trx('quota_transactions')
        .where({ task_id: taskId, phase: 'reserved' })
        .first();

      if (!record || record.phase !== 'reserved') {
        return; // 幂等性检查
      }

      // 退还配额
      await trx('users')
        .where({ id: record.user_id })
        .increment('quota_remaining', record.amount);

      // 更新状态
      await trx('quota_transactions')
        .where({ task_id: taskId })
        .update({ phase: 'cancelled' });
    });
  }
}

export const quotaService = new QuotaService();