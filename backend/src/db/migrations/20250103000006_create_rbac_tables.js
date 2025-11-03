/**
 * 创建RBAC权限管理相关表
 * 包含：permissions, roles, role_permissions, user_roles
 */
exports.up = function(knex) {
  return Promise.all([
    // 创建权限表
    knex.schema.createTable('permissions', (table) => {
      table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
      table.string('code', 100).notNullable().unique().comment('权限代码');
      table.string('name', 100).notNullable().comment('权限名称');
      table.text('description').nullable().comment('权限描述');
      table.string('group', 50).nullable().comment('权限分组');
      table.enum('status', ['active', 'inactive']).defaultTo('active').comment('状态');
      table.json('metadata').nullable().comment('扩展元数据');
      table.datetime('created_at').defaultTo(knex.raw('CURRENT_TIMESTAMP'));
      table.datetime('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

      // 索引
      table.index('code', 'idx_permissions_code');
      table.index('group', 'idx_permissions_group');
      table.index('status', 'idx_permissions_status');
    }),

    // 创建角色表
    knex.schema.createTable('roles', (table) => {
      table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
      table.string('code', 50).notNullable().unique().comment('角色代码');
      table.string('name', 100).notNullable().comment('角色名称');
      table.text('description').nullable().comment('角色描述');
      table.enum('status', ['active', 'inactive']).defaultTo('active').comment('状态');
      table.integer('level').defaultTo(0).comment('角色级别');
      table.json('metadata').nullable().comment('扩展元数据');
      table.datetime('created_at').defaultTo(knex.raw('CURRENT_TIMESTAMP'));
      table.datetime('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

      // 索引
      table.index('code', 'idx_roles_code');
      table.index('status', 'idx_roles_status');
      table.index('level', 'idx_roles_level');
    }),

    // 创建角色权限关联表
    knex.schema.createTable('role_permissions', (table) => {
      table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
      table.string('role_id', 36).notNullable().comment('角色ID');
      table.string('permission_id', 36).notNullable().comment('权限ID');
      table.string('role', 50).notNullable().comment('角色代码（冗余字段）');
      table.enum('status', ['active', 'inactive']).defaultTo('active').comment('状态');
      table.text('notes').nullable().comment('备注');
      table.datetime('created_at').defaultTo(knex.raw('CURRENT_TIMESTAMP'));
      table.datetime('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

      // 外键约束
      table.foreign('role_id').references('id').inTable('roles').onDelete('CASCADE');
      table.foreign('permission_id').references('id').inTable('permissions').onDelete('CASCADE');

      // 唯一约束
      table.unique(['role_id', 'permission_id'], 'uk_role_permissions');

      // 索引
      table.index('role', 'idx_role_permissions_role');
      table.index('permission_id', 'idx_role_permissions_permission');
      table.index('status', 'idx_role_permissions_status');
    }),

    // 创建用户角色关联表
    knex.schema.createTable('user_roles', (table) => {
      table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
      table.string('user_id', 36).notNullable().comment('用户ID');
      table.string('role', 50).notNullable().comment('角色代码');
      table.enum('status', ['active', 'revoked', 'expired']).defaultTo('active').comment('状态');
      table.datetime('assigned_at').defaultTo(knex.raw('CURRENT_TIMESTAMP')).comment('分配时间');
      table.datetime('expires_at').nullable().comment('过期时间');
      table.datetime('revoked_at').nullable().comment('撤销时间');
      table.string('assigned_by', 36).nullable().comment('分配人');
      table.text('reason').nullable().comment('分配/撤销原因');
      table.json('metadata').nullable().comment('扩展元数据');
      table.datetime('created_at').defaultTo(knex.raw('CURRENT_TIMESTAMP'));
      table.datetime('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

      // 唯一约束（同一用户的同一角色只能有一个活跃记录）
      table.unique(['user_id', 'role', 'status'], 'uk_user_roles_active');

      // 索引
      table.index('user_id', 'idx_user_roles_user');
      table.index('role', 'idx_user_roles_role');
      table.index('status', 'idx_user_roles_status');
      table.index('expires_at', 'idx_user_roles_expires');
      table.index(['user_id', 'status'], 'idx_user_roles_user_status');
    })
  ]).then(async () => {
    // 插入默认数据
    const now = new Date();

    // 插入默认权限
    await knex('permissions').insert([
      // 用户权限
      { id: knex.raw('(UUID())'), code: 'profile:read', name: '查看个人资料', group: 'profile', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'profile:update', name: '更新个人资料', group: 'profile', status: 'active', created_at: now, updated_at: now },

      // 任务权限
      { id: knex.raw('(UUID())'), code: 'task:create', name: '创建任务', group: 'tasks', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'task:read', name: '查看任务', group: 'tasks', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'task:update', name: '更新任务', group: 'tasks', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'task:delete', name: '删除任务', group: 'tasks', status: 'active', created_at: now, updated_at: now },

      // 资产权限
      { id: knex.raw('(UUID())'), code: 'asset:create', name: '创建资产', group: 'assets', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'asset:read', name: '查看资产', group: 'assets', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'asset:update', name: '更新资产', group: 'assets', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'asset:delete', name: '删除资产', group: 'assets', status: 'active', created_at: now, updated_at: now },

      // 通知权限
      { id: knex.raw('(UUID())'), code: 'notification:read', name: '查看通知', group: 'notifications', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'notification:update', name: '更新通知', group: 'notifications', status: 'active', created_at: now, updated_at: now },

      // 会员权限
      { id: knex.raw('(UUID())'), code: 'membership:read', name: '查看会员信息', group: 'membership', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'membership:update', name: '更新会员信息', group: 'membership', status: 'active', created_at: now, updated_at: now },

      // 配额权限
      { id: knex.raw('(UUID())'), code: 'quota:read', name: '查看配额', group: 'quota', status: 'active', created_at: now, updated_at: now },

      // 管理员权限
      { id: knex.raw('(UUID())'), code: 'user:read', name: '查看用户', group: 'users', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'user:create', name: '创建用户', group: 'users', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'user:update', name: '更新用户', group: 'users', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'user:delete', name: '删除用户', group: 'users', status: 'active', created_at: now, updated_at: now },

      { id: knex.raw('(UUID())'), code: 'task:read_all', name: '查看所有任务', group: 'tasks_admin', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'task:update_all', name: '更新所有任务', group: 'tasks_admin', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'task:delete_all', name: '删除所有任务', group: 'tasks_admin', status: 'active', created_at: now, updated_at: now },

      { id: knex.raw('(UUID())'), code: 'system:read', name: '查看系统信息', group: 'system_ops', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'system:update', name: '更新系统信息', group: 'system_ops', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'system:config', name: '系统配置', group: 'system_ops', status: 'active', created_at: now, updated_at: now },

      { id: knex.raw('(UUID())'), code: 'analytics:read', name: '查看分析数据', group: 'analytics', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'analytics:export', name: '导出分析数据', group: 'analytics', status: 'active', created_at: now, updated_at: now },

      { id: knex.raw('(UUID())'), code: 'role:read', name: '查看角色', group: 'security', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'role:create', name: '创建角色', group: 'security', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'role:update', name: '更新角色', group: 'security', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'role:delete', name: '删除角色', group: 'security', status: 'active', created_at: now, updated_at: now },

      { id: knex.raw('(UUID())'), code: 'permission:read', name: '查看权限', group: 'permissions', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'permission:assign', name: '分配权限', group: 'permissions', status: 'active', created_at: now, updated_at: now },

      { id: knex.raw('(UUID())'), code: 'audit:read', name: '查看审计日志', group: 'audit', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'audit:export', name: '导出审计日志', group: 'audit', status: 'active', created_at: now, updated_at: now },

      { id: knex.raw('(UUID())'), code: 'maintenance:execute', name: '执行维护操作', group: 'maintenance', status: 'active', created_at: now, updated_at: now },

      // 监控权限
      { id: knex.raw('(UUID())'), code: 'circuit_breaker:read', name: '查看熔断器状态', group: 'monitoring', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'circuit_breaker:control', name: '控制熔断器', group: 'monitoring', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'storage:read', name: '查看存储信息', group: 'monitoring', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'storage:cleanup', name: '清理存储', group: 'monitoring', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'cache:read', name: '查看缓存', group: 'monitoring', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'cache:manage', name: '管理缓存', group: 'monitoring', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'queue:read', name: '查看队列', group: 'monitoring', status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'queue:manage', name: '管理队列', group: 'monitoring', status: 'active', created_at: now, updated_at: now }
    ]);

    // 插入默认角色
    const [userRole, adminRole, systemRole] = await knex('roles').insert([
      { id: knex.raw('(UUID())'), code: 'user', name: '普通用户', description: '系统普通用户', level: 1, status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'admin', name: '管理员', description: '系统管理员', level: 10, status: 'active', created_at: now, updated_at: now },
      { id: knex.raw('(UUID())'), code: 'system', name: '系统', description: '系统服务账户', level: 0, status: 'active', created_at: now, updated_at: now }
    ]).returning(['id', 'code']);

    // 分配权限给角色
    const permissions = await knex('permissions').select('id', 'code');

    // 用户权限
    const userPermissions = permissions.filter(p =>
      ['profile', 'tasks', 'assets', 'notifications', 'membership', 'quota'].includes(p.group)
    );

    // 管理员权限（所有权限）
    const adminPermissions = permissions;

    // 系统权限
    const systemPermissions = permissions.filter(p =>
      ['system_ops', 'tasks', 'users', 'monitoring'].includes(p.group)
    );

    // 插入角色权限关联
    if (userRole && adminRole && systemRole) {
      // 用户角色权限
      for (const permission of userPermissions) {
        await knex('role_permissions').insert({
          id: knex.raw('(UUID())'),
          role_id: userRole.id,
          permission_id: permission.id,
          role: 'user',
          status: 'active',
          created_at: now,
          updated_at: now
        });
      }

      // 管理员角色权限
      for (const permission of adminPermissions) {
        await knex('role_permissions').insert({
          id: knex.raw('(UUID())'),
          role_id: adminRole.id,
          permission_id: permission.id,
          role: 'admin',
          status: 'active',
          created_at: now,
          updated_at: now
        });
      }

      // 系统角色权限
      for (const permission of systemPermissions) {
        await knex('role_permissions').insert({
          id: knex.raw('(UUID())'),
          role_id: systemRole.id,
          permission_id: permission.id,
          role: 'system',
          status: 'active',
          created_at: now,
          updated_at: now
        });
      }
    }

    console.log('RBAC权限管理表创建完成');
  });
};

exports.down = function(knex) {
  return Promise.all([
    knex.schema.dropTableIfExists('user_roles'),
    knex.schema.dropTableIfExists('role_permissions'),
    knex.schema.dropTableIfExists('roles'),
    knex.schema.dropTableIfExists('permissions')
  ]);
};