/**
 * Web Vitals 监控和告警
 * 艹！性能数据不仅要收集，还要告警！
 *
 * @author 老王
 */

import { onCLS, onLCP, onINP, onFCP, onTTFB, type Metric } from 'web-vitals';
import { logger, type VitalsData } from './logger';

/**
 * Vitals 阈值配置
 */
export interface VitalsThresholds {
  // Cumulative Layout Shift (累积布局偏移)
  CLS: {
    good: number; // < 0.1
    poor: number; // > 0.25
  };
  // Largest Contentful Paint (最大内容绘制)
  LCP: {
    good: number; // < 2500ms
    poor: number; // > 4000ms
  };
  // Interaction to Next Paint (交互到下一次绘制)
  INP: {
    good: number; // < 200ms
    poor: number; // > 500ms
  };
  // First Contentful Paint (首次内容绘制)
  FCP: {
    good: number; // < 1800ms
    poor: number; // > 3000ms
  };
  // Time to First Byte (首字节时间)
  TTFB: {
    good: number; // < 800ms
    poor: number; // > 1800ms
  };
}

/**
 * 默认阈值（基于Web Vitals推荐）
 */
export const DEFAULT_THRESHOLDS: VitalsThresholds = {
  CLS: { good: 0.1, poor: 0.25 },
  LCP: { good: 2500, poor: 4000 },
  INP: { good: 200, poor: 500 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
};

/**
 * 评级函数
 */
export function getRating(
  name: string,
  value: number,
  thresholds: VitalsThresholds
): 'good' | 'needs-improvement' | 'poor' {
  const threshold = thresholds[name as keyof VitalsThresholds];
  if (!threshold) return 'good';

  if (value <= threshold.good) {
    return 'good';
  } else if (value <= threshold.poor) {
    return 'needs-improvement';
  } else {
    return 'poor';
  }
}

/**
 * Vitals 监控器
 */
export class VitalsMonitor {
  private thresholds: VitalsThresholds;
  private onAlert?: (metric: VitalsData) => void;

  constructor(thresholds?: Partial<VitalsThresholds>, onAlert?: (metric: VitalsData) => void) {
    this.thresholds = {
      ...DEFAULT_THRESHOLDS,
      ...thresholds,
    };
    this.onAlert = onAlert;
  }

  /**
   * 初始化监控
   */
  init() {
    const handleMetric = (metric: Metric) => {
      const rating = getRating(metric.name, metric.value, this.thresholds);

      const vitalsData: VitalsData = {
        name: metric.name,
        value: metric.value,
        rating,
        delta: metric.delta,
        id: metric.id,
      };

      // 记录日志
      logger.vitals(vitalsData);

      // 触发告警
      if (rating === 'poor') {
        this.triggerAlert(vitalsData);
      }

      // 上报到APM（如果启用）
      this.reportToAPM(vitalsData);
    };

    // 监听各项指标
    onCLS(handleMetric);
    onLCP(handleMetric);
    onINP(handleMetric);
    onFCP(handleMetric);
    onTTFB(handleMetric);
  }

  /**
   * 触发告警
   */
  private triggerAlert(metric: VitalsData) {
    // 调用自定义告警处理
    this.onAlert?.(metric);

    // 记录到日志
    logger.warn(`性能指标异常: ${metric.name} = ${metric.value} (评级: ${metric.rating})`, {
      action: 'vitals_alert',
    });

    // 上报到Sentry
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureMessage(`Poor Vitals: ${metric.name}`, {
        level: 'warning',
        tags: {
          vitals: metric.name,
          rating: metric.rating,
        },
        extra: {
          value: metric.value,
          delta: metric.delta,
        },
      });
    }

    // 如果启用了浏览器通知，弹出通知（仅开发环境）
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      this.showDevAlert(metric);
    }
  }

  /**
   * 开发环境弹窗告警
   */
  private showDevAlert(metric: VitalsData) {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('性能告警', {
        body: `${metric.name}: ${metric.value.toFixed(2)} (${metric.rating})`,
        icon: '/icon-warning.png',
      });
    }
  }

  /**
   * 上报到APM
   */
  private reportToAPM(metric: VitalsData) {
    // 仅生产环境上报
    if (process.env.NODE_ENV !== 'production') {
      return;
    }

    const apmUrl = process.env.NEXT_PUBLIC_APM_URL;
    if (!apmUrl) {
      return;
    }

    // 异步上报，不阻塞主线程
    setTimeout(() => {
      fetch(apmUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'vitals',
          metric,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent,
        }),
        keepalive: true, // 保证页面卸载时也能上报
      }).catch((error) => {
        console.error('[VitalsMonitor] Failed to report to APM:', error);
      });
    }, 0);
  }

  /**
   * 更新阈值
   */
  updateThresholds(thresholds: Partial<VitalsThresholds>) {
    this.thresholds = {
      ...this.thresholds,
      ...thresholds,
    };
  }

  /**
   * 获取当前阈值
   */
  getThresholds(): VitalsThresholds {
    return { ...this.thresholds };
  }
}

// 单例
let vitalsMonitorInstance: VitalsMonitor | null = null;

/**
 * 初始化Vitals监控
 */
export function initVitalsMonitor(
  thresholds?: Partial<VitalsThresholds>,
  onAlert?: (metric: VitalsData) => void
): VitalsMonitor {
  if (!vitalsMonitorInstance) {
    vitalsMonitorInstance = new VitalsMonitor(thresholds, onAlert);
    vitalsMonitorInstance.init();
  }
  return vitalsMonitorInstance;
}

/**
 * 获取Vitals监控实例
 */
export function getVitalsMonitor(): VitalsMonitor | null {
  return vitalsMonitorInstance;
}

/**
 * 手动记录性能指标
 */
export function reportCustomMetric(name: string, value: number, rating?: 'good' | 'needs-improvement' | 'poor') {
  const vitalsData: VitalsData = {
    name,
    value,
    rating: rating || 'good',
  };

  logger.vitals(vitalsData);

  // 上报到APM
  if (vitalsMonitorInstance) {
    (vitalsMonitorInstance as any).reportToAPM(vitalsData);
  }
}
