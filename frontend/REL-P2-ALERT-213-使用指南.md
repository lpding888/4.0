# REL-P2-ALERT-213: 前端告警基线使用指南

> **艹！关键错误和性能问题必须第一时间发现！**
> 老王我搞了一套完整的告警系统，支持错误率、性能指标、业务指标监控！

---

## 📋 目录

- [系统概述](#系统概述)
- [核心概念](#核心概念)
- [快速开始](#快速开始)
- [告警管理器 API](#告警管理器-api)
- [告警规则配置](#告警规则配置)
- [Web Vitals 监控](#web-vitals-监控)
- [用户反馈系统](#用户反馈系统)
- [Sentry 集成](#sentry-集成)
- [自定义告警规则](#自定义告警规则)
- [最佳实践](#最佳实践)
- [故障排查](#故障排查)

---

## 系统概述

### 功能特性

✅ **错误率监控**：自动监控全局错误和未捕获 Promise
✅ **Web Vitals 监控**：LCP、INP、CLS 性能指标
✅ **业务指标监控**：上传成功率、生成任务成功率、Provider 连接状态
✅ **多级告警**：INFO / WARNING / ERROR / CRITICAL 四级告警
✅ **多渠道通知**：邮件、Slack、钉钉、Webhook
✅ **用户反馈**：浮动按钮 + 会话跟踪 + 告警附件
✅ **Sentry 集成**：自动上报关键告警到 Sentry

### 技术栈

- **监控库**：`web-vitals` (Google 官方库)
- **UI 组件**：Ant Design (FloatButton, Modal, Form)
- **上报集成**：Sentry SDK

---

## 核心概念

### 告警类型 (AlertType)

```typescript
export enum AlertType {
  ERROR = 'error',           // 错误类告警
  PERFORMANCE = 'performance', // 性能类告警
  BUSINESS = 'business',     // 业务类告警
  SECURITY = 'security',     // 安全类告警
}
```

### 告警级别 (AlertLevel)

```typescript
export enum AlertLevel {
  INFO = 'info',         // 信息：仅记录，不发送通知
  WARNING = 'warning',   // 警告：发送通知给开发团队
  ERROR = 'error',       // 错误：发送通知给开发团队 + 值班人员
  CRITICAL = 'critical', // 严重：发送通知给所有人 + 立即响应
}
```

### 告警配置 (AlertConfig)

```typescript
export interface AlertConfig {
  name: string;              // 告警名称
  type: AlertType;           // 告警类型
  level: AlertLevel;         // 告警级别
  threshold: number;         // 阈值
  timeWindow: number;        // 时间窗口（分钟）
  condition: string;         // 触发条件描述
  enabled: boolean;          // 是否启用
}
```

---

## 快速开始

### 1. 初始化告警监控

在应用入口（如 `layout.tsx` 或 `_app.tsx`）初始化告警监控：

```tsx
'use client';

import { useEffect } from 'react';
import { initializeAlertMonitoring } from '@/lib/monitoring/alerts';

export default function RootLayout({ children }) {
  useEffect(() => {
    // 初始化告警监控
    initializeAlertMonitoring();

    console.log('✅ 告警监控已启动');
  }, []);

  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
```

### 2. 添加用户反馈按钮

在主布局中添加浮动反馈按钮：

```tsx
import FeedbackButton from '@/components/FeedbackButton';

export default function MainLayout({ children }) {
  return (
    <>
      {children}
      <FeedbackButton />
    </>
  );
}
```

### 3. 记录业务指标

在关键业务流程中记录指标：

```typescript
import { globalAlertManager } from '@/lib/monitoring/alerts';

// 上传文件
async function uploadFile(file: File) {
  const startTime = Date.now();

  try {
    const result = await api.upload(file);

    // 记录成功
    globalAlertManager.recordMetric('UPLOAD_SUCCESS_RATE', 1);

    return result;
  } catch (error) {
    // 记录失败
    globalAlertManager.recordMetric('UPLOAD_SUCCESS_RATE', 0);

    // 检查阈值
    globalAlertManager.checkThreshold('UPLOAD_HIGH_FAILURE_RATE');

    throw error;
  }
}
```

---

## 告警管理器 API

### 全局实例

```typescript
import { globalAlertManager } from '@/lib/monitoring/alerts';
```

### 核心方法

#### recordMetric(name, value)

记录指标数据，用于后续阈值检查。

```typescript
// 记录错误率（0 = 成功，1 = 失败）
globalAlertManager.recordMetric('ERROR_RATE', 1);

// 记录 LCP 性能指标（毫秒）
globalAlertManager.recordMetric('LCP_THRESHOLD', 2800);

// 记录上传成功率（0 = 失败，1 = 成功）
globalAlertManager.recordMetric('UPLOAD_SUCCESS_RATE', 0);
```

**参数说明**：
- `name`：指标名称（对应告警配置的 key）
- `value`：指标值（数值）

#### checkThreshold(configName)

检查指标是否超过阈值，如果超过则触发告警。

```typescript
const alert = globalAlertManager.checkThreshold('UPLOAD_HIGH_FAILURE_RATE');

if (alert) {
  console.log(`🚨 告警触发：${alert.name}`);
}
```

**返回值**：`AlertRecord | null`

#### getRecords(limit?)

获取最近的告警记录。

```typescript
// 获取最近 10 条告警
const recentAlerts = globalAlertManager.getRecords(10);

console.log('最近告警：', recentAlerts);
```

#### addListener(listener)

添加告警监听器，当触发告警时自动回调。

```typescript
globalAlertManager.addListener((alert) => {
  console.log(`🔔 新告警：${alert.name}`);

  // 自定义处理逻辑
  if (alert.level === AlertLevel.CRITICAL) {
    // 发送紧急通知
    sendUrgentNotification(alert);
  }
});
```

#### removeListener(listener)

移除告警监听器。

```typescript
const listener = (alert) => { /* ... */ };

globalAlertManager.addListener(listener);

// 稍后移除
globalAlertManager.removeListener(listener);
```

---

## 告警规则配置

### 内置告警规则

#### 1. Sentry 告警规则

**支付失败**（CRITICAL）

```typescript
PAYMENT_FAILURE: {
  name: '支付失败告警',
  type: AlertType.ERROR,
  level: AlertLevel.CRITICAL,
  threshold: 1,
  timeWindow: 1,
  condition: '1分钟内出现1次支付失败',
  enabled: true,
}
```

**数据丢失**（CRITICAL）

```typescript
DATA_LOSS: {
  name: '数据丢失告警',
  type: AlertType.ERROR,
  level: AlertLevel.CRITICAL,
  threshold: 1,
  timeWindow: 1,
  condition: '1分钟内出现1次数据丢失',
  enabled: true,
}
```

**认证失败**（CRITICAL）

```typescript
AUTH_FAILURE: {
  name: '认证失败告警',
  type: AlertType.SECURITY,
  level: AlertLevel.CRITICAL,
  threshold: 10,
  timeWindow: 5,
  condition: '5分钟内认证失败超过10次',
  enabled: true,
}
```

**API 错误**（ERROR）

```typescript
API_ERROR: {
  name: 'API错误告警',
  type: AlertType.ERROR,
  level: AlertLevel.ERROR,
  threshold: 0.1, // 10%
  timeWindow: 5,
  condition: '5分钟内API错误率超过10%',
  enabled: true,
}
```

#### 2. Web Vitals 告警规则

**LCP (Largest Contentful Paint)**

```typescript
// LCP 性能差（> 4秒）
LCP_POOR: {
  name: 'LCP性能差告警',
  type: AlertType.PERFORMANCE,
  level: AlertLevel.ERROR,
  threshold: 4000, // 4秒
  timeWindow: 10,
  condition: '10分钟内LCP中位数超过4秒',
  enabled: true,
}

// LCP 待改善（> 2.5秒）
LCP_NEEDS_IMPROVEMENT: {
  name: 'LCP性能待改善告警',
  type: AlertType.PERFORMANCE,
  level: AlertLevel.WARNING,
  threshold: 2500, // 2.5秒
  timeWindow: 10,
  condition: '10分钟内LCP中位数超过2.5秒',
  enabled: true,
}
```

**INP (Interaction to Next Paint)**

```typescript
// INP 交互差（> 500ms）
INP_POOR: {
  name: 'INP交互差告警',
  type: AlertType.PERFORMANCE,
  level: AlertLevel.ERROR,
  threshold: 500, // 500ms
  timeWindow: 10,
  condition: '10分钟内INP中位数超过500ms',
  enabled: true,
}

// INP 待改善（> 200ms）
INP_NEEDS_IMPROVEMENT: {
  name: 'INP交互待改善告警',
  type: AlertType.PERFORMANCE,
  level: AlertLevel.WARNING,
  threshold: 200, // 200ms
  timeWindow: 10,
  condition: '10分钟内INP中位数超过200ms',
  enabled: true,
}
```

**CLS (Cumulative Layout Shift)**

```typescript
// CLS 布局偏移差（> 0.25）
CLS_POOR: {
  name: 'CLS布局偏移差告警',
  type: AlertType.PERFORMANCE,
  level: AlertLevel.ERROR,
  threshold: 0.25,
  timeWindow: 10,
  condition: '10分钟内CLS中位数超过0.25',
  enabled: true,
}

// CLS 待改善（> 0.1）
CLS_NEEDS_IMPROVEMENT: {
  name: 'CLS布局偏移待改善告警',
  type: AlertType.PERFORMANCE,
  level: AlertLevel.WARNING,
  threshold: 0.1,
  timeWindow: 10,
  condition: '10分钟内CLS中位数超过0.1',
  enabled: true,
}
```

#### 3. 业务告警规则

**上传失败率**

```typescript
// 高失败率（> 30%）
UPLOAD_HIGH_FAILURE_RATE: {
  name: '上传高失败率告警',
  type: AlertType.BUSINESS,
  level: AlertLevel.ERROR,
  threshold: 0.3, // 30%
  timeWindow: 10,
  condition: '10分钟内上传失败率超过30%',
  enabled: true,
}

// 中失败率（> 10%）
UPLOAD_MODERATE_FAILURE_RATE: {
  name: '上传中失败率告警',
  type: AlertType.BUSINESS,
  level: AlertLevel.WARNING,
  threshold: 0.1, // 10%
  timeWindow: 10,
  condition: '10分钟内上传失败率超过10%',
  enabled: true,
}
```

**生成任务**

```typescript
// 生成超时（> 10%）
GENERATION_TIMEOUT: {
  name: '生成任务超时告警',
  type: AlertType.BUSINESS,
  level: AlertLevel.WARNING,
  threshold: 0.1, // 10%
  timeWindow: 15,
  condition: '15分钟内生成任务超时率超过10%',
  enabled: true,
}

// 生成失败（> 15%）
GENERATION_FAILURE: {
  name: '生成任务失败告警',
  type: AlertType.BUSINESS,
  level: AlertLevel.ERROR,
  threshold: 0.15, // 15%
  timeWindow: 10,
  condition: '10分钟内生成任务失败率超过15%',
  enabled: true,
}
```

**Provider 连接**

```typescript
PROVIDER_CONNECTION_FAILURE: {
  name: 'Provider连接失败告警',
  type: AlertType.BUSINESS,
  level: AlertLevel.CRITICAL,
  threshold: 0.2, // 20%
  timeWindow: 5,
  condition: '5分钟内Provider连接失败率超过20%',
  enabled: true,
}
```

### Web Vitals 阈值参考（Google 标准）

```typescript
export const WEB_VITALS_THRESHOLDS = {
  LCP: {
    good: 2500,             // 2.5秒以下为优秀
    needsImprovement: 4000, // 2.5-4秒为待改善
    poor: Infinity,         // 4秒以上为差
  },
  INP: {
    good: 200,              // 200ms以下为优秀
    needsImprovement: 500,  // 200-500ms为待改善
    poor: Infinity,         // 500ms以上为差
  },
  CLS: {
    good: 0.1,              // 0.1以下为优秀
    needsImprovement: 0.25, // 0.1-0.25为待改善
    poor: Infinity,         // 0.25以上为差
  },
};
```

---

## Web Vitals 监控

### 自动监控

调用 `monitorWebVitals()` 会自动启用 LCP、INP、CLS 监控：

```typescript
import { monitorWebVitals } from '@/lib/monitoring/alerts';

// 在应用启动时调用一次
useEffect(() => {
  monitorWebVitals();
}, []);
```

### 手动记录

如果需要手动记录 Web Vitals 指标：

```typescript
import { onCLS, onLCP, onINP } from 'web-vitals';
import { globalAlertManager } from '@/lib/monitoring/alerts';

onLCP((metric) => {
  console.log('LCP:', metric.value);
  globalAlertManager.recordMetric('LCP_THRESHOLD', metric.value);
  globalAlertManager.checkThreshold('LCP_THRESHOLD');
});

onINP((metric) => {
  console.log('INP:', metric.value);
  globalAlertManager.recordMetric('INP_THRESHOLD', metric.value);
  globalAlertManager.checkThreshold('INP_THRESHOLD');
});

onCLS((metric) => {
  console.log('CLS:', metric.value);
  globalAlertManager.recordMetric('CLS_THRESHOLD', metric.value);
  globalAlertManager.checkThreshold('CLS_THRESHOLD');
});
```

---

## 用户反馈系统

### FeedbackButton 组件

浮动反馈按钮，支持用户快速反馈 Bug 和问题。

```tsx
import FeedbackButton from '@/components/FeedbackButton';

export default function App() {
  return (
    <>
      {/* 你的应用内容 */}
      <FeedbackButton />
    </>
  );
}
```

### 功能特性

✅ **会话跟踪**：自动生成唯一 Session ID
✅ **问题类型**：Bug、功能建议、性能问题、其他
✅ **自动附件**：最近 10 条告警记录
✅ **环境信息**：URL、UserAgent、时间戳
✅ **一键复制**：复制 Session ID 方便客服沟通

### 反馈数据结构

```typescript
interface FeedbackData {
  type: 'bug' | 'feature' | 'performance' | 'other';
  description: string;
  url: string;
  userAgent: string;
  timestamp: string;
  sessionId: string;
  recentAlerts: AlertRecord[];
}
```

### 后端 API

前端会将反馈数据 POST 到 `/api/feedback`：

```typescript
// 示例：backend/src/routes/feedback.route.ts
router.post('/api/feedback', async (req, res) => {
  const { type, description, url, sessionId, recentAlerts } = req.body;

  // 存储到数据库
  await db.feedbacks.insert({
    type,
    description,
    url,
    sessionId,
    recentAlerts: JSON.stringify(recentAlerts),
    createdAt: new Date(),
  });

  // 发送通知
  await notifyTeam({
    title: `用户反馈：${type}`,
    message: description,
    sessionId,
  });

  res.json({ success: true });
});
```

---

## Sentry 集成

### 自动上报告警

AlertManager 会自动将 ERROR 和 CRITICAL 级别的告警上报到 Sentry：

```typescript
private triggerAlert(alert: AlertRecord): void {
  // ...省略其他代码

  // 上报到 Sentry（ERROR 和 CRITICAL 级别）
  if (alert.level === AlertLevel.ERROR || alert.level === AlertLevel.CRITICAL) {
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      const Sentry = (window as any).Sentry;
      Sentry.captureMessage(alert.message, {
        level: alert.level === AlertLevel.CRITICAL ? 'error' : 'warning',
        tags: {
          alert_type: alert.type,
          alert_config: alert.config.name,
        },
        extra: {
          threshold: alert.config.threshold,
          timeWindow: alert.config.timeWindow,
          condition: alert.config.condition,
        },
      });
    }
  }
}
```

### 手动上报

如果需要手动上报特定告警：

```typescript
import * as Sentry from '@sentry/nextjs';

const alert = globalAlertManager.checkThreshold('PAYMENT_FAILURE');

if (alert) {
  Sentry.captureMessage(`支付失败告警触发`, {
    level: 'error',
    tags: {
      alert_type: 'error',
      alert_name: 'PAYMENT_FAILURE',
    },
    extra: {
      alertDetails: alert,
    },
  });
}
```

---

## 自定义告警规则

### 添加新规则

在 `src/lib/monitoring/alert-rules.ts` 中添加：

```typescript
export const CUSTOM_ALERT_RULES: Record<string, AlertConfig> = {
  // 自定义：搜索响应慢
  SEARCH_SLOW_RESPONSE: {
    name: '搜索响应慢告警',
    type: AlertType.PERFORMANCE,
    level: AlertLevel.WARNING,
    threshold: 3000, // 3秒
    timeWindow: 5,
    condition: '5分钟内搜索平均响应时间超过3秒',
    enabled: true,
  },

  // 自定义：AI 生成质量差
  AI_GENERATION_QUALITY_LOW: {
    name: 'AI生成质量差告警',
    type: AlertType.BUSINESS,
    level: AlertLevel.WARNING,
    threshold: 0.2, // 20%
    timeWindow: 30,
    condition: '30分钟内AI生成质量评分低于80分的比例超过20%',
    enabled: true,
  },
};
```

### 合并到全局规则

```typescript
export const ALL_ALERT_RULES: Record<string, AlertConfig> = {
  ...SENTRY_ALERT_RULES,
  ...WEB_VITALS_ALERT_RULES,
  ...BUSINESS_ALERT_RULES,
  ...CUSTOM_ALERT_RULES, // 添加自定义规则
};
```

### 使用自定义规则

```typescript
// 记录搜索响应时间
const startTime = Date.now();
const results = await searchAPI(query);
const duration = Date.now() - startTime;

globalAlertManager.recordMetric('SEARCH_SLOW_RESPONSE', duration);
globalAlertManager.checkThreshold('SEARCH_SLOW_RESPONSE');
```

---

## 最佳实践

### 1. 合理设置阈值

❌ **错误示例**：阈值过低，导致频繁误报

```typescript
ERROR_RATE: {
  threshold: 0.01, // 1% 太低了！
  timeWindow: 1,
}
```

✅ **正确示例**：根据历史数据设置合理阈值

```typescript
ERROR_RATE: {
  threshold: 0.05, // 5% 符合实际情况
  timeWindow: 5,
}
```

### 2. 分级告警

按照严重程度设置不同级别：

- **CRITICAL**：支付失败、数据丢失、系统崩溃
- **ERROR**：API 错误率高、性能严重下降
- **WARNING**：性能待改善、业务指标异常
- **INFO**：缓存命中率低、日常监控

### 3. 避免告警风暴

使用时间窗口避免短时间内重复告警：

```typescript
// 同一告警在 5 分钟内只触发一次
const lastAlert = this.records.find(
  (r) => r.config.name === config.name && Date.now() - r.timestamp < 5 * 60 * 1000
);

if (lastAlert) {
  return null; // 跳过重复告警
}
```

### 4. 关键流程必须监控

在所有关键业务流程中记录指标：

```typescript
// ✅ 上传文件
async function uploadFile(file: File) {
  try {
    await api.upload(file);
    globalAlertManager.recordMetric('UPLOAD_SUCCESS_RATE', 1);
  } catch (error) {
    globalAlertManager.recordMetric('UPLOAD_SUCCESS_RATE', 0);
    globalAlertManager.checkThreshold('UPLOAD_HIGH_FAILURE_RATE');
  }
}

// ✅ 生成任务
async function generateImage(params: GenerateParams) {
  try {
    const result = await api.generate(params);
    globalAlertManager.recordMetric('GENERATION_SUCCESS_RATE', 1);
    return result;
  } catch (error) {
    globalAlertManager.recordMetric('GENERATION_SUCCESS_RATE', 0);
    globalAlertManager.checkThreshold('GENERATION_FAILURE');
  }
}
```

### 5. 监听告警并自动处理

```typescript
globalAlertManager.addListener((alert) => {
  // 自动降级
  if (alert.config.name === 'PROVIDER_CONNECTION_FAILURE') {
    switchToBackupProvider();
  }

  // 自动扩容
  if (alert.config.name === 'API_TIMEOUT') {
    requestAutoScale();
  }

  // 发送通知
  if (alert.level === AlertLevel.CRITICAL) {
    sendUrgentNotification(alert);
  }
});
```

---

## 故障排查

### 问题 1：告警未触发

**可能原因**：
1. 告警规则未启用 (`enabled: false`)
2. 指标记录错误（名称不匹配）
3. 阈值设置过高

**排查步骤**：

```typescript
// 1. 检查告警配置
console.log('告警配置：', ALL_ALERT_RULES['UPLOAD_HIGH_FAILURE_RATE']);

// 2. 检查指标记录
globalAlertManager.recordMetric('UPLOAD_SUCCESS_RATE', 0);
console.log('指标已记录');

// 3. 手动检查阈值
const alert = globalAlertManager.checkThreshold('UPLOAD_HIGH_FAILURE_RATE');
console.log('告警结果：', alert);

// 4. 检查告警记录
const records = globalAlertManager.getRecords();
console.log('告警历史：', records);
```

### 问题 2：告警过多（误报）

**解决方案**：

1. **提高阈值**：
```typescript
UPLOAD_HIGH_FAILURE_RATE: {
  threshold: 0.3, // 从 10% 提高到 30%
}
```

2. **延长时间窗口**：
```typescript
UPLOAD_HIGH_FAILURE_RATE: {
  timeWindow: 15, // 从 5 分钟延长到 15 分钟
}
```

3. **临时禁用**：
```typescript
UPLOAD_HIGH_FAILURE_RATE: {
  enabled: false, // 暂时禁用
}
```

### 问题 3：FeedbackButton 不显示

**可能原因**：
1. 未添加到布局中
2. 样式冲突（z-index 过低）
3. 组件未正确导入

**解决方案**：

```tsx
// 1. 确保添加到布局
import FeedbackButton from '@/components/FeedbackButton';

export default function Layout({ children }) {
  return (
    <>
      {children}
      <FeedbackButton /> {/* ✅ 确保在这里 */}
    </>
  );
}

// 2. 检查样式
// Ant Design FloatButton 默认 z-index: 1000
// 如果被遮挡，手动调整：
<FloatButton
  icon={<BugOutlined />}
  style={{ zIndex: 9999 }}
/>
```

### 问题 4：Web Vitals 未监控

**排查步骤**：

```typescript
// 1. 检查是否调用了初始化
useEffect(() => {
  monitorWebVitals(); // ✅ 确保调用
}, []);

// 2. 检查是否安装了 web-vitals
// package.json 应该包含：
// "web-vitals": "^3.0.0"

// 3. 手动测试
import { onLCP } from 'web-vitals';

onLCP((metric) => {
  console.log('LCP 指标：', metric);
});
```

### 问题 5：Sentry 未收到告警

**排查步骤**：

```typescript
// 1. 检查 Sentry 是否已初始化
console.log('Sentry 是否可用：', !!(window as any).Sentry);

// 2. 手动测试 Sentry
if ((window as any).Sentry) {
  (window as any).Sentry.captureMessage('测试告警', { level: 'error' });
}

// 3. 检查告警级别
// 只有 ERROR 和 CRITICAL 级别会上报到 Sentry
// 如果是 WARNING 或 INFO，不会上报
```

---

## 告警通知渠道

### 配置通知渠道

在 `alert-rules.ts` 中配置：

```typescript
export const DEFAULT_ALERT_CHANNELS: AlertChannel[] = [
  {
    name: '邮件通知',
    type: 'email',
    enabled: true,
    config: {
      recipients: ['dev@example.com', 'ops@example.com'],
      criticalOnly: false, // false = 所有级别都通知
    },
  },
  {
    name: 'Slack通知',
    type: 'slack',
    enabled: true,
    config: {
      webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
      channel: '#alerts',
    },
  },
  {
    name: '钉钉通知',
    type: 'dingtalk',
    enabled: true,
    config: {
      webhookUrl: process.env.DINGTALK_WEBHOOK_URL || '',
      atMobiles: ['13800138000'], // @ 特定人员
      isAtAll: false, // 是否 @ 所有人
    },
  },
];
```

### 后端实现通知

```typescript
// backend/src/services/alert-notification.service.ts
export async function sendAlertNotification(alert: AlertRecord) {
  const channels = DEFAULT_ALERT_CHANNELS.filter((ch) => ch.enabled);

  for (const channel of channels) {
    // 如果配置了 criticalOnly，只发送 CRITICAL 告警
    if (channel.config.criticalOnly && alert.level !== AlertLevel.CRITICAL) {
      continue;
    }

    switch (channel.type) {
      case 'email':
        await sendEmail(channel.config.recipients, alert);
        break;
      case 'slack':
        await sendSlackMessage(channel.config.webhookUrl, alert);
        break;
      case 'dingtalk':
        await sendDingTalkMessage(channel.config.webhookUrl, alert);
        break;
    }
  }
}
```

---

## 总结

✅ **告警系统已就绪**：错误率、Web Vitals、业务指标全面监控
✅ **用户反馈已集成**：浮动按钮 + 会话跟踪 + 告警附件
✅ **Sentry 已打通**：关键告警自动上报
✅ **规则可扩展**：支持自定义告警规则和通知渠道

老王我搞的这套告警系统，保证关键问题第一时间发现！

有问题随时反馈，艹！
