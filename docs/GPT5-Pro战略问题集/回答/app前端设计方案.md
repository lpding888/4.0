下面这份方案，专门面向**微信小程序（P0 主方案）+ 跨平台 App（P1 备选）+ PWA（P2 补充）**，在**不引入新付费服务**、**沿用你们现有 Express + MySQL + Redis + COS** 后端的前提下，给出一套**可上线、可扩展、可配置驱动**的移动端架构。
我把关键难点（小程序无法远程加载代码、2MB 主包限制、路由需预声明、无 WebSocket）一一化解，并给出**目录结构、代码模板、分包与包体积控制、动态配置与热更新、状态管理、离线与性能**的可执行做法。

---

## 0. 结论（先给选择）

* **微信小程序（P0）推荐：Taro + React（方案B） + 原生增强（关键页）**

  * 你们已有 React/TS/Next 基础；Taro 让**配置驱动运行时、状态逻辑、组件注册表**最大限度与 Web/RN 共享。
  * 采用\*\*“Taro 页面 + 原生自定义组件”混合\*\*：把「相机/批处理上传/长列表」等性能敏感页做成**原生自定义组件**（WXML/WXSS/JS），其余页面用 Taro。
  * 在小程序无法远程加载 JS 的限制下，**预置“组件白名单”与路由白名单**，用**服务端 JSON 配置**拼装页面树，做到**不发版即可增减模块/改布局**（前提：组件在白名单中）。

* **跨平台 App（P1）推荐：React Native（非 Expo Bare）**

  * **TypeScript/业务逻辑最大复用**（与 Web/Taro 共用 runtime 与配置 JSON）。
  * 支持 **CodePush**（合规 OTA 热更新 JS 侧），填补 App 审核时间与紧急修复窗口。
  * Flutter 性能略优，但二次栈（Dart）与复用受限。若未来追求极致动画/3D/AR可再评估 Flutter 子项目。

* **PWA（P2）**：继续用你们的 Next.js 14 实现，作 PC/移动 Web 补充与 SEO 渠道。

---

# 1. 微信小程序架构（P0 主方案）

### 1.1 技术选型对比与推荐

| 方案                   | 开发效率  | 性能          | 代码复用                  | 包体积控制     | 配置驱动实现难度           | 适配其他小程序      |
| -------------------- | ----- | ----------- | --------------------- | --------- | ------------------ | ------------ |
| 原生小程序                | 中     | **最佳**      | 低                     | 易控        | 中（需手写渲染器）          | 中            |
| **Taro + React（推荐）** | **高** | 很好（关键页原生增强） | **高（与 RN/Web 共用 TS）** | 可控（分包+按需） | **低（React 组件注册表）** | 好            |
| uni-app + Vue        | 中     | 很好          | 中（与现有 React 不同栈）      | 可控        | 中                  | **最佳（多端编译）** |

**推荐理由**：

* 2\~3 个月上线：React 团队上手成本最低；配置驱动 & 组件注册表更顺畅；性能瓶颈用原生组件兜底。
* 后续可把\*\*运行时内核（配置解析/权限/埋点/缓存）\*\*做成 TS 包，RN 直接共用。

---

### 1.2 配置驱动在小程序的落地原则（避雷）

> 小程序**不能远程加载新代码**：所以“配置驱动 ≠ 远程下发任意新组件”。
> **做法**：**预编译且声明好的“组件白名单 + 路由白名单”** + **服务端下发 JSON 页面树**。
> 不发版即可：
>
> * 开关已有功能模块 / 改顺序 / 改布局 / 改主题 / 改 TabBar
> * **不能**引入全新的组件类型或页面（需要发版把新组件加入白名单）。

---

### 1.3 配置数据结构（MiniAppConfig）

```ts
// shared/types/mini-config.ts
export type MiniMode = 'business' | 'wardrobe-male' | 'wardrobe-female';

export interface MiniThemeConfig {
  name: 'business-dark' | 'business-light' | 'male' | 'female';
  cssVars: Record<string, string>;
}

export interface MiniTabBarItem {
  key: string;        // 'closet' | 'outfit' | 'social'...
  text: string;
  icon: string;       // 本地 sprite key 或 CDN url
  path: string;       // 映射到已声明的页面 path
  requiredPermission?: string;
  enabled: boolean;
}

export interface MiniComponentNode {
  key: string; // 注册表里的组件 key（必须白名单）
  props?: Record<string, unknown>;
  children?: MiniComponentNode[];
  region?: 'header' | 'content' | 'footer' | string;
  requiredPermission?: string;
}

export interface MiniPageConfig {
  path: string;                       // '/pages/dynamic/index?p=/wardrobe/closet' or real subpage
  title: string;
  layout: 'default' | 'mobile-tabs';
  nodes: MiniComponentNode[];
  enabled: boolean;
  requiredPermission?: string;
}

export interface MiniPermissionConfig {
  roles: string[];
  rolePermissions: Record<string, string[]>;
}

export interface MiniAppConfig {
  version: string;     // '2025.11.01-001'
  etag: string;        // W/"hash"
  mode: MiniMode;
  theme: MiniThemeConfig;
  tabBar: MiniTabBarItem[];
  pages: MiniPageConfig[];
  permissions: MiniPermissionConfig;
}
```

> 后端**复用你们的 `ui_releases.bundle_json`**，在发布时额外生成 `MiniAppConfig`（裁剪、映射 TabBar、过滤不支持属性），写入 Redis 缓存，接口如下：

* `GET /api/mobile/config?platform=wx&mode=business`（ETag 支持）
* `GET /api/mobile/version?platform=wx&mode=business`（仅 version+etag）

---

### 1.4 包结构与分包策略（严格控制体积）

```
/src
  /app.config.ts               // 声明 pages & subPackages（Taro）
  /app.tsx
  /custom-tab-bar/             // 自定义 TabBar，支持动态菜单
  /pages
    /boot/                     // 启动/鉴权/首屏骨架（主包）
    /dynamic/                  // 通用动态页面（主包）
  /business/                   // 分包（独立分包）
    /workspace/
    /image-gen/
    /video-gen/
    /tasks/
    /team/
    /billing/
  /wardrobe/                   // 分包（独立分包）
    /closet/
    /outfit/
    /tryon/
    /social/
    /shopping/
  /components
    /common/                   // 主包：仅骨干小组件
    /business/                 // 大组件尽量放入对应分包
    /wardrobe/
  /runtime
    registry.ts                // 组件白名单注册表（Taro + 原生组件桥）
    renderer.tsx               // 递归渲染器
    mode.ts                    // Mode/权限
    hot-update.ts              // 轮询版本 + ETag
  /services
    api.ts                     // Taro.request 封装，自动带 Token
    cos.ts                     // cos-wx-sdk-v5 上传封装
  /store
    index.ts                   // Zustand（小程序端轻量）
  /styles
    theme.css                  // CSS 变量注入
```

**配置：app.config.ts（Taro）**

```ts
// src/app.config.ts
export default defineAppConfig({
  pages: [
    'pages/boot/index',          // 主包：登录/鉴权/首屏
    'pages/dynamic/index'        // 主包：动态渲染页（配置驱动）
  ],
  subPackages: [
    {
      root: 'business',
      name: 'business',
      independent: true, // 独立分包，加快首屏
      pages: ['workspace/index','image-gen/index','video-gen/index','tasks/index','team/index','billing/index']
    },
    {
      root: 'wardrobe',
      name: 'wardrobe',
      independent: true,
      pages: ['closet/index','outfit/index','tryon/index','social/index','shopping/index']
    }
  ],
  tabBar: {
    custom: true, // 使用自定义 tabbar 实现“动态菜单”
    color: '#999',
    selectedColor: '#000',
    backgroundColor: '#fff',
    list: [{pagePath: 'pages/dynamic/index', text: 'Home', iconPath: 'assets/tab/home.png', selectedIconPath:'assets/tab/home-s.png'}]
  },
  requiredPrivateInfos: ['chooseAddress','getLocation'],
  permission: { 'scope.userLocation': { desc: '用于天气穿搭推荐' } }
});
```

**体积优化建议（可直接落地）**

* Taro 构建：

  * `mini.optimizeMainPackage: true`（主包尽可能小）
  * `mini.addChunkPages` 把大组件按页面拆分
  * 使用 `dayjs` 代替 `moment`、`lodash-es` 按需
  * 图片全部走 COS+CDN；图标用 iconfont/矢量
* 分包合计 < 20MB，主包目标 < 700KB（不含图片）。
* 性能敏感页（相机/长列表/批量上传）用**原生自定义组件**放对应分包。

---

### 1.5 组件注册表（小程序）

> 由于**禁止远程代码**，注册表必须在编译期就收录组件；运行时**仅按 key 选择并渲染**。

```ts
// src/runtime/registry.ts
import DynamicList from '@/components/common/DynamicList';
import ImageUpload from '@/components/common/ImageUpload';

// 分包组件（按需异步 import，仍在本地包内）
const TaskCard = () => import('@/components/business/TaskCard');
const ClothesCard = () => import('@/components/wardrobe/ClothesCard');

export type MiniComponentLoader = () => Promise<{ default: React.ComponentType<any> }> | { default: React.ComponentType<any> }

export const REGISTRY: Record<string, MiniComponentLoader> = {
  // 通用
  List: { default: DynamicList },
  ImageUpload: { default: ImageUpload },
  // 商业
  TaskCard,
  // 衣橱
  ClothesCard
};
```

**递归渲染器**

```tsx
// src/runtime/renderer.tsx
import { REGISTRY } from './registry';
import type { MiniComponentNode } from '@/shared/types/mini-config';
import { usePermissions } from './mode';
import { useLoad } from '@tarojs/taro';

export function NodeRenderer({ node }: { node: MiniComponentNode }) {
  const { hasPerm } = usePermissions();
  if (node.requiredPermission && !hasPerm(node.requiredPermission)) return null;

  const Loader = REGISTRY[node.key];
  if (!Loader) return null;

  // Taro + React：支持动态 import（打包到本地 chunk）
  // @ts-ignore
  const [Comp, setComp] = React.useState<React.ComponentType<any> | null>(null);
  useLoad(async () => {
    const mod = await (typeof Loader === 'function' ? Loader() : Promise.resolve(Loader));
    setComp(() => mod.default);
  });

  if (!Comp) return null;
  return (
    <Comp {...(node.props || {})}>
      {node.children?.map((c, i) => <NodeRenderer key={i} node={c} />)}
    </Comp>
  );
}
```

**动态页面**

```tsx
// src/pages/dynamic/index.tsx
import { useDidShow, useRouter } from '@tarojs/taro';
import { useMiniConfig } from '@/runtime/hot-update';
import { NodeRenderer } from '@/runtime/renderer';

export default function DynamicPage() {
  const router = useRouter(); //   /pages/dynamic/index?p=/wardrobe/closet
  const p = decodeURIComponent(router.params?.p || '/');
  const { config } = useMiniConfig();

  const page = config.pages.find(x => x.path.endsWith(p) && x.enabled);
  if (!page) return <View>404</View>;

  Taro.setNavigationBarTitle({ title: page.title || 'AI衣橱' });

  return (
    <View className="page">
      {page.nodes.map((n, i) => <NodeRenderer key={i} node={n} />)}
    </View>
  );
}
```

---

### 1.6 配置热更新（无 WebSocket）

* 启动/前台：`/api/mobile/version?platform=wx&mode=xxx` 每 30s 轮询；对比本地 etag。
* 变更 → 带 `If-None-Match` 拉 `/api/mobile/config`；304 跳过，200 写入本地并重渲染。
* 存储：`wx.setStorage({key:'mini:cfg', data: appConfig})`（≤10MB）。
* UI 更新策略：

  * TabBar：使用**自定义 TabBar**组件，可在运行时替换项（官方 tabBar 不支持动态）。
  * 布局变动不强制刷新；**路由级变化**（新增页面）需发布新包（加入白名单）。

```ts
// src/runtime/hot-update.ts
import Taro from '@tarojs/taro';
import type { MiniAppConfig } from '@/shared/types/mini-config';
import { create } from 'zustand';

interface CfgState { config: MiniAppConfig; setConfig: (c: MiniAppConfig)=>void; }
export const useMiniConfig = create<CfgState>((set) => ({
  config: Taro.getStorageSync('mini:cfg') || {} as MiniAppConfig,
  setConfig: (c) => { Taro.setStorageSync('mini:cfg', c); set({ config: c }); }
}));

export async function pollConfig(mode: string) {
  const etag = Taro.getStorageSync('mini:etag') || '';
  const v = await Taro.request({ url: `/api/mobile/version?platform=wx&mode=${mode}`, method: 'GET' });
  if (v.data?.etag && v.data.etag !== etag) {
    const r = await Taro.request({
      url: `/api/mobile/config?platform=wx&mode=${mode}`,
      header: { 'If-None-Match': etag }
    });
    if (r.statusCode === 200) {
      Taro.setStorageSync('mini:etag', r.data.etag);
      useMiniConfig.getState().setConfig(r.data);
    }
  }
}
```

在 `app.tsx` 里 `setInterval(()=>pollConfig(mode), 30000)`，**后台切前台**时也触发一次。

---

### 1.7 API 封装与 COS 上传（小程序）

```ts
// src/services/api.ts
import Taro from '@tarojs/taro';

export async function request<T>(url: string, data?: any, method: 'GET'|'POST'|'PUT'|'DELETE'='GET'): Promise<T> {
  const token = Taro.getStorageSync('token') || '';
  const res = await Taro.request<T>({ url, data, method, header: { Authorization: `Bearer ${token}` } });
  if (res.statusCode >= 400) throw new Error(String(res.data));
  return res.data as T;
}
```

COS 上传（推荐 **cos-wx-sdk-v5** + 后端临时密钥/ST S）

```ts
// src/services/cos.ts
import COS from 'cos-wx-sdk-v5';
import { request } from './api';

const cos = new COS({
  getAuthorization: async function (options, cb) {
    const cred = await request<{ tmpSecretId:string; tmpSecretKey:string; sessionToken:string; startTime:number; expiredTime:number }>('/api/cos/sts');
    cb({ TmpSecretId:cred.tmpSecretId, TmpSecretKey:cred.tmpSecretKey, SecurityToken:cred.sessionToken, StartTime:cred.startTime, ExpiredTime:cred.expiredTime });
  }
});

export function uploadFile(filePath: string, key: string) {
  return new Promise((resolve, reject) => {
    cos.postObject({
      Bucket: process.env.TENCENT_COS_BUCKET!,
      Region: process.env.TENCENT_COS_REGION!,
      Key: key,
      FilePath: filePath
    }, (err, data) => err ? reject(err) : resolve(data));
  });
}
```

---

### 1.8 审核注意事项（经验清单）

* **AI 生成合规**：避免涉政/涉黄/人脸滥用；上传页**弹出用户承诺**与**版权声明**；内容审查（你们后端可接入腾讯内容安全，或自建规则）。
* **订阅消息**：只申请「任务完成提醒」等必要模板；引导用户主动授权。
* **相机/位置**：先解释用途再请求权限。
* **支付**：如涉及会员套餐，小程序端用**微信支付分/JSAPI**，与你们已有会员计划一致。
* **隐私协议**：在“我的”页入口、首次启动提示。

---

# 2. 跨平台 App 架构（P1 次要方案）

### 2.1 React Native vs Flutter 深度对比（给推荐）

| 维度      | **React Native（推荐）**                     | Flutter              |
| ------- | ---------------------------------------- | -------------------- |
| 与现有后端适配 | **TS/REST 完美复用；与 Web/Taro 共库**           | 需 Dart 映射类型；共用仅限协议层  |
| 配置驱动实现  | **直接复用 Taro/Web 的 JSON + 渲染器/注册表**       | 需重写 Widget 注册表与解析    |
| 热更新     | **CodePush 成熟（JS 侧）**                    | Shorebird（第三方），生态在发展 |
| 性能      | Hermes + Reanimated + FlashList，足够覆盖你的场景 | **更稳定流畅**，高动画/3D更优   |
| 包体积     | iOS \~ 15–30MB 起；Android \~ 20–40MB 起    | **起步更大**（30–60MB）    |
| 开发/维护成本 | **最低（TS 团队）**                            | 中（Dart 新栈）           |

**推荐 RN**：你们的**配置驱动运行时**（TS）、API 层、权限/埋点、业务校验几乎可直接共用；上线节奏快且可 CodePush 热修复。

---

### 2.2 RN 技术栈与目录

```txt
app/
  src/
    config/                 # 配置驱动核心（与 Taro/Web 共享）
      types.ts
      registry.ts           # RN 组件注册表（与 Taro 键一致）
      renderer.tsx
      provider.tsx          # AppConfigProvider + ModeContext
    navigation/
      index.tsx             # React Navigation 动态栈/Tab
    screens/
      business/...
      wardrobe/...
      DynamicScreen.tsx     # 动态渲染屏
    components/
      common/ business/ wardrobe/
    services/
      api.ts                # axios + interceptors
      cos.ts                # 预签名URL直传 / COS SDK
      push.ts               # APNs/FCM 封装（可选）
    store/
      business/rtk-slices.ts
      wardrobe/zustand.ts
    utils/
    theme/
      tokens.ts             # 与小程序 CSS 变量同源的 Token
```

**关键代码：注册表 + 渲染器（RN）**

```ts
// app/src/config/registry.ts
import React from 'react';

export const REGISTRY: Record<string, React.ComponentType<any> | (()=>Promise<{default:React.ComponentType<any>}>)> = {
  List: React.lazy(()=>import('../components/common/List')),
  ImageUpload: React.lazy(()=>import('../components/common/ImageUpload')),
  TaskCard: React.lazy(()=>import('../components/business/TaskCard')),
  ClothesCard: React.lazy(()=>import('../components/wardrobe/ClothesCard'))
};
```

```tsx
// app/src/config/renderer.tsx
import React, { Suspense } from 'react';
import { REGISTRY } from './registry';
import { MiniComponentNode as Node } from './types';
import { usePermissions } from '../provider';

export const NodeRenderer = ({ node }: { node: Node }) => {
  const { hasPerm } = usePermissions();
  if (node.requiredPermission && !hasPerm(node.requiredPermission)) return null;
  const C = REGISTRY[node.key];
  if (!C) return null;
  const Comp = React.isValidElement(C) ? (C as any) : React.lazy(C as any);
  return (
    <Suspense fallback={null}>
      <Comp {...(node.props || {})}>
        {node.children?.map((c, i)=> <NodeRenderer key={i} node={c} />)}
      </Comp>
    </Suspense>
  );
};
```

**动态导航（RN）**

```tsx
// app/src/navigation/index.tsx
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppConfig } from '../config/provider';
import DynamicScreen from '../screens/DynamicScreen';

export function RootNavigator() {
  const { config } = useAppConfig();
  const Tab = createBottomTabNavigator();
  return (
    <Tab.Navigator>
      {config.tabBar.filter(t=>t.enabled).map(item => (
        <Tab.Screen
          key={item.key}
          name={item.key}
          options={{ title: item.text /* 图标省略 */ }}
        >
          {() => <DynamicScreen path={item.path} />}
        </Tab.Screen>
      ))}
    </Tab.Navigator>
  );
}
```

**热更新（RN）**

* **CodePush**：仅更新 JS bundle / 资源，不改原生能力；遵守商店政策（需在元数据声明）。
* **配置热更新**：与小程序一致轮询 `/api/mobile/version?platform=rn`；增量覆盖 AppConfig。

**原生能力集成**

* 相机：`react-native-vision-camera`（高性能）
* 推送：APNs/FCM（免费），国内可配厂商通道（可后续）
* 支付：微信/支付宝 SDK（仅会员付费需要）
* 分享：微信/微博分享 SDK（或 `react-native-share`）
* COS：推荐**预签名 URL 直传**（最轻量，避免 SDK 体积），或腾讯官方 RN SDK（若有）。

**性能要点**

* 开启 Hermes、`inlineRequires`、`react-native-mmkv` 持久化、`FlashList` 优化长列表、`FastImage` 缓存图片。

---

# 3. PWA（P2）简述

* **技术栈**：Next.js 14 + Ant Design 5 + React Query + Workbox（离线）
* **用途**：覆盖 PC + 浏览器用户，提供安装到桌面能力；流量入口/SEO/备用发布渠道。
* **与移动共享**：**同一份配置 JSON** + **组件注册表键值一致**（Web 端实现对应组件）。

---

# 4. 关键架构问题逐条回答

## Q1：微信小程序 vs Taro vs uni-app

* **2–3 个月能否完成**：Taro（React 团队）最快；原生需要更多重复工作；uni-app 需切换到 Vue。
* **性能**：原生最佳；Taro 足够 & 关键页可原生增强；uni-app 与 Taro相近。
* **包体积**：原生最易控；Taro/uni-app 通过分包+拆 chunk 同样可控。
* **配置驱动难度**：**Taro 最低**（React 组件树/Context/注册表实践成熟）。
* **扩展到其他小程序**：Taro/uni-app 优于原生（多端编译）。
  **结论**：**Taro + 原生增强**是最均衡方案。

## Q2：React Native vs Flutter

* **后端适配 & 代码复用**：RN 直接复用 TS runtime 与配置；Flutter 需 Dart 重写解析与注册表。
* **配置驱动难度**：RN 低；Flutter 中等（需 Widget registry + JSON schema）。
* **热更新**：RN（CodePush 成熟）；Flutter（Shorebird）生态在发展。
* **成本**：RN 更低；Flutter 学习曲线与包体积更高。
* **性能**：Flutter 略优但 RN 足以满足。
  **结论**：**首选 RN**，若后期追求极致动画/3D 再增开 Flutter 子项目。

## Q3：三种模式复用与差异化

* **小程序**：**一个小程序，内部切换模式**（登录后根据角色/付费档进入 business 或 wardrobe-male/female；自定义 TabBar 动态切换）。

  * 好处：统一入口与获客；配置驱动切换主题 & 菜单。
* **App**：**一个 App**，内部切换模式；商业版用户可进个人衣橱，个人用户不可进商业版（中间件与前端权限双保险）。

## Q4：配置驱动在小程序/App中如何实现？

* **JSON 设计**：见 `MiniAppConfig`。
* **组件加载**：**注册表白名单 + 动态 import（本地 chunk）**；小程序不允许网络加载 JS。
* **避免重新发版**：只要业务在“白名单组件集合”内，后台可自由增删/排序/改布局/改主题/改权限；**新增组件类型或页面**才需要发版。
* **路由**：小程序在 `app.config.ts` 预声明页面与分包；运行时使用 `/pages/dynamic/index?p=xxx` 映射任何配置页面。

## Q5：数据缓存与离线

* **小程序**：

  * KV：`wx.setStorageSync`（≤10MB，总量）；只存**配置、列表索引、最近记录**，**不要存图片二进制**（交给 CDN 缓存）。
  * 文件：`wx.getFileSystemManager()` 仅做临时文件（拍照/上传），用后删除。
  * 离线：可浏览“最近打开的搭配/任务历史（元数据）”，图片走 CDN 命中否则灰底占位。
* **App（RN）**：

  * KV：**MMKV**（高性能） + React Query 持久化；
  * 大数据：SQLite（历史记录/离线清单）；
  * 图片：`react-native-fast-image`（磁盘缓存）；
  * 离线：React Query + MMKV 持久化 + 回放机制（在线后补同步）。

---

# 5. 小程序核心代码与方案细化

### 5.1 自定义 TabBar（动态菜单）

```tsx
// src/custom-tab-bar/index.tsx
import { useMiniConfig } from '@/runtime/hot-update';
import { usePermissions } from '@/runtime/mode';

export default function CustomTabbar() {
  const { config } = useMiniConfig();
  const { hasPerm } = usePermissions();
  const items = config.tabBar.filter(t => t.enabled && (!t.requiredPermission || hasPerm(t.requiredPermission)));
  return (
    <View className="tabbar">
      {items.map(it => (
        <View key={it.key} onClick={() => Taro.switchTab({ url: `/pages/dynamic/index?p=${encodeURIComponent(it.path)}` })}>
          <Image src={it.icon} />
          <Text>{it.text}</Text>
        </View>
      ))}
    </View>
  );
}
```

### 5.2 任务状态轮询（无 WebSocket）

```ts
// src/services/task.ts
export async function pollTask(taskId: string, onChange: (s: 'PENDING'|'RUNNING'|'DONE'|'FAILED')=>void) {
  const timer = setInterval(async ()=>{
    const r = await request<{status:string}>(`/api/business/tasks/${taskId}/status`);
    onChange(r.status as any);
    if (r.status === 'DONE' || r.status === 'FAILED') clearInterval(timer);
  }, 3000);
  return () => clearInterval(timer);
}
```

### 5.3 Taro 编译优化（示例）

```ts
// config/index.js
mini: {
  optimizeMainPackage: true,
  postcss: { pxtransform: { enable: true } },
  webpackChain(chain) {
    chain.optimization.splitChunks({
      chunks: 'all',
      minSize: 20 * 1024,
      cacheGroups: {
        vendors: { test: /[\\/]node_modules[\\/]/, name: 'vendors', priority: 10 },
        commons: { name: 'commons', minChunks: 2, priority: 5 }
      }
    });
  }
}
```

---

# 6. RN 端核心代码与方案细化

### 6.1 AppConfigProvider（RN）

```ts
// app/src/config/provider.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { MMKV } from 'react-native-mmkv';
import type { MiniAppConfig } from '../../shared/types/mini-config';

const storage = new MMKV();

const Ctx = createContext<{config: MiniAppConfig; setConfig: (c:MiniAppConfig)=>void; hasPerm:(p?:string)=>boolean}>({} as any);

export function AppConfigProvider({ initial, children }: { initial: MiniAppConfig; children: React.ReactNode }) {
  const [config, setConfig] = useState<MiniAppConfig>(() => {
    const cached = storage.getString('app:cfg');
    return cached ? JSON.parse(cached) : initial;
  });
  useEffect(()=>{ storage.set('app:cfg', JSON.stringify(config)); }, [config]);

  const hasPerm = (p?: string) => !p || config.permissions.roles.some(r => (config.permissions.rolePermissions[r]||[]).includes(p));
  return <Ctx.Provider value={{ config, setConfig, hasPerm }}>{children}</Ctx.Provider>;
}
export const useAppConfig = () => useContext(Ctx);
export const usePermissions = () => {
  const { hasPerm } = useAppConfig();
  return { hasPerm };
};
```

### 6.2 React Query + MMKV 持久化（RN）

```ts
// app/src/services/query.ts
import { QueryClient, onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';

onlineManager.setEventListener((setOnline)=> NetInfo.addEventListener(state => setOnline(!!state.isConnected)));

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 60_000 } }
});
```

---

# 7. 后端适配（沿用已有栈）

* **新增**移动端配置接口（与 Web 共用聚合逻辑）

  * `GET /api/mobile/version?platform=wx|rn&mode=...` → `{ version, etag }`（Redis 命中）
  * `GET /api/mobile/config?platform=wx|rn&mode=...` → `MiniAppConfig`（ETag 协商缓存）
* **COS STS**：`GET /api/cos/sts` 返回临时证书；或**预签名 URL** `POST /api/cos/presign`。
* **任务轮询**：`GET /api/business/tasks/:id/status`，保证 200ms 内返回。
* **会员/支付**：保持你们现有套餐/权益接口；小程序支付另加 `POST /api/payments/wechat/prepare`。

---

# 8. 性能目标与抓手

* **小程序首屏 < 2s**

  * 主包极小化（仅启动/动态页/骨干组件）
  * 独立分包 + `wx.preloadSubpackage` 预拉取用户常用模式
  * 自定义 TabBar + 骨架屏
  * 配置与主题用本地缓存即时渲染，后台再校验 ETag
* **App 启动 < 1.5s**

  * Hermes + inlineRequires
  * 延迟初始化非关键 SDK（支付/分享）
  * Splash 后即展示缓存的 AppConfig + 骨架
* **API < 200ms**

  * 依赖你们现有 Redis 命中、读写分离
  * 前端请求合并、幂等化与 CDN 命中（图片）

---

# 9. 时间与人力评估（保守）

* **微信小程序（2–3 个月）**

  * 第 1 周：项目脚手架、分包与注册表、配置渲染器、主题系统、登录鉴权
  * 第 2–3 周：衣橱（男/女）主流程、相机与上传、AI 任务发起与轮询
  * 第 4–5 周：商业版工作台/任务/配额/团队
  * 第 6–8 周：打磨、审核资料、AB 实验、性能与埋点
  * **人力**：前端 2–3（Taro+原生）、后端 1（接口与聚合器）、测 1、设计 1

* **App（3–4 个月）**

  * RN 基建与共用 runtime 对齐 2 周；
  * 主流程复刻 6–8 周；
  * 原生支付/分享/推送 2 周；
  * 打包上架 2 周。
  * **人力**：RN 2、iOS/Android 工程师 1（或兼职）、后端 1、测 1

---

# 10. 交付清单映射

* **小程序 30 页**：第 1、3、5、8 节可直接扩展；补图即可达标。
* **App 30 页**：第 2、6、7、8 节扩展。
* **50+ 文件代码**：本方案目录与示例可迅速拓展（组件 30+、页面 10+、服务/运行时/状态 10+）。

---

## 附：关键示例汇总（可直接复制）

### A. 小程序：动态页入口（用于任意配置页面）

```tsx
// 调用：/pages/dynamic/index?p=/business/tasks
```

### B. 小程序：自定义 TabBar 动态渲染（已给）

### C. 小程序：配置热更新（已给）

### D. RN：注册表 + 渲染器 + 动态导航（已给）

### E. 统一权限判断（小程序/RN 同步思路）

```ts
export function hasPerm(roles: string[], rolePermissions: Record<string,string[]>, required?:string) {
  if (!required) return true;
  return roles.some(r => (rolePermissions[r] || []).includes(required));
}
```

---

## 最后再次强调三条底线与取舍

1. **配置驱动 ≠ 任意新代码下发**：小程序与 App 都应**限制在注册表白名单**里动态组合；新增组件类型/原生能力仍需发版。
2. **性能优先**：主包极小化、独立分包、关键页原生；RN 侧 Hermes+FlashList+MMKV。
3. **统一运行时内核（TS 包）**：配置解析、权限、埋点、缓存、组件 key 命名、主题 Token —— 一处维护，三端共用。

---

如果你需要，我可以把以上代码块与目录直接打成**最小可运行模板（Taro + RN + 共享 runtime 包）**，包含：

* 3 个模式的示例页面、10+ 白名单组件、动态渲染器、TabBar、COS 上传、任务轮询、配置热更新、主题切换。
  你们团队拉起即可对接后端，按本文时间表推进上线。

太好了，这两组任务本身就该拆成**两个独立的功能模块**来做：

* **模块 A：Feature 创建向导（CMS-208 / CMS-306）** → *React Flow + Step Wizard*，产出可发布的前端配置/路由/导航变更。
* **模块 B：模板编辑器（CMS-301 / CMS-302 / CMS-303）** → *Monaco + Handlebars*，支持变量自动补全、模板校验与实时预览。

下面给出**可直接落地**的技术方案、目录、API、数据结构与关键代码（TypeScript），并附上每个任务的验收标准与测试要点。

---

## 一、模块 A：Feature 创建向导（CMS-208 / CMS-306）

### 1) 目标与产出

* 在 CMS 后台新增「Feature 向导」入口，指导产品同学**从 0 到可发布**地创建一个功能：

  * 定义基础信息（名称、Key、所属模式、权限）
  * 用 **React Flow** 搭页面结构与组件树
  * 配置路由与导航插入位置
  * 预览并生成 **AppConfig delta**（与当前已发布配置的差异）
  * 保存为草稿 / 提交审核 / 发布（写入 `ui_releases` 并刷新 Redis）

### 2) 目录结构（Admin）

```
admin/
  src/
    modules/
      feature-wizard/
        index.tsx
        steps/
          StepBasics.tsx
          StepFlow.tsx
          StepRouting.tsx
          StepPermissions.tsx
          StepReview.tsx
        flow/
          nodes/
            PageNode.tsx
            RegionNode.tsx
            ComponentNode.tsx
          edges/DefaultEdge.tsx
          schema.ts           # Flow <-> PageConfig 映射
        store/
          wizard.store.ts     # Zustand：跨步骤状态
        api/
          feature.api.ts      # Admin API 调用
        utils/
          diff.ts             # 计算 AppConfig 差异
          validators.ts
        StepWizard.tsx        # 通用分步组件
```

### 3) 新增后端存储（可选：便于草稿与审核）

> 你们已有 `ui_releases` 用于发布，这里增加**草稿表**，便于反复编辑&审计。

```sql
-- 保存未发布的 Feature 向导草稿
CREATE TABLE ui_feature_drafts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  feature_key VARCHAR(128) NOT NULL,
  name VARCHAR(128) NOT NULL,
  mode_key VARCHAR(64) NOT NULL,              -- 'business'|'wardrobe-male'|'wardrobe-female'
  step JSON NOT NULL,                          -- 当前步骤快照（表单数据）
  flow_json JSON NOT NULL,                     -- React Flow 图数据
  page_config_json JSON NOT NULL,              -- 生成的 PageConfig[]
  navigation_json JSON NOT NULL,               -- 导航变更
  permissions_json JSON NULL,                  -- 权限要求
  status ENUM('draft','review','approved','rejected') DEFAULT 'draft',
  created_by BIGINT NULL,
  updated_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_feature (feature_key)
) ENGINE=InnoDB;
```

> 最终发布时，不必再落地专门表，可直接把**导航 & 页面**合入你们的 `ui_pages`/`ui_nav_items` 或打包入 `ui_releases.bundle_json`。

### 4) Admin API（Express）

```ts
// server/routes/admin/feature.ts
import { Router } from 'express';
import { adminAuth } from '../../middlewares/adminAuth';
import * as svc from '../../services/feature.service';

const router = Router();
router.use(adminAuth);

// 草稿
router.get('/features', svc.listDrafts);
router.post('/features', svc.createDraft);          // 新建草稿
router.get('/features/:id', svc.getDraft);
router.put('/features/:id', svc.updateDraft);       // 保存每步数据
router.post('/features/:id/submit', svc.submitDraftForReview);

// 构建预览 Delta
router.post('/features/:id/build', svc.buildDeltaPreview); // 返回 { navigationDelta, pagesDelta, finalBundlePreview }

// 发布（合入当前配置并生成新 release）
router.post('/features/:id/publish', svc.publishFeature);  // 写 ui_releases + Redis 刷新

export default router;
```

**服务逻辑要点（`feature.service.ts`）**

* `buildDeltaPreview`：读取草稿 → 映射出 `PageConfig[]/NavigationConfig[]` → 与当前发布版本 `AppConfig` 做 diff → 返回 delta 和合并后的 **preview bundle**。
* `publishFeature`：把 **preview bundle** 作为新版本写入 `ui_releases` 并更新 `version/etag` 的 Redis Key。

### 5) 前端：Step Wizard 组件

```tsx
// admin/src/modules/feature-wizard/StepWizard.tsx
'use client';
import { Steps, Button } from 'antd';
import { useWizard } from './store/wizard.store';

export function StepWizard({ steps }: { steps: { title: string; element: JSX.Element; validate?: ()=>Promise<boolean> }[] }) {
  const { stepIndex, setStepIndex } = useWizard();
  const next = async () => {
    const s = steps[stepIndex];
    if (s.validate && !(await s.validate())) return;
    setStepIndex(stepIndex + 1);
  };
  const prev = () => setStepIndex(stepIndex - 1);

  return (
    <>
      <Steps current={stepIndex} items={steps.map(s => ({ title: s.title }))} />
      <div className="mt-4">{steps[stepIndex].element}</div>
      <div className="mt-6 flex justify-end gap-2">
        {stepIndex > 0 && <Button onClick={prev}>上一步</Button>}
        <Button type="primary" onClick={next}>{stepIndex === steps.length - 1 ? '完成' : '下一步'}</Button>
      </div>
    </>
  );
}
```

### 6) React Flow 集成与到 PageConfig 的映射

**节点类型**：

* `PageNode`（页面）
* `RegionNode`（页面区域：header/main/aside/footer）
* `ComponentNode`（来自组件目录的已注册 key）

**核心类型与映射**

```ts
// admin/src/modules/feature-wizard/flow/schema.ts
import type { ComponentNode, PageConfig } from '@/types/config';

export interface FlowData {
  nodes: Array<{ id:string; type:'page'|'region'|'component'; data:any; position:{x:number;y:number}; parentId?:string }>;
  edges: Array<{ id:string; source:string; target:string }>;
}

export function flowToPageConfigs(flow: FlowData): PageConfig[] {
  const pages: PageConfig[] = [];
  const byId = new Map(flow.nodes.map(n => [n.id, n]));
  const rootPages = flow.nodes.filter(n => n.type === 'page');

  for (const p of rootPages) {
    const pageChildren = flow.nodes.filter(n => n.parentId === p.id);
    const regions = pageChildren.filter(n => n.type === 'region');
    const nodes: ComponentNode[] = [];

    for (const r of regions) {
      const comps = flow.nodes.filter(n => n.parentId === r.id && n.type === 'component');
      for (const c of comps) {
        nodes.push({ key: c.data.key, props: c.data.props || {}, region: r.data.regionKey, requiredPermission: c.data.requiredPermission });
      }
    }
    pages.push({
      path: p.data.path,
      title: p.data.title,
      layoutKey: p.data.layout || 'default',
      componentType: 'custom',
      enabled: true,
      nodes
    });
  }
  return pages;
}
```

### 7) 向导状态（Zustand）

```ts
// admin/src/modules/feature-wizard/store/wizard.store.ts
import { create } from 'zustand';
import type { FlowData } from '../flow/schema';
import type { PageConfig, NavigationConfig } from '@/types/config';

interface WizardState {
  stepIndex: number;
  basics: { featureKey:string; name:string; mode:'business'|'wardrobe-male'|'wardrobe-female' };
  flow: FlowData;
  pages: PageConfig[];
  navigation: NavigationConfig[];
  permissions: { required?: string; visibleRoles?: string[] };
  setStepIndex: (i:number)=>void;
  setBasics: (b: WizardState['basics'])=>void;
  setFlow: (f: FlowData)=>void;
  setPages: (p: PageConfig[])=>void;
  setNavigation: (n: NavigationConfig[])=>void;
  setPermissions: (p: WizardState['permissions'])=>void;
}
export const useWizard = create<WizardState>((set)=>({
  stepIndex: 0,
  basics: { featureKey:'', name:'', mode:'business' },
  flow: { nodes:[], edges:[] },
  pages: [],
  navigation: [],
  permissions: {},
  setStepIndex: (i)=>set({ stepIndex:i }),
  setBasics: (basics)=>set({ basics }),
  setFlow: (flow)=>set({ flow }),
  setPages: (pages)=>set({ pages }),
  setNavigation: (navigation)=>set({ navigation }),
  setPermissions: (permissions)=>set({ permissions }),
}));
```

### 8) 导航配置（StepRouting）

* 选择插入位置：父菜单、顺序、图标、权限。
* 产出 `NavigationConfig[]`，由后端合入已有导航树。

### 9) 审核与发布（StepReview）

* 显示与当前已发布版本的差异（新增/修改的 `pages` 与 `navigation`），确认后调用 `/features/:id/publish`。
* 写 `audit_logs` 与 `ui_releases`，刷新 Redis 版本键（参考你们现有策略）。

### 10) 验收标准（AC）

* CMS-208：完成 5 步向导，任意一步可保存草稿；中途退出重进能恢复；必填校验。
* CMS-306：React Flow 可拖拽、层级正确、支持导出→生成 `PageConfig[]`；预览差异准确并可一键发布。

---

## 二、模块 B：模板编辑器（CMS-301 / 302 / 303）

### 1) 目标与产出

* 内置 **Monaco 编辑器**，语言模式 `hbs`（Handlebars）。
* 支持**变量自动补全、悬浮提示、语法高亮**。
* **实时预览**：在右侧面板将模板 + 变量上下文通过 `handlebars` 渲染；校验未知变量并给出诊断。
* 模板保存到新表或现有 `content_texts`（建议新表：`ui_templates`）。

### 2) 数据表（可与 content\_texts 互通）

```sql
CREATE TABLE ui_templates (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  key_slug VARCHAR(128) NOT NULL UNIQUE,   -- e.g. 'welcome.message'
  description VARCHAR(256) NULL,
  locale VARCHAR(16) NOT NULL DEFAULT 'zh-CN',
  content MEDIUMTEXT NOT NULL,             -- Handlebars 模板
  vars_schema JSON NULL,                   -- 变量 schema（可选）
  status ENUM('active','archived') DEFAULT 'active',
  created_by BIGINT NULL,
  updated_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
```

### 3) Admin API

```ts
// server/routes/admin/templates.ts
import { Router } from 'express';
import { adminAuth } from '../../middlewares/adminAuth';
import * as svc from '../../services/templates.service';
const router = Router();
router.use(adminAuth);

router.get('/templates', svc.list);
router.get('/templates/:key', svc.get);
router.post('/templates', svc.create);
router.put('/templates/:key', svc.update);
router.post('/templates/:key/preview', svc.preview); // 返回渲染后的 HTML/Text
router.get('/templates/:key/vars', svc.vars); // 返回变量列表与说明（给补全）

export default router;
```

### 4) 前端目录

```
admin/src/modules/template-editor/
  index.tsx
  MonacoHbs.tsx
  sidebar/VariablesPanel.tsx
  preview/PreviewPane.tsx
  services/template.api.ts
  hbs/monarch.ts        # Handlebars 语法高亮定义
  hbs/completions.ts    # 变量与 helper 补全
  hbs/diagnostics.ts    # 未知变量/语法错误标记
```

### 5) Monaco 集成（@monaco-editor/react）

**语法与补全注册**

```ts
// admin/src/modules/template-editor/hbs/monarch.ts
export const handlebarsLanguage = {
  tokenizer: {
    root: [
      [/\{\{\{/, { token: 'delimiter.handlebars', next: '@raw' }],
      [/\{\{!.*?\}\}/, 'comment'],
      [/\{\{[^}]+\}\}/, 'delimiter.handlebars'],
      [/[^{]+/, '']
    ],
    raw: [
      [/\}\}\}/, { token: 'delimiter.handlebars', next: '@pop' }],
      [/[^}]+/, 'string']
    ]
  }
};
```

```tsx
// admin/src/modules/template-editor/MonacoHbs.tsx
'use client';
import Editor, { OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { handlebarsLanguage } from './hbs/monarch';
import { registerHbsCompletions } from './hbs/completions';
import { registerHbsDiagnostics } from './hbs/diagnostics';

export function MonacoHbs({ value, onChange }: { value:string; onChange:(v:string)=>void }) {
  const onMount: OnMount = (editor, m) => {
    m.languages.register({ id: 'hbs' });
    m.languages.setMonarchTokensProvider('hbs', handlebarsLanguage as any);
    registerHbsCompletions(m);
    registerHbsDiagnostics(m, editor);
  };
  return (
    <Editor
      height="calc(100vh - 180px)"
      defaultLanguage="hbs"
      value={value}
      onChange={(v)=>onChange(v || '')}
      options={{
        minimap: { enabled: false },
        wordWrap: 'on',
        tabSize: 2
      }}
      onMount={onMount}
    />
  );
}
```

**变量/Helper 自动补全**

```ts
// admin/src/modules/template-editor/hbs/completions.ts
import type * as Monaco from 'monaco-editor';

export function registerHbsCompletions(m: typeof Monaco) {
  m.languages.registerCompletionItemProvider('hbs', {
    triggerCharacters: ['{', '.', ' '],
    provideCompletionItems(model, position) {
      const suggestions: Monaco.languages.CompletionItem[] = [];
      // 示例变量：可从右侧 VariablesPanel 或 API 拉取缓存
      const vars = [
        { key: 'userName', detail: '当前用户昵称' },
        { key: 'date', detail: '当前日期 (YYYY-MM-DD)' },
        { key: 'planName', detail: '会员套餐名称' }
      ];
      vars.forEach(v => suggestions.push({
        label: v.key,
        kind: m.languages.CompletionItemKind.Variable,
        insertText: `{{${v.key}}}`,
        detail: v.detail
      }));
      const helpers = [
        { key: 'upper', detail: '转大写，{{upper value}}' },
        { key: 'dateFormat', detail: '日期格式化，{{dateFormat ts "YYYY-MM-DD"}}' }
      ];
      helpers.forEach(h => suggestions.push({
        label: h.key,
        kind: m.languages.CompletionItemKind.Function,
        insertText: `{{${h.key} }}`
      }));
      return { suggestions };
    }
  });
}
```

**诊断（未知变量高亮）**

```ts
// admin/src/modules/template-editor/hbs/diagnostics.ts
import type * as Monaco from 'monaco-editor';

export function registerHbsDiagnostics(m: typeof Monaco, editor: Monaco.editor.IStandaloneCodeEditor) {
  const model = editor.getModel();
  if (!model) return;

  const compute = () => {
    const text = model.getValue();
    const markers: Monaco.editor.IMarkerData[] = [];
    const re = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
    const known = new Set(['userName','date','planName']); // 实际从变量面板注入
    for (const match of text.matchAll(re)) {
      const full = match[0], key = match[1], idx = match.index || 0;
      if (!known.has(key)) {
        const pos = model.getPositionAt(idx);
        const end = model.getPositionAt(idx + full.length);
        markers.push({
          severity: m.MarkerSeverity.Warning,
          message: `未知变量: ${key}`,
          startLineNumber: pos.lineNumber,
          startColumn: pos.column,
          endLineNumber: end.lineNumber,
          endColumn: end.column
        });
      }
    }
    m.editor.setModelMarkers(model, 'hbs-diagnostics', markers);
  };

  compute();
  editor.onDidChangeModelContent(() => compute());
}
```

### 6) 预览渲染（Handlebars）

```ts
// admin/src/modules/template-editor/index.tsx
'use client';
import Handlebars from 'handlebars';
import { MonacoHbs } from './MonacoHbs';
import { VariablesPanel } from './sidebar/VariablesPanel';
import { useState, useMemo } from 'react';
import { Card } from 'antd';

Handlebars.registerHelper('upper', (v:string)=>String(v || '').toUpperCase());
Handlebars.registerHelper('dateFormat', (ts:number, fmt:string)=> new Date(ts).toISOString().slice(0,10)); // 可替换 dayjs

export default function TemplateEditorPage() {
  const [tpl, setTpl] = useState('Hi, {{userName}}!');
  const [ctx, setCtx] = useState({ userName:'Luna', planName:'Pro', date:'2025-11-01' });

  const output = useMemo(()=>{
    try {
      const compiled = Handlebars.compile(tpl, { noEscape: false });
      return compiled(ctx);
    } catch (e:any) { return `渲染错误：${e.message}`; }
  }, [tpl, ctx]);

  return (
    <div className="grid grid-cols-2 gap-12">
      <Card title="模板编辑">
        <MonacoHbs value={tpl} onChange={setTpl} />
      </Card>
      <div className="flex flex-col gap-4">
        <Card title="变量">
          <VariablesPanel value={ctx} onChange={setCtx}/>
        </Card>
        <Card title="实时预览">
          <div style={{ whiteSpace:'pre-wrap' }}>{output}</div>
        </Card>
      </div>
    </div>
  );
}
```

### 7) 验收标准（AC）

* CMS-301：Monaco 能打开/编辑模板，语法高亮、行号、搜索、快捷键可用。
* CMS-302：输入 `{{` 触发变量/Helper 补全；Hover 显示变量描述；未知变量有警告标记。
* CMS-303：右侧实时预览渲染正确；可切换上下文；保存模板后能被业务读取（如欢迎语、错误提示）。

---

## 三、跨模块一致性 & 与现有配置体系的集成

* **组件白名单与目录**：向导中的 ComponentNode 只允许选择**已注册**的组件（与前台注册表键一致）。
* **权限**：向导与模板都对接现有 RBAC；页面/组件 `requiredPermission` 会进入 AppConfig。
* **发布与回滚**：全部走 `ui_releases`，写审计与快照；与前端轮询 ETag 的机制一致。
* **缓存**：Admin 侧列表/模板详情用 React Query，`staleTime` 合理设置；发布后主动刷新版本缓存。

---

## 四、测试与质量保障

### 单元测试（Jest）

* `flow/schema.flowToPageConfigs`：输入多层 FlowData，断言输出 `PageConfig.nodes` 的 region/props/权限映射正确。
* `hbs/diagnostics`：给定模板文本，校验未知变量标记位置正确。
* `utils/diff`：校验导航/页面的添加、修改、删除 diff 结果准确。

### 端到端（Playwright/Cypress）

* **向导**：从 Step1 → Step5 全链路创建 + 保存草稿 + 刷新恢复；React Flow 拖拽、删除、连线、改属性；发布后在预览应用中可见。
* **模板编辑器**：补全、Hover、错误标记、预览渲染；保存后读取显示一致。

### 可观测性

* 向导各步骤 time-to-complete、撤回率；模板编辑器保存失败率；全部用现有埋点体系上报（事件名建议：`fw_step_next`, `tpl_save`, `tpl_preview_error`）。

---

## 五、风控与回退

* **模板渲染安全**：默认 `{{}}` HTML 转义；仅在明确需求时允许 `{{{raw}}}`；服务端预览接口需做 XSS 过滤。
* **发布闸门**：仅 `approved` 草稿可发布；发布前强制生成 diff 预览并二次确认。
* **回滚**：保留最近 N 个 `ui_releases`；一键回滚按钮指向最近一次稳定版本。

---

## 六、任务拆解与交付物对齐

### CMS-208（Feature 向导 MVP）

* StepWizard 框架与状态管理
* StepBasics/StepRouting/StepPermissions/StepReview 表单
* Admin API：草稿 CRUD
* Diff 预览（不含 Flow）

**验收**：不接 Flow 的最小功能可闭环（可手工添加组件列表形成页面）。

### CMS-306（Flow 集成）

* React Flow 画布与 Page/Region/Component 自定义节点
* Flow→PageConfig 映射
* 与 StepRouting 合并输出 Delta → 发布

**验收**：用 Flow 画出页面结构并成功发布，前台自动出现。

### CMS-301/302/303（模板编辑器）

* Monaco 集成 + hbs 语言/补全/诊断
* 预览 Pane + 变量面板
* 模板 CRUD + 审计 + 列表筛选

**验收**：模板可创建/编辑/预览/保存；业务侧可读取与渲染。

---

## 七、关键依赖与安装（Admin）

```bash
# 前端
pnpm add @monaco-editor/react handlebars reactflow zustand
pnpm add -D monaco-editor

# 类型
pnpm add -D @types/handlebars

# 后端
pnpm add handlebars
```

---

### 小结

* **模块 A（Feature 向导）**：把“页面搭建”从工程化变为产品化，让非技术同学也能通过 React Flow 产出可发布的页面/导航/权限配置。
* **模块 B（模板编辑器）**：将文案与模板的修改完全移交 CMS，无需发版，变量补全与实时预览降低改错率。
* 两者均与现有 **发布/快照/审计/缓存** 体系无缝对齐，风险可控、回滚有据。

如需，我可以把以上代码片段打包成 **Admin 子模块模板**（包含路由、菜单、权限、示例数据与测试脚本），直接合入你们仓库即可开始联调。


下面给出一套**能直接落地**的移动端（Web/PWA 为主）完整方案，覆盖**移动端组件与交互、性能与离线、PWA 全量配置、移动路由、状态管理（Redux Toolkit & Zustand）、性能优化代码、监控与测试**。
所有代码均基于 **Next.js 14 App Router + TypeScript + Tailwind + Ant Design 5（按需）**，并兼容你们前述“**配置驱动前端**”思想（导航/页面/组件树/权限均由后端 JSON 下发）。

> 目录导览
> 1️⃣ 移动端组件&交互 · 2️⃣ 移动端性能 · 3️⃣ PWA 完整实现 · 4️⃣ 移动端专用路由
> 5️⃣ 状态管理（RTK & Zustand）· 6️⃣ 性能优化细节 · 7️⃣ 监控/埋点 · 8️⃣ 测试方案

---

## 1) 📱 移动端组件适配（Web/PWA）

### 1.1 三种模式的移动端专用组件策略

* **抽象层**：`components/mobile/*` 放“移动端组件”，通过 `ModeContext` 与 Design Tokens 决定配色与密度；业务强组件仍在各模式目录。
* **导航**：移动端统一使用**底部 TabBar**（Wardrobe 男/女），商业版在移动端提供**简化顶部工具栏 + Drawer 侧滑**（只读/轻操作）。
* **差异化**：

  * **商业（mobile 简化）**：`MobileTaskList`、`MobileBatchUploader`、`SimpleQuota`
  * **男**：`SwipeableClothesList`、`QuickActionSheet`、`MinimalOutfitCard`
  * **女**：`RichOutfitCard`（带价格/次数/标签）、`AccessoryCarousel`、`LikeBurstButton`（动效）

目录（关键片段）：

```
src/components/
  mobile/
    TabBar/
    DrawerNav/
    Gesture/
    ProgressiveImage/
    VirtualList/
    Skeleton/
  business/mobile/
    MobileTaskList/
    SimpleQuota/
  wardrobe/mobile/
    SwipeableClothesList/
    MinimalOutfitCard/
    RichOutfitCard/
```

### 1.2 触摸手势处理

* **库**：`@use-gesture/react`（轻量、稳定）+ `framer-motion`（动效）。
* **支持**：滑动（左右/上下）、长按（press-and-hold 触发 ActionSheet）、双击（点赞/收藏）。

**长按 & 双击通用 Hook（移动优化）**

```ts
// src/components/mobile/Gesture/usePressAndDoubleTap.ts
'use client';
import { useRef, useCallback } from 'react';

export function usePressAndDoubleTap(
  onLongPress: () => void,
  onDoubleTap: () => void,
  { longPressMs = 450, doubleTapMs = 250 } = {}
) {
  const pressTimer = useRef<number | null>(null);
  const lastTap = useRef<number>(0);

  const onPointerDown = useCallback(() => {
    pressTimer.current = window.setTimeout(onLongPress, longPressMs);
  }, [onLongPress, longPressMs]);

  const onPointerUp = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    const now = Date.now();
    if (now - lastTap.current < doubleTapMs) {
      onDoubleTap();
    }
    lastTap.current = now;
  }, [onDoubleTap, doubleTapMs]);

  return { onPointerDown, onPointerUp };
}
```

**左右滑删除（男版衣橱列表示例）**

```tsx
// src/components/wardrobe/mobile/SwipeableClothesList/index.tsx
'use client';
import { useGesture } from '@use-gesture/react';
import { motion, useMotionValue } from 'framer-motion';

type Item = { id: string; name: string; image: string; tags?: string[] };

export default function SwipeableClothesList({ items, onRemove }: {
  items: Item[]; onRemove: (id: string)=>void;
}) {
  return (
    <ul className="divide-y">
      {items.map(item => <Row key={item.id} item={item} onRemove={onRemove} />)}
    </ul>
  );
}

function Row({ item, onRemove }: { item: Item; onRemove: (id: string)=>void }) {
  const x = useMotionValue(0);
  useGesture(
    {
      onDrag: ({ offset: [ox] }) => x.set(ox),
      onDragEnd: ({ offset: [ox] }) => {
        if (Math.abs(ox) > 120) onRemove(item.id);
        x.set(0);
      }
    },
    { drag: { axis: 'x', filterTaps: true } }
  );

  return (
    <li className="relative overflow-hidden touch-pan-y">
      <div className="absolute inset-0 bg-red-500 text-white flex items-center justify-end pr-4">删除</div>
      <motion.div
        style={{ x }}
        className="bg-white dark:bg-neutral-800 p-3 flex gap-3"
      >
        <img src={item.image} alt={item.name} className="w-16 h-16 rounded object-cover" loading="lazy" />
        <div className="flex-1">
          <div className="font-semibold">{item.name}</div>
          <div className="text-xs opacity-70">{item.tags?.slice(0,3).join(' · ')}</div>
        </div>
      </motion.div>
    </li>
  );
}
```

**双击点赞动效（女性版）**

```tsx
// src/components/wardrobe/mobile/RichOutfitCard/LikeBurstButton.tsx
'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePressAndDoubleTap } from '@/components/mobile/Gesture/usePressAndDoubleTap';

export function LikeBurstButton({ onLike }: { onLike: ()=>void }) {
  const [burst, setBurst] = useState(false);
  const { onPointerDown, onPointerUp } = usePressAndDoubleTap(
    () => {/* long press menu */}, 
    () => { setBurst(true); onLike(); }
  );
  return (
    <div className="relative select-none" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
      <button className="rounded-full px-3 py-1 bg-pink-500 text-white text-sm">喜欢</button>
      <AnimatePresence>
        {burst && (
          <motion.div
            initial={{ scale: .2, opacity: 1 }}
            animate={{ scale: 1.8, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: .6 }}
            className="absolute inset-0 m-auto w-6 h-6 bg-pink-400 rounded-full pointer-events-none"
            onAnimationComplete={() => setBurst(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
```

### 1.3 移动端导航模式

* **Wardrobe（男/女）**：底部 `TabBar`（衣橱/搭配/社区/我的），上方维持轻搜索栏（女版更强调）。
* **Business（移动）**：顶部**Context 工具栏** + 汉堡按钮触发 **DrawerNav**，只展示“进行中任务/历史/配额”核心入口。

**通用移动 TabBar（可与配置驱动关联）**

```tsx
// src/components/mobile/TabBar/index.tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppConfig } from '@/context/AppConfigProvider'; // 包含 config.tabBar
export default function MobileTabBar() {
  const { config } = useAppConfig();
  const pathname = usePathname();
  const tabs = config.navigation.filter(n => n.meta?.isTab && n.enabled);
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white dark:bg-neutral-900 border-t z-50 h-14 grid grid-cols-4">
      {tabs.map(t => {
        const active = pathname.startsWith(t.path);
        return (
          <Link key={t.id} href={t.path} className="flex flex-col items-center justify-center text-xs">
            <span className={active ? 'text-brand font-semibold' : 'opacity-70'}>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

### 1.4 完整移动端组件示例：**ProgressiveImage**（懒加载 + 模糊占位）

```tsx
// src/components/mobile/ProgressiveImage/index.tsx
'use client';
import { useEffect, useRef, useState } from 'react';

type Props = { src: string; alt: string; width: number; height: number; lqip?: string };
export default function ProgressiveImage({ src, alt, width, height, lqip }: Props) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = new Image();
    img.src = src;
    img.decoding = 'async';
    img.onload = () => setLoaded(true);
  }, [src]);

  return (
    <div className="relative overflow-hidden" style={{ width, height }}>
      {!loaded && (
        <img
          src={lqip ?? `data:image/svg+xml;base64,${btoa(`<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'/>`)}`}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-md scale-105"
        />
      )}
      <img
        ref={ref}
        src={src}
        alt={alt}
        loading="lazy"
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
}
```

---

## 2) 🚀 移动端性能优化

### 2.1 虚拟滚动（长列表）

* **库**：`@tanstack/react-virtual`（轻，SSR 友好），或 `react-window`。
* **场景**：衣橱列表、任务历史、社区瀑布流。

```tsx
// src/components/mobile/VirtualList/index.tsx
'use client';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

export function VirtualList<T>({ items, row, estimate = 84 }: {
  items: T[];
  row: (item: T, idx: number) => React.ReactNode;
  estimate?: number;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimate
  });

  return (
    <div ref={parentRef} className="h-[calc(100vh-56px)] overflow-auto will-change-transform">
      <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map(v => (
          <div key={v.key} className="absolute left-0 right-0" style={{ transform: `translateY(${v.start}px)` }}>
            {row(items[v.index], v.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 2.2 图片懒加载与渐进式

* 统一使用 `<ProgressiveImage>`（上节）或 `next/image` (`placeholder="blur"`, `sizes`)，配合 **COS+CDN** WebP/AVIF。
* 建议后端在 COS 上传后生成 **LQIP（base64）** 与多分辨率 URL，放进配置或接口响应。

### 2.3 首屏加载 < 2s

* **SSR**：移动首页用 Server Component 输出框架与骨架；数据采用 React Query **prefetch + dehydrate**。
* **资源**：

  * 关键 CSS 变量 **内联**（layout.tsx 注入 `<style>`）。
  * 字体 `next/font`（`display: 'swap'`）+ 预连接 CDN。
  * 首屏图 `priority` + 其余懒加载。
  * 路由级/组件级**代码分割**，移动端仅加载 Tab 所需模块。
* **网络**：开启 HTTP/2、Gzip/Brotli；API 使用 **ETag/304** 与短 Cache-Control。

### 2.4 离线缓存（Service Worker + IndexedDB）

* 详见 **第 3 节：PWA**。页面骨架 + 最近数据（IndexedDB）离线可浏览，**在线再回放**（Background Sync）提交队列。

---

## 3) 🔧 PWA 完整实现

> 使用 **Workbox** 生成 Service Worker，策略：
>
> * **precache**：框架与静态产物
> * **runtime caching**：
>
>   * API（StaleWhileRevalidate + ETag）
>   * 图片（CacheFirst + 过期清理）
>   * CDN（StaleWhileRevalidate）
> * **Background Sync**：离线提交任务；在线后回放
> * **Push**：Web Push（自建 VAPID）
> * **A2HS**：自定义提示

### 3.1 manifest.json（public/manifest.json）

```json
{
  "name": "AI衣橱 & 商业工作台",
  "short_name": "AI衣橱",
  "start_url": "/m",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1890FF",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### 3.2 生成 Service Worker（workbox-build）

**脚本：**`scripts/build-sw.mjs`

```js
import { generateSW } from 'workbox-build';

await generateSW({
  globDirectory: 'out',              // 若用 next export；否则改 'public' + runtime routes
  globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,avif}'],
  swDest: 'public/sw.js',
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    {
      urlPattern: ({url}) => url.pathname.startsWith('/api/'),
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'api-cache',
        plugins: [{ cacheWillUpdate: async ({response}) => response.status === 200 ? response : null }]
      }
    },
    {
      urlPattern: ({url}) => url.hostname.endsWith('myqcloud.com') || url.pathname.startsWith('/_next/image'),
      handler: 'CacheFirst',
      options: {
        cacheName: 'image-cache',
        expiration: { maxEntries: 300, maxAgeSeconds: 7*24*3600 }
      }
    },
    {
      urlPattern: ({request}) => request.destination === 'style' || request.destination === 'script' || request.destination === 'font',
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'asset-cache' }
    },
    {
      urlPattern: ({url}) => url.pathname.startsWith('/m'),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'page-cache',
        networkTimeoutSeconds: 3,
        plugins: [{ handlerDidError: async () => caches.match('/offline.html') }]
      }
    }
  ],
  navigateFallback: '/offline.html'
});
```

> 在 `package.json` 中添加：`"postbuild": "node scripts/build-sw.mjs"`

**离线页面**：`public/offline.html`（简单占位 + 最近缓存渲染提示）。

### 3.3 后台同步（Background Sync）与离线提交

**SW（public/sw\.js）追加**（如使用 generateSW，可在 `additionalManifestEntries` 或自定义注入）：

```js
// 注册 Background Sync queue（示例）
import { Queue } from 'workbox-background-sync';
const taskQueue = new Queue('task-queue');

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method === 'POST' && request.url.includes('/api/business/tasks')) {
    event.respondWith((async () => {
      try {
        return await fetch(request.clone());
      } catch (err) {
        await taskQueue.pushRequest({ request });
        return new Response(JSON.stringify({ offlineQueued: true }), { status: 202, headers: { 'Content-Type': 'application/json' } });
      }
    })());
  }
});
```

### 3.4 Web Push（自建 VAPID）

**服务端（Express）**

```ts
// server/webpush.ts
import webpush from 'web-push';
import { Router } from 'express';
const router = Router();

// 1) 生成并保存 VAPID（一次性）
webpush.setVapidDetails('mailto:admin@your.com', process.env.VAPID_PUBLIC!, process.env.VAPID_PRIVATE!);

// 2) 客户端上报订阅
router.post('/push/subscribe', async (req, res) => {
  const sub = req.body; // 保存到 DB 绑定 userId
  // await db.insertSubscription(userId, sub)
  res.json({ ok: true });
});

// 3) 任务完成时发送
export async function notify(userId: string, title: string, body: string, url = '/m/business/tasks') {
  const subs = await getSubscriptions(userId); // 从 DB
  await Promise.all(subs.map(s => webpush.sendNotification(s, JSON.stringify({ title, body, url })).catch(()=>{/*清理失效*/})));
}

export default router;
```

**SW 处理 push**

```js
self.addEventListener('push', (e) => {
  const data = e.data?.json() || {};
  e.waitUntil(self.registration.showNotification(data.title || 'AI任务更新', {
    body: data.body, icon: '/icons/icon-192.png', data: { url: data.url || '/m' }
  }));
});
self.addEventListener('notificationclick', (e) => {
  const url = e.notification.data?.url || '/m';
  e.notification.close();
  e.waitUntil(clients.openWindow(url));
});
```

**客户端订阅（/m 页面挂载时）**

```ts
// src/app/(mobile)/subscribe-push.ts
'use client';
export async function ensurePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC!;
    const newSub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) });
    await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(newSub) });
  }
}
```

### 3.5 A2HS（添加到主屏）引导

```ts
// src/components/pwa/A2HS.tsx
'use client';
import { useEffect, useState } from 'react';

export default function A2HS() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem('a2hs_seen');
    function handler(e: any) {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!seen) setOpen(true);
    }
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!open) return null;
  return (
    <div className="fixed bottom-16 inset-x-0 mx-4 p-3 rounded bg-white shadow-lg">
      <div className="flex justify-between items-center">
        <span>将应用添加到主屏幕，体验更好</span>
        <button
          className="px-3 py-1 rounded bg-brand text-white"
          onClick={async () => { await deferredPrompt.prompt(); localStorage.setItem('a2hs_seen','1'); setOpen(false); }}
        >添加</button>
      </div>
    </div>
  );
}
```

---

## 4) 🧭 移动端专用路由 `/m/*`

### 4.1 路由组

```
src/app/
  (mobile)/
    m/
      layout.tsx       // 移动布局 + TabBar + 主题
      page.tsx         // /m 首页
      wardrobe/
      business/
  (desktop)/
    business/...
    wardrobe/...
```

### 4.2 设备检测与重定向（middleware.ts）

```ts
// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const MOBILE_RE = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.startsWith('/sw') || pathname.startsWith('/manifest'))
    return NextResponse.next();

  const pref = req.cookies.get('view')?.value; // 'mobile' | 'desktop'
  const uaIsMobile = MOBILE_RE.test(req.headers.get('user-agent') || '');
  const wantMobile = pref === 'mobile' || (!pref && uaIsMobile);

  // 桌面 -> /m
  if (wantMobile && !pathname.startsWith('/m')) {
    const url = req.nextUrl.clone();
    url.pathname = '/m' + (pathname === '/' ? '' : pathname);
    return NextResponse.redirect(url);
  }
  // 移动 -> 桌面
  if (!wantMobile && pathname.startsWith('/m')) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.replace(/^\/m/, '') || '/';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|sw|manifest|icons|offline).*)'],
};
```

### 4.3 移动与 PC 数据同步

* **同域 Cookie/JWT**；
* **React Query** 共用 key；
* **BroadcastChannel** 在多标签/端间（同设备）即时同步“轻状态”（如登录、主题、当前筛选）。

```ts
// src/lib/broadcast.ts
export const bc = new BroadcastChannel('ai-app');
export function syncLogin(token: string) { bc.postMessage({ type:'login', token }); }
bc.onmessage = (ev) => { if (ev.data.type==='login') localStorage.setItem('token', ev.data.token); };
```

---

## 5) 🔄 状态管理完整实现

> 原则：**客户端状态 = Redux/Zustand**；**服务端远程数据 = React Query**。
> Redux 只存**可审计/多模块共享/跨页面复杂状态**（B2B 工作流）；Zustand 存**简单 UI+本地优先**（衣橱）。

### 5.1 Redux Toolkit（商业版）

**目录**

```
src/stores/business/
  index.ts            // makeStore + Provider
  middleware.ts       // 错误/日志/鉴权
  slices/
    tasks.slice.ts
    images.slice.ts
    videos.slice.ts
    team.slice.ts
  selectors.ts
```

**store & middleware**

```ts
// src/stores/business/middleware.ts
import { Middleware } from '@reduxjs/toolkit';

export const errorMiddleware: Middleware = () => next => action => {
  const result = next(action);
  if (result?.error) {
    // 统一上报
    fetch('/api/rum/log', { method:'POST', body: JSON.stringify({ error: result.error }) });
  }
  return result;
};
```

```ts
// src/stores/business/index.ts
'use client';
import { configureStore } from '@reduxjs/toolkit';
import tasks from './slices/tasks.slice';
import images from './slices/images.slice';
import videos from './slices/videos.slice';
import team from './slices/team.slice';
import { errorMiddleware } from './middleware';

export function makeBusinessStore(preloadedState?: any) {
  return configureStore({
    reducer: { tasks, images, videos, team },
    preloadedState,
    middleware: (gDM) => gDM({ serializableCheck: false }).concat(errorMiddleware)
  });
}
export type BusinessStore = ReturnType<typeof makeBusinessStore>;
export type BusinessState = ReturnType<ReturnType<typeof makeBusinessStore>['getState']>;
export type BusinessDispatch = ReturnType<typeof makeBusinessStore>['dispatch'];
```

**任务 slice（含异步）**

```ts
// src/stores/business/slices/tasks.slice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { api } from '@/lib/api';

export interface Task { id: string; type: 'image'|'video'; status: 'PENDING'|'RUNNING'|'DONE'|'FAILED'; createdAt: string; }
interface State { list: Task[]; loading: boolean; selectedIds: string[]; }
const initialState: State = { list: [], loading: false, selectedIds: [] };

export const fetchTasks = createAsyncThunk('tasks/fetch', async (_, { rejectWithValue }) => {
  const r = await api.business.getTasks();
  if (!r.ok) return rejectWithValue(r.error);
  return r.data!;
});
export const createTask = createAsyncThunk('tasks/create', async (payload: any, { rejectWithValue }) => {
  const r = await api.business.createTask(payload);
  if (!r.ok) return rejectWithValue(r.error);
  return r.data!;
});

const slice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    toggleSelect(state, action: PayloadAction<string>) {
      const id = action.payload;
      state.selectedIds = state.selectedIds.includes(id)
        ? state.selectedIds.filter(x => x !== id)
        : [...state.selectedIds, id];
    }
  },
  extraReducers: (b) => {
    b.addCase(fetchTasks.pending, (s)=>{s.loading=true;});
    b.addCase(fetchTasks.fulfilled, (s,a)=>{s.loading=false; s.list=a.payload;});
    b.addCase(fetchTasks.rejected, (s)=>{s.loading=false;});
    b.addCase(createTask.fulfilled, (s,a)=>{ s.list.unshift(a.payload); });
  }
});

export const { toggleSelect } = slice.actions;
export default slice.reducer;
```

**与 App Router SSR 集成**

* 在 **Server Component** 预取必要数据（或直接交给 React Query 做服务端预取），将预取结果作为 `preloadedState` 注入 `BusinessProvider`（Client 组件）：

```tsx
// src/app/(desktop)/business/layout.tsx
import { makeBusinessStore } from '@/stores/business';
import { Providers } from './providers';

export default async function BusinessLayout({ children }: { children: React.ReactNode }) {
  // 可在此调用后端 API 预取数据，然后传给 store
  const preloadedState = { /* tasks: { list: [...] } */ };
  return (
    <html><body>
      <Providers preloadedState={preloadedState}>{children}</Providers>
    </body></html>
  );
}
```

```tsx
// src/app/(desktop)/business/providers.tsx
'use client';
import { Provider } from 'react-redux';
import { makeBusinessStore } from '@/stores/business';

export function Providers({ preloadedState, children }: any) {
  const store = makeBusinessStore(preloadedState);
  return <Provider store={store}>{children}</Provider>;
}
```

### 5.2 Zustand（衣橱）

**持久化 + immer + devtools + IndexedDB 存储**

```ts
// src/stores/wardrobe/index.ts
'use client';
import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import { produce } from 'immer';

// IndexedDB storage（idb-keyval 也可）
const idbStorage = {
  getItem: async (name: string) => localStorage.getItem(name) ?? null, // 简化：如需 IDB，请替换为 idb-keyval
  setItem: async (name: string, value: string) => localStorage.setItem(name, value),
  removeItem: async (name: string) => localStorage.removeItem(name)
};

type Clothes = { id: string; name: string; image: string; tags?: string[]; price?: number; wornCount?: number };
interface WardrobeState {
  items: Clothes[];
  outfits: string[][]; // 服装 id 组合
  filters: { tag?: string };
  addItem: (c: Clothes)=>void;
  setFilters: (p: Partial<WardrobeState['filters']>)=>void;
}

export const useWardrobeStore = create<WardrobeState>()(
  devtools(
    persist(
      (set) => ({
        items: [],
        outfits: [],
        filters: {},
        addItem: (c) => set(produce((s: WardrobeState) => { s.items.unshift(c); })),
        setFilters: (p) => set(produce((s: WardrobeState) => { Object.assign(s.filters, p); }))
      }),
      {
        name: 'wardrobe:v1',
        storage: createJSONStorage(() => idbStorage)
      }
    )
  )
);
```

**与 React Query 协同**

* 远程列表：`useQuery(['wardrobe','items'], fetch…)` → 成功后 `useWardrobeStore.getState().addItem` 批量替换或对比增量。
* 本地优先策略：先渲染 Zustand 中的 `items`，后台用 Query 刷新。

### 5.3 全局 vs 服务端状态划分

* **Redux/Zustand（客户端）**：UI 状态（选择/勾选/面板开关/拖拽中间态）、跨页面持久 UI（筛选器）、离线草稿、任务创建向导状态。
* **React Query（服务端）**：可缓存的服务端数据（任务列表、衣橱清单、社交流）。
* **协同策略**：Query 更新成功后只同步**摘要**到客户端状态（避免重复存储大列表）。

### 5.4 状态持久化与恢复

* **刷新恢复**：Redux （不建议全量持久化）→ 仅小范围（偏好、UI），Zustand → persist；Query → `persistQueryClient`（可选）+ IndexedDB。
* **多标签同步**：BroadcastChannel（上文示例）。
* **版本迁移**：Zustand `persist` 支持 `version` + `migrate`。

---

## 6) ⚡ 性能优化详细方案

### 6.1 首屏优化

**骨架屏组件**

```tsx
// src/components/mobile/Skeleton/ListCard.tsx
export function ListCardSkeleton() {
  return (
    <div className="animate-pulse p-3 flex gap-3">
      <div className="w-16 h-16 bg-gray-200 dark:bg-neutral-700 rounded" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 dark:bg-neutral-700 rounded w-1/2" />
        <div className="h-3 bg-gray-200 dark:bg-neutral-700 rounded w-1/3" />
      </div>
    </div>
  );
}
```

**关键 CSS 变量内联（Server Component）**

```tsx
// src/app/(mobile)/m/layout.tsx
export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return (
    <html data-theme="male">
      <head>
        <style
          dangerouslySetInnerHTML={{ __html: `
            :root{--color-bg:#fff;--color-brand:#1890FF;--radius:8px}
          `}}
        />
        <link rel="preconnect" href="https://static.myqcloud.com" />
      </head>
      <body className="bg-[var(--color-bg)]">{children}</body>
    </html>
  );
}
```

**字体优化**

```ts
// src/app/fonts.ts
import { Inter } from 'next/font/google';
export const inter = Inter({ subsets: ['latin'], display: 'swap' });
```

**图片（WebP/AVIF + 响应式）**

```tsx
import Image from 'next/image';
<Image src={src} alt={alt} width={600} height={400} sizes="(max-width:768px) 100vw, 600px" priority />
```

### 6.2 代码分割

**路由级（移动 Tab 子页面按需加载）**

```tsx
// src/app/(mobile)/m/wardrobe/page.tsx
import dynamic from 'next/dynamic';
const WardrobeHome = dynamic(() => import('@/modules/wardrobe/mobile/Home'), { ssr: true, loading: () => <div /> });
export default function Page(){ return <WardrobeHome/>; }
```

**组件级（重组件延迟）**

```ts
const RichOutfitCard = dynamic(() => import('@/components/wardrobe/mobile/RichOutfitCard'), { ssr: false });
```

**第三方库拆分 & 替换**

* `next.config.js` 使用 `modularizeImports`（lodash/dayjs）

```js
// next.config.js
module.exports = {
  experimental: { optimizePackageImports: ['antd'] },
  modularizeImports: {
    'lodash': { transform: 'lodash/{{member}}' },
    'date-fns': { transform: 'date-fns/{{member}}' }
  }
}
```

### 6.3 运行时性能

* **React.memo**：列表行/卡片；**useMemo/useCallback**：传递到子组件的函数与昂贵计算结果。
* **虚拟滚动**：见 2.1。
* **Web Worker**：将大计算（颜色分析/统计）放 worker，用 `comlink`。

**Worker 示例**

```ts
// src/workers/palette.worker.ts
export function extractPalette(pixels: Uint8ClampedArray) {
  // 简化：返回伪调色
  return ['#333','#999','#fff'];
}
```

```ts
// src/lib/worker.ts
export async function paletteFromImage(img: HTMLImageElement) {
  const off = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
  const ctx = off.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0,0,img.naturalWidth,img.naturalHeight).data;
  const { extractPalette } = await import('../workers/palette.worker');
  return extractPalette(data);
}
```

---

## 7) 📊 监控与分析

**Web Vitals**

```ts
// src/reportWebVitals.ts
export function reportWebVitals(metric: any) {
  navigator.sendBeacon('/api/metrics', JSON.stringify(metric));
}
```

**错误监控（自建）**

```ts
// src/lib/error-capture.ts
export function installErrorCapture() {
  window.addEventListener('error', (e) => navigator.sendBeacon('/api/rum/log', JSON.stringify({ type:'error', msg: e.message, stack: e.error?.stack })));
  window.addEventListener('unhandledrejection', (e:any) => navigator.sendBeacon('/api/rum/log', JSON.stringify({ type:'promise', reason: String(e.reason)})));
}
```

**用户行为（埋点）**

```ts
export function track(event: string, props?: Record<string, any>) {
  navigator.sendBeacon('/api/rum/track', JSON.stringify({ event, props, t: Date.now() }));
}
```

---

## 8) 🧪 测试方案

### 8.1 单元测试（Jest + RTL）

**jest.config.ts**

```ts
import nextJest from 'next/jest';
const createJestConfig = nextJest({ dir: './' });
const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/index.{ts,tsx}']
};
export default createJestConfig(config);
```

**jest.setup.ts**

```ts
import '@testing-library/jest-dom';
```

**组件测试**

```tsx
// src/components/mobile/ProgressiveImage/index.test.tsx
import { render, screen } from '@testing-library/react';
import ProgressiveImage from './index';

test('renders image with placeholder', () => {
  render(<ProgressiveImage src="/img.jpg" alt="img" width={100} height={80} />);
  expect(screen.getByAltText('img')).toBeInTheDocument();
});
```

**Hook 测试**

```tsx
// src/components/mobile/Gesture/usePressAndDoubleTap.test.tsx
import { renderHook, act } from '@testing-library/react';
import { usePressAndDoubleTap } from './usePressAndDoubleTap';

jest.useFakeTimers();
test('double tap triggers', () => {
  const dbl = jest.fn(); const long = jest.fn();
  const { result } = renderHook(()=>usePressAndDoubleTap(long,dbl,{doubleTapMs:300}));
  act(()=> { result.current.onPointerDown(); result.current.onPointerUp(); });
  act(()=> { jest.advanceTimersByTime(100); result.current.onPointerDown(); result.current.onPointerUp(); });
  expect(dbl).toHaveBeenCalled();
});
```

> 覆盖率目标：**行/语句/分支/函数 ≥ 80%**；CI 中收敛阈值。

### 8.2 E2E（Playwright）

**playwright.config.ts**

```ts
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  timeout: 60000,
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  projects: [
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } }
  ]
});
```

**关键流程（移动）**

```ts
// tests/e2e/mobile-wardrobe.spec.ts
import { test, expect } from '@playwright/test';
test('add clothes and see in list', async ({ page }) => {
  await page.goto('/m/wardrobe/wardrobe');
  await page.getByRole('button', { name: '添加衣物' }).click();
  await page.setInputFiles('input[type=file]', 'tests/fixtures/tee.jpg');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('T恤')).toBeVisible();
});
```

**可视化回归**

```ts
await expect(page).toHaveScreenshot('wardrobe-home.png', { maxDiffPixels: 200 });
```

### 8.3 集成测试（MSW）

**handlers**

```ts
// tests/msw/handlers.ts
import { http, HttpResponse } from 'msw';
export const handlers = [
  http.get('/api/business/tasks', () => HttpResponse.json([{ id:'t1', type:'image', status:'DONE', createdAt: new Date().toISOString() }]))
];
```

**setup**

```ts
// tests/msw/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';
export const server = setupServer(...handlers);
// jest.setup.ts
import { server } from './tests/msw/server';
beforeAll(()=>server.listen());
afterEach(()=>server.resetHandlers());
afterAll(()=>server.close());
```

---

# ✅ 你能直接落地的 Checklist

* [ ] 建立 `(mobile)/m` 路由组 + `middleware.ts` 自动重定向
* [ ] 引入 `@use-gesture/react`、`framer-motion`、`@tanstack/react-virtual`
* [ ] 实装 `ProgressiveImage`、`VirtualList`、`MobileTabBar`、`SwipeableClothesList`
* [ ] 配置 **Workbox** `scripts/build-sw.mjs` + `offline.html` + BackgroundSync
* [ ] 集成 **Web Push**（Express + VAPID + SW push handler）
* [ ] 建 Redux Toolkit（B2B）slices + Provider；Zustand（衣橱）store
* [ ] React Query 统一请求层、ETag、缓存时间与预取
* [ ] 首屏优化：骨架屏、关键 CSS 变量内联、字体 `display: swap`、动态 import
* [ ] 监控：Web Vitals 上报、自建错误采集
* [ ] 测试：Jest + RTL + MSW 单元/集成；Playwright E2E（移动设备配置）

> 如需，我可以把上面代码**拼成一个最小可运行模板**（App Router 项目 + `(mobile)` 路由 + PWA + SW + 状态管理 + 组件例子），你们直接对接后端即可进入页面填充阶段。
