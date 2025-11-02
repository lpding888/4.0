/**
 * 添加orders表复合索引，优化分销查询性能
 */
exports.up = async function(knex) {
  const tableName = '20251030000002_add_orders_indexes'; // Extract table name
  if (tableName) {
    const exists = await knex.schema.hasTable(tableName);
    if (exists) {
      console.log();
      return;
    }
  }

  return knex.schema.table('orders', function(table) {
    // 复合索引：用于查询用户的已支付订单（佣金计算）
    table.index(['userId', 'status'], 'idx_orders_user_status');
    
    // 复合索引：用于查询首次支付时间
    table.index(['userId', 'paidAt'], 'idx_orders_user_paidat');
  })
  .then(() => {
    console.log('✓ orders表复合索引创建成功');
  });
};

exports.down = function(knex) {
  return knex.schema.table('orders', function(table) {
    table.dropIndex(['userId', 'status'], 'idx_orders_user_status');
    table.dropIndex(['userId', 'paidAt'], 'idx_orders_user_paidat');
  });
};
