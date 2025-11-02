/**
 * 配置快照表迁移
 * 艹，这个tm用于保存配置历史版本，支持回滚！
 */

exports.up = function (knex) {
  return knex.schema.createTable('config_snapshots', (table) => {
    // 主键
    table.increments('id').primary();

    // 快照基本信息
    table.string('snapshot_name', 200).notNullable().comment('快照名称');
    table.text('description').nullable().comment('快照描述');

    // 配置类型和内容
    table
      .string('config_type', 100)
      .notNullable()
      .comment('配置类型：provider/announcement/banner等');
    table.string('config_ref', 200).nullable().comment('配置引用ID');
    table.json('config_data').notNullable().comment('配置数据快照（JSON）');

    // 快照元信息
    table.integer('created_by').unsigned().nullable().comment('创建人用户ID');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // 艹，是否已回滚标记
    table.boolean('is_rollback').defaultTo(false).comment('是否为回滚快照');
    table
      .integer('rollback_from_id')
      .unsigned()
      .nullable()
      .comment('回滚来源快照ID');

    // 索引
    table.index('config_type');
    table.index('config_ref');
    table.index('created_at');
    table.index(['config_type', 'config_ref', 'created_at']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('config_snapshots');
};
