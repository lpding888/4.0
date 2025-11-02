/**
 * 轮播图表迁移
 * 艹，支持拖拽排序和定时上下线！
 */

exports.up = function (knex) {
  return knex.schema.createTable('banners', (table) => {
    table.increments('id').primary();

    // 基本信息
    table.string('title', 200).notNullable().comment('轮播图标题');
    table.string('image_url', 500).notNullable().comment('图片URL');
    table.string('link_url', 500).nullable().comment('点击跳转链接');
    table.text('description').nullable().comment('描述');

    // 排序（数字越小越靠前）
    table.integer('sort_order').notNullable().defaultTo(0).comment('排序序号');

    // 状态
    table.enum('status', ['draft', 'published', 'expired']).notNullable().defaultTo('draft');

    // 定时上下线
    table.timestamp('publish_at').nullable().comment('定时发布时间');
    table.timestamp('expire_at').nullable().comment('过期时间');

    // 目标受众
    table.enum('target_audience', ['all', 'member', 'vip']).notNullable().defaultTo('all');

    // 创建信息
    table.integer('created_by').unsigned().nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // 索引
    table.index('status');
    table.index('sort_order');
    table.index(['status', 'sort_order']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('banners');
};
