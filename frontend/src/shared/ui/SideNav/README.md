# SideNav 侧边导航菜单组件

艹，这个组件让你用配置就能搞定一个功能完整的侧边栏菜单！

## 核心功能

- ✅ **动态菜单**: 后端返回JSON配置，自动渲染菜单
- ✅ **权限控制**: 集成RBAC，无权限的菜单自动隐藏
- ✅ **动态图标**: 集成DynamicIcon，图标名称字符串自动渲染
- ✅ **多级嵌套**: 支持无限层级嵌套子菜单
- ✅ **路由集成**: 自动根据路由高亮菜单项，点击自动跳转
- ✅ **折叠展开**: 支持折叠状态，宽度自动调整
- ✅ **徽标提示**: 支持显示未读消息数等徽标
- ✅ **分组菜单**: 支持菜单分组，可选择性显示分组标题
- ✅ **外部链接**: 支持打开外部链接
- ✅ **响应式**: 完美适配Ant Design Layout

## 快速开始

### 最简单的用法

```tsx
import { SideNav } from '@/shared/ui/SideNav';

function AppLayout() {
  const menuItems = [
    { key: 'dashboard', label: '工作台', icon: 'DashboardOutlined', path: '/dashboard' },
    { key: 'users', label: '用户管理', icon: 'UserOutlined', path: '/users' },
    { key: 'settings', label: '设置', icon: 'SettingOutlined', path: '/settings' },
  ];

  return (
    <Layout>
      <SideNav items={menuItems} />
      <Layout.Content>{/* 页面内容 */}</Layout.Content>
    </Layout>
  );
}
```

### 带Logo和折叠功能

```tsx
import { SideNav } from '@/shared/ui/SideNav';
import { useAppStore } from '@/shared/store';

function AppLayout() {
  // 艹，从Zustand store获取折叠状态
  const collapsed = useAppStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);

  const menuItems = [
    { key: 'dashboard', label: '工作台', icon: 'DashboardOutlined', path: '/dashboard' },
    { key: 'users', label: '用户管理', icon: 'UserOutlined', path: '/users' },
  ];

  return (
    <Layout>
      <SideNav
        items={menuItems}
        collapsed={collapsed}
        onCollapse={toggleSidebar}
        logo={{
          src: '/logo.png',
          title: 'AI衣柜',
          collapsedSrc: '/logo-small.png',
          onClick: () => router.push('/'),
        }}
      />
      <Layout style={{ marginLeft: collapsed ? 80 : 240 }}>
        <Layout.Content>{/* 页面内容 */}</Layout.Content>
      </Layout>
    </Layout>
  );
}
```

### 多级嵌套菜单

```tsx
const menuItems = [
  {
    key: 'dashboard',
    label: '工作台',
    icon: 'DashboardOutlined',
    path: '/dashboard',
  },
  {
    key: 'system',
    label: '系统管理',
    icon: 'SettingOutlined',
    children: [
      { key: 'users', label: '用户管理', path: '/system/users' },
      { key: 'roles', label: '角色管理', path: '/system/roles' },
      {
        key: 'permissions',
        label: '权限管理',
        children: [
          { key: 'resources', label: '资源管理', path: '/system/permissions/resources' },
          { key: 'policies', label: '策略管理', path: '/system/permissions/policies' },
        ],
      },
    ],
  },
];

<SideNav items={menuItems} defaultOpenKeys={['system']} />;
```

### 带权限控制的菜单

```tsx
const menuItems = [
  {
    key: 'dashboard',
    label: '工作台',
    icon: 'DashboardOutlined',
    path: '/dashboard',
    // 不需要权限，所有人可见
  },
  {
    key: 'admin',
    label: '管理后台',
    icon: 'CrownOutlined',
    path: '/admin',
    permission: 'page:admin', // 艹，需要这个权限才显示！
  },
  {
    key: 'users',
    label: '用户管理',
    icon: 'UserOutlined',
    path: '/admin/users',
    permission: 'feature:user_management',
  },
];

<SideNav items={menuItems} enablePermission />;
```

### 带徽标的菜单

```tsx
const menuItems = [
  {
    key: 'messages',
    label: '消息中心',
    icon: 'MessageOutlined',
    path: '/messages',
    badge: 5, // 艹，显示未读消息数！
    badgeColor: 'red',
  },
  {
    key: 'notifications',
    label: '通知',
    icon: 'BellOutlined',
    path: '/notifications',
    badge: '新', // 也可以是文本
    badgeColor: 'blue',
  },
];

<SideNav items={menuItems} />;
```

### 分组菜单

```tsx
const menuGroups = [
  {
    title: '工作台',
    items: [
      { key: 'dashboard', label: '概览', icon: 'DashboardOutlined', path: '/dashboard' },
      { key: 'tasks', label: '我的任务', icon: 'CheckSquareOutlined', path: '/tasks' },
    ],
  },
  {
    title: '系统管理',
    items: [
      { key: 'users', label: '用户管理', icon: 'UserOutlined', path: '/admin/users' },
      { key: 'settings', label: '系统设置', icon: 'SettingOutlined', path: '/admin/settings' },
    ],
  },
];

<SideNav groups={menuGroups} />;
```

### 外部链接

```tsx
const menuItems = [
  { key: 'dashboard', label: '工作台', icon: 'HomeOutlined', path: '/dashboard' },
  {
    key: 'docs',
    label: '帮助文档',
    icon: 'FileTextOutlined',
    path: 'https://docs.example.com',
    external: true,
    target: '_blank',
  },
  {
    key: 'support',
    label: '技术支持',
    icon: 'CustomerServiceOutlined',
    path: 'https://support.example.com',
    external: true,
  },
];

<SideNav items={menuItems} />;
```

### 自定义底部内容

```tsx
import { Avatar, Space } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';

<SideNav
  items={menuItems}
  footer={
    <Space direction="vertical" style={{ width: '100%' }}>
      <Space>
        <Avatar src="/avatar.png" size="small" />
        {!collapsed && <span>张三</span>}
      </Space>
      {!collapsed && (
        <Button icon={<LogoutOutlined />} block onClick={handleLogout}>
          退出登录
        </Button>
      )}
    </Space>
  }
/>;
```

## API

### SideNavProps

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `items` | `MenuItem[]` | `[]` | 菜单项配置（必需，与groups二选一） |
| `groups` | `MenuGroup[]` | - | 菜单分组配置（可选，与items二选一） |
| `selectedKey` | `string` | - | 当前选中的菜单key（不传则自动根据路由计算） |
| `defaultOpenKeys` | `string[]` | `[]` | 默认展开的菜单key数组 |
| `collapsed` | `boolean` | - | 是否折叠（受控） |
| `onCollapse` | `(collapsed) => void` | - | 折叠变化回调 |
| `onMenuClick` | `(menuItem) => void` | - | 菜单项点击回调 |
| `theme` | `'light' \| 'dark'` | `'light'` | 主题 |
| `mode` | `'inline' \| 'vertical'` | `'inline'` | 菜单模式 |
| `enablePermission` | `boolean` | `true` | 是否启用权限控制 |
| `className` | `string` | - | 自定义样式类名 |
| `width` | `number` | `240` | 宽度（折叠时自动变为80px） |
| `logo` | `LogoConfig` | - | Logo配置 |
| `footer` | `ReactNode` | - | 底部额外内容 |

### MenuItem

| 属性 | 类型 | 说明 |
|------|------|------|
| `key` | `string` | 菜单项唯一key（必需） |
| `label` | `string` | 菜单标签（必需） |
| `icon` | `string` | 图标名称（DynamicIcon会自动渲染） |
| `path` | `string` | 路由路径 |
| `children` | `MenuItem[]` | 子菜单 |
| `disabled` | `boolean` | 是否禁用 |
| `hidden` | `boolean` | 是否隐藏 |
| `permission` | `string` | 权限资源标识（RBAC权限控制） |
| `badge` | `number \| string` | 徽标（如未读消息数） |
| `badgeColor` | `string` | 徽标颜色 |
| `external` | `boolean` | 是否为外部链接 |
| `target` | `'_blank' \| '_self'` | 外部链接target |
| `meta` | `Record<string, any>` | 自定义元数据 |

### MenuGroup

| 属性 | 类型 | 说明 |
|------|------|------|
| `title` | `string` | 组标题（必需） |
| `items` | `MenuItem[]` | 组内菜单项（必需） |
| `hideTitle` | `boolean` | 是否隐藏分组标题 |

### LogoConfig

| 属性 | 类型 | 说明 |
|------|------|------|
| `src` | `string` | Logo图片URL（必需） |
| `title` | `string` | Logo标题 |
| `collapsedSrc` | `string` | 折叠时的Logo |
| `onClick` | `() => void` | 点击Logo回调 |

## 高级用法

### 后端数据驱动的动态菜单

```tsx
import { useState, useEffect } from 'react';
import { SideNav } from '@/shared/ui/SideNav';
import { api } from '@/lib/api';

function DynamicSideNav() {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 艹，从后端获取菜单配置！
    api.menu.getMenuList().then((res) => {
      setMenuItems(res.data.items);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div>加载中...</div>;
  }

  return <SideNav items={menuItems} enablePermission />;
}
```

**后端返回的JSON格式**:
```json
{
  "items": [
    {
      "key": "dashboard",
      "label": "工作台",
      "icon": "DashboardOutlined",
      "path": "/dashboard"
    },
    {
      "key": "admin",
      "label": "管理后台",
      "icon": "CrownOutlined",
      "permission": "page:admin",
      "children": [
        {
          "key": "users",
          "label": "用户管理",
          "icon": "UserOutlined",
          "path": "/admin/users",
          "permission": "feature:user_management"
        }
      ]
    }
  ]
}
```

### 完整的Layout示例

```tsx
import { Layout } from 'antd';
import { SideNav } from '@/shared/ui/SideNav';
import { useAppStore } from '@/shared/store';

const { Content, Header } = Layout;

function AppLayout({ children }: { children: React.ReactNode }) {
  const collapsed = useAppStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const user = useAppStore((state) => state.user);

  const menuItems = [
    { key: 'dashboard', label: '工作台', icon: 'DashboardOutlined', path: '/dashboard' },
    {
      key: 'ai',
      label: 'AI处理',
      icon: 'ThunderboltOutlined',
      children: [
        { key: 'process', label: '照片处理', icon: 'PictureOutlined', path: '/ai/process' },
        { key: 'history', label: '处理历史', icon: 'HistoryOutlined', path: '/ai/history' },
      ],
    },
    {
      key: 'admin',
      label: '管理后台',
      icon: 'CrownOutlined',
      permission: 'page:admin',
      children: [
        { key: 'users', label: '用户管理', path: '/admin/users' },
        { key: 'distributors', label: '分销员管理', path: '/admin/distributors' },
      ],
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 侧边栏 */}
      <SideNav
        items={menuItems}
        collapsed={collapsed}
        onCollapse={toggleSidebar}
        enablePermission
        logo={{
          src: '/logo.png',
          title: 'AI衣柜',
          collapsedSrc: '/logo-small.png',
        }}
        footer={
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space>
              <Avatar src={user?.avatar} size="small">
                {user?.name?.[0]}
              </Avatar>
              {!collapsed && <span>{user?.name}</span>}
            </Space>
          </Space>
        }
      />

      {/* 主内容区 */}
      <Layout style={{ marginLeft: collapsed ? 80 : 240, transition: 'margin-left 0.2s' }}>
        <Header style={{ background: '#fff', padding: '0 24px' }}>
          {/* 顶部栏内容 */}
        </Header>
        <Content style={{ margin: '24px', padding: '24px', background: '#fff' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
```

### 动态徽标数量

```tsx
import { useState, useEffect } from 'react';
import { SideNav } from '@/shared/ui/SideNav';
import { api } from '@/lib/api';

function SideNavWithBadge() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // 艹，轮询获取未读消息数！
    const interval = setInterval(() => {
      api.messages.getUnreadCount().then((res) => {
        setUnreadCount(res.data.count);
      });
    }, 30000); // 30秒刷新一次

    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    { key: 'dashboard', label: '工作台', icon: 'DashboardOutlined', path: '/dashboard' },
    {
      key: 'messages',
      label: '消息中心',
      icon: 'MessageOutlined',
      path: '/messages',
      badge: unreadCount > 0 ? unreadCount : undefined,
      badgeColor: 'red',
    },
  ];

  return <SideNav items={menuItems} />;
}
```

## 与权限系统集成

SideNav组件自动集成了RBAC权限系统：

```tsx
// 配置菜单项时指定permission
const menuItems = [
  {
    key: 'admin-dashboard',
    label: '管理后台',
    icon: 'CrownOutlined',
    path: '/admin',
    permission: 'page:admin', // 只有拥有这个权限的用户才能看到
  },
];

// 启用权限控制（默认开启）
<SideNav items={menuItems} enablePermission={true} />

// 如果用户没有 'page:admin' 权限，这个菜单项会自动隐藏
```

权限资源标识格式：
- `page:admin` - 页面级权限
- `feature:user_management` - 功能级权限
- `action:user:delete` - 操作级权限

## 主题定制

### 暗色主题

```tsx
<SideNav items={menuItems} theme="dark" />
```

### 自定义样式

```tsx
<SideNav
  items={menuItems}
  className="custom-sidenav"
  width={280} // 自定义宽度
/>
```

```css
/* 自定义样式 */
.custom-sidenav {
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
}

.custom-sidenav .ant-menu-item {
  border-radius: 8px;
  margin: 4px 8px;
}
```

## 性能优化建议

1. **使用useMemo缓存菜单配置**:
```tsx
const menuItems = useMemo(() => [
  { key: 'dashboard', label: '工作台', icon: 'DashboardOutlined', path: '/dashboard' },
  // ...
], []);
```

2. **避免频繁切换collapsed状态**（使用debounce）

3. **大型菜单分组加载**（按需加载子菜单）

## 注意事项

1. **菜单key必须唯一**: 所有菜单项的key在整个菜单树中必须唯一
2. **权限资源标识**: permission字段必须与后端RBAC系统中定义的资源标识一致
3. **路由自动高亮**: 如果不传selectedKey，组件会根据当前路由自动高亮对应菜单
4. **外部链接**: 设置external=true的菜单项不会触发路由跳转，而是打开新窗口

---

**艹，这个导航菜单组件就是这么强大！有问题随时吼老王！**
