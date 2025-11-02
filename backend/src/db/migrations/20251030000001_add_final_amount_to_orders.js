/**
 * 添加final_amount字段到orders表
 * 用于支持优惠券等功能后,区分原价和实付金额
 */
exports.up = function(knex) {
  return knex.schema.table('orders', function(table) {
    // 添加实付金额字段(分)
    table.decimal('final_amount', 10, 2).nullable().comment('实付金额(分)');
  })
  .then(() => {
    // 将现有订单的final_amount设置为amount(兼容性处理)
    return knex.raw('UPDATE orders SET final_amount = amount WHERE final_amount IS NULL');
  })
  .then(() => {
    // 设置final_amount为非空
    return knex.schema.alterTable('orders', function(table) {
      table.decimal('final_amount', 10, 2).notNullable().alter();
    });
  })
  .then(() => {
    console.log('✓ orders表添加final_amount字段成功');
  });
};

exports.down = function(knex) {
  return knex.schema.table('orders', function(table) {
    table.dropColumn('final_amount');
  });
};
