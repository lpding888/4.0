/**
 * SideNav 侧边导航菜单组件
 * 艹，这个组件支持动态菜单、权限控制、折叠展开，开箱即用！
 */

'use client';

import React, { useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Layout, Menu, Badge } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { DynamicIcon } from '@/shared/ui/DynamicIcon';
import { usePermission } from '@/features/permissions/model/usePermission';
import type { SideNavProps, MenuItem, MenuGroup, AntMenuItem } from './types';

const { Sider } = Layout;

/**
 * SideNav 组件
 */
export const SideNav: React.FC<SideNavProps> = ({
  items = [],
  groups,
  selectedKey,
  defaultOpenKeys = [],
  collapsed: controlledCollapsed,
  onCollapse,
  onMenuClick,
  theme = 'light',
  mode = 'inline',
  enablePermission = true,
  className,
  width = 240,
  logo,
  footer,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { hasPermission } = usePermission();

  // 折叠状态（受控或非受控）
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  // 展开的菜单keys
  const [openKeys, setOpenKeys] = useState<string[]>(defaultOpenKeys);

  /**
   * 过滤有权限的菜单项
   * 艹，没权限的菜单直接过滤掉，不显示！
   */
  const filterMenuByPermission = (menuItems: MenuItem[]): MenuItem[] => {
    return menuItems
      .filter((item) => {
        // 隐藏的菜单项
        if (item.hidden) {
          return false;
        }

        // 权限控制
        if (enablePermission && item.permission) {
          return hasPermission(item.permission);
        }

        return true;
      })
      .map((item) => {
        // 递归处理子菜单
        if (item.children && item.children.length > 0) {
          return {
            ...item,
            children: filterMenuByPermission(item.children),
          };
        }
        return item;
      });
  };

  /**
   * 转换MenuItem为Ant Design Menu需要的格式
   */
  const convertToAntMenuItem = (menuItem: MenuItem): AntMenuItem => {
    const { key, label, icon, children, disabled, badge, badgeColor } = menuItem;

    // 渲染图标
    const iconNode = icon ? <DynamicIcon icon={icon} /> : null;

    // 渲染标签（带徽标）
    const labelNode = badge ? (
      <Badge count={badge} offset={[10, 0]} color={badgeColor}>
        {label}
      </Badge>
    ) : (
      label
    );

    // 有子菜单
    if (children && children.length > 0) {
      return {
        key,
        label: labelNode,
        icon: iconNode,
        disabled,
        children: children.map(convertToAntMenuItem),
      };
    }

    // 无子菜单
    return {
      key,
      label: labelNode,
      icon: iconNode,
      disabled,
    };
  };

  /**
   * 处理后的菜单项（过滤权限 + 转换格式）
   */
  const processedMenuItems = useMemo(() => {
    // 优先使用groups
    if (groups && groups.length > 0) {
      return groups.map((group) => {
        const filteredItems = filterMenuByPermission(group.items);

        // 艹，分组标题用type: 'group'
        return {
          type: 'group' as const,
          label: group.hideTitle ? '' : group.title,
          children: filteredItems.map(convertToAntMenuItem),
        };
      });
    }

    // 使用items
    const filteredItems = filterMenuByPermission(items);
    return filteredItems.map(convertToAntMenuItem);
  }, [items, groups, enablePermission, hasPermission]);

  /**
   * 当前选中的菜单key（自动根据路由计算）
   */
  const currentSelectedKey = useMemo(() => {
    if (selectedKey) {
      return selectedKey;
    }

    // 艹，从pathname自动匹配菜单key
    const findKeyByPath = (menuItems: MenuItem[]): string | null => {
      for (const item of menuItems) {
        if (item.path === pathname) {
          return item.key;
        }
        if (item.children) {
          const childKey = findKeyByPath(item.children);
          if (childKey) {
            return childKey;
          }
        }
      }
      return null;
    };

    const allItems = groups ? groups.flatMap((g) => g.items) : items;
    return findKeyByPath(allItems) || '';
  }, [selectedKey, pathname, items, groups]);

  /**
   * 处理菜单点击
   */
  const handleMenuClick = ({ key }: { key: string }) => {
    // 查找菜单项
    const findMenuItem = (menuItems: MenuItem[]): MenuItem | null => {
      for (const item of menuItems) {
        if (item.key === key) {
          return item;
        }
        if (item.children) {
          const childItem = findMenuItem(item.children);
          if (childItem) {
            return childItem;
          }
        }
      }
      return null;
    };

    const allItems = groups ? groups.flatMap((g) => g.items) : items;
    const menuItem = findMenuItem(allItems);

    if (!menuItem) {
      return;
    }

    // 回调
    onMenuClick?.(menuItem);

    // 路由跳转
    if (menuItem.path) {
      if (menuItem.external) {
        // 外部链接
        window.open(menuItem.path, menuItem.target || '_blank');
      } else {
        // 内部路由
        router.push(menuItem.path);
      }
    }
  };

  /**
   * 处理折叠切换
   */
  const handleCollapse = (collapsed: boolean) => {
    if (controlledCollapsed === undefined) {
      setInternalCollapsed(collapsed);
    }
    onCollapse?.(collapsed);
  };

  /**
   * 处理子菜单展开/收起
   */
  const handleOpenChange = (keys: string[]) => {
    setOpenKeys(keys);
  };

  /**
   * 渲染Logo区域
   */
  const renderLogo = () => {
    if (!logo) {
      return null;
    }

    const logoSrc = collapsed && logo.collapsedSrc ? logo.collapsedSrc : logo.src;

    return (
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 16px',
          cursor: logo.onClick ? 'pointer' : 'default',
          borderBottom: theme === 'light' ? '1px solid #f0f0f0' : '1px solid #303030',
        }}
        onClick={logo.onClick}
      >
        <img
          src={logoSrc}
          alt="Logo"
          style={{
            height: 32,
            maxWidth: '100%',
            objectFit: 'contain',
          }}
        />
        {!collapsed && logo.title && (
          <span
            style={{
              marginLeft: 12,
              fontSize: 16,
              fontWeight: 600,
              color: theme === 'dark' ? '#fff' : '#000',
            }}
          >
            {logo.title}
          </span>
        )}
      </div>
    );
  };

  /**
   * 渲染折叠按钮
   */
  const renderTrigger = () => {
    return (
      <div
        style={{
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: 18,
          borderTop: theme === 'light' ? '1px solid #f0f0f0' : '1px solid #303030',
        }}
        onClick={() => handleCollapse(!collapsed)}
      >
        {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
      </div>
    );
  };

  return (
    <Sider
      width={width}
      collapsedWidth={80}
      collapsed={collapsed}
      theme={theme}
      className={className}
      style={{
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Logo */}
      {renderLogo()}

      {/* 菜单 */}
      <Menu
        mode={mode}
        theme={theme}
        selectedKeys={[currentSelectedKey]}
        openKeys={collapsed ? [] : openKeys}
        onOpenChange={handleOpenChange}
        onClick={handleMenuClick}
        items={processedMenuItems}
        style={{ flex: 1, borderRight: 0 }}
      />

      {/* 底部内容 */}
      {footer && (
        <div
          style={{
            padding: collapsed ? '8px' : '16px',
            borderTop: theme === 'light' ? '1px solid #f0f0f0' : '1px solid #303030',
          }}
        >
          {footer}
        </div>
      )}

      {/* 折叠按钮 */}
      {renderTrigger()}
    </Sider>
  );
};

export default SideNav;
