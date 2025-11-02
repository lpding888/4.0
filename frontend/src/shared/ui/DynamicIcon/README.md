# DynamicIcon 动态图标组件

艹，这个组件让你用字符串就能渲染Ant Design图标，完美解决后端返回图标名称的场景！

## 核心功能

- ✅ **字符串映射**: 传入字符串图标名，自动渲染对应图标组件
- ✅ **类型安全**: 完整的TypeScript类型定义
- ✅ **智能降级**: 找不到图标时自动显示默认图标
- ✅ **开发友好**: 开发环境下会警告不存在的图标
- ✅ **高度可定制**: 支持size、color、style等所有常用配置
- ✅ **性能优化**: 无运行时eval，纯静态映射

## 快速开始

### 基础用法

```tsx
import { DynamicIcon } from '@/shared/ui/DynamicIcon';

function MyComponent() {
  return (
    <div>
      {/* 基础用法 */}
      <DynamicIcon icon="UserOutlined" />

      {/* 自定义大小和颜色 */}
      <DynamicIcon icon="HomeOutlined" size={24} color="#1890ff" />

      {/* 带点击事件 */}
      <DynamicIcon
        icon="SettingOutlined"
        size={20}
        onClick={() => console.log('设置被点击')}
      />
    </div>
  );
}
```

### 后端数据驱动

这是最常见的使用场景：

```tsx
interface MenuItem {
  key: string;
  label: string;
  icon: string; // 后端返回 "DashboardOutlined"
}

function DynamicMenu({ items }: { items: MenuItem[] }) {
  return (
    <Menu>
      {items.map(item => (
        <Menu.Item key={item.key} icon={<DynamicIcon icon={item.icon} />}>
          {item.label}
        </Menu.Item>
      ))}
    </Menu>
  );
}
```

### 高级用法

```tsx
// 自定义fallback（图标不存在时显示）
<DynamicIcon
  icon="NonExistentIcon"
  fallback={<span>?</span>}
/>

// 旋转图标
<DynamicIcon icon="LoadingOutlined" spin />
<DynamicIcon icon="RightOutlined" rotate={90} />

// 自定义样式
<DynamicIcon
  icon="StarOutlined"
  style={{ fontSize: '32px', color: '#fadb14' }}
  className="my-custom-icon"
/>

// 关闭警告（不推荐）
<DynamicIcon
  icon="UnknownIcon"
  showWarning={false}
/>
```

## Props API

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `icon` | `string \| undefined \| null` | - | 图标名称（必需） |
| `size` | `number` | - | 图标大小（px） |
| `color` | `string` | - | 图标颜色 |
| `style` | `CSSProperties` | - | 自定义样式 |
| `className` | `string` | - | 自定义className |
| `onClick` | `(e: MouseEvent) => void` | - | 点击事件 |
| `fallback` | `ReactNode` | `<QuestionCircleOutlined />` | 图标不存在时的回退内容 |
| `showWarning` | `boolean` | `true` | 是否在开发环境显示警告 |
| `spin` | `boolean` | `false` | 是否旋转动画 |
| `rotate` | `number` | - | 旋转角度（deg） |

## 工具函数

### getIconComponent

获取图标组件（用于高级场景）：

```tsx
import { getIconComponent } from '@/shared/ui/DynamicIcon';

const IconComponent = getIconComponent('UserOutlined');
if (IconComponent) {
  return <IconComponent style={{ fontSize: 20 }} />;
}
```

### hasIcon

检查图标是否存在：

```tsx
import { hasIcon } from '@/shared/ui/DynamicIcon';

if (hasIcon('UserOutlined')) {
  console.log('图标存在');
}
```

### getAvailableIcons

获取所有可用图标列表：

```tsx
import { getAvailableIcons } from '@/shared/ui/DynamicIcon';

const icons = getAvailableIcons();
console.log('可用图标:', icons);
// ['UserOutlined', 'HomeOutlined', ...]
```

## 可用图标列表

目前支持 **100+** 常用Ant Design图标，包括：

### 通用图标
- `HomeOutlined`, `UserOutlined`, `SettingOutlined`, `SearchOutlined`
- `PlusOutlined`, `EditOutlined`, `DeleteOutlined`, `SaveOutlined`
- `CheckOutlined`, `CloseOutlined`, `InfoCircleOutlined`

### 导航图标
- `MenuOutlined`, `LeftOutlined`, `RightOutlined`, `UpOutlined`, `DownOutlined`
- `ArrowLeftOutlined`, `ArrowRightOutlined`

### 用户和权限
- `TeamOutlined`, `UserAddOutlined`, `LockOutlined`, `UnlockOutlined`
- `SafetyOutlined`, `KeyOutlined`

### 数据统计
- `DashboardOutlined`, `BarChartOutlined`, `LineChartOutlined`
- `PieChartOutlined`, `FundOutlined`, `StockOutlined`

### 文件操作
- `FileOutlined`, `FolderOutlined`, `DownloadOutlined`, `UploadOutlined`
- `CloudUploadOutlined`, `FileTextOutlined`, `FilePdfOutlined`

### 状态指示
- `LoadingOutlined`, `CheckCircleOutlined`, `CloseCircleOutlined`
- `ExclamationCircleOutlined`, `WarningOutlined`

### 更多分类...

> 完整列表请查看 `iconMap.ts` 源码

## 如何添加新图标？

如果需要的图标不在列表中，按以下步骤添加：

1. 打开 `iconMap.ts`
2. 从 `@ant-design/icons` 导入图标组件
3. 添加到 `ICON_MAP` 对象中

```ts
// 1. 导入
import { NewIconOutlined } from '@ant-design/icons';

// 2. 添加到映射表
export const ICON_MAP = {
  // ... 其他图标
  NewIconOutlined,
};
```

## 性能说明

- ✅ **零运行时eval**: 所有图标都是静态导入，Tree-shaking友好
- ✅ **按需加载**: 只有用到的图标才会被打包
- ✅ **类型安全**: 完整的TypeScript支持，编译时检查

## 注意事项

1. **图标名称必须精确匹配**: 大小写敏感，必须是 `iconMap.ts` 中定义的名称
2. **找不到图标会显示默认图标**: 不会崩溃，但会在开发环境显示警告
3. **建议在后端也维护图标列表**: 避免前后端不一致

## 示例：完整的动态菜单

```tsx
import { DynamicIcon } from '@/shared/ui/DynamicIcon';
import { Menu } from 'antd';

interface MenuItem {
  key: string;
  label: string;
  icon?: string;
  children?: MenuItem[];
}

function DynamicMenu() {
  // 模拟后端返回的菜单数据
  const menuData: MenuItem[] = [
    { key: 'dashboard', label: '工作台', icon: 'DashboardOutlined' },
    { key: 'users', label: '用户管理', icon: 'UserOutlined' },
    {
      key: 'settings',
      label: '系统设置',
      icon: 'SettingOutlined',
      children: [
        { key: 'profile', label: '个人设置', icon: 'UserOutlined' },
        { key: 'security', label: '安全设置', icon: 'SafetyOutlined' },
      ],
    },
  ];

  const renderMenu = (items: MenuItem[]) => {
    return items.map(item => {
      if (item.children) {
        return (
          <Menu.SubMenu
            key={item.key}
            title={item.label}
            icon={item.icon ? <DynamicIcon icon={item.icon} /> : null}
          >
            {renderMenu(item.children)}
          </Menu.SubMenu>
        );
      }

      return (
        <Menu.Item
          key={item.key}
          icon={item.icon ? <DynamicIcon icon={item.icon} /> : null}
        >
          {item.label}
        </Menu.Item>
      );
    });
  };

  return <Menu mode="inline">{renderMenu(menuData)}</Menu>;
}
```

---

**艹，这个组件就是这么简单好用！有问题随时吼老王！**
