exports.up = async function(knex) {
  await knex.schema.createTable('refresh_tokens', (table) => {
    table.increments('id').primary();
    table.string('user_id', 32).notNullable();
    table.string('token', 255).notNullable(); // 改为varchar以支持索引
    table.timestamp('expires_at').notNullable();
    table.timestamp('revoked_at').nullable();
    table.timestamps(true, true);

    table.index('user_id');
    table.index('token'); // 普通索引,token字段改为varchar
    table.index('expires_at');
  });

  console.log('✓ refresh_tokens表创建成功');
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('refresh_tokens');
};
