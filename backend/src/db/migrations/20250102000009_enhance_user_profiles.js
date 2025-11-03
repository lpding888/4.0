/**
 * 增强用户资料表
 *
 * 完善用户信息系统：
 * - 基础个人信息扩展
 * - 社交媒体账号绑定
 * - 偏好设置和隐私控制
 * - 用户状态和认证级别
 * - 个人简介和头像管理
 */

exports.up = async function(knex) {
  // 扩展用户主表 - 添加基础个人信息
  await knex.schema.alterTable('users', (table) => {
    // 基础信息扩展
    table.string('first_name', 50).nullable().comment('名');
    table.string('last_name', 50).nullable().comment('姓');
    table.date('birth_date').nullable().comment('出生日期');
    table.enum('gender', ['male', 'female', 'other', 'prefer_not_to_say']).nullable().comment('性别');
    table.string('phone', 20).nullable().comment('手机号');
    table.string('country', 50).nullable().comment('国家');
    table.string('state', 50).nullable().comment('省/州');
    table.string('city', 50).nullable().comment('城市');
    table.string('address', 200).nullable().comment('详细地址');
    table.string('postal_code', 20).nullable().comment('邮政编码');

    // 职业和教育信息
    table.string('occupation', 100).nullable().comment('职业');
    table.string('company', 100).nullable().comment('公司');
    table.string('industry', 50).nullable().comment('行业');
    table.string('education_level', 50).nullable().comment('教育程度');
    table.string('university', 100).nullable().comment('大学');

    // 兴趣爱好
    table.text('interests').nullable().comment('兴趣爱好');
    table.text('bio').nullable().comment('个人简介');

    // 认证和安全
    table.enum('verification_level', ['basic', 'verified', 'premium']).defaultTo('basic').comment('认证级别');
    table.boolean('phone_verified').defaultTo(false).comment('手机是否验证');
    table.boolean('email_verified').defaultTo(false).comment('邮箱是否验证');
    table.timestamp('phone_verified_at').nullable().comment('手机验证时间');
    table.timestamp('email_verified_at').nullable().comment('邮箱验证时间');

    // 隐私设置
    table.boolean('profile_public').defaultTo(true).comment('资料是否公开');
    table.boolean('show_email').defaultTo(false).comment('是否显示邮箱');
    table.boolean('show_phone').defaultTo(false).comment('是否显示手机号');
    table.json('privacy_settings').nullable().comment('隐私设置JSON');

    // 偏好设置
    table.enum('language', ['zh-CN', 'en-US', 'ja-JP', 'ko-KR']).defaultTo('zh-CN').comment('首选语言');
    table.string('timezone', 50).defaultTo('Asia/Shanghai').comment('时区');
    table.json('notification_preferences').nullable().comment('通知偏好设置');
    table.json('ui_preferences').nullable().comment('界面偏好设置');

    // 社交媒体
    table.string('wechat_id', 50).nullable().comment('微信号');
    table.string('qq_number', 20).nullable().comment('QQ号');
    table.string('weibo_id', 50).nullable().comment('微博ID');
    table.string('twitter_id', 50).nullable().comment('Twitter ID');
    table.string('instagram_id', 50).nullable().comment('Instagram ID');
    table.string('linkedin_url', 200).nullable().comment('LinkedIn URL');
    table.string('github_id', 50).nullable().comment('GitHub ID');

    // 头像和媒体
    table.string('avatar_url', 500).nullable().comment('头像URL');
    table.string('banner_url', 500).nullable().comment('横幅图片URL');

    // 账户状态
    table.enum('account_status', ['active', 'suspended', 'banned', 'deleted']).defaultTo('active').comment('账户状态');
    table.text('suspension_reason').nullable().comment('暂停原因');
    table.timestamp('suspended_until').nullable().comment('暂停到期时间');

    // 统计信息
    table.integer('login_count').defaultTo(0).comment('登录次数');
    table.timestamp('last_login_at').nullable().comment('最后登录时间');
    table.string('last_login_ip', 45).nullable().comment('最后登录IP');
    table.json('login_devices').nullable().comment('登录设备信息');

    // 更新时间戳
    table.timestamp('profile_updated_at').nullable().comment('资料更新时间');

    // 索引
    table.index(['phone']);
    table.index(['country']);
    table.index(['city']);
    table.index(['verification_level']);
    table.index(['account_status']);
    table.index(['last_login_at']);
    table.index(['profile_updated_at']);
  });

  // 用户社交媒体绑定表
  await knex.schema.createTable('user_social_links', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('user_id', 36).notNullable().comment('用户ID');
    table.enum('platform', ['wechat', 'qq', 'weibo', 'twitter', 'instagram', 'linkedin', 'github', 'facebook', 'tiktok', 'youtube']).notNullable().comment('社交平台');
    table.string('platform_user_id', 100).nullable().comment('平台用户ID');
    table.string('username', 100).nullable().comment('平台用户名');
    table.string('display_name', 100).nullable().comment('显示名称');
    table.string('profile_url', 500).nullable().comment('主页链接');
    table.string('avatar_url', 500).nullable().comment('头像链接');
    table.json('platform_data').nullable().comment('平台特定数据');
    table.boolean('is_verified').defaultTo(false).comment('是否已验证');
    table.boolean('is_public').defaultTo(true).comment('是否公开显示');
    table.integer('followers_count').defaultTo(0).comment('关注者数量');
    table.timestamp('linked_at').defaultTo(knex.fn.now()).comment('绑定时间');
    table.timestamp('last_sync_at').nullable().comment('最后同步时间');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 外键约束
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');

    // 唯一约束
    table.unique(['user_id', 'platform']);

    // 索引
    table.index(['user_id']);
    table.index(['platform']);
    table.index(['is_verified']);
    table.index(['is_public']);
    table.index(['linked_at']);
  });

  // 用户教育经历表
  await knex.schema.createTable('user_education', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('user_id', 36).notNullable().comment('用户ID');
    table.string('school_name', 200).notNullable().comment('学校名称');
    table.string('degree', 100).nullable().comment('学位');
    table.string('major', 100).nullable().comment('专业');
    table.enum('education_level', ['high_school', 'bachelor', 'master', 'phd', 'other']).nullable().comment('教育水平');
    table.date('start_date').nullable().comment('开始日期');
    table.date('end_date').nullable().comment('结束日期');
    table.boolean('is_current').defaultTo(false).comment('是否在读');
    table.text('description').nullable().comment('描述');
    table.decimal('gpa', 3, 2).nullable().comment('GPA');
    table.string('activities', 500).nullable().comment('课外活动');
    table.text('achievements').nullable().comment('成就');
    table.integer('display_order').defaultTo(0).comment('显示顺序');
    table.boolean('is_public').defaultTo(true).comment('是否公开');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 外键约束
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');

    // 索引
    table.index(['user_id']);
    table.index(['school_name']);
    table.index(['education_level']);
    table.index(['is_current']);
    table.index(['display_order']);
  });

  // 用户工作经历表
  await knex.schema.createTable('user_work_experience', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('user_id', 36).notNullable().comment('用户ID');
    table.string('company_name', 200).notNullable().comment('公司名称');
    table.string('job_title', 100).notNullable().comment('职位名称');
    table.string('department', 100).nullable().comment('部门');
    table.enum('employment_type', ['full_time', 'part_time', 'contract', 'internship', 'freelance', 'other']).nullable().comment('雇佣类型');
    table.date('start_date').nullable().comment('开始日期');
    table.date('end_date').nullable().comment('结束日期');
    table.boolean('is_current').defaultTo(false).comment('是否在职');
    table.string('location', 200).nullable().comment('工作地点');
    table.text('description').nullable().comment('工作描述');
    table.text('responsibilities').nullable().comment('职责');
    table.text('achievements').nullable().comment('成就');
    table.decimal('salary_start', 10, 2).nullable().comment('起始薪资');
    table.decimal('salary_end', 10, 2).nullable().comment('结束薪资');
    table.string('currency', 10).defaultTo('CNY').comment('薪资货币');
    table.string('skills', 500).nullable().comment('技能标签');
    table.integer('display_order').defaultTo(0).comment('显示顺序');
    table.boolean('is_public').defaultTo(true).comment('是否公开');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 外键约束
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');

    // 索引
    table.index(['user_id']);
    table.index(['company_name']);
    table.index(['job_title']);
    table.index(['is_current']);
    table.index(['display_order']);
  });

  // 用户技能表
  await knex.schema.createTable('user_skills', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('user_id', 36).notNullable().comment('用户ID');
    table.string('skill_name', 100).notNullable().comment('技能名称');
    table.enum('skill_level', ['beginner', 'intermediate', 'advanced', 'expert']).nullable().comment('技能水平');
    table.integer('experience_years').defaultTo(0).comment('经验年限');
    table.text('description').nullable().comment('技能描述');
    table.json('certifications').nullable().comment('相关认证');
    table.boolean('is_verified').defaultTo(false).comment('是否已验证');
    table.string('verified_by', 36).nullable().comment('验证人ID');
    table.timestamp('verified_at').nullable().comment('验证时间');
    table.integer('endorsement_count').defaultTo(0).comment('认可数量');
    table.boolean('is_public').defaultTo(true).comment('是否公开');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 外键约束
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');

    // 唯一约束
    table.unique(['user_id', 'skill_name']);

    // 索引
    table.index(['user_id']);
    table.index(['skill_name']);
    table.index(['skill_level']);
    table.index(['is_verified']);
    table.index(['endorsement_count']);
  });

  // 用户兴趣标签表
  await knex.schema.createTable('user_interest_tags', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('user_id', 36).notNullable().comment('用户ID');
    table.string('tag_name', 50).notNullable().comment('标签名称');
    table.enum('category', ['hobby', 'interest', 'preference', 'other']).defaultTo('interest').comment('标签类别');
    table.integer('weight').defaultTo(1).comment('权重(1-10)');
    table.text('description').nullable().comment('标签描述');
    table.boolean('is_public').defaultTo(true).comment('是否公开');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 外键约束
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');

    // 唯一约束
    table.unique(['user_id', 'tag_name']);

    // 索引
    table.index(['user_id']);
    table.index(['tag_name']);
    table.index(['category']);
    table.index(['weight']);
  });

  // 用户资料访问日志表
  await knex.schema.createTable('user_profile_views', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('profile_user_id', 36).notNullable().comment('被查看用户ID');
    table.string('viewer_id', 36).nullable().comment('查看者ID');
    table.string('viewer_ip', 45).nullable().comment('查看者IP');
    table.string('user_agent').nullable().comment('用户代理');
    table.enum('view_type', ['profile', 'full_profile', 'specific_section']).defaultTo('profile').comment('查看类型');
    table.json('view_data').nullable().comment('查看数据');
    table.timestamp('viewed_at').defaultTo(knex.fn.now()).comment('查看时间');

    // 外键约束
    table.foreign('profile_user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('viewer_id').references('id').inTable('users').onDelete('SET NULL');

    // 索引
    table.index(['profile_user_id']);
    table.index(['viewer_id']);
    table.index(['viewed_at']);
    table.index(['viewer_ip']);
  });

  // 用户资料完整性检查表
  await knex.schema.createTable('user_profile_completeness', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('user_id', 36).notNullable().comment('用户ID');
    table.integer('basic_info_score').defaultTo(0).comment('基础信息得分');
    table.integer('contact_info_score').defaultTo(0).comment('联系信息得分');
    table.integer('education_score').defaultTo(0).comment('教育信息得分');
    table.integer('work_score').defaultTo(0).comment('工作信息得分');
    table.integer('skills_score').defaultTo(0).comment('技能信息得分');
    table.integer('social_score').defaultTo(0).comment('社交信息得分');
    table.integer('total_score').defaultTo(0).comment('总分');
    table.integer('completeness_percentage').defaultTo(0).comment('完整度百分比');
    table.json('missing_fields').nullable().comment('缺失字段列表');
    table.json('suggestions').nullable().comment('完善建议');
    table.timestamp('last_calculated_at').defaultTo(knex.fn.now()).comment('最后计算时间');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 外键约束
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');

    // 唯一约束
    table.unique(['user_id']);

    // 索引
    table.index(['user_id']);
    table.index(['total_score']);
    table.index(['completeness_percentage']);
    table.index(['last_calculated_at']);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('user_profile_completeness');
  await knex.schema.dropTableIfExists('user_profile_views');
  await knex.schema.dropTableIfExists('user_interest_tags');
  await knex.schema.dropTableIfExists('user_skills');
  await knex.schema.dropTableIfExists('user_work_experience');
  await knex.schema.dropTableIfExists('user_education');
  await knex.schema.dropTableIfExists('user_social_links');

  // 恢复用户表到原始状态
  await knex.schema.alterTable('users', (table) => {
    // 删除所有添加的字段
    table.dropColumn('first_name');
    table.dropColumn('last_name');
    table.dropColumn('birth_date');
    table.dropColumn('gender');
    table.dropColumn('phone');
    table.dropColumn('country');
    table.dropColumn('state');
    table.dropColumn('city');
    table.dropColumn('address');
    table.dropColumn('postal_code');
    table.dropColumn('occupation');
    table.dropColumn('company');
    table.dropColumn('industry');
    table.dropColumn('education_level');
    table.dropColumn('university');
    table.dropColumn('interests');
    table.dropColumn('bio');
    table.dropColumn('verification_level');
    table.dropColumn('phone_verified');
    table.dropColumn('email_verified');
    table.dropColumn('phone_verified_at');
    table.dropColumn('email_verified_at');
    table.dropColumn('profile_public');
    table.dropColumn('show_email');
    table.dropColumn('show_phone');
    table.dropColumn('privacy_settings');
    table.dropColumn('language');
    table.dropColumn('timezone');
    table.dropColumn('notification_preferences');
    table.dropColumn('ui_preferences');
    table.dropColumn('wechat_id');
    table.dropColumn('qq_number');
    table.dropColumn('weibo_id');
    table.dropColumn('twitter_id');
    table.dropColumn('instagram_id');
    table.dropColumn('linkedin_url');
    table.dropColumn('github_id');
    table.dropColumn('avatar_url');
    table.dropColumn('banner_url');
    table.dropColumn('account_status');
    table.dropColumn('suspension_reason');
    table.dropColumn('suspended_until');
    table.dropColumn('login_count');
    table.dropColumn('last_login_at');
    table.dropColumn('last_login_ip');
    table.dropColumn('login_devices');
    table.dropColumn('profile_updated_at');
  });
};