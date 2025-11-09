/**
 * P0-006: 为users表添加微信登录字段
 * 新增字段：wechat_openid, wechat_unionid
 */
exports.up = async function (knex) {
  await knex.schema.table('users', (table) => {
    table.string('wechat_openid', 64).nullable().unique().comment('微信OpenID');
    table.string('wechat_unionid', 64).nullable().comment('微信UnionID');

    // 索引优化（微信登录时通过openid查询用户）
    table.index('wechat_openid');
  });

  console.log('✓ users表新增微信字段成功 - wechat_openid, wechat_unionid');
};

exports.down = async function (knex) {
  await knex.schema.table('users', (table) => {
    table.dropColumn('wechat_openid');
    table.dropColumn('wechat_unionid');
  });
};
