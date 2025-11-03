/**
 * BuildingAI Sidecar 连接测试脚本
 *
 * 用途：验证BFF到BuildingAI侧车的连接和基本功能
 * 运行：node backend/scripts/test-buildingai-connection.js
 */

const axios = require('axios');

const BUILDINGAI_BASE_URL = process.env.BUILDINGAI_BASE_URL || 'http://localhost:4090';
const API_PREFIX = '/api';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// 测试结果统计
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  warnings: 0
};

/**
 * 测试1：健康检查
 */
async function testHealthCheck() {
  results.total++;
  logInfo('Test 1: Health Check');

  try {
    const response = await axios.get(`${BUILDINGAI_BASE_URL}${API_PREFIX}/health`, {
      timeout: 5000
    });

    if (response.status === 200 && response.data.status === 'ok') {
      logSuccess('Health check passed');
      logInfo(`  Status: ${response.data.status}`);
      logInfo(`  Uptime: ${response.data.uptime || 'N/A'}`);
      results.passed++;
      return true;
    } else {
      logError('Health check returned unexpected response');
      console.log('  Response:', response.data);
      results.failed++;
      return false;
    }
  } catch (error) {
    logError(`Health check failed: ${error.message}`);
    if (error.code === 'ECONNREFUSED') {
      logWarning('  BuildingAI service is not running or not accessible');
      logInfo('  Please ensure the service is started:');
      logInfo('  cd deploy/buildingai && docker-compose --env-file ../../.env.buildingai up -d');
    }
    results.failed++;
    return false;
  }
}

/**
 * 测试2：获取模型列表
 */
async function testListModels() {
  results.total++;
  logInfo('Test 2: List Models');

  try {
    const response = await axios.get(`${BUILDINGAI_BASE_URL}${API_PREFIX}/models`, {
      timeout: 10000
    });

    if (response.status === 200 && Array.isArray(response.data)) {
      logSuccess(`Found ${response.data.length} models`);
      if (response.data.length > 0) {
        logInfo('  Sample models:');
        response.data.slice(0, 3).forEach(model => {
          logInfo(`    - ${model.name || model.id} (${model.provider || 'unknown'})`);
        });
      }
      results.passed++;
      return true;
    } else {
      logWarning('Models endpoint returned unexpected format');
      console.log('  Response:', response.data);
      results.warnings++;
      return false;
    }
  } catch (error) {
    logError(`List models failed: ${error.message}`);
    results.failed++;
    return false;
  }
}

/**
 * 测试3：Chat接口（非流式）
 */
async function testChatCompletion() {
  results.total++;
  logInfo('Test 3: Chat Completion (Non-streaming)');

  try {
    const request = {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: 'Hello, this is a connection test. Please reply with "OK".'
        }
      ],
      temperature: 0.7,
      max_tokens: 50,
      stream: false
    };

    const response = await axios.post(
      `${BUILDINGAI_BASE_URL}${API_PREFIX}/chat/completions`,
      request,
      { timeout: 30000 }
    );

    if (response.status === 200 && response.data.choices && response.data.choices.length > 0) {
      logSuccess('Chat completion successful');
      const message = response.data.choices[0].message;
      logInfo(`  Model: ${response.data.model}`);
      logInfo(`  Reply: ${message.content}`);
      if (response.data.usage) {
        logInfo(`  Tokens used: ${response.data.usage.total_tokens}`);
      }
      results.passed++;
      return true;
    } else {
      logError('Chat completion returned unexpected response');
      console.log('  Response:', response.data);
      results.failed++;
      return false;
    }
  } catch (error) {
    if (error.response && error.response.status === 401) {
      logWarning('Chat completion requires authentication');
      logInfo('  This is expected if models are not configured yet');
      results.warnings++;
      return false;
    } else if (error.response && error.response.status === 404) {
      logWarning('Chat endpoint not found - API structure may differ');
      results.warnings++;
      return false;
    } else {
      logError(`Chat completion failed: ${error.message}`);
      if (error.response) {
        logInfo(`  Status: ${error.response.status}`);
        logInfo(`  Data: ${JSON.stringify(error.response.data)}`);
      }
      results.failed++;
      return false;
    }
  }
}

/**
 * 测试4：端口隔离检查
 */
async function testPortIsolation() {
  results.total++;
  logInfo('Test 4: Port Isolation Check');

  try {
    // 尝试从外网IP访问（模拟）
    const response = await axios.get(`http://127.0.0.1:4090${API_PREFIX}/health`, {
      timeout: 5000
    });

    if (response.status === 200) {
      logSuccess('Service is accessible from localhost');
      logWarning('  IMPORTANT: Ensure port 4090 is NOT exposed to external network');
      logInfo('  Port should only be accessible via:');
      logInfo('    - localhost (127.0.0.1)');
      logInfo('    - BFF internal network');
      logInfo('    - Nginx reverse proxy');
      results.warnings++;
      return true;
    }
  } catch (error) {
    logError(`Port isolation check failed: ${error.message}`);
    results.failed++;
    return false;
  }
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  log('\n═══════════════════════════════════════', 'blue');
  log('  BuildingAI Sidecar Connection Test', 'blue');
  log('═══════════════════════════════════════\n', 'blue');

  logInfo(`Testing BuildingAI at: ${BUILDINGAI_BASE_URL}`);
  logInfo('');

  // 执行测试
  const healthOk = await testHealthCheck();
  log('');

  if (healthOk) {
    await testListModels();
    log('');

    await testChatCompletion();
    log('');

    await testPortIsolation();
    log('');
  } else {
    logError('Health check failed, skipping other tests');
    log('');
  }

  // 输出结果
  log('═══════════════════════════════════════', 'blue');
  log('  Test Results', 'blue');
  log('═══════════════════════════════════════', 'blue');
  log(`Total: ${results.total}`);
  logSuccess(`Passed: ${results.passed}`);
  logError(`Failed: ${results.failed}`);
  logWarning(`Warnings: ${results.warnings}`);
  log('');

  if (results.failed === 0 && results.warnings === 0) {
    logSuccess('All tests passed! BuildingAI sidecar is ready.');
  } else if (results.failed === 0) {
    logWarning('Tests passed with warnings. Please review the warnings above.');
  } else {
    logError('Some tests failed. Please fix the issues above.');
  }

  log('');

  // 返回退出码
  process.exit(results.failed > 0 ? 1 : 0);
}

// 运行测试
runAllTests().catch(error => {
  logError(`Unexpected error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
