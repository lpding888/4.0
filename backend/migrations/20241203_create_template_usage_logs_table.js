/**
 * 模板使用记录表迁移
 */

exports.up = function(knex) {
  return knex.schema.createTable('template_usage_logs', (table) => {
    table.string('id').primary().defaultTo(knex.raw('(UUID())'));
    table.string('template_id').references('id').inTable('prompt_templates').onDelete('CASCADE');
    table.string('template_version').notNullable().comment('使用的模板版本');
    table.json('variables_used').comment('使用的变量值');
    table.text('rendered_content').comment('渲染后的内容');
    table.string('context_type').comment('使用场景类型');
    table.string('context_id').comment('使用场景ID');
    table.string('user_id').references('id').inTable('users').onDelete('SET NULL');
    table.text('result_summary').comment('结果摘要');
    table.integer('tokens_used').defaultTo(0).comment('消耗token数');
    table.decimal('cost', 10, 4).defaultTo(0).comment('成本');
    table.timestamps(true, true);

    table.index(['template_id']);
    table.index(['user_id']);
    table.index(['context_type']);
    table.index(['created_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('template_usage_logs');
};