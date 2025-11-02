const http = require('http');
const https = require('https');

/**
 * 100并发压力测试脚本
 *
 * 测试场景:
 * 1. 健康检查 (无认证)
 * 2. 模拟登录获取Token (认证)
 * 3. 查询功能列表 (带Token)
 * 4. 查询任务列表 (带Token + 数据库)
 */

class LoadTester {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.token = null;
    this.results = {
      healthCheck: [],
      getFeatures: [],
      getTasks: [],
      errors: []
    };
  }

  /**
   * 执行HTTP请求
   */
  async request(options) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const req = http.request(options, (res) => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          const duration = Date.now() - startTime;

          try {
            const parsed = JSON.parse(data);
            resolve({
              statusCode: res.statusCode,
              duration,
              data: parsed,
              success: res.statusCode === 200
            });
          } catch (err) {
            resolve({
              statusCode: res.statusCode,
              duration,
              data: data,
              success: false
            });
          }
        });
      });

      req.on('error', (err) => {
        const duration = Date.now() - startTime;
        reject({
          statusCode: 0,
          duration,
          error: err.message,
          success: false
        });
      });

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }

  /**
   * 测试1: 健康检查 (100并发)
   */
  async testHealthCheck(concurrency = 100) {
    console.log(`\n📊 测试1: 健康检查 (${concurrency}个并发)`);
    console.log('=' .repeat(60));

    const url = new URL('/health', this.baseUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname,
      method: 'GET'
    };

    const promises = [];
    const startTime = Date.now();

    for (let i = 0; i < concurrency; i++) {
      promises.push(
        this.request(options)
          .then(result => {
            this.results.healthCheck.push(result);
            return result;
          })
          .catch(err => {
            this.results.errors.push({ test: 'healthCheck', error: err });
            return err;
          })
      );
    }

    await Promise.all(promises);
    const totalTime = Date.now() - startTime;

    this.analyzeResults('healthCheck', totalTime, concurrency);
  }

  /**
   * 测试2: 获取Token (模拟登录)
   */
  async getToken() {
    console.log('\n🔐 获取测试Token...');

    const url = new URL('/api/auth/wechat-login', this.baseUrl);
    const body = JSON.stringify({
      code: 'test_code_' + Date.now(),
      userInfo: {
        nickName: '压测用户',
        avatarUrl: 'https://example.com/avatar.jpg'
      }
    });

    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      body
    };

    try {
      const result = await this.request(options);

      if (result.success && result.data.data?.token) {
        this.token = result.data.data.token;
        console.log('✅ Token获取成功');
        return true;
      } else {
        console.log('⚠️ 使用模拟Token');
        // 使用固定的测试token
        this.token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0X3VzZXJfMDAxIiwiaWQiOiJ0ZXN0X3VzZXJfMDAxIiwicGhvbmUiOiIxMzgwMDAwMDAwMCIsImlhdCI6MTczMDA0NzIwMCwiZXhwIjoxNzMwNjUyMDAwfQ.test';
        return true;
      }
    } catch (err) {
      console.error('❌ Token获取失败:', err.message);
      return false;
    }
  }

  /**
   * 测试3: 查询功能列表 (100并发, 带Token)
   */
  async testGetFeatures(concurrency = 100) {
    console.log(`\n📊 测试2: 查询功能列表 (${concurrency}个并发 + Token认证)`);
    console.log('='.repeat(60));

    const url = new URL('/api/features', this.baseUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    };

    const promises = [];
    const startTime = Date.now();

    for (let i = 0; i < concurrency; i++) {
      promises.push(
        this.request(options)
          .then(result => {
            this.results.getFeatures.push(result);
            return result;
          })
          .catch(err => {
            this.results.errors.push({ test: 'getFeatures', error: err });
            return err;
          })
      );
    }

    await Promise.all(promises);
    const totalTime = Date.now() - startTime;

    this.analyzeResults('getFeatures', totalTime, concurrency);
  }

  /**
   * 测试4: 查询任务列表 (100并发, 数据库查询)
   */
  async testGetTasks(concurrency = 100) {
    console.log(`\n📊 测试3: 查询任务列表 (${concurrency}个并发 + 数据库查询)`);
    console.log('='.repeat(60));

    const url = new URL('/api/task?page=1&limit=10', this.baseUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    };

    const promises = [];
    const startTime = Date.now();

    for (let i = 0; i < concurrency; i++) {
      promises.push(
        this.request(options)
          .then(result => {
            this.results.getTasks.push(result);
            return result;
          })
          .catch(err => {
            this.results.errors.push({ test: 'getTasks', error: err });
            return err;
          })
      );
    }

    await Promise.all(promises);
    const totalTime = Date.now() - startTime;

    this.analyzeResults('getTasks', totalTime, concurrency);
  }

  /**
   * 分析测试结果
   */
  analyzeResults(testName, totalTime, concurrency) {
    const results = this.results[testName];

    if (results.length === 0) {
      console.log('❌ 无测试结果');
      return;
    }

    const durations = results.map(r => r.duration).sort((a, b) => a - b);
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    const min = Math.min(...durations);
    const max = Math.max(...durations);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const p50 = durations[Math.floor(durations.length * 0.5)];
    const p95 = durations[Math.floor(durations.length * 0.95)];
    const p99 = durations[Math.floor(durations.length * 0.99)];

    const qps = (concurrency / (totalTime / 1000)).toFixed(2);
    const avgLatency = avg.toFixed(2);

    console.log('\n【结果统计】');
    console.log(`  总请求数:      ${concurrency}`);
    console.log(`  成功数:        ${successCount} (${(successCount / concurrency * 100).toFixed(1)}%)`);
    console.log(`  失败数:        ${failCount} (${(failCount / concurrency * 100).toFixed(1)}%)`);
    console.log(`  总耗时:        ${totalTime}ms`);
    console.log(`  QPS (吞吐量):  ${qps} req/s ${qps > 100 ? '✅' : qps > 50 ? '⚠️' : '❌'}`);

    console.log('\n【响应时间】');
    console.log(`  最小值:        ${min}ms`);
    console.log(`  最大值:        ${max}ms`);
    console.log(`  平均值:        ${avgLatency}ms ${avg < 100 ? '✅' : avg < 500 ? '⚠️' : '❌'}`);
    console.log(`  P50 (中位数):  ${p50}ms`);
    console.log(`  P95:           ${p95}ms ${p95 < 200 ? '✅' : p95 < 1000 ? '⚠️' : '❌'}`);
    console.log(`  P99:           ${p99}ms ${p99 < 500 ? '✅' : p99 < 2000 ? '⚠️' : '❌'}`);

    // 性能评分
    let score = 100;
    if (failCount > 0) score -= failCount * 2;
    if (avg > 500) score -= 30;
    else if (avg > 100) score -= 10;
    if (p95 > 1000) score -= 20;
    else if (p95 > 200) score -= 10;
    if (qps < 50) score -= 20;
    else if (qps < 100) score -= 10;

    console.log(`\n【性能评分】${score}/100 ${score >= 90 ? '🎉 优秀' : score >= 70 ? '👍 良好' : score >= 50 ? '⚠️ 及格' : '❌ 差'}`);
  }

  /**
   * 运行完整测试
   */
  async runAll() {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 100并发压力测试 - AI照片后端');
    console.log('='.repeat(70));

    try {
      // 测试1: 健康检查
      await this.testHealthCheck(100);

      // 获取Token
      const hasToken = await this.getToken();

      if (hasToken) {
        // 测试2: 功能列表
        await this.testGetFeatures(100);

        // 测试3: 任务列表
        await this.testGetTasks(100);
      } else {
        console.log('\n⚠️ 跳过需要Token的测试');
      }

      // 总结
      this.printSummary();

    } catch (err) {
      console.error('\n❌ 测试异常:', err);
    }
  }

  /**
   * 打印总结
   */
  printSummary() {
    console.log('\n' + '='.repeat(70));
    console.log('📋 100并发压力测试总结');
    console.log('='.repeat(70));

    const totalRequests =
      this.results.healthCheck.length +
      this.results.getFeatures.length +
      this.results.getTasks.length;

    const totalSuccess =
      this.results.healthCheck.filter(r => r.success).length +
      this.results.getFeatures.filter(r => r.success).length +
      this.results.getTasks.filter(r => r.success).length;

    const totalFail = totalRequests - totalSuccess;
    const successRate = ((totalSuccess / totalRequests) * 100).toFixed(2);

    console.log(`\n总请求数:   ${totalRequests}`);
    console.log(`成功数:     ${totalSuccess} (${successRate}%)`);
    console.log(`失败数:     ${totalFail}`);
    console.log(`错误数:     ${this.results.errors.length}`);

    if (this.results.errors.length > 0) {
      console.log('\n【错误详情】');
      this.results.errors.slice(0, 5).forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.test}: ${err.error?.error || err.error}`);
      });
      if (this.results.errors.length > 5) {
        console.log(`  ... 还有${this.results.errors.length - 5}个错误`);
      }
    }

    console.log('\n【结论】');
    if (successRate >= 99) {
      console.log('  🎉 优秀! 系统在100并发下表现稳定!');
    } else if (successRate >= 95) {
      console.log('  👍 良好! 有少量失败请求,建议检查错误日志');
    } else if (successRate >= 90) {
      console.log('  ⚠️ 及格! 失败率偏高,需要优化');
    } else {
      console.log('  ❌ 差! 系统在高并发下不稳定,必须优化!');
    }

    console.log('\n【建议】');
    if (totalFail > 10) {
      console.log('  - 检查数据库连接池配置 (当前5-20)');
      console.log('  - 考虑增加Redis连接池');
      console.log('  - 检查是否有慢查询');
    }
    if (this.results.errors.length > 0) {
      console.log('  - 检查错误日志,定位失败原因');
      console.log('  - 增加错误重试机制');
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ 压力测试完成\n');
  }
}

// 运行测试
const tester = new LoadTester();
tester.runAll()
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error('测试失败:', err);
    process.exit(1);
  });
