/**
 * 创建file_lifecycle_records表
 * 用于存储文件生命周期管理记录
 */
exports.up = function(knex) {
  return knex.schema.createTable('file_lifecycle_records', (table) => {
    // 主键
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));

    // 文件信息
    table.string('key', 500).notNullable().comment('文件Key');
    table.string('category', 50).notNullable().comment('文件分类: temp, intermediate, userUpload, result, log');
    table.string('storage_class', 50).defaultTo('Standard').comment('存储类别: Standard, Standard_IA, Archive');
    table.bigInteger('size').defaultTo(0).comment('文件大小(字节)');

    // 关联信息
    table.string('task_id', 32).nullable().comment('关联的任务ID');
    table.string('user_id', 36).nullable().comment('用户ID');

    // 元数据和配置
    table.json('metadata').nullable().comment('文件元数据');
    table.enum('priority', ['low', 'normal', 'high']).defaultTo('normal').comment('文件优先级');
    table.boolean('auto_delete').defaultTo(false).comment('是否自动删除');

    // 状态管理
    table.enum('status', ['active', 'expired', 'deleted']).defaultTo('active').comment('文件状态');

    // 生命周期时间
    table.datetime('expires_at').nullable().comment('过期时间');
    table.datetime('next_transition_at').nullable().comment('下次转移时间');
    table.json('transitions').nullable().comment('转移计划');
    table.datetime('deleted_at').nullable().comment('删除时间');

    // 时间戳
    table.datetime('created_at').defaultTo(knex.raw('CURRENT_TIMESTAMP'));
    table.datetime('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    // 索引
    table.index('category', 'idx_file_lifecycle_category');
    table.index('status', 'idx_file_lifecycle_status');
    table.index('expires_at', 'idx_file_lifecycle_expires');
    table.index('next_transition_at', 'idx_file_lifecycle_transition');
    table.index('created_at', 'idx_file_lifecycle_created');
    table.index(['category', 'status'], 'idx_file_lifecycle_category_status');
    table.index(['task_id', 'status'], 'idx_file_lifecycle_task_status');
    table.index(['user_id', 'status'], 'idx_file_lifecycle_user_status');
    table.index(['storage_class', 'status'], 'idx_file_lifecycle_storage_status');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('file_lifecycle_records');
};