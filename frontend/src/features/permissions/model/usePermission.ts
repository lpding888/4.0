/**
 * 权限检查Hook
 * 艹，这个tm用于检查用户是否有权限！
 *
 * 用法：
 * ```tsx
 * const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermission();
 *
 * if (hasPermission('page:admin')) {
 *   // 艹，显示管理后台链接
 * }
 * ```
 *
 * @author 老王
 */

'use client';

import { useUser } from '@/shared/store';
import {
  hasPermission as checkPermission,
  hasAnyPermission as checkAnyPermission,
  hasAllPermissions as checkAllPermissions,
} from './permissionConfig';

/**
 * usePermission Hook
 * 艹，封装权限检查逻辑！
 */
export function usePermission() {
  const user = useUser();

  // 艹，获取用户角色列表
  const userRoles = user?.roles || [];

  /**
   * 检查是否有单个资源权限
   */
  const hasPermission = (resource: string): boolean => {
    return checkPermission(userRoles, resource);
  };

  /**
   * 检查是否有任意一个资源权限
   */
  const hasAnyPermission = (resources: string[]): boolean => {
    return checkAnyPermission(userRoles, resources);
  };

  /**
   * 检查是否拥有所有资源权限
   */
  const hasAllPermissions = (resources: string[]): boolean => {
    return checkAllPermissions(userRoles, resources);
  };

  /**
   * 检查是否有指定角色
   */
  const hasRole = (role: string): boolean => {
    return userRoles.includes(role);
  };

  /**
   * 检查是否有任意一个角色
   */
  const hasAnyRole = (roles: string[]): boolean => {
    return roles.some((role) => userRoles.includes(role));
  };

  /**
   * 检查是否拥有所有角色
   */
  const hasAllRoles = (roles: string[]): boolean => {
    return roles.every((role) => userRoles.includes(role));
  };

  return {
    // 艹，权限检查
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,

    // 艹，角色检查
    hasRole,
    hasAnyRole,
    hasAllRoles,

    // 艹，直接暴露用户角色
    userRoles,
  };
}
