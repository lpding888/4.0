/**
 * 创建orders表
 */
exports.up = async function(knex) {
  const tableName = 'orders'; // Extract table name
  if (tableName) {
    const exists = await knex.schema.hasTable(tableName);
    if (exists) {
      console.log();
      return;
    }
  }

  return knex.schema.createTable('orders', function(table) {
    table.string('id', 32).primary().comment('订单ID');
    table.string('userId', 32).notNullable().comment('用户ID');
    table.string('status', 20).notNullable().comment('订单状态');
    table.decimal('amount', 10, 2).notNullable().comment('金额(分)');
    table.string('channel', 20).notNullable().comment('支付渠道');
    table.string('transactionId', 64).unique().nullable().comment('第三方交易号');
    table.datetime('createdAt').notNullable().comment('创建时间');
    table.datetime('paidAt').nullable().comment('支付时间');
    
    // 外键
    table.foreign('userId').references('users.id').onDelete('CASCADE');
    
    // 索引
    table.index('userId');
    table.index(['userId', 'status']);
    table.index('createdAt');
  })
  .then(() => {
    console.log('✓ orders表创建成功');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('orders');
};
