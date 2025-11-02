/**
 * 创建users表
 */
exports.up = async function(knex) {
  const tableName = 'users'; // Extract table name
  if (tableName) {
    const exists = await knex.schema.hasTable(tableName);
    if (exists) {
      console.log();
      return;
    }
  }

  return knex.schema.createTable('users', function(table) {
    table.string('id', 32).primary().comment('用户ID');
    table.string('phone', 11).unique().notNullable().comment('手机号');
    table.boolean('isMember').defaultTo(false).comment('是否会员');
    table.integer('quota_remaining').unsigned().defaultTo(0).comment('剩余配额');
    table.datetime('quota_expireAt').nullable().comment('配额到期时间');
    table.timestamps(true, true);
    
    // 索引
    table.index('phone');
  })
  .then(() => {
    console.log('✓ users表创建成功');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('users');
};
