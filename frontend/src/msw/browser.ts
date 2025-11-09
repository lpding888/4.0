/**
 * MSW Browser配置
 * 艹，浏览器端必须用Service Worker拦截请求！
 *
 * @author 老王
 */

import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

// 仅在明确启用Mock时才启动
const shouldStartWorker = process.env.NEXT_PUBLIC_ENABLE_MOCK === 'true';

export const worker = shouldStartWorker
  ? setupWorker(...handlers)
  : null;

// 导出启动/停止方法
export const startWorker = async () => {
  if (worker) {
    await worker.start({
      onUnhandledRequest: 'warn',
    });
    console.log('🎭 MSW Worker 已启动');
  }
};

export const stopWorker = () => {
  if (worker) {
    worker.stop();
    console.log('🛑 MSW Worker 已停止');
  }
};
