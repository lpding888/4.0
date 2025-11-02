/**
 * 创建审计日志表，记录敏感操作
 */
exports.up = async function(knex) {
  const tableName = 'audit_logs'; // Extract table name
  if (tableName) {
    const exists = await knex.schema.hasTable(tableName);
    if (exists) {
      console.log();
      return;
    }
  }

  return knex.schema.createTable('audit_logs', function(table) {
    table.string('id', 32).primary().comment('日志ID');
    table.string('admin_id', 32).notNullable().comment('管理员ID');
    table.string('action', 50).notNullable().comment('操作类型');
    table.string('resource_type', 50).notNullable().comment('资源类型');
    table.string('resource_id', 32).nullable().comment('资源ID');
    table.text('details').nullable().comment('操作详情(JSON)');
    table.string('ip', 45).nullable().comment('IP地址');
    table.string('user_agent', 255).nullable().comment('User Agent');
    table.datetime('created_at').notNullable().comment('创建时间');
    
    // 外键
    table.foreign('admin_id').references('users.id').onDelete('CASCADE');
    
    // 索引
    table.index(['admin_id', 'created_at'], 'idx_audit_admin_time');
    table.index(['resource_type', 'resource_id'], 'idx_audit_resource');
    table.index('action', 'idx_audit_action');
    table.index('created_at', 'idx_audit_created');
  })
  .then(() => {
    console.log('✓ audit_logs表创建成功');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('audit_logs');
};
