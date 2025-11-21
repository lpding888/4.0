/**
 * 创建缺失的用户相关表
 *
 * P0 - 核心功能：
 * - user_configs: 用户配置表
 * - user_login_history: 用户登录历史表
 *
 * P1 - 关键功能：
 * - user_memberships: 用户会员关系表
 * - user_contents: 用户内容表
 * - partnerships: 合作伙伴表
 */

exports.up = async function (knex) {
  // 1. 用户配置表 (P0)
  await knex.schema.createTable('user_configs', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('user_id', 36).notNullable().unique().comment('用户ID');

    // 配置项
    table.boolean('auto_renew').defaultTo(false).comment('自动续费');
    table.decimal('quality_threshold', 3, 2).defaultTo(0.8).comment('质量阈值');
    table.integer('max_daily_tasks').defaultTo(10).comment('每日最大任务数');

    // 扩展配置（JSON格式，方便未来扩展）
    table.json('notification_settings').nullable().comment('通知设置');
    table.json('privacy_settings').nullable().comment('隐私设置');
    table.json('feature_preferences').nullable().comment('功能偏好');

    // 时间戳
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // 外键约束
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');

    // 索引
    table.index(['user_id']);
    table.index(['auto_renew']);
  });

  // 2. 用户登录历史表 (P0)
  await knex.schema.createTable('user_login_history', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('user_id', 36).notNullable().comment('用户ID');

    // 登录信息
    table.string('ip_address', 45).nullable().comment('IP地址（支持IPv6）');
    table.text('user_agent').nullable().comment('用户代理');
    table.string('device_type', 50).nullable().comment('设备类型');
    table.string('platform', 50).nullable().comment('登录平台');
    table.string('browser', 100).nullable().comment('浏览器');
    table.string('os', 100).nullable().comment('操作系统');

    // 地理位置信息
    table.string('country', 50).nullable().comment('国家');
    table.string('city', 100).nullable().comment('城市');
    table.decimal('latitude', 10, 8).nullable().comment('纬度');
    table.decimal('longitude', 11, 8).nullable().comment('经度');

    // 登录状态
    table.enum('status', ['success', 'failed', 'blocked']).defaultTo('success').comment('登录状态');
    table.string('login_method', 50).nullable().comment('登录方式（password/wechat/email等）');
    table.text('failure_reason').nullable().comment('失败原因');

    // 会话信息
    table.string('session_id', 100).nullable().comment('会话ID');
    table.timestamp('session_expires_at').nullable().comment('会话过期时间');

    // 时间戳
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    // 外键约束
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');

    // 索引（用于欺诈检测查询）
    table.index(['user_id']);
    table.index(['ip_address']);
    table.index(['user_agent']);
    table.index(['created_at']);
    table.index(['status']);
    table.index(['user_id', 'ip_address']);
    table.index(['user_id', 'created_at']);
  });

  // 3. 用户会员关系表 (P1)
  await knex.schema.createTable('user_memberships', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('user_id', 36).notNullable().comment('用户ID');
    table.integer('plan_id').unsigned().nullable().comment('套餐ID');

    // 会员信息
    table.string('membership_type', 50).notNullable().comment('会员类型（free/basic/premium/enterprise）');
    table.enum('status', ['active', 'expired', 'cancelled', 'suspended']).defaultTo('active').comment('会员状态');

    // 时间信息
    table.timestamp('start_date').notNullable().comment('开始时间');
    table.timestamp('end_date').nullable().comment('结束时间');
    table.timestamp('cancelled_at').nullable().comment('取消时间');

    // 付费信息
    table.decimal('amount_paid', 10, 2).defaultTo(0).comment('支付金额');
    table.string('currency', 10).defaultTo('CNY').comment('货币');
    table.string('order_id', 36).nullable().comment('订单ID');
    table.string('payment_method', 50).nullable().comment('支付方式');

    // 自动续费
    table.boolean('auto_renew').defaultTo(false).comment('是否自动续费');
    table.timestamp('next_billing_date').nullable().comment('下次扣费时间');

    // 备注
    table.text('notes').nullable().comment('备注');
    table.json('metadata').nullable().comment('元数据');

    // 时间戳
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // 外键约束
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('plan_id').references('id').inTable('membership_plans').onDelete('SET NULL');
    table.foreign('order_id').references('id').inTable('orders').onDelete('SET NULL');

    // 索引
    table.index(['user_id']);
    table.index(['status']);
    table.index(['membership_type']);
    table.index(['end_date']);
    table.index(['user_id', 'status']);
  });

  // 4. 用户内容表 (P1)
  await knex.schema.createTable('user_contents', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('user_id', 36).notNullable().comment('用户ID');

    // 内容基本信息
    table.string('title', 200).nullable().comment('标题');
    table.text('description').nullable().comment('描述');
    table.enum('content_type', ['image', 'video', 'text', 'model', 'mixed']).notNullable().comment('内容类型');
    table.string('category', 50).nullable().comment('分类');

    // 内容存储
    table.string('content_url', 500).nullable().comment('内容URL');
    table.string('thumbnail_url', 500).nullable().comment('缩略图URL');
    table.json('content_data').nullable().comment('内容数据（JSON）');

    // 文件信息
    table.string('file_format', 50).nullable().comment('文件格式');
    table.bigInteger('file_size').nullable().comment('文件大小（字节）');
    table.integer('width').nullable().comment('宽度（像素）');
    table.integer('height').nullable().comment('高度（像素）');
    table.integer('duration').nullable().comment('时长（秒，用于视频）');

    // 状态和权限
    table.enum('status', ['draft', 'published', 'archived', 'deleted']).defaultTo('draft').comment('状态');
    table.enum('visibility', ['public', 'private', 'unlisted']).defaultTo('private').comment('可见性');

    // 统计信息
    table.integer('view_count').defaultTo(0).comment('浏览次数');
    table.integer('like_count').defaultTo(0).comment('点赞数');
    table.integer('share_count').defaultTo(0).comment('分享数');
    table.integer('download_count').defaultTo(0).comment('下载数');

    // 质量评分
    table.decimal('quality_score', 5, 2).nullable().comment('质量评分');
    table.json('ai_analysis').nullable().comment('AI分析结果');

    // 关联信息
    table.string('task_id', 36).nullable().comment('关联任务ID');
    table.string('source', 100).nullable().comment('来源');

    // 标签和元数据
    table.json('tags').nullable().comment('标签数组');
    table.json('metadata').nullable().comment('元数据');

    // 时间戳
    table.timestamp('published_at').nullable().comment('发布时间');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // 外键约束
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('task_id').references('id').inTable('tasks').onDelete('SET NULL');

    // 索引
    table.index(['user_id']);
    table.index(['content_type']);
    table.index(['status']);
    table.index(['visibility']);
    table.index(['created_at']);
    table.index(['published_at']);
    table.index(['user_id', 'status']);
  });

  // 5. 合作伙伴表 (P1)
  await knex.schema.createTable('partnerships', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('user_id', 36).notNullable().comment('用户ID');

    // 合作伙伴基本信息
    table.string('partnership_name', 200).nullable().comment('合作伙伴名称');
    table.string('partnership_code', 50).nullable().unique().comment('合作伙伴代码');
    table.enum('partnership_type', ['affiliate', 'reseller', 'integration', 'strategic', 'other']).notNullable().comment('合作类型');
    table.enum('partnership_level', ['bronze', 'silver', 'gold', 'platinum']).defaultTo('bronze').comment('合作等级');

    // 状态
    table.enum('status', ['pending', 'active', 'suspended', 'terminated']).defaultTo('pending').comment('合作状态');

    // 合作期限
    table.timestamp('start_date').notNullable().comment('开始时间');
    table.timestamp('end_date').nullable().comment('结束时间');

    // 联系信息
    table.string('contact_name', 100).nullable().comment('联系人姓名');
    table.string('contact_email', 100).nullable().comment('联系人邮箱');
    table.string('contact_phone', 20).nullable().comment('联系人电话');
    table.string('company_name', 200).nullable().comment('公司名称');
    table.string('company_website', 200).nullable().comment('公司网站');

    // 佣金配置
    table.decimal('commission_rate', 5, 2).defaultTo(0).comment('佣金比例（%）');
    table.decimal('fixed_commission', 10, 2).defaultTo(0).comment('固定佣金');
    table.json('commission_config').nullable().comment('佣金配置（JSON）');

    // 权益和限制
    table.json('benefits').nullable().comment('合作伙伴权益');
    table.json('restrictions').nullable().comment('限制条件');
    table.integer('referral_quota').nullable().comment('推荐配额（null=无限）');
    table.integer('used_quota').defaultTo(0).comment('已使用配额');

    // 财务信息
    table.decimal('total_revenue', 15, 2).defaultTo(0).comment('总收益');
    table.decimal('pending_payout', 15, 2).defaultTo(0).comment('待支付金额');
    table.decimal('paid_amount', 15, 2).defaultTo(0).comment('已支付金额');
    table.timestamp('last_payout_at').nullable().comment('最后支付时间');

    // 统计信息
    table.integer('total_referrals').defaultTo(0).comment('总推荐数');
    table.integer('successful_referrals').defaultTo(0).comment('成功推荐数');
    table.integer('conversion_rate').defaultTo(0).comment('转化率（%）');

    // 合同和文档
    table.string('contract_url', 500).nullable().comment('合同URL');
    table.json('documents').nullable().comment('相关文档');

    // 备注
    table.text('notes').nullable().comment('备注');
    table.json('metadata').nullable().comment('元数据');

    // 审核信息
    table.string('approved_by', 36).nullable().comment('审核人ID');
    table.timestamp('approved_at').nullable().comment('审核时间');

    // 时间戳
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // 外键约束
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');

    // 索引
    table.index(['user_id']);
    table.index(['partnership_code']);
    table.index(['partnership_type']);
    table.index(['partnership_level']);
    table.index(['status']);
    table.index(['start_date']);
    table.index(['end_date']);
  });
};

exports.down = async function (knex) {
  // 按依赖关系逆序删除表
  await knex.schema.dropTableIfExists('partnerships');
  await knex.schema.dropTableIfExists('user_contents');
  await knex.schema.dropTableIfExists('user_memberships');
  await knex.schema.dropTableIfExists('user_login_history');
  await knex.schema.dropTableIfExists('user_configs');
};
