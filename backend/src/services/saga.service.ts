/**
 * Saga分布式事务服务
 *
 * 实现Saga模式用于确保分布式事务的一致性
 * 支持预扣配额→确认|回滚的两阶段提交
 */

import { db as knex } from '../db/index.js';
const logger = require('../utils/logger');
const { EventEmitter } = require('events');

/**
 * Saga步骤执行结果类型
 */
export interface StepResult {
  [key: string]: unknown;
}

/**
 * Saga补偿数据类型
 */
export interface CompensationData {
  [key: string]: unknown;
}

/**
 * Saga步骤接口
 */
export interface SagaStep {
  id: string;
  name: string;
  execute: () => Promise<StepResult>;
  compensate: (data: CompensationData) => Promise<void>;
  timeout?: number;
}

/**
 * Saga事务接口
 */
export interface SagaTransaction {
  id: string;
  sagaId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'compensating';
  steps: SagaStep[];
  currentStep: number;
  data: Record<string, unknown>;
  startTime: Date;
  endTime?: Date;
  error?: Error;
}

/**
 * 统计数据行类型
 */
interface StatsRow {
  status: string;
  count: string | number;
}

export class SagaService extends EventEmitter {
  private activeSagas = new Map<string, SagaTransaction>();
  private sagaTimeout = 30000; // 30秒超时

  /**
   * 创建Saga事务
   */
  async createSaga(sagaId: string, steps: SagaStep[]): Promise<SagaTransaction> {
    const transaction: SagaTransaction = {
      id: this.generateId(),
      sagaId,
      status: 'pending',
      steps,
      currentStep: 0,
      data: {},
      startTime: new Date()
    };

    // 保存到数据库
    await this.saveSagaTransaction(transaction);
    this.activeSagas.set(transaction.id, transaction);

    logger.info('Saga事务已创建', {
      sagaId,
      transactionId: transaction.id,
      stepCount: steps.length
    });
    return transaction;
  }

  /**
   * 执行Saga事务
   */
  async executeSaga(transactionId: string): Promise<boolean> {
    const transaction = this.activeSagas.get(transactionId);
    if (!transaction) {
      throw new Error(`Saga事务不存在: ${transactionId}`);
    }

    try {
      transaction.status = 'running';
      await this.updateSagaTransaction(transaction);

      // 执行所有步骤
      for (let i = 0; i < transaction.steps.length; i++) {
        transaction.currentStep = i;
        const step = transaction.steps[i];

        logger.debug(`执行Saga步骤: ${step.name}`, { transactionId, stepId: step.id });

        // 设置步骤超时
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error(`步骤超时: ${step.name}`)),
            step.timeout || this.sagaTimeout
          );
        });

        // 执行步骤
        const stepPromise = step.execute();
        const result = await Promise.race([stepPromise, timeoutPromise]);

        // 保存步骤结果
        transaction.data[step.id] = result;
        await this.updateSagaTransaction(transaction);

        this.emit('stepCompleted', { transactionId, stepId: step.id, result });
      }

      // 所有步骤执行成功
      transaction.status = 'completed';
      transaction.endTime = new Date();
      await this.updateSagaTransaction(transaction);

      logger.info('Saga事务执行成功', { transactionId, sagaId: transaction.sagaId });
      this.emit('sagaCompleted', { transactionId, data: transaction.data });

      return true;
    } catch (error: unknown) {
      const err = error as Error;
      transaction.error = err;
      transaction.status = 'failed';
      await this.updateSagaTransaction(transaction);

      logger.error('Saga事务执行失败，开始补偿', { transactionId, error: err.message });

      // 执行补偿操作
      await this.compensate(transactionId);

      return false;
    }
  }

  /**
   * 补偿操作
   */
  private async compensate(transactionId: string): Promise<void> {
    const transaction = this.activeSagas.get(transactionId);
    if (!transaction) return;

    try {
      transaction.status = 'compensating';
      await this.updateSagaTransaction(transaction);

      // 逆序执行补偿操作
      for (let i = transaction.currentStep; i >= 0; i--) {
        const step = transaction.steps[i];
        const stepData = transaction.data[step.id];

        if (stepData && step.compensate) {
          logger.debug(`执行补偿操作: ${step.name}`, { transactionId, stepId: step.id });

          try {
            await step.compensate(stepData as CompensationData);
            this.emit('stepCompensated', { transactionId, stepId: step.id });
          } catch (compensateError: unknown) {
            const compensateErr = compensateError as Error;
            logger.error(`补偿操作失败: ${step.name}`, {
              transactionId,
              stepId: step.id,
              error: compensateErr.message
            });
            // 补偿失败不影响其他补偿操作
          }
        }
      }

      transaction.status = 'failed';
      transaction.endTime = new Date();
      await this.updateSagaTransaction(transaction);

      logger.info('Saga补偿完成', { transactionId });
      this.emit('sagaCompensated', { transactionId });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Saga补偿过程失败', { transactionId, error: err.message });
      throw err;
    }
  }

  /**
   * 预扣配额Saga
   */
  async reserveQuotaSaga(userId: string, featureId: string, quotaCost: number): Promise<boolean> {
    const steps: SagaStep[] = [
      {
        id: 'check_user',
        name: '检查用户状态',
        execute: async () => {
          const user = await knex('users').where('id', userId).first();
          if (!user) throw new Error('用户不存在');
          if (!user.is_member) throw new Error('用户非会员');
          return user;
        },
        compensate: async () => {
          // 检查步骤无需补偿
        }
      },
      {
        id: 'reserve_quota',
        name: '预扣配额',
        execute: async () => {
          const updated = await knex('users')
            .where('id', userId)
            .where('quota_remaining', '>=', quotaCost)
            .update({
              quota_remaining: knex.raw('quota_remaining - ?', [quotaCost]),
              quota_reserved: knex.raw('quota_reserved + ?', [quotaCost])
            });

          if (updated === 0) {
            throw new Error('配额不足');
          }

          return { quotaCost, reservedAt: new Date() };
        },
        compensate: async (data: CompensationData) => {
          const quotaCostValue = Number(data?.quotaCost ?? 0);
          if (!Number.isFinite(quotaCostValue) || quotaCostValue <= 0) {
            return;
          }
          // 回滚配额预扣
          await knex('users')
            .where('id', userId)
            .update({
              quota_remaining: knex.raw('quota_remaining + ?', [quotaCostValue]),
              quota_reserved: knex.raw('quota_reserved - ?', [quotaCostValue])
            });
        }
      },
      {
        id: 'create_task',
        name: '创建任务',
        execute: async () => {
          const taskId = this.generateId();
          await knex('tasks').insert({
            id: taskId,
            user_id: userId,
            feature_id: featureId,
            status: 'pending',
            quota_cost: quotaCost,
            created_at: new Date()
          });
          return { taskId };
        },
        compensate: async (data: CompensationData) => {
          const taskId = typeof data?.taskId === 'string' ? data.taskId : null;
          if (!taskId) return;
          // 删除创建的任务
          await knex('tasks').where('id', taskId).del();
        }
      }
    ];

    const transaction = await this.createSaga(`quota_reserve_${userId}_${Date.now()}`, steps);
    return await this.executeSaga(transaction.id);
  }

  /**
   * 确认配额扣减
   */
  async confirmQuotaDeduction(taskId: string): Promise<void> {
    const task = await knex('tasks').where('id', taskId).first();
    if (!task) throw new Error('任务不存在');

    await knex.transaction(async (trx) => {
      // 确认配额扣减
      await trx('users')
        .where('id', task.user_id)
        .update({
          quota_reserved: trx.raw('quota_reserved - ?', [task.quota_cost])
        });

      // 更新任务状态
      await trx('tasks').where('id', taskId).update({
        status: 'confirmed',
        updated_at: new Date()
      });
    });

    logger.info('配额扣减已确认', { taskId, userId: task.user_id, quotaCost: task.quota_cost });
  }

  /**
   * 保存Saga事务到数据库
   */
  private async saveSagaTransaction(transaction: SagaTransaction): Promise<void> {
    await knex('saga_transactions').insert({
      id: transaction.id,
      saga_id: transaction.sagaId,
      status: transaction.status,
      steps: JSON.stringify(transaction.steps),
      current_step: transaction.currentStep,
      data: JSON.stringify(transaction.data),
      start_time: transaction.startTime,
      created_at: new Date()
    });
  }

  /**
   * 更新Saga事务
   */
  private async updateSagaTransaction(transaction: SagaTransaction): Promise<void> {
    await knex('saga_transactions')
      .where('id', transaction.id)
      .update({
        status: transaction.status,
        current_step: transaction.currentStep,
        data: JSON.stringify(transaction.data),
        end_time: transaction.endTime,
        error_message: transaction.error?.message,
        updated_at: new Date()
      });
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `saga_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 清理过期的Saga事务
   */
  async cleanupExpiredTransactions(): Promise<void> {
    const expiredTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24小时前

    const deleted = await knex('saga_transactions')
      .where('start_time', '<', expiredTime)
      .whereIn('status', ['completed', 'failed'])
      .del();

    if (deleted > 0) {
      logger.info('清理过期Saga事务', { deleted });
    }
  }

  /**
   * 获取Saga统计信息
   */
  async getStats(): Promise<Record<string, number>> {
    const stats = (await knex('saga_transactions')
      .select('status')
      .count('* as count')
      .groupBy('status')) as StatsRow[];

    return stats.reduce((acc: Record<string, number>, row) => {
      acc[row.status] = Number(row.count ?? 0);
      return acc;
    }, {});
  }
}

// 单例实例
const sagaService = new SagaService();

// 定期清理过期事务
setInterval(
  () => {
    sagaService.cleanupExpiredTransactions().catch((error) => {
      logger.error('清理Saga事务失败:', error);
    });
  },
  60 * 60 * 1000
); // 每小时清理一次

module.exports = sagaService;
