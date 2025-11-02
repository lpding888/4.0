/**
 * 创建verification_codes表(验证码记录)
 */
exports.up = async function(knex) {
  const tableName = 'verification_codes'; // Extract table name
  if (tableName) {
    const exists = await knex.schema.hasTable(tableName);
    if (exists) {
      console.log();
      return;
    }
  }

  return knex.schema.createTable('verification_codes', function(table) {
    table.increments('id').primary();
    table.string('phone', 11).notNullable().comment('手机号');
    table.string('code', 6).notNullable().comment('验证码');
    table.string('ip', 45).nullable().comment('请求IP');
    table.datetime('expireAt').notNullable().comment('过期时间');
    table.boolean('used').defaultTo(false).comment('是否已使用');
    table.timestamps(true, true);
    
    // 索引
    table.index('phone');
    table.index(['phone', 'created_at']);
    table.index('ip');
  })
  .then(() => {
    console.log('✓ verification_codes表创建成功');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('verification_codes');
};
