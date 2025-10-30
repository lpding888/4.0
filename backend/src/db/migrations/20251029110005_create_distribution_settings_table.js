/**
 * 分销系统配置表迁移
 */
exports.up = function(knex) {
  return knex.schema.createTable('distribution_settings', function(table) {
    table.increments('id').primary().comment('配置ID');
    table.decimal('commission_rate', 5, 2).defaultTo(15).comment('默认佣金比例(%)');
    table.integer('freeze_days').defaultTo(7).comment('佣金冻结天数');
    table.decimal('min_withdrawal_amount', 10, 2).defaultTo(100).comment('最低提现金额');
    table.boolean('auto_approve').defaultTo(false).comment('自动审核开关');
    table.timestamps(true, true);
  })
  .then(() => {
    // 插入默认配置
    return knex('distribution_settings').insert({
      id: 1,
      commission_rate: 15,
      freeze_days: 7,
      min_withdrawal_amount: 100,
      auto_approve: false,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    });
  })
  .then(() => {
    console.log('✓ distribution_settings表创建成功');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('distribution_settings');
};
