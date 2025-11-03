/**
 * 创建配额事务表 - Saga模式实现
 *
 * 用途: 记录配额操作的各个阶段状态
 * 三阶段: reserved(预留) → confirmed(确认) | cancelled(取消)
 */
exports.up = function(knex) {
  return knex.schema.createTable('quota_transactions', (table) => {
    // 主键 - 使用UUID
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));

    // 关联任务ID - 唯一约束，一个任务只能有一次配额操作
    table.string('task_id', 32).notNullable().unique().comment('关联的任务ID');

    // 用户ID
    table.string('user_id', 32).notNullable().comment('用户ID');

    // 配额数量
    table.integer('amount').notNullable().unsigned().defaultTo(1).comment('配额数量');

    // 阶段状态 - 枚举类型
    table.enum('phase', ['reserved', 'confirmed', 'cancelled'])
      .notNullable()
      .defaultTo('reserved')
      .comment('事务阶段: reserved-预留, confirmed-确认, cancelled-取消');

    // 幂等性标记 - 是否已完成处理
    table.boolean('idempotent_done')
      .notNullable()
      .defaultTo(true)
      .comment('幂等性标记，防止重复处理');

    // 时间戳
    table.timestamps(true, true);

    // 索引
    table.index('task_id', 'idx_quota_transactions_task_id');
    table.index('user_id', 'idx_quota_transactions_user_id');
    table.index('phase', 'idx_quota_transactions_phase');
    table.index(['user_id', 'phase'], 'idx_quota_transactions_user_phase');
    table.index('created_at', 'idx_quota_transactions_created_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('quota_transactions');
};