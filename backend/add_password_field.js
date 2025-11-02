const db = require('./knexfile.js');
const knex = require('knex')(db.development);

(async () => {
  try {
    const hasColumn = await knex.schema.hasColumn('users', 'password');

    if (!hasColumn) {
      await knex.schema.table('users', (table) => {
        table.string('password', 255).nullable().comment('用户密码(bcrypt加密)');
      });
      console.log('✓ users表新增password字段成功');
    } else {
      console.log('✓ password字段已存在');
    }

    await knex.destroy();
    process.exit(0);
  } catch (err) {
    console.error('❌ 错误:', err);
    await knex.destroy();
    process.exit(1);
  }
})();
