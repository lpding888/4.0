/**
 * 扩展验证码表，支持邮箱渠道
 */
exports.up = function (knex) {
  return knex.schema.alterTable('verification_codes', (table) => {
    table.string('email', 160).nullable().comment('邮箱');
    table.string('channel', 20).notNullable().defaultTo('sms').comment('验证码渠道');
    table.index('email', 'idx_verification_codes_email');
    table.index('channel', 'idx_verification_codes_channel');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('verification_codes', (table) => {
    table.dropIndex('email', 'idx_verification_codes_email');
    table.dropIndex('channel', 'idx_verification_codes_channel');
    table.dropColumn('email');
    table.dropColumn('channel');
  });
};
