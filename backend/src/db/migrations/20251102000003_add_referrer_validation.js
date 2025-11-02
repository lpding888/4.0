/**
 * 添加推荐人验证字段 (P1-017)
 * 艹！防止用户填写无效的推荐人ID
 */
exports.up = function(knex) {
  return knex.schema.table('users', function(table) {
    // P1-017: 推荐人验证字段
    table.boolean('referrer_verified').defaultTo(false).comment('推荐人是否已验证');
    table.timestamp('referrer_verified_at').nullable().comment('推荐人验证时间');

    // 索引
    table.index('referrer_verified');
  });
};

exports.down = function(knex) {
  return knex.schema.table('users', function(table) {
    table.dropColumn('referrer_verified');
    table.dropColumn('referrer_verified_at');
  });
};
