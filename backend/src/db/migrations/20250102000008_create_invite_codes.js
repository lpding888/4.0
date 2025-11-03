/**
 * 创建邀请码相关表
 *
 * 邀请码系统用于用户邀请和推广：
 * - 邀请码池管理
 * - 邀请码使用记录
 * - 邀请奖励配置
 * - 邀请统计追踪
 */

exports.up = async function(knex) {
  // 邀请码池表
  await knex.schema.createTable('invite_codes', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('code', 20).notNullable().unique().comment('邀请码');
    table.enum('type', ['general', 'vip', 'special', 'limited']).defaultTo('general').comment('邀请码类型');
    table.enum('status', ['active', 'used', 'expired', 'disabled']).defaultTo('active').comment('状态');
    table.string('creator_id', 36).nullable().comment('创建者ID');
    table.string('creator_type', defaultTo('system').comment('创建者类型: system/user/admin');
    table.string('inviter_id', 36).nullable().comment('邀请人ID');
    table.string('invitee_id', 36).nullable().comment('被邀请人ID');
    table.integer('max_uses').defaultTo(1).comment('最大使用次数');
    table.integer('used_count').defaultTo(0).comment('已使用次数');
    table.timestamp('expires_at').nullable().comment('过期时间');
    table.timestamp('used_at').nullable().comment('使用时间');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 索引
    table.index(['code']);
    table.index(['type']);
    table.index(['status']);
    table.index(['creator_id']);
    table.index(['inviter_id']);
    table.index(['invitee_id']);
    table.index(['expires_at']);
    table.index(['created_at']);
  });

  // 邀请码使用记录表
  await knex.schema.createTable('invite_usage_logs', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('invite_code_id', 36).notNullable().comment('邀请码ID');
    table.string('inviter_id', 36).notNullable().comment('邀请人ID');
    table.string('invitee_id', 36).nullable().comment('被邀请人ID');
    table.string('invitee_email').nullable().comment('被邀请人邮箱');
    table.string('invitee_phone').nullable().comment('被邀请人手机号');
    table.enum('status', ['pending', 'success', 'failed']).defaultTo('pending').comment('邀请状态');
    table.json('reward_data').comment('奖励数据');
    table.text('notes').comment('备注');
    table.string('ip_address', 45).nullable().comment('IP地址');
    table.string('user_agent').nullable().comment('用户代理');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 外键约束
    table.foreign('invite_code_id').references('id').inTable('invite_codes').onDelete('CASCADE');

    // 索引
    table.index(['invite_code_id']);
    table.index(['inviter_id']);
    table.index(['invitee_id']);
    table.index(['invitee_email']);
    table.index(['invitee_phone']);
    table.index(['status']);
    table.index(['created_at']);
  });

  // 邀请奖励配置表
  await knex.schema.createTable('invite_rewards', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('name', 100).notNullable().comment('奖励名称');
    table.text('description').comment('奖励描述');
    table.enum('type', ['registration', 'first_order', 'subscription', 'custom']).notNullable().comment('奖励类型');
    table.json('conditions').comment('触发条件');
    table.json('rewards').comment('奖励内容');
    table.boolean('is_active').defaultTo(true).comment('是否激活');
    table.integer('priority').defaultTo(0).comment('优先级');
    table.string('created_by', 36).comment('创建人');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 索引
    table.index(['type']);
    table.index(['is_active']);
    table.index(['priority']);
    table.index(['created_at']);
  });

  // 用户邀请统计表
  await knex.schema.createTable('user_invite_stats', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('user_id', 36).notNullable().comment('用户ID');
    table.integer('total_invites').defaultTo(0).comment('总邀请数');
    table.integer('successful_invites').defaultTo(0).comment('成功邀请数');
    table.integer('pending_invites').defaultTo(0).comment('待确认邀请数');
    table.integer('failed_invites').defaultTo(0).comment('失败邀请数');
    table.decimal('total_rewards', 15, 4).defaultTo(0).comment('总奖励金额');
    table.date('last_invite_date').nullable().comment('最后邀请日期');
    table.json('monthly_stats').comment('月度统计');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 外键约束
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');

    // 唯一约束
    table.unique(['user_id']);

    // 索引
    table.index(['user_id']);
    table.index(['total_invites']);
    table.index(['successful_invites']);
    table.index(['last_invite_date']);
  });

  // 邀请码批量生成记录表
  await knex.schema.createTable('invite_code_batches', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('batch_name', 100).comment('批次名称');
    table.string('description').nullable().comment('批次描述');
    table.enum('type', ['general', 'vip', 'special', 'limited']).notNullable().comment('邀请码类型');
    table.integer('count').notNullable().comment('生成数量');
    table.integer('valid_days').defaultTo(30).comment('有效天数');
    table.integer('max_uses_per_code').defaultTo(1).comment('每个邀请码最大使用次数');
    table.json('generation_config').comment('生成配置');
    table.string('created_by', 36).notNullable().comment('创建人');
    table.timestamp('generated_at').defaultTo(knex.fn.now()).comment('生成时间');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 索引
    table.index(['type']);
    table.index(['created_by']);
    table.index(['generated_at']);
    table.index(['created_at']);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('invite_code_batches');
  await knex.schema.dropTableIfExists('user_invite_stats');
  await knex.schema.dropTableIfExists('invite_rewards');
  await knex.schema.dropTableIfExists('invite_usage_logs');
  await knex.schema.dropTableIfExists('invite_codes');
};