/**
 * 扩展form_schemas表 - 添加版本控制字段
 * 艹！让表单支持版本管理，方便回滚和历史追溯！
 */
exports.up = function (knex) {
  return knex.schema.table('form_schemas', function (table) {
    // 版本号（递增）
    table.integer('version').defaultTo(1).notNullable().comment('版本号');

    // 是否为当前版本
    table.boolean('is_current').defaultTo(true).notNullable().comment('是否为当前版本');

    // 版本描述
    table.string('version_description', 500).comment('版本描述/变更说明');

    // 发布状态
    table
      .enum('publish_status', ['draft', 'published', 'archived'])
      .defaultTo('draft')
      .comment('发布状态');

    // 创建人
    table.string('created_by', 100).comment('创建人');

    // 索引
    table.index(['schema_id', 'is_current'], 'idx_schema_current');
    table.index(['schema_id', 'version'], 'idx_schema_version');
  }).then(() => {
    console.log('✓ form_schemas表版本控制字段添加成功');
  });
};

exports.down = function (knex) {
  return knex.schema.table('form_schemas', function (table) {
    table.dropIndex([], 'idx_schema_current');
    table.dropIndex([], 'idx_schema_version');
    table.dropColumn('version');
    table.dropColumn('is_current');
    table.dropColumn('version_description');
    table.dropColumn('publish_status');
    table.dropColumn('created_by');
  });
};
