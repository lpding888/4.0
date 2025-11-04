/**
 * REL-P2-ALERT-213: 告警规则配置
 * 艹！告警规则必须清晰，不能漏报也不能误报！
 *
 * @author 老王
 */

import { AlertConfig, AlertLevel, AlertType } from './alerts';

/**
 * Sentry告警规则
 */
export const SENTRY_ALERT_RULES: Record<string, AlertConfig> = {
  // 严重错误：支付失败
  PAYMENT_FAILURE: {
    name: '支付失败告警',
    type: AlertType.ERROR,
    level: AlertLevel.CRITICAL,
    threshold: 1,
    timeWindow: 1,
    condition: '1分钟内出现1次支付失败',
    enabled: true,
  },

  // 严重错误：数据丢失
  DATA_LOSS: {
    name: '数据丢失告警',
    type: AlertType.ERROR,
    level: AlertLevel.CRITICAL,
    threshold: 1,
    timeWindow: 1,
    condition: '1分钟内出现1次数据丢失',
    enabled: true,
  },

  // 严重错误：认证失败
  AUTH_FAILURE: {
    name: '认证失败告警',
    type: AlertType.SECURITY,
    level: AlertLevel.CRITICAL,
    threshold: 10,
    timeWindow: 5,
    condition: '5分钟内认证失败超过10次',
    enabled: true,
  },

  // 错误：API调用失败
  API_ERROR: {
    name: 'API错误告警',
    type: AlertType.ERROR,
    level: AlertLevel.ERROR,
    threshold: 0.1, // 10%
    timeWindow: 5,
    condition: '5分钟内API错误率超过10%',
    enabled: true,
  },

  // 错误：资源加载失败
  RESOURCE_LOAD_ERROR: {
    name: '资源加载失败告警',
    type: AlertType.ERROR,
    level: AlertLevel.WARNING,
    threshold: 0.05, // 5%
    timeWindow: 10,
    condition: '10分钟内资源加载失败率超过5%',
    enabled: true,
  },
};

/**
 * Web Vitals告警规则
 */
export const WEB_VITALS_ALERT_RULES: Record<string, AlertConfig> = {
  // LCP (Largest Contentful Paint)
  LCP_POOR: {
    name: 'LCP性能差告警',
    type: AlertType.PERFORMANCE,
    level: AlertLevel.ERROR,
    threshold: 4000, // 4秒（差）
    timeWindow: 10,
    condition: '10分钟内LCP中位数超过4秒',
    enabled: true,
  },

  LCP_NEEDS_IMPROVEMENT: {
    name: 'LCP性能待改善告警',
    type: AlertType.PERFORMANCE,
    level: AlertLevel.WARNING,
    threshold: 2500, // 2.5秒（待改善）
    timeWindow: 10,
    condition: '10分钟内LCP中位数超过2.5秒',
    enabled: true,
  },

  // INP (Interaction to Next Paint)
  INP_POOR: {
    name: 'INP交互差告警',
    type: AlertType.PERFORMANCE,
    level: AlertLevel.ERROR,
    threshold: 500, // 500ms（差）
    timeWindow: 10,
    condition: '10分钟内INP中位数超过500ms',
    enabled: true,
  },

  INP_NEEDS_IMPROVEMENT: {
    name: 'INP交互待改善告警',
    type: AlertType.PERFORMANCE,
    level: AlertLevel.WARNING,
    threshold: 200, // 200ms（待改善）
    timeWindow: 10,
    condition: '10分钟内INP中位数超过200ms',
    enabled: true,
  },

  // CLS (Cumulative Layout Shift)
  CLS_POOR: {
    name: 'CLS布局偏移差告警',
    type: AlertType.PERFORMANCE,
    level: AlertLevel.ERROR,
    threshold: 0.25, // 0.25（差）
    timeWindow: 10,
    condition: '10分钟内CLS中位数超过0.25',
    enabled: true,
  },

  CLS_NEEDS_IMPROVEMENT: {
    name: 'CLS布局偏移待改善告警',
    type: AlertType.PERFORMANCE,
    level: AlertLevel.WARNING,
    threshold: 0.1, // 0.1（待改善）
    timeWindow: 10,
    condition: '10分钟内CLS中位数超过0.1',
    enabled: true,
  },
};

/**
 * 业务告警规则
 */
export const BUSINESS_ALERT_RULES: Record<string, AlertConfig> = {
  // 上传失败
  UPLOAD_HIGH_FAILURE_RATE: {
    name: '上传高失败率告警',
    type: AlertType.BUSINESS,
    level: AlertLevel.ERROR,
    threshold: 0.3, // 30%
    timeWindow: 10,
    condition: '10分钟内上传失败率超过30%',
    enabled: true,
  },

  UPLOAD_MODERATE_FAILURE_RATE: {
    name: '上传中失败率告警',
    type: AlertType.BUSINESS,
    level: AlertLevel.WARNING,
    threshold: 0.1, // 10%
    timeWindow: 10,
    condition: '10分钟内上传失败率超过10%',
    enabled: true,
  },

  // 生成任务
  GENERATION_TIMEOUT: {
    name: '生成任务超时告警',
    type: AlertType.BUSINESS,
    level: AlertLevel.WARNING,
    threshold: 0.1, // 10%
    timeWindow: 15,
    condition: '15分钟内生成任务超时率超过10%',
    enabled: true,
  },

  GENERATION_FAILURE: {
    name: '生成任务失败告警',
    type: AlertType.BUSINESS,
    level: AlertLevel.ERROR,
    threshold: 0.15, // 15%
    timeWindow: 10,
    condition: '10分钟内生成任务失败率超过15%',
    enabled: true,
  },

  // Provider连接
  PROVIDER_CONNECTION_FAILURE: {
    name: 'Provider连接失败告警',
    type: AlertType.BUSINESS,
    level: AlertLevel.CRITICAL,
    threshold: 0.2, // 20%
    timeWindow: 5,
    condition: '5分钟内Provider连接失败率超过20%',
    enabled: true,
  },

  // 缓存
  CACHE_HIT_RATE_LOW: {
    name: '缓存命中率低告警',
    type: AlertType.PERFORMANCE,
    level: AlertLevel.INFO,
    threshold: 0.5, // 50%
    timeWindow: 30,
    condition: '30分钟内缓存命中率低于50%',
    enabled: false, // 默认关闭
  },
};

/**
 * 所有告警规则
 */
export const ALL_ALERT_RULES: Record<string, AlertConfig> = {
  ...SENTRY_ALERT_RULES,
  ...WEB_VITALS_ALERT_RULES,
  ...BUSINESS_ALERT_RULES,
};

/**
 * Web Vitals阈值参考（Google标准）
 */
export const WEB_VITALS_THRESHOLDS = {
  LCP: {
    good: 2500, // 2.5秒
    needsImprovement: 4000, // 4秒
    poor: Infinity,
  },
  INP: {
    good: 200, // 200ms
    needsImprovement: 500, // 500ms
    poor: Infinity,
  },
  CLS: {
    good: 0.1,
    needsImprovement: 0.25,
    poor: Infinity,
  },
};

/**
 * 告警通知渠道配置
 */
export interface AlertChannel {
  name: string;
  type: 'email' | 'slack' | 'dingtalk' | 'webhook';
  enabled: boolean;
  config: Record<string, any>;
}

/**
 * 默认通知渠道
 */
export const DEFAULT_ALERT_CHANNELS: AlertChannel[] = [
  {
    name: '邮件通知',
    type: 'email',
    enabled: true,
    config: {
      recipients: ['dev@example.com'],
      criticalOnly: false,
    },
  },
  {
    name: 'Slack通知',
    type: 'slack',
    enabled: false,
    config: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
      channel: '#alerts',
    },
  },
  {
    name: '钉钉通知',
    type: 'dingtalk',
    enabled: false,
    config: {
      webhookUrl: process.env.DINGTALK_WEBHOOK_URL || '',
      atMobiles: [],
      isAtAll: false,
    },
  },
];

/**
 * 导出所有配置
 */
export default {
  SENTRY_ALERT_RULES,
  WEB_VITALS_ALERT_RULES,
  BUSINESS_ALERT_RULES,
  ALL_ALERT_RULES,
  WEB_VITALS_THRESHOLDS,
  DEFAULT_ALERT_CHANNELS,
};
