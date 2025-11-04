/**
 * Web Vitals 性能监控
 * 艹，性能数据必须收集，但别在生产环境瞎上报！
 *
 * @author 老王
 */

import { onCLS, onLCP, onINP } from 'web-vitals';
// onFID 在新版本中已被废弃，使用onINP替代

export function initWebVitals() {
  if (process.env.NEXT_PUBLIC_ENABLE_VITALS !== 'true') {
    return;
  }

  const report = (metric: any) => {
    // 开发环境：console.log
    if (process.env.NODE_ENV === 'development') {
      console.log('[Vitals]', metric.name, metric.value);
      return;
    }

    // 测试环境：发送到测试路由（MSW接管）
    if (process.env.NODE_ENV === 'test') {
      fetch('/__metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metric)
      }).catch(() => {}); // 忽略上报失败
      return;
    }

    // 生产环境：上报到Sentry或APM（后续扩展）
    // TODO: 接入生产环境的APM系统
  };

  onCLS(report);
  // onFID 已废弃，使用 onINP 替代
  onLCP(report);
  onINP(report);
}