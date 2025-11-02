/**
 * 创建task_steps表 - 任务步骤执行记录表
 * 记录Pipeline中每个步骤的执行状态/输入输出/错误信息等
 */
exports.up = function(knex) {
  return knex.schema.createTable('task_steps', function(table) {
    table.increments('id').primary().comment('自增ID');
    table.string('task_id', 100).notNullable().comment('任务ID(外键)');
    table.integer('step_index').notNullable().comment('步骤索引(从0开始)');
    table.string('type', 50).notNullable().comment('步骤类型(SYNC_IMAGE_PROCESS/RUNNINGHUB_WORKFLOW/SCF_POST_PROCESS)');
    table.string('provider_ref', 100).notNullable().comment('供应商引用ID');
    table.string('status', 20).defaultTo('pending').comment('步骤状态(pending/running/success/failed)');
    table.json('input').nullable().comment('步骤输入(JSON对象)');
    table.json('output').nullable().comment('步骤输出(JSON对象)');
    table.text('error_message').nullable().comment('错误信息');
    table.timestamp('started_at').nullable().comment('开始时间');
    table.timestamp('completed_at').nullable().comment('完成时间');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');

    // 外键约束
    table.foreign('task_id').references('tasks.id').onDelete('CASCADE');

    // 唯一约束(一个任务的同一步骤索引只能有一条记录)
    table.unique(['task_id', 'step_index'], 'unique_task_step');

    // 索引
    table.index('task_id');
    table.index('status');
    table.index(['task_id', 'step_index']);
  })
  .then(() => {
    console.log('✓ task_steps表创建成功');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('task_steps');
};
