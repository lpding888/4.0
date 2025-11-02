/**
 * 佣金记录表迁移
 */
exports.up = function(knex) {
  return knex.schema.createTable('commissions', function(table) {
    table.string('id', 32).primary().comment('佣金记录ID');
    table.string('distributor_id', 32).notNullable().comment('分销员ID');
    table.string('order_id', 32).notNullable().comment('订单ID');
    table.string('referred_user_id', 32).notNullable().comment('被推荐用户ID');
    table.decimal('order_amount', 10, 2).notNullable().comment('订单金额');
    table.decimal('commission_rate', 5, 2).notNullable().comment('佣金比例(%)');
    table.decimal('commission_amount', 10, 2).notNullable().comment('佣金金额');
    table.string('status', 20).defaultTo('frozen').comment('状态: frozen=冻结中, available=可提现, withdrawn=已提现, cancelled=已取消');
    table.datetime('freeze_until').notNullable().comment('冻结截止时间');
    table.datetime('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.datetime('settled_at').nullable().comment('到账时间');

    // 外键
    table.foreign('distributor_id').references('distributors.id').onDelete('CASCADE');
    table.foreign('order_id').references('orders.id').onDelete('CASCADE');
    table.foreign('referred_user_id').references('users.id').onDelete('CASCADE');

    // 索引
    table.index('distributor_id', 'idx_commissions_distributor');
    table.index('order_id', 'idx_commissions_order');
    table.index(['status', 'freeze_until'], 'idx_commissions_status_freeze');

    // 唯一约束：防止同一订单重复计佣
    table.unique(['order_id', 'distributor_id'], 'uk_order_distributor');
  })
  .then(() => {
    console.log('✓ commissions表创建成功');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('commissions');
};
