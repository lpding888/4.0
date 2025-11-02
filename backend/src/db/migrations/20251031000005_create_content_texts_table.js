/**
 * 文案配置表迁移
 * 艹，多语言文案配置系统！
 * 按页面+区块+键+语言组织
 */

exports.up = function (knex) {
  return knex.schema.createTable('content_texts', (table) => {
    table.increments('id').primary();

    // 文案定位
    table.string('page', 100).notNullable().comment('页面标识');
    table.string('section', 100).nullable().comment('区块标识（可选）');
    table.string('key', 100).notNullable().comment('文案键');

    // 语言和内容
    table.string('language', 10).notNullable().defaultTo('zh-CN').comment('语言代码');
    table.text('value').notNullable().comment('文案内容');

    // 元数据
    table.text('description').nullable().comment('文案描述/备注');
    table.enum('status', ['active', 'inactive']).notNullable().defaultTo('active');

    // 版本信息（可选）
    table.integer('version').notNullable().defaultTo(1).comment('版本号');
    table.integer('created_by').unsigned().nullable();
    table.integer('updated_by').unsigned().nullable();

    // 时间戳
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // 唯一约束（page + section + key + language唯一）
    table.unique(['page', 'section', 'key', 'language'], {
      indexName: 'unique_text_identifier',
      // 处理NULL section的情况，数据库层面可能需要额外处理
    });

    // 索引
    table.index('page');
    table.index('language');
    table.index(['page', 'language']);
    table.index('status');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('content_texts');
};
