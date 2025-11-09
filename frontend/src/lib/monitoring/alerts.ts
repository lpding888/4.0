/**
 * REL-P2-ALERT-213: 前端告警基线
 * 艹！关键错误和性能问题必须及时发现和处理！
 *
 * @author 老王
 */

/**
 * 告警级别
 */
export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * 告警类型
 */
export enum AlertType {
  /** 错误告警 */
  ERROR = 'error',
  /** 性能告警 */
  PERFORMANCE = 'performance',
  /** 业务告警 */
  BUSINESS = 'business',
  /** 安全告警 */
  SECURITY = 'security',
}

/**
 * 告警配置
 */
export interface AlertConfig {
  /** 告警名称 */
  name: string;
  /** 告警类型 */
  type: AlertType;
  /** 告警级别 */
  level: AlertLevel;
  /** 阈值 */
  threshold: number;
  /** 时间窗口（分钟） */
  timeWindow: number;
  /** 触发条件描述 */
  condition: string;
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 默认告警配置
 */
export const DEFAULT_ALERT_CONFIGS: Record<string, AlertConfig> = {
  // 错误告警
  ERROR_RATE: {
    name: '错误率告警',
    type: AlertType.ERROR,
    level: AlertLevel.CRITICAL,
    threshold: 0.05, // 5%错误率
    timeWindow: 5, // 5分钟
    condition: '5分钟内错误率超过5%',
    enabled: true,
  },

  CRITICAL_ERROR: {
    name: '严重错误告警',
    type: AlertType.ERROR,
    level: AlertLevel.CRITICAL,
    threshold: 1, // 1次
    timeWindow: 1, // 1分钟
    condition: '出现严重错误（如支付失败、数据丢失）',
    enabled: true,
  },

  // 性能告警
  LCP_THRESHOLD: {
    name: 'LCP性能告警',
    type: AlertType.PERFORMANCE,
    level: AlertLevel.WARNING,
    threshold: 2500, // 2.5秒
    timeWindow: 10, // 10分钟
    condition: '10分钟内LCP中位数超过2.5秒',
    enabled: true,
  },

  INP_THRESHOLD: {
    name: 'INP交互告警',
    type: AlertType.PERFORMANCE,
    level: AlertLevel.WARNING,
    threshold: 200, // 200ms
    timeWindow: 10, // 10分钟
    condition: '10分钟内INP中位数超过200ms',
    enabled: true,
  },

  CLS_THRESHOLD: {
    name: 'CLS布局偏移告警',
    type: AlertType.PERFORMANCE,
    level: AlertLevel.WARNING,
    threshold: 0.1, // 0.1
    timeWindow: 10, // 10分钟
    condition: '10分钟内CLS中位数超过0.1',
    enabled: true,
  },

  // 业务告警
  API_TIMEOUT: {
    name: 'API超时告警',
    type: AlertType.BUSINESS,
    level: AlertLevel.ERROR,
    threshold: 0.1, // 10%超时率
    timeWindow: 5, // 5分钟
    condition: '5分钟内API超时率超过10%',
    enabled: true,
  },

  UPLOAD_FAILURE: {
    name: '上传失败告警',
    type: AlertType.BUSINESS,
    level: AlertLevel.ERROR,
    threshold: 0.2, // 20%失败率
    timeWindow: 10, // 10分钟
    condition: '10分钟内上传失败率超过20%',
    enabled: true,
  },
};

/**
 * 告警记录
 */
export interface AlertRecord {
  id: string;
  config: AlertConfig;
  value: number;
  timestamp: Date;
  message: string;
  metadata?: Record<string, any>;
}

/**
 * 告警管理器
 */
export class AlertManager {
  private records: AlertRecord[] = [];
  private listeners: Map<string, (alert: AlertRecord) => void> = new Map();
  private metrics: Map<string, number[]> = new Map(); // 存储时间窗口内的指标

  /**
   * 记录指标
   */
  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const values = this.metrics.get(name)!;
    values.push(value);

    // 只保留最近1小时的数据
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const filtered = values.filter((_, index) => {
      const timestamp = Date.now() - (values.length - index) * 1000;
      return timestamp > oneHourAgo;
    });

    this.metrics.set(name, filtered);
  }

  /**
   * 检查告警阈值
   */
  checkThreshold(configName: string): AlertRecord | null {
    const config = DEFAULT_ALERT_CONFIGS[configName];
    if (!config || !config.enabled) return null;

    const values = this.metrics.get(configName) || [];
    if (values.length === 0) return null;

    // 计算时间窗口内的中位数
    const windowMs = config.timeWindow * 60 * 1000;
    const now = Date.now();
    const windowValues = values.filter((_, index) => {
      const timestamp = now - (values.length - index) * 1000;
      return now - timestamp <= windowMs;
    });

    if (windowValues.length === 0) return null;

    // 计算中位数
    const sorted = [...windowValues].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;

    // 检查是否超过阈值
    if (median > config.threshold) {
      const alert: AlertRecord = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        config,
        value: median,
        timestamp: new Date(),
        message: `${config.name}: ${median.toFixed(2)} 超过阈值 ${config.threshold}`,
        metadata: {
          values: windowValues,
          count: windowValues.length,
        },
      };

      this.records.push(alert);
      this.triggerAlert(alert);
      return alert;
    }

    return null;
  }

  /**
   * 触发告警
   */
  private triggerAlert(alert: AlertRecord): void {
    console.error('[Alert]', alert.message, alert);

    // 通知所有监听器
    this.listeners.forEach((listener) => {
      try {
        listener(alert);
      } catch (error) {
        console.error('[Alert] Listener error:', error);
      }
    });

    // 上报到Sentry（如果启用）
    this.reportToSentry(alert);

    // 发送到后端（如果配置）
    this.reportToBackend(alert);
  }

  /**
   * 上报到Sentry
   */
  private reportToSentry(alert: AlertRecord): void {
    // TODO: 接入真实的Sentry
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureMessage(alert.message, {
        level: alert.config.level as any,
        tags: {
          alert_type: alert.config.type,
          alert_name: alert.config.name,
        },
        extra: {
          value: alert.value,
          threshold: alert.config.threshold,
          metadata: alert.metadata,
        },
      });
    }
  }

  /**
   * 上报到后端
   */
  private async reportToBackend(alert: AlertRecord): Promise<void> {
    try {
      await fetch('/api/monitoring/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert),
      });
    } catch (error) {
      console.error('[Alert] Failed to report to backend:', error);
    }
  }

  /**
   * 添加告警监听器
   */
  addListener(name: string, listener: (alert: AlertRecord) => void): void {
    this.listeners.set(name, listener);
  }

  /**
   * 移除告警监听器
   */
  removeListener(name: string): void {
    this.listeners.delete(name);
  }

  /**
   * 获取告警历史
   */
  getRecords(limit: number = 100): AlertRecord[] {
    return this.records.slice(-limit);
  }

  /**
   * 清除告警历史
   */
  clearRecords(): void {
    this.records = [];
  }
}

/**
 * 全局告警管理器实例
 */
export const globalAlertManager = new AlertManager();

/**
 * Web Vitals告警监控
 */
export function monitorWebVitals() {
  if (typeof window === 'undefined') return;

  import('web-vitals').then(({ onCLS, onLCP, onINP }) => {
    // 监控LCP
    onLCP((metric) => {
      globalAlertManager.recordMetric('LCP_THRESHOLD', metric.value);
      globalAlertManager.checkThreshold('LCP_THRESHOLD');
    });

    // 监控INP
    onINP((metric) => {
      globalAlertManager.recordMetric('INP_THRESHOLD', metric.value);
      globalAlertManager.checkThreshold('INP_THRESHOLD');
    });

    // 监控CLS
    onCLS((metric) => {
      globalAlertManager.recordMetric('CLS_THRESHOLD', metric.value);
      globalAlertManager.checkThreshold('CLS_THRESHOLD');
    });
  });
}

/**
 * 错误率监控
 */
export function monitorErrorRate() {
  if (typeof window === 'undefined') return;

  let totalRequests = 0;
  let errorRequests = 0;

  // 拦截全局错误
  window.addEventListener('error', () => {
    errorRequests++;
    const errorRate = errorRequests / Math.max(totalRequests, 1);
    globalAlertManager.recordMetric('ERROR_RATE', errorRate);
    globalAlertManager.checkThreshold('ERROR_RATE');
  });

  // 拦截Promise错误
  window.addEventListener('unhandledrejection', () => {
    errorRequests++;
    const errorRate = errorRequests / Math.max(totalRequests, 1);
    globalAlertManager.recordMetric('ERROR_RATE', errorRate);
    globalAlertManager.checkThreshold('ERROR_RATE');
  });

  // 定期计算错误率
  setInterval(() => {
    if (totalRequests > 0) {
      const errorRate = errorRequests / totalRequests;
      globalAlertManager.recordMetric('ERROR_RATE', errorRate);
      globalAlertManager.checkThreshold('ERROR_RATE');

      // 重置计数器
      totalRequests = 0;
      errorRequests = 0;
    }
  }, 60 * 1000); // 每分钟检查一次
}

/**
 * 初始化所有告警监控
 */
export function initAlertMonitoring() {
  if (process.env.NEXT_PUBLIC_ENABLE_ALERTS !== 'true') {
    console.log('[Alerts] Alert monitoring disabled');
    return;
  }

  monitorWebVitals();
  monitorErrorRate();

  console.log('[Alerts] Alert monitoring initialized');
}

/**
 * 导出所有工具
 */
export default {
  AlertLevel,
  AlertType,
  DEFAULT_ALERT_CONFIGS,
  AlertManager,
  globalAlertManager,
  monitorWebVitals,
  monitorErrorRate,
  initAlertMonitoring,
};
