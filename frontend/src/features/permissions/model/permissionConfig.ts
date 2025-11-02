/**
 * RBAC权限配置
 * 艹，这个tm定义所有资源的访问权限！
 *
 * 资源格式：
 * - 页面资源：`page:workspace`, `page:admin`
 * - 功能资源：`feature:upload`, `feature:export`
 * - 操作资源：`action:create`, `action:delete`
 *
 * @author 老王
 */

/**
 * 角色枚举
 */
export enum Role {
  /** 游客（未登录） */
  GUEST = 'guest',

  /** 普通用户 */
  USER = 'user',

  /** 分销商 */
  DISTRIBUTOR = 'distributor',

  /** 管理员 */
  ADMIN = 'admin',

  /** 超级管理员 */
  SUPER_ADMIN = 'super_admin',
}

/**
 * 权限规则接口
 */
export interface PermissionRule {
  /** 资源标识 */
  resource: string;

  /** 所需角色（满足任意一个即可） */
  roles: Role[];

  /** 描述 */
  description?: string;
}

/**
 * 权限配置表
 * 艹，这个tm是权限控制的核心！
 */
export const PERMISSION_RULES: PermissionRule[] = [
  // ==================== 页面权限 ====================

  // 艹，工作台页面（需要登录）
  {
    resource: 'page:workspace',
    roles: [Role.USER, Role.DISTRIBUTOR, Role.ADMIN, Role.SUPER_ADMIN],
    description: '工作台页面访问权限',
  },

  // 艹，会员套餐页面（需要登录）
  {
    resource: 'page:membership',
    roles: [Role.USER, Role.DISTRIBUTOR, Role.ADMIN, Role.SUPER_ADMIN],
    description: '会员套餐页面访问权限',
  },

  // 艹，分销中心（需要分销商角色）
  {
    resource: 'page:distribution',
    roles: [Role.DISTRIBUTOR, Role.ADMIN, Role.SUPER_ADMIN],
    description: '分销中心页面访问权限',
  },

  // 艹，管理后台（需要管理员角色）
  {
    resource: 'page:admin',
    roles: [Role.ADMIN, Role.SUPER_ADMIN],
    description: '管理后台访问权限',
  },

  // ==================== 功能权限 ====================

  // 艹，上传图片（需要登录）
  {
    resource: 'feature:upload',
    roles: [Role.USER, Role.DISTRIBUTOR, Role.ADMIN, Role.SUPER_ADMIN],
    description: '上传图片功能权限',
  },

  // 艹，AI处理（需要登录且有配额）
  {
    resource: 'feature:ai_process',
    roles: [Role.USER, Role.DISTRIBUTOR, Role.ADMIN, Role.SUPER_ADMIN],
    description: 'AI处理功能权限',
  },

  // 艹，导出数据（需要管理员）
  {
    resource: 'feature:export',
    roles: [Role.ADMIN, Role.SUPER_ADMIN],
    description: '导出数据功能权限',
  },

  // 艹，查看统计（需要管理员）
  {
    resource: 'feature:statistics',
    roles: [Role.ADMIN, Role.SUPER_ADMIN],
    description: '查看统计数据权限',
  },

  // ==================== 操作权限 ====================

  // 艹，创建任务（需要登录）
  {
    resource: 'action:task:create',
    roles: [Role.USER, Role.DISTRIBUTOR, Role.ADMIN, Role.SUPER_ADMIN],
    description: '创建任务权限',
  },

  // 艹，删除任务（管理员或任务所有者）
  {
    resource: 'action:task:delete',
    roles: [Role.ADMIN, Role.SUPER_ADMIN],
    description: '删除任务权限',
  },

  // 艹，管理用户（需要管理员）
  {
    resource: 'action:user:manage',
    roles: [Role.ADMIN, Role.SUPER_ADMIN],
    description: '管理用户权限',
  },

  // 艹，系统配置（需要超级管理员）
  {
    resource: 'action:system:config',
    roles: [Role.SUPER_ADMIN],
    description: '系统配置权限',
  },
];

/**
 * 根据资源获取权限规则
 * 艹，查找对应的权限配置！
 */
export function getPermissionRule(resource: string): PermissionRule | undefined {
  return PERMISSION_RULES.find((rule) => rule.resource === resource);
}

/**
 * 检查用户角色是否有权限访问资源
 * 艹，核心权限检查逻辑！
 */
export function hasPermission(userRoles: string[], resource: string): boolean {
  const rule = getPermissionRule(resource);

  // 艹，没有配置权限规则，默认拒绝访问
  if (!rule) {
    console.warn(`[Permission] 资源 "${resource}" 没有权限配置，默认拒绝访问`);
    return false;
  }

  // 艹，检查用户角色是否在允许列表中
  const hasAccess = rule.roles.some((role) => userRoles.includes(role));

  console.log(`[Permission] 检查资源 "${resource}":`, {
    userRoles,
    requiredRoles: rule.roles,
    hasAccess,
  });

  return hasAccess;
}

/**
 * 批量检查权限
 * 艹，检查多个资源权限！
 */
export function hasAnyPermission(userRoles: string[], resources: string[]): boolean {
  return resources.some((resource) => hasPermission(userRoles, resource));
}

/**
 * 检查是否拥有所有权限
 */
export function hasAllPermissions(userRoles: string[], resources: string[]): boolean {
  return resources.every((resource) => hasPermission(userRoles, resource));
}
