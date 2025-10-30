/**
 * 用户表扩展 - 添加推荐人字段
 */
exports.up = function(knex) {
  return knex.schema.table('users', function(table) {
    table.string('referrer_id', 32).nullable().comment('推荐人用户ID');
    table.index('referrer_id', 'idx_users_referrer');
  })
  .then(() => {
    console.log('✓ users表扩展成功');
  });
};

exports.down = function(knex) {
  return knex.schema.table('users', function(table) {
    table.dropIndex('referrer_id', 'idx_users_referrer');
    table.dropColumn('referrer_id');
  });
};
