/**
 * Sentry 错误追踪配置
 * 艹！再也不用SSH看日志了，直接Web界面看错误！
 */

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import logger from '../utils/logger.js';

const SENTRY_DSN = process.env.SENTRY_DSN;
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * 初始化 Sentry
 */
export function initSentry() {
  // 如果没有配置 DSN，跳过初始化（本地开发可以不用）
  if (!SENTRY_DSN) {
    logger.info('[Sentry] 未配置 SENTRY_DSN，跳过初始化');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: NODE_ENV,

    // 只在生产环境启用性能追踪
    tracesSampleRate: NODE_ENV === 'production' ? 0.1 : 0,

    // 启用性能分析（可选）
    profilesSampleRate: NODE_ENV === 'production' ? 0.1 : 0,

    integrations: [
      // 性能分析
      nodeProfilingIntegration(),
    ],

    // 过滤掉一些不重要的错误
    beforeSend(event, hint) {
      const error = hint.originalException;

      // 过滤掉预期的业务错误（比如用户输入错误）
      if (error instanceof Error) {
        // 不上报 4xx 错误（用户输入错误）
        if (error.message.includes('VALIDATION_ERROR')) {
          return null;
        }
        if (error.message.includes('AUTHENTICATION_FAILED')) {
          return null;
        }
      }

      return event;
    },

    // 脱敏处理
    beforeBreadcrumb(breadcrumb) {
      // 移除敏感信息（密码、token等）
      if (breadcrumb.data) {
        if (breadcrumb.data.password) breadcrumb.data.password = '[FILTERED]';
        if (breadcrumb.data.token) breadcrumb.data.token = '[FILTERED]';
        if (breadcrumb.data.accessToken) breadcrumb.data.accessToken = '[FILTERED]';
      }
      return breadcrumb;
    },
  });

  logger.info('[Sentry] 初始化成功！错误追踪已启用');
}

/**
 * 手动捕获异常
 */
export function captureException(error: Error, context?: Record<string, any>) {
  if (!SENTRY_DSN) return;

  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value);
      });
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

/**
 * 记录消息
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  if (!SENTRY_DSN) return;
  Sentry.captureMessage(message, level);
}

/**
 * 设置用户上下文（知道是哪个用户出错了）
 */
export function setUser(user: { id: string; email?: string; phone?: string }) {
  if (!SENTRY_DSN) return;
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.phone,
  });
}

/**
 * 清除用户上下文
 */
export function clearUser() {
  if (!SENTRY_DSN) return;
  Sentry.setUser(null);
}

export default Sentry;
