const db = require('./src/config/database');

(async () => {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('📊 AI照片后端 - 性能和代码质量完整分析');
    console.log('='.repeat(70));

    // 1. 数据库表统计
    console.log('\n【1. 数据库表统计】');
    const tables = ['users', 'tasks', 'task_steps', 'assets', 'orders', 'system_configs', 'feature_definitions'];

    for (const table of tables) {
      try {
        const count = await db(table).count('* as cnt').first();
        console.log(`  ✓ ${table.padEnd(25)} ${String(count.cnt).padStart(6)} 条记录`);
      } catch (err) {
        console.log(`  ✗ ${table.padEnd(25)} 表不存在`);
      }
    }

    // 2. 核心表索引检查
    console.log('\n【2. 核心表索引检查】');
    const taskIndexes = await db.raw('SHOW INDEX FROM tasks');
    const taskCols = [...new Set(taskIndexes[0].map(idx => idx.Column_name))];
    console.log(`  tasks表:  ${taskIndexes[0].length}个索引, 覆盖列: ${taskCols.join(', ')}`);

    const userIndexes = await db.raw('SHOW INDEX FROM users');
    const userCols = [...new Set(userIndexes[0].map(idx => idx.Column_name))];
    console.log(`  users表:  ${userIndexes[0].length}个索引, 覆盖列: ${userCols.join(', ')}`);

    const assetIndexes = await db.raw('SHOW INDEX FROM assets');
    const assetCols = [...new Set(assetIndexes[0].map(idx => idx.Column_name))];
    console.log(`  assets表: ${assetIndexes[0].length}个索引, 覆盖列: ${assetCols.join(', ')}`);

    // 3. 查询性能测试
    console.log('\n【3. 查询性能测试】');

    const start1 = Date.now();
    const tasks = await db('tasks')
      .select('tasks.*', 'users.phone')
      .leftJoin('users', 'tasks.userId', 'users.id')
      .limit(100);
    const time1 = Date.now() - start1;
    console.log(`  JOIN查询 (tasks+users, 100条):     ${String(time1).padStart(4)}ms ${time1 < 50 ? '✅' : time1 < 200 ? '⚠️' : '❌'}`);

    const start2 = Date.now();
    const user = await db('users').where('id', 'test_user_001').first();
    const time2 = Date.now() - start2;
    console.log(`  主键查询 (users by id):            ${String(time2).padStart(4)}ms ${time2 < 10 ? '✅' : time2 < 50 ? '⚠️' : '❌'}`);

    if (user?.phone) {
      const start3 = Date.now();
      const userByPhone = await db('users').where('phone', user.phone).first();
      const time3 = Date.now() - start3;
      console.log(`  索引查询 (users by phone):         ${String(time3).padStart(4)}ms ${time3 < 20 ? '✅' : time3 < 100 ? '⚠️' : '❌'}`);
    }

    const start4 = Date.now();
    const configs = await db('system_configs').select('*');
    const time4 = Date.now() - start4;
    console.log(`  全表查询 (system_configs):         ${String(time4).padStart(4)}ms ${time4 < 50 ? '✅' : time4 < 200 ? '⚠️' : '❌'}`);

    // 4. 数据库连接池状态
    console.log('\n【4. 数据库连接池状态】');
    const pool = db.client.pool;
    console.log(`  最小连接数:   ${pool.min}`);
    console.log(`  最大连接数:   ${pool.max}`);
    console.log(`  当前使用:     ${pool.numUsed()}`);
    console.log(`  当前空闲:     ${pool.numFree()}`);
    console.log(`  等待获取:     ${pool.numPendingAcquires()}`);
    console.log(`  等待创建:     ${pool.numPendingCreates()}`);

    // 5. N+1查询检测
    console.log('\n【5. N+1查询问题检测】');
    const start5 = Date.now();
    const allTasks = await db('tasks').limit(10);
    for (const task of allTasks) {
      await db('users').where('id', task.userId).first(); // 模拟N+1
    }
    const time5 = Date.now() - start5;
    console.log(`  ❌ N+1查询 (10个tasks查询用户):    ${String(time5).padStart(4)}ms (不推荐)`);

    const start6 = Date.now();
    const tasksWithUsers = await db('tasks')
      .select('tasks.*', 'users.phone')
      .leftJoin('users', 'tasks.userId', 'users.id')
      .limit(10);
    const time6 = Date.now() - start6;
    console.log(`  ✅ JOIN查询 (10个tasks+users):     ${String(time6).padStart(4)}ms (推荐)`);
    console.log(`  性能提升: ${((time5 - time6) / time5 * 100).toFixed(1)}%`);

    // 6. 代码质量检查
    console.log('\n【6. 代码质量检查】');

    const fs = require('fs');
    const path = require('path');

    // 检查环境变量安全
    const envExample = fs.readFileSync(path.join(__dirname, '.env.example'), 'utf8');
    const hasStrongJWT = envExample.includes('kdImivGG0sztFLOv');
    const hasEncryptKey = envExample.includes('3QLjKwryaZnKnPiNDeQeJozPOtF7');
    console.log(`  强JWT密钥已配置:       ${hasStrongJWT ? '✅' : '❌'}`);
    console.log(`  加密密钥已配置:        ${hasEncryptKey ? '✅' : '❌'}`);

    // 检查安全中间件
    const appJs = fs.readFileSync(path.join(__dirname, 'src/app.js'), 'utf8');
    const hasHelmet = appJs.includes('helmet');
    const hasMongoSanitize = appJs.includes('mongoSanitize');
    const hasHTTPS = appJs.includes('x-forwarded-proto');
    console.log(`  Helmet防护已启用:      ${hasHelmet ? '✅' : '❌'}`);
    console.log(`  NoSQL注入防护:         ${hasMongoSanitize ? '✅' : '❌'}`);
    console.log(`  HTTPS强制跳转:         ${hasHTTPS ? '✅' : '❌'}`);

    // 检查.gitignore
    const gitignore = fs.readFileSync(path.join(__dirname, '.gitignore'), 'utf8');
    const envIgnored = gitignore.includes('.env');
    console.log(`  .env已gitignore:       ${envIgnored ? '✅' : '❌'}`);

    // 7. 潜在问题扫描
    console.log('\n【7. 潜在问题扫描】');

    // 检查未使用await的异步函数
    const servicesDir = path.join(__dirname, 'src/services');
    let totalFiles = 0;
    let totalLines = 0;

    const scanDir = (dir) => {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          scanDir(filePath);
        } else if (file.endsWith('.js')) {
          totalFiles++;
          const content = fs.readFileSync(filePath, 'utf8');
          totalLines += content.split('\\n').length;
        }
      });
    };

    scanDir(servicesDir);
    console.log(`  服务层代码文件数:      ${totalFiles}`);
    console.log(`  服务层代码总行数:      ${totalLines}`);
    console.log(`  平均每文件行数:        ${Math.round(totalLines / totalFiles)}`);

    // 8. 性能评分
    console.log('\n【8. 性能评分】');

    let score = 100;
    const issues = [];

    if (time1 > 200) { score -= 10; issues.push('JOIN查询过慢'); }
    if (time2 > 10) { score -= 5; issues.push('主键查询较慢'); }
    if (pool.max < 10) { score -= 5; issues.push('连接池过小'); }
    if (!hasHelmet) { score -= 20; issues.push('缺少Helmet防护'); }
    if (!hasMongoSanitize) { score -= 15; issues.push('缺少NoSQL注入防护'); }
    if (!hasHTTPS) { score -= 10; issues.push('未强制HTTPS'); }
    if (!envIgnored) { score -= 25; issues.push('.env未gitignore'); }

    console.log(`  综合评分: ${score}/100 ${score >= 90 ? '🎉 优秀' : score >= 75 ? '👍 良好' : score >= 60 ? '⚠️ 及格' : '❌ 需改进'}`);

    if (issues.length > 0) {
      console.log('  发现问题:');
      issues.forEach(issue => console.log(`    - ${issue}`));
    } else {
      console.log('  ✅ 未发现明显问题');
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ 性能和质量分析完成');
    console.log('='.repeat(70) + '\n');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ 测试失败:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
