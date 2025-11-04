# REL-P2-CACHE-212: 前端缓存策略使用指南

## 📋 概述

本文档介绍了项目的前端缓存策略实施方案，包括SWR (Stale-While-Revalidate)、配置缓存、版本管理等功能。

**目标**：配置发布后1s内自动刷新；模板/筛选元数据/菜单使用缓存策略

## 🎯 核心概念

### 1. SWR (Stale-While-Revalidate)

**理念**：过期后先返回旧数据（Stale），同时在后台更新新数据（Revalidate）

**优势**：
- ✅ 极快的响应速度（立即返回缓存数据）
- ✅ 数据始终保持最新（后台自动更新）
- ✅ 更好的用户体验（无需等待loading）

**流程**：
```
1. 用户请求数据
2. 检查缓存：
   - 有效 → 立即返回缓存
   - 过期 → 返回旧缓存 + 后台更新
   - 无缓存 → 请求新数据
3. 后台更新完成 → 更新缓存
```

### 2. 缓存策略类型

| 策略 | 说明 | 适用场景 |
|------|------|----------|
| **memory** | 内存缓存，页面刷新丢失 | 临时数据、频繁访问 |
| **localStorage** | 持久化存储，跨页面共享 | 配置数据、用户设置 |
| **sessionStorage** | 会话存储，关闭标签页丢失 | 临时状态、表单数据 |

### 3. 缓存版本管理

通过版本号实现强制刷新：

```
配置版本: v1.0.0 → v1.0.1
所有缓存自动失效 → 重新获取
```

## 📚 使用指南

### 1. 基础缓存API

**位置**: `src/lib/cache/index.ts`

#### 1.1 缓存管理器

```typescript
import { globalCacheManager } from '@/lib/cache';

// 设置缓存
globalCacheManager.set('templates', data, {
  ttl: 10 * 60 * 1000, // 10分钟
  version: '1.0.0',
});

// 获取缓存
const cacheItem = globalCacheManager.get('templates');
if (cacheItem) {
  console.log('数据:', cacheItem.data);
  console.log('时间戳:', cacheItem.timestamp);
  console.log('版本:', cacheItem.version);
}

// 检查是否有效
if (globalCacheManager.isValid('templates')) {
  console.log('缓存有效');
}

// 删除缓存
globalCacheManager.remove('templates');

// 清空所有缓存
globalCacheManager.clear();
```

#### 1.2 SWR获取数据

```typescript
import { fetchWithSWR } from '@/lib/cache';

async function getTemplates() {
  const templates = await fetchWithSWR(
    'templates:all',
    async () => {
      const response = await fetch('/api/templates');
      return response.json();
    },
    {
      ttl: 10 * 60 * 1000, // 10分钟
      swr: true, // 启用SWR
    }
  );

  return templates;
}
```

#### 1.3 配置数据缓存

```typescript
import { fetchConfigWithCache } from '@/lib/cache';

async function getSystemConfig() {
  const config = await fetchConfigWithCache(
    'system:config',
    async () => {
      const response = await fetch('/api/config');
      return response.json();
    },
    {
      ttl: 30 * 60 * 1000, // 30分钟
      version: '1.0.0', // 配置版本
      onVersionMismatch: () => {
        console.log('配置版本不匹配，已刷新');
      },
    }
  );

  return config;
}
```

### 2. React Hooks

**位置**: `src/hooks/useCache.ts`

#### 2.1 useCache - 基础缓存Hook

```tsx
import { useCache } from '@/hooks/useCache';

function TemplateList() {
  const { data, loading, error, refetch, invalidate } = useCache(
    'templates:all',
    async () => {
      const response = await fetch('/api/templates');
      return response.json();
    },
    {
      ttl: 10 * 60 * 1000, // 10分钟
      swr: true, // 启用SWR
      refetchOnMount: true, // 挂载时获取
      refetchInterval: 60 * 1000, // 每分钟刷新
    }
  );

  if (loading) return <div>加载中...</div>;
  if (error) return <div>加载失败：{error.message}</div>;

  return (
    <div>
      <button onClick={refetch}>刷新</button>
      <button onClick={invalidate}>清除缓存</button>
      <ul>
        {data?.map((template: any) => (
          <li key={template.id}>{template.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

#### 2.2 useConfig - 配置数据Hook

```tsx
import { useConfig } from '@/hooks/useCache';

function AppLayout() {
  const { data: menu, loading } = useConfig(
    'menu',
    async () => {
      const response = await fetch('/api/menu');
      return response.json();
    },
    {
      ttl: 30 * 60 * 1000, // 30分钟
      version: '1.0.0',
      onVersionMismatch: () => {
        // 版本不匹配时，可以显示提示
        message.info('菜单已更新');
      },
    }
  );

  if (loading) return <Spin />;

  return <Navigation menu={data} />;
}
```

#### 2.3 useCaches - 多个缓存Hook

```tsx
import { useCaches } from '@/hooks/useCache';

function Dashboard() {
  const { data, loading, refetchAll, refetch } = useCaches({
    templates: {
      key: 'templates:all',
      fetcher: async () => {
        const res = await fetch('/api/templates');
        return res.json();
      },
      config: { ttl: 10 * 60 * 1000 },
    },
    categories: {
      key: 'categories:all',
      fetcher: async () => {
        const res = await fetch('/api/categories');
        return res.json();
      },
      config: { ttl: 30 * 60 * 1000 },
    },
    menu: {
      key: 'menu',
      fetcher: async () => {
        const res = await fetch('/api/menu');
        return res.json();
      },
      config: { ttl: 30 * 60 * 1000 },
    },
  });

  if (loading) return <Spin />;

  return (
    <div>
      <button onClick={refetchAll}>全部刷新</button>
      <button onClick={() => refetch('templates')}>刷新模板</button>

      <div>模板数: {data.templates?.length}</div>
      <div>分类数: {data.categories?.length}</div>
      <div>菜单项: {data.menu?.items?.length}</div>
    </div>
  );
}
```

### 3. 缓存键管理

**位置**: `src/lib/cache/index.ts`

使用统一的缓存键生成器，避免键名冲突：

```typescript
import { CacheKeys } from '@/lib/cache';

// 模板列表
const key1 = CacheKeys.templates(); // 'templates:all'
const key2 = CacheKeys.templates('dress'); // 'templates:dress'

// 模板详情
const key3 = CacheKeys.templateDetail('123'); // 'template:123'

// 筛选选项
const key4 = CacheKeys.filters('category'); // 'filters:category'

// 菜单配置
const key5 = CacheKeys.menu(); // 'menu'

// 使用示例
const templates = await fetchWithSWR(
  CacheKeys.templates('dress'),
  async () => {
    const res = await fetch('/api/templates?category=dress');
    return res.json();
  }
);
```

### 4. 批量预加载

在应用启动时预加载关键数据：

```typescript
import { prefetchCache, CacheKeys } from '@/lib/cache';

async function prefetchAppData() {
  await prefetchCache([
    {
      key: CacheKeys.templates(),
      fetcher: async () => {
        const res = await fetch('/api/templates');
        return res.json();
      },
      config: { ttl: 10 * 60 * 1000 },
    },
    {
      key: CacheKeys.menu(),
      fetcher: async () => {
        const res = await fetch('/api/menu');
        return res.json();
      },
      config: { ttl: 30 * 60 * 1000 },
    },
    {
      key: CacheKeys.providers(),
      fetcher: async () => {
        const res = await fetch('/api/providers');
        return res.json();
      },
      config: { ttl: 60 * 60 * 1000 },
    },
  ]);

  console.log('关键数据已预加载');
}

// 在App初始化时调用
prefetchAppData();
```

### 5. 配置版本监听

监听配置版本变化，自动刷新：

```typescript
import { watchConfigVersion } from '@/lib/cache';
import { message } from 'antd';

// 在App根组件中启动监听
function App() {
  useEffect(() => {
    const cleanup = watchConfigVersion('config:version', (newVersion) => {
      message.info(`配置已更新到版本 ${newVersion}，页面将自动刷新`);

      // 1秒后刷新页面
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    });

    return cleanup;
  }, []);

  return <div>{/* 应用内容 */}</div>;
}
```

### 6. 装饰器模式（可选）

为类方法添加缓存：

```typescript
import { Cacheable } from '@/lib/cache';

class TemplateService {
  @Cacheable({ ttl: 10 * 60 * 1000, swr: true })
  async getTemplates(category: string) {
    const response = await fetch(`/api/templates?category=${category}`);
    return response.json();
  }

  @Cacheable({ ttl: 30 * 60 * 1000 })
  async getTemplateDetail(id: string) {
    const response = await fetch(`/api/templates/${id}`);
    return response.json();
  }
}

const service = new TemplateService();

// 首次调用：请求API
const templates = await service.getTemplates('dress');

// 再次调用：返回缓存
const cachedTemplates = await service.getTemplates('dress');
```

## 🎯 实战场景

### 场景1：模板中心页面

```tsx
import { useCache, useCaches } from '@/hooks/useCache';
import { CacheKeys } from '@/lib/cache';

function TemplateCenter() {
  // 获取模板列表（带缓存）
  const {
    data: templates,
    loading: templatesLoading,
    refetch: refetchTemplates,
  } = useCache(
    CacheKeys.templates(),
    async () => {
      const res = await fetch('/api/templates');
      return res.json();
    },
    {
      ttl: 10 * 60 * 1000, // 10分钟
      swr: true,
    }
  );

  // 获取分类和筛选选项（批量）
  const { data: meta, loading: metaLoading } = useCaches({
    categories: {
      key: CacheKeys.categories('template'),
      fetcher: async () => {
        const res = await fetch('/api/categories');
        return res.json();
      },
      config: { ttl: 30 * 60 * 1000 },
    },
    filters: {
      key: CacheKeys.filters('template'),
      fetcher: async () => {
        const res = await fetch('/api/filters');
        return res.json();
      },
      config: { ttl: 30 * 60 * 1000 },
    },
  });

  if (templatesLoading || metaLoading) return <Spin />;

  return (
    <div>
      <Filters categories={meta.categories} filters={meta.filters} />
      <TemplateGrid templates={templates} onUpdate={refetchTemplates} />
    </div>
  );
}
```

### 场景2：用户配置

```tsx
import { useConfig } from '@/hooks/useCache';
import { CacheKeys } from '@/lib/cache';

function UserSettings() {
  const userId = useCurrentUserId();

  const { data: config, loading, refetch } = useConfig(
    CacheKeys.userConfig(userId),
    async () => {
      const res = await fetch(`/api/users/${userId}/config`);
      return res.json();
    },
    {
      ttl: 5 * 60 * 1000, // 5分钟
      version: config?.version || '1.0.0',
    }
  );

  const handleSave = async (newConfig: any) => {
    await fetch(`/api/users/${userId}/config`, {
      method: 'PUT',
      body: JSON.stringify(newConfig),
    });

    // 保存后刷新缓存
    refetch();
  };

  return <ConfigForm config={config} onSave={handleSave} />;
}
```

### 场景3：系统配置监听

```tsx
import { useEffect } from 'react';
import { watchConfigVersion, globalCacheManager } from '@/lib/cache';
import { message } from 'antd';

function AppRoot() {
  useEffect(() => {
    // 监听配置版本变化
    const cleanup = watchConfigVersion('system:version', (newVersion) => {
      message.info('系统配置已更新，正在刷新...');

      // 清空所有缓存
      globalCacheManager.clear();

      // 1秒后刷新页面
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    });

    return cleanup;
  }, []);

  return <App />;
}
```

## 📝 最佳实践

### 1. 选择合适的TTL

```typescript
// ✅ 好的做法
const TTL = {
  SHORT: 5 * 60 * 1000,      // 5分钟 - 频繁变化的数据
  MEDIUM: 30 * 60 * 1000,    // 30分钟 - 配置数据
  LONG: 24 * 60 * 60 * 1000, // 24小时 - 静态数据
};

// 模板列表（变化较频繁）
useCache(key, fetcher, { ttl: TTL.SHORT });

// 系统配置（变化较少）
useConfig(key, fetcher, { ttl: TTL.MEDIUM });

// 静态资源URL（几乎不变）
useCache(key, fetcher, { ttl: TTL.LONG });
```

### 2. 使用统一的缓存键

```typescript
// ✅ 好的做法
import { CacheKeys } from '@/lib/cache';

const key = CacheKeys.templates('dress');
const key2 = CacheKeys.templateDetail('123');

// ❌ 避免硬编码
const badKey = 'templates_dress'; // 容易拼写错误
const badKey2 = `template_${id}`; // 不统一
```

### 3. SWR适用场景

```typescript
// ✅ 适合SWR：配置、元数据、列表
useCache(CacheKeys.templates(), fetcher, { swr: true });
useConfig(CacheKeys.menu(), fetcher); // 默认启用SWR

// ❌ 不适合SWR：实时数据、敏感数据
// 订单状态、支付状态等需要实时准确的数据
useCache('order:status', fetcher, { swr: false, ttl: 0 });
```

### 4. 版本管理策略

```typescript
// 后端API返回配置版本
GET /api/config/version
{
  "version": "1.0.1",
  "updatedAt": "2024-01-15T10:00:00Z"
}

// 前端定期检查版本
watchConfigVersion('config:version', (newVersion) => {
  // 版本变化时的处理
  console.log(`版本更新: ${newVersion}`);
  globalCacheManager.setGlobalVersion(newVersion);
  globalCacheManager.clear();
});
```

### 5. 错误处理

```typescript
const { data, error, refetch } = useCache(key, fetcher);

if (error) {
  return (
    <Alert
      message="加载失败"
      description={error.message}
      type="error"
      action={
        <Button size="small" onClick={refetch}>
          重试
        </Button>
      }
    />
  );
}
```

## 🔍 调试和监控

### 1. 查看缓存统计

```typescript
import { getCacheStats } from '@/lib/cache';

const stats = getCacheStats();
console.log('缓存统计：', {
  总键数: stats.totalKeys,
  有效键数: stats.validKeys,
  过期键数: stats.expiredKeys,
  总大小: `${(stats.totalSize / 1024).toFixed(2)} KB`,
});
```

### 2. 开发者工具

在浏览器Console中：

```javascript
// 查看localStorage中的所有缓存
Object.keys(localStorage).forEach(key => {
  const value = localStorage.getItem(key);
  console.log(key, JSON.parse(value));
});

// 清空所有缓存
localStorage.clear();
```

### 3. 调试日志

```typescript
// 开启详细日志
import { fetchWithSWR } from '@/lib/cache';

const data = await fetchWithSWR(key, fetcher, {
  onCacheHit: () => console.log('[Cache] Hit'),
  onCacheMiss: () => console.log('[Cache] Miss'),
  onUpdate: () => console.log('[Cache] Updated'),
});
```

## ✅ 验收标准

- [x] 缓存工具库实现完整
- [x] React Hooks封装完成
- [x] 支持SWR策略
- [x] 支持版本号管理
- [x] 支持配置自动刷新
- [x] 提供缓存键管理器
- [ ] 模板中心已集成缓存（需在页面中集成）
- [ ] 配置发布后1s内刷新（需后端API支持）

## 🎉 总结

本次前端缓存优化实施了完整的缓存机制：

1. ✅ **SWR策略**：过期后先返回旧数据，后台更新
2. ✅ **多种存储**：memory/localStorage/sessionStorage
3. ✅ **版本管理**：配置版本号，强制刷新
4. ✅ **React Hooks**：useCache/useConfig/useCaches
5. ✅ **批量预加载**：应用启动时预加载关键数据
6. ✅ **自动监听**：配置版本变化自动刷新

通过这些优化，应用的响应速度和用户体验将大幅提升！

---

**艹！老王我这次缓存策略搞得够专业吧！** 🚀
