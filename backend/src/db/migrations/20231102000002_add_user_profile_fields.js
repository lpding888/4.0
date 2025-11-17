/**
 * BE-USER-001: 添加用户资料字段
 *
 * 完善用户信息，支持更多用户属性
 */
exports.up = async function (knex) {
  const addColumnIfMissing = async (column, builder) => {
    const exists = await knex.schema.hasColumn('users', column);
    if (exists) return;
    await knex.schema.table('users', (table) => {
      builder(table);
    });
  };

  const ensureIndex = async (indexName, builder) => {
    const [rows] = await knex.raw('SHOW INDEX FROM ?? WHERE Key_name = ?', ['users', indexName]);
    if (rows.length > 0) {
      return;
    }
    await knex.schema.table('users', (table) => {
      builder(table);
    });
  };

  await addColumnIfMissing('nickname', (table) =>
    table.string('nickname', 50).nullable().comment('昵称')
  );
  await addColumnIfMissing('avatar', (table) =>
    table.string('avatar', 500).nullable().comment('头像URL')
  );
  await addColumnIfMissing('email', (table) =>
    table.string('email', 100).nullable().comment('邮箱')
  );
  await addColumnIfMissing('status', (table) =>
    table
      .enum('status', ['active', 'inactive', 'banned'])
      .notNullable()
      .defaultTo('active')
      .comment('用户状态')
  );
  await addColumnIfMissing('member_start_at', (table) =>
    table.datetime('member_start_at').nullable().comment('会员开始时间')
  );
  await addColumnIfMissing('member_expire_at', (table) =>
    table.datetime('member_expire_at').nullable().comment('会员过期时间')
  );
  await addColumnIfMissing('member_level', (table) =>
    table.string('member_level', 20).defaultTo('basic').comment('会员等级')
  );
  await addColumnIfMissing('referrer_id', (table) =>
    table.string('referrer_id', 32).nullable().comment('推荐人ID')
  );
  await addColumnIfMissing('invite_code', (table) =>
    table.string('invite_code', 20).nullable().unique().comment('邀请码')
  );
  await addColumnIfMissing('total_tasks', (table) =>
    table.integer('total_tasks').unsigned().defaultTo(0).comment('总任务数')
  );
  await addColumnIfMissing('success_tasks', (table) =>
    table.integer('success_tasks').unsigned().defaultTo(0).comment('成功任务数')
  );
  await addColumnIfMissing('total_spent', (table) =>
    table.decimal('total_spent', 10, 2).defaultTo(0).comment('总消费金额')
  );
  await addColumnIfMissing('last_login_ip', (table) =>
    table.string('last_login_ip', 45).nullable().comment('最后登录IP')
  );
  await addColumnIfMissing('last_login_at', (table) =>
    table.datetime('last_login_at').nullable().comment('最后登录时间')
  );
  await addColumnIfMissing('login_device', (table) =>
    table.string('login_device', 100).nullable().comment('登录设备')
  );
  await addColumnIfMissing('preferences', (table) =>
    table.json('preferences').nullable().comment('用户偏好设置')
  );
  await addColumnIfMissing('timezone', (table) =>
    table.string('timezone', 50).defaultTo('Asia/Shanghai').comment('时区')
  );
  await addColumnIfMissing('language', (table) =>
    table.string('language', 10).defaultTo('zh-CN').comment('语言')
  );
  await addColumnIfMissing('created_ip', (table) =>
    table.string('created_ip', 45).nullable().comment('注册IP')
  );
  await addColumnIfMissing('created_device', (table) =>
    table.string('created_device', 100).nullable().comment('注册设备')
  );

  await ensureIndex('idx_users_status', (table) => table.index('status', 'idx_users_status'));
  await ensureIndex('idx_users_member', (table) =>
    table.index(['member_expire_at', 'isMember'], 'idx_users_member')
  );
  await ensureIndex('idx_users_referrer', (table) =>
    table.index('referrer_id', 'idx_users_referrer')
  );
  await ensureIndex('idx_users_invite_code', (table) =>
    table.index('invite_code', 'idx_users_invite_code')
  );
  await ensureIndex('idx_users_last_login', (table) =>
    table.index('last_login_at', 'idx_users_last_login')
  );
  await ensureIndex('idx_users_created', (table) => table.index('created_at', 'idx_users_created'));
};

exports.down = async function (knex) {
  const dropColumnIfExists = async (column) => {
    const exists = await knex.schema.hasColumn('users', column);
    if (!exists) return;
    await knex.schema.table('users', (table) => {
      table.dropColumn(column);
    });
  };

  const columns = [
    'nickname',
    'avatar',
    'email',
    'status',
    'member_start_at',
    'member_expire_at',
    'member_level',
    'referrer_id',
    'invite_code',
    'total_tasks',
    'success_tasks',
    'total_spent',
    'last_login_ip',
    'last_login_at',
    'login_device',
    'preferences',
    'timezone',
    'language',
    'created_ip',
    'created_device'
  ];

  for (const column of columns) {
    // eslint-disable-next-line no-await-in-loop
    await dropColumnIfExists(column);
  }
};
