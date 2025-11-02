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
const cacheService = require('./services/cache.service');
const cacheSubscriberService = require('./services/cache-subscriber.service');
const queueService = require('./services/queue.service');
const jobProcessors = require('./services/job-processors.service');
const providerRegistryService = require('./services/provider-registry.service');
const fileManagementService = require('./services/file-management.service');
const websocketService = require('./services/websocket.service');
const taskProgressService = require('./services/task-progress.service');
const swaggerService = require('./services/swagger.service');
const paymentService = require('./services/payment.service');
const wechatLoginService = require('./services/wechat-login.service');
const unifiedLoginService = require('./services/unified-login.service');
const i18nService = require('./services/i18n.service');
const featureCatalogService = require('./services/feature-catalog.service');
const buildingAIAdaptorService = require('./services/buildingai-adaptor.service');
const inviteCodeService = require('./services/invite-code.service');
const userProfileService = require('./services/user-profile.service');
const referralValidationService = require('./services/referral-validation.service');

const PORT = process.env.PORT || 3000;

// 启动服务器
const server = app.listen(PORT, async () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗 API URL: ${process.env.API_DOMAIN || `http://localhost:${PORT}`}`);

  // 启动缓存服务
  try {
    // 测试缓存连接
    const cacheHealth = await cacheService.healthCheck();
    if (cacheHealth.status === 'healthy') {
      logger.info('🗄️  Cache service connected and healthy');

      // 启动缓存订阅服务
      await cacheSubscriberService.start();
      logger.info('📡 Cache subscriber service started');

      // 启动健康检查
      cacheSubscriberService.startHealthCheck();
    } else {
      logger.warn('⚠️  Cache service unhealthy, running without cache');
    }
  } catch (error) {
    logger.warn('⚠️  Failed to start cache service, running without cache:', error.message);
  }

  // 启动队列服务
  try {
    // 测试队列连接
    const queueHealth = await queueService.healthCheck();
    if (queueHealth.status === 'healthy') {
      logger.info('📋 Queue service connected and healthy');

      // 注册任务处理器
      queueService.registerProcessor('image_processing', 'process', jobProcessors.imageProcessingHandler);
      queueService.registerProcessor('ai_processing', 'process', jobProcessors.aiProcessingHandler);
      queueService.registerProcessor('task_processing', 'pipeline', jobProcessors.pipelineProcessingHandler);
      queueService.registerProcessor('notifications', 'send', jobProcessors.notificationHandler);
      queueService.registerProcessor('cleanup', 'cleanup', jobProcessors.cleanupHandler);

      logger.info('⚙️  Job processors registered');
    } else {
      logger.warn('⚠️  Queue service unhealthy, running without queues');
    }
  } catch (error) {
    logger.warn('⚠️  Failed to start queue service, running without queues:', error.message);
  }

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

  // 初始化Provider注册服务
  try {
    await providerRegistryService.initialize();
    logger.info('🔧 Provider registry service initialized');
  } catch (error) {
    logger.error('Failed to initialize provider registry service:', error);
  }

  // 初始化文件管理服务
  try {
    await fileManagementService.initialize();
    logger.info('📁 File management service initialized');
  } catch (error) {
    logger.error('Failed to initialize file management service:', error);
  }

  // 初始化WebSocket服务
  try {
    await websocketService.initialize();
    logger.info('🌐 WebSocket service initialized');
  } catch (error) {
    logger.error('Failed to initialize WebSocket service:', error);
  }

  // 初始化任务进度推送服务
  try {
    await taskProgressService.initialize();
    logger.info('📊 Task progress service initialized');
  } catch (error) {
    logger.error('Failed to initialize task progress service:', error);
  }

  // 初始化Swagger文档服务
  try {
    await swaggerService.initialize();
    logger.info('📚 Swagger documentation service initialized');
  } catch (error) {
    logger.error('Failed to initialize Swagger documentation service:', error);
  }

  // 初始化支付服务
  try {
    await paymentService.initialize();
    logger.info('💳 Payment service initialized');
  } catch (error) {
    logger.error('Failed to initialize payment service:', error);
  }

  // 初始化微信登录服务
  try {
    await wechatLoginService.initialize();
    logger.info('📱 WeChat login service initialized');
  } catch (error) {
    logger.error('Failed to initialize WeChat login service:', error);
  }

  // 初始化统一登录服务
  try {
    await unifiedLoginService.initialize();
    logger.info('🔐 Unified login service initialized');
  } catch (error) {
    logger.error('Failed to initialize unified login service:', error);
  }

  // 初始化国际化服务
  try {
    await i18nService.initialize();
    logger.info('🌐 Internationalization service initialized');
  } catch (error) {
    logger.error('Failed to initialize internationalization service:', error);
  }

  // 初始化功能目录服务
  try {
    await featureCatalogService.initialize();
    logger.info('📚 Feature catalog service initialized');
  } catch (error) {
    logger.error('Failed to initialize feature catalog service:', error);
  }

  // 初始化BuildingAI适配层服务
  try {
    await buildingAIAdaptorService.initialize();
    logger.info('🤖 BuildingAI adaptor service initialized');
  } catch (error) {
    logger.error('Failed to initialize BuildingAI adaptor service:', error);
  }

  // 初始化邀请码服务
  try {
    await inviteCodeService.initialize();
    logger.info('🎫 Invite code service initialized');
  } catch (error) {
    logger.error('Failed to initialize invite code service:', error);
  }

  // 初始化用户资料服务
  try {
    await userProfileService.initialize();
    logger.info('👤 User profile service initialized');
  } catch (error) {
    logger.error('Failed to initialize user profile service:', error);
  }

  // 初始化推荐验证服务
  try {
    await referralValidationService.initialize();
    logger.info('🔍 Referral validation service initialized');
  } catch (error) {
    logger.error('Failed to initialize referral validation service:', error);
  }
});

// 优雅关闭
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing services');

  // 停止缓存订阅服务
  try {
    await cacheSubscriberService.stop();
    logger.info('Cache subscriber service stopped');
  } catch (error) {
    logger.error('Error stopping cache subscriber service:', error);
  }

  // 关闭缓存服务
  try {
    await cacheService.close();
    logger.info('Cache service closed');
  } catch (error) {
    logger.error('Error closing cache service:', error);
  }

  // 关闭队列服务
  try {
    await queueService.close();
    logger.info('Queue service closed');
  } catch (error) {
    logger.error('Error closing queue service:', error);
  }

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

  // 关闭WebSocket服务
  try {
    await websocketService.close();
    logger.info('WebSocket service closed');
  } catch (error) {
    logger.error('Error closing WebSocket service:', error);
  }

  // 关闭Swagger文档服务
  try {
    await swaggerService.close();
    logger.info('Swagger documentation service closed');
  } catch (error) {
    logger.error('Error closing Swagger documentation service:', error);
  }

  // 关闭支付服务
  try {
    await paymentService.close();
    logger.info('Payment service closed');
  } catch (error) {
    logger.error('Error closing payment service:', error);
  }

  // 关闭微信登录服务
  try {
    await wechatLoginService.close();
    logger.info('WeChat login service closed');
  } catch (error) {
    logger.error('Error closing WeChat login service:', error);
  }

  // 关闭统一登录服务
  try {
    await unifiedLoginService.close();
    logger.info('Unified login service closed');
  } catch (error) {
    logger.error('Error closing unified login service:', error);
  }

  // 关闭国际化服务
  try {
    await i18nService.close();
    logger.info('Internationalization service closed');
  } catch (error) {
    logger.error('Error closing internationalization service:', error);
  }

  // 关闭功能目录服务
  try {
    await featureCatalogService.close();
    logger.info('Feature catalog service closed');
  } catch (error) {
    logger.error('Error closing feature catalog service:', error);
  }

  // 关闭BuildingAI适配层服务
  try {
    await buildingAIAdaptorService.close();
    logger.info('BuildingAI adaptor service closed');
  } catch (error) {
    logger.error('Error closing BuildingAI adaptor service:', error);
  }

  // 关闭邀请码服务
  try {
    await inviteCodeService.close();
    logger.info('Invite code service closed');
  } catch (error) {
    logger.error('Error closing invite code service:', error);
  }

  // 关闭用户资料服务
  try {
    await userProfileService.close();
    logger.info('User profile service closed');
  } catch (error) {
    logger.error('Error closing user profile service:', error);
  }

  // 关闭推荐验证服务
  try {
    await referralValidationService.close();
    logger.info('Referral validation service closed');
  } catch (error) {
    logger.error('Error closing referral validation service:', error);
  }

  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing services');

  // 停止缓存订阅服务
  try {
    await cacheSubscriberService.stop();
    logger.info('Cache subscriber service stopped');
  } catch (error) {
    logger.error('Error stopping cache subscriber service:', error);
  }

  // 关闭缓存服务
  try {
    await cacheService.close();
    logger.info('Cache service closed');
  } catch (error) {
    logger.error('Error closing cache service:', error);
  }

  // 关闭队列服务
  try {
    await queueService.close();
    logger.info('Queue service closed');
  } catch (error) {
    logger.error('Error closing queue service:', error);
  }

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

  // 关闭WebSocket服务
  try {
    await websocketService.close();
    logger.info('WebSocket service closed');
  } catch (error) {
    logger.error('Error closing WebSocket service:', error);
  }

  // 关闭Swagger文档服务
  try {
    await swaggerService.close();
    logger.info('Swagger documentation service closed');
  } catch (error) {
    logger.error('Error closing Swagger documentation service:', error);
  }

  // 关闭支付服务
  try {
    await paymentService.close();
    logger.info('Payment service closed');
  } catch (error) {
    logger.error('Error closing payment service:', error);
  }

  // 关闭微信登录服务
  try {
    await wechatLoginService.close();
    logger.info('WeChat login service closed');
  } catch (error) {
    logger.error('Error closing WeChat login service:', error);
  }

  // 关闭统一登录服务
  try {
    await unifiedLoginService.close();
    logger.info('Unified login service closed');
  } catch (error) {
    logger.error('Error closing unified login service:', error);
  }

  // 关闭国际化服务
  try {
    await i18nService.close();
    logger.info('Internationalization service closed');
  } catch (error) {
    logger.error('Error closing internationalization service:', error);
  }

  // 关闭功能目录服务
  try {
    await featureCatalogService.close();
    logger.info('Feature catalog service closed');
  } catch (error) {
    logger.error('Error closing feature catalog service:', error);
  }

  // 关闭BuildingAI适配层服务
  try {
    await buildingAIAdaptorService.close();
    logger.info('BuildingAI adaptor service closed');
  } catch (error) {
    logger.error('Error closing BuildingAI adaptor service:', error);
  }

  // 关闭邀请码服务
  try {
    await inviteCodeService.close();
    logger.info('Invite code service closed');
  } catch (error) {
    logger.error('Error closing invite code service:', error);
  }

  // 关闭用户资料服务
  try {
    await userProfileService.close();
    logger.info('User profile service closed');
  } catch (error) {
    logger.error('Error closing user profile service:', error);
  }

  // 关闭推荐验证服务
  try {
    await referralValidationService.close();
    logger.info('Referral validation service closed');
  } catch (error) {
    logger.error('Error closing referral validation service:', error);
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
