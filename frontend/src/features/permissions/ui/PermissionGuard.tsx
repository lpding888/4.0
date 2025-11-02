/**
 * 权限守卫组件
 * 艹，这个tm用于包裹需要权限的内容！
 *
 * 用法：
 * ```tsx
 * <PermissionGuard resource="page:admin">
 *   <AdminContent />
 * </PermissionGuard>
 *
 * <PermissionGuard
 *   resource="feature:export"
 *   fallback={<div>无权限</div>}
 * >
 *   <ExportButton />
 * </PermissionGuard>
 * ```
 *
 * @author 老王
 */

'use client';

import React from 'react';
import { usePermission } from '../model/usePermission';

/**
 * PermissionGuard Props
 */
export interface PermissionGuardProps {
  /** 所需资源权限（单个） */
  resource?: string;

  /** 所需资源权限（多个，满足任意一个即可） */
  anyResources?: string[];

  /** 所需资源权限（多个，必须全部满足） */
  allResources?: string[];

  /** 所需角色（单个） */
  role?: string;

  /** 所需角色（多个，满足任意一个即可） */
  anyRoles?: string[];

  /** 所需角色（多个，必须全部满足） */
  allRoles?: string[];

  /** 子组件 */
  children: React.ReactNode;

  /** 无权限时的fallback */
  fallback?: React.ReactNode;

  /** 是否在无权限时隐藏（默认true） */
  hideOnNoPermission?: boolean;
}

/**
 * PermissionGuard组件
 * 艹，权限守卫组件！
 */
export function PermissionGuard({
  resource,
  anyResources,
  allResources,
  role,
  anyRoles,
  allRoles,
  children,
  fallback = null,
  hideOnNoPermission = true,
}: PermissionGuardProps) {
  const {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    hasAllRoles,
  } = usePermission();

  // 艹，检查权限
  let hasAccess = true;

  // 1. 检查单个资源权限
  if (resource && !hasPermission(resource)) {
    hasAccess = false;
  }

  // 2. 检查任意资源权限
  if (anyResources && !hasAnyPermission(anyResources)) {
    hasAccess = false;
  }

  // 3. 检查所有资源权限
  if (allResources && !hasAllPermissions(allResources)) {
    hasAccess = false;
  }

  // 4. 检查单个角色
  if (role && !hasRole(role)) {
    hasAccess = false;
  }

  // 5. 检查任意角色
  if (anyRoles && !hasAnyRole(anyRoles)) {
    hasAccess = false;
  }

  // 6. 检查所有角色
  if (allRoles && !hasAllRoles(allRoles)) {
    hasAccess = false;
  }

  // 艹，有权限，显示内容
  if (hasAccess) {
    return <>{children}</>;
  }

  // 艹，无权限，显示fallback或隐藏
  if (hideOnNoPermission) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{fallback}</>;
}

/**
 * 便捷组件：需要管理员权限
 * 艹，常用场景的快捷组件！
 */
export function AdminOnly({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return (
    <PermissionGuard role="admin" fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

/**
 * 便捷组件：需要分销商权限
 */
export function DistributorOnly({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return (
    <PermissionGuard role="distributor" fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

/**
 * 便捷组件：需要登录
 */
export function AuthenticatedOnly({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return (
    <PermissionGuard anyRoles={['user', 'distributor', 'admin']} fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}
