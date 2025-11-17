/**
 * 扩展 system_configs 表，支持密文存储与审计字段
 */

exports.up = async function (knex) {
  await knex.schema.alterTable('system_configs', (table) => {
    table.text('encrypted_value').nullable().comment('加密后的配置值（密文）');
    table.string('encryption_version', 20).nullable().comment('加密算法版本');
    table.integer('version').unsigned().notNullable().defaultTo(1).comment('配置版本号');
    table.timestamp('last_rotated_at').nullable().comment('密钥/凭证最后一次轮换时间');
    table.timestamp('last_accessed_at').nullable().comment('最近读取时间');
    table.json('metadata').nullable().comment('附加元数据(JSON)');
    table.string('created_by_user', 64).nullable().comment('创建人用户ID(字符串)');
    table.string('updated_by_user', 64).nullable().comment('更新人用户ID(字符串)');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('system_configs', (table) => {
    table.dropColumn('encrypted_value');
    table.dropColumn('encryption_version');
    table.dropColumn('version');
    table.dropColumn('last_rotated_at');
    table.dropColumn('last_accessed_at');
    table.dropColumn('metadata');
    table.dropColumn('created_by_user');
    table.dropColumn('updated_by_user');
  });
};
