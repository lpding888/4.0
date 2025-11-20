import 'dotenv/config';
import { initSentry } from './config/sentry.js'; // Sentry 必须最先初始化
import logger from './utils/logger.js';
import { createApp, startSchedulers, stopSchedulers } from './app.js';

// 初始化 Sentry 错误追踪
initSentry();
import { closeRedis } from './config/redis.js';
import { db } from './config/database.js';
import queueService from './services/queue.service.js';
import { shutdownIngestQueue } from './rag/ingest/worker.js';

const PORT = Number(process.env.PORT ?? 3000);
const NODE_ENV = process.env.NODE_ENV ?? 'development';

const { app } = await (async () => {
  const appInstance = await createApp();
  return { app: appInstance };
})();

const server = app.listen(PORT, () => {
  logger.info(`[SERVER] 🚀 启动成功 环境=${NODE_ENV} 端口=${PORT}`);
  logger.info(`[SERVER] 💊 健康检查 http://localhost:${PORT}/health`);
  startSchedulers();
});

const shutdown = (signal: NodeJS.Signals) => {
  logger.warn(`[SERVER] 收到 ${signal}，准备优雅关闭`);
  stopSchedulers();
  server.close(async (error) => {
    if (error) {
      logger.error('[SERVER] 关闭过程中出错', { error });
      process.exit(1);
    }
    try {
      await queueService.close();
    } catch (e) {
      logger.warn('[SERVER] 关闭队列服务异常', { error: e });
    }
    try {
      await shutdownIngestQueue();
    } catch (e) {
      logger.warn('[SERVER] 停止知识库队列异常', { error: e });
    }
    try {
      await closeRedis();
    } catch (e) {
      logger.warn('[SERVER] 关闭 Redis 异常', { error: e });
    }
    try {
      await db.destroy();
    } catch (e) {
      logger.warn('[SERVER] 关闭数据库连接池异常', { error: e });
    }
    logger.info('[SERVER] 服务器已关闭');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('uncaughtException', (err) => {
  logger.error('[SERVER] 未捕获的异常', { error: err });
  shutdown('SIGTERM');
});

process.on('unhandledRejection', (reason) => {
  logger.error('[SERVER] 未处理的Promise拒绝', { reason });
  shutdown('SIGTERM');
});

export default server;
