/**
 * 创建推荐人验证系统
 *
 * 推荐人有效性校验系统：
 * - 推荐关系管理
 * - 推荐人资格验证
 * - 推荐链追踪
 * - 推荐奖励配置
 * - 推荐效果统计
 */

exports.up = async function (knex) {
  // 推荐关系表
  await knex.schema.createTable('referrals', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('referrer_id', 36).notNullable().comment('推荐人ID');
    table.string('referee_id', 36).notNullable().comment('被推荐人ID');
    table.string('referral_code', 50).nullable().comment('推荐码');
    table
      .enum('status', ['pending', 'validated', 'completed', 'failed', 'cancelled'])
      .defaultTo('pending')
      .comment('推荐状态');
    table
      .enum('type', ['user', 'invite_code', 'link', 'qr_code'])
      .defaultTo('user')
      .comment('推荐类型');
    table.string('source', 100).nullable().comment('推荐来源');
    table.string('campaign', 100).nullable().comment('推荐活动');
    table.json('referral_data').nullable().comment('推荐数据');
    table.timestamp('validated_at').nullable().comment('验证时间');
    table.timestamp('completed_at').nullable().comment('完成时间');
    table.timestamp('expires_at').nullable().comment('过期时间');
    table.text('notes').nullable().comment('备注');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 外键约束
    table.foreign('referrer_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('referee_id').references('id').inTable('users').onDelete('CASCADE');

    // 唯一约束 - 防止重复推荐
    table.unique(['referrer_id', 'referee_id']);

    // 索引
    table.index(['referrer_id']);
    table.index(['referee_id']);
    table.index(['status']);
    table.index(['type']);
    table.index(['referral_code']);
    table.index(['campaign']);
    table.index(['created_at']);
    table.index(['validated_at']);
    table.index(['completed_at']);
  });

  // 推荐人资格验证表
  await knex.schema.createTable('referrer_qualifications', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('user_id', 36).notNullable().comment('用户ID');
    table
      .enum('qualification_type', [
        'active_user',
        'premium_member',
        'verified_user',
        'content_creator',
        'partner'
      ])
      .notNullable()
      .comment('资格类型');
    table.boolean('is_qualified').defaultTo(false).comment('是否具备资格');
    table.json('qualification_criteria').nullable().comment('资格标准');
    table.json('qualification_data').nullable().comment('资格数据');
    table.timestamp('qualified_at').nullable().comment('获得资格时间');
    table.timestamp('expires_at').nullable().comment('资格过期时间');
    table.string('verified_by', 36).nullable().comment('验证人ID');
    table.text('verification_notes').nullable().comment('验证备注');
    table.timestamp('last_checked_at').nullable().comment('最后检查时间');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 外键约束
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');

    // 唯一约束
    table.unique(['user_id', 'qualification_type']);

    // 索引
    table.index(['user_id']);
    table.index(['qualification_type']);
    table.index(['is_qualified']);
    table.index(['qualified_at']);
    table.index(['expires_at']);
  });

  // 推荐链追踪表
  await knex.schema.createTable('referral_chains', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('root_referrer_id', 36).notNullable().comment('根推荐人ID');
    table.string('user_id', 36).notNullable().comment('用户ID');
    table.string('parent_referrer_id', 36).nullable().comment('上级推荐人ID');
    table.integer('chain_level').defaultTo(1).comment('链路层级');
    table.string('chain_path', 1000).nullable().comment('推荐路径（JSON数组）');
    table.json('chain_data').nullable().comment('链路数据');
    table.boolean('is_active').defaultTo(true).comment('是否活跃');
    table.timestamp('joined_at').defaultTo(knex.fn.now()).comment('加入时间');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 外键约束
    table.foreign('root_referrer_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('parent_referrer_id').references('id').inTable('users').onDelete('SET NULL');

    // 唯一约束
    table.unique(['user_id']);

    // 索引
    table.index(['root_referrer_id']);
    table.index(['user_id']);
    table.index(['parent_referrer_id']);
    table.index(['chain_level']);
    table.index(['is_active']);
    table.index(['joined_at']);
  });

  // 推荐验证规则表
  await knex.schema.createTable('referral_validation_rules', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('name', 100).notNullable().comment('规则名称');
    table.text('description').nullable().comment('规则描述');
    table
      .enum('rule_type', [
        'account_age',
        'activity_level',
        'purchase_history',
        'verification_status',
        'custom'
      ])
      .notNullable()
      .comment('规则类型');
    table.json('conditions').notNullable().comment('验证条件');
    table.json('actions').notNullable().comment('验证动作');
    table.boolean('is_active').defaultTo(true).comment('是否激活');
    table.integer('priority').defaultTo(0).comment('优先级');
    table.string('created_by', 36).nullable().comment('创建人');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 索引
    table.index(['rule_type']);
    table.index(['is_active']);
    table.index(['priority']);
    table.index(['created_at']);
  });

  // 推荐验证记录表
  await knex.schema.createTable('referral_validations', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('referral_id', 36).notNullable().comment('推荐ID');
    table.string('rule_id', 36).notNullable().comment('规则ID');
    table
      .enum('validation_type', [
        'referrer_check',
        'referee_check',
        'relationship_check',
        'fraud_check'
      ])
      .notNullable()
      .comment('验证类型');
    table
      .enum('status', ['pending', 'passed', 'failed', 'skipped'])
      .defaultTo('pending')
      .comment('验证状态');
    table.json('validation_data').nullable().comment('验证数据');
    table.json('result_data').nullable().comment('结果数据');
    table.text('failure_reason').nullable().comment('失败原因');
    table.integer('score').defaultTo(0).comment('验证分数');
    table.timestamp('validated_at').nullable().comment('验证时间');
    table.string('validated_by', 36).nullable().comment('验证人ID');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 外键约束
    table.foreign('referral_id').references('id').inTable('referrals').onDelete('CASCADE');
    table
      .foreign('rule_id')
      .references('id')
      .inTable('referral_validation_rules')
      .onDelete('CASCADE');

    // 索引
    table.index(['referral_id']);
    table.index(['rule_id']);
    table.index(['validation_type']);
    table.index(['status']);
    table.index(['score']);
    table.index(['validated_at']);
  });

  // 推荐奖励配置表
  await knex.schema.createTable('referral_rewards', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('name', 100).notNullable().comment('奖励名称');
    table.text('description').nullable().comment('奖励描述');
    table
      .enum('reward_type', [
        'cash',
        'credit',
        'discount',
        'points',
        'premium_days',
        'feature_unlock'
      ])
      .notNullable()
      .comment('奖励类型');
    table.json('reward_config').notNullable().comment('奖励配置');
    table
      .enum('trigger_condition', ['registration', 'first_purchase', 'subscription', 'custom'])
      .notNullable()
      .comment('触发条件');
    table.json('trigger_config').nullable().comment('触发配置');
    table
      .enum('recipient', ['referrer', 'referee', 'both'])
      .defaultTo('referrer')
      .comment('接收方');
    table.boolean('is_active').defaultTo(true).comment('是否激活');
    table.integer('priority').defaultTo(0).comment('优先级');
    table.decimal('reward_value', 15, 4).defaultTo(0).comment('奖励价值');
    table.string('currency', 10).defaultTo('CNY').comment('货币单位');
    table.string('campaign', 100).nullable().comment('关联活动');
    table.timestamp('valid_from').nullable().comment('有效开始时间');
    table.timestamp('valid_until').nullable().comment('有效结束时间');
    table.string('created_by', 36).nullable().comment('创建人');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 索引
    table.index(['reward_type']);
    table.index(['trigger_condition']);
    table.index(['recipient']);
    table.index(['is_active']);
    table.index(['campaign']);
    table.index(['valid_from']);
    table.index(['valid_until']);
  });

  // 推荐奖励发放记录表
  await knex.schema.createTable('referral_reward_grants', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('referral_id', 36).notNullable().comment('推荐ID');
    table.string('reward_id', 36).notNullable().comment('奖励配置ID');
    table.string('recipient_id', 36).notNullable().comment('接收人ID');
    table.enum('recipient_type', ['referrer', 'referee']).notNullable().comment('接收人类型');
    table
      .enum('status', ['pending', 'granted', 'failed', 'expired'])
      .defaultTo('pending')
      .comment('发放状态');
    table.decimal('reward_value', 15, 4).defaultTo(0).comment('奖励价值');
    table.string('currency', 10).defaultTo('CNY').comment('货币单位');
    table.json('grant_data').nullable().comment('发放数据');
    table.text('grant_notes').nullable().comment('发放备注');
    table.timestamp('granted_at').nullable().comment('发放时间');
    table.timestamp('expires_at').nullable().comment('过期时间');
    table.string('granted_by', 36).nullable().comment('发放人');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 外键约束
    table.foreign('referral_id').references('id').inTable('referrals').onDelete('CASCADE');
    table.foreign('reward_id').references('id').inTable('referral_rewards').onDelete('CASCADE');
    table.foreign('recipient_id').references('id').inTable('users').onDelete('CASCADE');

    // 索引
    table.index(['referral_id']);
    table.index(['reward_id']);
    table.index(['recipient_id']);
    table.index(['recipient_type']);
    table.index(['status']);
    table.index(['granted_at']);
    table.index(['expires_at']);
  });

  // 推荐统计表
  await knex.schema.createTable('referral_statistics', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('user_id', 36).notNullable().comment('用户ID');
    table.string('stat_type', 50).notNullable().comment('统计类型');
    table.string('stat_period', 20).notNullable().comment('统计周期（daily/weekly/monthly）');
    table.date('stat_date').notNullable().comment('统计日期');
    table.integer('total_referrals').defaultTo(0).comment('总推荐数');
    table.integer('successful_referrals').defaultTo(0).comment('成功推荐数');
    table.integer('pending_referrals').defaultTo(0).comment('待确认推荐数');
    table.integer('failed_referrals').defaultTo(0).comment('失败推荐数');
    table.decimal('total_rewards', 15, 4).defaultTo(0).comment('总奖励金额');
    table.integer('conversion_rate').defaultTo(0).comment('转化率（百分比）');
    table.json('additional_stats').nullable().comment('额外统计数据');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 外键约束
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');

    // 唯一约束
    table.unique(
      ['user_id', 'stat_type', 'stat_period', 'stat_date'],
      'ref_stats_user_period_unique'
    );

    // 索引
    table.index(['user_id']);
    table.index(['stat_type']);
    table.index(['stat_period']);
    table.index(['stat_date']);
    table.index(['successful_referrals']);
  });

  // 欺诈检测记录表
  await knex.schema.createTable('referral_fraud_detection', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('referral_id', 36).notNullable().comment('推荐ID');
    table
      .enum('fraud_type', [
        'self_referral',
        'duplicate_account',
        'fake_account',
        'incentive_abuse',
        'ip_mismatch',
        'device_fingerprint'
      ])
      .notNullable()
      .comment('欺诈类型');
    table
      .enum('risk_level', ['low', 'medium', 'high', 'critical'])
      .defaultTo('medium')
      .comment('风险等级');
    table.decimal('risk_score', 5, 2).defaultTo(0).comment('风险分数');
    table.json('detection_data').nullable().comment('检测数据');
    table.json('evidence').nullable().comment('证据数据');
    table.text('detection_reason').nullable().comment('检测原因');
    table
      .enum('status', ['detected', 'investigating', 'confirmed', 'false_positive', 'resolved'])
      .defaultTo('detected')
      .comment('处理状态');
    table.text('resolution_notes').nullable().comment('处理备注');
    table.string('investigated_by', 36).nullable().comment('调查人ID');
    table.timestamp('detected_at').defaultTo(knex.fn.now()).comment('检测时间');
    table.timestamp('resolved_at').nullable().comment('解决时间');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 外键约束
    table.foreign('referral_id').references('id').inTable('referrals').onDelete('CASCADE');

    // 索引
    table.index(['referral_id']);
    table.index(['fraud_type']);
    table.index(['risk_level']);
    table.index(['risk_score']);
    table.index(['status']);
    table.index(['detected_at']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('referral_fraud_detection');
  await knex.schema.dropTableIfExists('referral_statistics');
  await knex.schema.dropTableIfExists('referral_reward_grants');
  await knex.schema.dropTableIfExists('referral_rewards');
  await knex.schema.dropTableIfExists('referral_validations');
  await knex.schema.dropTableIfExists('referral_validation_rules');
  await knex.schema.dropTableIfExists('referral_chains');
  await knex.schema.dropTableIfExists('referrer_qualifications');
  await knex.schema.dropTableIfExists('referrals');
};
