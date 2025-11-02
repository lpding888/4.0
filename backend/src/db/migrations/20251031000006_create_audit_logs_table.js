/**
 * 审计日志表迁移
 * 艹，记录所有CMS内容操作！
 */

exports.up = function (knex) {
  return knex.schema.createTable('audit_logs', (table) => {
    table.increments('id').primary();

    // 操作信息
    table.string('entity_type', 50).notNullable().comment('实体类型（announcement/banner/plan等）');
    table.integer('entity_id').unsigned().nullable().comment('实体ID');
    table.enum('action', ['create', 'update', 'delete', 'publish', 'unpublish', 'approve', 'reject'])
      .notNullable()
      .comment('操作类型');

    // 操作者
    table.integer('user_id').unsigned().nullable().comment('操作用户ID');
    table.string('user_name', 100).nullable().comment('操作用户名（冗余）');

    // 变更详情
    table.json('changes').nullable().comment('变更内容JSON');
    table.text('reason').nullable().comment('操作原因/备注');

    // IP和User-Agent
    table.string('ip_address', 50).nullable();
    table.string('user_agent', 500).nullable();

    // 时间戳
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // 索引
    table.index('entity_type');
    table.index('entity_id');
    table.index(['entity_type', 'entity_id']);
    table.index('user_id');
    table.index('action');
    table.index('created_at');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('audit_logs');
};
