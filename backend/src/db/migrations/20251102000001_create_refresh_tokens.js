/**
 * BE-AUTH-001: 创建refresh_tokens表
 *
 * 存储refresh token信息，支持黑名单机制
 */
exports.up = function(knex) {
  return knex.schema.createTable('refresh_tokens', (table) => {
    table.string('id', 36).primary().defaultTo(knex.raw('(UUID())'));

    // 关联用户
    table.string('user_id', 32).notNullable().comment('用户ID');

    // token信息
    table.string('jti', 64).notNullable().unique().comment('JWT ID，用于黑名单');
    table.text('token').notNullable().comment('refresh token');

    // 状态和时间
    table.boolean('is_revoked').notNullable().defaultTo(false).comment('是否已撤销');
    table.datetime('expires_at').notNullable().comment('过期时间');
    table.datetime('revoked_at').nullable().comment('撤销时间');
    table.string('revoked_reason', 255).nullable().comment('撤销原因');

    // 客户端信息
    table.string('client_ip', 45).nullable().comment('客户端IP');
    table.string('user_agent', 500).nullable().comment('用户代理');

    // 时间戳
    table.timestamps(true, true);

    // 索引
    table.index('user_id', 'idx_refresh_tokens_user');
    table.index('jti', 'idx_refresh_tokens_jti');
    table.index('is_revoked', 'idx_refresh_tokens_revoked');
    table.index('expires_at', 'idx_refresh_tokens_expires');
    table.index(['user_id', 'is_revoked'], 'idx_refresh_tokens_user_revoked');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('refresh_tokens');
};