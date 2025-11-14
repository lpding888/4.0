/**
 * Pipeline试跑器服务
 *
 * 支持Mock和真实模式，通过SSE输出执行日志
 */

const { EventEmitter } = require('events');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const pipelineValidatorService = require('./pipeline-validator.service');
const websocketService = require('./websocket.service');

interface TestExecution {
  id: string;
  pipelineId: string;
  mode: 'mock' | 'real';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  currentNode?: string;
  context: Record<string, unknown>;
  results: Array<{
    nodeId: string;
    stepName: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    startTime: Date;
    endTime?: Date;
    input?: unknown;
    output?: unknown;
    error?: string;
    logs: string[];
    metrics: {
      duration: number;
      memoryUsed?: number;
    };
  }>;
  summary: {
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    totalDuration: number;
    success: boolean;
  };
}

interface MockNodeResult {
  output: unknown;
  duration: number;
  logs: string[];
  error?: string;
}

interface PipelineNode {
  id: string;
  type: string;
  name: string;
  inputs?: string[];
  outputs?: string[];
  [key: string]: unknown;
}

interface MockPipeline {
  id: string;
  nodes: PipelineNode[];
  edges: Array<{
    id: string;
    source: string;
    target: string;
    condition?: string;
  }>;
}

class PipelineTestRunnerService extends EventEmitter {
  private activeExecutions = new Map<string, TestExecution>();
  private mockData = new Map<string, MockNodeResult>();

  constructor() {
    super();
    this.initializeMockData();
  }

  /**
   * 初始化Mock数据
   */
  private initializeMockData(): void {
    // 为不同类型的节点预定义Mock结果
    this.mockData.set('START', {
      output: { timestamp: new Date().toISOString(), executionId: uuidv4() },
      duration: 10,
      logs: ['🟢 开始执行Pipeline', '初始化执行环境']
    });

    this.mockData.set('TRANSFORM', {
      output: {
        transformed: true,
        recordCount: Math.floor(Math.random() * 100) + 10,
        processingTime: Math.random() * 500 + 100
      },
      duration: Math.random() * 1000 + 200,
      logs: ['🔄 正在转换数据', '应用转换规则', '数据转换完成']
    });

    this.mockData.set('FILTER', {
      output: {
        filtered: true,
        recordCount: Math.floor(Math.random() * 80) + 5,
        filterCriteria: 'default'
      },
      duration: Math.random() * 500 + 100,
      logs: ['🔍 正在过滤数据', '应用过滤条件', '过滤完成']
    });

    this.mockData.set('MERGE', {
      output: {
        merged: true,
        recordCount: Math.floor(Math.random() * 150) + 20,
        sourceCount: 2
      },
      duration: Math.random() * 800 + 200,
      logs: ['🔗 正在合并数据', '合并多个数据源', '数据合并完成']
    });

    this.mockData.set('CONDITION', {
      output: {
        condition: true,
        branch: 'true',
        evaluationTime: Math.random() * 100 + 50
      },
      duration: Math.random() * 300 + 50,
      logs: ['🤔 正在评估条件', '条件表达式: true', '选择分支: true']
    });

    this.mockData.set('END', {
      output: {
        executionId: uuidv4(),
        completedAt: new Date().toISOString(),
        summary: 'Pipeline执行完成'
      },
      duration: 50,
      logs: ['✅ Pipeline执行完成', '生成执行报告', '清理执行环境']
    });
  }

  /**
   * 开始试跑Pipeline
   */
  async startTest(pipelineId: string, mode: 'mock' | 'real' = 'mock'): Promise<string> {
    const executionId = this.generateExecutionId();

    const execution: TestExecution = {
      id: executionId,
      pipelineId,
      mode,
      status: 'pending',
      startTime: new Date(),
      context: {},
      results: [],
      summary: {
        totalSteps: 0,
        completedSteps: 0,
        failedSteps: 0,
        totalDuration: 0,
        success: false
      }
    };

    this.activeExecutions.set(executionId, execution);

    logger.info('Pipeline试跑已开始', {
      executionId,
      pipelineId,
      mode
    });

    // 异步执行Pipeline
    this.executePipeline(executionId).catch((error) => {
      logger.error('Pipeline试跑失败', { executionId, error: error.message });
    });

    return executionId;
  }

  /**
   * 执行Pipeline
   */
  private async executePipeline(executionId: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return;

    try {
      execution.status = 'running';

      // 发送开始事件
      this.emitExecutionEvent(executionId, 'started', {
        message: 'Pipeline试跑开始',
        mode: execution.mode,
        timestamp: new Date()
      });

      // 这里应该从数据库获取Pipeline配置
      // 为了演示，我们使用模拟数据
      const mockPipeline = this.getMockPipeline(execution.pipelineId);

      execution.summary.totalSteps = mockPipeline.nodes.length;

      // 按顺序执行每个节点
      for (const node of mockPipeline.nodes) {
        const latestStatus = this.activeExecutions.get(executionId)?.status;
        if (latestStatus === 'cancelled') {
          execution.status = 'cancelled';
          break;
        }

        await this.executeNode(executionId, node);
      }

      // 完成执行
      if (execution.status === 'cancelled') {
        return;
      }
      execution.status = execution.summary.failedSteps === 0 ? 'completed' : 'failed';
      execution.endTime = new Date();
      execution.summary.totalDuration = execution.endTime.getTime() - execution.startTime.getTime();
      execution.summary.success = execution.summary.failedSteps === 0;

      // 发送完成事件
      this.emitExecutionEvent(
        executionId,
        execution.status === 'completed' ? 'completed' : 'failed',
        {
          message: `Pipeline试跑${execution.status === 'completed' ? '完成' : '失败'}`,
          summary: execution.summary,
          timestamp: new Date()
        }
      );
    } catch (error) {
      const err = error as Error;
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.summary.totalDuration = execution.endTime.getTime() - execution.startTime.getTime();

      this.emitExecutionEvent(executionId, 'error', {
        message: 'Pipeline试跑过程中发生错误',
        error: err.message,
        timestamp: new Date()
      });
    }
  }

  /**
   * 执行单个节点
   */
  private async executeNode(executionId: string, node: PipelineNode): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution || execution.status === 'cancelled') return;

    const stepResult: TestExecution['results'][0] = {
      nodeId: node.id,
      stepName: node.name,
      status: 'pending',
      startTime: new Date(),
      logs: [] as string[],
      metrics: {
        duration: 0
      }
    };

    execution.results.push(stepResult);
    execution.currentNode = node.id;

    try {
      // 发送节点开始事件
      this.emitExecutionEvent(executionId, 'node_started', {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        timestamp: new Date()
      });

      stepResult.status = 'running';

      // 根据模式执行节点
      let nodeResult: MockNodeResult;

      if (execution.mode === 'mock') {
        nodeResult = await this.executeMockNode(node);
      } else {
        nodeResult = await this.executeRealNode(node, execution.context);
      }

      // 处理节点结果
      stepResult.status = nodeResult.error ? 'failed' : 'completed';
      stepResult.endTime = new Date();
      stepResult.output = nodeResult.output;
      stepResult.error = nodeResult.error;
      stepResult.logs = nodeResult.logs;
      stepResult.metrics.duration = nodeResult.duration;

      // 更新执行上下文
      if (nodeResult.output) {
        execution.context[node.id] = nodeResult.output;
      }

      // 更新统计
      if (stepResult.status === 'completed') {
        execution.summary.completedSteps++;
      } else {
        execution.summary.failedSteps++;
      }

      // 发送节点完成事件
      this.emitExecutionEvent(
        executionId,
        stepResult.status === 'completed' ? 'node_completed' : 'node_failed',
        {
          nodeId: node.id,
          nodeName: node.name,
          status: stepResult.status,
          duration: stepResult.metrics.duration,
          logs: stepResult.logs,
          timestamp: new Date()
        }
      );
    } catch (error) {
      const err = error as Error;
      stepResult.status = 'failed';
      stepResult.endTime = new Date();
      stepResult.error = err.message;
      stepResult.logs.push(`❌ 节点执行失败: ${err.message}`);
      stepResult.metrics.duration = Date.now() - stepResult.startTime.getTime();

      execution.summary.failedSteps++;

      this.emitExecutionEvent(executionId, 'node_failed', {
        nodeId: node.id,
        nodeName: node.name,
        error: err.message,
        timestamp: new Date()
      });
    }
  }

  /**
   * 执行Mock节点
   */
  private async executeMockNode(node: PipelineNode): Promise<MockNodeResult> {
    const mockResult = this.mockData.get(node.type) || this.mockData.get('TRANSFORM');
    if (!mockResult) {
      throw new Error(`未找到节点类型 ${node.type} 的Mock数据`);
    }

    // 模拟执行延迟
    await this.delay(mockResult.duration);

    return {
      output: mockResult.output,
      duration: mockResult.duration,
      logs: mockResult.logs.map((log) => `[${node.name}] ${log}`),
      error: mockResult.error
    };
  }

  /**
   * 执行真实节点
   */
  private async executeRealNode(
    node: PipelineNode,
    context: Record<string, unknown>
  ): Promise<MockNodeResult> {
    const startTime = Date.now();
    const logs: string[] = [];

    try {
      logs.push(`[真实模式] 开始执行节点: ${node.name}`);

      // 这里应该根据节点类型调用相应的服务
      // 例如：图片处理、AI分析、数据转换等

      let output: unknown;

      switch (node.type) {
        case 'IMAGE_PROCESS':
          output = await this.executeImageProcessNode(node, context);
          break;
        case 'AI_ANALYSIS':
          output = await this.executeAIAnalysisNode(node, context);
          break;
        case 'DATA_TRANSFORM':
          output = await this.executeDataTransformNode(node, context);
          break;
        default:
          output = await this.executeGenericNode(node, context);
      }

      const duration = Date.now() - startTime;
      logs.push(`[真实模式] 节点执行完成，耗时: ${duration}ms`);

      return {
        output,
        duration,
        logs
      };
    } catch (error) {
      const err = error as Error;
      const duration = Date.now() - startTime;
      logs.push(`[真实模式] 节点执行失败: ${err.message}`);

      return {
        output: null,
        duration,
        logs,
        error: err.message
      };
    }
  }

  /**
   * 执行图片处理节点
   */
  private async executeImageProcessNode(
    node: PipelineNode,
    context: Record<string, unknown>
  ): Promise<unknown> {
    // 模拟图片处理逻辑
    await this.delay(Math.random() * 2000 + 1000);

    return {
      processed: true,
      imageUrl: `https://example.com/processed/${Date.now()}.jpg`,
      size: Math.floor(Math.random() * 1024 * 1024) + 100 * 1024, // 100KB-1MB
      metadata: {
        width: 1920,
        height: 1080,
        format: 'jpeg'
      }
    };
  }

  /**
   * 执行AI分析节点
   */
  private async executeAIAnalysisNode(
    node: PipelineNode,
    context: Record<string, unknown>
  ): Promise<unknown> {
    // 模拟AI分析逻辑
    await this.delay(Math.random() * 3000 + 2000);

    return {
      analysis: {
        score: Math.random() * 100,
        confidence: Math.random() * 0.3 + 0.7,
        tags: ['tag1', 'tag2', 'tag3'],
        insights: ['图片质量良好', '色彩饱和度适中', '主体清晰可见']
      },
      processingTime: Math.random() * 2000 + 1000
    };
  }

  /**
   * 执行数据转换节点
   */
  private async executeDataTransformNode(
    node: PipelineNode,
    context: Record<string, unknown>
  ): Promise<unknown> {
    // 模拟数据转换逻辑
    await this.delay(Math.random() * 500 + 200);

    return {
      transformed: true,
      recordCount: Math.floor(Math.random() * 1000) + 100,
      fields: ['field1', 'field2', 'field3'],
      transformations: ['lowercase', 'trim', 'normalize']
    };
  }

  /**
   * 执行通用节点
   */
  private async executeGenericNode(
    node: PipelineNode,
    context: Record<string, unknown>
  ): Promise<unknown> {
    // 通用节点处理逻辑
    await this.delay(Math.random() * 1000 + 500);

    return {
      executed: true,
      nodeType: node.type,
      contextKeys: Object.keys(context),
      output: `Generated output for ${node.type} node`
    };
  }

  /**
   * 取消试跑
   */
  async cancelTest(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      return false;
    }

    if (execution.status === 'completed' || execution.status === 'failed') {
      return false;
    }

    execution.status = 'cancelled';
    execution.endTime = new Date();

    this.emitExecutionEvent(executionId, 'cancelled', {
      message: 'Pipeline试跑已取消',
      timestamp: new Date()
    });

    logger.info('Pipeline试跑已取消', { executionId });
    return true;
  }

  /**
   * 获取试跑状态
   */
  getTestStatus(executionId: string): TestExecution | null {
    return this.activeExecutions.get(executionId) || null;
  }

  /**
   * 获取所有活跃的试跑
   */
  getActiveTests(): TestExecution[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * 清理已完成的试跑
   */
  async cleanupCompletedTests(): Promise<number> {
    const completedIds: string[] = [];

    for (const [executionId, execution] of this.activeExecutions) {
      if (
        execution.status === 'completed' ||
        execution.status === 'failed' ||
        execution.status === 'cancelled'
      ) {
        completedIds.push(executionId);
      }
    }

    for (const id of completedIds) {
      this.activeExecutions.delete(id);
    }

    if (completedIds.length > 0) {
      logger.info('清理已完成的Pipeline试跑', { count: completedIds.length });
    }

    return completedIds.length;
  }

  /**
   * 发送执行事件
   */
  private emitExecutionEvent(
    executionId: string,
    eventType: string,
    data: Record<string, unknown>
  ): void {
    // 通过WebSocket发送事件
    websocketService.sendTaskEvent(executionId, {
      event: eventType,
      data,
      executionId,
      timestamp: new Date().toISOString()
    });

    // 发送到本地事件监听器
    this.emit('execution_event', {
      executionId,
      eventType,
      data,
      timestamp: new Date()
    });
  }

  /**
   * 获取模拟Pipeline配置
   */
  private getMockPipeline(pipelineId: string): MockPipeline {
    // 返回模拟的Pipeline配置
    return {
      id: pipelineId,
      nodes: [
        { id: 'start', type: 'START', name: '开始', inputs: [], outputs: ['input_data'] },
        {
          id: 'transform1',
          type: 'TRANSFORM',
          name: '数据转换1',
          inputs: ['input_data'],
          outputs: ['transformed_data1']
        },
        {
          id: 'filter1',
          type: 'FILTER',
          name: '数据过滤',
          inputs: ['transformed_data1'],
          outputs: ['filtered_data']
        },
        {
          id: 'condition1',
          type: 'CONDITION',
          name: '条件判断',
          inputs: ['filtered_data'],
          outputs: ['branch_true', 'branch_false']
        },
        {
          id: 'merge1',
          type: 'MERGE',
          name: '数据合并',
          inputs: ['branch_true', 'branch_false'],
          outputs: ['final_data']
        },
        { id: 'end', type: 'END', name: '结束', inputs: ['final_data'], outputs: [] }
      ],
      edges: [
        { id: 'e1', source: 'start', target: 'transform1' },
        { id: 'e2', source: 'transform1', target: 'filter1' },
        { id: 'e3', source: 'filter1', target: 'condition1' },
        { id: 'e4', source: 'condition1', target: 'merge1', condition: 'true' },
        { id: 'e5', source: 'condition1', target: 'merge1', condition: 'false' },
        { id: 'e6', source: 'merge1', target: 'end' }
      ]
    };
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 生成执行ID
   */
  private generateExecutionId(): string {
    return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const executions = Array.from(this.activeExecutions.values());

    return {
      active: executions.length,
      byStatus: {
        pending: executions.filter((e) => e.status === 'pending').length,
        running: executions.filter((e) => e.status === 'running').length,
        completed: executions.filter((e) => e.status === 'completed').length,
        failed: executions.filter((e) => e.status === 'failed').length,
        cancelled: executions.filter((e) => e.status === 'cancelled').length
      },
      byMode: {
        mock: executions.filter((e) => e.mode === 'mock').length,
        real: executions.filter((e) => e.mode === 'real').length
      }
    };
  }
}

// 单例实例
const pipelineTestRunnerService = new PipelineTestRunnerService();

// 定期清理已完成的试跑
setInterval(
  () => {
    pipelineTestRunnerService.cleanupCompletedTests().catch((error) => {
      logger.error('清理Pipeline试跑失败:', error);
    });
  },
  5 * 60 * 1000
); // 每5分钟清理一次

module.exports = pipelineTestRunnerService;
