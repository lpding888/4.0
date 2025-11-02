/**
 * 创建assets表 - 素材库表
 * 存储用户生成的所有作品素材(图片/视频/文案等)
 */
exports.up = async function(knex) {
  const tableName = 'assets'; // Extract table name
  if (tableName) {
    const exists = await knex.schema.hasTable(tableName);
    if (exists) {
      console.log();
      return;
    }
  }

  return knex.schema.createTable('assets', function(table) {
    table.string('asset_id', 100).primary().comment('素材ID(唯一标识)');
    table.string('user_id', 32).notNullable().comment('用户ID(外键)');
    table.string('task_id', 100).nullable().comment('任务ID(外键,可为空)');
    table.string('feature_id', 100).notNullable().comment('功能ID');
    table.string('type', 50).notNullable().comment('素材类型(image/video/zip/textBundle)');
    table.string('url', 500).notNullable().comment('素材URL');
    table.string('thumbnail_url', 500).nullable().comment('缩略图URL');
    table.json('metadata').nullable().comment('元数据(JSON对象)');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');

    // 外键约束
    table.foreign('user_id').references('users.id').onDelete('CASCADE');
    table.foreign('task_id').references('tasks.id').onDelete('SET NULL');

    // 索引
    table.index(['user_id', 'created_at'], 'idx_user_created');
    table.index('feature_id', 'idx_feature');
    table.index('task_id');
    table.index('type');
  })
  .then(() => {
    console.log('✓ assets表创建成功');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('assets');
};
