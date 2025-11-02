/**
 * 创建tasks表
 */
exports.up = async function(knex) {
  const tableName = 'tasks'; // Extract table name
  if (tableName) {
    const exists = await knex.schema.hasTable(tableName);
    if (exists) {
      console.log();
      return;
    }
  }

  return knex.schema.createTable('tasks', function(table) {
    table.string('id', 32).primary().comment('任务ID');
    table.string('userId', 32).notNullable().comment('用户ID');
    table.string('type', 20).notNullable().comment('任务类型');
    table.string('status', 20).notNullable().comment('任务状态');
    table.text('inputUrl').notNullable().comment('输入图片URL');
    table.json('resultUrls').nullable().comment('结果图片URL数组');
    table.string('vendorTaskId', 64).nullable().comment('第三方任务ID');
    table.json('params').nullable().comment('任务参数');
    table.text('errorReason').nullable().comment('失败原因');
    table.timestamps(true, true);
    
    // 外键
    table.foreign('userId').references('users.id').onDelete('CASCADE');
    
    // 索引
    table.index('userId');
    table.index(['userId', 'created_at']);
    table.index('vendorTaskId');
    table.index('status');
  })
  .then(() => {
    console.log('✓ tasks表创建成功');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('tasks');
};
