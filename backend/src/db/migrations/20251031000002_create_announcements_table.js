/**
 * 公告表迁移
 * 艹，这个tm存储系统公告，支持定时上下线！
 */

exports.up = function (knex) {
  return knex.schema.createTable('announcements', (table) => {
    // 主键
    table.increments('id').primary();

    // 公告基本信息
    table.string('title', 200).notNullable().comment('公告标题');
    table.text('content').notNullable().comment('公告内容');
    table
      .enum('type', ['info', 'warning', 'success', 'error'])
      .notNullable()
      .defaultTo('info')
      .comment('公告类型');

    // 显示位置
    table
      .enum('position', ['top', 'modal', 'banner'])
      .notNullable()
      .defaultTo('top')
      .comment('显示位置：top=顶部横幅, modal=弹窗, banner=横幅');

    // 优先级（数字越大越靠前）
    table.integer('priority').notNullable().defaultTo(0).comment('优先级');

    // 状态控制
    table
      .enum('status', ['draft', 'published', 'expired'])
      .notNullable()
      .defaultTo('draft')
      .comment('状态：draft=草稿, published=已发布, expired=已过期');

    // 定时上线
    table
      .timestamp('publish_at')
      .nullable()
      .comment('定时发布时间（null表示立即发布）');

    // 定时下线
    table.timestamp('expire_at').nullable().comment('过期时间（null表示永久）');

    // 目标受众（可扩展）
    table
      .enum('target_audience', ['all', 'member', 'vip'])
      .notNullable()
      .defaultTo('all')
      .comment('目标受众');

    // 可关闭性
    table
      .boolean('closable')
      .notNullable()
      .defaultTo(true)
      .comment('用户是否可关闭');

    // 创建和更新
    table.integer('created_by').unsigned().nullable().comment('创建人');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // 索引
    table.index('status');
    table.index('publish_at');
    table.index('expire_at');
    table.index(['status', 'publish_at', 'expire_at']);
    table.index('priority');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('announcements');
};
