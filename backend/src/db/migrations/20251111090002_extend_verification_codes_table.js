/**
 * 扩展 verification_codes 表，支持邮箱验证码
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('verification_codes', (table) => {
    table.string('email', 160).nullable().comment('邮箱');
    table.string('channel', 20).notNullable().defaultTo('sms').comment('验证码渠道');
  });

  await knex.schema.alterTable('verification_codes', (table) => {
    table.index('email', 'idx_verification_codes_email');
    table.index('channel', 'idx_verification_codes_channel');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('verification_codes', (table) => {
    table.dropIndex('email', 'idx_verification_codes_email');
    table.dropIndex('channel', 'idx_verification_codes_channel');
    table.dropColumn('email');
    table.dropColumn('channel');
  });
};
