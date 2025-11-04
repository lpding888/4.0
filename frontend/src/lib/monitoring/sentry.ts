/**
 * Sentry 监控配置
 * 艹，生产环境才启用，别浪费钱！
 *
 * @author 老王
 */

// 暂时禁用Sentry以避免编译错误
// TODO: 修复Sentry配置后重新启用
// import * as Sentry from '@sentry/nextjs';

export function initSentry() {
  // 艹！暂时跳过Sentry初始化
  console.log('Sentry初始化已暂时禁用');
  return;

  /*
  // 仅当生产环境且有DSN时才启用
  if (process.env.NODE_ENV !== 'production' || !process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  // 避免重复初始化
  if (Sentry.getCurrentHub().getClient()) {
    return;
  }

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration()
    ],
    replaysSessionSampleRate: 0.01,
  });
  */
}

export function tagRequestId(requestId?: string) {
  if (!requestId) return;
  console.log('Request ID:', requestId);

  /*
  Sentry.addBreadcrumb({
    category: 'api',
    level: 'info',
    data: { requestId }
  });
  */
}