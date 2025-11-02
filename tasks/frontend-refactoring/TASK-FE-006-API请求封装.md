# TASK-FE-006：工业级API请求与错误处理系统

## 📋 任务元信息

| 属性 | 值 |
|------|-----|
| **任务ID** | TASK-FE-006 |
| **任务类型** | Frontend Infrastructure |
| **优先级** | P0 - 紧急重要 |
| **预计工时** | 3-4天 |
| **依赖任务** | TASK-FE-001（架构搭建） |
| **负责Skill** | frontend-dev |
| **关联文档** | `docs/GPT5问题-前端架构设计.md` - 问题6 |

---

## 🎯 任务目标

实现工业级的API请求系统，解决当前没有统一错误处理、loading管理、重试机制、请求缓存等问题：

### 当前问题
```tsx
// 每个页面都重复写try-catch和loading管理（SB代码！）
const [loading, setLoading] = useState(false);
const [error, setError] = useState<Error | null>(null);

const fetchData = async () => {
  try {
    setLoading(true);
    const res = await axios.get('/api/users');
    setData(res.data.data);
  } catch (err) {
    setError(err);
    message.error('请求失败');
  } finally {
    setLoading(false);
  }
};
```

### 改造后
```tsx
// 一行代码搞定loading/error/data管理和自动重试
const { data, isLoading, error } = useRequest('/api/users');
```

---

## 📦 核心交付物

### 1. Axios实例配置与拦截器

**`shared/api/client.ts`** - 核心API客户端
```typescript
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { message } from 'antd';

// 创建axios实例
export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 自动添加Token
apiClient.interceptors.request.use(
  (config) => {
    // 从localStorage或Cookie获取token
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 添加请求ID（用于追踪）
    config.headers['X-Request-ID'] = generateRequestId();

    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 统一错误处理
apiClient.interceptors.response.use(
  (response: AxiosResponse<App.ApiResponse>) => {
    // 后端返回success: false的情况
    if (response.data && !response.data.success) {
      const errorMsg = response.data.message || '请求失败';
      message.error(errorMsg);
      return Promise.reject(new Error(errorMsg));
    }

    return response;
  },
  async (error: AxiosError<App.ApiResponse>) => {
    const { response, config } = error;

    // 1. 处理401 - Token过期
    if (response?.status === 401) {
      message.error('登录已过期，请重新登录');
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    // 2. 处理403 - 权限不足
    if (response?.status === 403) {
      message.error('权限不足');
      return Promise.reject(error);
    }

    // 3. 处理429 - 请求过于频繁
    if (response?.status === 429) {
      message.warning('请求过于频繁，请稍后再试');
      return Promise.reject(error);
    }

    // 4. 处理500 - 服务器错误
    if (response?.status === 500) {
      message.error('服务器错误，请稍后再试');
      return Promise.reject(error);
    }

    // 5. 网络错误
    if (!response) {
      message.error('网络连接失败，请检查网络');
      return Promise.reject(error);
    }

    // 6. 其他错误
    const errorMsg = response?.data?.message || '请求失败';
    message.error(errorMsg);
    return Promise.reject(error);
  }
);

// 生成请求ID
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
```

### 2. useRequest Hook（核心）

**`shared/hooks/useRequest.ts`**
```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/shared/api/client';
import type { AxiosRequestConfig } from 'axios';

export interface UseRequestOptions<T> {
  manual?: boolean;                  // 是否手动触发（默认自动）
  onSuccess?: (data: T) => void;     // 成功回调
  onError?: (error: Error) => void;  // 失败回调
  retry?: number;                    // 重试次数
  retryDelay?: number;               // 重试延迟（毫秒）
  cacheKey?: string;                 // 缓存Key
  cacheTime?: number;                // 缓存时间（毫秒）
}

interface RequestState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
}

// 简单的缓存实现
const requestCache = new Map<string, { data: any; timestamp: number }>();

export const useRequest = <T = any>(
  url: string,
  options?: UseRequestOptions<T>
) => {
  const {
    manual = false,
    onSuccess,
    onError,
    retry = 0,
    retryDelay = 1000,
    cacheKey,
    cacheTime = 5 * 60 * 1000, // 默认缓存5分钟
  } = options || {};

  const [state, setState] = useState<RequestState<T>>({
    data: null,
    isLoading: !manual,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);

  // 检查缓存
  const getCachedData = useCallback((): T | null => {
    if (!cacheKey) return null;

    const cached = requestCache.get(cacheKey);
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > cacheTime;
    if (isExpired) {
      requestCache.delete(cacheKey);
      return null;
    }

    return cached.data as T;
  }, [cacheKey, cacheTime]);

  // 设置缓存
  const setCachedData = useCallback(
    (data: T) => {
      if (!cacheKey) return;
      requestCache.set(cacheKey, { data, timestamp: Date.now() });
    },
    [cacheKey]
  );

  // 执行请求
  const run = useCallback(async () => {
    // 1. 检查缓存
    const cachedData = getCachedData();
    if (cachedData) {
      setState({ data: cachedData, isLoading: false, error: null });
      onSuccess?.(cachedData);
      return cachedData;
    }

    // 2. 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 3. 创建新的AbortController
    abortControllerRef.current = new AbortController();

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await apiClient.get<App.ApiResponse<T>>(url, {
        signal: abortControllerRef.current.signal,
      });

      const data = response.data.data;

      setState({ data, isLoading: false, error: null });
      setCachedData(data);
      onSuccess?.(data);
      retryCountRef.current = 0; // 重置重试次数

      return data;
    } catch (error: any) {
      // 忽略取消请求的错误
      if (error.name === 'CanceledError') {
        return;
      }

      // 重试逻辑
      if (retryCountRef.current < retry) {
        retryCountRef.current++;
        console.log(`请求失败，${retryDelay}ms后重试（${retryCountRef.current}/${retry}）`);

        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        return run(); // 递归重试
      }

      // 重试次数用完，返回错误
      setState({ data: null, isLoading: false, error: error as Error });
      onError?.(error as Error);
      throw error;
    }
  }, [url, getCachedData, setCachedData, onSuccess, onError, retry, retryDelay]);

  // 刷新（清除缓存后重新请求）
  const refresh = useCallback(() => {
    if (cacheKey) {
      requestCache.delete(cacheKey);
    }
    return run();
  }, [run, cacheKey]);

  // 取消请求
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // 自动执行
  useEffect(() => {
    if (!manual) {
      run();
    }

    // 组件卸载时取消请求
    return () => {
      cancel();
    };
  }, [manual, run, cancel]);

  return {
    data: state.data,
    isLoading: state.isLoading,
    error: state.error,
    run,      // 手动触发
    refresh,  // 刷新（清除缓存）
    cancel,   // 取消请求
  };
};
```

### 3. useMutation Hook（用于POST/PUT/DELETE）

**`shared/hooks/useMutation.ts`**
```typescript
import { useState, useCallback } from 'react';
import { apiClient } from '@/shared/api/client';
import { message } from 'antd';

export interface UseMutationOptions<T, V> {
  onSuccess?: (data: T, variables: V) => void;
  onError?: (error: Error, variables: V) => void;
  successMessage?: string;  // 成功提示
  errorMessage?: string;    // 失败提示
}

export const useMutation = <T = any, V = any>(
  url: string,
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'POST',
  options?: UseMutationOptions<T, V>
) => {
  const { onSuccess, onError, successMessage, errorMessage } = options || {};

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (variables: V): Promise<T | undefined> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiClient.request<App.ApiResponse<T>>({
          url,
          method,
          data: variables,
        });

        const data = response.data.data;

        if (successMessage) {
          message.success(successMessage);
        }

        onSuccess?.(data, variables);
        return data;
      } catch (err: any) {
        setError(err);

        if (errorMessage) {
          message.error(errorMessage);
        }

        onError?.(err, variables);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [url, method, onSuccess, onError, successMessage, errorMessage]
  );

  return {
    mutate,
    isLoading,
    error,
  };
};
```

### 4. 使用示例

**示例1：GET请求（自动执行）**
```typescript
import { useRequest } from '@/shared/hooks/useRequest';

const UserProfile = () => {
  const { data: user, isLoading, error, refresh } = useRequest<App.User>(
    '/api/user/profile',
    {
      cacheKey: 'userProfile',
      cacheTime: 10 * 60 * 1000, // 缓存10分钟
      retry: 2,                   // 失败后重试2次
    }
  );

  if (isLoading) return <div>加载中...</div>;
  if (error) return <div>加载失败：{error.message}</div>;

  return (
    <div>
      <h1>{user?.username}</h1>
      <Button onClick={refresh}>刷新</Button>
    </div>
  );
};
```

**示例2：GET请求（手动触发）**
```typescript
const SearchUser = () => {
  const { data, isLoading, run } = useRequest<App.User[]>('/api/users/search', {
    manual: true, // 手动触发
  });

  const handleSearch = (keyword: string) => {
    run(); // 手动触发请求
  };

  return <SearchBar onSearch={handleSearch} />;
};
```

**示例3：POST请求（创建用户）**
```typescript
import { useMutation } from '@/shared/hooks/useMutation';

const CreateUserForm = () => {
  const { mutate: createUser, isLoading } = useMutation<App.User, { username: string }>(
    '/api/users',
    'POST',
    {
      successMessage: '用户创建成功',
      onSuccess: (data) => {
        console.log('新用户ID:', data.id);
      },
    }
  );

  const handleSubmit = async (values: { username: string }) => {
    await createUser(values);
  };

  return <Form onFinish={handleSubmit} loading={isLoading} />;
};
```

---

## ✅ 验收标准

### 功能验收
- [ ] API请求自动添加`Authorization` Header
- [ ] Token过期自动跳转到登录页
- [ ] 401/403/500错误显示对应的提示信息
- [ ] 网络断开时显示"网络连接失败"
- [ ] 请求失败自动重试（最多2次）

### 性能验收
- [ ] 相同请求5分钟内使用缓存，不重复请求
- [ ] 组件卸载时自动取消未完成的请求
- [ ] `refresh()`方法清除缓存并重新请求

### 代码质量
- [ ] 所有API请求都使用`useRequest`或`useMutation`
- [ ] 没有页面组件中直接使用`axios.get/post`
- [ ] 所有API请求都有TypeScript类型定义

---

## 🔧 技术要求

### API响应格式（强制要求）
```typescript
// 成功响应
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}

// 失败响应
{
  "success": false,
  "data": null,
  "message": "操作失败",
  "error_code": "INVALID_PARAMS"
}
```

### 错误码规范
- `INVALID_PARAMS`：参数错误
- `UNAUTHORIZED`：未登录
- `FORBIDDEN`：权限不足
- `NOT_FOUND`：资源不存在
- `QUOTA_EXCEEDED`：配额不足

---

## 📚 参考资料

1. **Axios拦截器**：https://axios-http.com/docs/interceptors
2. **AbortController**：https://developer.mozilla.org/zh-CN/docs/Web/API/AbortController
3. **TanStack Query**：https://tanstack.com/query/latest （更强大的替代方案）

---

## 🚨 注意事项

1. **请求取消**：
   - 组件卸载时必须取消未完成的请求
   - 避免"setState on unmounted component"警告

2. **缓存策略**：
   - 仅GET请求使用缓存
   - POST/PUT/DELETE请求不缓存
   - 缓存时间根据数据更新频率调整

3. **重试策略**：
   - 仅网络错误和500错误重试
   - 401/403/404等业务错误不重试

4. **后续优化**：
   - 建议迁移到TanStack Query（React Query）
   - 支持乐观更新、无限滚动、SSR等高级特性

---

**艹！这个API请求系统搞定后，所有的loading/error/retry都自动化了，再也不用写重复的try-catch了！** 🔥
