/**
 * 模板版本历史表迁移
 */

exports.up = function(knex) {
  return knex.schema.createTable('template_versions', (table) => {
    table.string('id').primary().defaultTo(knex.raw('(UUID())'));
    table.string('template_id').references('id').inTable('prompt_templates').onDelete('CASCADE');
    table.string('version').notNullable().comment('版本号');
    table.text('template').notNullable().comment('模板内容');
    table.json('variables').defaultTo('[]').comment('变量定义');
    table.text('changelog').comment('变更说明');
    table.boolean('is_current').defaultTo(false).comment('是否当前版本');
    integer('created_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);

    table.index(['template_id', 'version']);
    table.index(['template_id', 'is_current']);
    table.index(['created_at']);

    table.unique(['template_id', 'version']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('template_versions');
};