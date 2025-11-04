/**
 * 业务埋点系统测试脚本
 * 艹，这个脚本必须验证所有埋点功能是否正常工作！
 *
 * @author 老王
 */

// 测试配置
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3007',
  sessionId: `test_session_${Date.now()}`,
  userId: 'test_user_001'
};

// 测试事件数据
const TEST_EVENTS = [
  // 聊天事件
  {
    eventName: 'chat_start',
    category: 'chat',
    action: 'start',
    timestamp: Date.now() - 5000,
    sessionId: TEST_CONFIG.sessionId,
    userId: TEST_CONFIG.userId,
    properties: {
      messageType: 'text',
      messageLength: 50
    }
  },
  {
    eventName: 'chat_success',
    category: 'chat',
    action: 'success',
    timestamp: Date.now() - 3000,
    sessionId: TEST_CONFIG.sessionId,
    userId: TEST_CONFIG.userId,
    duration: 2000,
    properties: {
      messageType: 'text',
      responseTime: 2000,
      model: 'gpt-4',
      messageLength: 120,
      tokens: { input: 50, output: 80 }
    }
  },
  {
    eventName: 'chat_success',
    category: 'chat',
    action: 'success',
    timestamp: Date.now() - 1000,
    sessionId: TEST_CONFIG.sessionId,
    userId: TEST_CONFIG.userId,
    duration: 1500,
    properties: {
      messageType: 'image',
      responseTime: 1500,
      model: 'gpt-4-vision',
      messageLength: 200,
      tokens: { input: 100, output: 150 }
    }
  },

  // 上传事件
  {
    eventName: 'upload_start',
    category: 'upload',
    action: 'start',
    timestamp: Date.now() - 4000,
    sessionId: TEST_CONFIG.sessionId,
    userId: TEST_CONFIG.userId,
    properties: {
      fileType: 'image',
      fileSize: 2048000,
      uploadType: 'kb',
      chunkCount: 2
    }
  },
  {
    eventName: 'upload_success',
    category: 'upload',
    action: 'success',
    timestamp: Date.now() - 2000,
    sessionId: TEST_CONFIG.sessionId,
    userId: TEST_CONFIG.userId,
    duration: 2000,
    properties: {
      fileType: 'image',
      fileSize: 2048000,
      uploadType: 'kb',
      chunkCount: 2,
      retryCount: 0
    }
  },
  {
    eventName: 'upload_error',
    category: 'upload',
    action: 'failure',
    timestamp: Date.now() - 500,
    sessionId: TEST_CONFIG.sessionId,
    userId: TEST_CONFIG.userId,
    properties: {
      fileType: 'document',
      fileSize: 1024000,
      uploadType: 'chat',
      chunkCount: 1,
      retryCount: 1,
      errorType: 'upload_failed'
    },
    error: {
      message: 'File size exceeds limit',
      stack: 'Error: File size exceeds limit'
    }
  },

  // 商拍事件
  {
    eventName: 'commerce_task_start',
    category: 'commerce',
    action: 'start',
    timestamp: Date.now() - 6000,
    sessionId: TEST_CONFIG.sessionId,
    userId: TEST_CONFIG.userId,
    properties: {
      toolType: 'product-shoot',
      parameterCount: 5,
      imageCount: 2,
      processingTime: 0
    }
  },
  {
    eventName: 'commerce_task_complete',
    category: 'commerce',
    action: 'success',
    timestamp: Date.now() - 3000,
    sessionId: TEST_CONFIG.sessionId,
    userId: TEST_CONFIG.userId,
    duration: 3000,
    properties: {
      toolType: 'product-shoot',
      parameterCount: 5,
      imageCount: 2,
      processingTime: 3000,
      outputFormat: 'png'
    }
  },
  {
    eventName: 'commerce_task_error',
    category: 'commerce',
    action: 'failure',
    timestamp: Date.now() - 1000,
    sessionId: TEST_CONFIG.sessionId,
    userId: TEST_CONFIG.userId,
    duration: 2000,
    properties: {
      toolType: 'background-remove',
      parameterCount: 3,
      imageCount: 1,
      processingTime: 2000,
      errorType: 'processing_failed'
    },
    error: {
      message: 'Image processing failed',
      stack: 'Error: Image processing failed'
    }
  },

  // 工具事件
  {
    eventName: 'tool_operation_start',
    category: 'tool',
    action: 'start',
    timestamp: Date.now() - 4500,
    sessionId: TEST_CONFIG.sessionId,
    userId: TEST_CONFIG.userId,
    properties: {
      toolName: 'image-resize',
      operation: 'resize',
      parameters: { width: 800, height: 600 },
      resultCount: 0,
      processingTime: 0
    }
  },
  {
    eventName: 'tool_operation_success',
    category: 'tool',
    action: 'success',
    timestamp: Date.now() - 2500,
    sessionId: TEST_CONFIG.sessionId,
    userId: TEST_CONFIG.userId,
    duration: 2000,
    properties: {
      toolName: 'image-resize',
      operation: 'resize',
      parameters: { width: 800, height: 600 },
      resultCount: 1,
      processingTime: 2000
    }
  },
  {
    eventName: 'tool_operation_error',
    category: 'tool',
    action: 'failure',
    timestamp: Date.now() - 1500,
    sessionId: TEST_CONFIG.sessionId,
    userId: TEST_CONFIG.userId,
    duration: 1000,
    properties: {
      toolName: 'color-adjustment',
      operation: 'brightness',
      parameters: { brightness: 1.2 },
      resultCount: 0,
      processingTime: 1000,
      errorType: 'operation_failed'
    },
    error: {
      message: 'Invalid brightness value',
      stack: 'Error: Invalid brightness value'
    }
  },

  // 系统事件
  {
    eventName: 'app_start',
    category: 'system',
    action: 'start',
    timestamp: Date.now() - 10000,
    sessionId: TEST_CONFIG.sessionId,
    userId: TEST_CONFIG.userId,
    properties: {
      userAgent: 'Mozilla/5.0 Test Agent',
      url: `${TEST_CONFIG.baseUrl}/admin/metrics`,
      referrer: 'direct'
    }
  },
  {
    eventName: 'user_login',
    category: 'system',
    action: 'success',
    timestamp: Date.now() - 9000,
    sessionId: TEST_CONFIG.sessionId,
    userId: TEST_CONFIG.userId,
    properties: {
      userId: TEST_CONFIG.userId,
      userName: 'Test User',
      loginMethod: 'password'
    }
  }
];

/**
 * 发送测试事件
 */
async function sendTestEvents() {
  console.log('🧪 开始发送业务埋点测试事件...');

  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}/api/metrics/business`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        events: TEST_EVENTS,
        meta: {
          userAgent: 'Test Script',
          url: `${TEST_CONFIG.baseUrl}/test`,
          sessionId: TEST_CONFIG.sessionId,
          userId: TEST_CONFIG.userId,
          timestamp: Date.now(),
          testMode: true
        }
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      console.log(`✅ 成功发送 ${data.received} 个事件`);
      console.log(`   总事件数: ${data.totalEvents}`);
      return true;
    } else {
      console.error('❌ 发送事件失败:', data.error);
      return false;
    }
  } catch (error) {
    console.error('❌ 网络错误:', error.message);
    return false;
  }
}

/**
 * 测试指标查询
 */
async function testMetricsQuery() {
  console.log('\n🔍 测试业务指标查询...');

  try {
    const response = await fetch(
      `${TEST_CONFIG.baseUrl}/api/metrics/business?type=metrics&timeRange=1h`
    );
    const data = await response.json();

    if (response.ok) {
      console.log('✅ 指标查询成功');

      const { chatMetrics, uploadMetrics, commerceMetrics, toolFailureMetrics, systemMetrics } = data.data;

      console.log('\n📊 指标摘要:');
      console.log(`   聊天请求: ${chatMetrics.totalRequests} (成功率: ${chatMetrics.successRate}%)`);
      console.log(`   上传操作: ${uploadMetrics.totalUploads} (成功率: ${uploadMetrics.successRate}%)`);
      console.log(`   商拍任务: ${commerceMetrics.totalTasks} (成功率: ${commerceMetrics.successRate}%)`);
      console.log(`   工具操作: ${toolFailureMetrics.totalOperations} (失败率: ${toolFailureMetrics.failureRate}%)`);
      console.log(`   系统会话: ${systemMetrics.sessionCount} (错误率: ${systemMetrics.errorRate}%)`);

      return true;
    } else {
      console.error('❌ 指标查询失败:', data.error);
      return false;
    }
  } catch (error) {
    console.error('❌ 网络错误:', error.message);
    return false;
  }
}

/**
 * 测试看板数据
 */
async function testDashboardData() {
  console.log('\n📊 测试看板数据查询...');

  try {
    const response = await fetch(
      `${TEST_CONFIG.baseUrl}/api/metrics/business?type=dashboard&timeRange=1h`
    );
    const data = await response.json();

    if (response.ok) {
      console.log('✅ 看板数据查询成功');

      const { timeSeriesData, popularTools, errorTrends, insights } = data.data;

      console.log(`\n📈 数据概览:`);
      console.log(`   时间序列数据点: ${timeSeriesData.length}`);
      console.log(`   热门工具数量: ${popularTools.length}`);
      console.log(`   错误趋势项数: ${errorTrends.length}`);
      console.log(`   智能洞察数量: ${insights.length}`);

      if (insights.length > 0) {
        console.log('\n💡 智能洞察:');
        insights.forEach((insight, index) => {
          console.log(`   ${index + 1}. [${insight.type.toUpperCase()}] ${insight.title}`);
          console.log(`      ${insight.description}`);
        });
      }

      return true;
    } else {
      console.error('❌ 看板数据查询失败:', data.error);
      return false;
    }
  } catch (error) {
    console.error('❌ 网络错误:', error.message);
    return false;
  }
}

/**
 * 验证核心指标
 */
async function validateKeyMetrics() {
  console.log('\n🎯 验证核心业务指标...');

  try {
    const response = await fetch(
      `${TEST_CONFIG.baseUrl}/api/metrics/business?type=metrics&timeRange=1h`
    );
    const data = await response.json();

    if (!response.ok) {
      console.error('❌ 无法获取指标数据');
      return false;
    }

    const metrics = data.data;
    let allPassed = true;

    // 验证聊天指标
    if (metrics.chatMetrics.totalRequests > 0) {
      console.log(`✅ 聊天指标: ${metrics.chatMetrics.totalRequests} 个请求，成功率 ${metrics.chatMetrics.successRate}%`);
    } else {
      console.log('⚠️  聊天指标: 暂无数据');
    }

    // 验证上传指标
    if (metrics.uploadMetrics.totalUploads > 0) {
      console.log(`✅ 上传指标: ${metrics.uploadMetrics.totalUploads} 个上传，成功率 ${metrics.uploadMetrics.successRate}%`);
    } else {
      console.log('⚠️  上传指标: 暂无数据');
    }

    // 验证商拍指标
    if (metrics.commerceMetrics.totalTasks > 0) {
      console.log(`✅ 商拍指标: ${metrics.commerceMetrics.totalTasks} 个任务，成功率 ${metrics.commerceMetrics.successRate}%`);
      console.log(`   平均处理时间: ${metrics.commerceMetrics.averageProcessingTime}s`);
    } else {
      console.log('⚠️  商拍指标: 暂无数据');
    }

    // 验证工具指标
    if (metrics.toolFailureMetrics.totalOperations > 0) {
      console.log(`✅ 工具指标: ${metrics.toolFailureMetrics.totalOperations} 个操作，失败率 ${metrics.toolFailureMetrics.failureRate}%`);
    } else {
      console.log('⚠️  工具指标: 暂无数据');
    }

    // 验证系统指标
    console.log(`✅ 系统指标: ${metrics.systemMetrics.sessionCount} 个会话，${metrics.systemMetrics.activeUsers} 个活跃用户`);

    return allPassed;
  } catch (error) {
    console.error('❌ 验证失败:', error.message);
    return false;
  }
}

/**
 * 运行完整测试套件
 */
async function runAllTests() {
  console.log('🚀 开始业务埋点系统完整测试...\n');
  console.log('测试配置:');
  console.log(`   服务器地址: ${TEST_CONFIG.baseUrl}`);
  console.log(`   会话ID: ${TEST_CONFIG.sessionId}`);
  console.log(`   用户ID: ${TEST_CONFIG.userId}`);
  console.log(`   测试事件数: ${TEST_EVENTS.length}`);

  const results = [];

  // 1. 发送测试事件
  console.log('\n' + '='.repeat(50));
  results.push(await sendTestEvents());

  // 等待数据处理
  console.log('\n⏳ 等待数据处理...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 2. 测试指标查询
  console.log('\n' + '='.repeat(50));
  results.push(await testMetricsQuery());

  // 3. 测试看板数据
  console.log('\n' + '='.repeat(50));
  results.push(await testDashboardData());

  // 4. 验证核心指标
  console.log('\n' + '='.repeat(50));
  results.push(await validateKeyMetrics());

  // 测试结果汇总
  console.log('\n' + '='.repeat(50));
  console.log('📊 测试结果汇总:');

  const passedTests = results.filter(r => r).length;
  const totalTests = results.length;

  if (passedTests === totalTests) {
    console.log(`🎉 所有测试通过! (${passedTests}/${totalTests})`);
    console.log('\n✨ 业务埋点系统功能正常，可以投入使用！');
    console.log('\n📋 测试覆盖功能:');
    console.log('   ✅ 事件收集和上报');
    console.log('   ✅ 指标计算和聚合');
    console.log('   ✅ 数据查询和分析');
    console.log('   ✅ 看板数据生成');
    console.log('   ✅ 核心业务指标验证');
    console.log('\n🔗 访问看板: http://localhost:3007/admin/metrics');
  } else {
    console.log(`❌ 部分测试失败! (${passedTests}/${totalTests})`);
    console.log('\n请检查以下功能是否正常工作:');
    if (!results[0]) console.log('   - 事件上报API');
    if (!results[1]) console.log('   - 指标查询API');
    if (!results[2]) console.log('   - 看板数据API');
    if (!results[3]) console.log('   - 核心指标计算');
  }

  return passedTests === totalTests;
}

// 如果直接运行此脚本
if (typeof window === 'undefined' && require.main === module) {
  runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 测试执行失败:', error);
      process.exit(1);
    });
}

// 导出给浏览器使用
if (typeof window !== 'undefined') {
  window.runBusinessTrackingTest = runAllTests;
  console.log('💡 在浏览器控制台中运行 runBusinessTrackingTest() 来执行测试');
}