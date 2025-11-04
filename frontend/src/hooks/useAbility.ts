/**
 * RBAC能力Hook
 * 艹！这个Hook让组件轻松判断权限！
 *
 * @author 老王
 */

'use client';

import { useMemo } from 'react';
import { useTenant } from '@/store/tenant';
import { createACL, type Action, type Resource, type ResourceAttributes, type Role } from '@/lib/rbac/acl';

/**
 * useAbility Hook
 *
 * 使用示例:
 * ```tsx
 * const { can, canViewField, canEditField, filterFields } = useAbility();
 *
 * if (can('template', 'create')) {
 *   // 显示创建按钮
 * }
 *
 * if (canViewField('user', 'email')) {
 *   // 显示邮箱字段
 * }
 * ```
 */
export function useAbility() {
  const { userRole } = useTenant();

  // 创建ACL实例（基于当前用户角色）
  const acl = useMemo(() => {
    const role = (userRole || 'guest') as Role;
    return createACL(role);
  }, [userRole]);

  /**
   * 检查是否有权限执行某个操作
   */
  const can = (resource: Resource, action: Action, attrs?: ResourceAttributes): boolean => {
    return acl.can(resource, action, attrs);
  };

  /**
   * 检查是否有权限查看某个字段
   */
  const canViewField = (resource: Resource, field: string): boolean => {
    return acl.canViewField(resource, field);
  };

  /**
   * 检查是否有权限编辑某个字段
   */
  const canEditField = (resource: Resource, field: string): boolean => {
    return acl.canEditField(resource, field);
  };

  /**
   * 检查字段是否需要脱敏
   */
  const isFieldMasked = (resource: Resource, field: string): boolean => {
    return acl.isFieldMasked(resource, field);
  };

  /**
   * 获取资源的字段权限
   */
  const getFieldPermissions = (resource: Resource) => {
    return acl.getFieldPermissions(resource);
  };

  /**
   * 过滤对象，只保留有权限查看的字段
   */
  const filterFields = <T extends Record<string, any>>(resource: Resource, data: T): Partial<T> => {
    return acl.filterFields(resource, data);
  };

  return {
    can,
    canViewField,
    canEditField,
    isFieldMasked,
    getFieldPermissions,
    filterFields,
    role: userRole as Role,
  };
}
