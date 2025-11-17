/**
 * BE-DB-INDEX-001: 添加核心索引优化（简化版）
 *
 * 根据查询模式优化数据库索引，提升查询性能
 */
const getRows = (result) => {
  if (Array.isArray(result)) {
    return result[0] ?? [];
  }
  if (result && typeof result === 'object' && Array.isArray(result.rows)) {
    return result.rows;
  }
  return [];
};

const tableColumnsCache = new Map();

const resolveColumn = async (knex, tableName, candidates) => {
  let columns = tableColumnsCache.get(tableName);
  if (!columns) {
    const raw = await knex.raw('SHOW COLUMNS FROM ??', [tableName]);
    const rows = getRows(raw);
    columns = rows.map((row) => row.Field);
    tableColumnsCache.set(tableName, columns);
  }
  const normalize = (value) => value.replace(/_/g, '').toLowerCase();
  const normalizedMap = new Map(columns.map((col) => [normalize(col), col]));

  for (const candidate of candidates) {
    if (columns.includes(candidate)) {
      console.log(`[Migration:add_core_indexes] 列 ${candidate} 在 ${tableName} 直接匹配`);
      return candidate;
    }
    const normalizedMatch = normalizedMap.get(normalize(candidate));
    if (normalizedMatch) {
      console.log(
        `[Migration:add_core_indexes] 列 ${candidate} 在 ${tableName} 映射为 ${normalizedMatch}`
      );
      return normalizedMatch;
    }
  }
  return null;
};

const indexExists = async (knex, tableName, indexName) => {
  const raw = await knex.raw('SHOW INDEX FROM ?? WHERE Key_name = ?', [tableName, indexName]);
  const rows = getRows(raw);
  return rows.length > 0;
};

const addIndexSafe = async (knex, tableName, columnCandidates, indexName) => {
  const actualColumns = [];
  for (const candidates of columnCandidates) {
    const column = await resolveColumn(
      knex,
      tableName,
      Array.isArray(candidates) ? candidates : [candidates]
    );
    if (!column) {
      console.warn(
        `[Migration:add_core_indexes] 跳过索引 ${indexName}，列 ${candidates} 在 ${tableName} 不存在`
      );
      return;
    }
    actualColumns.push(column);
  }

  const exists = await indexExists(knex, tableName, indexName);
  if (exists) {
    return;
  }

  const placeholders = actualColumns.map(() => '??').join(', ');
  console.log(
    `[Migration:add_core_indexes] 创建索引 ${indexName} 于 ${tableName} 列 ${actualColumns.join(', ')}`
  );
  await knex.raw(`ALTER TABLE ?? ADD INDEX ?? (${placeholders})`, [
    tableName,
    indexName,
    ...actualColumns
  ]);
};

exports.up = async function (knex) {
  // users
  await addIndexSafe(knex, 'users', [['isMember'], ['quota_remaining']], 'idx_users_member_quota');
  await addIndexSafe(knex, 'users', [['created_at'], ['id']], 'idx_users_created_at');
  await addIndexSafe(knex, 'users', [['quota_expireAt']], 'idx_users_quota_expire');

  // tasks
  await addIndexSafe(
    knex,
    'tasks',
    [['user_id', 'userId'], ['created_at', 'createdAt'], ['id']],
    'idx_tasks_user_time'
  );
  await addIndexSafe(knex, 'tasks', [['user_id', 'userId'], ['status']], 'idx_tasks_user_status');
  await addIndexSafe(
    knex,
    'tasks',
    [['status'], ['created_at', 'createdAt'], ['id']],
    'idx_tasks_status_time'
  );
  await addIndexSafe(knex, 'tasks', [['type']], 'idx_tasks_type');
  await addIndexSafe(knex, 'tasks', [['vendorTaskId']], 'idx_tasks_vendor_task');
  await addIndexSafe(knex, 'tasks', [['type'], ['status']], 'idx_tasks_type_status');
  await addIndexSafe(
    knex,
    'tasks',
    [['user_id', 'userId'], ['type'], ['status'], ['created_at', 'createdAt']],
    'idx_tasks_user_type_status_time'
  );

  // quota_transactions (新表使用 snake_case)
  await addIndexSafe(knex, 'quota_transactions', [['user_id']], 'idx_quota_user');
  await addIndexSafe(knex, 'quota_transactions', [['phase']], 'idx_quota_phase');
  await addIndexSafe(knex, 'quota_transactions', [['user_id'], ['phase']], 'idx_quota_user_phase');
  await addIndexSafe(knex, 'quota_transactions', [['created_at']], 'idx_quota_created');
  await addIndexSafe(
    knex,
    'quota_transactions',
    [['user_id'], ['phase'], ['created_at']],
    'idx_quota_user_phase_time'
  );

  // feature_definitions
  await addIndexSafe(knex, 'feature_definitions', [['is_enabled']], 'idx_feature_enabled');
  await addIndexSafe(
    knex,
    'feature_definitions',
    [['pipeline_schema_ref']],
    'idx_feature_pipeline'
  );
  await addIndexSafe(knex, 'feature_definitions', [['category']], 'idx_feature_category');
  await addIndexSafe(
    knex,
    'feature_definitions',
    [['is_enabled'], ['category']],
    'idx_feature_enabled_category'
  );

  // task_steps
  await addIndexSafe(knex, 'task_steps', [['task_id']], 'idx_steps_task');
  await addIndexSafe(knex, 'task_steps', [['status']], 'idx_steps_status');
  await addIndexSafe(knex, 'task_steps', [['task_id'], ['step_index']], 'idx_steps_task_index');
  await addIndexSafe(knex, 'task_steps', [['task_id'], ['status']], 'idx_steps_task_status');
  await addIndexSafe(knex, 'task_steps', [['type']], 'idx_steps_type');
  await addIndexSafe(knex, 'task_steps', [['provider_ref']], 'idx_steps_provider');
  await addIndexSafe(
    knex,
    'task_steps',
    [['status'], ['created_at', 'createdAt']],
    'idx_steps_status_time'
  );

  // orders
  await addIndexSafe(
    knex,
    'orders',
    [
      ['user_id', 'userId'],
      ['created_at', 'createdAt']
    ],
    'idx_orders_user_time'
  );
  await addIndexSafe(knex, 'orders', [['status']], 'idx_orders_status');
  await addIndexSafe(knex, 'orders', [['type']], 'idx_orders_type');
  await addIndexSafe(
    knex,
    'orders',
    [['external_order_id', 'transactionId']],
    'idx_orders_external'
  );
  await addIndexSafe(knex, 'orders', [['user_id', 'userId'], ['status']], 'idx_orders_user_status');
  await addIndexSafe(knex, 'orders', [['payment_status']], 'idx_orders_payment');

  console.log('✓ 核心索引优化完成（兼容旧列名）');
};

const dropIndexIfExists = async (knex, tableName, indexName) => {
  const exists = await indexExists(knex, tableName, indexName);
  if (!exists) {
    return;
  }
  await knex.raw('ALTER TABLE ?? DROP INDEX ??', [tableName, indexName]);
};

exports.down = async function (knex) {
  const indexMap = {
    users: ['idx_users_member_quota', 'idx_users_created_at', 'idx_users_quota_expire'],
    tasks: [
      'idx_tasks_user_time',
      'idx_tasks_user_status',
      'idx_tasks_status_time',
      'idx_tasks_type',
      'idx_tasks_vendor_task',
      'idx_tasks_type_status',
      'idx_tasks_user_type_status_time'
    ],
    quota_transactions: [
      'idx_quota_user',
      'idx_quota_phase',
      'idx_quota_user_phase',
      'idx_quota_created',
      'idx_quota_user_phase_time'
    ],
    feature_definitions: [
      'idx_feature_enabled',
      'idx_feature_pipeline',
      'idx_feature_category',
      'idx_feature_enabled_category'
    ],
    task_steps: [
      'idx_steps_task',
      'idx_steps_status',
      'idx_steps_task_index',
      'idx_steps_task_status',
      'idx_steps_type',
      'idx_steps_provider',
      'idx_steps_status_time'
    ],
    orders: [
      'idx_orders_user_time',
      'idx_orders_status',
      'idx_orders_type',
      'idx_orders_external',
      'idx_orders_user_status',
      'idx_orders_payment'
    ]
  };

  for (const [tableName, indexes] of Object.entries(indexMap)) {
    for (const indexName of indexes) {
      // eslint-disable-next-line no-await-in-loop
      await dropIndexIfExists(knex, tableName, indexName);
    }
  }

  console.log('✓ 索引优化回滚完成');
};
