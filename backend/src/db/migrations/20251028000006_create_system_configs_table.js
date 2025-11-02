/**
 * 创建系统配置表
 * 用于存储API密钥、提示词、系统参数等动态配置
 */

exports.up = async function(knex) {
  const hasTable = await knex.schema.hasTable('system_configs');
  if (hasTable) {
    console.log('✓ system_configs表已存在，跳过迁移');
    return;
  }

  return knex.schema.createTable('system_configs', function(table) {
    // 主键
    table.increments('id').primary();

    // 配置信息
    table.string('config_key', 100).notNullable().unique().comment('配置键名');
    table.text('config_value').comment('配置值(JSON字符串或纯文本)');
    table.string('config_type', 20).notNullable().defaultTo('string').comment('配置类型: string, number, boolean, json, secret');
    table.string('category', 50).notNullable().defaultTo('general').comment('配置分类');
    table.string('description', 500).comment('配置说明');

    // 安全和权限
    table.boolean('is_secret').defaultTo(false).comment('是否为敏感配置(如API密钥)');
    table.boolean('is_system').defaultTo(false).comment('是否为系统配置(不可删除)');

    // 状态和排序
    table.boolean('is_active').defaultTo(true).comment('是否启用');
    table.integer('sort_order').defaultTo(0).comment('排序顺序');

    // 审计字段
    table.integer('created_by').unsigned().nullable().comment('创建人ID');
    table.integer('updated_by').unsigned().nullable().comment('更新人ID');
    table.timestamps(true, true);

    // 索引
    table.index(['category', 'is_active']);
    table.index(['config_key']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('system_configs');
};