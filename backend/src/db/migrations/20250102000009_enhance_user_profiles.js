/**
 * BE-USER-003: 增强用户资料与社交扩展（幂等版本）
 */

const addColumnIfMissing = async (knex, column, builder) => {
  const exists = await knex.schema.hasColumn('users', column);
  if (exists) {
    return;
  }
  await knex.schema.alterTable('users', (table) => {
    builder(table);
  });
};

const dropColumnIfExists = async (knex, column) => {
  const exists = await knex.schema.hasColumn('users', column);
  if (!exists) {
    return;
  }
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn(column);
  });
};

const addIndexIfMissing = async (knex, indexName, builder) => {
  const [rows] = await knex.raw('SHOW INDEX FROM ?? WHERE Key_name = ?', ['users', indexName]);
  if (rows.length > 0) {
    return;
  }
  await knex.schema.alterTable('users', (table) => {
    builder(table);
  });
};

const createTableIfMissing = async (knex, tableName, builder) => {
  const exists = await knex.schema.hasTable(tableName);
  if (exists) {
    return;
  }
  await knex.schema.createTable(tableName, builder);
};

exports.up = async function (knex) {
  const hasPhone = await knex.schema.hasColumn('users', 'phone');
  if (hasPhone) {
    await knex.schema.alterTable('users', (table) => {
      table.string('phone', 20).nullable().comment('手机号').alter();
    });
  } else {
    await addColumnIfMissing(knex, 'phone', (table) =>
      table.string('phone', 20).nullable().comment('手机号')
    );
  }

  const columnDefinitions = [
    ['first_name', (t) => t.string('first_name', 50).nullable().comment('名')],
    ['last_name', (t) => t.string('last_name', 50).nullable().comment('姓')],
    ['birth_date', (t) => t.date('birth_date').nullable().comment('出生日期')],
    [
      'gender',
      (t) =>
        t
          .enum('gender', ['male', 'female', 'other', 'prefer_not_to_say'])
          .nullable()
          .comment('性别')
    ],
    ['country', (t) => t.string('country', 50).nullable().comment('国家')],
    ['state', (t) => t.string('state', 50).nullable().comment('省/州')],
    ['city', (t) => t.string('city', 50).nullable().comment('城市')],
    ['address', (t) => t.string('address', 200).nullable().comment('详细地址')],
    ['postal_code', (t) => t.string('postal_code', 20).nullable().comment('邮政编码')],
    ['occupation', (t) => t.string('occupation', 100).nullable().comment('职业')],
    ['company', (t) => t.string('company', 100).nullable().comment('公司')],
    ['industry', (t) => t.string('industry', 50).nullable().comment('行业')],
    ['education_level', (t) => t.string('education_level', 50).nullable().comment('教育程度')],
    ['university', (t) => t.string('university', 100).nullable().comment('大学')],
    ['interests', (t) => t.text('interests').nullable().comment('兴趣爱好')],
    ['bio', (t) => t.text('bio').nullable().comment('个人简介')],
    [
      'verification_level',
      (t) =>
        t
          .enum('verification_level', ['basic', 'verified', 'premium'])
          .defaultTo('basic')
          .comment('认证级别')
    ],
    ['phone_verified', (t) => t.boolean('phone_verified').defaultTo(false).comment('手机是否验证')],
    ['email_verified', (t) => t.boolean('email_verified').defaultTo(false).comment('邮箱是否验证')],
    [
      'phone_verified_at',
      (t) => t.timestamp('phone_verified_at').nullable().comment('手机验证时间')
    ],
    [
      'email_verified_at',
      (t) => t.timestamp('email_verified_at').nullable().comment('邮箱验证时间')
    ],
    ['profile_public', (t) => t.boolean('profile_public').defaultTo(true).comment('资料是否公开')],
    ['show_email', (t) => t.boolean('show_email').defaultTo(false).comment('是否显示邮箱')],
    ['show_phone', (t) => t.boolean('show_phone').defaultTo(false).comment('是否显示手机号')],
    ['privacy_settings', (t) => t.json('privacy_settings').nullable().comment('隐私设置JSON')],
    [
      'language',
      (t) =>
        t
          .enum('language', ['zh-CN', 'en-US', 'ja-JP', 'ko-KR'])
          .defaultTo('zh-CN')
          .comment('首选语言')
    ],
    ['timezone', (t) => t.string('timezone', 50).defaultTo('Asia/Shanghai').comment('时区')],
    [
      'notification_preferences',
      (t) => t.json('notification_preferences').nullable().comment('通知偏好设置')
    ],
    ['ui_preferences', (t) => t.json('ui_preferences').nullable().comment('界面偏好设置')],
    ['wechat_id', (t) => t.string('wechat_id', 50).nullable().comment('微信号')],
    ['qq_number', (t) => t.string('qq_number', 20).nullable().comment('QQ号')],
    ['weibo_id', (t) => t.string('weibo_id', 50).nullable().comment('微博ID')],
    ['twitter_id', (t) => t.string('twitter_id', 50).nullable().comment('Twitter ID')],
    ['instagram_id', (t) => t.string('instagram_id', 50).nullable().comment('Instagram ID')],
    ['linkedin_url', (t) => t.string('linkedin_url', 200).nullable().comment('LinkedIn URL')],
    ['github_id', (t) => t.string('github_id', 50).nullable().comment('GitHub ID')],
    ['avatar_url', (t) => t.string('avatar_url', 500).nullable().comment('头像URL')],
    ['banner_url', (t) => t.string('banner_url', 500).nullable().comment('横幅图片URL')],
    [
      'account_status',
      (t) =>
        t
          .enum('account_status', ['active', 'suspended', 'banned', 'deleted'])
          .defaultTo('active')
          .comment('账户状态')
    ],
    ['suspension_reason', (t) => t.text('suspension_reason').nullable().comment('暂停原因')],
    ['suspended_until', (t) => t.timestamp('suspended_until').nullable().comment('暂停到期时间')],
    ['login_count', (t) => t.integer('login_count').defaultTo(0).comment('登录次数')],
    ['last_login_at', (t) => t.timestamp('last_login_at').nullable().comment('最后登录时间')],
    ['last_login_ip', (t) => t.string('last_login_ip', 45).nullable().comment('最后登录IP')],
    ['login_devices', (t) => t.json('login_devices').nullable().comment('登录设备信息')],
    [
      'profile_updated_at',
      (t) => t.timestamp('profile_updated_at').nullable().comment('资料更新时间')
    ]
  ];

  for (const [column, builder] of columnDefinitions) {
    // eslint-disable-next-line no-await-in-loop
    await addColumnIfMissing(knex, column, builder);
  }

  const indexes = [
    ['idx_users_phone', (t) => t.index(['phone'], 'idx_users_phone')],
    ['idx_users_country', (t) => t.index(['country'], 'idx_users_country')],
    ['idx_users_city', (t) => t.index(['city'], 'idx_users_city')],
    [
      'idx_users_verification_level',
      (t) => t.index(['verification_level'], 'idx_users_verification_level')
    ],
    ['idx_users_account_status', (t) => t.index(['account_status'], 'idx_users_account_status')],
    ['idx_users_last_login_at', (t) => t.index(['last_login_at'], 'idx_users_last_login_at')],
    [
      'idx_users_profile_updated_at',
      (t) => t.index(['profile_updated_at'], 'idx_users_profile_updated_at')
    ]
  ];

  for (const [indexName, builder] of indexes) {
    // eslint-disable-next-line no-await-in-loop
    await addIndexIfMissing(knex, indexName, builder);
  }

  await createTableIfMissing(knex, 'user_social_links', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('user_id', 36).notNullable().comment('用户ID');
    table
      .enum('platform', ['wechat', 'qq', 'weibo', 'twitter', 'instagram', 'linkedin', 'github'])
      .notNullable()
      .comment('平台');
    table.string('account_id', 100).nullable().comment('账号ID/用户名');
    table.string('display_name', 100).nullable().comment('显示名称');
    table.string('profile_url', 500).nullable().comment('主页URL');
    table.boolean('is_verified').defaultTo(false).comment('是否已验证');
    table.timestamp('verified_at').nullable().comment('验证时间');
    table.string('verified_by', 36).nullable().comment('验证人ID');
    table.boolean('is_public').defaultTo(true).comment('是否公开');
    table.json('metadata').nullable().comment('附加元数据');
    table.integer('display_order').defaultTo(0).comment('排序');
    table.timestamps(true, true);
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.unique(['user_id', 'platform']);
    table.index(['user_id']);
    table.index(['platform']);
    table.index(['is_public']);
  });

  await createTableIfMissing(knex, 'user_education', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('user_id', 36).notNullable().comment('用户ID');
    table.string('school_name', 200).notNullable().comment('学校名称');
    table.string('degree', 100).nullable().comment('学位');
    table.string('major', 100).nullable().comment('专业');
    table.date('start_date').nullable().comment('开始日期');
    table.date('end_date').nullable().comment('结束日期');
    table.boolean('is_current').defaultTo(false).comment('是否在读');
    table.decimal('gpa', 4, 2).nullable().comment('GPA');
    table.text('activities').nullable().comment('社团/活动');
    table.text('honors').nullable().comment('荣誉奖项');
    table.json('metadata').nullable().comment('附加数据');
    table.integer('display_order').defaultTo(0).comment('显示顺序');
    table.timestamps(true, true);
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.index(['user_id']);
    table.index(['school_name']);
    table.index(['degree']);
  });

  await createTableIfMissing(knex, 'user_work_experience', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('user_id', 36).notNullable().comment('用户ID');
    table.string('company_name', 200).notNullable().comment('公司名称');
    table.string('job_title', 100).notNullable().comment('职位名称');
    table
      .enum('employment_type', [
        'full_time',
        'part_time',
        'contract',
        'internship',
        'freelance',
        'other'
      ])
      .nullable()
      .comment('雇佣类型');
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
    table.timestamps(true, true);
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.index(['user_id']);
    table.index(['company_name']);
    table.index(['job_title']);
    table.index(['is_current']);
  });

  await createTableIfMissing(knex, 'user_skills', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('user_id', 36).notNullable().comment('用户ID');
    table.string('skill_name', 100).notNullable().comment('技能名称');
    table
      .enum('skill_level', ['beginner', 'intermediate', 'advanced', 'expert'])
      .nullable()
      .comment('技能水平');
    table.integer('experience_years').defaultTo(0).comment('经验年限');
    table.text('description').nullable().comment('技能描述');
    table.json('certifications').nullable().comment('相关认证');
    table.boolean('is_verified').defaultTo(false).comment('是否已验证');
    table.string('verified_by', 36).nullable().comment('验证人ID');
    table.timestamp('verified_at').nullable().comment('验证时间');
    table.integer('endorsement_count').defaultTo(0).comment('认可数量');
    table.boolean('is_public').defaultTo(true).comment('是否公开');
    table.timestamps(true, true);
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.unique(['user_id', 'skill_name']);
    table.index(['user_id']);
    table.index(['skill_name']);
    table.index(['skill_level']);
  });

  await createTableIfMissing(knex, 'user_interest_tags', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('user_id', 36).notNullable().comment('用户ID');
    table.string('tag_name', 50).notNullable().comment('标签名称');
    table
      .enum('category', ['hobby', 'interest', 'preference', 'other'])
      .defaultTo('interest')
      .comment('标签类别');
    table.integer('weight').defaultTo(1).comment('权重');
    table.text('description').nullable().comment('标签描述');
    table.boolean('is_public').defaultTo(true).comment('是否公开');
    table.timestamps(true, true);
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.unique(['user_id', 'tag_name']);
    table.index(['user_id']);
    table.index(['category']);
  });

  await createTableIfMissing(knex, 'user_profile_views', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('profile_user_id', 36).notNullable().comment('被查看用户ID');
    table.string('viewer_id', 36).nullable().comment('查看者ID');
    table.string('viewer_ip', 45).nullable().comment('查看者IP');
    table.string('user_agent').nullable().comment('用户代理');
    table
      .enum('view_type', ['profile', 'full_profile', 'specific_section'])
      .defaultTo('profile')
      .comment('查看类型');
    table.json('view_data').nullable().comment('查看数据');
    table.timestamp('viewed_at').defaultTo(knex.fn.now()).comment('查看时间');
    table.foreign('profile_user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('viewer_id').references('id').inTable('users').onDelete('SET NULL');
    table.index(['profile_user_id']);
    table.index(['viewer_id']);
    table.index(['viewed_at']);
  });

  await createTableIfMissing(knex, 'user_profile_completeness', (table) => {
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
    table.json('missing_fields').nullable().comment('缺失字段');
    table.json('suggestions').nullable().comment('完善建议');
    table.timestamp('last_calculated_at').defaultTo(knex.fn.now()).comment('最后计算时间');
    table.timestamps(true, true);
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.unique(['user_id']);
    table.index(['user_id']);
  });
};

exports.down = async function (knex) {
  const tables = [
    'user_profile_completeness',
    'user_profile_views',
    'user_interest_tags',
    'user_skills',
    'user_work_experience',
    'user_education',
    'user_social_links'
  ];
  for (const table of tables) {
    // eslint-disable-next-line no-await-in-loop
    await knex.schema.dropTableIfExists(table);
  }

  const columns = [
    'first_name',
    'last_name',
    'birth_date',
    'gender',
    'phone',
    'country',
    'state',
    'city',
    'address',
    'postal_code',
    'occupation',
    'company',
    'industry',
    'education_level',
    'university',
    'interests',
    'bio',
    'verification_level',
    'phone_verified',
    'email_verified',
    'phone_verified_at',
    'email_verified_at',
    'profile_public',
    'show_email',
    'show_phone',
    'privacy_settings',
    'language',
    'timezone',
    'notification_preferences',
    'ui_preferences',
    'wechat_id',
    'qq_number',
    'weibo_id',
    'twitter_id',
    'instagram_id',
    'linkedin_url',
    'github_id',
    'avatar_url',
    'banner_url',
    'account_status',
    'suspension_reason',
    'suspended_until',
    'login_count',
    'last_login_at',
    'last_login_ip',
    'login_devices',
    'profile_updated_at'
  ];

  for (const column of columns) {
    // eslint-disable-next-line no-await-in-loop
    await dropColumnIfExists(knex, column);
  }
};
