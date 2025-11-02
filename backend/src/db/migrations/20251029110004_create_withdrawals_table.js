/**
 * 提现记录表迁移
 */
exports.up = async function(knex) {
  const tableName = 'withdrawals'; // Extract table name
  if (tableName) {
    const exists = await knex.schema.hasTable(tableName);
    if (exists) {
      console.log();
      return;
    }
  }

  return knex.schema.createTable('withdrawals', function(table) {
    table.string('id', 32).primary().comment('提现记录ID');
    table.string('distributor_id', 32).notNullable().comment('分销员ID');
    table.decimal('amount', 10, 2).notNullable().comment('提现金额');
    table.string('method', 20).notNullable().comment('提现方式: wechat=微信, alipay=支付宝');
    table.text('account_info').notNullable().comment('收款账户信息(JSON)');
    table.string('status', 20).defaultTo('pending').comment('状态: pending=待审核, approved=审核通过, rejected=已拒绝');
    table.string('reject_reason', 200).nullable().comment('拒绝原因');
    table.datetime('created_at').defaultTo(knex.fn.now()).comment('申请时间');
    table.datetime('approved_at').nullable().comment('审核时间');

    // 外键
    table.foreign('distributor_id').references('distributors.id').onDelete('CASCADE');

    // 索引
    table.index('distributor_id', 'idx_withdrawals_distributor');
    table.index('status', 'idx_withdrawals_status');
    table.index('created_at', 'idx_withdrawals_created');
  })
  .then(() => {
    console.log('✓ withdrawals表创建成功');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('withdrawals');
};
