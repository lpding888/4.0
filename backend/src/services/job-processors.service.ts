import logger from '../utils/logger.js';
import taskService from './task.service.js';
import imageProcessService from './imageProcess.service.js';
import aiModelService from './aiModel.service.js';
import pipelineEngine from './pipelineEngine.service.js';
import cacheService from './cache.service.js';
import { db } from '../config/database.js';

/**
 * Job 数据载体接口
 */
interface JobData extends Record<string, unknown> {
  taskId?: string;
  imageUrl?: string;
  params?: Record<string, unknown>;
  type?: string;
  modelType?: string;
  featureId?: string;
  inputData?: Record<string, unknown>;
  olderThanHours?: number;
}

/**
 * BullMQ Job 对象接口
 */
interface ProcessJob {
  data: JobData;
}

/**
 * 处理结果接口
 */
interface ProcessResult extends Record<string, unknown> {
  completed?: boolean;
  deleted?: number;
  resultUrls?: unknown;
}

/**
 * 错误接口
 */
interface ProcessError extends Error {
  message: string;
}

/**
 * Cache Service 接口
 */
interface AiModelEnhanceCapable {
  enhanceImage: (
    taskId: string,
    imageUrl?: string,
    params?: Record<string, unknown>
  ) => Promise<unknown>;
}

interface AiModelGenerateCapable {
  generateImage: (taskId: string, params?: Record<string, unknown>) => Promise<unknown>;
}

const hasEnhanceCapability = (service: unknown): service is AiModelEnhanceCapable =>
  typeof (service as AiModelEnhanceCapable)?.enhanceImage === 'function';

const hasGenerateCapability = (service: unknown): service is AiModelGenerateCapable =>
  typeof (service as AiModelGenerateCapable)?.generateImage === 'function';

/**
 * 任务处理器服务（TS 版）
 * 这个憨批模块负责把不同类型的任务分发到对应处理器，语义保持与旧 JS 一致。
 */
class JobProcessorsService {
  private processors = new Map<string, (job: ProcessJob) => Promise<ProcessResult>>();

  private async invalidateTaskCache(taskId?: string): Promise<void> {
    if (!taskId) return;
    try {
      await cacheService.deletePattern(`user_data:user:*:${taskId}*`);
    } catch (error: unknown) {
      logger.warn(`[JobProcessors] 缓存清理失败: ${taskId}`, error);
    }
  }

  /** 图像处理任务处理器 */
  async imageProcessingHandler(job: ProcessJob): Promise<ProcessResult> {
    const { taskId, imageUrl, params, type } = job.data ?? {};
    try {
      logger.info(`[JobProcessors] 开始图像处理任务: ${taskId}, 类型: ${type}`);
      await taskService.updateStatus(taskId as string, 'processing');

      let result: unknown;
      switch (type) {
        case 'basic_clean':
          result = await imageProcessService.processBasicClean(
            taskId as string,
            imageUrl as string,
            params
          );
          break;
        default:
          throw new Error(`不支持的图像处理类型: ${type}`);
      }

      await taskService.updateStatus(taskId as string, 'success', { resultUrls: result } as Record<
        string,
        unknown
      >);
      await this.invalidateTaskCache(taskId);
      logger.info(`[JobProcessors] 图像处理任务完成: ${taskId}`);
      return { resultUrls: result };
    } catch (error: unknown) {
      const err = error as ProcessError;
      logger.error(`[JobProcessors] 图像处理任务失败: ${taskId}`, error);
      await taskService.updateStatus(taskId as string, 'failed', {
        errorMessage: err.message
      } as Record<string, unknown>);
      throw error;
    }
  }

  /** AI 模型任务处理器 */
  async aiProcessingHandler(job: ProcessJob): Promise<ProcessResult> {
    const { taskId, imageUrl, params, modelType } = job.data ?? {};
    try {
      logger.info(`[JobProcessors] 开始AI处理任务: ${taskId}, 模型: ${modelType}`);
      await taskService.updateStatus(taskId as string, 'processing');

      let result: unknown;
      switch (modelType) {
        case 'model_pose12':
          result = await aiModelService.createModelTask(
            taskId as string,
            imageUrl as string,
            params as Record<string, unknown>
          );
          break;
        case 'ai_enhance':
          if (!hasEnhanceCapability(aiModelService)) {
            throw new Error('AI模型服务未实现增强功能');
          }
          result = await aiModelService.enhanceImage(taskId as string, imageUrl, params);
          break;
        case 'ai_generate':
          if (!hasGenerateCapability(aiModelService)) {
            throw new Error('AI模型服务未实现生成功能');
          }
          result = await aiModelService.generateImage(taskId as string, params);
          break;
        default:
          throw new Error(`不支持的AI模型类型: ${modelType}`);
      }

      await taskService.updateStatus(taskId as string, 'success', { resultUrls: result } as Record<
        string,
        unknown
      >);
      await this.invalidateTaskCache(taskId);
      logger.info(`[JobProcessors] AI处理任务完成: ${taskId}`);
      return { resultUrls: result };
    } catch (error: unknown) {
      const err = error as ProcessError;
      logger.error(`[JobProcessors] AI处理任务失败: ${taskId}`, error);
      await taskService.updateStatus(taskId as string, 'failed', {
        errorMessage: err.message
      } as Record<string, unknown>);
      throw error;
    }
  }

  /** Pipeline 流程任务处理器 */
  async pipelineProcessingHandler(job: ProcessJob): Promise<ProcessResult> {
    const { taskId, featureId, inputData } = job.data ?? {};
    try {
      logger.info(`[JobProcessors] 开始Pipeline任务: ${taskId} feature=${featureId}`);
      await taskService.updateStatus(taskId as string, 'processing');
      await pipelineEngine.executePipeline(
        taskId as string,
        featureId as string,
        inputData as Record<string, unknown>
      );
      await taskService.updateStatus(taskId as string, 'success', {} as Record<string, unknown>);
      await this.invalidateTaskCache(taskId);
      logger.info(`[JobProcessors] Pipeline任务完成: ${taskId}`);
      return { completed: true };
    } catch (error: unknown) {
      const err = error as ProcessError;
      logger.error(`[JobProcessors] Pipeline任务失败: ${taskId}`, error);
      await taskService.updateStatus(taskId as string, 'failed', {
        errorMessage: err.message
      } as Record<string, unknown>);
      throw error;
    }
  }

  /** 清理任务处理器（示例） */
  async cleanupHandler(job: ProcessJob): Promise<ProcessResult> {
    const { olderThanHours = 24 } = job.data ?? {};
    const cutoff = new Date(Date.now() - (olderThanHours as number) * 3600 * 1000);
    const deleted = await db('notifications')
      .where('created_at', '<', cutoff)
      .andWhere('read', true)
      .del();
    logger.info(`[JobProcessors] 清理完成，删除通知记录: ${deleted}`);
    return { deleted };
  }
}

export default new JobProcessorsService();
