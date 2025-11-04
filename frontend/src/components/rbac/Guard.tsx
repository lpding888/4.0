/**
 * RBAC权限守卫组件
 * 艹！这个组件用于保护UI元素，没权限就不显示！
 *
 * @author 老王
 */

'use client';

import React from 'react';
import { useAbility } from '@/hooks/useAbility';
import type { Action, Resource, ResourceAttributes } from '@/lib/rbac/acl';

/**
 * Guard组件Props
 */
interface GuardProps {
  /** 资源类型 */
  resource: Resource;

  /** 操作类型 */
  action: Action;

  /** 资源属性（可选，用于更细粒度的权限判断） */
  attrs?: ResourceAttributes;

  /** 子组件 */
  children: React.ReactNode;

  /** 无权限时的fallback（可选） */
  fallback?: React.ReactNode;
}

/**
 * 权限守卫组件
 *
 * 使用示例:
 * ```tsx
 * <Guard resource="template" action="create">
 *   <Button>创建模板</Button>
 * </Guard>
 *
 * <Guard
 *   resource="template"
 *   action="delete"
 *   attrs={{ ownerId: template.owner_id }}
 *   fallback={<Text type="secondary">无权限删除</Text>}
 * >
 *   <Button danger>删除</Button>
 * </Guard>
 * ```
 */
export const Guard: React.FC<GuardProps> = ({ resource, action, attrs, children, fallback = null }) => {
  const { can } = useAbility();

  // 检查权限
  const hasPermission = can(resource, action, attrs);

  // 有权限：渲染子组件
  if (hasPermission) {
    return <>{children}</>;
  }

  // 无权限：渲染fallback
  return <>{fallback}</>;
};
