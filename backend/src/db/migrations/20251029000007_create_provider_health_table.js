/**
 * 创建provider_health表 - 供应商健康状态表
 * 存储供应商的健康状态/平均延迟/成功率等监控指标
 */
exports.up = function(knex) {
  return knex.schema.createTable('provider_health', function(table) {
    table.string('provider_ref', 100).primary().comment('供应商引用ID(外键)');
    table.string('status', 20).notNullable().comment('健康状态(up/down/degraded)');
    table.integer('avg_latency_ms').nullable().comment('平均延迟(毫秒)');
    table.decimal('success_rate_24h', 5, 2).nullable().comment('24小时成功率(百分比)');
    table.timestamp('last_check_at').notNullable().comment('最后检查时间');
    table.text('last_error').nullable().comment('最后错误信息');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 外键约束
    table.foreign('provider_ref').references('provider_endpoints.provider_ref').onDelete('CASCADE');

    // 索引
    table.index('status');
    table.index('last_check_at');
  })
  .then(() => {
    console.log('✓ provider_health表创建成功');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('provider_health');
};
