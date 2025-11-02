/**
 * 创建form_schemas表 - 表单Schema配置表
 * 存储每个功能的前端表单配置(字段类型/验证规则/映射关系等)
 */
exports.up = async function(knex) {
  const exists = await knex.schema.hasTable('form_schemas');
  if (exists) {
    console.log('⚠ form_schemas表已存在,跳过创建');
    return;
  }

  return knex.schema.createTable('form_schemas', function(table) {
    table.string('schema_id', 100).primary().comment('Schema ID(唯一标识)');
    table.json('fields').notNullable().comment('表单字段配置(JSON数组)');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');
  })
  .then(() => {
    console.log('✓ form_schemas表创建成功');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('form_schemas');
};
