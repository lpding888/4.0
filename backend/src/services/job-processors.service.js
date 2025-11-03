const logger = require('../utils/logger');
const taskService = require('./task.service');
const imageProcessService = require('./imageProcess.service');
const aiModelService = require('./aiModel.service');
const pipelineEngine = require('./pipelineEngine.service');
const cacheService = require('./cache.service');
const db = require('../config/database');

/**
 * 任务处理器服务
 *
 * 提供各种类型任务的处理器，支持：
 * - 图像处理任务
 * - AI模型任务
 * - Pipeline流程任务
 * - 通知任务
 * - 清理任务
 */
class JobProcessorsService {
  constructor() {
    this.processors = new Map();
  }

  /**
   * 图像处理任务处理器
   * @param {Object} job - Bull任务对象
   * @returns {Promise<any>} 处理结果
   */
  async imageProcessingHandler(job) {
    const { taskId, imageUrl, params, type } = job.data;

    try {
      logger.info(`[JobProcessors] 开始图像处理任务: ${taskId}, 类型: ${type}`);

      // 更新任务状态为处理中
      await taskService.updateStatus(taskId, 'processing');

      let result;
      switch (type) {
        case 'basic_clean':
          result = await imageProcessService.processBasicClean(taskId, imageUrl, params);
          break;
        case 'enhance':
          result = await imageProcessService.processEnhance(taskId, imageUrl, params);
          break;
        case 'background_remove':
          result = await imageProcessService.processBackgroundRemove(taskId, imageUrl, params);
          break;
        default:
          throw new Error(`不支持的图像处理类型: ${type}`);
      }

      // 更新任务状态为成功
      await taskService.updateStatus(taskId, 'success', {
        resultUrls: result
      });

      // 清除相关缓存
      await cacheService.deletePattern(`user_data:user:*:${taskId}*`);

      logger.info(`[JobProcessors] 图像处理任务完成: ${taskId}`);
      return result;

    } catch (error) {
      logger.error(`[JobProcessors] 图像处理任务失败: ${taskId}`, error);

      // 更新任务状态为失败
      await taskService.updateStatus(taskId, 'failed', {
        errorMessage: error.message
      });

      throw error;
    }
  }

  /**
   * AI模型任务处理器
   * @param {Object} job - Bull任务对象
   * @returns {Promise<any>} 处理结果
   */
  async aiProcessingHandler(job) {
    const { taskId, imageUrl, params, modelType } = job.data;

    try {
      logger.info(`[JobProcessors] 开始AI处理任务: ${taskId}, 模型: ${modelType}`);

      // 更新任务状态为处理中
      await taskService.updateStatus(taskId, 'processing');

      let result;
      switch (modelType) {
        case 'model_pose12':
          result = await aiModelService.createModelTask(taskId, imageUrl, params);
          break;
        case 'ai_enhance':
          result = await aiModelService.enhanceImage(taskId, imageUrl, params);
          break;
        case 'ai_generate':
          result = await aiModelService.generateImage(taskId, params);
          break;
        default:
          throw new Error(`不支持的AI模型类型: ${modelType}`);
      }

      // 更新任务状态为成功
      await taskService.updateStatus(taskId, 'success', {
        resultUrls: result
      });

      // 清除相关缓存
      await cacheService.deletePattern(`user_data:user:*:${taskId}*`);

      logger.info(`[JobProcessors] AI处理任务完成: ${taskId}`);
      return result;

    } catch (error) {
      logger.error(`[JobProcessors] AI处理任务失败: ${taskId}`, error);

      // 更新任务状态为失败
      await taskService.updateStatus(taskId, 'failed', {
        errorMessage: error.message
      });

      throw error;
    }
  }

  /**
   * Pipeline流程任务处理器
   * @param {Object} job - Bull任务对象
   * @returns {Promise<any>} 处理结果
   */
  async pipelineProcessingHandler(job) {
    const { taskId, featureId, inputData } = job.data;

    try {
      logger.info(`[JobProcessors] 开始Pipeline任务: ${taskId}, 功能: ${featureId}`);

      // PipelineEngine会自动处理任务状态更新
      await pipelineEngine.executePipeline(taskId, featureId, inputData);

      // 清除相关缓存
      await cacheService.deletePattern(`user_data:user:*:${taskId}*`);

      logger.info(`[JobProcessors] Pipeline任务完成: ${taskId}`);
      return { success: true, taskId };

    } catch (error) {
      logger.error(`[JobProcessors] Pipeline任务失败: ${taskId}`, error);
      throw error;
    }
  }

  /**
   * 通知任务处理器
   * @param {Object} job - Bull任务对象
   * @returns {Promise<any>} 处理结果
   */
  async notificationHandler(job) {
    const { type, userId, data, channels } = job.data;

    try {
      logger.info(`[JobProcessors] 处理通知任务: ${type}, 用户: ${userId}`);

      let results = [];

      // 根据通知类型处理
      switch (type) {
        case 'task_completed':
          results = await this.handleTaskCompletedNotification(userId, data, channels);
          break;
        case 'task_failed':
          results = await this.handleTaskFailedNotification(userId, data, channels);
          break;
        case 'quota_low':
          results = await this.handleQuotaLowNotification(userId, data, channels);
          break;
        case 'system_maintenance':
          results = await this.handleSystemMaintenanceNotification(data, channels);
          break;
        default:
          throw new Error(`不支持的通知类型: ${type}`);
      }

      logger.info(`[JobProcessors] 通知任务完成: ${type}`);
      return results;

    } catch (error) {
      logger.error(`[JobProcessors] 通知任务失败: ${type}`, error);
      throw error;
    }
  }

  /**
   * 清理任务处理器
   * @param {Object} job - Bull任务对象
   * @returns {Promise<any>} 处理结果
   */
  async cleanupHandler(job) {
    const { type, params } = job.data;

    try {
      logger.info(`[JobProcessors] 开始清理任务: ${type}`);

      let result;
      switch (type) {
        case 'old_files':
          result = await this.cleanupOldFiles(params);
          break;
        case 'temp_cache':
          result = await this.cleanupTempCache(params);
          break;
        case 'expired_tokens':
          result = await this.cleanupExpiredTokens(params);
          break;
        case 'failed_jobs':
          result = await this.cleanupFailedJobs(params);
          break;
        default:
          throw new Error(`不支持的清理类型: ${type}`);
      }

      logger.info(`[JobProcessors] 清理任务完成: ${type}`);
      return result;

    } catch (error) {
      logger.error(`[JobProcessors] 清理任务失败: ${type}`, error);
      throw error;
    }
  }

  /**
   * 处理任务完成通知
   * @param {string} userId - 用户ID
   * @param {Object} data - 通知数据
   * @param {Array} channels - 通知渠道
   * @returns {Promise<Array>} 处理结果
   * @private
   */
  async handleTaskCompletedNotification(userId, data, channels) {
    const results = [];
    const { taskId, taskType, resultUrls } = data;

    try {
      // 获取用户信息
      const user = await db('users').where('id', userId).first();
      if (!user) {
        throw new Error(`用户不存在: ${userId}`);
      }

      const notificationData = {
        userId,
        taskId,
        taskType,
        resultUrls,
        timestamp: new Date(),
        title: '任务完成',
        message: `您的${taskType}任务已成功完成`,
        type: 'success'
      };

      // 保存通知记录
      await db('notifications').insert({
        user_id: userId,
        type: 'task_completed',
        title: notificationData.title,
        message: notificationData.message,
        data: JSON.stringify(notificationData),
        read: false,
        created_at: new Date()
      });

      // 根据渠道发送通知
      for (const channel of channels) {
        if (channel === 'database') {
          results.push({ channel, status: 'saved' });
        } else if (channel === 'email') {
          // TODO: 实现邮件通知
          results.push({ channel, status: 'skipped', reason: 'email not implemented' });
        } else if (channel === 'sms') {
          // TODO: 实现短信通知
          results.push({ channel, status: 'skipped', reason: 'sms not implemented' });
        }
      }

    } catch (error) {
      logger.error(`[JobProcessors] 任务完成通知失败: ${userId}`, error);
      throw error;
    }

    return results;
  }

  /**
   * 处理任务失败通知
   * @param {string} userId - 用户ID
   * @param {Object} data - 通知数据
   * @param {Array} channels - 通知渠道
   * @returns {Promise<Array>} 处理结果
   * @private
   */
  async handleTaskFailedNotification(userId, data, channels) {
    const results = [];
    const { taskId, taskType, errorMessage } = data;

    try {
      const notificationData = {
        userId,
        taskId,
        taskType,
        errorMessage,
        timestamp: new Date(),
        title: '任务失败',
        message: `您的${taskType}任务处理失败`,
        type: 'error'
      };

      // 保存通知记录
      await db('notifications').insert({
        user_id: userId,
        type: 'task_failed',
        title: notificationData.title,
        message: notificationData.message,
        data: JSON.stringify(notificationData),
        read: false,
        created_at: new Date()
      });

      for (const channel of channels) {
        results.push({ channel, status: 'saved' });
      }

    } catch (error) {
      logger.error(`[JobProcessors] 任务失败通知失败: ${userId}`, error);
      throw error;
    }

    return results;
  }

  /**
   * 处理配额不足通知
   * @param {string} userId - 用户ID
   * @param {Object} data - 通知数据
   * @param {Array} channels - 通知渠道
   * @returns {Promise<Array>} 处理结果
   * @private
   */
  async handleQuotaLowNotification(userId, data, channels) {
    const results = [];
    const { remainingQuota, quotaLimit } = data;

    try {
      const notificationData = {
        userId,
        remainingQuota,
        quotaLimit,
        timestamp: new Date(),
        title: '配额不足',
        message: `您的配额即将用完，剩余 ${remainingQuota}/${quotaLimit}`,
        type: 'warning'
      };

      await db('notifications').insert({
        user_id: userId,
        type: 'quota_low',
        title: notificationData.title,
        message: notificationData.message,
        data: JSON.stringify(notificationData),
        read: false,
        created_at: new Date()
      });

      for (const channel of channels) {
        results.push({ channel, status: 'saved' });
      }

    } catch (error) {
      logger.error(`[JobProcessors] 配额不足通知失败: ${userId}`, error);
      throw error;
    }

    return results;
  }

  /**
   * 处理系统维护通知
   * @param {Object} data - 通知数据
   * @param {Array} channels - 通知渠道
   * @returns {Promise<Array>} 处理结果
   * @private
   */
  async handleSystemMaintenanceNotification(data, channels) {
    const results = [];
    const { message, startTime, endTime } = data;

    try {
      // 获取所有用户
      const users = await db('users').select('id');

      const notificationData = {
        message,
        startTime,
        endTime,
        timestamp: new Date(),
        title: '系统维护通知',
        type: 'info'
      };

      // 批量插入通知记录
      const notifications = users.map(user => ({
        user_id: user.id,
        type: 'system_maintenance',
        title: notificationData.title,
        message: notificationData.message,
        data: JSON.stringify(notificationData),
        read: false,
        created_at: new Date()
      }));

      if (notifications.length > 0) {
        await db('notifications').insert(notifications);
      }

      for (const channel of channels) {
        results.push({ channel, status: 'saved', userCount: users.length });
      }

    } catch (error) {
      logger.error('[JobProcessors] 系统维护通知失败', error);
      throw error;
    }

    return results;
  }

  /**
   * 清理旧文件
   * @param {Object} params - 清理参数
   * @returns {Promise<Object>} 清理结果
   * @private
   */
  async cleanupOldFiles(params) {
    const { olderThanDays = 7, path } = params;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    try {
      // 查询过期的任务记录
      const expiredTasks = await db('tasks')
        .where('created_at', '<', cutoffDate)
        .whereNotNull('resultUrls')
        .select('id', 'resultUrls');

      let deletedCount = 0;
      let errors = [];

      for (const task of expiredTasks) {
        try {
          const resultUrls = JSON.parse(task.resultUrls || '[]');
          // TODO: 实际删除文件逻辑
          // await fileService.deleteFiles(resultUrls);
          deletedCount += resultUrls.length;
        } catch (error) {
          errors.push({ taskId: task.id, error: error.message });
        }
      }

      return {
        success: true,
        deletedCount,
        errors: errors.length,
        cutoffDate: cutoffDate.toISOString()
      };

    } catch (error) {
      logger.error('[JobProcessors] 清理旧文件失败', error);
      throw error;
    }
  }

  /**
   * 清理临时缓存
   * @param {Object} params - 清理参数
   * @returns {Promise<Object>} 清理结果
   * @private
   */
  async cleanupTempCache(params) {
    const { pattern = 'temp:*', olderThanMinutes = 60 } = params;

    try {
      // 删除匹配的缓存
      const deleteCount = await cacheService.deletePattern(pattern);

      return {
        success: true,
        deleteCount,
        pattern,
        olderThanMinutes
      };

    } catch (error) {
      logger.error('[JobProcessors] 清理临时缓存失败', error);
      throw error;
    }
  }

  /**
   * 清理过期Token
   * @param {Object} params - 清理参数
   * @returns {Promise<Object>} 清理结果
   * @private
   */
  async cleanupExpiredTokens(params) {
    const { olderThanDays = 7 } = params;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    try {
      // 删除过期的refresh_tokens记录
      const deletedCount = await db('refresh_tokens')
        .where('expires_at', '<', cutoffDate)
        .del();

      return {
        success: true,
        deletedCount,
        cutoffDate: cutoffDate.toISOString()
      };

    } catch (error) {
      logger.error('[JobProcessors] 清理过期Token失败', error);
      throw error;
    }
  }

  /**
   * 清理失败的任务记录
   * @param {Object} params - 清理参数
   * @returns {Promise<Object>} 清理结果
   * @private
   */
  async cleanupFailedJobs(params) {
    const { olderThanDays = 30, keepCount = 100 } = params;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    try {
      // 查询失败的任务
      const failedJobs = await db('tasks')
        .where('status', 'failed')
        .where('created_at', '<', cutoffDate)
        .orderBy('created_at', 'desc')
        .offset(keepCount)
        .select('id');

      const taskIds = failedJobs.map(job => job.id);
      let deletedCount = 0;

      if (taskIds.length > 0) {
        // 删除相关的task_steps
        await db('task_steps').whereIn('task_id', taskIds).del();

        // 删除相关的quota_transactions
        await db('quota_transactions').whereIn('task_id', taskIds).del();

        // 删除任务记录
        deletedCount = await db('tasks').whereIn('id', taskIds).del();
      }

      return {
        success: true,
        deletedCount,
        cutoffDate: cutoffDate.toISOString(),
        keepCount
      };

    } catch (error) {
      logger.error('[JobProcessors] 清理失败任务记录失败', error);
      throw error;
    }
  }

  /**
   * 获取处理器列表
   * @returns {Array} 处理器列表
   */
  getProcessors() {
    return [
      {
        name: 'imageProcessingHandler',
        description: '图像处理任务处理器',
        supportedTypes: ['basic_clean', 'enhance', 'background_remove']
      },
      {
        name: 'aiProcessingHandler',
        description: 'AI模型任务处理器',
        supportedTypes: ['model_pose12', 'ai_enhance', 'ai_generate']
      },
      {
        name: 'pipelineProcessingHandler',
        description: 'Pipeline流程任务处理器',
        supportedTypes: ['pipeline']
      },
      {
        name: 'notificationHandler',
        description: '通知任务处理器',
        supportedTypes: ['task_completed', 'task_failed', 'quota_low', 'system_maintenance']
      },
      {
        name: 'cleanupHandler',
        description: '清理任务处理器',
        supportedTypes: ['old_files', 'temp_cache', 'expired_tokens', 'failed_jobs']
      }
    ];
  }
}

module.exports = new JobProcessorsService();