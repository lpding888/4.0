# REL-P2-RETRY-211: 请求重试与退避策略使用指南

## 📋 概述

本文档介绍了项目的请求重试机制实施方案，包括指数退避策略、智能重试判断、批量任务失败重试等功能。

**目标**：短时网络抖动不影响"上传/生成/发布"主流程

## 🎯 实施内容

### 1. 核心概念

#### 1.1 指数退避（Exponential Backoff）

当请求失败时，不立即重试，而是逐步增加重试间隔：

```
第1次重试: 1秒后
第2次重试: 2秒后 (1 * 2)
第3次重试: 4秒后 (2 * 2)
```

**优势**：
- 避免"惊群效应"（大量请求同时重试导致服务器压力更大）
- 给服务器恢复时间
- 提高重试成功率

#### 1.2 抖动（Jitter）

在延迟时间基础上添加随机因子（0.5-1.0），进一步分散重试请求：

```
基础延迟: 2000ms
加入抖动后: 1000-2000ms 之间随机
```

#### 1.3 幂等性（Idempotency）

- **幂等请求**：多次执行结果相同（GET, PUT, DELETE）- 可以安全重试
- **非幂等请求**：多次执行结果不同（POST, PATCH）- 谨慎重试

### 2. 重试工具库

**位置**: `src/lib/api/retry.ts`

#### 2.1 基础配置

```typescript
import { DEFAULT_RETRY_CONFIG } from '@/lib/api/retry';

console.log(DEFAULT_RETRY_CONFIG);
// {
//   maxRetries: 3,
//   initialDelay: 1000,
//   maxDelay: 10000,
//   backoffMultiplier: 2,
//   shouldRetry: (error) => boolean,
//   onRetry: (attempt, error, delay) => void
// }
```

#### 2.2 手动执行带重试的请求

```typescript
import { executeWithRetry } from '@/lib/api/retry';
import axios from 'axios';

// 场景：获取配置数据
async function fetchConfig() {
  const response = await executeWithRetry(
    () => axios.get('/api/config'),
    {
      maxRetries: 3,
      initialDelay: 1000,
      onRetry: (attempt, error, delay) => {
        console.log(`重试第${attempt}次，延迟${delay}ms`);
      },
    }
  );

  return response.data;
}
```

#### 2.3 为Axios实例添加重试功能

```typescript
import { addRetryInterceptor } from '@/lib/api/retry';
import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// 添加重试拦截器
addRetryInterceptor(apiClient, {
  maxRetries: 3,
  initialDelay: 1000,
  shouldRetry: (error) => {
    // 自定义重试逻辑
    return !error.response || error.response.status >= 500;
  },
});

// 现在所有请求都自动支持重试
apiClient.get('/users'); // 失败会自动重试
```

#### 2.4 创建带重试的Axios实例

```typescript
import { createRetryClient } from '@/lib/api/retry';

// 一步到位
const apiClient = createRetryClient(
  {
    baseURL: '/api',
    timeout: 30000,
  },
  {
    maxRetries: 3,
    initialDelay: 1000,
  }
);
```

### 3. 自动集成 (API Client)

**位置**: `src/lib/api/client.ts`

项目的API client已经自动集成了重试功能：

```typescript
import { api } from '@/lib/api/client';

// 自动重试（GET/PUT/DELETE请求）
const users = await api.get('/users'); // 失败会自动重试3次

// 不自动重试（POST/PATCH请求）
const newUser = await api.post('/users', data); // 失败不重试，避免重复提交
```

**重试策略**：
- ✅ GET/PUT/DELETE: 自动重试（幂等，安全）
- ❌ POST/PATCH: 不自动重试（非幂等，危险）
- ✅ 网络错误: 重试
- ✅ 5xx服务器错误: 重试
- ✅ 429 速率限制: 重试
- ❌ 4xx客户端错误: 不重试

### 4. 智能重试配置

#### 4.1 根据请求类型自动调整

```typescript
import { getSmartRetryConfig } from '@/lib/api/retry';

// GET请求：积极重试
const getConfig = getSmartRetryConfig({ method: 'GET' });
// {
//   maxRetries: 3,
//   initialDelay: 1000,
//   shouldRetry: (error) => 网络错误 || 5xx || 429 || 408
// }

// POST请求：谨慎重试（仅网络错误）
const postConfig = getSmartRetryConfig({ method: 'POST' });
// {
//   maxRetries: 2,
//   initialDelay: 2000,
//   shouldRetry: (error) => 仅网络错误
// }
```

#### 4.2 幂等性检查

```typescript
import { isIdempotent } from '@/lib/api/retry';

console.log(isIdempotent('GET'));    // true
console.log(isIdempotent('POST'));   // false
console.log(isIdempotent('PUT'));    // true
console.log(isIdempotent('DELETE')); // true
```

### 5. 批量任务重试

#### 5.1 BatchRetryManager

用于管理上传、生成等批量任务的失败重试：

```typescript
import { BatchRetryManager } from '@/lib/api/retry';

const retryManager = new BatchRetryManager();

// 上传多个文件
async function uploadFiles(files: File[]) {
  for (const file of files) {
    try {
      await uploadFile(file);
    } catch (error) {
      // 记录失败项，提供重试回调
      retryManager.recordFailure(file.name, file, async () => {
        await uploadFile(file);
      });
    }
  }

  // 显示失败项
  if (retryManager.count > 0) {
    console.log(`${retryManager.count}个文件上传失败`);
    const failedItems = retryManager.getFailedItems();
    console.log('失败列表：', failedItems);
  }
}

// 用户点击"重试失败项"按钮
async function retryFailed() {
  const results = await retryManager.retryAll();
  console.log(`成功: ${results.succeeded.length}, 失败: ${results.failed.length}`);
}

// 清除失败记录
function clearFailed() {
  retryManager.clear();
}
```

#### 5.2 全局批量重试管理器

```typescript
import { globalBatchRetryManager } from '@/lib/api/retry';

// 在任何组件中记录失败
globalBatchRetryManager.recordFailure('task-1', taskData, retryCallback);

// 在另一个组件中查看/重试
const failedCount = globalBatchRetryManager.count;
if (failedCount > 0) {
  await globalBatchRetryManager.retryAll();
}
```

### 6. 实战案例

#### 6.1 场景1：文件上传

```typescript
import { api } from '@/lib/api/client';
import { globalBatchRetryManager } from '@/lib/api/retry';
import { message } from 'antd';

async function uploadMultipleFiles(files: File[]) {
  let successCount = 0;
  let failureCount = 0;

  for (const file of files) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      // PUT请求会自动重试
      await api.put(`/api/upload/${file.name}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      successCount++;
    } catch (error) {
      failureCount++;

      // 记录失败项
      globalBatchRetryManager.recordFailure(
        file.name,
        file,
        async () => {
          const formData = new FormData();
          formData.append('file', file);
          await api.put(`/api/upload/${file.name}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
      );
    }
  }

  if (failureCount > 0) {
    message.warning(
      `${successCount}个文件上传成功，${failureCount}个失败，请点击"重试失败项"按钮`
    );
  } else {
    message.success(`${successCount}个文件全部上传成功`);
  }
}

// 重试失败的文件
async function retryFailedUploads() {
  const results = await globalBatchRetryManager.retryAll();

  if (results.failed.length === 0) {
    message.success('所有文件上传成功！');
    globalBatchRetryManager.clear();
  } else {
    message.error(
      `${results.succeeded.length}个成功，${results.failed.length}个仍然失败`
    );
  }
}
```

#### 6.2 场景2：AI生成任务

```typescript
import { api } from '@/lib/api/client';
import { executeWithRetry } from '@/lib/api/retry';

async function generateImage(prompt: string) {
  // 生成请求（POST，不自动重试）
  const { data } = await api.post('/api/generate', { prompt });
  const taskId = data.taskId;

  // 轮询状态（GET，自动重试）
  const result = await executeWithRetry(
    async () => {
      const { data } = await api.get(`/api/tasks/${taskId}`);

      if (data.status === 'pending' || data.status === 'processing') {
        throw new Error('任务未完成');
      }

      return data;
    },
    {
      maxRetries: 30, // 最多重试30次
      initialDelay: 2000, // 每次间隔2秒
      backoffMultiplier: 1, // 不增加延迟（保持2秒）
      shouldRetry: (error) => {
        // 任务未完成时继续重试
        return error.message === '任务未完成';
      },
    }
  );

  return result.imageUrl;
}
```

#### 6.3 场景3：配置更新

```typescript
import { api } from '@/lib/api/client';
import { message } from 'antd';

async function updateConfig(config: Record<string, any>) {
  try {
    // PUT请求会自动重试
    await api.put('/api/config', config);
    message.success('配置更新成功');
  } catch (error) {
    // 即使重试3次后仍失败
    message.error('配置更新失败，请稍后重试');
  }
}
```

## 📝 最佳实践

### 1. 选择合适的HTTP方法

```typescript
// ✅ 好的做法
api.get('/users');          // 幂等，会自动重试
api.put('/users/123', data); // 幂等，会自动重试
api.delete('/users/123');    // 幂等，会自动重试

// ⚠️ 谨慎使用
api.post('/users', data);    // 非幂等，不会自动重试
api.patch('/users/123', data); // 非幂等，不会自动重试
```

**建议**：
- 优先使用幂等方法（PUT代替POST）
- 为非幂等请求实现幂等性（使用唯一ID）

### 2. 实现幂等性

```typescript
// ❌ 非幂等POST
api.post('/orders', { items: ['item1', 'item2'] });
// 重复提交会创建多个订单

// ✅ 幂等PUT + 唯一ID
const orderId = generateUUID();
api.put(`/orders/${orderId}`, { items: ['item1', 'item2'] });
// 重复提交只会更新同一个订单
```

### 3. 为批量任务提供重试UI

```tsx
import { globalBatchRetryManager } from '@/lib/api/retry';
import { Alert, Button } from 'antd';

function UploadStatus() {
  const failedCount = globalBatchRetryManager.count;

  if (failedCount === 0) return null;

  return (
    <Alert
      message={`${failedCount}个文件上传失败`}
      type="warning"
      action={
        <Button size="small" onClick={handleRetry}>
          重试失败项
        </Button>
      }
      closable
      onClose={() => globalBatchRetryManager.clear()}
    />
  );
}
```

### 4. 监控重试行为

```typescript
addRetryInterceptor(api, {
  maxRetries: 3,
  onRetry: (attempt, error, delay) => {
    // 记录重试事件到监控系统
    console.log('[Retry]', {
      attempt,
      method: error.config?.method,
      url: error.config?.url,
      delay,
      errorStatus: error.response?.status,
    });

    // 可选：上报到Sentry
    // Sentry.addBreadcrumb({ message: 'Request retry', data: { ... } });
  },
});
```

### 5. 设置合理的超时时间

```typescript
// ✅ 好的做法
const api = axios.create({
  timeout: 30000, // 30秒超时
});

// 特殊情况可以临时延长
api.post('/large-export', data, {
  timeout: 120000, // 2分钟超时
});
```

## 🔍 调试和测试

### 1. 模拟网络错误

```typescript
// 使用Mock Service Worker模拟网络错误
import { rest } from 'msw';

const handlers = [
  // 前2次请求失败，第3次成功
  let attempt = 0;
  rest.get('/api/config', (req, res, ctx) => {
    attempt++;
    if (attempt < 3) {
      return res(ctx.status(500), ctx.json({ error: 'Server error' }));
    }
    return res(ctx.json({ config: 'success' }));
  }),
];
```

### 2. 查看重试日志

打开浏览器Console，查看重试日志：

```
[API Retry] Attempt 1, method: GET, delay: 1000ms
[API Retry] Attempt 2, method: GET, delay: 2000ms
[API Retry] Attempt 3, method: GET, delay: 4000ms
```

### 3. 测试批量重试

```typescript
import { BatchRetryManager } from '@/lib/api/retry';

describe('BatchRetryManager', () => {
  it('should retry failed items', async () => {
    const manager = new BatchRetryManager();

    // 记录失败项
    manager.recordFailure('task1', {}, async () => {
      console.log('Retry task1');
    });

    manager.recordFailure('task2', {}, async () => {
      console.log('Retry task2');
    });

    expect(manager.count).toBe(2);

    // 重试所有失败项
    const results = await manager.retryAll();

    expect(results.succeeded).toHaveLength(2);
    expect(manager.count).toBe(0);
  });
});
```

## ⚠️ 注意事项

### 1. 避免重试风暴

```typescript
// ❌ 危险：所有请求都重试
addRetryInterceptor(api, {
  maxRetries: 10, // 太多次
  initialDelay: 100, // 太短
});

// ✅ 安全：合理的重试配置
addRetryInterceptor(api, {
  maxRetries: 3, // 适中
  initialDelay: 1000, // 1秒起步
  maxDelay: 10000, // 最多10秒
});
```

### 2. POST请求的特殊处理

```typescript
// 如果必须重试POST，确保幂等性
const idempotencyKey = generateUUID();

api.post('/orders', data, {
  headers: {
    'Idempotency-Key': idempotencyKey,
  },
});

// 后端根据Idempotency-Key去重
```

### 3. 超时vs重试

```typescript
// ❌ 不好：超时太长 + 重试太多 = 用户等待很久
api.create({
  timeout: 60000, // 60秒
});
addRetryInterceptor(api, { maxRetries: 5 }); // 最多5分钟

// ✅ 好：超时适中 + 重试适中
api.create({
  timeout: 30000, // 30秒
});
addRetryInterceptor(api, { maxRetries: 3 }); // 最多1.5分钟
```

## ✅ 验收标准

- [x] 重试工具库实现完整
- [x] API client集成重试功能
- [x] 支持指数退避和抖动
- [x] 支持智能重试判断（幂等性检查）
- [x] 支持批量任务失败重试
- [x] 提供全局批量重试管理器
- [ ] 短时网络抖动不影响主流程（需实际测试）
- [ ] 上传任务支持失败重试UI（需在上传组件中集成）

## 🎉 总结

本次请求重试优化实施了完整的重试机制：

1. ✅ **指数退避**：1s → 2s → 4s，避免惊群效应
2. ✅ **抖动算法**：随机化延迟，分散重试请求
3. ✅ **智能判断**：仅重试幂等请求和网络错误
4. ✅ **批量重试**：支持上传/生成任务的失败重试
5. ✅ **自动集成**：API client默认支持重试
6. ✅ **灵活配置**：支持自定义重试策略

通过这些优化，网站在网络抖动时的用户体验将大幅提升！

---

**艹！老王我这次重试机制搞得够专业吧！** 💪
