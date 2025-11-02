/**
 * 扩展tasks表 - 添加新字段以支持Pipeline架构
 * 新增feature_id/input_data/artifacts/eligible_for_refund/refunded/error_message等字段
 */
exports.up = function(knex) {
  return knex.schema.table('tasks', function(table) {
    // 功能卡片ID
    table.string('feature_id', 100).nullable().comment('功能ID(引用feature_definitions)');

    // 输入数据(JSON格式,存储表单提交的所有参数)
    table.json('input_data').nullable().comment('输入数据(JSON对象)');

    // 产出物(JSON格式,存储最终结果)
    table.json('artifacts').nullable().comment('任务产出物(JSON对象)');

    // 配额返还相关
    table.boolean('eligible_for_refund').defaultTo(false).comment('是否有资格返还配额');
    table.boolean('refunded').defaultTo(false).comment('是否已返还配额');

    // 错误信息(补充errorReason)
    table.text('error_message').nullable().comment('详细错误信息');

    // 完成时间
    table.timestamp('completed_at').nullable().comment('完成时间');

    // 索引
    table.index('feature_id');
    table.index(['userId', 'feature_id']);
    table.index(['eligible_for_refund', 'refunded']);
  })
  .then(() => {
    console.log('✓ tasks表扩展成功');
  });
};

exports.down = function(knex) {
  return knex.schema.table('tasks', function(table) {
    table.dropColumn('feature_id');
    table.dropColumn('input_data');
    table.dropColumn('artifacts');
    table.dropColumn('eligible_for_refund');
    table.dropColumn('refunded');
    table.dropColumn('error_message');
    table.dropColumn('completed_at');
  });
};
