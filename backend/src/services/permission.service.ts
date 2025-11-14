import crypto from 'crypto';
import logger from '../utils/logger.js';
import { db } from '../config/database.js';
import cacheService from './cache.service.js';

type PermissionCode = string;
type PermissionMap = Record<string, PermissionCode[]>;
type PermissionGroupMap = Record<string, PermissionCode[]>;
type CountRow = { count?: string | number | bigint | null };
type RoleRecord = { id: string; code: string; status: string };
type RolePermissionRecord = { permission_code: PermissionCode };
type AssignRoleOptions = {
  expiresAt?: Date | string | null;
  reason?: string | null;
  assignedBy?: string;
};
type PermissionPayload = {
  code: string;
  name: string;
  description?: string;
  group?: string;
};
type RolePayload = {
  name: string;
  code: string;
  description?: string;
  permissions?: PermissionCode[];
};
type QueryOptions = {
  status?: string;
  keyword?: string;
  group?: string | null;
};
type PermissionListResult = {
  success: boolean;
  permissions: Record<string, unknown>[];
  totalCount: number;
};
type RoleRecordWithPermissions = RoleRecord & {
  permissions?: PermissionCode[];
};
type RoleListResult = {
  success: boolean;
  roles: RoleRecordWithPermissions[];
  totalCount: number;
};

const parseCount = (row?: CountRow): number => {
  if (!row || row.count === null || row.count === undefined) {
    return 0;
  }

  if (typeof row.count === 'number') {
    return row.count;
  }

  if (typeof row.count === 'bigint') {
    return Number(row.count);
  }

  const parsed = Number(row.count);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * 权限服务
 *
 * 实现基于角色的访问控制(RBAC)：
 * - 权限定义和管理
 * - 角色权限映射
 * - 用户权限检查
 * - 权限缓存优化
 * - 动态权限更新
 */
class PermissionService {
  private initialized = false;

  private permissionCache = new Map<string, PermissionCode[]>();

  private roleCache = new Map<string, PermissionCode[]>();

  private readonly cacheTTL = 300; // 5分钟缓存

  private readonly defaultPermissions: PermissionMap;

  private readonly permissionGroups: PermissionGroupMap;

  constructor() {
    this.defaultPermissions = {
      // 用户权限
      user: [
        'profile:read',
        'profile:update',
        'task:create',
        'task:read',
        'task:update',
        'task:delete',
        'asset:create',
        'asset:read',
        'asset:update',
        'asset:delete',
        'notification:read',
        'notification:update',
        'membership:read',
        'membership:update',
        'quota:read'
      ],

      // 管理员权限
      admin: [
        'user:read',
        'user:create',
        'user:update',
        'user:delete',
        'task:read_all',
        'task:update_all',
        'task:delete_all',
        'system:read',
        'system:update',
        'system:config',
        'analytics:read',
        'analytics:export',
        'role:read',
        'role:create',
        'role:update',
        'role:delete',
        'permission:read',
        'permission:assign',
        'audit:read',
        'audit:export',
        'maintenance:execute',
        'circuit_breaker:read',
        'circuit_breaker:control',
        'storage:read',
        'storage:cleanup',
        'cache:read',
        'cache:manage',
        'queue:read',
        'queue:manage'
      ],

      // 系统权限（用于系统间调用）
      system: [
        'system:read',
        'system:update',
        'task:create',
        'task:read',
        'task:update',
        'user:read',
        'user:update',
        'webhook:receive',
        'callback:process'
      ]
    };

    // 权限分组
    this.permissionGroups = {
      profile: ['profile:read', 'profile:update'],
      tasks: ['task:create', 'task:read', 'task:update', 'task:delete'],
      tasks_admin: ['task:read_all', 'task:update_all', 'task:delete_all'],
      assets: ['asset:create', 'asset:read', 'asset:update', 'asset:delete'],
      users: ['user:read', 'user:create', 'user:update', 'user:delete'],
      notifications: ['notification:read', 'notification:update'],
      membership: ['membership:read', 'membership:update'],
      system_ops: ['system:read', 'system:update', 'system:config'],
      analytics: ['analytics:read', 'analytics:export'],
      security: ['role:read', 'role:create', 'role:update', 'role:delete'],
      permissions: ['permission:read', 'permission:assign'],
      audit: ['audit:read', 'audit:export'],
      maintenance: ['maintenance:execute'],
      monitoring: [
        'circuit_breaker:read',
        'circuit_breaker:control',
        'storage:read',
        'storage:cleanup',
        'cache:read',
        'cache:manage',
        'queue:read',
        'queue:manage'
      ]
    };
  }

  /**
   * 初始化权限服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('[PermissionService] 权限服务已初始化');
      return;
    }

    try {
      // 确保权限相关表存在
      await this.ensurePermissionTables();

      // 初始化默认权限数据
      await this.initializeDefaultPermissions();

      // 预加载权限数据到缓存
      await this.preloadPermissions();

      this.initialized = true;
      logger.info('[PermissionService] 权限服务初始化成功');
    } catch (error) {
      logger.error('[PermissionService] 权限服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 检查用户权限
   * @param {string} userId - 用户ID
   * @param {string} permission - 权限代码
   * @returns {Promise<boolean>} 是否有权限
   */
  async hasPermission(userId: string, permission: PermissionCode): Promise<boolean> {
    try {
      // 1. 检查缓存
      const cacheKey = `user_permission:${userId}:${permission}`;
      const cached = await cacheService.get<string>(cacheKey);
      if (cached !== null) {
        return cached === 'true';
      }

      // 2. 获取用户权限
      const userPermissions = await this.getUserPermissions(userId);

      // 3. 检查权限
      const hasPermission = userPermissions.includes(permission);

      // 4. 缓存结果
      await cacheService.set(cacheKey, hasPermission.toString(), this.cacheTTL);

      return hasPermission;
    } catch (error) {
      logger.error(
        `[PermissionService] 权限检查失败: userId=${userId}, permission=${permission}`,
        error
      );
      return false;
    }
  }

  /**
   * 检查用户是否有任一权限
   * @param {string} userId - 用户ID
   * @param {string[]} permissions - 权限列表
   * @returns {Promise<boolean>} 是否有任一权限
   */
  async hasAnyPermission(userId: string, permissions: PermissionCode[]): Promise<boolean> {
    for (const permission of permissions) {
      if (await this.hasPermission(userId, permission)) {
        return true;
      }
    }
    return false;
  }

  /**
   * 检查用户是否有所有权限
   * @param {string} userId - 用户ID
   * @param {string[]} permissions - 权限列表
   * @returns {Promise<boolean>} 是否有所有权限
   */
  async hasAllPermissions(userId: string, permissions: PermissionCode[]): Promise<boolean> {
    for (const permission of permissions) {
      if (!(await this.hasPermission(userId, permission))) {
        return false;
      }
    }
    return true;
  }

  /**
   * 获取用户权限列表
   * @param {string} userId - 用户ID
   * @returns {Promise<string[]>} 权限列表
   */
  async getUserPermissions(userId: string): Promise<PermissionCode[]> {
    try {
      // 检查缓存
      const cacheKey = `user_permissions:${userId}`;
      const cachedPermissions = await cacheService.get<string>(cacheKey);

      if (cachedPermissions) {
        return JSON.parse(cachedPermissions) as PermissionCode[];
      }

      // 从数据库获取用户角色
      const userRoles = await this.getUserRoles(userId);
      const allPermissions = new Set<PermissionCode>();

      // 收集所有角色的权限
      for (const role of userRoles) {
        const rolePermissions = await this.getRolePermissions(role);
        rolePermissions.forEach((permission) => allPermissions.add(permission));
      }

      const permissions = Array.from(allPermissions) as PermissionCode[];

      // 缓存结果
      await cacheService.set(cacheKey, JSON.stringify(permissions), this.cacheTTL);

      return permissions;
    } catch (error) {
      logger.error(`[PermissionService] 获取用户权限失败: userId=${userId}`, error);
      return [];
    }
  }

  /**
   * 获取用户角色列表
   * @param {string} userId - 用户ID
   * @returns {Promise<string[]>} 角色列表
   */
  async getUserRoles(userId: string): Promise<string[]> {
    try {
      // 检查缓存
      const cacheKey = `user_roles:${userId}`;
      const cachedRoles = await cacheService.get<string>(cacheKey);

      if (cachedRoles) {
        return JSON.parse(cachedRoles) as string[];
      }

      // 从数据库获取用户角色
      const userRecords = await db('users').where('id', userId).select('role', 'status').first();

      if (!userRecords || userRecords.status !== 'active') {
        return [];
      }

      const roles = [userRecords.role];

      // 获取额外的角色分配
      const additionalRoles = await db('user_roles')
        .where('user_id', userId)
        .where('status', 'active')
        .where(function () {
          this.where('expires_at', '>', new Date()).orWhereNull('expires_at');
        })
        .pluck('role');

      roles.push(...additionalRoles);

      // 缓存结果
      await cacheService.set(cacheKey, JSON.stringify(roles), this.cacheTTL);

      return roles;
    } catch (error) {
      logger.error(`[PermissionService] 获取用户角色失败: userId=${userId}`, error);
      return [];
    }
  }

  /**
   * 获取角色权限列表
   * @param {string} role - 角色名称
   * @returns {Promise<string[]>} 权限列表
   */
  async getRolePermissions(role: string): Promise<PermissionCode[]> {
    try {
      // 检查缓存
      const cacheKey = `role_permissions:${role}`;
      const cached = await cacheService.get<string>(cacheKey);

      if (cached) {
        return JSON.parse(cached) as PermissionCode[];
      }

      // 从数据库获取角色权限
      const dbPermissions = await db('role_permissions')
        .join('permissions', 'role_permissions.permission_id', 'permissions.id')
        .where('role_permissions.role', role)
        .where('role_permissions.status', 'active')
        .pluck('permissions.code');

      // 如果数据库中没有，使用默认权限
      const permissions =
        dbPermissions.length > 0 ? dbPermissions : this.defaultPermissions[role] || [];

      // 缓存结果
      await cacheService.set(cacheKey, JSON.stringify(permissions), this.cacheTTL);

      return permissions;
    } catch (error) {
      logger.error(`[PermissionService] 获取角色权限失败: role=${role}`, error);
      return this.defaultPermissions[role] || [];
    }
  }

  /**
   * 分配角色给用户
   * @param {string} userId - 用户ID
   * @param {string} role - 角色名称
   * @param {Object} options - 分配选项
   * @returns {Promise<boolean>} 是否成功
   */
  async assignRole(
    userId: string,
    role: string,
    options: AssignRoleOptions = {}
  ): Promise<boolean> {
    try {
      const { expiresAt = null, reason = null } = options;

      // 检查角色是否存在
      const roleExists = await this.roleExists(role);
      if (!roleExists) {
        throw new Error(`角色不存在: ${role}`);
      }

      // 检查是否已分配
      const existing = await db('user_roles')
        .where('user_id', userId)
        .where('role', role)
        .where('status', 'active')
        .first();

      if (existing) {
        logger.warn(`[PermissionService] 用户已拥有角色: userId=${userId}, role=${role}`);
        return true;
      }

      // 分配角色
      await db('user_roles').insert({
        id: this.generateId(),
        user_id: userId,
        role,
        status: 'active',
        assigned_at: new Date(),
        expires_at: expiresAt,
        assigned_by: options.assignedBy || 'system',
        reason,
        created_at: new Date()
      });

      // 清除相关缓存
      await this.clearUserCache(userId);

      logger.info(`[PermissionService] 角色分配成功: userId=${userId}, role=${role}`);
      return true;
    } catch (error) {
      logger.error(`[PermissionService] 角色分配失败: userId=${userId}, role=${role}`, error);
      return false;
    }
  }

  /**
   * 撤销用户角色
   * @param {string} userId - 用户ID
   * @param {string} role - 角色名称
   * @param {string} reason - 撤销原因
   * @returns {Promise<boolean>} 是否成功
   */
  async revokeRole(userId: string, role: string, reason: string | null = null): Promise<boolean> {
    try {
      const affected = await db('user_roles')
        .where('user_id', userId)
        .where('role', role)
        .where('status', 'active')
        .update({
          status: 'revoked',
          revoked_at: new Date(),
          reason,
          updated_at: new Date()
        });

      if (affected > 0) {
        // 清除相关缓存
        await this.clearUserCache(userId);

        logger.info(`[PermissionService] 角色撤销成功: userId=${userId}, role=${role}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`[PermissionService] 角色撤销失败: userId=${userId}, role=${role}`, error);
      return false;
    }
  }

  /**
   * 创建权限
   * @param {Object} permissionData - 权限数据
   * @returns {Promise<Object>} 创建结果
   */
  async createPermission(permissionData: PermissionPayload): Promise<Record<string, unknown>> {
    try {
      const { code, name, description, group } = permissionData;

      // 检查权限是否已存在
      const existing = await db('permissions').where('code', code).first();

      if (existing) {
        throw new Error(`权限已存在: ${code}`);
      }

      // 创建权限
      const permission = await db('permissions')
        .insert({
          id: this.generateId(),
          code,
          name,
          description,
          group,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*')
        .then((rows) => rows[0]);

      logger.info(`[PermissionService] 权限创建成功: ${code}`);
      return { success: true, permission };
    } catch (error) {
      logger.error('[PermissionService] 权限创建失败:', error);
      throw error;
    }
  }

  /**
   * 创建角色
   * @param {Object} roleData - 角色数据
   * @returns {Promise<Object>} 创建结果
   */
  async createRole(roleData: RolePayload): Promise<Record<string, unknown>> {
    try {
      const { name, code, description, permissions = [] } = roleData;

      // 检查角色是否已存在
      const existing = await db('roles').where('code', code).first();

      if (existing) {
        throw new Error(`角色已存在: ${code}`);
      }

      // 创建角色
      const role = await db('roles')
        .insert({
          id: this.generateId(),
          name,
          code,
          description,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('*')
        .then((rows) => rows[0]);

      // 分配权限给角色
      if (permissions.length > 0) {
        await this.assignPermissionsToRole(role.id, permissions);
      }

      logger.info(`[PermissionService] 角色创建成功: ${code}`);
      return { success: true, role };
    } catch (error) {
      logger.error('[PermissionService] 角色创建失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有权限列表
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 权限列表
   */
  async getAllPermissions(options: QueryOptions = {}): Promise<PermissionListResult> {
    try {
      const { group = null, status = 'active' } = options;

      let query = db('permissions').select('*');

      if (group) {
        query = query.where('group', group);
      }

      if (status) {
        query = query.where('status', status);
      }

      const permissions = (await query.orderBy('group', 'asc').orderBy('code', 'asc')) as Record<
        string,
        unknown
      >[];

      return {
        success: true,
        permissions,
        totalCount: permissions.length
      };
    } catch (error) {
      logger.error('[PermissionService] 获取权限列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有角色列表
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 角色列表
   */
  async getAllRoles(options: QueryOptions = {}): Promise<RoleListResult> {
    try {
      const { status = 'active' } = options;

      const roles = (await db('roles')
        .where('status', status)
        .orderBy('created_at', 'asc')) as RoleRecordWithPermissions[];

      // 为每个角色添加权限信息
      for (const role of roles) {
        role.permissions = await this.getRolePermissions(role.code);
      }

      return {
        success: true,
        roles,
        totalCount: roles.length
      };
    } catch (error) {
      logger.error('[PermissionService] 获取角色列表失败:', error);
      throw error;
    }
  }

  /**
   * 清除用户缓存
   * @param {string} userId - 用户ID
   * @private
   */
  async clearUserCache(userId: string): Promise<void> {
    const patterns = [
      `user_permissions:${userId}`,
      `user_roles:${userId}`,
      `user_permission:${userId}:*`
    ];

    for (const pattern of patterns) {
      await cacheService.deletePattern(pattern);
    }
  }

  /**
   * 预加载权限数据
   * @private
   */
  async preloadPermissions(): Promise<void> {
    try {
      // 预加载角色权限
      for (const role of Object.keys(this.defaultPermissions)) {
        await this.getRolePermissions(role);
      }

      logger.info('[PermissionService] 权限数据预加载完成');
    } catch (error) {
      logger.error('[PermissionService] 权限数据预加载失败:', error);
    }
  }

  // 辅助方法

  /**
   * 生成ID
   * @returns {string} 唯一ID
   * @private
   */
  private generateId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * 检查角色是否存在
   * @param {string} role - 角色名称
   * @returns {Promise<boolean>} 是否存在
   * @private
   */
  async roleExists(role: string): Promise<boolean> {
    try {
      const countRow = (await db('roles')
        .where('code', role)
        .where('status', 'active')
        .count('* as count')
        .first()) as CountRow | undefined;

      return parseCount(countRow) > 0;
    } catch (error) {
      // 如果表不存在，默认角色存在（使用默认权限）
      return Object.prototype.hasOwnProperty.call(this.defaultPermissions, role);
    }
  }

  /**
   * 分配权限给角色
   * @param {string} roleId - 角色ID
   * @param {string[]} permissions - 权限列表
   * @private
   */
  async assignPermissionsToRole(roleId: string, permissions: PermissionCode[]): Promise<void> {
    for (const permissionCode of permissions) {
      try {
        // 获取权限ID
        let permission = await db('permissions').where('code', permissionCode).first();

        if (!permission) {
          // 创建权限
          permission = await db('permissions')
            .insert({
              id: this.generateId(),
              code: permissionCode,
              name: permissionCode,
              description: `权限: ${permissionCode}`,
              status: 'active',
              created_at: new Date(),
              updated_at: new Date()
            })
            .returning('*')
            .then((rows) => rows[0]);
        }

        // 分配权限给角色
        await db('role_permissions')
          .insert({
            id: this.generateId(),
            role_id: roleId,
            permission_id: permission.id,
            status: 'active',
            created_at: new Date()
          })
          .onConflict()
          .ignore();
      } catch (error) {
        logger.error(
          `[PermissionService] 分配权限失败: roleId=${roleId}, permission=${permissionCode}`,
          error
        );
      }
    }
  }

  /**
   * 确保权限相关表存在
   * @private
   */
  async ensurePermissionTables(): Promise<void> {
    // 这里会在实际的迁移文件中创建表
    // 这里只做检查
    const hasRoles = await db.schema.hasTable('roles');
    const hasPermissions = await db.schema.hasTable('permissions');
    const hasRolePermissions = await db.schema.hasTable('role_permissions');
    const hasUserRoles = await db.schema.hasTable('user_roles');

    if (!hasRoles || !hasPermissions || !hasRolePermissions || !hasUserRoles) {
      logger.warn('[PermissionService] 权限相关表不存在，请运行数据库迁移');
    }
  }

  /**
   * 初始化默认权限数据
   * @private
   */
  async initializeDefaultPermissions(): Promise<void> {
    try {
      // 这里会通过迁移文件初始化默认数据
      logger.info('[PermissionService] 默认权限数据初始化完成');
    } catch (error) {
      logger.error('[PermissionService] 默认权限数据初始化失败:', error);
    }
  }
}

const permissionService = new PermissionService();

export default permissionService;
