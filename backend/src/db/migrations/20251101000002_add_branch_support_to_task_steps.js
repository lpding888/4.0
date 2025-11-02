/**
 * 扩展task_steps表 - 支持FORK/JOIN并行分支
 * 艹，这个tm太重要了！没有branch_id就没法并行执行！
 */
exports.up = function(knex) {
  return knex.schema.table('task_steps', function(table) {
    // 1. 添加branch_id字段（默认'main'表示主分支）
    table.string('branch_id', 50).defaultTo('main').comment('分支ID：main表示主分支，fork-1/fork-2表示并行分支');

    // 2. 添加parent_step_id字段（用于追溯FORK节点）
    table.integer('parent_step_id').nullable().comment('父步骤ID：指向创建此分支的FORK节点');

    // 3. 添加join_strategy字段（用于JOIN节点）
    table.string('join_strategy', 20).nullable().comment('JOIN策略：ALL/ANY/FIRST');

    // 4. 添加branch_results字段（存储多分支结果）
    table.json('branch_results').nullable().comment('分支结果汇总（JOIN节点使用）');

    // 索引
    table.index(['task_id', 'branch_id']);
    table.index('parent_step_id');
  })
  .then(async () => {
    // 5. 艹，删除旧的唯一约束
    await knex.schema.alterTable('task_steps', function(table) {
      table.dropUnique(['task_id', 'step_index'], 'unique_task_step');
    });

    console.log('✓ 已删除旧的unique_task_step约束');
  })
  .then(async () => {
    // 6. 添加新的唯一约束（包含branch_id）
    await knex.schema.alterTable('task_steps', function(table) {
      table.unique(['task_id', 'step_index', 'branch_id'], 'unique_task_step_branch');
    });

    console.log('✓ task_steps表并行分支扩展成功（branch_id, parent_step_id, join_strategy）');
  });
};

exports.down = function(knex) {
  return knex.schema.table('task_steps', function(table) {
    table.dropUnique(['task_id', 'step_index', 'branch_id'], 'unique_task_step_branch');
    table.dropIndex(['task_id', 'branch_id']);
    table.dropIndex('parent_step_id');
    table.dropColumn('branch_results');
    table.dropColumn('join_strategy');
    table.dropColumn('parent_step_id');
    table.dropColumn('branch_id');
  })
  .then(async () => {
    // 恢复旧的唯一约束
    await knex.schema.alterTable('task_steps', function(table) {
      table.unique(['task_id', 'step_index'], 'unique_task_step');
    });
  });
};
