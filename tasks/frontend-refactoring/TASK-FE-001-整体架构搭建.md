# TASK-FE-001：Next.js前端整体架构搭建

## 📋 任务元信息

| 属性 | 值 |
|------|-----|
| **任务ID** | TASK-FE-001 |
| **任务类型** | Frontend Architecture |
| **优先级** | P0 - 紧急重要 |
| **预计工时** | 3-5天 |
| **依赖任务** | 无（基础任务） |
| **负责Skill** | frontend-dev |
| **关联文档** | `docs/GPT5问题-前端架构设计.md` |

---

## 🎯 任务目标

重构当前混乱的前端代码，建立清晰的目录结构和分层架构，解决以下痛点：
- ✅ 代码重复严重（功能配置、布局、表单到处复制粘贴）
- ✅ 组件职责不清（页面组件包含太多业务逻辑）
- ✅ 状态管理混乱（全局状态和组件状态划分不合理）
- ✅ 路由权限控制散落各处
- ✅ 类型定义不规范

---

## 📦 核心交付物

### 1. 完整的目录结构（FSD架构）

```
frontend/src/
├── app/                          # Next.js App Router页面
│   ├── (auth)/                   # 认证相关路由组
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/              # 需要登录的路由组
│   │   ├── workspace/            # 工作台
│   │   ├── membership/           # 会员套餐
│   │   ├── distribution/         # 分销中心
│   │   └── admin/                # 管理后台
│   ├── layout.tsx
│   ├── page.tsx
│   └── middleware.ts             # 路由守卫
├── features/                     # 业务特性模块（FSD）
│   ├── auth/
│   │   ├── ui/                   # 登录表单、注册表单
│   │   ├── api/                  # 登录API、注册API
│   │   ├── model/                # 用户状态管理
│   │   └── types/                # 类型定义
│   ├── workspace/
│   │   ├── ui/                   # FeatureCard、FeatureGrid
│   │   ├── api/                  # 功能列表API
│   │   ├── model/                # 功能配置状态
│   │   └── types/
│   ├── membership/
│   ├── distribution/
│   └── admin/
├── entities/                     # 业务实体（FSD）
│   ├── user/
│   │   ├── ui/                   # UserAvatar、UserInfo
│   │   ├── api/
│   │   ├── model/
│   │   └── types/
│   ├── feature/                  # AI功能实体
│   ├── quota/                    # 配额实体
│   └── order/                    # 订单实体
├── shared/                       # 共享资源（FSD）
│   ├── ui/                       # 通用UI组件
│   │   ├── Button/
│   │   ├── Card/
│   │   ├── Form/
│   │   ├── Table/
│   │   └── Modal/
│   ├── api/                      # axios封装、拦截器
│   │   ├── client.ts             # axios实例
│   │   ├── interceptors.ts       # 请求/响应拦截器
│   │   └── types.ts              # API类型
│   ├── hooks/                    # 通用Hooks
│   │   ├── useRequest.ts         # API请求Hook
│   │   ├── usePagination.ts      # 分页Hook
│   │   └── usePermission.ts      # 权限Hook
│   ├── utils/                    # 工具函数
│   ├── constants/                # 常量定义
│   └── types/                    # 全局类型
├── widgets/                      # 复合组件（FSD）
│   ├── Header/
│   ├── Sidebar/
│   └── Footer/
└── styles/                       # 样式文件
    ├── globals.css
    └── theme.ts                  # Ant Design主题配置
```

### 2. TypeScript严格类型系统

**`shared/types/global.d.ts`**
```typescript
// 全局类型定义
declare namespace App {
  // 用户相关
  interface User {
    id: number;
    username: string;
    email: string;
    role: 'user' | 'distributor' | 'admin';
    quota_balance: number;
    created_at: string;
  }

  // 功能定义
  interface Feature {
    feature_id: string;
    name: string;
    description: string;
    icon: string;  // Ant Design图标名称
    category: string;
    quota_cost: number;
    status: 'active' | 'inactive';
  }

  // API响应基础结构
  interface ApiResponse<T = any> {
    success: boolean;
    data: T;
    message?: string;
    error_code?: string;
  }

  // 分页响应
  interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    page_size: number;
  }
}
```

### 3. 状态管理方案（Zustand）

**`features/auth/model/useAuthStore.ts`**
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: App.User | null;
  token: string | null;
  isAuthenticated: boolean;

  // Actions
  setUser: (user: App.User) => void;
  setToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: true }),
      setToken: (token) => set({ token }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage', // localStorage key
    }
  )
);
```

**`features/workspace/model/useFeatureStore.ts`**
```typescript
import { create } from 'zustand';

interface FeatureState {
  features: App.Feature[];
  selectedCategory: string | null;

  // Actions
  setFeatures: (features: App.Feature[]) => void;
  setCategory: (category: string | null) => void;
}

export const useFeatureStore = create<FeatureState>((set) => ({
  features: [],
  selectedCategory: null,

  setFeatures: (features) => set({ features }),
  setCategory: (category) => set({ selectedCategory: category }),
}));
```

### 4. 样式与设计系统

**`styles/theme.ts`** - Ant Design主题配置
```typescript
import type { ThemeConfig } from 'antd';

export const theme: ThemeConfig = {
  token: {
    colorPrimary: '#5B61ED',      // GPT5建议的主色
    colorSuccess: '#12B8A5',      // 辅助色
    colorWarning: '#FF6B4A',      // 强调色
    borderRadius: 8,
    fontSize: 14,
  },
  components: {
    Button: {
      borderRadius: 6,
    },
    Card: {
      borderRadiusLG: 12,
    },
  },
};
```

**`app/layout.tsx`** - 全局主题提供者
```typescript
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider } from 'antd';
import { theme } from '@/styles/theme';
import '@/styles/globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdRegistry>
          <ConfigProvider theme={theme}>
            {children}
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
```

---

## ✅ 验收标准

### 功能验收
- [ ] 新的目录结构已创建，所有文件夹存在
- [ ] `shared/types/global.d.ts` 包含所有核心类型定义
- [ ] `useAuthStore` 和 `useFeatureStore` 已实现且可导入
- [ ] Ant Design主题配置生效（主色为#5B61ED）
- [ ] TypeScript严格模式无报错

### 代码质量
- [ ] 所有`.ts/.tsx`文件通过ESLint检查
- [ ] 所有导出的函数/组件都有TypeScript类型标注
- [ ] 目录结构符合FSD（Feature-Sliced Design）原则

### 文档要求
- [ ] 每个`features/`子目录都有`README.md`说明模块职责
- [ ] `shared/ui/README.md`列出所有通用组件及使用示例

---

## 🔧 技术要求

### 强制要求
- ✅ 使用Next.js 14 App Router（不使用Pages Router）
- ✅ 使用TypeScript严格模式（`"strict": true`）
- ✅ 使用Ant Design 5组件库
- ✅ 状态管理使用Zustand（不使用Redux/MobX）
- ✅ 遵循FSD（Feature-Sliced Design）架构模式

### 推荐方案
- 🎯 使用TanStack Query（React Query）管理服务端状态
- 🎯 使用`clsx`或`classnames`管理CSS类名
- 🎯 使用`dayjs`处理日期时间（Ant Design内置）

---

## 📚 参考资料

1. **FSD架构文档**：https://feature-sliced.design/
2. **Next.js 14 App Router**：https://nextjs.org/docs/app
3. **Zustand文档**：https://github.com/pmndrs/zustand
4. **Ant Design 5主题配置**：https://ant.design/docs/react/customize-theme

---

## 🚨 注意事项

1. **不要一次性重构所有文件**：
   - 先创建新的目录结构
   - 保留旧代码，逐步迁移
   - 每迁移一个模块，就删除对应的旧代码

2. **类型定义优先**：
   - 先定义好`global.d.ts`中的所有类型
   - 再开始写组件代码
   - 这样可以避免后期大量类型修改

3. **Git提交策略**：
   - 每完成一个子任务就提交一次
   - Commit message格式：`feat(frontend): 完成目录结构搭建`

---

## 💡 实施步骤建议

### Step 1：创建目录结构（1小时）
```bash
mkdir -p frontend/src/{features,entities,shared,widgets}
mkdir -p frontend/src/shared/{ui,api,hooks,utils,constants,types}
mkdir -p frontend/src/features/{auth,workspace,membership,distribution,admin}
```

### Step 2：配置TypeScript（30分钟）
- 创建`shared/types/global.d.ts`
- 更新`tsconfig.json`的`strict`选项

### Step 3：搭建状态管理（1小时）
- 安装Zustand：`npm install zustand`
- 实现`useAuthStore`和`useFeatureStore`

### Step 4：配置主题系统（1小时）
- 创建`styles/theme.ts`
- 更新`app/layout.tsx`应用主题

### Step 5：验证与测试（1小时）
- 运行`npm run build`确保无TypeScript错误
- 运行`npm run dev`确保应用正常启动
- 检查主题颜色是否生效

---

**艹！这个任务是整个重构的基石，必须搞扎实了！** 🔥
