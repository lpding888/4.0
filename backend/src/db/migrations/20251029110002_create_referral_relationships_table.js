/**
 * 推荐关系表迁移
 */
exports.up = async function(knex) {
  const tableName = 'referral_relationships'; // Extract table name
  if (tableName) {
    const exists = await knex.schema.hasTable(tableName);
    if (exists) {
      console.log();
      return;
    }
  }

  return knex.schema.createTable('referral_relationships', function(table) {
    table.string('id', 32).primary().comment('关系ID');
    table.string('referrer_user_id', 32).notNullable().comment('推荐人用户ID');
    table.string('referred_user_id', 32).notNullable().comment('被推荐人用户ID');
    table.string('referrer_distributor_id', 32).notNullable().comment('推荐人分销员ID');
    table.datetime('created_at').defaultTo(knex.fn.now()).comment('创建时间');

    // 外键
    table.foreign('referrer_user_id').references('users.id').onDelete('CASCADE');
    table.foreign('referred_user_id').references('users.id').onDelete('CASCADE');
    table.foreign('referrer_distributor_id').references('distributors.id').onDelete('CASCADE');

    // 索引
    table.index('referrer_distributor_id', 'idx_referral_referrer');
    table.index('referred_user_id', 'idx_referral_referred');

    // 唯一约束：每个用户只能被推荐一次
    table.unique('referred_user_id', 'uk_referred_user');
  })
  .then(() => {
    console.log('✓ referral_relationships表创建成功');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('referral_relationships');
};
