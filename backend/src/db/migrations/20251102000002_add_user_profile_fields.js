/**
 * BE-USER-001: 添加用户资料字段
 *
 * 完善用户信息，支持更多用户属性
 */
exports.up = function(knex) {
  return knex.schema.table('users', (table) => {
    // 基本信息
    table.string('nickname', 50).nullable().comment('昵称');
    table.string('avatar', 500).nullable().comment('头像URL');
    table.string('email', 100).nullable().comment('邮箱');

    // 用户状态
    table.enum('status', ['active', 'inactive', 'banned'])
      .notNullable()
      .defaultTo('active')
      .comment('用户状态');

    // 会员信息
    table.datetime('member_start_at').nullable().comment('会员开始时间');
    table.datetime('member_expire_at').nullable().comment('会员过期时间');
    table.string('member_level', 20).defaultTo('basic').comment('会员等级');

    // 推荐信息
    table.string('referrer_id', 32).nullable().comment('推荐人ID');
    table.string('invite_code', 20).nullable().unique().comment('邀请码');

    // 统计信息
    table.integer('total_tasks').unsigned().defaultTo(0).comment('总任务数');
    table.integer('success_tasks').unsigned().defaultTo(0).comment('成功任务数');
    table.decimal('total_spent', 10, 2).defaultTo(0).comment('总消费金额');

    // 安全信息
    table.string('last_login_ip', 45).nullable().comment('最后登录IP');
    table.datetime('last_login_at').nullable().comment('最后登录时间');
    table.string('login_device', 100).nullable().comment('登录设备');

    // 设置偏好
    table.json('preferences').nullable().comment('用户偏好设置');
    table.string('timezone', 50).defaultTo('Asia/Shanghai').comment('时区');
    table.string('language', 10).defaultTo('zh-CN').comment('语言');

    // 审计字段
    table.string('created_ip', 45).nullable().comment('注册IP');
    table.string('created_device', 100).nullable().comment('注册设备');

    // 索引
    table.index('status', 'idx_users_status');
    table.index(['member_expire_at', 'isMember'], 'idx_users_member');
    table.index('referrer_id', 'idx_users_referrer');
    table.index('invite_code', 'idx_users_invite_code');
    table.index('last_login_at', 'idx_users_last_login');
    table.index('created_at', 'idx_users_created');
  });
};

exports.down = function(knex) {
  return knex.schema.table('users', (table) => {
    // 删除字段（SQLite不支持，MySQL可以）
    table.dropColumn('nickname');
    table.dropColumn('avatar');
    table.dropColumn('email');
    table.dropColumn('status');
    table.dropColumn('member_start_at');
    table.dropColumn('member_expire_at');
    table.dropColumn('member_level');
    table.dropColumn('referrer_id');
    table.dropColumn('invite_code');
    table.dropColumn('total_tasks');
    table.dropColumn('success_tasks');
    table.dropColumn('total_spent');
    table.dropColumn('last_login_ip');
    table.dropColumn('last_login_at');
    table.dropColumn('login_device');
    table.dropColumn('preferences');
    table.dropColumn('timezone');
    table.dropColumn('language');
    table.dropColumn('created_ip');
    table.dropColumn('created_device');
  });
};