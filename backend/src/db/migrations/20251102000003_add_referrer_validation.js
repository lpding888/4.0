/**
 * BE-REF-001: 添加推荐人验证字段
 *
 * 支持推荐关系验证和佣金计算
 */
exports.up = function(knex) {
  return knex.schema.table('users', (table) => {
    // 推荐验证状态
    table.enum('referral_status', ['pending', 'valid', 'invalid'])
      .notNullable()
      .defaultTo('pending')
      .comment('推荐状态');

    // 推荐验证时间
    table.datetime('referral_validated_at').nullable().comment('推荐验证时间');

    // 推荐佣金统计
    table.decimal('referral_earned', 10, 2).defaultTo(0).comment('推荐获得佣金');
    table.integer('referral_count').unsigned().defaultTo(0).comment('推荐用户数');

    // 推荐链接追踪
    table.string('referral_source', 100).nullable().comment('推荐来源');
    table.text('referral_metadata').nullable().comment('推荐元数据');

    // 索引
    table.index('referral_status', 'idx_users_referral_status');
    table.index('referral_validated_at', 'idx_users_referral_validated');
    table.index(['referrer_id', 'referral_status'], 'idx_users_referrer_status');
  });
};

exports.down = function(knex) {
  return knex.schema.table('users', (table) => {
    table.dropColumn('referral_status');
    table.dropColumn('referral_validated_at');
    table.dropColumn('referral_earned');
    table.dropColumn('referral_count');
    table.dropColumn('referral_source');
    table.dropColumn('referral_metadata');
  });
};