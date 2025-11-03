/**
 * 创建task_files表
 * 用于存储任务相关的文件记录
 */
exports.up = function(knex) {
  return knex.schema.createTable('task_files', (table) => {
    // 主键
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));

    // 关联信息
    table.string('task_id', 32).notNullable().comment('关联的任务ID');
    table.string('user_id', 36).nullable().comment('用户ID');

    // 文件信息
    table.string('file_key', 500).notNullable().comment('文件Key');
    table.string('category', 50).notNullable().comment('文件分类: temp, intermediate, userUpload, result, log');
    table.string('step_type', 100).nullable().comment('处理步骤类型');
    table.integer('result_index').nullable().comment('结果文件索引');
    table.bigInteger('size').defaultTo(0).comment('文件大小(字节)');
    table.string('original_url', 1000).nullable().comment('原始URL');

    // 状态管理
    table.enum('status', ['active', 'deleted']).defaultTo('active').comment('文件状态');

    // 元数据
    table.json('metadata').nullable().comment('文件元数据');

    // 时间戳
    table.datetime('created_at').defaultTo(knex.raw('CURRENT_TIMESTAMP'));
    table.datetime('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    table.datetime('deleted_at').nullable().comment('删除时间');

    // 索引
    table.index('task_id', 'idx_task_files_task');
    table.index('user_id', 'idx_task_files_user');
    table.index('file_key', 'idx_task_files_key');
    table.index('category', 'idx_task_files_category');
    table.index('status', 'idx_task_files_status');
    table.index(['task_id', 'category'], 'idx_task_files_task_category');
    table.index(['task_id', 'status'], 'idx_task_files_task_status');
    table.index(['user_id', 'status'], 'idx_task_files_user_status');
    table.index(['category', 'status'], 'idx_task_files_category_status');
    table.index('created_at', 'idx_task_files_created');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('task_files');
};