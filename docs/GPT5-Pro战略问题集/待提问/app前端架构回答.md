下面是一份 **可直接落地** 的完整前端方案（Next.js 14 App Router + Ant Design 5 + TypeScript + Tailwind）。我从“前端架构师 + UI/UX 设计师”的双重视角，将核心设计、代码骨架、主题体系、状态与缓存、路由与鉴权、组件复用策略、移动端适配与性能优化全部落到**可执行的代码与结构**上。你可以用它在 **1 周内完成基础架构搭建**，第 2 周进入三种模式的核心页面开发。

---

# 0. 结论速览（给决策者）

* **推荐模式**：**方案 C｜单 App + 动态加载**

  * 三个模式共享一套基础设施（路由、主题、组件内核、状态引擎、API 层、缓存体系），首屏只加载当前模式资源，其他模式 **按需 code-split**。
  * **配置驱动**：前端 UI 由后端 JSON 配置驱动（导航、页面、模块、权限、主题），支持 **SSE/WebSocket 热更新**，无需重新发版即可上线/下线/排序功能模块。
  * **插件/组件注册表**：内置组件通过 **组件注册表**动态加载；扩展能力通过 **远程 ESM 插件（客户端渲染）** 注入（安全沙箱/白名单），实现“新增模块无需发版”的最大化。
  * **状态管理**：

    * 商业版（复杂、多租户、审计）➡️ **Redux Toolkit + RTK Query**（或 TanStack Query 搭配 Zustand）
    * 衣橱（轻量、移动端优先）➡️ **Zustand + TanStack Query**
  * **主题体系**：AntD 5 `ConfigProvider` + **CSS Variables** + Tailwind 变量化，模式切换与深浅色切换同时生效。
  * **性能**：模式级分包、重型组件（Monaco/ReactFlow/编辑器/试穿）**延迟加载**；SSR + RSC 数据提早 Hydration；图片与数据多级缓存（CDN + SW + IndexedDB + React Query）。

---

# 1. 配置驱动前端（最重要）

## 1.1 配置数据结构（TypeScript）

> 既能覆盖导航/页面/权限/主题，也能支撑“远程插件”。

```ts
// src/types/config.ts
export type AppMode = 'business' | 'wardrobe-male' | 'wardrobe-female';

export interface ThemeConfig {
  // 设计 Token（AntD + 自定义变量），映射到 CSS Variables
  name: string;                 // e.g. 'business-dark'
  appearance: 'light' | 'dark'; // 深浅色
  tokens: Record<string, string | number>; // e.g. { colorPrimary: '#1890ff', radius: 4, ... }
}

export interface PermissionRule {
  action: string;          // 如 'task:create'
  roles: string[];         // 允许的角色
}

export interface PermissionConfig {
  rules: PermissionRule[];
  // 可选：按租户/成员级覆盖
  roleHierarchy?: string[]; // ['owner','admin','member','viewer']
}

export interface NavigationConfig {
  id: string;
  label: string;
  icon?: string;             // AntD icon 名称或自定义
  path: string;              // e.g. '/business/workspace'
  children?: NavigationConfig[];
  enabled: boolean;
  requiredPermission?: string;
  order?: number;
  badgeQueryKey?: string;    // 可选：动态角标
}

export type BuiltinComponentType =
  | 'FormBuilder'
  | 'TaskList'
  | 'TaskDetail'
  | 'QuotaPanel'
  | 'ImageGenerator'
  | 'VideoGenerator'
  | 'WardrobeGrid'
  | 'OutfitRecommend'
  | 'TryOn'
  | 'CommunityFeed'
  | 'ShoppingAdvisor'
  | 'StatsDashboard'
  | 'CustomHTML';

export interface BuiltinPageConfig {
  kind: 'builtin';
  componentType: BuiltinComponentType;
  props?: Record<string, unknown>;
}

export interface RemotePageConfig {
  kind: 'remote';
  // 远程 ESM 插件（仅客户端渲染）
  // 示例： https://cdn.yourdomain.com/plugins/ai-design@1.0.4/entry.js
  esmUrl: string;
  exportName?: string; // 默认 'default'
  props?: Record<string, unknown>;
  sandbox?: 'iframe' | 'direct'; // 安全策略
  integrity?: string; // 可选 SRI
  allowedOrigins?: string[]; // iframe sandbox 白名单
}

export type PageKindConfig = BuiltinPageConfig | RemotePageConfig;

export interface PageConfig {
  id: string;
  path: string; // '/business/tasks' 或 '/wardrobe/male/wardrobe'
  layout?: 'default' | 'workspace' | 'mobile-tabs';
  enabled: boolean;
  requiredPermission?: string;
  page: PageKindConfig;
  seo?: { title?: string; description?: string };
}

export interface AppConfig {
  version: string;            // 版本号（用于缓存）
  mode: AppMode;
  theme: ThemeConfig;
  navigation: NavigationConfig[];
  pages: PageConfig[];
  permissions: PermissionConfig;
  featureFlags?: Record<string, boolean>;
  // 插件白名单声明（安全）
  pluginAllowList?: string[]; // 允许加载的 cdn 域名
  updatedAt?: string;
}
```

## 1.2 配置加载/缓存/热更新

* **首次加载**：Server Component 布局中 `fetch('/api/config/app?mode=xxx', { next: { revalidate: 60, tags: ['app-config'] }})`，SSR 首屏。
* **缓存**：

  * **ETag/If-None-Match** 条件请求；
  * 浏览器 **localStorage** 以 `version` 作为 Key；
  * **React Query** 二级缓存；
* **热更新**：后台改动后，经 **SSE**（推荐）或 WebSocket 推送 `{type:'CONFIG_UPDATED', version:'...'}`，客户端触发重新获取并刷新注册表。

```ts
// src/lib/configLoader.ts
'use client';

import { AppConfig } from '@/types/config';
import { create } from 'zustand';

type ConfigState = {
  config?: AppConfig;
  setConfig: (c: AppConfig) => void;
};

export const useConfigStore = create<ConfigState>()((set) => ({
  setConfig: (c) => set({ config: c }),
}));

const STORAGE_KEY = (mode: string) => `app-config:${mode}`;
const E_TAG_KEY = (mode: string) => `app-config:etag:${mode}`;

export async function loadAppConfig(mode: string): Promise<AppConfig> {
  // 优先用本地缓存（含 version）
  const cached = localStorage.getItem(STORAGE_KEY(mode));
  const etag = localStorage.getItem(E_TAG_KEY(mode)) ?? undefined;

  const res = await fetch(`/api/config/app?mode=${mode}`, {
    headers: etag ? { 'If-None-Match': etag } : {},
    credentials: 'include',
  });

  if (res.status === 304 && cached) return JSON.parse(cached);

  const cfg = (await res.json()) as AppConfig;
  const newEtag = res.headers.get('ETag') ?? '';
  localStorage.setItem(STORAGE_KEY(mode), JSON.stringify(cfg));
  if (newEtag) localStorage.setItem(E_TAG_KEY(mode), newEtag);
  return cfg;
}

export function subscribeConfigHotUpdate(mode: string) {
  // SSE 更简单稳定
  const es = new EventSource(`/api/config/stream?mode=${mode}`, { withCredentials: true });
  es.onmessage = async (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg?.type === 'CONFIG_UPDATED') {
        const cfg = await loadAppConfig(mode);
        useConfigStore.getState().setConfig(cfg);
      }
    } catch {}
  };
  es.onerror = () => { /* 可重连 */ };
  return () => es.close();
}
```

## 1.3 动态路由生成（App Router 友好）

> 文件系统路由是固定的，因此采用\*\*“虚拟页面渲染器”\*\*：用 catch-all 页面在每个模式路由组中将 `config.pages` 映射为页面。新增/禁用页面无需发版。

```
app/
  (business)/business/[[...segments]]/page.tsx        // ConfigPageRenderer（业务）
  (wardrobe-male)/wardrobe/male/[[...segments]]/page.tsx
  (wardrobe-female)/wardrobe/female/[[...segments]]/page.tsx
```

```tsx
// app/(business)/business/[[...segments]]/page.tsx
import { ConfigPageRenderer } from '@/modules/runtime/ConfigPageRenderer';
import { getServerConfig } from '@/modules/runtime/server-config'; // RSC fetch
export default async function BusinessCatchAll({ params }: { params: { segments?: string[] } }) {
  const path = ['/business', ...(params.segments ?? [])].join('/').replace(/\/+$/, '');
  const config = await getServerConfig('business'); // SSR 拉取
  return <ConfigPageRenderer path={path} initialConfig={config} />;
}
```

## 1.4 动态组件渲染（组件注册表）

* **内置组件**：通过 `ComponentRegistry` 动态 import（`next/dynamic`）实现代码分割。
* **远程组件**：允许 ESM URL（仅客户端渲染）；不可信插件可 **iframe 沙箱**。

```tsx
// src/modules/runtime/ComponentRegistry.tsx
'use client';

import dynamic from 'next/dynamic';
import React, { Suspense } from 'react';
import type { BuiltinComponentType, RemotePageConfig } from '@/types/config';

// 本地内置组件动态注册（按需分包）
const builtinMap: Record<BuiltinComponentType, React.ComponentType<any>> = {
  FormBuilder: dynamic(() => import('@/components/business/FormBuilder')),
  TaskList: dynamic(() => import('@/components/business/TaskList')),
  TaskDetail: dynamic(() => import('@/components/business/TaskDetail')),
  QuotaPanel: dynamic(() => import('@/components/business/QuotaPanel')),
  ImageGenerator: dynamic(() => import('@/components/business/ImageGenerator')),
  VideoGenerator: dynamic(() => import('@/components/business/VideoGenerator')),
  WardrobeGrid: dynamic(() => import('@/components/wardrobe/WardrobeGrid')),
  OutfitRecommend: dynamic(() => import('@/components/wardrobe/OutfitRecommend')),
  TryOn: dynamic(() => import('@/components/wardrobe/TryOn')),
  CommunityFeed: dynamic(() => import('@/components/wardrobe/CommunityFeed')),
  ShoppingAdvisor: dynamic(() => import('@/components/wardrobe/ShoppingAdvisor')),
  StatsDashboard: dynamic(() => import('@/components/common/StatsDashboard')),
  CustomHTML: dynamic(() => import('@/components/common/CustomHTML')),
};

export function renderBuiltin(type: BuiltinComponentType, props?: any) {
  const C = builtinMap[type];
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <C {...props} />
    </Suspense>
  );
}

export function renderRemote(cfg: RemotePageConfig) {
  if (cfg.sandbox === 'iframe') {
    // 不可信插件：iframe 沙箱加载
    return (
      <iframe
        src={cfg.esmUrl}
        className="w-full h-[80vh] border-0"
        sandbox="allow-scripts allow-same-origin"
      />
    );
  }
  // 可信插件：直接 ESM 动态 import（仅客户端）
  // @ts-ignore - webpack ignore remote url
  return (
    <Suspense fallback={<div className="p-6">Loading plugin...</div>}>
      <RemoteESM {...cfg} />
    </Suspense>
  );
}

function RemoteESM(props: RemotePageConfig) {
  const [Comp, setComp] = React.useState<React.ComponentType<any> | null>(null);
  React.useEffect(() => {
    (async () => {
      const mod = await import(/* webpackIgnore: true */ props.esmUrl);
      const Exported = (props.exportName ? mod[props.exportName] : mod.default) as React.ComponentType<any>;
      setComp(() => Exported);
    })();
  }, [props.esmUrl, props.exportName]);

  if (!Comp) return null;
  return <Comp {...props.props} />;
}
```

```tsx
// src/modules/runtime/ConfigPageRenderer.tsx
'use client';
import { useEffect } from 'react';
import { AppConfig, PageConfig } from '@/types/config';
import { useConfigStore, loadAppConfig, subscribeConfigHotUpdate } from '@/lib/configLoader';
import { renderBuiltin, renderRemote } from './ComponentRegistry';
import { notFound } from 'next/navigation';

export function ConfigPageRenderer({ path, initialConfig }: { path: string; initialConfig: AppConfig }) {
  const { config, setConfig } = useConfigStore();
  const working = config ?? initialConfig;

  useEffect(() => {
    setConfig(initialConfig);
    const unsub = subscribeConfigHotUpdate(initialConfig.mode);
    // 进入后做一次后台刷新（拿最新 ETag/版本）
    loadAppConfig(initialConfig.mode).then(setConfig);
    return () => unsub();
  }, [initialConfig.mode, setConfig]);

  const page: PageConfig | undefined = working.pages.find(p => p.enabled && p.path === path);
  if (!page) return notFound();

  if (page.requiredPermission && !hasPermission(working, page.requiredPermission))
    return <div className="p-6 text-red-500">你无权访问该页面</div>;

  // 布局由外层 layout 决定，这里只渲染页面主体
  if (page.page.kind === 'builtin') return renderBuiltin(page.page.componentType, page.page.props);
  return renderRemote(page.page);
}

function hasPermission(cfg: AppConfig, action: string) {
  const rules = cfg.permissions?.rules ?? [];
  // 这里从用户态拿角色
  const roles = (window as any).__USER_ROLES__ as string[] | undefined;
  if (!roles) return false;
  const r = rules.find(r => r.action === action);
  return r ? r.roles.some(role => roles.includes(role)) : false;
}
```

## 1.5 权限控制集成

* 菜单、页面、按钮级别都可用 `requiredPermission` 进行判定；
* 权限粒度建议 `资源:动作`（如 `task:list`, `task:create`, `quota:view`）。

**示例：菜单渲染时过滤**

```tsx
// src/components/shell/SideNav.tsx
'use client';
import { useConfigStore } from '@/lib/configLoader';
import Link from 'next/link';

export function SideNav() {
  const cfg = useConfigStore(s => s.config);
  if (!cfg) return null;
  const items = cfg.navigation
    .filter(i => i.enabled && (!i.requiredPermission || has(i.requiredPermission, cfg)))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <nav className="px-3 py-2">
      {items.map(i => (
        <Link key={i.id} href={i.path} prefetch>
          <div className="flex items-center gap-2 py-2 px-3 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
            <span>{i.label}</span>
          </div>
        </Link>
      ))}
    </nav>
  );
}

function has(action: string, cfg: any) {
  const roles = (window as any).__USER_ROLES__ as string[] | undefined;
  const r = cfg.permissions.rules.find((x: any) => x.action === action);
  return r ? r.roles.some((role: string) => roles?.includes(role)) : true;
}
```

## 1.6 后台管理界面（建议）

* 配置由“**页面构建器 + 模块库**”组成：

  * 左侧：**可用模块库**（按业务域分组：图片、视频、任务、衣橱、试穿、社区…）；
  * 画布：**页面结构树**（栅格/卡片/表单/列表/详情/自定义）；
  * 右侧：**属性面板**（props/权限/SEO/布局/顺序）；
* **流程**：选中模块 ➜ 拖拽到页面 ➜ 配置 props ➜ 分配权限 ➜ 发布（生成版本 + ETag） ➜ SSE 通知在线客户端；
* 提供**安全白名单**配置，允许特定 CDN 上线远程插件（带 SRI）。

---

# 2. 单 App 多模式 vs 三独立 App vs 动态加载（推荐）

| 维度   | 方案A 单App多模式 | 方案B 三独立App | **方案C 单App+动态加载（推荐）** |
| ---- | ----------- | ---------- | --------------------- |
| 开发成本 | 中           | 高（重复基础设施）  | 中（一次性路由/打包策略复杂度）      |
| 维护成本 | 低           | 高          | **低**                 |
| 用户体验 | 中（包大）       | 高（专注）      | **高（当前模式首屏小、其余按需）**   |
| 性能   | 中           | 高          | **高**                 |
| 包体积  | 大           | 小          | **按模式分包，小**           |
| 动态配置 | 易           | 中（多处部署）    | **易（统一生效）**           |
| 结论   | 可行          | 不推荐        | **最优解**               |

---

# 3. 目录结构与复用

```bash
src/
  app/
    (business)/
      business/
        layout.tsx
        page.tsx                   # 可选：默认首页（业务总览）
        [[...segments]]/page.tsx   # 配置驱动渲染器
    (wardrobe-male)/
      wardrobe/
        male/
          layout.tsx
          page.tsx
          [[...segments]]/page.tsx
    (wardrobe-female)/
      wardrobe/
        female/
          layout.tsx
          page.tsx
          [[...segments]]/page.tsx

    api/                           # Next API routes（如需）
      config/
        app/route.ts               # GET 返回 AppConfig
        stream/route.ts            # SSE 热更新
      auth/
        session/route.ts
      # 其他 BFF 代理

    layout.tsx                     # 顶层 Providers（Theme/Mode/AntD/Query）
    middleware.ts                  # 鉴权 & 模式路由控制

  components/
    common/                        # 20+ 通用（Button/Modal/ImageUpload/Empty/...）
      ...
    shell/
      DesktopShell.tsx             # 顶+侧布局抽象
      MobileTabsShell.tsx          # 底部 Tab 布局抽象
      SideNav.tsx
      TopBar.tsx
      BottomTabs.tsx
    business/
      TaskList.tsx
      TaskDetail.tsx
      QuotaPanel.tsx
      ImageGenerator.tsx
      VideoGenerator.tsx
      ...
    wardrobe/
      WardrobeGrid.tsx
      OutfitRecommend.tsx
      TryOn.tsx
      CommunityFeed.tsx
      ShoppingAdvisor.tsx
      ClothesCard.tsx              # 自适应（male/female）
      ...
    wardrobe-male/
      ...
    wardrobe-female/
      BeautyTips.tsx
      ...

  hooks/
    useTheme.ts
    useMode.ts
    useBreakpoint.ts
    useGesture.ts
    usePrefetch.ts

  stores/
    business/
      index.ts                     # Redux store（RTK）
      slices/...
    wardrobe/
      useWardrobeStore.ts          # Zustand
    session/
      useSessionStore.ts

  lib/
    api/
      http.ts                      # fetch 包装+拦截器
      index.ts                     # API 封装入口（business/wardrobe）
    cache/
      queryClient.ts               # React Query 配置
      idb.ts                       # IndexedDB 封装
    configLoader.ts                # 配置加载/缓存/SSE
    theme/
      antdThemes.ts                # AntD Token 映射
      tailwind-css-vars.css        # 变量声明
    utils/...

  styles/
    globals.css
    themes/
      business.css
      wardrobe-male.css
      wardrobe-female.css

  modules/
    runtime/
      server-config.ts             # RSC 获取配置
      ComponentRegistry.tsx
      ConfigPageRenderer.tsx

  types/
    config.ts
    api.ts
    models.ts
```

**复用策略**

* **Shell/布局抽象复用**：`DesktopShell`（业务）、`MobileTabsShell`（衣橱），通用 `ShellSection`, `ShellAction`；
* **域组件复用**：`wardrobe/` 下的衣橱通用组件被男女两版共同使用；样式差异通过 **ModeContext + 主题 Token** 控制。
* **样式**：Tailwind + AntD Token → **CSS Variables**，三模式主题只需切换 `data-theme` 或 `ConfigProvider` tokens。

---

# 4. 主题系统（AntD + Tailwind + CSS Variables）

## 4.1 主题配置文件结构

```ts
// src/lib/theme/antdThemes.ts
import type { ThemeConfig } from '@/types/config';
import type { ThemeConfig as AntdThemeConfig } from 'antd';

export function toAntdTheme(cfg: ThemeConfig): AntdThemeConfig {
  const t = cfg.tokens;
  return {
    token: {
      colorPrimary: String(t['colorPrimary'] ?? '#1890ff'),
      borderRadius: Number(t['radius'] ?? 6),
      colorBgBase: String(t['colorBgBase'] ?? (cfg.appearance === 'dark' ? '#141414' : '#ffffff')),
      colorTextBase: String(t['colorTextBase'] ?? (cfg.appearance === 'dark' ? '#e6e6e6' : '#141414')),
      // ...更多 token 映射
    },
    algorithm: cfg.appearance === 'dark' ? undefined /* AntD 内置可扩展 */ : undefined,
  };
}
```

```css
/* src/lib/theme/tailwind-css-vars.css */
:root {
  --radius: 8px;
  --color-primary: #1890ff;
  --color-bg: #ffffff;
  --color-text: #141414;
}

:root[data-theme='business-dark'] {
  --color-bg: #1a1a1a;
  --color-text: #e6e6e6;
  --color-primary: #1890ff;
  --radius: 4px;
}

:root[data-theme='wardrobe-male'] {
  --color-primary: #2c3e50;
  --radius: 8px;
}

:root[data-theme='wardrobe-female'] {
  --color-primary: #ffb6c1;
  --radius: 12px;
}
```

```ts
// tailwind.config.ts（关键片段）
import type { Config } from 'tailwindcss';
export default {
  darkMode: ['class', '[data-appearance="dark"]'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        bg: 'var(--color-bg)',
        text: 'var(--color-text)',
      },
      borderRadius: {
        md: 'var(--radius)',
      },
    },
    screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px' },
  },
  plugins: [],
} satisfies Config;
```

## 4.2 useTheme Hook + ModeContext

```tsx
// src/hooks/useTheme.ts
'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ThemeConfig } from '@/types/config';
import { toAntdTheme } from '@/lib/theme/antdThemes';

type ThemeCtx = {
  theme: ThemeConfig;
  setTheme: (t: ThemeConfig) => void;
  antd: any;
};

const ThemeContext = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ initialTheme, children }: { initialTheme: ThemeConfig; children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeConfig>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme.name;
    document.documentElement.dataset.appearance = theme.appearance;
    // 同步 CSS Variables（如需）：此处可遍历 theme.tokens 写入
  }, [theme]);

  const antd = useMemo(() => toAntdTheme(theme), [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme, antd }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
```

```tsx
// src/hooks/useMode.ts  —— Q2 要求：ModeContext 全局模式管理
'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { AppMode } from '@/types/config';
import { usePathname } from 'next/navigation';

type ModeCtx = {
  mode: AppMode;
  setMode: (m: AppMode) => void;
  isBusiness: boolean;
  isMale: boolean;
  isFemale: boolean;
};

const ModeContext = createContext<ModeCtx | null>(null);

function inferModeFromPath(path: string): AppMode {
  if (path.startsWith('/business')) return 'business';
  if (path.startsWith('/wardrobe/male')) return 'wardrobe-male';
  return 'wardrobe-female';
}

export function ModeProvider({ initialMode, children }: { initialMode?: AppMode; children: React.ReactNode }) {
  const pathname = usePathname();
  const [mode, setMode] = useState<AppMode>(initialMode ?? inferModeFromPath(pathname));

  useEffect(() => {
    const next = inferModeFromPath(pathname);
    if (next !== mode) setMode(next);
  }, [pathname]); // eslint-disable-line

  const value = useMemo(
    () => ({ mode, setMode, isBusiness: mode === 'business', isMale: mode === 'wardrobe-male', isFemale: mode === 'wardrobe-female' }),
    [mode],
  );

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useMode must be used within ModeProvider');
  return ctx;
}
```

**顶层 Providers（App Router 顶层布局）**

```tsx
// src/app/layout.tsx
import { ThemeProvider } from '@/hooks/useTheme';
import { ModeProvider } from '@/hooks/useMode';
import { AntdRegistry } from '@ant-design/nextjs-registry'; // 官方建议的 SSR 支持（如有）
import { ConfigProvider, App as AntApp } from 'antd';
import { getServerConfig } from '@/modules/runtime/server-config';
import QueryProvider from '@/lib/cache/queryClient';
import '@/styles/globals.css';
import '@/lib/theme/tailwind-css-vars.css';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 默认选 business 作为顶层（实际由路由组各自 layout 拉取更准确）
  const initial = await getServerConfig('business');
  const antdTheme = (await import('@/lib/theme/antdThemes')).toAntdTheme(initial.theme);

  return (
    <html lang="zh">
      <body>
        <QueryProvider>
          <ModeProvider initialMode={initial.mode}>
            <ThemeProvider initialTheme={initial.theme}>
              <AntdRegistry>
                <ConfigProvider theme={antdTheme}>
                  <AntApp>{children}</AntApp>
                </ConfigProvider>
              </AntdRegistry>
            </ThemeProvider>
          </ModeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
```

---

# 5. 路由系统与鉴权

## 5.1 完整路由表（示例）

* **/business**（桌面优先）

  * /business/workspace（默认）
  * /business/image-gen
  * /business/video-gen
  * /business/tasks
  * /business/tasks/\:id
  * /business/history
  * /business/quota
  * /business/team
  * /business/billing
* **/wardrobe/male**（移动优先）

  * /wardrobe/male/wardrobe
  * /wardrobe/male/outfit
  * /wardrobe/male/discover
  * /wardrobe/male/me
* **/wardrobe/female**

  * /wardrobe/female/wardrobe
  * /wardrobe/female/outfit
  * /wardrobe/female/community
  * /wardrobe/female/shop
  * /wardrobe/female/me

> 以上路径映射到 `ConfigPageRenderer`，页面实际由配置 `pages` 确定。

## 5.2 鉴权逻辑（middleware）

* 登录后解析会话（Cookie/JWT）➡️ 获取用户角色 & 可访问模式；
* 若访问越权路径 → 重定向到可访问模式首页；
* 业务用户可切到个人衣橱；个人用户不可访问业务路径。

```ts
// src/app/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const PUBLIC = [/^\/_next/, /^\/public/, /^\/api\/auth/];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();

  const session = parseSession(req); // 从 Cookie/JWT 拿 user.type/roles
  if (!session) return NextResponse.redirect(new URL('/api/auth/login', req.url));

  const isBusinessPath = pathname.startsWith('/business');
  const isMalePath = pathname.startsWith('/wardrobe/male');
  const isFemalePath = pathname.startsWith('/wardrobe/female');

  const canBusiness = session.modes?.includes('business');
  const canMale = session.modes?.includes('wardrobe-male');
  const canFemale = session.modes?.includes('wardrobe-female');

  // 规则：个人不能访问 business；business 可以访问衣橱
  if (isBusinessPath && !canBusiness) {
    // 导向个人可访问首页
    if (canMale) return NextResponse.redirect(new URL('/wardrobe/male', req.url));
    if (canFemale) return NextResponse.redirect(new URL('/wardrobe/female', req.url));
    return NextResponse.redirect(new URL('/api/auth/login', req.url));
  }

  if ((isMalePath && !canMale) || (isFemalePath && !canFemale)) {
    // 回退到能访问的首页
    if (canBusiness) return NextResponse.redirect(new URL('/business', req.url));
    if (canMale) return NextResponse.redirect(new URL('/wardrobe/male', req.url));
    if (canFemale) return NextResponse.redirect(new URL('/wardrobe/female', req.url));
  }

  return NextResponse.next();
}

function parseSession(req: NextRequest) {
  const raw = req.cookies.get('session')?.value;
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

**模式切换**：在 TopBar/个人中心提供“切换模式”，仅渲染用户可访问模式入口，切换后使用 `Link` 跳至对应模式首页（无需刷新配置，路径改变会触发 ModeProvider 更新）。

---

# 6. 组件设计与复用

## 6.1 共用组件清单（≥20）

* Button、Icon、Input、Select、Checkbox、Radio、Slider、Switch
* Modal、Drawer、Popover、Tooltip、Dropdown
* Form（表单容器/字段包装器/校验）
* ImageUpload、ImagePreview、FileDropzone（拖拽上传）
* Pagination、Table（通用封装 AntD Table）
* Skeleton、Spinner、Empty、Result
* Notification/Toast（全局提示）
* ConfirmDialog（批量操作二次确认）
* PageHeader、Breadcrumbs
* StatsCard（指标卡）
* DateRangePicker、ColorPicker
* ResponsiveGrid（栅格 + 卡片）
* SafeHtml（渲染器）
* Guard（权限控件）

## 6.2 模式独立组件（每种 ≥10）

* **商业版**：
  TaskCard、TaskList、TaskToolbar、TaskFilter、TaskDetail、QuotaProgress、QuotaPanel、TeamMemberList、MemberInviteModal、BillingTable、WorkspaceHeader、BatchUploader、HistoryTimeline、ModelPresetPicker、ProgressItem

* **男性版**：
  ClothesCard（简洁）、OutfitCard（男风）、WardrobeStats、QuickActionBar、DiscoverFeed、TagChips、ColorAnalysisCard、TodayWearWidget、OccasionPicker、TryOnLauncher、VoiceHintBar、LongPressMenu

* **女性版**：
  ClothesCard（精致）、OutfitCard（女风）、BeautyTips、AccessoryPicker、MakeupSuggestion、DiaryEntryCard、MoodSelector、CommunityTopicTabs、BrandRecoCarousel、DeclutterAdvisor、ShoppingListCard、PriceTrackItem

## 6.3 自适应组件（推荐方案 B：Context 自动识别）

> **Q4 代码示例：ClothesCard**（根据 ModeContext 调整字段/样式）

```tsx
// src/components/wardrobe/ClothesCard.tsx
'use client';
import { Card, Tag } from 'antd';
import { useMode } from '@/hooks/useMode';

export type Clothes = {
  id: string;
  name: string;
  imageUrl: string;
  tags?: string[];
  price?: number;
  purchasedAt?: string;
  wornCount?: number;
};

type Props = {
  data: Clothes;
  onClick?: (id: string) => void;
};

export default function ClothesCard({ data, onClick }: Props) {
  const { isMale, isFemale } = useMode();

  return (
    <Card
      className={`overflow-hidden ${isFemale ? 'rounded-[12px]' : 'rounded-[8px]'} shadow-sm`}
      hoverable
      cover={<img src={data.imageUrl} alt={data.name} className="w-full h-48 object-cover" />}
      onClick={() => onClick?.(data.id)}
    >
      <div className="flex items-center justify-between">
        <div className={`font-medium ${isFemale ? 'text-pink-600' : 'text-gray-900'}`}>{data.name}</div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {(data.tags ?? []).map((t) => (
          <Tag key={t} bordered={false}>
            {t}
          </Tag>
        ))}
      </div>

      {isFemale && (
        <div className="mt-3 text-sm text-gray-500 space-y-1">
          {data.price ? <div>价格：¥{data.price}</div> : null}
          {data.purchasedAt ? <div>购买：{new Date(data.purchasedAt).toLocaleDateString()}</div> : null}
          {typeof data.wornCount === 'number' ? <div>已穿：{data.wornCount} 次</div> : null}
        </div>
      )}
    </Card>
  );
}
```

---

# 7. 布局组件与导航

* **抽象策略**：

  * `DesktopShell`：适用于 **商业版**（顶部工具条 + 侧边功能导航 + 内容区 + 右侧信息/配额可选）。
  * `MobileTabsShell`：适用于 **衣橱**（底部 3\~5 个 Tab，顶部可选搜索/筛选）。
    二者共享：`<ShellSection/>`, `<ShellAction/>`, `<UserMenu/>`, `<ThemeSwitcher/>`, `<ModeSwitcher/>`。

**导航配置**：直接使用 `config.navigation`；`DesktopShell` 渲染侧边树；`MobileTabsShell` 渲染底部 Tab（最多 5 个）。

**响应式**：

* 商业版断点在 `lg:1024px` 以上启用侧边栏，`md` 以下折叠；
* 衣橱在移动端默认显示底部 Tab，平板/桌面切换为左侧简化导航。

---

# 8. 移动端适配与跨平台

## 8.1 选型建议

* **优先：PWA（纯 Web）**

  * 成本最低，一套代码；现代浏览器已支持相机、媒体、文件系统、通知。
  * 虚拟试穿与视频生成本身多在云端完成，前端以展示/交互为主。
* **如需更深原生能力**（离线相册、系统分享、蓝牙…）：**WebView 混合**为次选；
* React Native 适合后期增长阶段，再将高频移动场景迁到 RN。

## 8.2 响应式断点与布局

* Tailwind `screens` 已设：`sm(640)/md(768)/lg(1024)/xl(1280)`
* **设备适配**：

  * 商业版：≥1024 全功能，768\~1024 简化工具栏，<768 提示“最佳体验在桌面”，仅保留工作台查看。
  * 衣橱：<768 全功能；768\~1024 两列/三列栅格；桌面支持管理与社区浏览。
* **手势**：`@use-gesture/react`（左滑删除、下拉刷新、长按菜单），动画 `framer-motion`。

---

# 9. 状态管理（对比与推荐）

| 方案                 | 学习曲线 | 性能/渲染     | TS 体验 | DevTools | 适用场景           |
| ------------------ | ---- | --------- | ----- | -------- | -------------- |
| **Zustand**        | 低    | 细粒度选择器，极佳 | 优秀    | 有        | 轻量 UI/本地状态     |
| **Redux Toolkit**  | 中    | 成熟可控      | 优秀    | 强        | 复杂域（审计/时序/中间件） |
| **Jotai**          | 中    | 原子化，低耦合   | 良     | 有        | 实验性/函数式偏好      |
| **TanStack Query** | 中    | 服务器状态缓存最佳 | 优秀    | 强        | 异步/缓存/重试/失效    |

**推荐**

* **商业版**：Redux Toolkit（域状态）+ **RTK Query** 或 **TanStack Query**（远程数据）。
* **衣橱**：Zustand（UI 状态）+ **TanStack Query**（衣物/社区/购物数据）。

---

# 10. API 封装与拦截器、错误处理

```ts
// src/types/api.ts
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: string; status?: number };

export interface Task { id: string; status: 'running'|'done'|'failed'; /* ... */ }
export interface Clothes { id: string; /* ... */ }
```

```ts
// src/lib/api/http.ts
export type HttpOptions = {
  method?: 'GET'|'POST'|'PUT'|'DELETE'|'PATCH';
  body?: any;
  headers?: Record<string, string>;
  modeHeader?: 'business'|'wardrobe-male'|'wardrobe-female';
  auth?: boolean;
};

function getToken() { return localStorage.getItem('token') ?? ''; }

export async function http<T>(url: string, opts: HttpOptions = {}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers ?? {}),
  };
  if (opts.auth !== false) headers['Authorization'] = `Bearer ${getToken()}`;
  if (opts.modeHeader) headers['X-App-Mode'] = opts.modeHeader;

  try {
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: 'include',
    });

    if (!res.ok) {
      const msg = await safeText(res);
      return { ok: false, error: msg || res.statusText, status: res.status };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Network Error' };
  }
}
async function safeText(res: Response) { try { return await res.text(); } catch { return ''; } }
```

```ts
// src/lib/api/index.ts
import { http } from './http';
import type { Task, Clothes } from '@/types/api';

export const api = {
  business: {
    getTasks: () => http<Task[]>('/api/business/tasks', { modeHeader: 'business' }),
    createTask: (data: any) => http<Task>('/api/business/tasks', { method: 'POST', body: data, modeHeader: 'business' }),
  },
  wardrobe: {
    male: {
      getClothes: () => http<Clothes[]>('/api/wardrobe/male/clothes', { modeHeader: 'wardrobe-male' }),
    },
    female: {
      getClothes: () => http<Clothes[]>('/api/wardrobe/female/clothes', { modeHeader: 'wardrobe-female' }),
    },
  },
};
```

**统一错误提示**（AntD App 通知）

```ts
// src/lib/api/useApiToast.ts
'use client';
import { App } from 'antd';
import { useCallback } from 'react';
import type { ApiResult } from '@/types/api';

export function useApiToast() {
  const { message } = App.useApp();

  return useCallback(<T,>(ret: ApiResult<T>): ret is { ok: true; data: T } => {
    if (!ret.ok) message.error(ret.error ?? '请求失败');
    return ret.ok;
  }, [message]);
}
```

---

# 11. 数据缓存策略（React Query + IndexedDB + SW）

## 11.1 React Query 配置

```ts
// src/lib/cache/queryClient.tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const client = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60_000, // 默认 1 分钟
    },
  },
});

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

**缓存规则**

* 任务列表（商业）：`staleTime: 5 * 60_000`
* 衣橱列表（衣橱）：`staleTime: 60 * 60_000`（本地优先）
* 图片：CDN Cache-Control + **IndexedDB** 镜像；SW 提供离线。

```ts
// 示例：useTasks.ts（商业）
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useTasks() {
  return useQuery({
    queryKey: ['business','tasks'],
    queryFn: async () => {
      const ret = await api.business.getTasks();
      if (!ret.ok) throw new Error(ret.error);
      return ret.data;
    },
    staleTime: 5 * 60_000,
  });
}
```

## 11.2 IndexedDB 封装

```ts
// src/lib/cache/idb.ts
export async function idbGet<T>(db: string, store: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(db);
    open.onupgradeneeded = () => open.result.createObjectStore(store);
    open.onsuccess = () => {
      const tx = open.result.transaction(store, 'readonly');
      const s = tx.objectStore(store).get(key);
      s.onsuccess = () => resolve(s.result as T | undefined);
      s.onerror = () => reject(s.error);
    };
    open.onerror = () => reject(open.error);
  });
}

export async function idbSet<T>(db: string, store: string, key: IDBValidKey, val: T) {
  return new Promise<void>((resolve, reject) => {
    const open = indexedDB.open(db);
    open.onupgradeneeded = () => open.result.createObjectStore(store);
    open.onsuccess = () => {
      const tx = open.result.transaction(store, 'readwrite');
      tx.objectStore(store).put(val as any, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    open.onerror = () => reject(open.error);
  });
}
```

---

# 12. UI/UX 设计规范（Design Tokens）

## 12.1 颜色/字体/间距/圆角/阴影/动效

**商业版（专业工具）**

* `colorPrimary: #1890FF`，`bg: #1A1A1A（深）/ #FFFFFF（浅）`
* 字体：Roboto / 微软雅黑；`radius: 4`；阴影：中等（工具感）；动效：短暂 120–160ms

**男性版（简洁实用）**

* `colorPrimary: #2C3E50, gray: #95A5A6`；字体：SF Pro / 苹方；`radius: 8`；动效：滑动/缩放 200–240ms

**女性版（精致温馨）**

* `colorPrimary: #FFB6C1, beige: #F5F5DC`；字体：Noto Sans / 思源黑体；`radius: 12`；动效：更丰富（弹性）

> 以上落地到 `ThemeConfig.tokens`，由 `toAntdTheme` 与 CSS Variables 驱动。Figma 建议：每种模式一套 Design Tokens（颜色、排版、间距、阴影、圆角、动效），共用组件一套 Auto Layout 规范，三套样式 Variant。

**AntD 5 主题配置（Q3）**

```ts
// 以 business-dark 为例
export const businessDarkTheme: ThemeConfig = {
  name: 'business-dark',
  appearance: 'dark',
  tokens: {
    colorPrimary: '#1890FF',
    colorBgBase: '#1A1A1A',
    colorTextBase: '#E6E6E6',
    radius: 4,
    boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
  },
};
```

---

# 13. 交互差异化

* **商业版**

  * 批量操作（表格多选 + 批量导出）
  * 快捷键：`cmd/ctrl + S` 保存、`cmd/ctrl + Z` 撤销
  * 拖拽上传：`FileDropzone`（支持 10 张批量）

* **男性版**

  * 手势：左滑删除、下拉刷新、长按弹出操作（`@use-gesture/react`）
  * 快速入口（底部 Tab 上方的浮动操作）

* **女性版**

  * 卡片滑动（收藏/详情），点赞动画（`framer-motion` spring），拍照滤镜（前端预览 + 云处理）

---

# 14. 首屏加载优化（Q5 + next.config.js）

* 按 **路由组** 与 **组件注册表** 分包；
* 重型组件 `dynamic(() => import(...), { ssr: false })`；
* `Link prefetch`、`Image` 优化（自动 lazy）；
* `Server Components` 尽量放到布局级，降低客户端 JS；
* `headers` 设置长缓存（静态）、短缓存（配置/数据）；
* PWA + SW 缓存静态资源。

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
    optimizePackageImports: ['antd'], // 减少按需样式引入成本
  },
  images: {
    domains: ['cdn.yourdomain.com', 'images.unsplash.com'],
    formats: ['image/avif', 'image/webp'],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  headers: async () => [
    {
      source: '/:all*(svg|jpg|png|webp|avif|js|css|woff2)',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    },
  ],
};

module.exports = nextConfig;
```

---

# 15. PWA（Service Worker / manifest）

* `public/manifest.json`：应用名称、图标、主题色；
* `public/sw.js`：静态资源预缓存、图片缓存策略（Stale-While-Revalidate）；
* `app/layout.tsx` 中注入 `<link rel="manifest" href="/manifest.json" />`。

---

# 16. 关键问题答复（Q1–Q5）

### Q1：单App多模式 vs 三独立App？

**选择：方案 C（单 App + 动态加载）** —— 兼顾**体验/性能/维护/动态配置**四要素。详见上文对比表。

### Q2：如何设计 ModeContext？

见 **§4.2 `useMode.ts`** 完整 TypeScript 代码（含路径自动识别与布尔派生）。

### Q3：主题系统（AntD 5 主题配置代码）

见 **§4.1 `toAntdTheme`** 与 **§12** 的 Token 示例；AntD `ConfigProvider` 在顶层布局注入，Tailwind 以 CSS Variables 落地。

### Q4：组件复用同时保证差异化？

* 基础组件全部共用；
* 领域组件共用 + **ModeContext** 自适应（如 `ClothesCard` 示例）；
* 极端差异用“模式专属组件”（如女性版 `BeautyTips`）；
* 样式优先由 Token/变量驱动，少量通过 class 差异化。

### Q5：首屏加载优化（Next.js 14）

* 路由组 + 动态 import 分包；
* 重型组件关闭 SSR；
* RSC/布局提前取配置（减少客户端请求）；
* 图片使用 Next/Image，资源长缓存，数据 `staleTime` 精准设置；
* `next.config.js` 已给出。

---

# 17. 交付清单映射

* **架构设计文档（30页）**：本方案 §1–§5、§14 全部包含，可直接扩展到文档（加上流程图/时序图/权限矩阵）。
* **组件设计文档（40页）**：§6（清单+策略+示例）、§7（布局抽象）可扩展为组件手册。
* **UI/UX 设计规范（20页）**：§12（Design Tokens）、色/字/间/圆/阴/动效已落地。
* **技术实现代码（100+ 文件）**：目录树 + 核心代码模板已给出；补齐组件即可。
* **移动端适配方案（15页）**：§8 + PWA 配置。
* **性能优化（10页）**：§14 + 缓存策略 §11。

---

## 附：示例页面配置（后端返回）

```json
{
  "version": "2025.11.01-001",
  "mode": "business",
  "theme": { "name": "business-dark", "appearance": "dark", "tokens": { "colorPrimary": "#1890ff", "radius": 4 } },
  "permissions": { "rules": [{ "action": "task:create", "roles": ["owner","admin","member"] }] },
  "navigation": [
    { "id": "workspace", "label": "工作台", "path": "/business/workspace", "enabled": true, "order": 1 },
    { "id": "image-gen", "label": "AI 图片", "path": "/business/image-gen", "enabled": true, "order": 2 },
    { "id": "video-gen", "label": "AI 视频", "path": "/business/video-gen", "enabled": true, "order": 3 },
    { "id": "tasks", "label": "任务列表", "path": "/business/tasks", "enabled": true, "order": 4, "requiredPermission": "task:list" }
  ],
  "pages": [
    { "id": "workspace", "path": "/business/workspace", "enabled": true, "page": { "kind": "builtin", "componentType": "StatsDashboard", "props": { "cards": 4 } } },
    { "id": "img", "path": "/business/image-gen", "enabled": true, "page": { "kind": "builtin", "componentType": "ImageGenerator" } },
    { "id": "video", "path": "/business/video-gen", "enabled": true, "page": { "kind": "builtin", "componentType": "VideoGenerator" } },
    { "id": "tasks", "path": "/business/tasks", "enabled": true, "requiredPermission": "task:list", "page": { "kind": "builtin", "componentType": "TaskList" } },
    {
      "id": "ai-design-remote",
      "path": "/business/ai-design",
      "enabled": true,
      "page": {
        "kind": "remote",
        "esmUrl": "https://cdn.yourdomain.com/plugins/ai-design@1.0.4/entry.js",
        "exportName": "AiDesign",
        "sandbox": "direct",
        "props": { "model": "v2" }
      }
    }
  ],
  "pluginAllowList": ["cdn.yourdomain.com"]
}
```

---

## 下一步执行建议（1 周内）

1. 初始化仓库（Next 14 + TS + AntD + Tailwind）与上述目录；
2. 落地 **ConfigPageRenderer / ComponentRegistry / ModeProvider / ThemeProvider**；
3. 接入 **/api/config/app** 与 **/api/config/stream**（SSE）；
4. 完成三套 **layout（DesktopShell/MobileTabsShell）** 与导航渲染；
5. 接入 **状态与缓存**：商业=RTK+RQ，衣橱=Zustand+RQ；
6. 实现首批 20+ 通用组件与 10+ 每模式组件骨架；
7. 打通 3–5 条关键业务链路（图片生成、任务列表、衣橱上传、今日穿搭、虚拟试穿占位）。

