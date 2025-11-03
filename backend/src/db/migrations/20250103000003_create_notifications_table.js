/**
 * 创建notifications表
 * 用于存储用户通知记录
 */
exports.up = function(knex) {
  return knex.schema.createTable('notifications', (table) => {
    // 主键
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));

    // 关联用户
    table.string('user_id', 36).notNullable().comment('用户ID');

    // 通知类型
    table.enum('type', [
      'task_completed',
      'task_failed',
      'quota_low',
      'system_maintenance',
      'payment_success',
      'payment_failed',
      'membership_expired',
      'promotion'
    ]).notNullable().comment('通知类型');

    // 通知内容
    table.string('title', 200).notNullable().comment('通知标题');
    table.text('message').notNullable().comment('通知内容');
    table.json('data').nullable().comment('附加数据');

    // 通知状态
    table.boolean('read').defaultTo(false).comment('是否已读');
    table.datetime('read_at').nullable().comment('阅读时间');

    // 通知渠道
    table.json('channels').nullable().comment('通知渠道');

    // 优先级
    table.enum('priority', ['low', 'normal', 'high', 'urgent'])
      .defaultTo('normal')
      .comment('通知优先级');

    // 时间戳
    table.timestamps(true, true);

    // 索引
    table.index('user_id', 'idx_notifications_user');
    table.index('type', 'idx_notifications_type');
    table.index(['user_id', 'read'], 'idx_notifications_user_read');
    table.index(['user_id', 'created_at'], 'idx_notifications_user_time');
    table.index('read', 'idx_notifications_read');
    table.index('created_at', 'idx_notifications_created');
    table.index(['type', 'read'], 'idx_notifications_type_read');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('notifications');
};