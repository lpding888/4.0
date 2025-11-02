# 📱 移动端架构项目 - 完整产品规划

> **生成时间：** 2025-11-01
> **Product Planner：** AI老王
> **项目价值：** ¥1,050,000+

---

## 1️⃣ 背景与目标

### 项目定位
基于GPT-5 Pro提供的移动端架构方案，实现三平台移动端应用：
- **P0：** 微信小程序（Taro + React）- 3个月
- **P1：** React Native App（iOS + Android）- 4个月
- **P2：** PWA优化（Next.js + Workbox）- 延后

### 核心目标
1. 实现配置驱动的移动端架构
2. 三端代码复用率达到60-70%
3. 支持动态配置、热更新、离线缓存
4. 建立完善的测试与监控体系

### KPI指标
- 小程序首屏加载 < 2s
- 包体积：主包 < 700KB，总包 < 20MB
- 单元测试覆盖率 ≥ 70%
- E2E测试覆盖核心流程
- API响应时间 P95 < 200ms

---

## 2️⃣ 用户画像与关键场景

### 用户群体
1. **商业版用户（B2B）**
   - 服装电商运营人员
   - 设计师、摄影师
   - 需求：批量生成商品图/视频

2. **个人用户（男性）**
   - 25-40岁职场男性
   - 注重效率与实用性
   - 需求：智能穿搭建议、衣橱管理

3. **个人用户（女性）**
   - 20-35岁时尚女性
   - 注重美感与社交
   - 需求：穿搭灵感、社区分享

### 核心场景

**场景1：商业版用户批量生成图片**
```
用户打开小程序
→ 登录商业版
→ 上传模特图+服装图
→ 选择场景（户外/室内）
→ 提交任务
→ 轮询查看进度
→ 下载生成结果
```

**场景2：男性用户获取穿搭建议**
```
用户打开小程序
→ 登录衣橱男版
→ 拍照上传衣服
→ AI自动分类打标签
→ 查看今日穿搭推荐
→ 一键生成搭配方案
```

**场景3：女性用户分享穿搭**
```
用户打开小程序
→ 登录衣橱女版
→ 记录今日穿搭
→ 添加心情与场合标签
→ 分享到社区
→ 获得点赞评论
```

**场景4：后台动态配置功能**
```
管理员打开CMS后台
→ 新增"AI风格转换"功能
→ 配置菜单、路由、权限
→ 发布配置
→ 小程序30秒内自动更新菜单
```

---

## 3️⃣ 范围与优先级

### P0任务（核心MVP，3个月）

#### 共享层基础
- [ ] 配置数据结构定义（TypeScript接口）
- [ ] 配置解析器（parse + validate）
- [ ] 组件注册表机制
- [ ] 主题Tokens系统
- [ ] API客户端封装

#### 小程序基础架构
- [ ] Taro项目脚手架
- [ ] 分包策略配置（主包 + business + wardrobe）
- [ ] 动态渲染器（NodeRenderer）
- [ ] 配置热更新（30秒轮询 + ETag）
- [ ] 自定义TabBar（动态菜单）
- [ ] 主题系统（CSS变量注入）

#### 衣橱功能（男/女版）
- [ ] 衣橱列表（虚拟滚动）
- [ ] 相机上传 + COS集成
- [ ] 衣服详情页
- [ ] 搭配推荐页
- [ ] AI分析结果展示
- [ ] 社交分享功能

#### 商业版功能（简化）
- [ ] 工作台（任务列表）
- [ ] 任务发起（简化版表单）
- [ ] 任务状态轮询
- [ ] 配额显示
- [ ] 结果下载

#### PWA基础
- [ ] Service Worker配置（Workbox）
- [ ] manifest.json
- [ ] 离线页面（offline.html）
- [ ] A2HS引导

### P1任务（重要功能，1个月）

#### React Native架构
- [ ] RN脚手架搭建
- [ ] 复用配置驱动runtime
- [ ] React Navigation动态Tab
- [ ] CodePush配置

#### 原生能力集成
- [ ] 相机集成（react-native-vision-camera）
- [ ] 推送集成（APNs/FCM）
- [ ] 分享功能（react-native-share）
- [ ] 支付集成（微信/支付宝）

#### 性能优化
- [ ] 虚拟滚动优化
- [ ] 图片懒加载优化
- [ ] 代码分割优化
- [ ] 首屏性能优化

### P2任务（优化项，延后）

#### CMS功能增强
- [ ] Feature创建向导（React Flow）
- [ ] 模板编辑器（Monaco）
- [ ] 可视化配置界面

#### 高级功能
- [ ] Web Push（自建VAPID）
- [ ] Background Sync
- [ ] 数据分析埋点
- [ ] 性能监控（Web Vitals）

---

## 4️⃣ 技术选型

### 自研部分（核心差异化）
- ✅ **配置驱动runtime**：配置解析、组件注册、动态渲染
- ✅ **组件注册表机制**：白名单 + 动态import
- ✅ **动态路由系统**：基于配置生成路由
- ✅ **主题系统**：CSS变量 + 三种模式主题
- ✅ **状态管理**：Redux Toolkit（商业）+ Zustand（衣橱）

### 第三方依赖（成熟方案）
- **小程序：** Taro、cos-wx-sdk-v5
- **RN：** React Native、React Navigation、CodePush、MMKV
- **PWA：** Workbox、web-push
- **UI：** @use-gesture/react、framer-motion、@tanstack/react-virtual
- **测试：** Jest、Playwright、MSW
- **状态管理：** @reduxjs/toolkit、zustand、@tanstack/react-query

### 混合方案
- 自研配置解析 + Taro编译优化
- 自研路由生成 + React Navigation
- 自研主题系统 + Ant Design组件

### 成本考量
- Taro：免费开源
- React Native：免费开源
- CodePush：免费（微软提供）
- Workbox：免费开源
- Tencent COS：按量计费（已有）
- **总增量成本：** ¥0（全部开源方案）

---

## 5️⃣ 架构与契约

### 目录结构
```
packages/
├── shared-config/              # 配置解析、类型定义
│   ├── src/
│   │   ├── types/
│   │   │   ├── config.ts      # MiniAppConfig等类型定义
│   │   │   ├── theme.ts       # ThemeConfig类型
│   │   │   └── navigation.ts  # NavigationConfig类型
│   │   ├── parser/
│   │   │   ├── index.ts       # 配置解析器
│   │   │   └── validator.ts   # 配置校验
│   │   └── index.ts
│   └── package.json
│
├── shared-components/          # 抽象层组件
│   ├── src/
│   │   ├── registry.ts        # 组件注册表
│   │   ├── renderer.tsx       # 动态渲染器
│   │   ├── common/            # 通用组件
│   │   ├── business/          # 商业版组件
│   │   └── wardrobe/          # 衣橱组件
│   └── package.json
│
├── shared-utils/               # 工具函数
│   ├── src/
│   │   ├── api/               # API客户端
│   │   ├── storage/           # 存储封装
│   │   ├── crypto/            # 加密工具
│   │   └── validators/        # 校验工具
│   └── package.json
│
├── shared-theme/               # 主题系统
│   ├── src/
│   │   ├── tokens/            # Design Tokens
│   │   ├── business.ts        # 商业版主题
│   │   ├── wardrobe-male.ts   # 男性版主题
│   │   └── wardrobe-female.ts # 女性版主题
│   └── package.json
│
├── miniprogram/                # Taro小程序
│   ├── src/
│   │   ├── app.config.ts
│   │   ├── app.tsx
│   │   ├── pages/
│   │   ├── business/          # 商业版分包
│   │   ├── wardrobe/          # 衣橱分包
│   │   ├── custom-tab-bar/
│   │   ├── runtime/           # 配置驱动runtime
│   │   ├── services/
│   │   └── store/
│   └── package.json
│
├── rn-app/                     # React Native App
│   ├── src/
│   │   ├── config/
│   │   ├── navigation/
│   │   ├── screens/
│   │   ├── components/
│   │   └── services/
│   └── package.json
│
└── pwa/                        # Next.js PWA（已有）
    ├── src/
    └── package.json
```

### API契约

#### 1. 配置获取接口
```typescript
GET /api/mobile/config?platform=wx|rn|web&mode=business|wardrobe-male|wardrobe-female

Response: {
  version: string;          // '2025.11.01-001'
  etag: string;             // W/"hash"
  mode: 'business' | 'wardrobe-male' | 'wardrobe-female';
  theme: ThemeConfig;
  tabBar: TabBarItem[];
  pages: PageConfig[];
  permissions: PermissionConfig;
}
```

#### 2. 版本检测接口
```typescript
GET /api/mobile/version?platform=wx|rn|web&mode=xxx

Response: {
  version: string;
  etag: string;
}
```

#### 3. COS临时密钥接口
```typescript
GET /api/cos/sts

Response: {
  tmpSecretId: string;
  tmpSecretKey: string;
  sessionToken: string;
  startTime: number;
  expiredTime: number;
}
```

### 事件契约
- `CONFIG_UPDATED`：配置更新事件（后端推送）
- `TASK_STATUS_CHANGED`：任务状态变更（BullMQ事件）
- `UPLOAD_PROGRESS`：上传进度更新

---

## 6️⃣ 数据与权限

### 核心数据结构

```typescript
// 应用配置
interface MiniAppConfig {
  version: string;
  etag: string;
  mode: 'business' | 'wardrobe-male' | 'wardrobe-female';
  theme: ThemeConfig;
  tabBar: TabBarItem[];
  pages: PageConfig[];
  permissions: PermissionConfig;
}

// 主题配置
interface ThemeConfig {
  name: string;
  cssVars: Record<string, string>;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
  };
}

// TabBar项
interface TabBarItem {
  key: string;
  text: string;
  icon: string;
  path: string;
  requiredPermission?: string;
  enabled: boolean;
}

// 页面配置
interface PageConfig {
  path: string;
  title: string;
  layout: 'default' | 'mobile-tabs';
  nodes: ComponentNode[];
  enabled: boolean;
  requiredPermission?: string;
}

// 组件节点
interface ComponentNode {
  key: string;                    // 注册表中的组件key
  props?: Record<string, any>;
  children?: ComponentNode[];
  region?: 'header' | 'content' | 'footer';
  requiredPermission?: string;
}

// 权限配置
interface PermissionConfig {
  roles: string[];
  rolePermissions: Record<string, string[]>;
}
```

### 权限模型
- **角色：** Admin、Business、Wardrobe-Male、Wardrobe-Female
- **权限：** task:create、wardrobe:upload、social:post、billing:view

### 数据流
```
后端发布配置
→ 写入 ui_releases 表
→ 更新 Redis 缓存
→ 小程序轮询检测版本
→ ETag不匹配则拉取新配置
→ 本地存储 + 重新渲染
```

---

## 7️⃣ 风险与应对

| 风险 | 影响等级 | 概率 | 应对策略 |
|------|---------|------|----------|
| 小程序包体积超限（2MB主包/20MB总包） | 高 | 中 | 严格分包、图片CDN、原生组件增强、定期检查 |
| Taro编译问题导致功能异常 | 高 | 低 | 建立原生fallback方案、关键页面用原生组件 |
| RN环境配置复杂延误进度 | 中 | 中 | 提前准备iOS/Android环境、使用Docker标准化 |
| 配置驱动复杂度导致维护困难 | 中 | 中 | 完善文档、建立组件白名单审核机制 |
| 三端一致性问题影响用户体验 | 中 | 高 | 建立共享测试用例、统一设计规范、定期回归 |
| 热更新机制失效 | 中 | 低 | 降级为手动刷新、监控ETag命中率 |
| 小程序审核不通过 | 高 | 中 | 提前准备审核资料、严格遵守平台规范 |
| 性能不达标（首屏>2s） | 中 | 中 | 骨架屏、SSR、代码分割、性能监控 |

---

## 8️⃣ 任务卡清单

### 任务卡统计
- **Phase 1（基础架构）：** 14个任务卡（可并发）
- **Phase 2（业务功能）：** 18个任务卡（可并发）
- **Phase 3（RN App）：** 9个任务卡（部分依赖）
- **Phase 4（测试优化）：** 10个任务卡（可并发）
- **总计：** 51个任务卡

### 任务卡分布
- **Frontend（共享层）：** 8个任务卡
- **Frontend（小程序）：** 22个任务卡
- **Frontend（RN App）：** 11个任务卡
- **Frontend（PWA）：** 4个任务卡
- **QA：** 6个任务卡

### 详细任务卡
详见 `tasks/*.json` 文件

---

## 9️⃣ 时间线与里程碑

### Week 1-2：基础架构搭建【并发执行】
**里程碑：** 小程序可运行、配置驱动可演示

**可并发任务组：**
- **组A：共享层（5个任务）**
  - MOBILE-SHARED-001: 配置数据结构定义
  - MOBILE-SHARED-002: 配置解析器实现
  - MOBILE-SHARED-003: 组件注册表机制
  - MOBILE-SHARED-004: 主题Tokens系统
  - MOBILE-SHARED-005: API客户端封装

- **组B：小程序基础（6个任务）**
  - MOBILE-MP-001: Taro脚手架搭建
  - MOBILE-MP-002: 分包策略配置
  - MOBILE-MP-003: 动态渲染器实现
  - MOBILE-MP-004: 配置热更新机制
  - MOBILE-MP-005: 自定义TabBar
  - MOBILE-MP-006: 主题系统集成

- **组C：PWA基础（3个任务）**
  - MOBILE-PWA-001: Service Worker配置
  - MOBILE-PWA-002: manifest.json
  - MOBILE-PWA-003: 离线页面

### Week 3-4：衣橱功能开发【并发执行】
**里程碑：** 衣橱核心流程可演示

**可并发任务组：**
- **组D：衣橱列表（4个任务）**
  - MOBILE-MP-007: 虚拟滚动列表
  - MOBILE-MP-008: 衣服卡片组件
  - MOBILE-MP-009: 筛选排序功能
  - MOBILE-MP-010: 左滑删除手势

- **组E：上传功能（4个任务）**
  - MOBILE-MP-011: 相机组件集成
  - MOBILE-MP-012: COS上传封装
  - MOBILE-MP-013: 图片裁剪压缩
  - MOBILE-MP-014: 上传进度显示

### Week 5-6：商业功能开发【并发执行】
**里程碑：** 商业版核心流程可演示

**可并发任务组：**
- **组F：工作台（3个任务）**
  - MOBILE-MP-015: 任务列表组件
  - MOBILE-MP-016: 任务卡片组件
  - MOBILE-MP-017: 任务筛选功能

- **组G：任务流程（3个任务）**
  - MOBILE-MP-018: 任务发起表单
  - MOBILE-MP-019: 任务状态轮询
  - MOBILE-MP-020: 结果预览下载

### Week 7-8：小程序优化测试【并发执行】
**里程碑：** 小程序可提审

**可并发任务组：**
- **组H：性能优化（4个任务）**
  - MOBILE-MP-021: 包体积优化
  - MOBILE-MP-022: 首屏性能优化
  - MOBILE-MP-023: 图片懒加载
  - MOBILE-MP-024: 代码分割优化

- **组I：测试（3个任务）**
  - MOBILE-QA-001: 单元测试（覆盖率≥70%）
  - MOBILE-QA-002: E2E测试（核心流程）
  - MOBILE-QA-003: 性能测试（首屏<2s）

### Week 9-10：RN架构搭建【并发执行】
**里程碑：** RN App可运行

**可并发任务组：**
- **组J：RN基础（5个任务）**
  - MOBILE-RN-001: RN脚手架搭建
  - MOBILE-RN-002: 复用配置驱动runtime
  - MOBILE-RN-003: React Navigation集成
  - MOBILE-RN-004: CodePush配置
  - MOBILE-RN-005: MMKV持久化

### Week 11-12：RN功能复刻【并发执行】
**里程碑：** RN功能对齐小程序

**可并发任务组：**
- **组K：RN功能（4个任务）**
  - MOBILE-RN-006: 衣橱功能复刻
  - MOBILE-RN-007: 商业功能复刻
  - MOBILE-RN-008: 导航与TabBar
  - MOBILE-RN-009: 状态管理集成

### Week 13-14：原生能力集成【部分依赖】
**里程碑：** 原生功能可用

**顺序依赖任务：**
- MOBILE-RN-010: 相机集成（独立）
- MOBILE-RN-011: 推送集成（独立）
- MOBILE-RN-012: 分享功能（独立）
- MOBILE-RN-013: 支付集成（依赖后端接口）

### Week 15-16：RN打包上架【顺序执行】
**里程碑：** RN App上架

**顺序依赖任务：**
1. MOBILE-RN-014: iOS打包配置
2. MOBILE-RN-015: Android打包配置
3. MOBILE-RN-016: App Store上架
4. MOBILE-RN-017: Google Play上架

### Week 17-18：全平台测试优化【并发执行】
**里程碑：** 项目交付

**可并发任务组：**
- **组L：测试（3个任务）**
  - MOBILE-QA-004: 三端一致性测试
  - MOBILE-QA-005: 性能回归测试
  - MOBILE-QA-006: 安全审计

- **组M：优化（2个任务）**
  - MOBILE-OPT-001: 监控埋点集成
  - MOBILE-OPT-002: 性能报告生成

---

## 🔟 验收与交付

### 小程序演示路径

**路径1：衣橱功能（男性版）**
```
1. 打开小程序
2. 选择"衣橱男版"模式
3. 点击"添加衣物"
4. 拍照上传T恤
5. AI自动分类为"上装-T恤"
6. 查看"今日穿搭推荐"
7. 选择推荐的搭配方案
8. 分享到社区
```

**路径2：商业功能**
```
1. 打开小程序
2. 选择"商业版"模式
3. 进入"工作台"
4. 点击"新建任务"
5. 上传模特图+服装图
6. 选择场景"户外-街道"
7. 提交任务
8. 查看任务进度（轮询刷新）
9. 任务完成后下载结果
```

**路径3：配置热更新**
```
1. 管理员打开CMS后台
2. 新增功能"AI风格转换"
3. 配置菜单、图标、路由
4. 发布配置（version递增、etag更新）
5. 小程序30秒内检测到新版本
6. 自动拉取新配置
7. TabBar自动显示新菜单项
```

### RN App演示路径

**路径1：基础功能**
```
1. 打开App
2. 登录并选择模式
3. 验证功能与小程序一致
4. 测试CodePush热更新
```

**路径2：原生能力**
```
1. 测试相机拍照
2. 测试推送通知
3. 测试分享功能
4. 测试支付流程
```

### 质量门禁标准

#### 代码质量
- ✅ 单元测试覆盖率 ≥ 70%
- ✅ E2E测试覆盖核心流程
- ✅ TypeScript类型检查无错误
- ✅ ESLint检查无error级别问题
- ✅ 代码审查通过（Reviewer）

#### 性能指标
- ✅ 小程序首屏加载 < 2s
- ✅ 小程序主包 < 700KB
- ✅ 小程序总包 < 20MB
- ✅ API响应时间 P95 < 200ms
- ✅ 虚拟滚动列表流畅（60fps）

#### 功能完整性
- ✅ 配置驱动可正常工作
- ✅ 热更新机制可用
- ✅ 三种模式主题正确
- ✅ 权限控制正确
- ✅ 离线缓存可用

#### 审核准备
- ✅ 隐私协议完整
- ✅ 用户协议完整
- ✅ 业务资质齐全
- ✅ 审核截图准备
- ✅ 测试账号提供

### 交付物清单

#### 代码交付
- ✅ `packages/shared-*` 共享包源码
- ✅ `packages/miniprogram` 小程序源码
- ✅ `packages/rn-app` RN App源码
- ✅ `packages/pwa` PWA源码（已有）

#### 文档交付
- ✅ 产品规划文档（本文档）
- ✅ 技术架构文档
- ✅ API接口文档
- ✅ 部署运维文档
- ✅ 用户使用手册

#### 测试交付
- ✅ 单元测试报告（覆盖率报告）
- ✅ E2E测试报告
- ✅ 性能测试报告
- ✅ 安全审计报告

#### 运维交付
- ✅ 小程序审核资料包
- ✅ RN App打包配置
- ✅ CodePush配置文档
- ✅ 监控埋点配置

---

## 附录A：技术债务记录

无（新项目）

---

## 附录B：后续优化方向

### P1优化（3个月内）
- [ ] Web Push完整实现
- [ ] Background Sync优化
- [ ] CMS功能增强（Feature向导 + 模板编辑器）
- [ ] 性能监控完善

### P2优化（6个月内）
- [ ] 多语言支持（i18n）
- [ ] 暗黑模式优化
- [ ] 无障碍支持（Accessibility）
- [ ] 服务端渲染优化（SSR）

---

**文档版本：** v1.0
**最后更新：** 2025-11-01
**负责人：** AI老王（Product Planner）
