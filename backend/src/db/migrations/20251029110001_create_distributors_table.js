/**
 * 分销员表迁移
 */
exports.up = function(knex) {
  return knex.schema.createTable('distributors', function(table) {
    table.string('id', 32).primary().comment('分销员ID');
    table.string('user_id', 32).notNullable().unique().comment('关联用户ID');
    table.string('real_name', 50).notNullable().comment('真实姓名');
    table.string('id_card', 18).notNullable().comment('身份证号');
    table.string('contact', 50).notNullable().comment('联系方式');
    table.text('channel').nullable().comment('推广渠道说明');
    table.string('status', 20).defaultTo('pending').comment('状态: pending=待审核, active=已激活, disabled=已禁用');
    table.datetime('approval_time').nullable().comment('审核通过时间');
    table.string('invite_code', 10).unique().notNullable().comment('专属邀请码');
    table.decimal('total_commission', 10, 2).defaultTo(0).comment('累计佣金');
    table.decimal('available_commission', 10, 2).defaultTo(0).comment('可提现佣金');
    table.decimal('withdrawn_commission', 10, 2).defaultTo(0).comment('已提现佣金');
    table.timestamps(true, true);

    // 外键
    table.foreign('user_id').references('users.id').onDelete('CASCADE');

    // 索引
    table.index('user_id', 'idx_distributors_user');
    table.index('status', 'idx_distributors_status');
    table.index('invite_code', 'idx_distributors_invite_code');
  })
  .then(() => {
    console.log('✓ distributors表创建成功');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('distributors');
};
