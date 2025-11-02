# Provider 系统文档

## 概述

Provider系统是一个**可扩展的异步任务执行框架**，遵循SOLID原则，支持：
- ✅ **统一接口**：所有Provider遵循IProvider接口
- ✅ **自动重试**：内置指数退避重试机制
- ✅ **超时控制**：可配置的超时时间和AbortSignal
- ✅ **错误归一化**：统一的错误码和错误处理
- ✅ **日志追踪**：结构化日志，支持taskId追踪
- ✅ **白名单机制**：安全的Provider动态加载

艹，这个系统能让你放心地扩展各种异步任务，不用担心重复造轮子！

---

## 核心概念

### 1. IProvider 接口

所有Provider必须实现以下接口：

```typescript
interface IProvider {
  /** Provider唯一标识（如 'scf'、'generic-http'） */
  readonly key: string;

  /** Provider显示名称 */
  readonly name: string;

  /**
   * 参数校验
   * @returns 错误信息，null表示通过
   */
  validate(input: any): string | null;

  /**
   * 执行任务
   * @param context - 执行上下文
   * @returns Promise<ExecResult>
   */
  execute(context: ExecContext): Promise<ExecResult>;

  /**
   * 健康检查
   * @returns Promise<boolean>
   */
  healthCheck(): Promise<boolean>;
}
```

### 2. ExecContext（执行上下文）

```typescript
interface ExecContext {
  /** 任务ID，用于日志追踪 */
  taskId: string;

  /** 输入数据（来自上一步或用户输入） */
  input: any;

  /** AbortSignal，用于取消执行 */
  signal?: AbortSignal;

  /** 执行超时时间（毫秒），不传则使用默认值30秒 */
  timeout?: number;

  /** 额外的元数据 */
  metadata?: Record<string, any>;
}
```

### 3. ExecResult（执行结果）

```typescript
interface ExecResult<T = any> {
  /** 执行是否成功 */
  success: boolean;

  /** 输出数据（成功时必须有） */
  data?: T;

  /** 错误信息（失败时必须有） */
  error?: {
    code: string;
    message: string;
    details?: any;
  };

  /** 执行时长（毫秒） */
  duration?: number;

  /** 额外的元数据 */
  metadata?: Record<string, any>;
}
```

---

## 已实现的Providers

### 1. GenericHTTP Provider

**用途**：通用HTTP/HTTPS请求

**输入格式**：
```typescript
{
  req_template: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    url: string,  // 支持{{var}}变量替换
    headers?: Record<string, string>,
    body?: any,
    params?: Record<string, string>,
    extractPath?: string,  // 从响应中提取数据的路径
    timeout?: number,
  },
  variables?: Record<string, any>,  // 变量字典
}
```

**示例**：
```typescript
const context = {
  taskId: 'task-001',
  input: {
    req_template: {
      method: 'POST',
      url: 'https://api.example.com/process',
      headers: {
        'Authorization': 'Bearer {{token}}',
      },
      body: {
        imageUrl: '{{imageUrl}}',
      },
      extractPath: 'result.processedUrl',
    },
    variables: {
      token: 'abc123',
      imageUrl: 'https://example.com/image.jpg',
    },
  },
};

const result = await provider.execute(context);
```

---

### 2. SCF Provider（腾讯云云函数）

**用途**：调用腾讯云SCF云函数

**输入格式**：
```typescript
{
  auth: {
    secretId: string,
    secretKey: string,
    token?: string,  // 临时密钥Token
    region: string,  // 如 ap-guangzhou
  },
  params: {
    functionName: string,
    namespace?: string,  // 默认 default
    qualifier?: string,  // 默认 $LATEST
    invokeType: 'sync' | 'async',
    payload: any,
    logType?: 'None' | 'Tail',
  },
}
```

**示例（同步调用）**：
```typescript
const context = {
  taskId: 'task-002',
  input: {
    auth: {
      secretId: process.env.TENCENT_SECRET_ID,
      secretKey: process.env.TENCENT_SECRET_KEY,
      region: 'ap-guangzhou',
    },
    params: {
      functionName: 'image-processor',
      invokeType: 'sync',
      payload: {
        imageUrl: 'https://example.com/image.jpg',
        operation: 'resize',
        width: 800,
        height: 600,
      },
    },
  },
};

const result = await provider.execute(context);
// result.data.result 包含云函数的返回值
```

**示例（异步调用）**：
```typescript
const context = {
  taskId: 'task-003',
  input: {
    auth: { /* ... */ },
    params: {
      functionName: 'video-processor',
      invokeType: 'async',
      payload: {
        videoUrl: 'https://example.com/video.mp4',
      },
    },
  },
};

const result = await provider.execute(context);
// 异步调用立即返回，result.data.result.message = '异步调用已提交'
```

---

### 3. TencentCI Provider（腾讯云万象）

**用途**：图片/视频处理、内容审核

**输入格式**：
```typescript
{
  action: 'imageProcess' | 'videoProcess' | 'contentAudit' | ...,
  bucket: string,
  region: string,
  objectKey: string,
  params: Record<string, any>,
  auth?: {
    secretId: string,
    secretKey: string,
    token?: string,
  },
}
```

**状态**：占位实现，需要集成腾讯云CI SDK

---

### 4. RunningHub Provider

**用途**：触发RunningHub工作流

**输入格式**：
```typescript
{
  workflowId: string,
  apiKey: string,
  params: Record<string, any>,
  pollInterval?: number,  // 默认 5000ms
  maxPollTime?: number,   // 默认 300000ms
  baseUrl?: string,
}
```

**状态**：占位实现，需要实现RunningHub API集成

---

## 错误码

Provider系统使用统一的错误码（`ProviderErrorCode`）：

| 错误码 | 说明 | 可重试 |
|-------|------|--------|
| `ERR_PROVIDER_NOT_ALLOWED` | Provider不在白名单中 | ❌ |
| `ERR_PROVIDER_LOAD_FAILED` | Provider加载失败 | ❌ |
| `ERR_PROVIDER_TIMEOUT` | Provider执行超时 | ❌ |
| `ERR_PROVIDER_EXECUTION_FAILED` | Provider执行失败 | ✅* |
| `ERR_PROVIDER_UNHEALTHY` | Provider健康检查失败 | ✅ |
| `ERR_PROVIDER_VALIDATION_FAILED` | Provider参数校验失败 | ❌ |
| `ERR_PROVIDER_MAX_RETRIES_EXCEEDED` | Provider重试次数耗尽 | ❌ |

*注：`ERR_PROVIDER_EXECUTION_FAILED`是否可重试取决于具体Provider的实现

### SCF Provider特定错误分类

SCF Provider会将腾讯云错误码归一化为以下类别：

| 类别 | 说明 | 示例错误码 |
|------|------|-----------|
| `auth` | 认证失败 | `AuthFailure.SignatureFailure` |
| `permission` | 权限不足 | `UnauthorizedOperation` |
| `parameter` | 参数错误 | `InvalidParameterValue` |
| `not_found` | 资源不存在 | `ResourceNotFound.Function` |
| `quota` | 配额限制 | `LimitExceeded` |
| `timeout` | 函数执行超时 | `ResourceUnavailable.FunctionInsufficientBalance` |
| `internal` | 内部错误（可重试） | `InternalError.System` |

---

## 重试策略配置

BaseProvider内置了指数退避重试机制，默认配置：

```typescript
const DEFAULT_RETRY_POLICY = {
  maxRetries: 3,           // 最大重试次数
  initialDelay: 1000,      // 初始延迟（毫秒）
  maxDelay: 10000,         // 最大延迟（毫秒）
  backoffMultiplier: 2,    // 退避倍数
  retryableErrors: [],     // 可重试的错误码（空数组表示所有错误都重试）
};
```

**重试延迟计算公式**：
```
delay = min(initialDelay * (backoffMultiplier ^ attempt), maxDelay)
```

**示例**：
- 第1次重试：1000ms
- 第2次重试：2000ms
- 第3次重试：4000ms

**自定义重试策略**：
```typescript
const customRetryPolicy = {
  maxRetries: 5,
  initialDelay: 500,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryableErrors: ['InternalError', 'ServiceUnavailable'],
};

const provider = new ScfProvider(customRetryPolicy);
```

---

## 超时控制

Provider支持两种超时控制方式：

### 1. 通过Context传递超时时间

```typescript
const context = {
  taskId: 'task-004',
  input: { /* ... */ },
  timeout: 60000,  // 60秒超时
};

const result = await provider.execute(context);
```

### 2. 通过AbortSignal取消执行

```typescript
const abortController = new AbortController();

const context = {
  taskId: 'task-005',
  input: { /* ... */ },
  signal: abortController.signal,
};

// 5秒后取消执行
setTimeout(() => {
  abortController.abort();
}, 5000);

try {
  const result = await provider.execute(context);
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('执行被取消');
  }
}
```

---

## 日志追踪

Provider系统使用结构化日志，所有日志都包含`taskId`字段，方便追踪：

```typescript
// 日志格式示例
[INFO] [scf] 准备调用SCF { taskId: 'task-123', functionName: 'test-function', invokeType: 'sync' }
[INFO] [scf] SCF调用成功 { taskId: 'task-123', functionName: 'test-function', duration: 1523, requestId: 'xxx' }
[ERROR] [scf] SCF调用失败 { taskId: 'task-123', functionName: 'test-function', error: '认证失败', code: 'AuthFailure.SignatureFailure' }
```

---

## ProviderLoader（白名单机制）

Provider通过白名单机制动态加载，确保安全性：

```typescript
// backend/src/providers/provider-loader.ts
const ALLOW_LIST = {
  GENERIC_HTTP: () => import('./handlers/genericHttp.handler'),
  TENCENT_CI: () => import('./handlers/tencentCi.handler'),
  RUNNINGHUB: () => import('./handlers/runninghub.handler'),
  SCF: () => import('./handlers/scf.handler'),
};
```

**使用示例**：
```typescript
import { providerLoader } from './providers/provider-loader';

// 加载Provider（带缓存）
const provider = await providerLoader.loadProvider('SCF');

// 执行任务
const result = await provider.execute(context);

// 获取加载统计
const stats = providerLoader.getStats();
console.log(stats);
// { loadCount: 1, cacheHitCount: 0, errorCount: 0, cacheSize: 1, cachedProviders: ['SCF'] }
```

**安全机制**：
- ❌ 禁止从数据库动态加载代码（防止代码注入）
- ✅ 只能加载白名单中的Provider
- ✅ Provider实例自动缓存（避免重复实例化）
- ✅ 加载时自动执行健康检查

---

## 开发新Provider

### 1. 继承BaseProvider

```typescript
import { BaseProvider } from '../base/base-provider';
import { ExecContext, ExecResult } from '../types';

export class MyProvider extends BaseProvider {
  public readonly key = 'my-provider';
  public readonly name = 'My Custom Provider';

  // 1. 实现参数校验
  public validate(input: any): string | null {
    if (!input || !input.requiredField) {
      return '缺少必填字段: requiredField';
    }
    return null;
  }

  // 2. 实现执行逻辑
  protected async doExecute(context: ExecContext): Promise<ExecResult> {
    const { taskId, input } = context;

    try {
      // 你的业务逻辑
      const result = await this.doSomething(input);

      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: ProviderErrorCode.ERR_PROVIDER_EXECUTION_FAILED,
          message: error.message,
        },
      };
    }
  }

  // 3. 可选：实现健康检查
  public async healthCheck(): Promise<boolean> {
    return true;
  }
}

export default MyProvider;
```

### 2. 添加到白名单

编辑 `backend/src/providers/provider-loader.ts`：

```typescript
const ALLOW_LIST = {
  // ... 现有Provider
  MY_PROVIDER: () => import('./handlers/my-provider.handler'),
};
```

### 3. 编写单元测试

参考 `backend/tests/unit/providers/scf.handler.test.ts`

---

## Pipeline集成

Provider系统已集成到PipelineEngine中，使用方式：

```javascript
// backend/src/services/pipelineEngine.service.js
async executeStep(stepConfig, input) {
  const { taskId, type, timeout } = stepConfig;

  // 1. 加载Provider
  const provider = await this.getProvider(type);

  // 2. 构建执行上下文
  const context = {
    taskId,
    input,
    timeout,
  };

  // 3. 执行Provider（自动处理重试、超时、日志）
  const result = await provider.execute(context);

  // 4. 检查结果
  if (!result.success) {
    throw new Error(result.error?.message || '执行失败');
  }

  return { success: true, output: result.data };
}
```

---

## 最佳实践

### 1. 遵循KISS原则
- 简单的Provider直接继承BaseProvider即可
- 不要过度设计，只实现当前需要的功能

### 2. 遵循DRY原则
- 相似的逻辑应该抽取到BaseProvider或工具函数
- 不要重复实现重试、超时控制等通用逻辑

### 3. 遵循SOLID原则
- **S（单一职责）**：每个Provider只负责一种任务类型
- **O（开闭原则）**：通过继承扩展功能，不修改BaseProvider
- **L（里氏替换）**：所有Provider可以互相替换
- **I（接口隔离）**：IProvider接口精简，不包含不必要的方法
- **D（依赖倒置）**：依赖IProvider接口，不依赖具体实现

### 4. 错误处理
- 始终返回`ExecResult`格式的结果
- 错误信息要清晰，包含足够的上下文
- 使用统一的错误码（`ProviderErrorCode`）

### 5. 日志记录
- 所有日志包含`taskId`字段
- 使用结构化日志，方便搜索和分析
- 敏感信息（如密钥）不要记录在日志中

---

## 常见问题

### Q1: 如何调试Provider执行？

**A**: Provider内置了详细的日志，可以通过`taskId`追踪整个执行过程：
```bash
# 查看所有日志
grep "task-123" logs/app.log

# 查看错误日志
grep "ERROR.*task-123" logs/app.log
```

### Q2: Provider执行失败如何处理？

**A**: BaseProvider会自动重试可重试的错误，你只需要：
1. 在`doExecute()`中正确抛出或返回错误
2. 检查日志中的错误详情
3. 根据错误类别决定是否需要修复

### Q3: 如何测试自定义Provider？

**A**: 参考`backend/tests/unit/providers/scf.handler.test.ts`：
1. 使用MockLogger记录日志
2. Mock外部依赖（如SDK）
3. 测试参数校验、成功场景、错误场景

### Q4: Provider执行很慢怎么优化？

**A**: 可以：
1. 调整超时时间（`timeout`）
2. 调整重试策略（减少`maxRetries`）
3. 检查是否有不必要的同步等待

---

## 参考资料

- [BaseProvider源码](../backend/src/providers/base/base-provider.ts)
- [Provider类型定义](../backend/src/providers/types.ts)
- [ProviderLoader源码](../backend/src/providers/provider-loader.ts)
- [GenericHTTP Provider示例](../backend/src/providers/handlers/genericHttp.handler.ts)
- [SCF Provider示例](../backend/src/providers/handlers/scf.handler.ts)

---

**艹，这个文档写得很详细了！有问题就看文档，别tm来烦老王我！**
