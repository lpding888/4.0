/**
 * 创建支付相关表
 * 1. 支付订单表
 * 2. 支付记录表
 * 3. 退款记录表
 */

exports.up = function(knex) {
  return Promise.all([
    // 支付订单表
    knex.schema.createTable('payment_orders', function(table) {
      table.string('id', 32).primary().comment('支付订单ID');
      table.string('user_id', 32).notNullable().comment('用户ID');
      table.string('order_no', 64).notNullable().unique().comment('订单号');
      table.string('product_type', 32).notNullable().comment('商品类型: membership, quota, etc');
      table.string('product_id', 32).nullable().comment('商品ID');
      table.string('product_name', 100).notNullable().comment('商品名称');
      table.text('product_description').nullable().comment('商品描述');
      table.decimal('amount', 10, 2).notNullable().comment('支付金额');
      table.string('currency', 3).defaultTo('CNY').comment('货币类型');
      table.string('payment_method', 20).notNullable().comment('支付方式: alipay, wechat');
      table.string('status', 20).defaultTo('pending').comment('订单状态: pending, paid, cancelled, refunded, partial_refunded');
      table.string('trade_no', 64).nullable().comment('第三方交易号');
      table.text('payment_params').nullable().comment('支付参数(JSON)');
      table.text('payment_result').nullable().comment('支付结果(JSON)');
      table.datetime('paid_at').nullable().comment('支付时间');
      table.datetime('expired_at').nullable().comment('过期时间');
      table.datetime('created_at').defaultTo(knex.fn.now()).comment('创建时间');
      table.datetime('updated_at').defaultTo(knex.fn.now()).onUpdate().comment('更新时间');

      // 外键
      table.foreign('user_id').references('users.id').onDelete('CASCADE');

      // 索引
      table.index('user_id', 'idx_payment_orders_user');
      table.index('order_no', 'idx_payment_orders_order_no');
      table.index('status', 'idx_payment_orders_status');
      table.index('payment_method', 'idx_payment_orders_method');
      table.index('trade_no', 'idx_payment_orders_trade_no');
      table.index('created_at', 'idx_payment_orders_created');
    }),

    // 支付记录表
    knex.schema.createTable('payment_transactions', function(table) {
      table.string('id', 32).primary().comment('支付记录ID');
      table.string('order_id', 32).notNullable().comment('支付订单ID');
      table.string('user_id', 32).notNullable().comment('用户ID');
      table.string('transaction_no', 64).notNullable().comment('交易流水号');
      table.string('payment_method', 20).notNullable().comment('支付方式');
      table.string('action_type', 20).notNullable().comment('操作类型: payment, refund');
      table.decimal('amount', 10, 2).notNullable().comment('金额');
      table.string('status', 20).notNullable().comment('状态: pending, success, failed');
      table.string('gateway_transaction_no', 64).nullable().comment('支付网关交易号');
      table.text('request_data').nullable().comment('请求数据(JSON)');
      table.text('response_data').nullable().comment('响应数据(JSON)');
      table.string('error_code', 50).nullable().comment('错误码');
      table.text('error_message').nullable().comment('错误信息');
      table.datetime('created_at').defaultTo(knex.fn.now()).comment('创建时间');

      // 外键
      table.foreign('order_id').references('payment_orders.id').onDelete('CASCADE');
      table.foreign('user_id').references('users.id').onDelete('CASCADE');

      // 索引
      table.index('order_id', 'idx_payment_transactions_order');
      table.index('user_id', 'idx_payment_transactions_user');
      table.index('transaction_no', 'idx_payment_transactions_no');
      table.index('status', 'idx_payment_transactions_status');
      table.index('created_at', 'idx_payment_transactions_created');
    }),

    // 退款记录表
    knex.schema.createTable('refund_records', function(table) {
      table.string('id', 32).primary().comment('退款记录ID');
      table.string('order_id', 32).notNullable().comment('原支付订单ID');
      table.string('user_id', 32).notNullable().comment('用户ID');
      table.string('refund_no', 64).notNullable().unique().comment('退款单号');
      table.string('payment_method', 20).notNullable().comment('原支付方式');
      table.decimal('order_amount', 10, 2).notNullable().comment('原订单金额');
      table.decimal('refund_amount', 10, 2).notNullable().comment('退款金额');
      table.string('status', 20).defaultTo('pending').comment('退款状态: pending, success, failed, cancelled');
      table.string('refund_reason', 200).nullable().comment('退款原因');
      table.string('gateway_refund_no', 64).nullable().comment('支付网关退款单号');
      table.text('refund_result').nullable().comment('退款结果(JSON)');
      table.datetime('refunded_at').nullable().comment('退款成功时间');
      table.datetime('created_at').defaultTo(knex.fn.now()).comment('创建时间');
      table.datetime('updated_at').defaultTo(knex.fn.now()).onUpdate().comment('更新时间');

      // 外键
      table.foreign('order_id').references('payment_orders.id').onDelete('CASCADE');
      table.foreign('user_id').references('users.id').onDelete('CASCADE');

      // 索引
      table.index('order_id', 'idx_refund_records_order');
      table.index('user_id', 'idx_refund_records_user');
      table.index('refund_no', 'idx_refund_records_no');
      table.index('status', 'idx_refund_records_status');
      table.index('created_at', 'idx_refund_records_created');
    })
  ])
  .then(() => {
    console.log('✓ 支付相关表创建成功');
  });
};

exports.down = function(knex) {
  return Promise.all([
    knex.schema.dropTableIfExists('refund_records'),
    knex.schema.dropTableIfExists('payment_transactions'),
    knex.schema.dropTableIfExists('payment_orders')
  ]);
};