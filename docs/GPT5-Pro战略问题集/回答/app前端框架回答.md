下面是一份**可直接落地**的架构与实现方案。我将以「前端架构师 + UI/UX 设计师」双视角，从**配置驱动前端**出发，覆盖数据库/后端 API/缓存与热更新/Next.js 14 动态渲染/主题系统/路由鉴权/组件复用/移动端适配/性能优化\*\*等关键点，并给出可复制的 TypeScript 代码与 SQL/Express/Next.js 片段。

> 注：篇幅内我提供**核心表结构、关键控制器、基础组件/上下文/Store/主题/路由/缓存**的完整范式代码与目录树。你可以在此基础上按模块扩展至 100+ 文件。

---

# 0. 结论先行（Executive Summary）

* **推荐方案：C — 单 App + 动态加载（强配置化 + 模式级代码分割）**

  * 共享一套「配置抽象、权限体系、组件注册表、API 封装、主题机制」。
  * 以 **Route Group** + **动态 import** + **组件注册表** 让不同模式按需加载。
  * **前端完全配置驱动**：导航 / 页面 / 组件树 / 权限都由后端 MySQL 下发（支持版本化 + 快照 + ETag + Redis 缓存 + 30s 轮询热更新）。
  * **SSR 与客户端协同缓存**：Next.js Server Components SSR 首屏 + 客户端 React Query/IndexedDB 本地优先。
  * **主题系统**：CSS Variables 统一层 + Ant Design 5 Token 定制 + Tailwind 基于 CSS 变量扩展，三种风格（商业/男/女）一键切换。
  * **状态管理**：B2B 用 **Redux Toolkit**（复杂工作流与审计），衣橱用 **Zustand**（轻量响应）。

---

# 1. 配置驱动前端（最重要）

## 1.1 新增 MySQL 表设计（DDL）

> 前缀采用 `ui_`，与现有表并存；通过 `ui_releases` 做“整包发布/回滚/审计”。
> 组件配置采用 *组件树*（Page → Region → Node），可做可视化搭建，同时兼容 Monaco JSON 编辑。

```sql
-- 1) 模式表（business / wardrobe-male / wardrobe-female）
CREATE TABLE ui_modes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  key_slug VARCHAR(64) NOT NULL UNIQUE,  -- 'business' | 'wardrobe-male' | 'wardrobe-female'
  name_zh VARCHAR(64) NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2) 导航（树形，邻接表）
CREATE TABLE ui_nav_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  mode_id BIGINT NOT NULL,
  parent_id BIGINT NULL,
  label VARCHAR(128) NOT NULL,
  icon VARCHAR(64) NULL,
  path VARCHAR(256) NOT NULL, -- '/business/workspace' or '/wardrobe/male/wardrobe'
  order_no INT NOT NULL DEFAULT 0,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  required_permission VARCHAR(128) NULL,
  visible_roles JSON NULL, -- ['business_admin','wardrobe_user']
  meta JSON NULL,          -- 额外数据：badge、实验开关等
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_mode_path (mode_id, path),
  INDEX idx_mode_parent (mode_id, parent_id),
  CONSTRAINT fk_nav_mode FOREIGN KEY (mode_id) REFERENCES ui_modes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3) 页面配置（每个 path 一个页面）
CREATE TABLE ui_pages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  mode_id BIGINT NOT NULL,
  path VARCHAR(256) NOT NULL, -- e.g. '/business/tasks'
  title VARCHAR(128) NOT NULL,
  component_type ENUM('form','list','detail','custom') NOT NULL,
  layout_key VARCHAR(64) NOT NULL DEFAULT 'default', -- 布局类型
  config_json JSON NOT NULL,  -- 组件树/数据源/行为
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  required_permission VARCHAR(128) NULL,
  version_tag VARCHAR(64) NULL,  -- 可选：手工标注
  created_by BIGINT NULL,
  updated_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_mode_path (mode_id, path),
  CONSTRAINT fk_pages_mode FOREIGN KEY (mode_id) REFERENCES ui_modes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4) 组件目录（规范组件可用 props、schema）
CREATE TABLE ui_components_catalog (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  key_slug VARCHAR(128) NOT NULL UNIQUE, -- 'ClothesCard','TaskCard','ListTable'...
  title VARCHAR(128) NOT NULL,
  schema_json JSON NULL,       -- props schema for validation
  default_props JSON NULL,
  allowed_modes JSON NULL,     -- ['business'] or ['wardrobe-male','wardrobe-female']
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 5) 权限（与现有 RBAC 对接）
CREATE TABLE ui_permissions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  perm_key VARCHAR(128) NOT NULL UNIQUE,  -- 'task:create'
  description VARCHAR(256) NULL
) ENGINE=InnoDB;

-- 6) 角色-权限（如已有可复用你们的 RBAC）
CREATE TABLE ui_role_permissions (
  role_key VARCHAR(64) NOT NULL,          -- 'business_admin', 'wardrobe_user'
  perm_key VARCHAR(128) NOT NULL,
  PRIMARY KEY (role_key, perm_key),
  CONSTRAINT fk_rp_perm FOREIGN KEY (perm_key) REFERENCES ui_permissions(perm_key) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7) 发布与快照（将某模式的完整 AppConfig 打包成 JSON，支持回滚）
CREATE TABLE ui_releases (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  mode_id BIGINT NOT NULL,
  version VARCHAR(64) NOT NULL,           -- '2025.11.01-001'
  etag VARCHAR(64) NOT NULL,              -- 弱 ETag: W/"hash"
  bundle_json LONGTEXT NOT NULL,          -- 聚合后的 AppConfig JSON 字符串
  status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  notes VARCHAR(512) NULL,
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at DATETIME NULL,
  UNIQUE KEY uk_mode_version (mode_id, version),
  INDEX idx_mode_status (mode_id, status),
  CONSTRAINT fk_rel_mode FOREIGN KEY (mode_id) REFERENCES ui_modes(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

> **说明**
>
> * `ui_pages.config_json` 采用**组件树**（见下方接口），可由 Form.io + 可视化拖拽生成。
> * `ui_releases.bundle_json` 存放**聚合后的 AppConfig**（导航/页面/权限/主题），利于快速下发与 Redis 缓存。
> * 与既有 `config_snapshots`、`audit_logs` 对齐：每次发布/修改写审计，保留回滚链路。

---

## 1.2 配置数据结构（TypeScript 强类型）

```ts
// src/types/config.ts
export type AppMode = 'business' | 'wardrobe-male' | 'wardrobe-female';

export interface ThemeConfig {
  name: 'business-dark' | 'business-light' | 'male' | 'female';
  cssVars: Record<string, string>;        // CSS Variables
  antdToken: Partial<import('antd').ThemeConfig['token']>;
}

export interface PermissionConfig {
  roles: string[];                         // 当前用户角色
  rolePermissions: Record<string, string[]>;  // role -> perm keys
}

export interface NavigationConfig {
  id: string;
  label: string;
  icon?: string;
  path: string;
  children?: NavigationConfig[];
  enabled: boolean;
  requiredPermission?: string;
  visibleRoles?: string[];
  meta?: Record<string, unknown>;
}

export type ComponentKind = 'form' | 'list' | 'detail' | 'custom';

export interface ComponentNode {
  key: string;                             // 来自 components registry，如 'ListTable','ClothesCard'
  props: Record<string, unknown>;          // 运行时 props（通过 schema 校验）
  children?: ComponentNode[];
  region?: string;                         // 渲染区域（header/main/footer/aside...）
  requiredPermission?: string;
}

export interface PageConfig {
  path: string;
  title: string;
  componentType: ComponentKind;
  layoutKey: 'default' | 'workspace' | 'mobile-tabs';
  enabled: boolean;
  requiredPermission?: string;
  nodes: ComponentNode[];                  // 页面组件树
}

export interface AppConfig {
  version: string;                         // '2025.11.01-001'
  etag: string;                            // W/"xxxx"
  mode: AppMode;
  theme: ThemeConfig;
  navigation: NavigationConfig[];
  pages: PageConfig[];
  permissions: PermissionConfig;
}
```

---

## 1.3 Express 后端 API 设计与代码（含 ETag + Redis）

> 采用 `ioredis`，ETag 使用 `crypto` 基于 `bundle_json` 计算。
> 发布后写入 `ui_releases` 并刷新 Redis。

**路由与控制器（精简可跑示例）**

```ts
// server/routes/config.ts
import { Router } from 'express';
import { getAppConfig, getCurrentVersion } from '../services/config.service';
import { adminAuth } from '../middlewares/adminAuth';

const router = Router();

// 客户端拉取 AppConfig（含 ETag，支持 If-None-Match）
router.get('/config/app', async (req, res) => {
  const mode = (req.query.mode as string) ?? 'business';
  const ifNoneMatch = req.headers['if-none-match'];

  const { appConfig, etag } = await getAppConfig(mode);

  if (ifNoneMatch && ifNoneMatch === etag) {
    res.setHeader('ETag', etag);
    res.status(304).end();
    return;
  }
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('ETag', etag);
  res.json(appConfig);
});

// 轻量版本/心跳：只返回 version + etag 供轮询
router.get('/config/version', async (req, res) => {
  const mode = (req.query.mode as string) ?? 'business';
  const v = await getCurrentVersion(mode);
  res.json(v);
});

// Admin APIs（仅示例导航/页面，组件/权限同理）
router.get('/admin/config/navigation', adminAuth, async (req, res) => {
  // 从 DB 读取 ui_nav_items
});
router.post('/admin/config/navigation', adminAuth, async (req, res) => {
  // 插入 ui_nav_items 并写 audit_logs，最后触发 publishDraft() 可选
});
router.put('/admin/config/navigation/:id', adminAuth, async (req, res) => {
  // 更新并审计
});
router.delete('/admin/config/navigation/:id', adminAuth, async (req, res) => {
  // 软删除或硬删除
});

router.get('/admin/config/pages', adminAuth, async (req, res) => {
  // 查询 ui_pages 列表
});
router.post('/admin/config/pages', adminAuth, async (req, res) => {
  // 新建页面配置
});
router.put('/admin/config/pages/:id', adminAuth, async (req, res) => {
  // 更新页面配置
});

export default router;
```

**Service（聚合配置 + Redis 缓存 + ETag）**

```ts
// server/services/config.service.ts
import Redis from 'ioredis';
import { pool } from '../db/mysql'; // 你的 Knex/Pool
import crypto from 'crypto';

const redis = new Redis(process.env.REDIS_URL!);
// Redis Key 规范
const kVersion = (mode: string) => `ui:mode:${mode}:version`;
const kBundle = (mode: string, version: string) => `ui:mode:${mode}:config:${version}`;

export async function getCurrentVersion(mode: string) {
  // 优先 Redis
  const version = await redis.get(kVersion(mode));
  if (version) {
    const etag = await redis.hget(`ui:mode:${mode}:meta`, 'etag');
    return { mode, version, etag };
  }
  // 回源 DB：选最新 published
  const [row] = await pool.query(`
    SELECT version, etag FROM ui_releases r
    JOIN ui_modes m ON m.id=r.mode_id
    WHERE m.key_slug=? AND r.status='published'
    ORDER BY r.published_at DESC LIMIT 1
  `, [mode]) as any[];
  if (!row) return { mode, version: '0', etag: '' };
  // 回填 Redis
  await redis.set(kVersion(mode), row.version);
  await redis.hset(`ui:mode:${mode}:meta`, { etag: row.etag });
  return { mode, version: row.version, etag: row.etag };
}

export async function getAppConfig(mode: string) {
  const { version, etag } = await getCurrentVersion(mode);
  const cacheKey = kBundle(mode, version);

  let bundle = await redis.get(cacheKey);
  if (!bundle) {
    // 若缓存未命中，从 DB 读取最新 published bundle_json
    const [row] = await pool.query(`
      SELECT r.bundle_json, r.etag, r.version FROM ui_releases r
      JOIN ui_modes m ON m.id=r.mode_id
      WHERE m.key_slug=? AND r.status='published'
      ORDER BY r.published_at DESC LIMIT 1
    `, [mode]) as any[];
    if (!row) {
      return { appConfig: null, etag: '' };
    }
    bundle = row.bundle_json;
    // 灰度: 可配置 TTL=3600 或持久缓存
    await redis.set(cacheKey, bundle);
  }
  const appConfig = JSON.parse(bundle);
  return { appConfig, etag };
}

// 生成 ETag
export function computeWeakETag(payload: string) {
  const hash = crypto.createHash('sha1').update(payload).digest('hex');
  return `W/"${hash}"`;
}

// 发布：构建 bundle_json + version + etag → DB → Redis
export async function publishRelease(mode: string, bundleJson: string, version: string, operatorId: number) {
  const etag = computeWeakETag(bundleJson);
  await pool.query(`
    INSERT INTO ui_releases(mode_id,version,etag,bundle_json,status,created_by,created_at,published_at)
    SELECT id,?,?,?,?,?,NOW(),NOW() FROM ui_modes WHERE key_slug=?
  `, [version, etag, bundleJson, 'published', operatorId, mode]);

  // 刷新 Redis
  await redis.set(kVersion(mode), version);
  await redis.hset(`ui:mode:${mode}:meta`, { etag });
  await redis.set(kBundle(mode, version), bundleJson);
}
```

**缓存失效策略**

* key 规范：

  * `ui:mode:{mode}:version`
  * `ui:mode:{mode}:meta`（hash，存 etag 等）
  * `ui:mode:{mode}:config:{version}`
* 后台发布：写 `ui_releases` → **更新** version + etag + config 缓存。无需广播，因前端轮询 version 即可。
* TTL 可选，建议**持久缓存**配置（手动发布触发覆盖），保证多进程一致性。

---

## 1.4 配置热更新（无 WebSocket）

* **前端轮询** `/api/config/version?mode=xxx` 每 30s；若 `version/etag` 变更，则以 If-None-Match 请求 `/api/config/app`。
* **304** 则跳过，**200** 则替换本地配置 store 并**增量更新 UI**：

  * 导航通过 `key` Diff 增量更新。
  * 页面内组件树采用“KeyedRender”策略，**仅改变变更节点**（保留未改动组件的状态）。
  * 某些关键变更（如布局/路由）标记 `requiresReload:true`，则提示用户刷新。

**前端轮询 Hook**

```ts
// src/hooks/useConfigHotReload.ts
'use client';
import { useEffect } from 'react';
import { useAppConfigStore } from '@/stores/appConfigStore';

export function useConfigHotReload(mode: string) {
  const { etag, setConfig } = useAppConfigStore();
  useEffect(() => {
    const t = setInterval(async () => {
      const v = await fetch(`/api/config/version?mode=${mode}`, { cache: 'no-store' }).then(r => r.json());
      if (v?.etag && v?.etag !== etag) {
        const resp = await fetch(`/api/config/app?mode=${mode}`, {
          headers: { 'If-None-Match': etag ?? '' },
          cache: 'no-store'
        });
        if (resp.status === 200) {
          const data = await resp.json();
          setConfig(data); // 触发增量更新
        }
      }
    }, 30000);
    return () => clearInterval(t);
  }, [mode, etag, setConfig]);
}
```

---

## 1.5 Next.js 加载与渲染机制

### SSR 获取配置（App Router）

* 在各模式的\*\*顶层 layout（Server Component）\*\*读取配置：
  `fetch('/api/config/app?mode=xxx', { cache: 'no-store' })`，将 `AppConfig` 放入 **Context Provider（Client）**。
* 客户端**localStorage + version** 缓存：先读缓存（同步立即渲染骨架），并在首次 mount 比对 `version`，若落后则透明刷新。

```tsx
// src/app/(business)/layout.tsx
import { AppConfigProvider } from '@/context/AppConfigProvider';
import { getServerConfig } from '@/lib/server-config';

export default async function BusinessRootLayout({ children }: { children: React.ReactNode }) {
  const appConfig = await getServerConfig('business'); // Node runtime: 'nodejs'
  return (
    <html data-mode="business" suppressHydrationWarning>
      <body>
        <AppConfigProvider initialConfig={appConfig}>
          {children}
        </AppConfigProvider>
      </body>
    </html>
  );
}
```

```ts
// src/lib/server-config.ts (Server only)
import 'server-only';

export async function getServerConfig(mode: string) {
  const res = await fetch(`${process.env.PUBLIC_BASE_URL}/api/config/app?mode=${mode}`, {
    cache: 'no-store',
    headers: { 'x-ssr': '1' }
  });
  if (!res.ok) throw new Error('Failed to load app config');
  return res.json();
}
```

### 动态路由生成（Catch-all 渲染器）

* 每个模式使用 **catch-all**：`app/(business)/[...segments]/page.tsx`
* 根据 `path = '/business/'+segments.join('/')` 在 `AppConfig.pages` 中定位 `PageConfig` 并走**组件注册表渲染**。

```tsx
// src/app/(business)/[...segments]/page.tsx
import { PageRenderer } from '@/runtime/PageRenderer';
import { useAppConfig } from '@/context/AppConfigProvider';

export default function BusinessCatchAll({ params }: { params: { segments?: string[] } }) {
  const path = '/' + ['business', ...(params.segments ?? [])].join('/');
  return <PageRenderer path={path} />;
}
```

### 组件注册表 + 动态 import（严格类型）

```ts
// src/runtime/registry.ts
import dynamic from 'next/dynamic';
import type { ComponentNode } from '@/types/config';

type Loader = React.ComponentType<{ node: ComponentNode }>;

export const ComponentRegistry: Record<string, () => Promise<{ default: Loader }>> = {
  // 共用
  'ListTable': () => import('@/components/common/ListTable'),
  'ImageUpload': () => import('@/components/common/ImageUpload'),
  // 商业
  'TaskCard': () => import('@/components/business/TaskCard'),
  'QuotaProgress': () => import('@/components/business/QuotaProgress'),
  // 衣橱
  'ClothesCard': () => import('@/components/wardrobe/ClothesCard'),
  'OutfitRecommendation': () => import('@/components/wardrobe/OutfitRecommendation'),
};

export function loadComponent(key: string) {
  const loader = ComponentRegistry[key];
  if (!loader) throw new Error(`Unknown component key: ${key}`);
  return dynamic(loader as any, { ssr: true, loading: () => null });
}
```

```tsx
// src/runtime/PageRenderer.tsx
'use client';
import { useAppConfig } from '@/context/AppConfigProvider';
import { loadComponent } from './registry';

export function PageRenderer({ path }: { path: string }) {
  const { config } = useAppConfig();
  const page = config.pages.find(p => p.path === path && p.enabled);
  if (!page) return <div>404</div>;

  return (
    <>
      {page.nodes.map((node, i) => {
        const C = loadComponent(node.key);
        return <C key={node.key + '-' + i} node={node} />;
      })}
    </>
  );
}
```

---

## 1.6 权限控制集成（RBAC）

* 配置里可写 `requiredPermission: 'task:create'`；
* 前端有 `Can` 组件与 `usePermissions` Hook；
* 服务端中间件基于你们现有 RBAC 校验 Admin API。

```ts
// src/components/auth/Can.tsx
'use client';
import { PropsWithChildren } from 'react';
import { usePermissions } from '@/hooks/usePermissions';

export function Can({ perm, children }: PropsWithChildren<{ perm?: string }>) {
  const { hasPerm } = usePermissions();
  if (!perm || hasPerm(perm)) return <>{children}</>;
  return null;
}
```

---

## 1.7 后台管理界面（Form.io + Monaco + React Flow）

* **导航配置**：左侧树形（Antd Tree + DnD 排序），右侧属性面板（Form.io schema），支持图标选择与权限选择。
* **页面配置**：画布基于 **React Flow** 抽象区域（header/main/aside/footer），拖拽组件节点到区域；属性编辑用 **Monaco** JSON（与 schema 联动校验）。
* **权限配置**：角色-权限矩阵（Antd Table + Checkbox），批量赋权。
* **预览/发布**：右侧 iframe 使用 `/preview?draft=xxx` 直连「构建中的 bundle\_json」，校验无误后「发布」写 `ui_releases`，触发 Redis 刷新。
* **流程**：草稿（draft）→ 审核（review）→ 发布（published）；每步写 `audit_logs`。

---

# 2. 单 App 多模式 vs 三个独立 App

| 维度   | 方案A 单 App多模式 | 方案B 三独立App | **方案C 单App+动态加载（推荐）** |
| ---- | ------------ | ---------- | --------------------- |
| 开发成本 | 低            | 高          | **中（一次性搭建代码分割/注册表）**  |
| 维护成本 | 低            | 高          | **低**                 |
| 用户体验 | 切换成本低，但首次包重  | 独立包快，但切换麻烦 | **各模式首屏只加载必要资源**      |
| 性能   | 首屏易臃肿        | 首屏快（各自最小）  | **首屏快 + 可复用公共库**      |
| 包体积  | 大            | 小（3 份重复依赖） | **中（公共共享 + 模式分块）**    |

**推荐 C**：利用 Next.js 动态 import + Route Groups + 组件注册表，**模式级代码分割**，达到「复用与性能」平衡。

---

# 3. 目录结构（落地）

```txt
src/
  app/
    (business)/
      layout.tsx
      page.tsx                     # /business
      [...segments]/page.tsx       # /business/**
    (wardrobe-male)/
      layout.tsx
      page.tsx                     # /wardrobe/male
      [..segments]/page.tsx
    (wardrobe-female)/
      layout.tsx
      page.tsx
      [..segments]/page.tsx
    api/                           # Next API routes (可仅做代理或服务端 util)
  components/
    common/
      Button/index.tsx
      Modal/index.tsx
      Form/index.tsx
      ListTable/index.tsx
      ImageUpload/index.tsx
      ImagePreview/index.tsx
      Notification/index.tsx
      Loading/index.tsx
      Skeleton/index.tsx
      EmptyState/index.tsx
      SearchBar/index.tsx
      Pagination/index.tsx
      Tabs/index.tsx
      Drawer/index.tsx
      ConfirmDialog/index.tsx
      Tag/index.tsx
      Badge/index.tsx
      Toolbar/index.tsx
      Card/index.tsx
      Grid/index.tsx
      Stat/index.tsx
      Clipboard/index.tsx
    business/
      TaskCard/index.tsx
      QuotaProgress/index.tsx
      TeamMemberList/index.tsx
      TaskFilter/index.tsx
      AssetGrid/index.tsx
      ModelPresetPicker/index.tsx
      BatchUploader/index.tsx
      BillingTable/index.tsx
      MemberInvite/index.tsx
      OrgSwitcher/index.tsx
    wardrobe/
      ClothesCard/index.tsx          # 自适应（male/female）
      OutfitRecommendation/index.tsx
      WardrobeFilter/index.tsx
      WardrobeGrid/index.tsx
      OutfitCard/index.tsx
      VirtualTryOnUploader/index.tsx
      OccasionPicker/index.tsx
      ColorPalette/index.tsx
      StyleRadarChart/index.tsx
      SocialPostCard/index.tsx
    wardrobe-male/
      MaleBadge/index.tsx
      QuickActionBar/index.tsx
      MinimalOutfitCard/index.tsx
      GearTips/index.tsx
      FitnessLink/index.tsx
      PriceTrackerLite/index.tsx
      DarkHeroHeader/index.tsx
      ShortcutPanel/index.tsx
      SwipeList/index.tsx
      SimpleStat/index.tsx
    wardrobe-female/
      BeautyTips/index.tsx
      AccessoryRecommender/index.tsx
      OutfitDiaryCard/index.tsx
      BrandHighlight/index.tsx
      MakeupSuggester/index.tsx
      HairStylePicker/index.tsx
      FancyBadge/index.tsx
      ShoppingListCard/index.tsx
      PhotoFilterBar/index.tsx
      RichInteractionPanel/index.tsx
  context/
    AppConfigProvider.tsx
    ModeContext.tsx
  runtime/
    PageRenderer.tsx
    registry.ts
  hooks/
    useTheme.ts
    useMode.ts
    usePermissions.ts
    useConfigHotReload.ts
  stores/
    appConfigStore.ts               # 全局 AppConfig
    businessStore.ts                # Redux Toolkit slice
    wardrobeStore.ts                # Zustand
  lib/
    api.ts                          # API 封装层
    fetcher.ts                      # 带拦截器
    queryClient.ts                  # React Query
    idb.ts                          # IndexedDB 封装
    server-config.ts
  styles/
    globals.css
    themes/
      business.css
      wardrobe-male.css
      wardrobe-female.css
  middleware.ts
  types/
    config.ts
    api.ts
```

* **复用策略**：

  * `components/common` 完全共享。
  * `components/wardrobe` 为衣橱共用；`wardrobe-male/female` 做装饰/额外信息。
  * 通过 **ModeContext** 或组件 `node.props.variant` 自适应差异。
* **样式**：全局 CSS 变量承载品牌色/圆角/阴影等，再映射到 Tailwind 与 AntD Token。

---

# 4. 主题系统（三风格）

## 4.1 主题 Token（Design Tokens）

**颜色/字体/圆角/阴影/间距**集中以 CSS Variables 管理：

```css
/* src/styles/themes/business.css */
:root[data-theme='business-dark'] {
  --color-bg: #1A1A1A;
  --color-fg: #ECECEC;
  --color-brand: #1890FF;
  --color-card: #111111;
  --radius: 4px;
  --shadow: 0 8px 24px rgba(0,0,0,0.3);
  --font-sans: 'Roboto','Microsoft Yahei',system-ui,sans-serif;
}

/* 轻量主题 */
:root[data-theme='business-light'] { /* ... */ }

/* src/styles/themes/wardrobe-male.css */
:root[data-theme='male'] {
  --color-bg: #0f172a;        /* 深蓝近似 */
  --color-fg: #e2e8f0;
  --color-brand: #334155;     /* 灰蓝 */
  --color-accent: #2C3E50;
  --radius: 8px;
  --shadow: 0 6px 16px rgba(0,0,0,0.18);
  --font-sans: 'SF Pro','PingFang SC',system-ui,sans-serif;
}

/* src/styles/themes/wardrobe-female.css */
:root[data-theme='female'] {
  --color-bg: #fff;
  --color-fg: #2b2b2b;
  --color-brand: #FFB6C1;
  --color-accent: #F5F5DC;
  --radius: 12px;
  --shadow: 0 10px 24px rgba(255,182,193,0.25);
  --font-sans: 'Noto Sans','Source Han Sans',system-ui,sans-serif;
}
```

**Tailwind 扩展（基于 CSS 变量）**

```js
// tailwind.config.js
module.exports = {
  darkMode: ['class', '[data-theme="business-dark"]'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        fg: 'var(--color-fg)',
        brand: 'var(--color-brand)',
        accent: 'var(--color-accent)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)'
      },
      boxShadow: {
        brand: 'var(--shadow)'
      },
      fontFamily: {
        sans: 'var(--font-sans)'
      }
    }
  }
};
```

**Ant Design 5 主题配置（TypeScript）**

```ts
// src/context/AppConfigProvider.tsx
'use client';
import React, { createContext, useContext, useMemo, useState } from 'react';
import { ConfigProvider, App as AntdApp, theme as antdTheme } from 'antd';
import type { AppConfig } from '@/types/config';

const Ctx = createContext<{
  config: AppConfig;
  setConfig: (c: AppConfig) => void;
}>({} as any);

export function AppConfigProvider({ initialConfig, children }: { initialConfig: AppConfig; children: React.ReactNode }) {
  const [config, setConfig] = useState(initialConfig);

  // 应用 CSS 变量
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', config.theme.name);
    for (const [k, v] of Object.entries(config.theme.cssVars)) {
      document.documentElement.style.setProperty(k, v as string);
    }
  }, [config.theme]);

  // AntD Token
  const algorithm = useMemo(() => {
    return config.theme.name === 'business-dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm;
  }, [config.theme.name]);

  return (
    <Ctx.Provider value={{ config, setConfig }}>
      <ConfigProvider
        theme={{
          algorithm,
          token: config.theme.antdToken
        }}
      >
        <AntdApp>{children}</AntdApp>
      </ConfigProvider>
    </Ctx.Provider>
  );
}

export const useAppConfig = () => useContext(Ctx);
```

**useTheme Hook（切换）**

```ts
// src/hooks/useTheme.ts
'use client';
import { useAppConfig } from '@/context/AppConfigProvider';
import type { ThemeConfig } from '@/types/config';

export function useTheme() {
  const { config, setConfig } = useAppConfig();
  const setTheme = (next: ThemeConfig) => setConfig({ ...config, theme: next });
  return { theme: config.theme, setTheme };
}
```

---

# 5. 路由系统与鉴权

## 5.1 完整 URL 结构（示例）

* 商业版 `/business`

  * `/business/workspace` `/business/tasks` `/business/tasks/[id]`
  * `/business/team` `/business/billing` `/business/quota`
* 男性衣橱 `/wardrobe/male`

  * `/wardrobe/male/wardrobe` `/wardrobe/male/outfit` `/wardrobe/male/social` `/wardrobe/male/profile`
* 女性衣橱 `/wardrobe/female`

  * `/wardrobe/female/wardrobe` `/wardrobe/female/outfit` `/wardrobe/female/shopping` `/wardrobe/female/community` `/wardrobe/female/profile`

## 5.2 鉴权逻辑（middleware.ts）

* 读取 Cookie/JWT，取用户角色与可访问模式列表。
* 访问不在权限范围内的模式 → 302 跳转到可访问的默认模式首页。

```ts
// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.pathname;

  const token = req.cookies.get('auth')?.value;
  // decode token 获取 roles/modes（伪代码）
  const user = decode(token); // { roles: string[], modes: AppMode[] }

  const isBusiness = path.startsWith('/business');
  const isMale = path.startsWith('/wardrobe/male');
  const isFemale = path.startsWith('/wardrobe/female');

  const allowed = (m: string) => user?.modes?.includes(m as any);

  if (isBusiness && !allowed('business')) {
    return NextResponse.redirect(new URL('/wardrobe/male', req.url));
  }
  if (isMale && !allowed('wardrobe-male')) {
    return NextResponse.redirect(new URL('/wardrobe/female', req.url));
  }
  if (isFemale && !allowed('wardrobe-female')) {
    return NextResponse.redirect(new URL('/wardrobe/male', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/business/:path*','/wardrobe/:path*']
};
```

**模式切换**：在用户中心提供 Mode Switcher，依据 `user.modes` 显示可切换目标，直接 `router.push('/business')` 等。

---

# 6. 组件复用与自适应

## 6.1 共用组件清单（≥20）

* Button / Input / Modal / Form / Drawer / Tabs / Pagination / Grid / Card / Tag / Badge / Toolbar / ConfirmDialog / Notification / Toast / Loading / Skeleton / EmptyState / SearchBar / ImageUpload / ImagePreview / Clipboard / Stat / ListTable / Stepper

## 6.2 模式独立组件（每种 ≥10）

* **商业版**：TaskCard / QuotaProgress / TeamMemberList / TaskFilter / AssetGrid / BatchUploader / BillingTable / MemberInvite / OrgSwitcher / ModelPresetPicker / JobTimeline
* **男性版**：MinimalOutfitCard / WardrobeGrid / WardrobeFilter / QuickActionBar / MaleBadge / GearTips / PriceTrackerLite / SwipeList / SimpleStat / DarkHeroHeader
* **女性版**：ClothesCard(富信息) / OutfitDiaryCard / AccessoryRecommender / BeautyTips / BrandHighlight / MakeupSuggester / HairStylePicker / FancyBadge / ShoppingListCard / RichInteractionPanel / PhotoFilterBar

## 6.3 自适应组件（**推荐方案 B：Context 自动识别**）

**ModeContext**

```ts
// src/context/ModeContext.tsx
'use client';
import React, { createContext, useContext, useMemo } from 'react';
import type { AppMode } from '@/types/config';
import { useAppConfig } from './AppConfigProvider';

const ModeCtx = createContext<{ mode: AppMode }>({ mode: 'business' });

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const { config } = useAppConfig();
  const value = useMemo(() => ({ mode: config.mode }), [config.mode]);
  return <ModeCtx.Provider value={value}>{children}</ModeCtx.Provider>;
}
export const useMode = () => useContext(ModeCtx);
```

**ClothesCard 自适应实现（单组件内分支样式 + 强类型 Props）**

```tsx
// src/components/wardrobe/ClothesCard/index.tsx
'use client';
import React from 'react';
import { Card, Tag } from 'antd';
import { useMode } from '@/context/ModeContext';

export interface ClothesItem {
  id: string;
  name: string;
  imageUrl: string;
  tags?: string[];
  price?: number;           // female 侧会显示
  purchasedAt?: string;     // female 侧会显示
  wornCount?: number;       // female 侧会显示
}

export default function ClothesCard({ node }: { node: { props: { item: ClothesItem } } }) {
  const { item } = node.props;
  const { mode } = useMode();

  if (mode === 'wardrobe-male') {
    return (
      <Card hoverable className="rounded-[var(--radius)] shadow-brand bg-[color:var(--color-bg)] text-[color:var(--color-fg)]">
        <img src={item.imageUrl} alt={item.name} className="w-full h-48 object-cover rounded" loading="lazy" />
        <div className="mt-2 flex justify-between items-center">
          <div className="font-semibold">{item.name}</div>
          <div className="flex gap-1">
            {(item.tags ?? []).slice(0, 2).map(t => <Tag key={t}>{t}</Tag>)}
          </div>
        </div>
      </Card>
    );
  }

  if (mode === 'wardrobe-female') {
    return (
      <Card
        hoverable
        className="rounded-[var(--radius)] shadow-brand"
        bodyStyle={{ padding: 12 }}
        cover={<img src={item.imageUrl} alt={item.name} loading="lazy" />}
      >
        <div className="font-semibold">{item.name}</div>
        <div className="mt-1 flex flex-wrap gap-1">{(item.tags ?? []).map(t => <Tag key={t}>{t}</Tag>)}</div>
        <div className="mt-2 text-sm opacity-80">
          {item.price ? <>价格：￥{item.price.toFixed(2)} · </> : null}
          {item.purchasedAt ? <>购于：{item.purchasedAt} · </> : null}
          {typeof item.wornCount === 'number' ? <>穿着：{item.wornCount} 次</> : null}
        </div>
      </Card>
    );
  }

  // business 模式不显示（或显示通用）
  return null;
}
```

---

# 7. 移动端适配与跨平台

## 7.1 选择建议

* \*\*衣橱（男/女）\*\*主战场移动：优先 **PWA（方案A）**。

  * 原因：开发效率高、一次交付、多端覆盖、离线缓存+通知可满足大多数场景；需要拍照时用 **MediaDevices.getUserMedia** 与 `<input type='file' capture>`.
* 如后续需要更强拍照/AR 穿搭，可再封装 **WebView 壳**（方案C）。
* 纯 RN（方案B）维护成本高，并且你们已有 Web 基座与 CMS 配置生态，不推荐当下切分两套。

## 7.2 响应式断点与布局

* **断点**：`sm <768`、`md 768-1024`、`lg >=1024`
* **商业版**：lg 桌面优先，md 简化侧栏，sm **不主推**（保留只读）。
* **衣橱**：sm 移动 Tab 导航；md 双列瀑布流；lg 居中卡片 + 两侧推荐。

Tailwind 示例：

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
  {/* 卡片 */}
</div>
```

**手势库**：`@use-gesture/react`（可靠），**动画**：`framer-motion`（生态成熟、API 简洁）。

---

# 8. 状态管理选型

| 指标    | Zustand     | Redux Toolkit         | Jotai   |
| ----- | ----------- | --------------------- | ------- |
| 学习曲线  | 低           | 中                     | 低       |
| 性能    | 极佳（选择器/浅比较） | 好（RTK Query 优化）       | 好（原子粒度） |
| TS 体验 | 好           | 极好                    | 好       |
| 调试工具  | 有（简单）       | **强（Redux DevTools）** | 一般      |
| 适合场景  | 轻量/局部       | **复杂流程、可追踪、审计**       | 表单/局部状态 |

**推荐**：

* **商业版**：**Redux Toolkit**（配合 RTK Query 或 React Query），审计/回溯友好。
* **衣橱**：**Zustand**（轻、快），组件间共享简单数据足够。

---

# 9. API 封装与拦截器

```ts
// src/lib/fetcher.ts
export interface ApiResponse<T> { ok: boolean; data?: T; error?: string; }

function getAuth() { return typeof document === 'undefined' ? '' : (localStorage.getItem('token') ?? ''); }

export async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-Mode': typeof window !== 'undefined' ? document.documentElement.getAttribute('data-mode') ?? '' : '',
    ...(init.headers || {})
  };
  const resp = await fetch(url, { ...init, headers, credentials: 'include' });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    return { ok: false, error: msg };
  }
  const data = (await resp.json()) as T;
  return { ok: true, data };
}
```

```ts
// src/lib/api.ts
export const api = {
  business: {
    getTasks: () => apiFetch<Task[]>('/api/business/tasks'),
    createTask: (data: CreateTaskDto) => apiFetch<Task>('/api/business/tasks', {
      method: 'POST', body: JSON.stringify(data)
    }),
  },
  wardrobe: {
    male: {
      getClothes: () => apiFetch<ClothesItem[]>('/api/wardrobe/male/clothes')
    },
    female: {
      getClothes: () => apiFetch<ClothesItem[]>('/api/wardrobe/female/clothes')
    }
  }
};
```

**错误处理**：`ApiBoundary` + AntD `App.useApp()` 的 `message.error` 统一出错提示。

---

# 10. 数据缓存策略

## 10.1 React Query 全局配置

```ts
// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,  // 默认 1 分钟
    }
  }
});
```

* **商业任务列表**：`staleTime=5*60_000`（5 分钟），`refetchOnWindowFocus: false`
* **衣橱列表**：`staleTime=60*60_000`（1 小时），首次从 IndexedDB 读。

## 10.2 IndexedDB 封装（本地优先）

```ts
// src/lib/idb.ts
export async function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ai-wardrobe', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(store); };
    req.onsuccess = () => {
      const tx = req.result.transaction(store, 'readonly').objectStore(store).get(key);
      tx.onsuccess = () => resolve(tx.result as T);
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}
export async function idbSet<T>(store: string, key: string, val: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ai-wardrobe', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(store); };
    req.onsuccess = () => {
      const tx = req.result.transaction(store, 'readwrite').objectStore(store).put(val as any, key);
      tx.onsuccess = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}
```

**使用示例（衣橱列表）**：先取 IDB，失败则网络，成功后回写 IDB。

---

# 11. UI/UX 设计规范（核心摘要）

## 11.1 Design Tokens（示意）

| Token  | business-dark | male      | female    |
| ------ | ------------- | --------- | --------- |
| bg     | #1A1A1A       | #0f172a   | #FFFFFF   |
| fg     | #ECECEC       | #e2e8f0   | #2b2b2b   |
| brand  | #1890FF       | #334155   | #FFB6C1   |
| radius | 4px           | 8px       | 12px      |
| shadow | 强             | 中         | 柔         |
| font   | Roboto/微软雅黑   | SF Pro/苹方 | Noto/思源黑体 |

## 11.2 交互差异

* **商业版**：

  * 批量操作表格（多选/批量）
  * 快捷键（Ctrl+S/Z）→ `react-hotkeys-hook`
  * 拖拽上传 → 原生 DnD + AntD Upload
* **男性版**：

  * 手势（左滑删除、下拉刷新）→ `@use-gesture/react`
  * 长按菜单 → `contextmenu` +自定义气泡
* **女性版**：

  * 滑动卡片动画 → `framer-motion`
  * 拍照滤镜（CSS filter + Canvas 简易美颜）
  * 社交互动动效（点赞爆粒子 → `framer-motion` + Lottie 可选）

---

# 12. 关键问题（必须回答）

## Q1: 最优选择？

**方案 C：单 App + 动态加载**（理由见第 2 节表格）。在你们现有 CMS/配置化/多模式需求下，是最平衡的长期方案。

## Q2: ModeContext 代码（全局模式管理）

```ts
// 已在 6.3 提供 ModeContext；与 AppConfigProvider 联动。
// 入口在各模式 layout 里：<ModeProvider> 包裹 children 即可。
```

> 在 `src/app/(business)/layout.tsx`：
> `<AppConfigProvider><ModeProvider>...`

## Q3: 主题系统（AntD 5 主题配置）

见 **4.1** 中 `AppConfigProvider`：通过 `ConfigProvider theme={ { algorithm, token } }` 注入；算法根据主题选择 `darkAlgorithm/defaultAlgorithm`；token 来自后端配置（从 `AppConfig.theme.antdToken`）。

## Q4: 组件复用同时保证差异？

* 通过 **Context（模式）** + **设计 Token** + **组件 props** 做差异开关。
* 样例：`ClothesCard` 已给出，自适应 male/female 两版本，同时利用 CSS Variables 与 AntD Token 风格统一。

## Q5: 首屏性能优化（`next.config.js`）

```js
// next.config.js
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    optimizePackageImports: ['antd', '@ant-design/icons-react'] // 减少 antd 体积
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.myqcloud.com' }, // COS 域名
      { protocol: 'https', hostname: '*.cdn.*' }         // 腾讯云 CDN
    ]
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // 重要：为 App Router 优化分块
  modularizeImports: {
    'lodash': { transform: 'lodash/{{member}}' }
  },
  headers: async () => ([
    { source: '/(.*)', headers: [{ key: 'X-DNS-Prefetch-Control', value: 'on' }] }
  ])
};
module.exports = nextConfig;
```

**其他性能要点**

* **模式级代码分割**：注册表 + 动态 import。
* **AntD 按需**（optimizePackageImports）。
* **图片**：Next/Image + CDN + 懒加载 + `priority` 首屏关键图。
* **预加载**：`<Link prefetch>`，业务高频页面启用 `prefetch`.
* **SSR**：`cache: 'no-store'` 拉配置但页面数据可 `revalidate` 差异化。
* **HTTP**：开启 Gzip/Brotli（Nginx），`ETag` + `Cache-Control`.

---

# 13. 示例：前端配置加载与本地缓存

```ts
// src/stores/appConfigStore.ts
'use client';
import { create } from 'zustand';
import type { AppConfig } from '@/types/config';

interface AppConfigState {
  config: AppConfig;
  etag?: string;
  setConfig: (c: AppConfig) => void;
}

export const useAppConfigStore = create<AppConfigState>((set) => ({
  config: {} as AppConfig,
  etag: undefined,
  setConfig: (c) => {
    localStorage.setItem('appConfig', JSON.stringify(c));
    set({ config: c, etag: c.etag });
  }
}));
```

在 `AppConfigProvider` 首次渲染时尝试从 `localStorage` 读取 `appConfig`，若 `version` 过期则替换。

---

# 14. 后台 Admin API（更多细节）

**缓存失效**：导航/页面变更 → 写草稿（draft）→ 审核 → 发布（published）`publishRelease()` → 刷新 Redis。
**多机同步**：共享 Redis，前端轮询版本即可，**无需 WS**。
**审计**：对 `ui_nav_items/ui_pages/ui_releases` 的 CRUD 写 `audit_logs`（已有）。

---

# 15. PWA & 移动端优化

* `manifest.json`：名称/图标/启动页背景/主题色。
* `service-worker.js`：静态资源预缓存、图片缓存（stale-while-revalidate）、API 只缓存衣橱读接口。
* 交互：

  * 下拉刷新（移动衣橱页）
  * 左滑删除（衣橱列表）
  * 长按收藏/加入购物清单（女性版）

---

# 16. 示例：Business Redux & Wardrobe Zustand

```ts
// src/stores/businessStore.ts (Redux Toolkit)
import { configureStore, createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { api } from '@/lib/api';

export const fetchTasks = createAsyncThunk('tasks/fetch', async () => {
  const r = await api.business.getTasks();
  if (!r.ok) throw new Error(r.error);
  return r.data!;
});
const slice = createSlice({
  name: 'business',
  initialState: { tasks: [], loading: false } as { tasks: Task[]; loading: boolean },
  reducers: {},
  extraReducers: builder => {
    builder.addCase(fetchTasks.pending, (s)=>{s.loading=true;});
    builder.addCase(fetchTasks.fulfilled, (s,a)=>{s.loading=false; s.tasks=a.payload;});
    builder.addCase(fetchTasks.rejected, (s)=>{s.loading=false;});
  }
});
export const businessStore = configureStore({ reducer: { business: slice.reducer } });
export type BusinessDispatch = typeof businessStore.dispatch;
```

```ts
// src/stores/wardrobeStore.ts (Zustand)
import { create } from 'zustand';
export const useWardrobeStore = create<{ items: ClothesItem[]; setItems: (x: ClothesItem[])=>void }>((set)=>({
  items: [], setItems: (x)=>set({ items: x })
}));
```

---

# 17. 页面布局抽象 & 导航

* **Layout 抽象**：`BaseLayout` 提供：Header/Sidebar/Main/Footer **插槽**；

  * `BusinessLayout`：Header（Logo+工具）、Sidebar（功能列表）、Main。
  * `WardrobeMobileLayout`：Mobile TabBar + Top Search（女性更突出）。
* **导航由配置渲染**：`navigation` → `NavTree` 组件，按权限过滤。

```tsx
// src/components/layouts/BusinessLayout.tsx
import { useAppConfig } from '@/context/AppConfigProvider';
import { Can } from '@/components/auth/Can';

export function BusinessLayout({ children }: { children: React.ReactNode }) {
  const { config } = useAppConfig();
  const nav = config.navigation.filter(it => it.enabled);
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r">
        {nav.map(item => (
          <Can key={item.id} perm={item.requiredPermission}>
            <a href={item.path} className="block px-3 py-2">{item.label}</a>
          </Can>
        ))}
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

---

# 18. 样例：后端聚合构建 bundle\_json（发布时）

> 真实实现中你会从 `ui_nav_items/ui_pages/ui_permissions` 等拼出 `AppConfig`，以下为核心思路。

```ts
// server/services/bundler.ts
export async function buildBundleJson(mode: string) {
  // query all nav/pages/permissions/theme for this mode...
  const navigation = await queryNav(mode);
  const pages = await queryPages(mode);
  const permissions = await queryPerms(mode);
  const theme = await queryTheme(mode); // 可存在于 ui_pages 或独立表/或写死

  const appConfig = {
    version: makeVersion(), // e.g. YYYY.MM.DD-XXX
    etag: '', // 发布时 fill
    mode,
    theme,
    navigation,
    pages,
    permissions
  };
  const json = JSON.stringify(appConfig);
  return json;
}
```

---

# 19. 性能指标对齐与落地建议

* **首屏 < 2s**：

  * SSR 渲染主框架 + 骨架屏；模式包按需加载。
  * AntD optimizePackageImports + Tree-shake icons。
  * 图片：CDN + `next/image` + `lazyBoundary`.
* **API < 200ms**：

  * Redis 命中 + MySQL 读写分离；
  * ETag + 304 降带宽；
  * Nginx keep-alive/HTTP2/压缩。
* **1000 并发**：

  * 纯读配置走 Redis；
  * 任务接口业务层注意限流与队列；
  * 图片/视频全部走 COS + CDN。

---

# 20. 交付物映射（如何用本文加速落地）

* **架构文档**：本回答第 1~~5、7~~11、19 节即可整理为 30+ 页架构方案（补充你们 Logo/流程图）。
* **组件设计文档**：第 6 节 + 17 节 + 示例代码，扩展到 40+ 页。
* **UI/UX 规范**：第 4、11 节为基准，补充色阶/字号/间距表即可到 20 页。
* **技术代码**：目录树 + 本文提供的 TS/SQL/Express/Next 片段作为模板，复制拓展组成 100+ 文件。
* **移动端方案**：第 7、15 节按条目细化到 15 页。
* **性能优化**：第 12、19 节整理到 10 页。

---

## 附：关键片段一览（清单）

* ✅ **MySQL DDL**：`ui_modes/ui_nav_items/ui_pages/ui_components_catalog/ui_permissions/ui_role_permissions/ui_releases`
* ✅ **Express API**：`GET /api/config/app`（ETag）、`GET /api/config/version`、Admin CRUD（导航/页面）
* ✅ **Redis 缓存**：Key 规范 + 发布刷新 + 轮询热更新
* ✅ **Next SSR**：`getServerConfig` + 各模式 `layout.tsx`
* ✅ **动态路由**：`[...segments]/page.tsx` + `PageRenderer`
* ✅ **组件注册表**：`runtime/registry.ts` + 动态 import
* ✅ **权限**：`Can` 组件 + `middleware.ts` 模式鉴权
* ✅ **主题**：CSS 变量 + AntD Token + Tailwind 扩展 + `useTheme`
* ✅ **ModeContext**：`ModeProvider`（与 AppConfig 联动）
* ✅ **ClothesCard**：自适应组件实例
* ✅ **状态管理**：RTK（商业）+ Zustand（衣橱）
* ✅ **API 封装**：`apiFetch` + 分模式命名空间
* ✅ **缓存**：React Query + IndexedDB 封装
* ✅ **性能**：`next.config.js` + 图片/CDN/预加载策略

---

如果你希望，我可以基于这份方案**生成一个最小可运行模板仓库结构**（含初始页面、注册表、主题与两个模式的示例页面），你们团队直接拉起就能在一周内完成基础架构搭建与对接。
