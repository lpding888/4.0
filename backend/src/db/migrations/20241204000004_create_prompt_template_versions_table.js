/**
 * 创建提示词模板版本表
 */
exports.up = function(knex) {
  return knex.schema.createTable('prompt_template_versions', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.uuid('template_id').references('id').inTable('prompt_templates').onDelete('CASCADE').comment('模板ID');
    table.integer('version').notNullable().comment('版本号');
    table.text('content').notNullable().comment('模板内容');
    table.json('variables').nullable().comment('模板变量定义');
    table.json('metadata').nullable().comment('模板元数据');
    table.text('change_log').nullable().comment('变更日志');
    table.string('status', 20).notNullable().defaultTo('draft').comment('状态');
    table.uuid('created_by').references('id').inTable('users').comment('创建人');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // 唯一约束
    table.unique(['template_id', 'version']);

    // 索引
    table.index(['template_id']);
    table.index(['status']);
    table.index(['created_by']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('prompt_template_versions');
};