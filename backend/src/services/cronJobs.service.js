const cron = require('node-cron');
const providerHealthService = require('./providerHealth.service');
const commissionService = require('./commission.service');
const logger = require('../utils/logger');

/**
 * CronJobs Service - 定时任务调度服务
 * 负责启动和管理所有定时任务
 */
class CronJobsService {
  constructor() {
    this.jobs = [];
  }

  /**
   * 启动所有定时任务
   */
  startAll() {
    try {
      logger.info('[CronJobsService] 启动定时任务服务');

      // 1. Provider健康检查 - 每10分钟执行一次
      // 暂时禁用，provider_configs表不存在
      // this.scheduleProviderHealthCheck();

      // 2. 清理过期任务 - 每小时执行一次
      // this.scheduleTaskCleanup();

      // 3. 解冻佣金 - 每小时执行一次
      this.scheduleUnfreezeCommissions();

      logger.info(`[CronJobsService] 已启动${this.jobs.length}个定时任务`);

    } catch (error) {
      logger.error(`[CronJobsService] 启动定时任务失败: ${error.message}`, error);
    }
  }

  /**
   * 停止所有定时任务
   */
  stopAll() {
    try {
      logger.info('[CronJobsService] 停止所有定时任务');

      this.jobs.forEach(job => {
        if (job && job.stop) {
          job.stop();
        }
      });

      this.jobs = [];
      logger.info('[CronJobsService] 所有定时任务已停止');

    } catch (error) {
      logger.error(`[CronJobsService] 停止定时任务失败: ${error.message}`, error);
    }
  }

  /**
   * 调度Provider健康检查任务
   * 每10分钟执行一次
   */
  scheduleProviderHealthCheck() {
    try {
      // Cron表达式: */10 * * * * (每10分钟)
      const job = cron.schedule('*/10 * * * *', async () => {
        try {
          logger.info('[CronJobs] 开始执行Provider健康检查');

          const result = await providerHealthService.checkAllProviders();

          logger.info(
            `[CronJobs] Provider健康检查完成 ` +
            `total=${result.total} success=${result.success} fail=${result.fail}`
          );

          // 如果有不健康的Provider,记录警告
          if (result.fail > 0) {
            const unhealthyProviders = await providerHealthService.getUnhealthyProviders();
            logger.warn(
              `[CronJobs] 发现${result.fail}个不健康的Provider`,
              { unhealthyProviders }
            );
          }

        } catch (error) {
          logger.error(
            `[CronJobs] Provider健康检查异常: ${error.message}`,
            error
          );
        }
      });

      this.jobs.push(job);
      logger.info('[CronJobsService] Provider健康检查任务已启动 (每10分钟)');

    } catch (error) {
      logger.error(
        `[CronJobsService] 调度Provider健康检查失败: ${error.message}`,
        error
      );
    }
  }

  /**
   * 调度任务清理定时任务
   * 每小时执行一次,清理超时的pending任务
   */
  scheduleTaskCleanup() {
    try {
      // Cron表达式: 0 * * * * (每小时的第0分钟)
      const job = cron.schedule('0 * * * *', async () => {
        try {
          logger.info('[CronJobs] 开始执行任务清理');

          // TODO: 实现任务清理逻辑
          // const taskService = require('./task.service');
          // const cleanedCount = await taskService.cleanupTimeoutTasks();

          logger.info('[CronJobs] 任务清理完成');

        } catch (error) {
          logger.error(
            `[CronJobs] 任务清理异常: ${error.message}`,
            error
          );
        }
      });

      this.jobs.push(job);
      logger.info('[CronJobsService] 任务清理定时任务已启动 (每小时)');

    } catch (error) {
      logger.error(
        `[CronJobsService] 调度任务清理失败: ${error.message}`,
        error
      );
    }
  }

  /**
   * 调度解冻佣金定时任务
   * 每小时执行一次,将冻结期已结束的佣金转为可提现
   */
  scheduleUnfreezeCommissions() {
    try {
      // Cron表达式: 0 * * * * (每小时的第0分钟)
      const job = cron.schedule('0 * * * *', async () => {
        try {
          logger.info('[CronJobs] 开始执行解冻佣金任务');

          await commissionService.unfreezeCommissions();

          logger.info('[CronJobs] 解冻佣金任务完成');

        } catch (error) {
          logger.error(
            `[CronJobs] 解冻佣金任务异常: ${error.message}`,
            error
          );
        }
      });

      this.jobs.push(job);
      logger.info('[CronJobsService] 解冻佣金定时任务已启动 (每小时)');

    } catch (error) {
      logger.error(
        `[CronJobsService] 调度解冻佣金失败: ${error.message}`,
        error
      );
    }
  }

  /**
   * 获取所有任务的状态
   */
  getStatus() {
    return {
      totalJobs: this.jobs.length,
      jobs: this.jobs.map((job, index) => ({
        index,
        running: job ? true : false
      }))
    };
  }
}

module.exports = new CronJobsService();
