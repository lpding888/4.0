/**
 * 支持邮箱注册：手机号可为空，邮箱唯一
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('users', (table) => {
    table.string('phone', 11).nullable().alter();
  });

  const hasEmailUnique = await knex.schema.hasColumn('users', 'email');
  if (hasEmailUnique) {
    const [indexes] = await knex.raw(`SHOW INDEX FROM users WHERE Key_name = 'uq_users_email'`);
    if (!indexes || indexes.length === 0) {
      await knex.schema.alterTable('users', (table) => {
        table.unique(['email'], 'uq_users_email');
      });
    }
  }
};

exports.down = async function (knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropUnique(['email'], 'uq_users_email');
    table.string('phone', 11).notNullable().alter();
  });
};
