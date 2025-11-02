/**
 * 用户表扩展 - 添加认证相关字段
 * 艹，这个tm太重要了！没有这些字段用户连登录都搞不了！
 */
exports.up = function(knex) {
  return knex.schema.table('users', function(table) {
    // 密码字段（bcrypt hash）
    table.string('password', 255).nullable().comment('密码hash（bcrypt）');

    // 角色字段
    table.string('role', 20).defaultTo('user').comment('用户角色：user | admin | distributor');

    // 索引
    table.index('role', 'idx_users_role');
  })
  .then(() => {
    console.log('✓ users表认证字段添加成功（password, role）');
  });
};

exports.down = function(knex) {
  return knex.schema.table('users', function(table) {
    table.dropIndex('role', 'idx_users_role');
    table.dropColumn('password');
    table.dropColumn('role');
  });
};
