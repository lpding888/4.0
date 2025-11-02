# TASK-FE-005：权限管理与路由守卫系统

## 📋 任务元信息

| 属性 | 值 |
|------|-----|
| **任务ID** | TASK-FE-005 |
| **任务类型** | Frontend Security |
| **优先级** | P0 - 紧急重要 |
| **预计工时** | 3-4天 |
| **依赖任务** | TASK-FE-001（架构搭建） |
| **负责Skill** | frontend-dev |
| **关联文档** | `docs/GPT5问题-前端架构设计.md` - 问题5 |

---

## 🎯 任务目标

实现完整的权限管理系统，解决当前权限检查散落各处、未登录用户可以访问需要登录的页面等安全问题：

### 业务需求
- **3种角色**：
  1. 普通用户（user）：工作台、素材库
  2. 分销代理（distributor）：额外可访问分销中心
  3. 管理员（admin）：可访问管理后台

### 当前问题
```tsx
// 权限检查散落在每个页面（SB做法！）
if (user?.role !== 'admin') {
  router.push('/login');
  return null;
}
```

### 改造后
```tsx
// 统一的路由守卫和权限组件
<PermissionGuard requiredRole="admin">
  <AdminDashboard />
</PermissionGuard>
```

---

## 📦 核心交付物

### 1. 权限数据结构设计

**`shared/types/permission.d.ts`**
```typescript
// 用户角色
export type UserRole = 'user' | 'distributor' | 'admin';

// 权限资源
export type PermissionResource =
  | 'workspace'        // 工作台
  | 'membership'       // 会员套餐
  | 'materials'        // 素材库
  | 'distribution'     // 分销中心
  | 'admin';           // 管理后台

// 角色权限映射表
export const ROLE_PERMISSIONS: Record<UserRole, PermissionResource[]> = {
  user: ['workspace', 'membership', 'materials'],
  distributor: ['workspace', 'membership', 'materials', 'distribution'],
  admin: ['workspace', 'membership', 'materials', 'distribution', 'admin'],
};

// 路由权限配置
export interface RoutePermission {
  path: string;
  requiredRole?: UserRole;         // 需要的最低角色
  requireAuth?: boolean;           // 是否需要登录
  allowedRoles?: UserRole[];       // 允许的角色列表
}
```

### 2. Next.js Middleware路由守卫

**`app/middleware.ts`** - 核心路由守卫
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 定义路由权限规则
const ROUTE_PERMISSIONS: Record<string, { requireAuth: boolean; allowedRoles?: UserRole[] }> = {
  '/workspace': { requireAuth: true },
  '/membership': { requireAuth: true },
  '/materials': { requireAuth: true },
  '/distribution': { requireAuth: true, allowedRoles: ['distributor', 'admin'] },
  '/admin': { requireAuth: true, allowedRoles: ['admin'] },
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. 从Cookie或Header获取用户信息（假设存储在JWT中）
  const token = request.cookies.get('auth_token')?.value;
  const user = token ? decodeJWT(token) : null;

  // 2. 检查路由是否需要权限
  const matchedRoute = Object.keys(ROUTE_PERMISSIONS).find((route) =>
    pathname.startsWith(route)
  );

  if (!matchedRoute) {
    return NextResponse.next(); // 公开路由，无需验证
  }

  const permission = ROUTE_PERMISSIONS[matchedRoute];

  // 3. 检查是否需要登录
  if (permission.requireAuth && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname); // 保存跳转前的路径
    return NextResponse.redirect(loginUrl);
  }

  // 4. 检查角色权限
  if (permission.allowedRoles && user) {
    if (!permission.allowedRoles.includes(user.role)) {
      // 无权限，跳转到403页面
      return NextResponse.redirect(new URL('/403', request.url));
    }
  }

  return NextResponse.next();
}

// 配置哪些路径需要应用middleware
export const config = {
  matcher: [
    '/workspace/:path*',
    '/membership/:path*',
    '/materials/:path*',
    '/distribution/:path*',
    '/admin/:path*',
  ],
};

// JWT解码函数（示例）
function decodeJWT(token: string): { role: UserRole; userId: number } | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { role: payload.role, userId: payload.user_id };
  } catch {
    return null;
  }
}
```

### 3. PermissionGuard组件

**`shared/ui/PermissionGuard/index.tsx`**
```typescript
import React from 'react';
import { useRouter } from 'next/navigation';
import { Result, Button } from 'antd';
import { useAuthStore } from '@/features/auth/model/useAuthStore';
import type { UserRole, PermissionResource } from '@/shared/types/permission';
import { ROLE_PERMISSIONS } from '@/shared/types/permission';

interface PermissionGuardProps {
  children: React.ReactNode;
  requiredRole?: UserRole;          // 需要的最低角色
  requiredResource?: PermissionResource; // 需要的资源权限
  fallback?: React.ReactNode;       // 无权限时显示的内容
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  requiredRole,
  requiredResource,
  fallback,
}) => {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  // 1. 检查是否登录
  if (!isAuthenticated || !user) {
    return (
      <Result
        status="403"
        title="请先登录"
        subTitle="您需要登录后才能访问此页面"
        extra={
          <Button type="primary" onClick={() => router.push('/login')}>
            去登录
          </Button>
        }
      />
    );
  }

  // 2. 检查角色权限
  if (requiredRole) {
    const roleLevel: Record<UserRole, number> = { user: 1, distributor: 2, admin: 3 };
    if (roleLevel[user.role] < roleLevel[requiredRole]) {
      return (
        fallback || (
          <Result
            status="403"
            title="权限不足"
            subTitle={`此功能需要 ${requiredRole} 角色权限`}
            extra={
              <Button type="primary" onClick={() => router.push('/workspace')}>
                返回工作台
              </Button>
            }
          />
        )
      );
    }
  }

  // 3. 检查资源权限
  if (requiredResource) {
    const allowedResources = ROLE_PERMISSIONS[user.role];
    if (!allowedResources.includes(requiredResource)) {
      return (
        fallback || (
          <Result
            status="403"
            title="无权访问"
            subTitle="您没有权限访问此功能"
            extra={
              <Button type="primary" onClick={() => router.push('/workspace')}>
                返回工作台
              </Button>
            }
          />
        )
      );
    }
  }

  // 通过权限检查，渲染子组件
  return <>{children}</>;
};
```

### 4. usePermission Hook

**`shared/hooks/usePermission.ts`**
```typescript
import { useAuthStore } from '@/features/auth/model/useAuthStore';
import type { UserRole, PermissionResource } from '@/shared/types/permission';
import { ROLE_PERMISSIONS } from '@/shared/types/permission';

export const usePermission = () => {
  const { user, isAuthenticated } = useAuthStore();

  /**
   * 检查用户是否有指定角色
   */
  const hasRole = (role: UserRole): boolean => {
    if (!isAuthenticated || !user) return false;
    const roleLevel: Record<UserRole, number> = { user: 1, distributor: 2, admin: 3 };
    return roleLevel[user.role] >= roleLevel[role];
  };

  /**
   * 检查用户是否有访问指定资源的权限
   */
  const hasResource = (resource: PermissionResource): boolean => {
    if (!isAuthenticated || !user) return false;
    const allowedResources = ROLE_PERMISSIONS[user.role];
    return allowedResources.includes(resource);
  };

  /**
   * 检查用户是否是管理员
   */
  const isAdmin = (): boolean => {
    return user?.role === 'admin';
  };

  /**
   * 检查用户是否是分销代理
   */
  const isDistributor = (): boolean => {
    return user?.role === 'distributor' || user?.role === 'admin';
  };

  return {
    hasRole,
    hasResource,
    isAdmin,
    isDistributor,
  };
};
```

### 5. 动态菜单生成

**`widgets/Sidebar/index.tsx`** - 根据权限生成导航菜单
```typescript
import React, { useMemo } from 'react';
import { Menu } from 'antd';
import { useRouter, usePathname } from 'next/navigation';
import {
  HomeOutlined,
  CrownOutlined,
  FolderOutlined,
  TeamOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { usePermission } from '@/shared/hooks/usePermission';
import type { MenuProps } from 'antd';

export const Sidebar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { hasResource } = usePermission();

  // 定义所有菜单项（包含权限要求）
  const allMenuItems = useMemo<MenuProps['items']>(() => {
    const items: MenuProps['items'] = [];

    // 工作台（所有用户都有）
    items.push({
      key: '/workspace',
      icon: <HomeOutlined />,
      label: '工作台',
    });

    // 会员套餐（所有用户都有）
    items.push({
      key: '/membership',
      icon: <CrownOutlined />,
      label: '会员套餐',
    });

    // 素材库（所有用户都有）
    items.push({
      key: '/materials',
      icon: <FolderOutlined />,
      label: '素材库',
    });

    // 分销中心（仅分销代理和管理员）
    if (hasResource('distribution')) {
      items.push({
        key: '/distribution',
        icon: <TeamOutlined />,
        label: '分销中心',
      });
    }

    // 管理后台（仅管理员）
    if (hasResource('admin')) {
      items.push({
        key: '/admin',
        icon: <SettingOutlined />,
        label: '管理后台',
      });
    }

    return items;
  }, [hasResource]);

  const handleMenuClick = ({ key }: { key: string }) => {
    router.push(key);
  };

  return (
    <Menu
      mode="inline"
      selectedKeys={[pathname]}
      items={allMenuItems}
      onClick={handleMenuClick}
    />
  );
};
```

### 6. 页面使用示例

**`app/(dashboard)/admin/page.tsx`** - 管理后台首页
```typescript
import React from 'react';
import { PermissionGuard } from '@/shared/ui/PermissionGuard';
import { AdminDashboard } from '@/features/admin/ui/AdminDashboard';

export default function AdminPage() {
  return (
    <PermissionGuard requiredRole="admin">
      <AdminDashboard />
    </PermissionGuard>
  );
}
```

**`features/workspace/ui/FeatureCard.tsx`** - 功能卡片中隐藏无权限按钮
```typescript
import { usePermission } from '@/shared/hooks/usePermission';

export const FeatureCard = () => {
  const { isAdmin } = usePermission();

  return (
    <Card>
      <h3>智能抠图</h3>
      <Button>立即使用</Button>
      {isAdmin() && <Button>编辑配置</Button>}
    </Card>
  );
};
```

---

## ✅ 验收标准

### 功能验收
- [ ] 未登录用户访问`/workspace`自动跳转到`/login`
- [ ] 普通用户访问`/admin`显示403错误页面
- [ ] 分销代理可以访问`/distribution`，普通用户不能
- [ ] 管理员可以访问所有页面
- [ ] 导航菜单根据用户角色动态显示/隐藏

### 安全验收
- [ ] 直接在浏览器地址栏输入`/admin`，普通用户无法访问
- [ ] Token过期后自动跳转到登录页
- [ ] 登录后自动跳转到之前访问的页面（redirect参数）

### 代码质量
- [ ] 所有权限检查都使用`PermissionGuard`或`usePermission`
- [ ] 没有在页面组件中直接判断`user.role`
- [ ] Middleware配置正确，覆盖所有需要保护的路由

---

## 🔧 技术要求

### JWT Token结构
```json
{
  "user_id": 123,
  "username": "test",
  "role": "admin",
  "exp": 1735660800
}
```

### Cookie配置
- 名称：`auth_token`
- HttpOnly：`true`（防止XSS攻击）
- Secure：`true`（仅HTTPS传输）
- SameSite：`Lax`

---

## 📚 参考资料

1. **Next.js Middleware**：https://nextjs.org/docs/app/building-your-application/routing/middleware
2. **RBAC权限模型**：https://en.wikipedia.org/wiki/Role-based_access_control

---

## 🚨 注意事项

1. **前后端权限同步**：
   - 前端权限检查仅用于UI优化
   - 后端API必须强制验证权限（前端可绕过）

2. **角色升级处理**：
   - 用户从普通用户升级为分销代理后，需要刷新Token
   - 使用WebSocket或轮询检测角色变化

3. **403 vs 404**：
   - 对于无权限的路由，返回403（而不是404）
   - 这样用户知道路由存在，但需要更高权限

---

**艹！这个权限系统搞定后，安全问题全解决，再也不怕SB用户乱访问了！** 🔥
