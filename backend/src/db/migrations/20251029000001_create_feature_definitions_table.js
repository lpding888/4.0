/**
 * 创建feature_definitions表 - 功能卡片定义表
 * 用于配置化管理所有功能卡片(基础修图/AI模特/视频生成等)
 */
exports.up = async function(knex) {
  const exists = await knex.schema.hasTable('feature_definitions');
  if (exists) {
    console.log('⚠ feature_definitions表已存在,跳过创建');
    return;
  }

  return knex.schema.createTable('feature_definitions', function(table) {
    table.string('feature_id', 100).primary().comment('功能ID(唯一标识)');
    table.string('display_name', 200).notNullable().comment('显示名称');
    table.string('category', 50).notNullable().comment('功能分类(视觉图像/视频生成/文案创作等)');
    table.text('description').nullable().comment('功能描述');
    table.boolean('is_enabled').defaultTo(false).comment('是否启用');
    table.string('plan_required', 50).notNullable().comment('所需套餐级别(基础/PRO/企业)');
    table.string('access_scope', 20).defaultTo('plan').comment('访问范围(plan=按套餐/whitelist=白名单)');
    table.text('allowed_accounts').nullable().comment('白名单用户ID数组(JSON字符串)');
    table.integer('quota_cost').notNullable().comment('配额消耗数量');
    table.string('rate_limit_policy', 100).nullable().comment('限流策略(hourly:30表示每小时30次)');
    table.string('output_type', 50).notNullable().comment('输出类型(singleImage/multiImage/video/textBundle/zip)');
    table.boolean('save_to_asset_library').defaultTo(false).comment('是否保存到素材库');
    table.string('form_schema_ref', 100).notNullable().comment('表单Schema引用ID');
    table.string('pipeline_schema_ref', 100).notNullable().comment('Pipeline Schema引用ID');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');
    table.timestamp('deleted_at').nullable().comment('删除时间(软删除)');

    // 索引
    table.index('category');
    table.index('is_enabled');
    table.index(['is_enabled', 'deleted_at']);
  })
  .then(() => {
    console.log('✓ feature_definitions表创建成功');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('feature_definitions');
};
