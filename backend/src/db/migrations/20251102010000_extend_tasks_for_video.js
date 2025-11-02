/**
 * 扩展tasks表支持视频生成功能
 * 新增字段：coverUrl(智能封面), thumbnailUrl(GIF预览)
 */
exports.up = async function(knex) {
  await knex.schema.table('tasks', (table) => {
    table.text('coverUrl').nullable().comment('视频智能封面URL');
    table.text('thumbnailUrl').nullable().comment('视频GIF预览URL');
  });

  console.log('✓ tasks表扩展成功 - 新增coverUrl和thumbnailUrl字段');
};

exports.down = async function(knex) {
  await knex.schema.table('tasks', (table) => {
    table.dropColumn('coverUrl');
    table.dropColumn('thumbnailUrl');
  });
};
