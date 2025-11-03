/**
 * 创建提示词模板表
 */
exports.up = function(knex) {
  return knex.schema.createTable('prompt_templates', function(table) {
    table.uuid('id').primary().defaultTo(knex.raw('(UUID())'));
    table.string('key', 100).unique().notNullable().comment('模板唯一标识');
    table.string('name', 200).notNullable().comment('模板名称');
    table.text('description').nullable().comment('模板描述');
    table.text('content').notNullable().comment('模板内容');
    table.enum('category', ['system', 'user', 'assistant', 'function']).defaultTo('user').comment('模板类别');
    table.json('variables').nullable().comment('模板变量定义');
    table.json('metadata').nullable().comment('模板元数据');
    table.integer('version').notNullable().defaultTo(1).comment('版本号');
    table.string('status', 20).notNullable().defaultTo('draft').comment('状态: draft, published, archived');
    table.uuid('created_by').references('id').inTable('users').comment('创建人');
    table.uuid('updated_by').references('id').inTable('users').comment('更新人');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // 索引
    table.index(['key']);
    table.index(['category']);
    table.index(['status']);
    table.index(['created_by']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('prompt_templates');
};