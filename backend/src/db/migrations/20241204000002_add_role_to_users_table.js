/**
 * 为users表添加role字段
 *
 * 支持RBAC权限系统
 * 角色类型：viewer(查看者), editor(编辑者), admin(管理员)
 */

exports.up = function(knex) {
  return knex.schema.table('users', function(table) {
    // 添加role字段
    table.enum('role', ['viewer', 'editor', 'admin'])
      .defaultTo('viewer')
      .notNullable()
      .comment('用户角色：viewer=查看者, editor=编辑者, admin=管理员');

    // 添加role索引，提升权限查询性能
    table.index(['role']);
  });
};

exports.down = function(knex) {
  return knex.schema.table('users', function(table) {
    table.dropColumn('role');
  });
};
