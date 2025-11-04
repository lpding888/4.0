# DOC-P2-PLAYBOOK-210: 运维和前端 Playbook

> **艹！遇到问题别慌，跟着老王我的 Playbook 一步步排查！**
> 这是实战手册，不是花架子文档！

---

## 📋 目录

- [前端故障排查](#前端故障排查)
  - [SSE 连接问题](#sse-连接问题)
  - [上传失败问题](#上传失败问题)
  - [Provider 连接失败](#provider-连接失败)
  - [缓存问题](#缓存问题)
  - [告警触发问题](#告警触发问题)
- [性能优化 Playbook](#性能优化-playbook)
  - [LCP 优化](#lcp-优化)
  - [INP 优化](#inp-优化)
  - [CLS 优化](#cls-优化)
  - [Bundle Size 优化](#bundle-size-优化)
- [部署和回滚](#部署和回滚)
  - [部署检查清单](#部署检查清单)
  - [回滚步骤](#回滚步骤)
  - [灰度发布](#灰度发布)
- [监控和告警](#监控和告警)
  - [关键指标](#关键指标)
  - [告警响应](#告警响应)
  - [日常巡检](#日常巡检)

---

## 前端故障排查

### SSE 连接问题

#### 问题表现

- 实时更新不生效
- 控制台显示 SSE 连接失败
- 网络面板显示连接中断

#### 排查步骤

**Step 1: 检查网络连接**

```bash
# 打开浏览器开发者工具 -> Network 面板
# 筛选 EventSource 类型
# 查看连接状态和错误信息
```

**Step 2: 检查后端 SSE 端点**

```bash
# 使用 curl 测试 SSE 端点
curl -N -H "Accept: text/event-stream" http://localhost:3001/api/sse/test

# 期望输出：
# data: {"message":"Connected"}
```

**Step 3: 检查前端代码**

```tsx
// src/hooks/useSSE.ts
const eventSource = new EventSource('/api/sse/test');

eventSource.onopen = () => {
  console.log('[SSE] 连接成功');
};

eventSource.onerror = (error) => {
  console.error('[SSE] 连接失败:', error);

  // 检查 readyState
  console.log('[SSE] readyState:', eventSource.readyState);
  // 0 = CONNECTING
  // 1 = OPEN
  // 2 = CLOSED
};
```

**Step 4: 检查超时设置**

```tsx
// 设置合理的重连间隔
const reconnectDelay = 3000; // 3秒重连
```

#### 常见原因和解决方案

| 原因 | 解决方案 |
|------|---------|
| 后端 SSE 端点未启动 | 检查后端服务是否正常运行 |
| Nginx 超时配置 | 增加 `proxy_read_timeout` 到 600s |
| CORS 问题 | 检查后端 CORS 配置 |
| 网络不稳定 | 实现自动重连机制 |

#### 快速修复命令

```bash
# 1. 重启后端服务
pm2 restart ai-wardrobe-backend

# 2. 检查 Nginx 配置
sudo nginx -t
sudo systemctl reload nginx

# 3. 查看后端日志
pm2 logs ai-wardrobe-backend --lines 100
```

---

### 上传失败问题

#### 问题表现

- 文件上传卡在某个百分比
- 显示"上传失败"错误
- 网络面板显示 413 或 500 错误

#### 排查步骤

**Step 1: 检查文件大小**

```tsx
// 前端检查
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

if (file.size > MAX_FILE_SIZE) {
  message.error(`文件大小不能超过 10MB，当前：${(file.size / 1024 / 1024).toFixed(2)}MB`);
  return false;
}
```

**Step 2: 检查文件类型**

```tsx
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

if (!ALLOWED_TYPES.includes(file.type)) {
  message.error(`不支持的文件类型：${file.type}`);
  return false;
}
```

**Step 3: 检查网络请求**

```bash
# 打开开发者工具 -> Network 面板
# 查看上传请求：
# - Status Code (200/413/500)
# - Response Headers
# - Response Body
```

**Step 4: 检查后端日志**

```bash
# 查看后端上传日志
tail -f /var/log/ai-wardrobe/upload.log

# 查看 Nginx 错误日志
tail -f /var/log/nginx/error.log
```

#### 常见原因和解决方案

| 原因 | 解决方案 |
|------|---------|
| 文件超过大小限制 | 增加 Nginx `client_max_body_size` |
| COS 上传失败 | 检查 COS STS 凭证是否过期 |
| 网络超时 | 增加请求超时时间，启用重试机制 |
| 分片上传失败 | 检查分片逻辑，增加错误处理 |

#### 快速修复命令

```bash
# 1. 增加 Nginx 上传大小限制
sudo nano /etc/nginx/nginx.conf
# 添加：client_max_body_size 50M;

# 2. 重载 Nginx
sudo nginx -t
sudo systemctl reload nginx

# 3. 检查 COS 配置
cat backend/.env | grep COS_

# 4. 重启后端服务
pm2 restart ai-wardrobe-backend
```

---

### Provider 连接失败

#### 问题表现

- AI 生成任务失败
- 显示"Provider 连接失败"
- 控制台显示 ECONNREFUSED 错误

#### 排查步骤

**Step 1: 检查 Provider 配置**

```bash
# 查看 .env 配置
cat backend/.env | grep PROVIDER_

# 期望输出：
# PROVIDER_BUILDINGAI_ENDPOINT=https://api.buildingai.example.com
# PROVIDER_BUILDINGAI_API_KEY=sk-xxxxx
```

**Step 2: 测试 Provider API**

```bash
# 使用 curl 测试 Provider 端点
curl -X POST https://api.buildingai.example.com/v1/images/generations \
  -H "Authorization: Bearer sk-xxxxx" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test"}'

# 期望输出：
# {"status":"success"}
```

**Step 3: 检查网络连接**

```bash
# ping Provider 域名
ping api.buildingai.example.com

# telnet 测试端口
telnet api.buildingai.example.com 443
```

**Step 4: 检查后端日志**

```bash
# 查看 Provider 连接日志
pm2 logs ai-wardrobe-backend | grep "Provider"

# 查看错误详情
pm2 logs ai-wardrobe-backend --err
```

#### 常见原因和解决方案

| 原因 | 解决方案 |
|------|---------|
| API Key 过期 | 更新 .env 中的 API Key |
| 网络不通 | 检查防火墙和网络配置 |
| Provider 服务宕机 | 切换到备用 Provider |
| 请求频率过高 | 增加请求间隔，实现限流 |

#### 快速修复命令

```bash
# 1. 更新 API Key
nano backend/.env
# PROVIDER_BUILDINGAI_API_KEY=sk-new-key

# 2. 重启后端服务
pm2 restart ai-wardrobe-backend

# 3. 检查连接状态
curl -I https://api.buildingai.example.com

# 4. 启用备用 Provider（如果有）
# 修改 backend/.env
# PROVIDER_FALLBACK_ENABLED=true
```

---

### 缓存问题

#### 问题表现

- 数据更新后前端仍显示旧数据
- 配置修改后不生效
- 用户反馈看到的数据不一致

#### 排查步骤

**Step 1: 检查缓存是否过期**

```tsx
// 在浏览器 Console 中执行
import { globalCacheManager } from '@/lib/cache';

// 检查缓存状态
const stats = getCacheStats();
console.log('缓存统计：', stats);

// 检查特定键是否有效
const isValid = globalCacheManager.isValid('templates:all');
console.log('templates:all 缓存是否有效：', isValid);
```

**Step 2: 检查版本号**

```tsx
// 检查全局版本号
const version = globalCacheManager.getGlobalVersion();
console.log('当前版本号：', version);

// 检查缓存项的版本号
const cacheItem = globalCacheManager.get('templates:all');
console.log('缓存项版本：', cacheItem?.version);
```

**Step 3: 强制刷新缓存**

```tsx
// 删除特定缓存
globalCacheManager.remove('templates:all');

// 清空所有缓存
globalCacheManager.clear();

// 更新全局版本号（强制刷新所有缓存）
globalCacheManager.setGlobalVersion('1.0.1');
```

**Step 4: 检查 TTL 设置**

```tsx
// 检查缓存配置
const cacheItem = globalCacheManager.get('templates:all');
console.log('缓存 TTL：', cacheItem?.ttl);
console.log('缓存时间戳：', new Date(cacheItem?.timestamp));
console.log('已过期：', globalCacheManager.isExpired('templates:all'));
```

#### 常见原因和解决方案

| 原因 | 解决方案 |
|------|---------|
| TTL 设置过长 | 减少 TTL 到合理值（如 5 分钟） |
| 版本号未更新 | 部署时自动更新版本号 |
| SWR 返回旧数据 | 增加强制刷新按钮 |
| localStorage 未清理 | 实现定期清理机制 |

#### 快速修复命令

```bash
# 1. 清空浏览器缓存
# Chrome: Ctrl+Shift+Delete
# Firefox: Ctrl+Shift+Delete

# 2. 强制刷新页面
# Ctrl+F5 (Windows)
# Cmd+Shift+R (Mac)

# 3. 清空 localStorage（在 Console 中）
localStorage.clear();
```

---

### 告警触发问题

#### 问题表现

- 告警未按预期触发
- 告警频繁误报
- Sentry 未收到告警

#### 排查步骤

**Step 1: 检查告警规则配置**

```tsx
import { ALL_ALERT_RULES } from '@/lib/monitoring/alert-rules';

// 检查告警规则
console.log('所有告警规则：', ALL_ALERT_RULES);

// 检查特定规则是否启用
const rule = ALL_ALERT_RULES['UPLOAD_HIGH_FAILURE_RATE'];
console.log('上传失败率告警：', {
  enabled: rule.enabled,
  threshold: rule.threshold,
  timeWindow: rule.timeWindow,
});
```

**Step 2: 检查指标记录**

```tsx
import { globalAlertManager } from '@/lib/monitoring/alerts';

// 手动记录指标
globalAlertManager.recordMetric('UPLOAD_SUCCESS_RATE', 0);

// 手动检查阈值
const alert = globalAlertManager.checkThreshold('UPLOAD_HIGH_FAILURE_RATE');
console.log('告警结果：', alert);

// 查看告警历史
const records = globalAlertManager.getRecords();
console.log('最近告警：', records);
```

**Step 3: 检查 Sentry 配置**

```tsx
// 检查 Sentry 是否初始化
console.log('Sentry 是否可用：', !!(window as any).Sentry);

// 手动测试 Sentry
if ((window as any).Sentry) {
  (window as any).Sentry.captureMessage('测试告警', { level: 'error' });
}
```

**Step 4: 检查告警监听器**

```tsx
// 添加调试监听器
globalAlertManager.addListener((alert) => {
  console.log('[告警调试] 触发告警：', {
    name: alert.name,
    level: alert.level,
    message: alert.message,
    timestamp: new Date(alert.timestamp).toLocaleString(),
  });
});
```

#### 常见原因和解决方案

| 原因 | 解决方案 |
|------|---------|
| 阈值设置不合理 | 根据历史数据调整阈值 |
| 时间窗口过短 | 增加时间窗口避免误报 |
| Sentry DSN 未配置 | 检查 .env 中的 SENTRY_DSN |
| 告警规则未启用 | 修改 enabled 为 true |

#### 快速修复命令

```bash
# 1. 检查 Sentry DSN
cat frontend/.env.local | grep SENTRY_DSN

# 2. 测试 Sentry
npx @sentry/wizard@latest

# 3. 查看前端日志
# 打开开发者工具 -> Console 面板
```

---

## 性能优化 Playbook

### LCP 优化

#### 目标

- LCP < 2.5s（优秀）
- LCP < 4.0s（待改善）

#### 优化步骤

**Step 1: 识别 LCP 元素**

```bash
# 使用 Lighthouse 分析
npx lighthouse https://your-site.com --view

# 查看 LCP 元素
# Performance -> Timings -> Largest Contentful Paint
```

**Step 2: 优化图片加载**

```tsx
// 使用 Next.js Image 组件
import Image from 'next/image';

<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority // LCP 元素必须添加 priority
  placeholder="blur"
  blurDataURL="/hero-blur.jpg"
/>
```

**Step 3: 预加载关键资源**

```tsx
// pages/_document.tsx
<Head>
  <link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
  <link rel="preconnect" href="https://cdn.example.com" />
</Head>
```

**Step 4: 减少服务端响应时间**

```bash
# 启用 Redis 缓存
# backend/.env
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379

# 启用 CDN
# 将静态资源上传到 CDN
```

#### 验证优化效果

```bash
# 重新运行 Lighthouse
npx lighthouse https://your-site.com --view

# 检查 LCP 是否改善
# 目标：LCP < 2.5s
```

---

### INP 优化

#### 目标

- INP < 200ms（优秀）
- INP < 500ms（待改善）

#### 优化步骤

**Step 1: 识别长任务**

```bash
# 使用 Chrome DevTools
# Performance -> Main Thread
# 查找超过 50ms 的任务
```

**Step 2: 拆分长任务**

```tsx
// ❌ 错误：长任务阻塞主线程
function processLargeData(data: any[]) {
  data.forEach((item) => {
    // 复杂计算...
  });
}

// ✅ 正确：使用 requestIdleCallback 拆分任务
function processLargeData(data: any[]) {
  let index = 0;

  function process() {
    const deadline = Date.now() + 50; // 50ms 时间片

    while (index < data.length && Date.now() < deadline) {
      // 处理一项
      index++;
    }

    if (index < data.length) {
      requestIdleCallback(process);
    }
  }

  requestIdleCallback(process);
}
```

**Step 3: 使用 Web Workers**

```tsx
// workers/image-processor.worker.ts
self.onmessage = (e) => {
  const { image } = e.data;
  // 在 Worker 中处理图片
  const processed = processImage(image);
  self.postMessage(processed);
};

// 在组件中使用
const worker = new Worker('/workers/image-processor.worker.js');
worker.postMessage({ image });
worker.onmessage = (e) => {
  const processed = e.data;
  // 更新 UI
};
```

**Step 4: 减少第三方脚本**

```tsx
// 延迟加载第三方脚本
import Script from 'next/script';

<Script
  src="https://analytics.example.com/script.js"
  strategy="lazyOnload" // 空闲时加载
/>
```

---

### CLS 优化

#### 目标

- CLS < 0.1（优秀）
- CLS < 0.25（待改善）

#### 优化步骤

**Step 1: 为图片设置尺寸**

```tsx
// ❌ 错误：未设置尺寸
<img src="/image.jpg" alt="Image" />

// ✅ 正确：设置明确尺寸
<Image
  src="/image.jpg"
  alt="Image"
  width={800}
  height={600}
/>
```

**Step 2: 为广告位预留空间**

```tsx
// 为广告位设置最小高度
<div style={{ minHeight: '250px' }}>
  <Ad />
</div>
```

**Step 3: 避免插入内容到已有内容上方**

```tsx
// ❌ 错误：动态插入内容导致布局偏移
<div>
  {showBanner && <Banner />}
  <Content />
</div>

// ✅ 正确：预留空间
<div>
  <div style={{ minHeight: showBanner ? '100px' : '0px' }}>
    {showBanner && <Banner />}
  </div>
  <Content />
</div>
```

---

### Bundle Size 优化

#### 目标

- 首页 JS < 200KB（gzip 后）
- 其他页面 JS < 100KB（gzip 后）

#### 优化步骤

**Step 1: 分析 Bundle**

```bash
# 运行 Bundle 分析
npm run build:analyze

# 查看分析报告
# 打开 http://localhost:8888
```

**Step 2: 动态导入**

```tsx
// ❌ 错误：静态导入
import HeavyComponent from './HeavyComponent';

// ✅ 正确：动态导入
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Spin />,
});
```

**Step 3: 移除未使用的依赖**

```bash
# 检查未使用的依赖
npx depcheck

# 移除未使用的依赖
npm uninstall unused-package
```

**Step 4: 使用 Tree Shaking**

```tsx
// ❌ 错误：导入整个库
import _ from 'lodash';

// ✅ 正确：只导入需要的函数
import debounce from 'lodash/debounce';
```

---

## 部署和回滚

### 部署检查清单

#### 部署前检查

- [ ] 代码通过所有测试（单元测试、E2E 测试）
- [ ] 代码通过 Lint 检查
- [ ] 性能指标符合要求（Lighthouse Score > 90）
- [ ] 无障碍性检查通过（A11y Score > 90）
- [ ] 环境变量已更新
- [ ] 数据库迁移已执行
- [ ] 依赖版本无冲突
- [ ] 备份数据库和配置

#### 部署步骤

```bash
# 1. 备份当前版本
git tag backup-$(date +%Y%m%d-%H%M%S)
git push origin backup-$(date +%Y%m%d-%H%M%S)

# 2. 拉取最新代码
git pull origin main

# 3. 安装依赖
npm ci --legacy-peer-deps

# 4. 构建项目
npm run build

# 5. 运行数据库迁移（如果有）
npm run migrate

# 6. 重启服务
pm2 restart ai-wardrobe-frontend
pm2 restart ai-wardrobe-backend

# 7. 验证部署
curl -I https://your-site.com
```

#### 部署后验证

- [ ] 首页加载正常
- [ ] 关键功能可用（上传、生成、下载）
- [ ] 监控指标正常（错误率、响应时间）
- [ ] 告警未触发
- [ ] 用户反馈正常

---

### 回滚步骤

#### 何时回滚

- 关键功能不可用
- 错误率突然上升（> 5%）
- 性能严重下降（响应时间 > 5s）
- 出现数据丢失
- 安全漏洞

#### 回滚命令

```bash
# 1. 找到上一个稳定版本
git tag | grep backup

# 2. 切换到备份版本
git checkout backup-20250103-143000

# 3. 重新构建
npm ci --legacy-peer-deps
npm run build

# 4. 重启服务
pm2 restart ai-wardrobe-frontend
pm2 restart ai-wardrobe-backend

# 5. 验证回滚
curl -I https://your-site.com

# 6. 通知团队
# 在 Slack/钉钉中发送回滚通知
```

---

### 灰度发布

#### 配置 Nginx 灰度规则

```nginx
# /etc/nginx/conf.d/ai-wardrobe.conf

upstream frontend_stable {
  server 127.0.0.1:3000;
}

upstream frontend_canary {
  server 127.0.0.1:3001;
}

server {
  listen 80;
  server_name ai-wardrobe.com;

  location / {
    # 10% 流量到灰度版本
    if ($request_id ~ "^[0-9a-f]$") {
      proxy_pass http://frontend_canary;
    }

    # 90% 流量到稳定版本
    proxy_pass http://frontend_stable;
  }
}
```

#### 监控灰度指标

```bash
# 监控灰度版本错误率
pm2 logs ai-wardrobe-frontend-canary | grep "ERROR"

# 对比灰度版本和稳定版本性能
# 使用 Grafana 或 Prometheus 监控
```

---

## 监控和告警

### 关键指标

#### 前端指标

| 指标 | 目标值 | 告警阈值 |
|------|--------|---------|
| LCP | < 2.5s | > 4s |
| INP | < 200ms | > 500ms |
| CLS | < 0.1 | > 0.25 |
| 错误率 | < 1% | > 5% |
| 上传成功率 | > 95% | < 90% |

#### 后端指标

| 指标 | 目标值 | 告警阈值 |
|------|--------|---------|
| API 响应时间 | < 500ms | > 2s |
| CPU 使用率 | < 70% | > 90% |
| 内存使用率 | < 80% | > 95% |
| Provider 成功率 | > 95% | < 90% |

---

### 告警响应

#### P0 告警（严重）

**触发条件：**
- 支付失败
- 数据丢失
- 系统崩溃

**响应时间：** 5 分钟内

**处理步骤：**
1. 立即通知值班人员
2. 切换到备用系统（如果有）
3. 定位问题根源
4. 执行修复或回滚
5. 发布故障公告
6. 事后复盘

#### P1 告警（重要）

**触发条件：**
- API 错误率 > 10%
- 上传失败率 > 30%
- Provider 连接失败 > 20%

**响应时间：** 15 分钟内

**处理步骤：**
1. 通知相关人员
2. 检查系统日志
3. 定位问题原因
4. 执行修复措施
5. 验证修复效果

#### P2 告警（一般）

**触发条件：**
- LCP > 4s
- INP > 500ms
- CLS > 0.25

**响应时间：** 1 小时内

**处理步骤：**
1. 记录告警信息
2. 排期优化任务
3. 执行性能优化
4. 验证优化效果

---

### 日常巡检

#### 每日巡检

```bash
# 1. 检查服务状态
pm2 status

# 2. 检查错误日志
pm2 logs --err --lines 100

# 3. 检查磁盘空间
df -h

# 4. 检查内存使用
free -h

# 5. 检查数据库连接
mysql -u root -p -e "SHOW PROCESSLIST;"
```

#### 每周巡检

- [ ] 检查备份完整性
- [ ] 更新依赖版本
- [ ] 清理无用日志
- [ ] 检查 SSL 证书有效期
- [ ] 审查安全漏洞

#### 每月巡检

- [ ] 性能基准测试
- [ ] 压力测试
- [ ] 灾难恢复演练
- [ ] 文档更新
- [ ] 团队培训

---

## 总结

✅ **故障排查流程清晰**：SSE、上传、Provider、缓存、告警
✅ **性能优化有方法**：LCP、INP、CLS、Bundle Size
✅ **部署回滚有保障**：检查清单、回滚步骤、灰度发布
✅ **监控告警有响应**：关键指标、告警响应、日常巡检

老王我写的这个 Playbook，跟着做准没错！

有问题随时反馈，艹！
