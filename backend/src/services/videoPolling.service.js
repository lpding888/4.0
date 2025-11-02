const cron = require('node-cron');
const db = require('../config/database');
const videoGenerateService = require('./videoGenerate.service');
const taskService = require('./task.service');
const logger = require('../utils/logger');

/**
 * 视频任务轮询服务 - 定时检查KUAI任务状态
 */
class VideoPollingService {
  constructor() {
    this.isRunning = false;
    this.pollingTask = null;
  }

  /**
   * 启动定时轮询
   */
  start() {
    if (this.isRunning) {
      logger.warn('[VideoPollingService] 轮询服务已在运行');
      return;
    }

    logger.info('[VideoPollingService] 启动视频任务轮询服务');

    // 每5分钟执行一次轮询
    this.pollingTask = cron.schedule('*/5 * * * *', async () => {
      await this.pollVideoTasks();
    }, {
      scheduled: false
    });

    this.pollingTask.start();
    this.isRunning = true;

    logger.info('[VideoPollingService] 轮询服务启动成功，每5分钟执行一次');
  }

  /**
   * 停止定时轮询
   */
  stop() {
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

  /**
   * 轮询所有processing状态的视频任务
   */
  async pollVideoTasks() {
    try {
      logger.info('[VideoPollingService] 开始轮询视频任务');

      // 查询所有processing状态的视频生成任务
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

    } catch (error) {
      logger.error('[VideoPollingService] 轮询视频任务失败', {
        error: error.message
      });
    }
  }

  /**
   * 处理单个视频任务
   * @param {Object} task - 任务对象
   */
  async processVideoTask(task) {
    try {
      logger.info(`[VideoPollingService] 处理视频任务 taskId=${task.id} vendorTaskId=${task.vendorTaskId}`);

      // 检查任务是否超时（2小时）
      if (videoGenerateService.isTimeout(task.created_at)) {
        await this.handleTimeoutTask(task);
        return;
      }

      // 查询KUAI任务状态
      const statusResult = await videoGenerateService.pollVideoStatus(task.vendorTaskId);

      switch (statusResult.status) {
        case 'success':
          await this.handleSuccessTask(task, statusResult);
          break;

        case 'failed':
          await this.handleFailedTask(task, statusResult);
          break;

        case 'pending':
        case 'processing':
          // 继续等待
          logger.info(`[VideoPollingService] 任务仍在处理中 taskId=${task.id} status=${statusResult.status}`);
          break;

        default:
          logger.warn(`[VideoPollingService] 未知任务状态 taskId=${task.id} status=${statusResult.status}`);
      }

    } catch (error) {
      logger.error(`[VideoPollingService] 处理视频任务失败 taskId=${task.id}`, {
        error: error.message
      });

      // 如果轮询失败，不立即标记任务失败，让下次轮询继续尝试
    }
  }

  /**
   * 处理成功任务
   * @param {Object} task - 任务对象
   * @param {Object} statusResult - 状态查询结果
   */
  async handleSuccessTask(task, statusResult) {
    try {
      logger.info(`[VideoPollingService] 处理成功任务 taskId=${task.id} videoUrl=${statusResult.videoUrl}`);

      // TODO: 下载视频到COS并触发工作流
      // 这里需要实现COS下载逻辑
      const cosResult = await this.downloadVideoToCOS(task, statusResult.videoUrl);

      // 更新任务状态为成功
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

    } catch (error) {
      logger.error(`[VideoPollingService] 处理成功任务失败 taskId=${task.id}`, {
        error: error.message
      });

      // 如果下载失败，标记任务为失败并返还配额
      await this.handleFailedTask(task, {
        errorMessage: `视频下载失败: ${error.message}`
      });
    }
  }

  /**
   * 处理失败任务
   * @param {Object} task - 任务对象
   * @param {Object} statusResult - 状态查询结果
   */
  async handleFailedTask(task, statusResult) {
    try {
      const errorMessage = statusResult.errorMessage || '视频生成失败';

      logger.info(`[VideoPollingService] 处理失败任务 taskId=${task.id} error=${errorMessage}`);

      // 更新任务状态为失败
      await db('tasks')
        .where('id', task.id)
        .update({
          status: 'failed',
          errorReason: errorMessage,
          completedAt: new Date(),
          updated_at: new Date()
        });

      const refundAmount = taskService.getQuotaCost('video_generate');
      await taskService.refundQuota(task.userId, refundAmount, `视频任务失败返还:${task.id}`);

      logger.info(`[VideoPollingService] 失败任务处理完成 taskId=${task.id} 已返还配额`);

    } catch (error) {
      logger.error(`[VideoPollingService] 处理失败任务异常 taskId=${task.id}`, {
        error: error.message
      });
    }
  }

  /**
   * 处理超时任务
   * @param {Object} task - 任务对象
   */
  async handleTimeoutTask(task) {
    try {
      logger.info(`[VideoPollingService] 处理超时任务 taskId=${task.id}`);

      // 更新任务状态为失败
      await db('tasks')
        .where('id', task.id)
        .update({
          status: 'failed',
          errorReason: 'TIMEOUT',
          completedAt: new Date(),
          updated_at: new Date()
        });

      const refundAmount = taskService.getQuotaCost('video_generate');
      await taskService.refundQuota(task.userId, refundAmount, `视频任务超时返还:${task.id}`);

      logger.info(`[VideoPollingService] 超时任务处理完成 taskId=${task.id} 已返还配额`);

    } catch (error) {
      logger.error(`[VideoPollingService] 处理超时任务异常 taskId=${task.id}`, {
        error: error.message
      });
    }
  }

  /**
   * 下载视频到COS
   * @param {Object} task - 任务对象
   * @param {string} videoUrl - 视频URL
   * @returns {Promise<Object>} COS结果
   */
  async downloadVideoToCOS(task, videoUrl) {
    // TODO: 实现COS下载逻辑
    // 这里需要：
    // 1. 下载KUAI返回的视频文件
    // 2. 上传到COS input/{userId}/{taskId}/original.mp4
    // 3. 等待COS工作流自动处理
    // 4. 获取处理结果（720p, 480p, HLS, 封面, GIF）

    logger.info(`[VideoPollingService] 下载视频到COS taskId=${task.id} videoUrl=${videoUrl}`);

    // 临时返回模拟结果，实际需要实现COS下载
    const cosResult = {
      resultUrls: [
        `https://cdn.example.com/output/${task.userId}/${task.id}/720p.mp4`,
        `https://cdn.example.com/output/${task.userId}/${task.id}/480p.mp4`,
        `https://cdn.example.com/output/${task.userId}/${task.id}/playlist.m3u8`
      ],
      coverUrl: `https://cdn.example.com/output/${task.userId}/${task.id}/cover.jpg`,
      thumbnailUrl: `https://cdn.example.com/output/${task.userId}/${task.id}/preview.gif`
    };

    logger.info(`[VideoPollingService] COS下载完成 taskId=${task.id}`);

    return cosResult;
  }

  /**
   * 获取轮询服务状态
   * @returns {Object} 服务状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      pollingInterval: '5 minutes'
    };
  }
}

module.exports = new VideoPollingService();