/**
 * 结构化日志系统
 * 艹！requestId全链路、error指纹、Vitals告警，一个都不能少！
 *
 * @author 老王
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

/**
 * 日志上下文
 */
export interface LogContext {
  requestId?: string; // 请求ID（全链路追踪）
  userId?: string; // 用户ID
  sessionId?: string; // 会话ID
  route?: string; // 当前路由
  action?: string; // 操作名称
  component?: string; // 组件名称
  [key: string]: any; // 其他自定义字段
}

/**
 * 结构化日志
 */
export interface StructuredLog {
  timestamp: string; // ISO 8601
  level: LogLevel; // 日志级别
  message: string; // 日志消息
  context: LogContext; // 上下文
  error?: ErrorFingerprint; // 错误指纹（如果是错误日志）
  vitals?: VitalsData; // 性能数据（如果是性能日志）
  metadata?: Record<string, any>; // 额外元数据
}

/**
 * 错误指纹
 */
export interface ErrorFingerprint {
  type: string; // 错误类型
  message: string; // 错误消息
  stack?: string; // 堆栈信息
  fingerprint: string; // 错误指纹（用于聚合）
  componentStack?: string; // React组件堆栈
  url?: string; // 发生错误的URL
  userAgent?: string; // 用户代理
}

/**
 * 性能数据
 */
export interface VitalsData {
  name: string; // 指标名称 (CLS, LCP, FID, etc.)
  value: number; // 指标值
  rating: 'good' | 'needs-improvement' | 'poor'; // 评级
  delta?: number; // 变化量
  id?: string; // 指标ID
}

/**
 * 日志配置
 */
interface LoggerConfig {
  enabled: boolean; // 是否启用
  level: LogLevel; // 最小日志级别
  console: boolean; // 是否输出到console
  remote: boolean; // 是否上报到远程
  remoteUrl?: string; // 远程日志服务URL
  sampling: number; // 采样率 (0-1)
  context: LogContext; // 默认上下文
}

/**
 * 日志管理器
 */
class Logger {
  private config: LoggerConfig;
  private buffer: StructuredLog[] = [];
  private bufferSize = 100;
  private flushInterval = 10000; // 10秒
  private flushTimer?: NodeJS.Timeout;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      enabled: true,
      level: LogLevel.INFO,
      console: process.env.NODE_ENV !== 'production',
      remote: process.env.NODE_ENV === 'production',
      remoteUrl: process.env.NEXT_PUBLIC_LOG_URL,
      sampling: 1.0, // 100% 采样
      context: {},
      ...config,
    };

    // 启动定时刷新
    if (this.config.remote) {
      this.startFlushTimer();
    }
  }

  /**
   * 设置全局上下文
   */
  setContext(context: Partial<LogContext>) {
    this.config.context = {
      ...this.config.context,
      ...context,
    };
  }

  /**
   * 获取当前上下文
   */
  getContext(): LogContext {
    return { ...this.config.context };
  }

  /**
   * 生成requestId
   */
  generateRequestId(): string {
    return `req_${uuidv4().substring(0, 8)}_${Date.now()}`;
  }

  /**
   * 设置requestId到上下文
   */
  setRequestId(requestId?: string) {
    const id = requestId || this.generateRequestId();
    this.setContext({ requestId: id });
    return id;
  }

  /**
   * Debug日志
   */
  debug(message: string, context?: Partial<LogContext>, metadata?: Record<string, any>) {
    this.log(LogLevel.DEBUG, message, context, metadata);
  }

  /**
   * Info日志
   */
  info(message: string, context?: Partial<LogContext>, metadata?: Record<string, any>) {
    this.log(LogLevel.INFO, message, context, metadata);
  }

  /**
   * Warn日志
   */
  warn(message: string, context?: Partial<LogContext>, metadata?: Record<string, any>) {
    this.log(LogLevel.WARN, message, context, metadata);
  }

  /**
   * Error日志
   */
  error(
    message: string,
    error?: Error,
    context?: Partial<LogContext>,
    metadata?: Record<string, any>
  ) {
    const fingerprint = error ? this.generateErrorFingerprint(error) : undefined;
    this.log(LogLevel.ERROR, message, context, metadata, fingerprint);
  }

  /**
   * Fatal日志
   */
  fatal(
    message: string,
    error?: Error,
    context?: Partial<LogContext>,
    metadata?: Record<string, any>
  ) {
    const fingerprint = error ? this.generateErrorFingerprint(error) : undefined;
    this.log(LogLevel.FATAL, message, context, metadata, fingerprint);
  }

  /**
   * Vitals日志
   */
  vitals(vitalsData: VitalsData, context?: Partial<LogContext>) {
    const log: StructuredLog = {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      message: `Vitals: ${vitalsData.name} = ${vitalsData.value}`,
      context: {
        ...this.config.context,
        ...context,
      },
      vitals: vitalsData,
    };

    this.process(log);
  }

  /**
   * 生成错误指纹
   */
  private generateErrorFingerprint(error: Error): ErrorFingerprint {
    // 生成指纹：错误类型 + 错误消息的前50个字符 + 堆栈第一行
    const stackLines = error.stack?.split('\n') || [];
    const firstStackLine = stackLines[1] || '';
    const fingerprintBase = `${error.name}:${error.message.substring(0, 50)}:${firstStackLine}`;

    // 简单hash（生产环境应使用更好的hash算法）
    const fingerprint = this.simpleHash(fingerprintBase);

    return {
      type: error.name,
      message: error.message,
      stack: error.stack,
      fingerprint,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    };
  }

  /**
   * 简单hash函数
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `err_${Math.abs(hash).toString(36)}`;
  }

  /**
   * 核心日志方法
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Partial<LogContext>,
    metadata?: Record<string, any>,
    error?: ErrorFingerprint
  ) {
    // 检查是否启用
    if (!this.config.enabled) {
      return;
    }

    // 检查日志级别
    if (!this.shouldLog(level)) {
      return;
    }

    // 采样检查
    if (Math.random() > this.config.sampling) {
      return;
    }

    const log: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        ...this.config.context,
        ...context,
      },
      error,
      metadata,
    };

    this.process(log);
  }

  /**
   * 处理日志
   */
  private process(log: StructuredLog) {
    // 输出到console
    if (this.config.console) {
      this.logToConsole(log);
    }

    // 添加到缓冲区
    if (this.config.remote) {
      this.buffer.push(log);

      // 如果缓冲区满了，立即刷新
      if (this.buffer.length >= this.bufferSize) {
        this.flush();
      }
    }
  }

  /**
   * 输出到console
   */
  private logToConsole(log: StructuredLog) {
    const prefix = `[${log.level.toUpperCase()}]`;
    const contextStr = log.context.requestId ? `[${log.context.requestId}]` : '';
    const message = `${prefix}${contextStr} ${log.message}`;

    switch (log.level) {
      case LogLevel.DEBUG:
        console.debug(message, log);
        break;
      case LogLevel.INFO:
        console.info(message, log);
        break;
      case LogLevel.WARN:
        console.warn(message, log);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(message, log);
        if (log.error?.stack) {
          console.error(log.error.stack);
        }
        break;
    }
  }

  /**
   * 检查是否应该记录日志
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL];
    const currentIndex = levels.indexOf(this.config.level);
    const logIndex = levels.indexOf(level);
    return logIndex >= currentIndex;
  }

  /**
   * 刷新缓冲区（上报到远程）
   */
  async flush() {
    if (this.buffer.length === 0) {
      return;
    }

    const logs = [...this.buffer];
    this.buffer = [];

    if (!this.config.remoteUrl) {
      return;
    }

    try {
      await fetch(this.config.remoteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs }),
      });
    } catch (error) {
      // 上报失败，静默处理
      console.error('[Logger] Failed to flush logs:', error);
    }
  }

  /**
   * 启动定时刷新
   */
  private startFlushTimer() {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * 停止定时刷新
   */
  stopFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  /**
   * 销毁
   */
  destroy() {
    this.stopFlushTimer();
    this.flush(); // 最后刷新一次
  }
}

// 单例
let loggerInstance: Logger | null = null;

/**
 * 获取Logger实例
 */
export function getLogger(): Logger {
  if (!loggerInstance) {
    loggerInstance = new Logger();
  }
  return loggerInstance;
}

/**
 * 初始化Logger
 */
export function initLogger(config?: Partial<LoggerConfig>): Logger {
  loggerInstance = new Logger(config);
  return loggerInstance;
}

// 便捷方法
export const logger = {
  debug: (message: string, context?: Partial<LogContext>, metadata?: Record<string, any>) =>
    getLogger().debug(message, context, metadata),

  info: (message: string, context?: Partial<LogContext>, metadata?: Record<string, any>) =>
    getLogger().info(message, context, metadata),

  warn: (message: string, context?: Partial<LogContext>, metadata?: Record<string, any>) =>
    getLogger().warn(message, context, metadata),

  error: (
    message: string,
    error?: Error,
    context?: Partial<LogContext>,
    metadata?: Record<string, any>
  ) => getLogger().error(message, error, context, metadata),

  fatal: (
    message: string,
    error?: Error,
    context?: Partial<LogContext>,
    metadata?: Record<string, any>
  ) => getLogger().fatal(message, error, context, metadata),

  vitals: (vitalsData: VitalsData, context?: Partial<LogContext>) =>
    getLogger().vitals(vitalsData, context),

  setContext: (context: Partial<LogContext>) => getLogger().setContext(context),

  setRequestId: (requestId?: string) => getLogger().setRequestId(requestId),

  generateRequestId: () => getLogger().generateRequestId(),

  getContext: () => getLogger().getContext(),
};
