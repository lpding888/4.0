/**
 * 创建功能目录相关表
 *
 * 功能目录系统用于管理应用中的所有功能特性，包括：
 * - 功能定义和元数据
 * - 功能配置参数
 * - 功能权限控制
 * - 功能版本管理
 * - 功能使用统计
 */

exports.up = async function(knex) {
  // 功能定义表
  await knex.schema.createTable('feature_definitions', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('feature_key', 100).notNullable().unique().comment('功能唯一标识');
    table.string('name', 200).notNullable().comment('功能名称');
    table.text('description').comment('功能描述');
    table.enum('category', [
      'image_processing', 'ai_generation', 'video_processing',
      'audio_processing', 'text_processing', 'data_analysis',
      'file_management', 'user_management', 'payment', 'integration'
    ]).notNullable().comment('功能分类');
    table.enum('type', ['basic', 'premium', 'enterprise', 'beta']).defaultTo('basic').comment('功能类型');
    table.boolean('is_active').defaultTo(true).comment('是否激活');
    table.boolean('is_public').defaultTo(true).comment('是否公开');
    table.json('tags').comment('功能标签');
    table.json('metadata').comment('功能元数据');
    table.string('icon', 200).comment('功能图标URL');
    table.string('version', 20).defaultTo('1.0.0').comment('功能版本');
    table.json('requirements').comment('功能要求(权限、会员等级等)');
    table.json('limits').comment('使用限制(次数、大小等)');
    table.json('pricing').comment('定价信息');
    table.timestamp('released_at').comment('发布时间');
    table.timestamp('deprecated_at').nullable().comment('废弃时间');
    table.timestamps(true, true);

    // 索引
    table.index(['category']);
    table.index(['type']);
    table.index(['is_active']);
    table.index(['is_public']);
    table.index(['released_at']);
  });

  // 功能配置表
  await knex.schema.createTable('feature_configurations', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('feature_id', 36).notNullable().comment('功能ID');
    table.string('config_key', 100).notNullable().comment('配置键');
    table.text('config_value').comment('配置值');
    table.enum('data_type', ['string', 'number', 'boolean', 'json', 'array']).defaultTo('string').comment('数据类型');
    table.text('description').comment('配置描述');
    table.boolean('is_required').defaultTo(false).comment('是否必需');
    table.boolean('is_sensitive').defaultTo(false).comment('是否敏感信息');
    table.json('validation_rules').comment('验证规则');
    table.string('default_value').comment('默认值');
    table.json('enum_values').comment('枚举值(用于枚举类型)');
    table.integer('sort_order').defaultTo(0).comment('排序');
    table.timestamps(true, true);

    // 外键约束
    table.foreign('feature_id').references('id').inTable('feature_definitions').onDelete('CASCADE');

    // 唯一约束
    table.unique(['feature_id', 'config_key']);

    // 索引
    table.index(['feature_id']);
    table.index(['config_key']);
  });

  // 功能权限表
  await knex.schema.createTable('feature_permissions', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('feature_id', 36).notNullable().comment('功能ID');
    table.enum('permission_type', ['role', 'user', 'membership', 'custom']).notNullable().comment('权限类型');
    table.string('permission_value', 100).notNullable().comment('权限值(角色名、用户ID等)');
    table.enum('access_level', ['none', 'read', 'write', 'admin']).defaultTo('read').comment('访问级别');
    table.json('conditions').comment('权限条件');
    table.boolean('is_granted').defaultTo(true).comment('是否授权');
    table.timestamp('granted_at').defaultTo(knex.fn.now()).comment('授权时间');
    table.timestamp('expires_at').nullable().comment('过期时间');
    table.string('granted_by', 36).comment('授权人');
    table.text('notes').comment('备注');
    table.timestamps(true, true);

    // 外键约束
    table.foreign('feature_id').references('id').inTable('feature_definitions').onDelete('CASCADE');

    // 索引
    table.index(['feature_id']);
    table.index(['permission_type']);
    table.index(['permission_value']);
    table.index(['access_level']);
    table.index(['expires_at']);
  });

  // 功能使用统计表
  await knex.schema.createTable('feature_usage_stats', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('feature_id', 36).notNullable().comment('功能ID');
    table.string('user_id', 36).comment('用户ID');
    table.date('usage_date').notNullable().comment('使用日期');
    table.integer('usage_count').defaultTo(0).comment('使用次数');
    table.json('usage_metrics').comment('使用指标(处理文件大小、处理时长等)');
    table.decimal('total_cost', 10, 4).defaultTo(0).comment('总成本');
    table.enum('status', ['success', 'failed', 'partial']).defaultTo('success').comment('使用状态');
    table.json('error_details').comment('错误详情');
    table.timestamps(true, true);

    // 外键约束
    table.foreign('feature_id').references('id').inTable('feature_definitions').onDelete('CASCADE');

    // 唯一约束
    table.unique(['feature_id', 'user_id', 'usage_date']);

    // 索引
    table.index(['feature_id']);
    table.index(['user_id']);
    table.index(['usage_date']);
    table.index(['status']);
  });

  // 功能版本表
  await knex.schema.createTable('feature_versions', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('feature_id', 36).notNullable().comment('功能ID');
    table.string('version', 20).notNullable().comment('版本号');
    table.enum('release_type', ['major', 'minor', 'patch', 'beta', 'alpha']).notNullable().comment('发布类型');
    table.text('changelog').comment('变更日志');
    table.json('config_changes').comment('配置变更');
    table.boolean('is_current').defaultTo(false).comment('是否当前版本');
    table.boolean('is_stable').defaultTo(true).comment('是否稳定版');
    table.timestamp('released_at').comment('发布时间');
    table.string('released_by', 36).comment('发布人');
    table.json('compatibility_info').comment('兼容性信息');
    table.text('migration_guide').comment('迁移指南');
    table.timestamps(true, true);

    // 外键约束
    table.foreign('feature_id').references('id').inTable('feature_definitions').onDelete('CASCADE');

    // 唯一约束
    table.unique(['feature_id', 'version']);

    // 索引
    table.index(['feature_id']);
    table.index(['version']);
    table.index(['is_current']);
    table.index(['is_stable']);
    table.index(['released_at']);
  });

  // 功能依赖关系表
  await knex.schema.createTable('feature_dependencies', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('feature_id', 36).notNullable().comment('功能ID');
    table.string('depends_on_feature_id', 36).notNullable().comment('依赖的功能ID');
    table.enum('dependency_type', ['required', 'optional', 'suggested']).defaultTo('required').comment('依赖类型');
    table.string('min_version', 20).comment('最低版本要求');
    table.string('max_version', 20).comment('最高版本限制');
    table.text('description').comment('依赖描述');
    table.boolean('is_active').defaultTo(true).comment('是否激活');
    table.timestamps(true, true);

    // 外键约束
    table.foreign('feature_id').references('id').inTable('feature_definitions').onDelete('CASCADE');
    table.foreign('depends_on_feature_id').references('id').inTable('feature_definitions').onDelete('CASCADE');

    // 唯一约束
    table.unique(['feature_id', 'depends_on_feature_id']);

    // 索引
    table.index(['feature_id']);
    table.index(['depends_on_feature_id']);
    table.index(['dependency_type']);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('feature_dependencies');
  await knex.schema.dropTableIfExists('feature_versions');
  await knex.schema.dropTableIfExists('feature_usage_stats');
  await knex.schema.dropTableIfExists('feature_permissions');
  await knex.schema.dropTableIfExists('feature_configurations');
  await knex.schema.dropTableIfExists('feature_definitions');
};