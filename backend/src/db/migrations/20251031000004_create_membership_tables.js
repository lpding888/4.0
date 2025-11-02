/**
 * 会员套餐系统迁移
 * 艹，三张表搞定套餐+权益管理！
 * 1. membership_plans - 套餐表
 * 2. membership_benefits - 权益表
 * 3. plan_benefits - 套餐权益关联表
 */

exports.up = async function (knex) {
  // 1. 创建会员套餐表
  await knex.schema.createTable('membership_plans', (table) => {
    table.increments('id').primary();

    // 基本信息
    table.string('name', 100).notNullable().comment('套餐名称');
    table.string('slug', 50).notNullable().unique().comment('唯一标识符');
    table.text('description').nullable().comment('套餐描述');

    // 定价信息
    table.decimal('price', 10, 2).notNullable().defaultTo(0).comment('价格');
    table.string('currency', 10).notNullable().defaultTo('CNY').comment('货币');
    table.integer('duration_days').notNullable().comment('有效期（天）');

    // 配额限制
    table.integer('quota_uploads').nullable().comment('上传次数配额（null=无限）');
    table.integer('quota_storage').nullable().comment('存储空间配额MB（null=无限）');
    table.json('quota_features').nullable().comment('功能配额JSON');

    // 状态
    table.enum('status', ['active', 'inactive', 'archived']).notNullable().defaultTo('active');
    table.integer('sort_order').notNullable().defaultTo(0).comment('排序序号');

    // 标记
    table.boolean('is_default').notNullable().defaultTo(false).comment('是否默认套餐');
    table.boolean('is_popular').notNullable().defaultTo(false).comment('是否热门推荐');

    // 元数据
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // 索引
    table.index('slug');
    table.index('status');
    table.index(['status', 'sort_order']);
  });

  // 2. 创建权益表
  await knex.schema.createTable('membership_benefits', (table) => {
    table.increments('id').primary();

    // 基本信息
    table.string('name', 100).notNullable().comment('权益名称');
    table.string('key', 50).notNullable().unique().comment('权益键（编程用）');
    table.text('description').nullable().comment('权益描述');

    // 权益类型
    table.enum('type', ['feature', 'quota', 'service', 'discount']).notNullable().comment('权益类型');

    // 权益值（根据type不同含义不同）
    table.string('value', 500).nullable().comment('权益值');

    // 图标和样式
    table.string('icon', 100).nullable().comment('图标名称/URL');
    table.string('color', 20).nullable().comment('颜色');

    // 状态
    table.enum('status', ['active', 'inactive']).notNullable().defaultTo('active');

    // 元数据
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // 索引
    table.index('key');
    table.index('type');
    table.index('status');
  });

  // 3. 创建套餐权益关联表
  await knex.schema.createTable('plan_benefits', (table) => {
    table.increments('id').primary();

    // 关联
    table.integer('plan_id').unsigned().notNullable();
    table.integer('benefit_id').unsigned().notNullable();

    // 自定义配置（可选）
    table.string('custom_value', 500).nullable().comment('自定义权益值（覆盖默认）');
    table.integer('sort_order').notNullable().defaultTo(0).comment('在套餐中的排序');

    // 元数据
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // 外键
    table.foreign('plan_id').references('id').inTable('membership_plans').onDelete('CASCADE');
    table.foreign('benefit_id').references('id').inTable('membership_benefits').onDelete('CASCADE');

    // 唯一约束（一个套餐不能重复添加同一权益）
    table.unique(['plan_id', 'benefit_id']);

    // 索引
    table.index('plan_id');
    table.index('benefit_id');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('plan_benefits');
  await knex.schema.dropTableIfExists('membership_benefits');
  await knex.schema.dropTableIfExists('membership_plans');
};
