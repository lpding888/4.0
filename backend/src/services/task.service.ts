import { db } from '../config/database.js';
import { nanoid } from 'nanoid';
import quotaService from './quota.service.js';
import videoGenerateService from './videoGenerate.service.js';
import featureService, {
  type FeatureDefinition as FeatureServiceDefinition
} from './feature.service.js';
import pipelineEngine from './pipelineEngine.service.js';
import { checkFeatureRateLimit } from '../middlewares/rateLimiter.middleware.js';
import logger from '../utils/logger.js';
import websocketService from './websocket.service.js';
import type {
  Task,
  TaskCreateResult,
  TaskDetailResponse,
  TaskListOptions,
  TaskListResponse,
  TaskUpdateData,
  TaskParams,
  TaskInputData,
  RateLimitResult,
  VideoGenerateResult,
  TaskWebSocketData,
  TaskError
} from '../types/task.types.js';

/**
 * 任务服务 - TypeScript 版本
 * 这个SB服务负责任务创建/查询/状态更新,别tm改业务语义!
 */
class TaskService {
  /**
   * 创建任务(旧三种类型)
   */
  async create(
    userId: string,
    type: string,
    inputImageUrl: string,
    params: TaskParams = {}
  ): Promise<TaskCreateResult> {
    let taskId: string | undefined;
    try {
      const validTypes = ['basic_clean', 'model_pose12', 'video_generate'];
      if (!validTypes.includes(type)) {
        throw { errorCode: 4001, message: '无效的任务类型' } as TaskError;
      }

      const quotaCost = this.getQuotaCost(type);

      const result = await db.transaction(async (trx) => {
        taskId = nanoid();
        // 预留配额以保持一致的补偿语义
        await quotaService.reserve(userId, taskId, quotaCost);
        const now = new Date();
        await trx('tasks').insert({
          id: taskId,
          userId,
          type,
          status: 'pending',
          inputUrl: inputImageUrl,
          params: JSON.stringify(params ?? {}),
          eligible_for_refund: true,
          refunded: false,
          created_at: now,
          updated_at: now
        });

        return {
          taskId,
          type,
          status: 'pending' as const,
          createdAt: now.toISOString()
        };
      });

      logger.info(
        `[TaskService] 任务创建成功 taskId=${taskId} userId=${userId} type=${type} quotaCost=${quotaCost}`
      );

      if (type === 'video_generate') {
        // 异步,不阻塞响应
        this.processVideoGenerateTask(taskId!, inputImageUrl, params).catch((err: Error) => {
          logger.error(`[TaskService] 视频任务异步处理失败: ${err.message}`, { taskId });
          this.handleVideoTaskFailure(taskId!, userId, err.message);
        });
      }

      return result;
    } catch (error) {
      const err = error as Error;
      logger.error(`[TaskService] 创建任务失败: ${err.message}`, { userId, type, error });
      throw error;
    }
  }

  /**
   * 基于功能卡片创建任务(新架构)
   */
  async createByFeature(
    userId: string,
    featureId: string,
    inputData: TaskInputData = {}
  ): Promise<TaskCreateResult> {
    let taskId: string | undefined;
    try {
      // 1) 获取功能定义
      const feature = (await db('feature_definitions')
        .where('feature_id', featureId)
        .whereNull('deleted_at')
        .first()) as FeatureServiceDefinition | undefined;

      if (!feature) throw { errorCode: 4004, message: '功能不存在' } as TaskError;
      if (!feature.is_enabled) throw { errorCode: 4003, message: '功能已禁用' } as TaskError;

      // 2) 权限校验
      const hasAccess = await featureService.checkUserAccess(userId, feature);
      if (!hasAccess) throw { errorCode: 4003, message: '无权使用该功能' } as TaskError;

      // 3) 限流校验
      const rateLimitResult = (await checkFeatureRateLimit(
        featureId,
        feature.rate_limit_policy,
        userId
      )) as RateLimitResult;
      if (!rateLimitResult.allowed) {
        throw {
          errorCode: 4029,
          message: '请求过于频繁,请稍后再试',
          rateLimitInfo: {
            resetAt: rateLimitResult.resetAt || '',
            remaining: rateLimitResult.remaining || 0
          }
        } as TaskError;
      }

      // 4) Saga 预留配额(先拿个taskId)
      taskId = nanoid();
      await quotaService.reserve(userId, taskId, feature.quota_cost);

      // 5) 创建任务记录(兼容旧字段)
      const now = new Date();
      await db('tasks').insert({
        id: taskId,
        userId,
        feature_id: featureId,
        status: 'pending',
        input_data: JSON.stringify(inputData ?? {}),
        eligible_for_refund: true,
        refunded: false,
        created_at: now,
        updated_at: now,
        // 兼容旧表结构
        type: featureId,
        inputUrl: inputData.imageUrl || '',
        params: null
      });

      const result: TaskCreateResult = {
        taskId,
        featureId,
        status: 'pending',
        createdAt: now.toISOString(),
        quotaCost: feature.quota_cost
      };

      logger.info(
        `[TaskService] Feature任务创建成功 taskId=${taskId} userId=${userId} featureId=${featureId} quotaCost=${feature.quota_cost}`
      );

      // 6) 异步执行 Pipeline(不阻塞响应)
      pipelineEngine.executePipeline(taskId!, featureId, inputData).catch((err: Error) => {
        logger.error(`[TaskService] Pipeline执行异常 taskId=${taskId} error=${err.message}`, {
          taskId,
          featureId,
          error: err
        });
      });

      return result;
    } catch (error) {
      const err = error as Error;
      logger.error(`[TaskService] 创建Feature任务失败: ${err.message}`, {
        userId,
        featureId,
        error
      });
      throw error;
    }
  }

  /**
   * 获取任务详情(按当前控制器用法,不校验 userId)
   */
  async get(taskId: string): Promise<TaskDetailResponse> {
    try {
      const task = (await db('tasks').where('id', taskId).first()) as Task | undefined;
      if (!task) throw { errorCode: 4004, message: '任务不存在' } as TaskError;

      const params: TaskParams = task.params ? JSON.parse(task.params) : {};
      const resultUrls: string[] = task.resultUrls ? JSON.parse(task.resultUrls) : [];

      // 艹!内部字段别暴露
      return {
        id: task.id,
        type: task.type,
        status: task.status,
        inputImageUrl: task.inputImageUrl,
        params,
        resultUrls,
        coverUrl: task.coverUrl,
        thumbnailUrl: task.thumbnailUrl,
        errorMessage: task.errorMessage,
        errorReason: task.errorReason,
        createdAt: task.created_at,
        updatedAt: task.updated_at,
        completedAt: task.completed_at
      };
    } catch (error) {
      const err = error as Error;
      logger.error(`[TaskService] 获取任务失败: ${err.message}`, { taskId, error });
      throw error;
    }
  }

  /**
   * 更新任务状态 (P1-011: 添加WebSocket推送)
   */
  async updateStatus(
    taskId: string,
    status: string,
    data: { resultUrls?: string[]; errorMessage?: string } = {}
  ): Promise<void> {
    try {
      const updateData: TaskUpdateData = {
        status: status as 'pending' | 'processing' | 'success' | 'failed',
        updated_at: new Date()
      };
      if (status === 'success' || status === 'failed') {
        updateData.completed_at = new Date();
      }
      if (data.resultUrls) updateData.resultUrls = JSON.stringify(data.resultUrls);
      if (data.errorMessage) updateData.errorMessage = data.errorMessage;

      await db('tasks').where('id', taskId).update(updateData);

      logger.info(`[TaskService] 任务状态更新 taskId=${taskId} status=${status}`);

      // P1-011: 获取任务详情用于WebSocket推送
      const task = (await db('tasks').where('id', taskId).first()) as Task | undefined;
      if (task) {
        // P1-011: 推送任务状态变更
        try {
          const taskData: TaskWebSocketData = {
            id: task.id,
            type: task.type,
            status: task.status,
            inputUrl: task.inputUrl,
            resultUrls: task.resultUrls ? JSON.parse(task.resultUrls) : null,
            errorMessage: task.errorMessage,
            createdAt: task.created_at,
            updatedAt: task.updated_at,
            completedAt: task.completed_at
          };

          // 推送WebSocket任务状态变更事件
          websocketService.pushTaskStatusChange(task.userId, taskId, status, taskData);
        } catch (wsError) {
          // WebSocket推送失败不影响主流程
          const err = wsError as Error;
          logger.warn(`[TaskService] WebSocket推送失败: ${err.message}`, { taskId });
        }
      }

      // 如果任务失败,取消配额预留(艹!使用cancel方法返还配额)
      if (status === 'failed' && task && task.eligible_for_refund && !task.refunded) {
        try {
          await quotaService.cancel(taskId);
          await db('tasks').where('id', taskId).update({ refunded: true });
          const refundAmount = this.getQuotaCost(task.type);
          logger.info(
            `[TaskService] 任务失败,配额已返还 taskId=${taskId} userId=${task.userId} amount=${refundAmount}`
          );
        } catch (cancelError) {
          const err = cancelError as Error;
          logger.error(`[TaskService] 配额返还失败: ${err.message}`, { taskId });
        }
      }
    } catch (error) {
      const err = error as Error;
      logger.error(`[TaskService] 更新任务状态失败: ${err.message}`, { taskId, status, error });
      throw error;
    }
  }

  /**
   * 获取任务列表
   */
  async list(userId: string, options: TaskListOptions = {}): Promise<TaskListResponse> {
    try {
      const { limit = 10, offset = 0, status = null, type = null } = options ?? {};
      let query = db('tasks').where('userId', userId).orderBy('created_at', 'desc');
      if (status) query = query.where('status', status);
      if (type) query = query.where('type', type);

      const tasks = (await query.limit(Number(limit)).offset(Number(offset))) as Task[];

      let countQuery = db('tasks').where('userId', userId);
      if (status) countQuery = countQuery.where('status', status);
      if (type) countQuery = countQuery.where('type', type);
      const countResult = (await countQuery.count('* as count')) as Array<{ count: number }>;
      const count = countResult[0].count;

      const formatted: TaskDetailResponse[] = tasks.map((task) => ({
        id: task.id,
        type: task.type,
        status: task.status,
        inputImageUrl: task.inputImageUrl,
        params: {},
        resultUrls: task.resultUrls ? JSON.parse(task.resultUrls) : [],
        createdAt: task.created_at,
        updatedAt: task.updated_at,
        completedAt: task.completed_at
      }));

      return {
        tasks: formatted,
        total: Number(count),
        limit: Number(limit),
        offset: Number(offset)
      };
    } catch (error) {
      const err = error as Error;
      logger.error(`[TaskService] 获取任务列表失败: ${err.message}`, { userId, error });
      throw error;
    }
  }

  /**
   * 异步:处理视频生成任务
   */
  async processVideoGenerateTask(
    taskId: string,
    inputImageUrl: string,
    params: TaskParams
  ): Promise<void> {
    try {
      logger.info(`[TaskService] 开始处理视频生成任务 taskId=${taskId}`);
      await this.updateStatus(taskId, 'processing', {});
      const videoResult = (await videoGenerateService.processVideoTask(
        taskId,
        inputImageUrl,
        params
      )) as VideoGenerateResult;
      await db('tasks')
        .where('id', taskId)
        .update({ vendorTaskId: videoResult.vendorTaskId, updated_at: new Date() });
      logger.info(
        `[TaskService] 视频生成任务处理完成 taskId=${taskId} vendorTaskId=${videoResult.vendorTaskId}`
      );
    } catch (error) {
      const err = error as Error;
      logger.error(`[TaskService] 视频生成任务处理失败 taskId=${taskId} error=${err.message}`);
      throw error;
    }
  }

  /**
   * 处理视频任务失败
   */
  async handleVideoTaskFailure(
    taskId: string,
    userId: string,
    errorMessage: string
  ): Promise<void> {
    try {
      await this.updateStatus(taskId, 'failed', { errorMessage });
      logger.info(`[TaskService] 视频任务失败处理完成 taskId=${taskId} userId=${userId}`);
    } catch (error) {
      const err = error as Error;
      logger.error(`[TaskService] 视频任务失败处理异常 taskId=${taskId} error=${err.message}`);
    }
  }

  /** 获取任务类型的配额消耗 */
  getQuotaCost(type: string): number {
    const key = `QUOTA_COST_${String(type).toUpperCase()}`;
    return Number.parseInt(process.env[key] || '1', 10);
  }

  /** 获取任务类型中文名(兼容旧逻辑) */
  getTaskTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      basic_clean: '基础修图',
      model_pose12: 'AI模特12分镜',
      video_generate: '服装视频生成'
    };
    return labels[type] || type;
  }

  /** 清理超时 pending 任务(10min) */
  async cleanupTimeoutTasks(): Promise<number> {
    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const timeoutTasks = (await db('tasks')
        .where('status', 'pending')
        .where('created_at', '<', tenMinutesAgo)) as Task[];
      for (const task of timeoutTasks) {
        await this.updateStatus(task.id, 'failed', { errorMessage: '任务超时(10分钟未处理)' });
      }
      if (timeoutTasks.length > 0) {
        logger.info(`[TaskService] 清理超时任务完成 count=${timeoutTasks.length}`);
      }
      return timeoutTasks.length;
    } catch (error) {
      const err = error as Error;
      logger.error(`[TaskService] 清理超时任务失败: ${err.message}`, error);
      throw error;
    }
  }

  /** 返还配额(保留旧接口) */
  async refundQuota(
    taskId: string,
    userId: string,
    amount: number,
    reason: string
  ): Promise<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await (quotaService as any).refund?.(taskId, userId, amount, reason);
  }
}

export default new TaskService();
