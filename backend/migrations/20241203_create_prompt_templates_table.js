/**
 * 提示词模板表迁移
 */

exports.up = function(knex) {
  return knex.schema.createTable('prompt_templates', (table) => {
    table.string('id').primary().defaultTo(knex.raw('(UUID())'));
    table.string('name').notNullable().comment('模板名称');
    table.text('description').comment('描述');
    table.string('category').notNullable().comment('模板分类');
    table.text('template').notNullable().comment('模板内容');
    table.json('variables').defaultTo('[]').comment('变量定义');
    table.json('tags').defaultTo('[]').comment('标签');
    table.string('version').defaultTo('1.0.0').comment('版本号');
    table.boolean('published').defaultTo(false).comment('是否发布');
    table.timestamp('published_at').nullable().comment('发布时间');
    table.boolean('enabled').defaultTo(true).comment('是否启用');
    table.json('metadata').defaultTo('{}').comment('元数据');
    table.integer('usage_count').defaultTo(0).comment('使用次数');
    table.timestamp('last_used_at').nullable().comment('最后使用时间');
    integer('created_by').references('id').inTable('users').onDelete('SET NULL');
    integer('updated_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);

    table.index(['category', 'enabled']);
    table.index(['published']);
    table.index(['enabled']);
    table.index(['usage_count']);
    table.index(['created_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('prompt_templates');
};