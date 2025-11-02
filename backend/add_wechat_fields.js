const db = require('./knexfile.js');
const knex = require('knex')(db.development);

(async () => {
  try {
    const hasColumn = await knex.schema.hasColumn('users', 'wechat_openid');

    if (!hasColumn) {
      await knex.schema.table('users', (table) => {
        table.string('wechat_openid', 64).nullable().unique();
        table.string('wechat_unionid', 64).nullable();
        table.index('wechat_openid');
      });
      console.log('✓ users表新增微信字段成功');
    } else {
      console.log('✓ 微信字段已存在');
    }

    await knex.destroy();
    process.exit(0);
  } catch (err) {
    console.error('❌ 错误:', err);
    await knex.destroy();
    process.exit(1);
  }
})();
