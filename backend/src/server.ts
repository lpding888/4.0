/**
 * 服务器启动入口
 * 艹，启动Express服务器和所有调度器！
 */

import dotenv from 'dotenv';
import app, { startSchedulers } from './app';

// 艹，加载环境变量
dotenv.config();

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// 启动服务器
const server = app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`[SERVER] 🚀 服务器启动成功`);
  console.log(`[SERVER] 📡 环境: ${NODE_ENV}`);
  console.log(`[SERVER] 🌐 端口: ${PORT}`);
  console.log(`[SERVER] 🔗 URL: http://localhost:${PORT}`);
  console.log(`[SERVER] 💊 健康检查: http://localhost:${PORT}/health`);
  console.log('='.repeat(50));

  // 艹，启动定时调度器
  startSchedulers();
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('[SERVER] 收到SIGTERM信号，正在关闭服务器...');
  server.close(() => {
    console.log('[SERVER] 服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[SERVER] 收到SIGINT信号，正在关闭服务器...');
  server.close(() => {
    console.log('[SERVER] 服务器已关闭');
    process.exit(0);
  });
});

// 未捕获的异常
process.on('uncaughtException', (err) => {
  console.error('[SERVER] 未捕获的异常:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[SERVER] 未处理的Promise拒绝:', reason);
  process.exit(1);
});

export default server;
