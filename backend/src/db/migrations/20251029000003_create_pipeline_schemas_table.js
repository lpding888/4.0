/**
 * 创建pipeline_schemas表 - Pipeline Schema配置表
 * 存储每个功能的执行流程配置(步骤顺序/供应商选择/超时重试等)
 */
exports.up = function(knex) {
  return knex.schema.createTable('pipeline_schemas', function(table) {
    table.string('pipeline_id', 100).primary().comment('Pipeline ID(唯一标识)');
    table.json('steps').notNullable().comment('执行步骤配置(JSON数组)');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');
  })
  .then(() => {
    console.log('✓ pipeline_schemas表创建成功');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('pipeline_schemas');
};
