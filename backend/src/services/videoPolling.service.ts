import cron from 'node-cron';
import { db } from '../config/database.js';
import videoGenerateService from './videoGenerate.service.js';
import taskService from './task.service.js';
import quotaService from './quota.service.js';
import logger from '../utils/logger.js';
import type { Task } from '../types/task.types.js';

type CronScheduledTask = ReturnType<typeof cron.schedule>;

type KuaiStatusResult = {
  vendorTaskId: string;
  status: string;
  videoUrl?: string;
  errorMessage?: string;
  statusUpdateTime?: string;
};

type COSUploadResult = {
  resultUrls: string[];
  coverUrl: string;
  thumbnailUrl: string;
};

class VideoPollingService {
  private isRunning = false;
  private pollingTask: CronScheduledTask | null = null;

  start(): void {
    if (this.isRunning) {
      logger.warn('[VideoPollingService] 轮询服务已在运行');
      return;
    }

    logger.info('[VideoPollingService] 启动视频任务轮询服务');
    this.pollingTask = cron.schedule('*/5 * * * *', async () => {
      await this.pollVideoTasks();
    });
    this.pollingTask.start?.();
    this.isRunning = true;
    logger.info('[VideoPollingService] 轮询服务启动成功，每5分钟执行一次');
  }

  stop(): void {
    if (!this.isRunning) {
      logger.warn('[VideoPollingService] 轮询服务未在运行');
      return;
    }
    if (this.pollingTask) {
      this.pollingTask.stop();
      this.pollingTask = null;
    }
    this.isRunning = false;
    logger.info('[VideoPollingService] 轮询服务已停止');
  }

  async pollVideoTasks(): Promise<void> {
    try {
      logger.info('[VideoPollingService] 开始轮询视频任务');
      const processingTasks = await db('tasks')
        .where('type', 'video_generate')
        .where('status', 'processing')
        .whereNotNull('vendorTaskId')
        .select('*');
      logger.info(`[VideoPollingService] 找到${processingTasks.length}个processing状态的视频任务`);
      for (const task of processingTasks) {
        await this.processVideoTask(task);
      }
      logger.info('[VideoPollingService] 视频任务轮询完成');
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[VideoPollingService] 轮询视频任务失败', { error: err.message });
    }
  }

  private async processVideoTask(task: Task): Promise<void> {
    try {
      logger.info(
        `[VideoPollingService] 处理视频任务 taskId=${task.id} vendorTaskId=${task.vendorTaskId}`
      );
      const createdAt =
        task.created_at instanceof Date ? task.created_at : new Date(task.created_at);
      if (videoGenerateService.isTimeout(createdAt)) {
        await this.handleTimeoutTask(task);
        return;
      }
      const vendorTaskId = task.vendorTaskId;
      if (!vendorTaskId) {
        logger.warn(`[VideoPollingService] 任务缺少第三方ID，标记为失败 taskId=${task.id}`);
        await this.handleFailedTask(task, {
          vendorTaskId: '',
          status: 'failed',
          errorMessage: '缺少第三方任务ID'
        });
        return;
      }
      const statusResult = await videoGenerateService.pollVideoStatus(vendorTaskId);
      switch (statusResult.status) {
        case 'success':
          await this.handleSuccessTask(task, statusResult);
          break;
        case 'failed':
          await this.handleFailedTask(task, statusResult);
          break;
        case 'pending':
        case 'processing':
          logger.info(
            `[VideoPollingService] 任务仍在处理中 taskId=${task.id} status=${statusResult.status}`
          );
          break;
        default:
          logger.warn(
            `[VideoPollingService] 未知任务状态 taskId=${task.id} status=${statusResult.status}`
          );
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[VideoPollingService] 处理视频任务失败 taskId=${task.id}`, {
        error: err.message
      });
    }
  }

  private async handleSuccessTask(task: Task, statusResult: KuaiStatusResult): Promise<void> {
    try {
      logger.info(
        `[VideoPollingService] 处理成功任务 taskId=${task.id} videoUrl=${statusResult.videoUrl}`
      );
      if (!statusResult.videoUrl) {
        throw new Error('视频地址不存在');
      }
      const cosResult = await this.downloadVideoToCOS(task, statusResult.videoUrl);
      await db('tasks')
        .where('id', task.id)
        .update({
          status: 'success',
          resultUrls: JSON.stringify(cosResult.resultUrls),
          coverUrl: cosResult.coverUrl,
          thumbnailUrl: cosResult.thumbnailUrl,
          completedAt: new Date(),
          updated_at: new Date()
        });
      logger.info(`[VideoPollingService] 任务成功处理完成 taskId=${task.id}`);
      await quotaService.confirm(task.id).catch(() => {});
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[VideoPollingService] 处理成功任务失败 taskId=${task.id}`, {
        error: err.message
      });
      await this.handleFailedTask(task, {
        vendorTaskId: task.vendorTaskId || '',
        status: 'failed',
        errorMessage: `视频下载失败: ${err.message}`
      });
    }
  }

  private async handleFailedTask(task: Task, statusResult: KuaiStatusResult): Promise<void> {
    try {
      const errorMessage = statusResult.errorMessage || '视频生成失败';
      logger.info(`[VideoPollingService] 处理失败任务 taskId=${task.id} error=${errorMessage}`);
      await db('tasks').where('id', task.id).update({
        status: 'failed',
        errorReason: errorMessage,
        completedAt: new Date(),
        updated_at: new Date()
      });
      await quotaService.cancel(task.id).catch(() => {});
      logger.info(`[VideoPollingService] 失败任务处理完成 taskId=${task.id} 已退还配额`);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[VideoPollingService] 处理失败任务异常 taskId=${task.id}`, {
        error: err.message
      });
    }
  }

  private async handleTimeoutTask(task: Task): Promise<void> {
    try {
      logger.info(`[VideoPollingService] 处理超时任务 taskId=${task.id}`);
      await db('tasks').where('id', task.id).update({
        status: 'failed',
        errorReason: 'TIMEOUT',
        completedAt: new Date(),
        updated_at: new Date()
      });
      await quotaService.cancel(task.id).catch(() => {});
      logger.info(`[VideoPollingService] 超时任务处理完成 taskId=${task.id} 已退还配额`);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`[VideoPollingService] 处理超时任务异常 taskId=${task.id}`, {
        error: err.message
      });
    }
  }

  private async downloadVideoToCOS(task: Task, videoUrl: string): Promise<COSUploadResult> {
    logger.info(`[VideoPollingService] 下载视频到COS taskId=${task.id} videoUrl=${videoUrl}`);
    // TODO: 实现COS下载逻辑；先返回模拟
    const result = {
      resultUrls: [
        `https://cdn.example.com/output/${task.userId}/${task.id}/720p.mp4`,
        `https://cdn.example.com/output/${task.userId}/${task.id}/480p.mp4`,
        `https://cdn.example.com/output/${task.userId}/${task.id}/playlist.m3u8`
      ],
      coverUrl: `https://cdn.example.com/output/${task.userId}/${task.id}/cover.jpg`,
      thumbnailUrl: `https://cdn.example.com/output/${task.userId}/${task.id}/preview.gif`
    };
    return result;
  }

  getStatus(): { isRunning: boolean; pollingInterval: string } {
    return { isRunning: this.isRunning, pollingInterval: '5 minutes' };
  }
}

export default new VideoPollingService();
