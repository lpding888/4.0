/**
 * SideNav 侧边导航菜单类型定义
 * 艹，这个tm定义了动态菜单的所有类型！
 */

import type { MenuProps } from 'antd';

/**
 * 菜单项配置
 */
export interface MenuItem {
  /** 菜单项唯一key */
  key: string;

  /** 菜单标签 */
  label: string;

  /** 图标名称（字符串，DynamicIcon会自动渲染） */
  icon?: string;

  /** 路由路径 */
  path?: string;

  /** 子菜单 */
  children?: MenuItem[];

  /** 是否禁用 */
  disabled?: boolean;

  /** 是否隐藏（权限控制） */
  hidden?: boolean;

  /** 权限资源标识（用于RBAC权限控制） */
  permission?: string;

  /** 徽标（数字或文本，如未读消息数） */
  badge?: number | string;

  /** 徽标颜色 */
  badgeColor?: string;

  /** 是否为外部链接 */
  external?: boolean;

  /** 外部链接target */
  target?: '_blank' | '_self';

  /** 自定义元数据 */
  meta?: Record<string, any>;
}

/**
 * 菜单组（带分组标题）
 */
export interface MenuGroup {
  /** 组标题 */
  title: string;

  /** 组内菜单项 */
  items: MenuItem[];

  /** 是否隐藏分组标题 */
  hideTitle?: boolean;
}

/**
 * SideNav Props
 */
export interface SideNavProps {
  /** 菜单项配置 */
  items: MenuItem[];

  /** 菜单分组配置（可选，与items二选一） */
  groups?: MenuGroup[];

  /** 当前选中的菜单key */
  selectedKey?: string;

  /** 默认展开的菜单key数组 */
  defaultOpenKeys?: string[];

  /** 是否折叠 */
  collapsed?: boolean;

  /** 折叠变化回调 */
  onCollapse?: (collapsed: boolean) => void;

  /** 菜单项点击回调 */
  onMenuClick?: (menuItem: MenuItem) => void;

  /** 主题 */
  theme?: 'light' | 'dark';

  /** 菜单模式 */
  mode?: 'inline' | 'vertical';

  /** 是否启用权限控制 */
  enablePermission?: boolean;

  /** 自定义样式 */
  className?: string;

  /** 自定义宽度（折叠时会自动变为80px） */
  width?: number;

  /** Logo配置 */
  logo?: {
    /** Logo图片URL */
    src: string;
    /** Logo标题 */
    title?: string;
    /** 折叠时的Logo */
    collapsedSrc?: string;
    /** 点击Logo回调 */
    onClick?: () => void;
  };

  /** 底部额外内容 */
  footer?: React.ReactNode;
}

/**
 * 菜单项渲染配置（内部使用）
 */
export type AntMenuItem = Required<MenuProps>['items'][number];
