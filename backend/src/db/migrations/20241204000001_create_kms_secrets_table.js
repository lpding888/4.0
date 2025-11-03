/**
 * 创建KMS密钥管理表
 *
 * 用于存储应用层加密的敏感信息
 * 采用AES-256-GCM加密算法
 */

exports.up = function(knex) {
  return knex.schema.createTable('kms_secrets', function(table) {
    // 主键：格式 kms_时间戳_随机字符串
    table.string('id', 100).primary().comment('密钥ID');

    // 引用标识：可选的外部引用ID
    table.string('reference', 255).nullable().comment('引用标识');

    // 作用域：如provider、feature等
    table.string('scope', 100).nullable().comment('作用域');

    // 加密后的数据（hex编码）
    table.text('ciphertext').notNullable().comment('加密后的密文(hex)');

    // 初始化向量（GCM模式固定12字节 = 24个hex字符）
    table.string('iv', 50).notNullable().comment('初始化向量(hex)');

    // 认证标签（GCM模式固定16字节 = 32个hex字符）
    table.string('auth_tag', 50).notNullable().comment('认证标签(hex)');

    // 时间戳
    table.timestamps(true, true);

    // 索引
    table.index(['reference']);
    table.index(['scope']);
    table.index(['created_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('kms_secrets');
};
