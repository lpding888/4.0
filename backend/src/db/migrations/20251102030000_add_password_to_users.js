/**
 * 为users表添加password字段
 * P0-007: 密码登录重构
 */

exports.up = async function(knex) {
  await knex.schema.table('users', (table) => {
    table.string('password', 255).nullable().comment('用户密码(bcrypt加密)');
  });
  console.log('✓ users表新增password字段成功');
};

exports.down = async function(knex) {
  await knex.schema.table('users', (table) => {
    table.dropColumn('password');
  });
};
