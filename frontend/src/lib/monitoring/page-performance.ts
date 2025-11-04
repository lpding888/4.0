/**
 * 页面性能打点系统（RUM - Real User Monitoring）
 * 艹！首屏/LCP/FCP/TTI/错误率全都要监控！
 *
 * 功能：
 * 1. 自动收集Web Vitals指标（LCP、FID、CLS、FCP、TTFB）
 * 2. 自定义页面打点（首屏时间、交互时间等）
 * 3. 错误率统计
 * 4. 数据持久化和上报
 *
 * @author 老王
 */

import { onCLS, onFID, onLCP, onFCP, onTTFB, Metric } from 'web-vitals';
import { logger } from './logger';

/**
 * 页面性能指标
 */
export interface PagePerformanceMetric {
  page: string; // 页面路径
  metric_name: string; // 指标名称（LCP/FCP/FID/CLS/TTFB/custom）
  metric_value: number; // 指标值（毫秒或分数）
  rating: 'good' | 'needs-improvement' | 'poor'; // 评级
  timestamp: number; // 时间戳
  user_agent?: string; // 用户代理
  session_id?: string; // 会话ID
  user_id?: string; // 用户ID
  additional_data?: Record<string, any>; // 额外数据
}

/**
 * 页面错误记录
 */
export interface PageErrorRecord {
  page: string; // 页面路径
  error_type: string; // 错误类型（js_error/resource_error/promise_rejection）
  error_message: string; // 错误消息
  error_stack?: string; // 错误堆栈
  timestamp: number; // 时间戳
  user_agent?: string; // 用户代理
  session_id?: string; // 会话ID
  user_id?: string; // 用户ID
}

/**
 * 页面性能聚合数据
 */
export interface PagePerformanceAggregation {
  page: string;
  time_range: {
    start: string;
    end: string;
  };
  metrics: {
    lcp: {
      p50: number;
      p95: number;
      p99: number;
      count: number;
    };
    fcp: {
      p50: number;
      p95: number;
      p99: number;
      count: number;
    };
    ttfb: {
      p50: number;
      p95: number;
      p99: number;
      count: number;
    };
    cls: {
      p50: number;
      p95: number;
      p99: number;
      count: number;
    };
    fid: {
      p50: number;
      p95: number;
      p99: number;
      count: number;
    };
  };
  error_rate: number; // 错误率（0-1）
  pv_count: number; // PV数
  uv_count: number; // UV数
}

/**
 * 阈值配置（基于Web Vitals推荐）
 */
const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 }, // 最大内容绘制
  FCP: { good: 1800, poor: 3000 }, // 首次内容绘制
  FID: { good: 100, poor: 300 }, // 首次输入延迟
  CLS: { good: 0.1, poor: 0.25 }, // 累积布局偏移
  TTFB: { good: 800, poor: 1800 }, // 首字节时间
};

/**
 * 获取评级
 */
function getRating(metricName: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[metricName as keyof typeof THRESHOLDS];
  if (!threshold) return 'good';

  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

/**
 * 页面性能监控器
 * 艹！这个SB类负责收集所有页面性能数据！
 */
class PagePerformanceMonitor {
  private metrics: PagePerformanceMetric[] = [];
  private errors: PageErrorRecord[] = [];
  private maxRecordsInMemory = 1000; // 内存中最多保留1000条记录
  private sessionId: string;
  private userId?: string;
  private isInitialized = false;

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 设置用户ID
   */
  setUserId(userId: string) {
    this.userId = userId;
  }

  /**
   * 初始化监控
   */
  init() {
    if (this.isInitialized) return;
    if (typeof window === 'undefined') return;

    this.isInitialized = true;

    // 1. 监听Web Vitals
    this.initWebVitals();

    // 2. 监听页面错误
    this.initErrorTracking();

    // 3. 监听路由变化（Next.js）
    this.initRouteTracking();

    // 4. 定时上报数据
    setInterval(() => {
      this.flushData();
    }, 30000); // 30秒上报一次

    logger.info('页面性能监控已初始化', { sessionId: this.sessionId });
  }

  /**
   * 初始化Web Vitals监控
   */
  private initWebVitals() {
    const currentPage = window.location.pathname;

    // LCP - 最大内容绘制
    onLCP((metric: Metric) => {
      this.recordMetric({
        page: currentPage,
        metric_name: 'LCP',
        metric_value: metric.value,
        rating: getRating('LCP', metric.value),
        timestamp: Date.now(),
        additional_data: {
          id: metric.id,
          delta: metric.delta,
          navigationType: metric.navigationType,
        },
      });
    });

    // FCP - 首次内容绘制
    onFCP((metric: Metric) => {
      this.recordMetric({
        page: currentPage,
        metric_name: 'FCP',
        metric_value: metric.value,
        rating: getRating('FCP', metric.value),
        timestamp: Date.now(),
        additional_data: {
          id: metric.id,
          delta: metric.delta,
          navigationType: metric.navigationType,
        },
      });
    });

    // FID - 首次输入延迟
    onFID((metric: Metric) => {
      this.recordMetric({
        page: currentPage,
        metric_name: 'FID',
        metric_value: metric.value,
        rating: getRating('FID', metric.value),
        timestamp: Date.now(),
        additional_data: {
          id: metric.id,
          delta: metric.delta,
          navigationType: metric.navigationType,
        },
      });
    });

    // CLS - 累积布局偏移
    onCLS((metric: Metric) => {
      this.recordMetric({
        page: currentPage,
        metric_name: 'CLS',
        metric_value: metric.value,
        rating: getRating('CLS', metric.value),
        timestamp: Date.now(),
        additional_data: {
          id: metric.id,
          delta: metric.delta,
          navigationType: metric.navigationType,
        },
      });
    });

    // TTFB - 首字节时间
    onTTFB((metric: Metric) => {
      this.recordMetric({
        page: currentPage,
        metric_name: 'TTFB',
        metric_value: metric.value,
        rating: getRating('TTFB', metric.value),
        timestamp: Date.now(),
        additional_data: {
          id: metric.id,
          delta: metric.delta,
          navigationType: metric.navigationType,
        },
      });
    });
  }

  /**
   * 初始化错误追踪
   */
  private initErrorTracking() {
    // JavaScript错误
    window.addEventListener('error', (event) => {
      this.recordError({
        page: window.location.pathname,
        error_type: 'js_error',
        error_message: event.message,
        error_stack: event.error?.stack,
        timestamp: Date.now(),
      });
    });

    // 资源加载错误
    window.addEventListener(
      'error',
      (event) => {
        const target = event.target as HTMLElement;
        if (target && target.tagName) {
          this.recordError({
            page: window.location.pathname,
            error_type: 'resource_error',
            error_message: `Failed to load ${target.tagName}: ${(target as any).src || (target as any).href}`,
            timestamp: Date.now(),
          });
        }
      },
      true
    );

    // Promise rejection
    window.addEventListener('unhandledrejection', (event) => {
      this.recordError({
        page: window.location.pathname,
        error_type: 'promise_rejection',
        error_message: event.reason?.message || String(event.reason),
        error_stack: event.reason?.stack,
        timestamp: Date.now(),
      });
    });
  }

  /**
   * 初始化路由追踪（Next.js）
   */
  private initRouteTracking() {
    // 监听路由变化（Next.js Router事件）
    if (typeof window !== 'undefined' && (window as any).next?.router) {
      const router = (window as any).next.router;

      router.events.on('routeChangeComplete', (url: string) => {
        // 记录页面PV
        this.recordMetric({
          page: url,
          metric_name: 'PV',
          metric_value: 1,
          rating: 'good',
          timestamp: Date.now(),
        });

        logger.info(`页面切换: ${url}`, { action: 'route_change' });
      });
    }
  }

  /**
   * 记录性能指标
   */
  recordMetric(metric: Omit<PagePerformanceMetric, 'user_agent' | 'session_id' | 'user_id'>) {
    const fullMetric: PagePerformanceMetric = {
      ...metric,
      user_agent: navigator.userAgent,
      session_id: this.sessionId,
      user_id: this.userId,
    };

    this.metrics.push(fullMetric);

    // 限制内存大小
    if (this.metrics.length > this.maxRecordsInMemory) {
      this.metrics.shift();
    }

    // 记录到结构化日志
    logger.info(`页面性能指标: ${metric.metric_name} = ${metric.metric_value}`, {
      action: 'page_performance',
    }, {
      page: metric.page,
      metric_name: metric.metric_name,
      metric_value: metric.metric_value,
      rating: metric.rating,
    });
  }

  /**
   * 记录错误
   */
  recordError(error: Omit<PageErrorRecord, 'user_agent' | 'session_id' | 'user_id'>) {
    const fullError: PageErrorRecord = {
      ...error,
      user_agent: navigator.userAgent,
      session_id: this.sessionId,
      user_id: this.userId,
    };

    this.errors.push(fullError);

    // 限制内存大小
    if (this.errors.length > this.maxRecordsInMemory) {
      this.errors.shift();
    }

    // 记录到结构化日志
    logger.error(`页面错误: ${error.error_type}`, new Error(error.error_message), {
      action: 'page_error',
    }, {
      page: error.page,
      error_type: error.error_type,
    });
  }

  /**
   * 上报数据到服务器
   */
  private async flushData() {
    if (this.metrics.length === 0 && this.errors.length === 0) return;

    const metricsToSend = [...this.metrics];
    const errorsToSend = [...this.errors];

    this.metrics = [];
    this.errors = [];

    try {
      await fetch('/api/metrics/page-performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metrics: metricsToSend,
          errors: errorsToSend,
          session_id: this.sessionId,
          user_id: this.userId,
          timestamp: Date.now(),
        }),
      });

      if (process.env.NODE_ENV === 'development') {
        console.log(`[页面性能] 上报 ${metricsToSend.length} 条指标, ${errorsToSend.length} 条错误`);
      }
    } catch (error) {
      console.error('[页面性能] 上报失败:', error);
      // 失败时重新加入队列（最多保留100条）
      this.metrics = [...metricsToSend.slice(-100), ...this.metrics];
      this.errors = [...errorsToSend.slice(-100), ...this.errors];
    }
  }

  /**
   * 手动上报数据
   */
  async flush() {
    await this.flushData();
  }

  /**
   * 获取当前内存中的指标数据
   */
  getMetrics(): PagePerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * 获取当前内存中的错误数据
   */
  getErrors(): PageErrorRecord[] {
    return [...this.errors];
  }

  /**
   * 计算页面性能聚合数据
   */
  calculateAggregation(page: string, startDate?: string, endDate?: string): PagePerformanceAggregation {
    // 过滤指定页面和时间范围的指标
    let metrics = this.metrics.filter((m) => m.page === page);

    if (startDate || endDate) {
      const start = startDate ? new Date(startDate).getTime() : 0;
      const end = endDate ? new Date(endDate).getTime() : Date.now();
      metrics = metrics.filter((m) => m.timestamp >= start && m.timestamp <= end);
    }

    // 按指标类型分组
    const metricsByType: Record<string, number[]> = {
      LCP: [],
      FCP: [],
      TTFB: [],
      CLS: [],
      FID: [],
    };

    metrics.forEach((m) => {
      if (metricsByType[m.metric_name]) {
        metricsByType[m.metric_name].push(m.metric_value);
      }
    });

    // 计算百分位数
    const calculatePercentiles = (values: number[]) => {
      if (values.length === 0) return { p50: 0, p95: 0, p99: 0, count: 0 };

      const sorted = [...values].sort((a, b) => a - b);
      return {
        p50: sorted[Math.floor(sorted.length * 0.5)] || 0,
        p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
        p99: sorted[Math.floor(sorted.length * 0.99)] || 0,
        count: sorted.length,
      };
    };

    // 计算错误率
    const errors = this.errors.filter((e) => e.page === page);
    const errorRate = metrics.length > 0 ? errors.length / metrics.length : 0;

    // 计算PV/UV
    const pvCount = metrics.filter((m) => m.metric_name === 'PV').length;
    const uvCount = new Set(metrics.map((m) => m.user_id).filter(Boolean)).size;

    return {
      page,
      time_range: {
        start: startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end: endDate || new Date().toISOString(),
      },
      metrics: {
        lcp: calculatePercentiles(metricsByType.LCP),
        fcp: calculatePercentiles(metricsByType.FCP),
        ttfb: calculatePercentiles(metricsByType.TTFB),
        cls: calculatePercentiles(metricsByType.CLS),
        fid: calculatePercentiles(metricsByType.FID),
      },
      error_rate: errorRate,
      pv_count: pvCount,
      uv_count: uvCount,
    };
  }
}

// 导出单例
export const pagePerformanceMonitor = new PagePerformanceMonitor();

// 自动初始化（仅在浏览器环境）
if (typeof window !== 'undefined') {
  pagePerformanceMonitor.init();
}
