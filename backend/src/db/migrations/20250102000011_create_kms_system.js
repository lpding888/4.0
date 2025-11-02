/**
 * 创建密钥管理系统
 *
 * 密钥管理系统用于敏感信息加密：
 * - 密钥生成和管理
 * - 数据加密和解密
 * - 密钥轮换和版本控制
 * - 访问控制和审计
 * - 密钥生命周期管理
 */

exports.up = async function(knex) {
  // 密钥主表
  await knex.schema.createTable('encryption_keys', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('key_name', 100).notNullable().comment('密钥名称');
    table.string('key_alias', 100).nullable().comment('密钥别名');
    table.enum('key_type', ['AES', 'RSA', 'HMAC', 'ECDSA']).notNullable().comment('密钥类型');
    table.enum('key_purpose', ['data_encryption', 'signing', 'verification', 'key_exchange']).notNullable().comment('密钥用途');
    table.integer('key_size').notNullable().comment('密钥长度');
    table.string('key_algorithm', 50).notNullable().comment('密钥算法');
    table.text('public_key').nullable().comment('公钥');
    table.text('private_key').nullable().comment('私钥（加密存储）');
    table.text('symmetric_key').nullable().comment('对称密钥（加密存储）');
    table.string('key_version', 20).defaultTo('1').comment('密钥版本');
    table.enum('status', ['active', 'inactive', 'deprecated', 'compromised', 'destroyed']).defaultTo('active').comment('密钥状态');
    table.boolean('is_primary').defaultTo(false).comment('是否为主密钥');
    table.json('key_metadata').nullable().comment('密钥元数据');
    table.string('encryption_kek_id', 36).nullable().comment('加密密钥ID');
    table.timestamp('not_before').defaultTo(knex.fn.now()).comment('生效时间');
    table.timestamp('not_after').nullable().comment('过期时间');
    table.string('created_by', 36).nullable().comment('创建人');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 唯一约束
    table.unique(['key_name', 'key_version']);

    // 索引
    table.index(['key_name']);
    table.index(['key_type']);
    table.index(['key_purpose']);
    table.index(['status']);
    table.index(['is_primary']);
    table.index(['not_before']);
    table.index(['not_after']);
    table.index(['created_at']);
  });

  // 加密数据表
  await knex.schema.createTable('encrypted_data', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('key_id', 36).notNullable().comment('密钥ID');
    table.string('data_type', 50).notNullable().comment('数据类型');
    table.string('resource_id', 36).nullable().comment('资源ID');
    table.string('resource_type', 50).nullable().comment('资源类型');
    table.text('encrypted_data').notNullable().comment('加密数据');
    table.text('encryption_metadata').nullable().comment('加密元数据');
    table.string('encryption_algorithm', 50).notNullable().comment('加密算法');
    table.string('iv', 100).nullable().comment('初始化向量');
    table.string('tag', 100).nullable().comment('认证标签');
    table.string('key_version', 20).notNullable().comment('密钥版本');
    table.json('additional_data').nullable().comment('附加数据');
    table.string('created_by', 36).nullable().comment('创建人');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 外键约束
    table.foreign('key_id').references('id').inTable('encryption_keys').onDelete('CASCADE');

    // 索引
    table.index(['key_id']);
    table.index(['data_type']);
    table.index(['resource_id']);
    table.index(['resource_type']);
    table.index(['key_version']);
    table.index(['created_at']);
  });

  // 密钥访问控制表
  await knex.schema.createTable('key_access_policies', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('key_id', 36).notNullable().comment('密钥ID');
    table.string('principal_type', 20).notNullable().comment('主体类型（user/role/service）');
    table.string('principal_id', 36).notNullable().comment('主体ID');
    table.enum('permission', ['read', 'write', 'delete', 'admin']).notNullable().comment('权限');
    table.json('conditions').nullable().comment('访问条件');
    table.boolean('is_granted').defaultTo(true).comment('是否授权');
    table.string('granted_by', 36).nullable().comment('授权人');
    table.timestamp('granted_at').defaultTo(knex.fn.now()).comment('授权时间');
    table.timestamp('expires_at').nullable().comment('过期时间');
    table.text('notes').nullable().comment('备注');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 外键约束
    table.foreign('key_id').references('id').inTable('encryption_keys').onDelete('CASCADE');

    // 唯一约束
    table.unique(['key_id', 'principal_type', 'principal_id', 'permission']);

    // 索引
    table.index(['key_id']);
    table.index(['principal_type']);
    table.index(['principal_id']);
    table.index(['permission']);
    table.index(['is_granted']);
    table.index(['granted_at']);
    table.index(['expires_at']);
  });

  // 密钥操作审计表
  await knex.schema.createTable('key_operation_logs', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('key_id', 36).notNullable().comment('密钥ID');
    table.string('operation_type', 50).notNullable().comment('操作类型');
    table.string('operation_description').nullable().comment('操作描述');
    table.string('operator_type', 20).notNullable().comment('操作者类型（user/service/system）');
    table.string('operator_id', 36).nullable().comment('操作者ID');
    table.string('operator_name', 100).nullable().comment('操作者名称');
    table.string('client_ip', 45).nullable().comment('客户端IP');
    table.string('user_agent').nullable().comment('用户代理');
    table.enum('status', ['success', 'failure', 'partial']).defaultTo('success').comment('操作状态');
    table.text('error_message').nullable().comment('错误信息');
    table.json('operation_data').nullable().comment('操作数据');
    table.json('result_data').nullable().comment('结果数据');
    table.timestamp('operation_time').defaultTo(knex.fn.now()).comment('操作时间');

    // 外键约束
    table.foreign('key_id').references('id').inTable('encryption_keys').onDelete('CASCADE');

    // 索引
    table.index(['key_id']);
    table.index(['operation_type']);
    table.index(['operator_type']);
    table.index(['operator_id']);
    table.index(['status']);
    table.index(['operation_time']);
    table.index(['client_ip']);
  });

  // 密钥轮换记录表
  await knex.schema.createTable('key_rotation_schedules', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('key_name', 100).notNullable().comment('密钥名称');
    table.string('current_key_id', 36).nullable().comment('当前密钥ID');
    table.string('next_key_id', 36).nullable().comment('下一个密钥ID');
    table.enum('rotation_type', ['time_based', 'usage_based', 'manual', 'event_based']).notNullable().comment('轮换类型');
    table.json('rotation_schedule').nullable().comment('轮换计划');
    table.integer('rotation_interval_days').defaultTo(365).comment('轮换间隔天数');
    table.integer('max_usage_count').nullable().comment('最大使用次数');
    table.timestamp('last_rotation_at').nullable().comment('上次轮换时间');
    table.timestamp('next_rotation_at').nullable().comment('下次轮换时间');
    table.boolean('is_active').defaultTo(true).comment('是否激活');
    table.text('rotation_notes').nullable().comment('轮换备注');
    table.string('created_by', 36).nullable().comment('创建人');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 外键约束
    table.foreign('current_key_id').references('id').inTable('encryption_keys').onDelete('SET NULL');
    table.foreign('next_key_id').references('id').inTable('encryption_keys').onDelete('SET NULL');

    // 唯一约束
    table.unique(['key_name']);

    // 索引
    table.index(['key_name']);
    table.index(['current_key_id']);
    table.index(['next_key_id']);
    table.index(['rotation_type']);
    table.index(['is_active']);
    table.index(['next_rotation_at']);
  });

  // 密钥轮换历史表
  await knex.schema.createTable('key_rotation_history', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('key_name', 100).notNullable().comment('密钥名称');
    table.string('old_key_id', 36).nullable().comment('旧密钥ID');
    table.string('new_key_id', 36).nullable().comment('新密钥ID');
    table.enum('rotation_reason', ['scheduled', 'compromised', 'manual', 'policy_change']).notNullable().comment('轮换原因');
    table.text('rotation_description').nullable().comment('轮换描述');
    table.enum('status', ['initiated', 'in_progress', 'completed', 'failed']).defaultTo('initiated').comment('轮换状态');
    table.integer('affected_records').defaultTo(0).comment('影响的记录数');
    table.integer('migrated_records').defaultTo(0).comment('已迁移记录数');
    table.json('rotation_metadata').nullable().comment('轮换元数据');
    table.string('performed_by', 36).nullable().comment('执行人');
    table.timestamp('rotation_started_at').defaultTo(knex.fn.now()).comment('轮换开始时间');
    table.timestamp('rotation_completed_at').nullable().comment('轮换完成时间');
    table.text('error_details').nullable().comment('错误详情');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 外键约束
    table.foreign('old_key_id').references('id').inTable('encryption_keys').onDelete('SET NULL');
    table.foreign('new_key_id').references('id').inTable('encryption_keys').onDelete('SET NULL');

    // 索引
    table.index(['key_name']);
    table.index(['old_key_id']);
    table.index(['new_key_id']);
    table.index(['rotation_reason']);
    table.index(['status']);
    table.index(['rotation_started_at']);
    table.index(['rotation_completed_at']);
  });

  // 密钥备份表
  await knex.schema.createTable('key_backups', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('key_id', 36).notNullable().comment('密钥ID');
    table.string('backup_name', 100).notNullable().comment('备份名称');
    table.text('backup_data').notNullable().comment('备份数据（加密）');
    table.string('backup_algorithm', 50).notNullable().comment('备份算法');
    table.string('backup_encryption_key_id', 36).nullable().comment('备份加密密钥ID');
    table.json('backup_metadata').nullable().comment('备份元数据');
    table.string('backup_location', 500).nullable().comment('备份位置');
    table.string('checksum', 100).notNullable().comment('数据校验和');
    table.enum('status', ['active', 'corrupted', 'expired', 'deleted']).defaultTo('active').comment('备份状态');
    table.timestamp('backup_created_at').defaultTo(knex.fn.now()).comment('备份创建时间');
    table.timestamp('backup_expires_at').nullable().comment('备份过期时间');
    table.string('created_by', 36).nullable().comment('创建人');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 外键约束
    table.foreign('key_id').references('id').inTable('encryption_keys').onDelete('CASCADE');
    table.foreign('backup_encryption_key_id').references('id').inTable('encryption_keys').onDelete('SET NULL');

    // 唯一约束
    table.unique(['key_id', 'backup_name']);

    // 索引
    table.index(['key_id']);
    table.index(['backup_name']);
    table.index(['status']);
    table.index(['backup_created_at']);
    table.index(['backup_expires_at']);
  });

  // 系统配置表
  await knex.schema.createTable('kms_system_config', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));
    table.string('config_key', 100).notNullable().unique().comment('配置键');
    table.text('config_value').nullable().comment('配置值');
    table.text('config_description').nullable().comment('配置描述');
    table.enum('config_type', ['string', 'number', 'boolean', 'json', 'encrypted']).notNullable().comment('配置类型');
    table.boolean('is_sensitive').defaultTo(false).comment('是否敏感配置');
    table.string('encryption_key_id', 36).nullable().comment('加密密钥ID');
    table.string('updated_by', 36).nullable().comment('更新人');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

    // 外键约束
    table.foreign('encryption_key_id').references('id').inTable('encryption_keys').onDelete('SET NULL');

    // 索引
    table.index(['config_key']);
    table.index(['config_type']);
    table.index(['is_sensitive']);
  });

  // 插入默认系统配置
  await knex('kms_system_config').insert([
    {
      config_key: 'default_aes_key_size',
      config_value: '256',
      config_description: '默认AES密钥长度',
      config_type: 'number',
      is_sensitive: false
    },
    {
      config_key: 'default_rsa_key_size',
      config_value: '2048',
      config_description: '默认RSA密钥长度',
      config_type: 'number',
      is_sensitive: false
    },
    {
      config_key: 'key_rotation_interval_days',
      config_value: '365',
      config_description: '密钥轮换间隔天数',
      config_type: 'number',
      is_sensitive: false
    },
    {
      config_key: 'max_key_version_count',
      config_value: '10',
      config_description: '最大密钥版本数量',
      config_type: 'number',
      is_sensitive: false
    },
    {
      config_key: 'backup_retention_days',
      config_value: '2555',
      config_description: '备份保留天数（7年）',
      config_type: 'number',
      is_sensitive: false
    }
  ]);
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('kms_system_config');
  await knex.schema.dropTableIfExists('key_backups');
  await knex.schema.dropTableIfExists('key_rotation_history');
  await knex.schema.dropTableIfExists('key_rotation_schedules');
  await knex.schema.dropTableIfExists('key_operation_logs');
  await knex.schema.dropTableIfExists('key_access_policies');
  await knex.schema.dropTableIfExists('encrypted_data');
  await knex.schema.dropTableIfExists('encryption_keys');
};