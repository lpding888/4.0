require('dotenv').config();

// 环境变量验证 - 在启动前检查所有必需配置
const { checkEnvironmentOnStart } = require('./config/env.validator');
try {
  checkEnvironmentOnStart();
} catch (error) {
  console.error('🚫 环境变量验证失败:', error.message);
  if (error.details) {
    console.error('缺少的环境变量:', error.details.join(', '));
    console.error('\n请检查 .env 文件是否包含所有必需配置');
  }
  process.exit(1);
}

const app = require('./app');
const logger = require('./utils/logger');
const videoPollingService = require('./services/videoPolling.service');
const cronJobsService = require('./services/cronJobs.service');
const { startUnfreezeCommissionsJob, stopUnfreezeCommissionsJob } = require('../cron/unfreeze-commissions');

const PORT = process.env.PORT || 3000;

// 启动服务器
const server = app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗 API URL: ${process.env.API_DOMAIN || `http://localhost:${PORT}`}`);

  // 启动视频任务轮询服务
  try {
    videoPollingService.start();
    logger.info('🔄 Video polling service started');
  } catch (error) {
    logger.error('Failed to start video polling service:', error);
  }

  // 启动定时任务服务
  try {
    cronJobsService.startAll();
    logger.info('⏰ Cron jobs service started');
  } catch (error) {
    logger.error('Failed to start cron jobs service:', error);
  }

  // 启动佣金解冻定时任务
  try {
    startUnfreezeCommissionsJob();
    logger.info('💰 Commission unfreezing job started');
  } catch (error) {
    logger.error('Failed to start commission unfreezing job:', error);
  }
});

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing services');

  // 停止轮询服务
  try {
    videoPollingService.stop();
    logger.info('Video polling service stopped');
  } catch (error) {
    logger.error('Error stopping video polling service:', error);
  }

  // 停止定时任务服务
  try {
    cronJobsService.stopAll();
    logger.info('Cron jobs service stopped');
  } catch (error) {
    logger.error('Error stopping cron jobs service:', error);
  }

  // 停止佣金解冻定时任务
  try {
    stopUnfreezeCommissionsJob();
    logger.info('Commission unfreezing job stopped');
  } catch (error) {
    logger.error('Error stopping commission unfreezing job:', error);
  }

  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing services');

  // 停止轮询服务
  try {
    videoPollingService.stop();
    logger.info('Video polling service stopped');
  } catch (error) {
    logger.error('Error stopping video polling service:', error);
  }

  // 停止定时任务服务
  try {
    cronJobsService.stopAll();
    logger.info('Cron jobs service stopped');
  } catch (error) {
    logger.error('Error stopping cron jobs service:', error);
  }

  // 停止佣金解冻定时任务
  try {
    stopUnfreezeCommissionsJob();
    logger.info('Commission unfreezing job stopped');
  } catch (error) {
    logger.error('Error stopping commission unfreezing job:', error);
  }

  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// 未捕获异常处理
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
