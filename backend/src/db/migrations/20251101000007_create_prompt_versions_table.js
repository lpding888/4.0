/**
 * 创建prompt_versions表 (CMS-304)
 * 艹！管理Prompt模板的版本历史！
 */

exports.up = function (knex) {
  return knex.schema.createTable('prompt_versions', (table) => {
    // 主键
    table.increments('id').primary().comment('自增ID');

    // Prompt标识
    table.string('prompt_id', 100).notNullable().comment('Prompt唯一标识（如 image-prompt-v1）');

    // 版本信息
    table.integer('version').notNullable().comment('版本号（1,2,3...）');
    table.boolean('is_current').defaultTo(false).comment('是否为当前使用版本');
    table.enum('publish_status', ['draft', 'published', 'archived']).defaultTo('draft').comment('发布状态');

    // Prompt内容
    table.text('template', 'longtext').notNullable().comment('Handlebars模板内容');
    table.json('variables_schema').comment('变量Schema定义（JSON）');
    table.text('description').comment('版本说明');

    // 元数据
    table.string('author', 100).comment('创建者');
    table.json('metadata').comment('额外元数据（JSON）');

    // 时间戳
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 索引
    table.index('prompt_id', 'idx_prompt_versions_prompt_id');
    table.index(['prompt_id', 'version'], 'idx_prompt_versions_prompt_version');
    table.index(['prompt_id', 'is_current'], 'idx_prompt_versions_current');
    table.index('publish_status', 'idx_prompt_versions_status');

    // 唯一约束：同一个prompt_id的同一个version只能有一条记录
    table.unique(['prompt_id', 'version']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('prompt_versions');
};
