/**
 * 权限系统入口
 * 艹，统一导出所有权限相关的东西！
 *
 * @author 老王
 */

// 艹，导出权限配置
export {
  Role,
  PERMISSION_RULES,
  getPermissionRule,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
} from './model/permissionConfig';

export type { PermissionRule } from './model/permissionConfig';

// 艹，导出权限Hook
export { usePermission } from './model/usePermission';

// 艹，导出权限守卫组件
export {
  PermissionGuard,
  AdminOnly,
  DistributorOnly,
  AuthenticatedOnly,
} from './ui/PermissionGuard';

export type { PermissionGuardProps } from './ui/PermissionGuard';
