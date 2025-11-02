/**
 * 添加用户资料字段 (P1-016)
 * 艹！这些字段让用户资料更完整
 */
exports.up = function(knex) {
  return knex.schema.table('users', function(table) {
    // P1-016: 用户资料字段
    table.string('nickname', 50).nullable().comment('昵称');
    table.string('avatar', 500).nullable().comment('头像URL');
    table.enum('gender', ['male', 'female', 'other', 'unknown']).defaultTo('unknown').comment('性别');
    table.date('birthday').nullable().comment('生日');
    table.string('bio', 200).nullable().comment('个人简介');

    // 索引
    table.index('nickname');
  });
};

exports.down = function(knex) {
  return knex.schema.table('users', function(table) {
    table.dropColumn('nickname');
    table.dropColumn('avatar');
    table.dropColumn('gender');
    table.dropColumn('birthday');
    table.dropColumn('bio');
  });
};
