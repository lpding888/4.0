/**
 * BE-DB-INDEX-001: 添加核心索引优化（简化版）
 *
 * 根据查询模式优化数据库索引，提升查询性能
 */
exports.up = function(knex) {
  return knex.schema
    // 1. users表索引优化
    .table('users', (table) => {
      table.index(['isMember', 'quota_remaining'], 'idx_users_member_quota');
      table.index('created_at', 'idx_users_created_at');
      table.index('quota_expireAt', 'idx_users_quota_expire');
    })
    // 2. tasks表索引优化（核心查询表）
    .table('tasks', (table) => {
      table.index(['userId', 'created_at', 'id'], 'idx_tasks_user_time');
      table.index(['userId', 'status'], 'idx_tasks_user_status');
      table.index(['status', 'created_at', 'id'], 'idx_tasks_status_time');
      table.index('type', 'idx_tasks_type');
      table.index('vendorTaskId', 'idx_tasks_vendor_task');
      table.index(['type', 'status'], 'idx_tasks_type_status');
      table.index(['userId', 'type', 'status', 'created_at'], 'idx_tasks_user_type_status_time');
    })
    // 3. quota_transactions表索引优化
    .table('quota_transactions', (table) => {
      table.index('user_id', 'idx_quota_user');
      table.index('phase', 'idx_quota_phase');
      table.index(['user_id', 'phase'], 'idx_quota_user_phase');
      table.index('created_at', 'idx_quota_created');
      table.index(['user_id', 'phase', 'created_at'], 'idx_quota_user_phase_time');
    })
    // 4. feature_definitions表索引优化
    .table('feature_definitions', (table) => {
      table.index('is_enabled', 'idx_feature_enabled');
      table.index('pipeline_schema_ref', 'idx_feature_pipeline');
      table.index('category', 'idx_feature_category');
      table.index(['is_enabled', 'category'], 'idx_feature_enabled_category');
    })
    // 5. task_steps表索引优化
    .table('task_steps', (table) => {
      table.index('task_id', 'idx_steps_task');
      table.index('status', 'idx_steps_status');
      table.index(['task_id', 'step_index'], 'idx_steps_task_index');
      table.index(['task_id', 'status'], 'idx_steps_task_status');
      table.index('type', 'idx_steps_type');
      table.index('provider_ref', 'idx_steps_provider');
      table.index(['status', 'created_at'], 'idx_steps_status_time');
    })
    // 6. orders表索引优化
    .table('orders', (table) => {
      table.index(['user_id', 'created_at'], 'idx_orders_user_time');
      table.index('status', 'idx_orders_status');
      table.index('type', 'idx_orders_type');
      table.index('external_order_id', 'idx_orders_external');
      table.index(['user_id', 'status'], 'idx_orders_user_status');
      table.index('payment_status', 'idx_orders_payment');
    })
    .then(() => {
      console.log('✓ 核心索引优化完成');
    });
};

exports.down = function(knex) {
  return knex.raw(`
    -- 删除添加的索引（忽略不存在的错误）
    ALTER TABLE users DROP INDEX idx_users_member_quota;
    ALTER TABLE users DROP INDEX idx_users_created_at;
    ALTER TABLE users DROP INDEX idx_users_quota_expire;

    ALTER TABLE tasks DROP INDEX idx_tasks_user_time;
    ALTER TABLE tasks DROP INDEX idx_tasks_user_status;
    ALTER TABLE tasks DROP INDEX idx_tasks_status_time;
    ALTER TABLE tasks DROP INDEX idx_tasks_type;
    ALTER TABLE tasks DROP INDEX idx_tasks_vendor_task;
    ALTER TABLE tasks DROP INDEX idx_tasks_type_status;
    ALTER TABLE tasks DROP INDEX idx_tasks_user_type_status_time;

    ALTER TABLE quota_transactions DROP INDEX idx_quota_user;
    ALTER TABLE quota_transactions DROP INDEX idx_quota_phase;
    ALTER TABLE quota_transactions DROP INDEX idx_quota_user_phase;
    ALTER TABLE quota_transactions DROP INDEX idx_quota_created;
    ALTER TABLE quota_transactions DROP INDEX idx_quota_user_phase_time;

    ALTER TABLE feature_definitions DROP INDEX idx_feature_enabled;
    ALTER TABLE feature_definitions DROP INDEX idx_feature_pipeline;
    ALTER TABLE feature_definitions DROP INDEX idx_feature_category;
    ALTER TABLE feature_definitions DROP INDEX idx_feature_enabled_category;

    ALTER TABLE task_steps DROP INDEX idx_steps_task;
    ALTER TABLE task_steps DROP INDEX idx_steps_status;
    ALTER TABLE task_steps DROP INDEX idx_steps_task_index;
    ALTER TABLE task_steps DROP INDEX idx_steps_task_status;
    ALTER TABLE task_steps DROP INDEX idx_steps_type;
    ALTER TABLE task_steps DROP INDEX idx_steps_provider;
    ALTER TABLE task_steps DROP INDEX idx_steps_status_time;

    ALTER TABLE orders DROP INDEX idx_orders_user_time;
    ALTER TABLE orders DROP INDEX idx_orders_status;
    ALTER TABLE orders DROP INDEX idx_orders_type;
    ALTER TABLE orders DROP INDEX idx_orders_external;
    ALTER TABLE orders DROP INDEX idx_orders_user_status;
    ALTER TABLE orders DROP INDEX idx_orders_payment;
  `)
  .then(() => {
    console.log('✓ 索引优化回滚完成');
  });
};