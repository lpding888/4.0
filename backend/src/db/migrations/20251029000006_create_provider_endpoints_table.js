/**
 * 创建provider_endpoints表 - 供应商端点配置表
 * 存储所有第三方供应商的API端点/凭证/认证方式等
 */
exports.up = async function (knex) {
  const tableName = 'provider_endpoints'; // Extract table name
  if (tableName) {
    const exists = await knex.schema.hasTable(tableName);
    if (exists) {
      console.log();
      return;
    }
  }

  return knex.schema
    .createTable('provider_endpoints', function (table) {
      table.string('provider_ref', 100).primary().comment('供应商引用ID(唯一标识)');
      table.string('provider_name', 200).notNullable().comment('供应商名称');
      table.string('endpoint_url', 500).notNullable().comment('API端点URL');
      table.text('credentials_encrypted').notNullable().comment('加密的凭证信息(JSON)');
      table.string('auth_type', 50).notNullable().comment('认证方式(apiKey/oauth2/hmac等)');
      table.timestamp('created_at').defaultTo(knex.fn.now()).comment('创建时间');
      table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('更新时间');

      // 索引
      table.index('provider_name');
    })
    .then(() => {
      console.log('✓ provider_endpoints表创建成功');
    });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('provider_endpoints');
};
