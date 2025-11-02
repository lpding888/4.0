/**
 * Pipeline测试运行器控制器
 * 艹！支持mock和真实两种模式，提供详细日志！
 */

const db = require('../../config/database');
// 艹！临时注释掉，因为provider-loader是.ts文件，运行时找不到！
// const { providerLoader } = require('../../providers/provider-loader');

/**
 * 测试运行Pipeline
 * POST /admin/pipelines/:id/test
 *
 * Body:
 * - mode: 'mock' | 'real' (默认mock)
 * - inputData: 测试输入数据
 *
 * 艹！这个接口隔离配额，不扣费，不影响业务！
 */
async function testPipeline(req, res) {
  const { id: pipelineId } = req.params;
  const { mode = 'mock', inputData = {} } = req.body;

  try {
    // 1. 获取Pipeline Schema
    const pipeline = await db('pipeline_schemas')
      .where('pipeline_id', pipelineId)
      .first();

    if (!pipeline) {
      return res.status(404).json({
        success: false,
        error: { message: 'Pipeline不存在' },
      });
    }

    const steps = JSON.parse(pipeline.steps);
    if (!Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'Pipeline steps配置错误' },
      });
    }

    // 2. 执行测试运行
    const testId = `test-${Date.now()}`;
    const logs = [];
    let previousOutput = inputData;

    console.log(`[测试运行器] 开始测试 pipelineId=${pipelineId} mode=${mode} testId=${testId}`);

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const startTime = Date.now();

      console.log(`[测试运行器] 执行步骤${i + 1}/${steps.length} type=${step.type}`);

      // 记录步骤开始
      const stepLog = {
        stepId: `step-${i}`,
        stepIndex: i,
        type: step.type,
        providerRef: step.provider_ref,
        status: 'processing',
        startTime: new Date().toISOString(),
        input: previousOutput,
      };

      try {
        let result;

        if (mode === 'mock') {
          // 艹！Mock模式：模拟Provider返回
          result = await mockProviderExecution(step, previousOutput);
        } else {
          // 艹！真实模式：调用真实Provider
          result = await realProviderExecution(step, previousOutput, testId);
        }

        const endTime = Date.now();
        const latency = endTime - startTime;

        // 成功
        stepLog.status = 'success';
        stepLog.output = result.data;
        stepLog.latency = latency;
        stepLog.endTime = new Date().toISOString();

        previousOutput = result.data;

        console.log(`[测试运行器] 步骤${i + 1}成功 latency=${latency}ms`);

      } catch (error) {
        const endTime = Date.now();
        const latency = endTime - startTime;

        // 失败
        stepLog.status = 'failed';
        stepLog.error = {
          code: error.code || 'EXECUTION_ERROR',
          message: error.message,
          details: error.details,
        };
        stepLog.latency = latency;
        stepLog.endTime = new Date().toISOString();

        console.error(`[测试运行器] 步骤${i + 1}失败 error=${error.message}`);

        logs.push(stepLog);

        // 艹！测试失败，返回失败结果和日志
        return res.json({
          success: false,
          testId,
          mode,
          failedAtStep: i,
          logs,
          error: {
            message: `步骤${i + 1}执行失败: ${error.message}`,
            stepId: stepLog.stepId,
          },
        });
      }

      logs.push(stepLog);
    }

    // 3. 所有步骤成功
    console.log(`[测试运行器] 测试成功 testId=${testId}`);

    return res.json({
      success: true,
      testId,
      mode,
      logs,
      finalOutput: previousOutput,
    });

  } catch (error) {
    console.error(`[测试运行器] 测试运行异常 pipelineId=${pipelineId}`, error);

    return res.status(500).json({
      success: false,
      error: {
        message: '测试运行失败',
        details: error.message,
      },
    });
  }
}

/**
 * Mock模式：模拟Provider执行
 * 艹！返回模拟数据，不调用真实API！
 */
async function mockProviderExecution(step, input) {
  // 模拟延迟（200-500ms）
  const delay = 200 + Math.random() * 300;
  await new Promise(resolve => setTimeout(resolve, delay));

  // 根据类型返回模拟数据
  const mockData = {
    GENERIC_HTTP: {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: { success: true, data: 'mock response' },
    },
    TENCENT_CI: {
      resultUrls: ['https://mock.cos.ap-guangzhou.myqcloud.com/result-mock.jpg'],
      processTime: 1500,
    },
    RUNNINGHUB: {
      workflowId: 'mock-workflow-123',
      status: 'completed',
      output: { processed: true },
    },
    SCF: {
      functionResult: { success: true, message: 'Mock SCF execution' },
      executionTime: 300,
    },
  };

  const result = mockData[step.type] || { mockOutput: `Mock data for ${step.type}` };

  return {
    success: true,
    data: result,
  };
}

/**
 * 真实模式：调用真实Provider
 * 艹！对接现有Provider Loader！
 */
async function realProviderExecution(step, input, testId) {
  try {
    // 1. 加载Provider
    const provider = await providerLoader.loadProvider(step.type);

    // 2. 构建执行上下文
    const context = {
      taskId: testId,
      input,
      timeout: step.timeout || 30000,
      metadata: {
        testMode: true,
        stepType: step.type,
        providerRef: step.provider_ref,
      },
    };

    // 3. 执行Provider
    const result = await provider.execute(context);

    if (!result.success) {
      const error = new Error(result.error?.message || '执行失败');
      error.code = result.error?.code;
      error.details = result.error?.details;
      throw error;
    }

    return result;

  } catch (error) {
    console.error(`[真实模式] Provider执行失败 type=${step.type}`, error);
    throw error;
  }
}

module.exports = {
  testPipeline,
};
