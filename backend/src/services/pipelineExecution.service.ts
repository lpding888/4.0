import logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES } from '../config/error-codes.js';
import { EventEmitter } from 'events';
import pipelineSchemaService from './pipelineSchema.service.js';
import type {
  ExecutionStatus,
  NodeStatus,
  ExecutionMode,
  PipelineExecution,
  ExecutionStep,
  PipelineSchema,
  PipelineNodeDefinition,
  NodeExecutionResult,
  ExecutionContext,
  ErrorDetails,
  ConditionExpression,
  TransformResult,
  ConditionResult,
  LoopResult,
  ParallelResult,
  ParallelBranchResult
} from '../engine/pipeline-types.js';

class PipelineExecutionService extends EventEmitter {
  public readonly EXECUTION_MODES = { MOCK: 'mock', REAL: 'real' } as const;
  public readonly EXECUTION_STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
  } as const;
  public readonly NODE_STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    SKIPPED: 'skipped'
  } as const;

  private executions: Map<string, PipelineExecution> = new Map();
  private executionSteps: Map<string, ExecutionStep[]> = new Map();

  async createExecution(
    schemaId: string,
    inputData: Record<string, unknown>,
    mode: ExecutionMode = this.EXECUTION_MODES.MOCK,
    userId: string | null = null
  ): Promise<PipelineExecution> {
    try {
      const executionId = this.generateId();
      const execution: PipelineExecution = {
        id: executionId,
        schema_id: schemaId,
        execution_mode: mode,
        status: this.EXECUTION_STATUS.PENDING as ExecutionStatus,
        input_data: inputData,
        output_data: null,
        execution_context: this.createExecutionContext(inputData, mode),
        execution_metadata: {
          created_at: new Date().toISOString(),
          created_by: userId,
          node_count: 0,
          step_count: 0
        },
        started_at: null,
        completed_at: null,
        duration_ms: null,
        error_message: null,
        error_details: null
      };

      this.executions.set(executionId, execution);

      const schema = await pipelineSchemaService.getSchemaById(schemaId);
      execution.schema = schema as PipelineSchema;

      await this.createExecutionSteps(executionId, schema.node_definitions);

      logger.info(`[PipelineExecutionService] Created execution: ${executionId}`, {
        schemaId,
        mode,
        userId
      });

      return execution;
    } catch (error) {
      logger.error('[PipelineExecutionService] Create execution failed:', error);
      throw AppError.custom(ERROR_CODES.INTERNAL_SERVER_ERROR, '创建执行任务失败');
    }
  }

  async startExecution(executionId: string) {
    try {
      const execution = this.executions.get(executionId);
      if (!execution) {
        throw AppError.custom(ERROR_CODES.TASK_NOT_FOUND, '执行任务不存在');
      }
      if (execution.status !== this.EXECUTION_STATUS.PENDING) {
        throw AppError.custom(ERROR_CODES.INVALID_REQUEST, '执行任务已开始或完成');
      }
      execution.status = this.EXECUTION_STATUS.RUNNING;
      execution.started_at = new Date().toISOString();

      this.emitExecutionEvent(executionId, 'execution:started', {
        execution_id: executionId,
        status: execution.status,
        started_at: execution.started_at
      });

      await this.executePipeline(executionId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error('[PipelineExecutionService] Start execution failed:', error);
      await this.failExecution(executionId, errorMessage);
      throw error;
    }
  }

  async executePipeline(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    const steps = this.executionSteps.get(executionId) || [];

    const results: Record<string, NodeExecutionResult> = {};

    const adjacency = new Map<string, string[]>();
    for (const step of steps) {
      adjacency.set(step.node_id, []);
    }
    // 构造执行顺序（简单按 steps 顺序执行，若有依赖，可在 node.config.dependencies 中声明）
    const getDependencies = (node: ExecutionStep): string[] =>
      (node?.config?.dependencies ?? []) as string[];

    const executeNode = async (nodeId: string) => {
      const step = steps.find((s) => s.node_id === nodeId);
      if (!step) return;

      // 先跑依赖
      for (const depId of getDependencies(step)) {
        if (!results[depId]) {
          await executeNode(depId);
        }
      }

      await this.updateStepStatus(executionId, nodeId, this.NODE_STATUS.RUNNING);
      const nodeResult = await this.executeNode(executionId, step, results);
      results[nodeId] = nodeResult;
      await this.updateStepStatus(
        executionId,
        nodeId,
        this.NODE_STATUS.COMPLETED,
        null,
        nodeResult.output
      );
    };

    for (const step of steps) {
      await executeNode(step.node_id);
    }

    // 结束
    const outputData = this.mergeResults(results, execution?.schema?.output_schema);
    await this.completeExecution(executionId, outputData);
  }

  async executeNode(
    executionId: string,
    node: ExecutionStep,
    previousResults: Record<string, NodeExecutionResult>
  ): Promise<NodeExecutionResult> {
    const execution = this.executions.get(executionId);
    if (!execution) throw AppError.custom(ERROR_CODES.TASK_NOT_FOUND, '执行任务不存在');

    const startTime = Date.now();
    try {
      let output: Record<string, unknown> | null = null;

      switch (node.node_type) {
        case 'input':
          output = this.executeInputNode(execution, node);
          break;
        case 'output':
          output = this.executeOutputNode(execution, node, previousResults);
          break;
        case 'transform':
          output = (await this.executeTransformNode(
            execution,
            node,
            previousResults
          )) as unknown as Record<string, unknown>;
          break;
        case 'condition':
          output = (await this.executeConditionNode(
            execution,
            node,
            previousResults
          )) as unknown as Record<string, unknown>;
          break;
        case 'loop':
          output = (await this.executeLoopNode(
            execution,
            node,
            previousResults
          )) as unknown as Record<string, unknown>;
          break;
        case 'parallel':
          output = (await this.executeParallelNode(
            execution,
            node,
            previousResults
          )) as unknown as Record<string, unknown>;
          break;
        case 'merge':
          output = await this.executeMergeNode(execution, node, previousResults);
          break;
        default:
          throw new Error(`未知的节点类型: ${node.node_type}`);
      }

      return {
        node_id: node.node_id,
        success: true,
        output,
        duration_ms: Date.now() - startTime
      };
    } catch (error) {
      return {
        node_id: node.node_id,
        success: false,
        output: null,
        error: {
          message: error instanceof Error ? error.message : '节点执行失败',
          code: 'NODE_EXECUTION_ERROR'
        },
        duration_ms: Date.now() - startTime
      };
    }
  }

  executeInputNode(execution: PipelineExecution, node: ExecutionStep): Record<string, unknown> {
    const { input_data } = execution;
    const { input_config } = (node.config || {}) as { input_config?: { mapping?: Record<string, string> } };
    let result = input_data;
    if (input_config && input_config.mapping) {
      result = this.mapInputData(input_data, input_config.mapping);
    }
    return result;
  }

  executeOutputNode(
    _execution: PipelineExecution,
    node: ExecutionStep,
    previousResults: Record<string, NodeExecutionResult>
  ): Record<string, unknown> {
    const config = node.config as { output_config?: { ports?: Record<string, { name?: string }> } };
    const { output_config } = config || {};
    const result: Record<string, unknown> = {};
    for (const [sourceNodeId, portConfig] of Object.entries(output_config?.ports || {})) {
      const nodeResult = previousResults[sourceNodeId];
      if (nodeResult && nodeResult.output) {
        result[portConfig.name || sourceNodeId] = nodeResult.output;
      }
    }
    return result;
  }

  async executeTransformNode(
    execution: PipelineExecution,
    node: ExecutionStep,
    previousResults: Record<string, NodeExecutionResult>
  ): Promise<TransformResult> {
    const mode = execution.execution_mode as ExecutionMode;
    const config = node.config as { transform_config?: Record<string, unknown> };
    const { transform_config } = config || {};
    if (mode === this.EXECUTION_MODES.MOCK) {
      return this.generateMockTransformResult(node, previousResults);
    }
    return await this.executeRealTransform(node, previousResults, transform_config);
  }

  async executeConditionNode(
    _execution: PipelineExecution,
    node: ExecutionStep,
    previousResults: Record<string, NodeExecutionResult>
  ): Promise<ConditionResult> {
    const config = node.config as { condition_config?: { condition?: ConditionExpression } };
    const { condition_config } = config || {};
    const { condition } = condition_config || {};
    const conditionResult = this.evaluateCondition(condition, previousResults);
    return {
      condition_result: conditionResult,
      selected_branch: conditionResult ? 'true' : 'false'
    };
  }

  async executeLoopNode(
    execution: PipelineExecution,
    node: ExecutionStep,
    previousResults: Record<string, NodeExecutionResult>
  ): Promise<LoopResult> {
    const config = node.config as { loop_config?: { iterations?: number } };
    const { loop_config } = config || {};
    const { iterations = 3 } = loop_config || {};
    const results: unknown[] = [];
    for (let i = 0; i < iterations; i++) {
      const iterationResult = await this.executeLoopIteration(execution, node, previousResults, i);
      results.push(iterationResult);
      this.emitExecutionEvent(execution.id, 'loop:iteration', {
        node_id: node.node_id,
        iteration: i,
        result: iterationResult
      });
    }
    return { iterations: results, total_iterations: iterations };
  }

  async executeParallelNode(
    execution: PipelineExecution,
    node: ExecutionStep,
    previousResults: Record<string, NodeExecutionResult>
  ): Promise<ParallelResult> {
    const config = node.config as { parallel_config?: { branches?: unknown[] } };
    const { parallel_config } = config || {};
    const { branches = [] } = parallel_config || {};
    const promises = branches.map(async (branch, index) => {
      try {
        const result = await this.executeParallelBranch(execution, node, branch, previousResults, index);
        return { ...result, success: true };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : '分支执行失败',
          branch_index: index,
          success: false
        };
      }
    });
    const results = await Promise.all(promises);
    return {
      branches: results as ParallelBranchResult[],
      successful_branches: results.filter((r) => r.success).length
    };
  }

  async executeMergeNode(
    _execution: PipelineExecution,
    _node: ExecutionStep,
    previousResults: Record<string, NodeExecutionResult>
  ): Promise<Record<string, unknown>> {
    const outputs = Object.values(previousResults)
      .map((r) => r.output)
      .filter((o): o is Record<string, unknown> => o !== null);
    return this.combineResults(outputs);
  }

  generateMockTransformResult(
    node: ExecutionStep,
    _previousResults: Record<string, NodeExecutionResult>
  ): TransformResult {
    const config = node.config as { mock?: { type?: string } };
    const mockData: TransformResult = {
      node_id: node.node_id,
      processed_at: new Date().toISOString()
    };
    switch (config?.mock?.type) {
      case 'text_summary':
        return { ...mockData, summary: 'This is a mock summary.' };
      case 'image_process':
        return { ...mockData, width: 512, height: 512, format: 'png' };
      default:
        return {
          ...mockData,
          output_format: 'generic_output',
          data_size: Math.floor(Math.random() * 10000)
        };
    }
  }

  async executeRealTransform(
    _node: ExecutionStep,
    previousResults: Record<string, NodeExecutionResult>,
    transformConfig?: Record<string, unknown>
  ): Promise<TransformResult> {
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));
    return {
      node_id: _node.node_id,
      processed_data: previousResults,
      transformation_applied: (transformConfig?.type as string) || 'default',
      processed_at: new Date().toISOString()
    };
  }

  evaluateCondition(
    condition: ConditionExpression | undefined,
    previousResults: Record<string, NodeExecutionResult>
  ): boolean {
    if (!condition) return true;
    if (condition.type === 'exists') {
      const { variable } = condition;
      return variable ? Object.prototype.hasOwnProperty.call(previousResults, variable) : false;
    }
    if (condition.type === 'equals') {
      const { variable, value } = condition;
      return variable ? previousResults[variable]?.output === value : false;
    }
    return true;
  }

  async completeExecution(
    executionId: string,
    outputData: Record<string, unknown>
  ): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) return;
    execution.status = this.EXECUTION_STATUS.COMPLETED;
    execution.completed_at = new Date().toISOString();
    execution.duration_ms = execution.started_at
      ? Date.now() - new Date(execution.started_at).getTime()
      : null;
    execution.output_data = outputData;
    this.emitExecutionEvent(executionId, 'execution:completed', {
      execution_id: executionId,
      status: execution.status,
      completed_at: execution.completed_at,
      duration_ms: execution.duration_ms,
      output_data: outputData
    });
    logger.info(`[PipelineExecutionService] Execution completed: ${executionId}`, {
      duration: execution.duration_ms,
      status: execution.status
    });
  }

  async failExecution(
    executionId: string,
    errorMessage: string,
    errorDetails: Error | null = null
  ): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) return;
    execution.status = this.EXECUTION_STATUS.FAILED;
    execution.completed_at = new Date().toISOString();
    execution.duration_ms = execution.started_at
      ? Date.now() - new Date(execution.started_at).getTime()
      : null;
    execution.error_message = errorMessage;
    execution.error_details = errorDetails
      ? { message: errorDetails.message, stack: errorDetails.stack }
      : null;
    this.emitExecutionEvent(executionId, 'execution:failed', {
      execution_id: executionId,
      status: execution.status,
      error_message: errorMessage,
      error_details: execution.error_details
    });
    logger.error(`[PipelineExecutionService] Execution failed: ${executionId}`, {
      error: errorMessage
    });
  }

  async cancelExecution(executionId: string, reason: string = '用户取消'): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw AppError.custom(ERROR_CODES.TASK_NOT_FOUND, '执行任务不存在');
    }
    if (
      execution.status === this.EXECUTION_STATUS.COMPLETED ||
      execution.status === this.EXECUTION_STATUS.FAILED ||
      execution.status === this.EXECUTION_STATUS.CANCELLED
    ) {
      throw AppError.custom(ERROR_CODES.INVALID_REQUEST, '执行任务已完成，无法取消');
    }
    execution.status = this.EXECUTION_STATUS.CANCELLED;
    execution.completed_at = new Date().toISOString();
    execution.duration_ms = execution.started_at
      ? Date.now() - new Date(execution.started_at).getTime()
      : null;
    execution.error_message = reason;
    this.emitExecutionEvent(executionId, 'execution:cancelled', {
      execution_id: executionId,
      status: execution.status,
      reason
    });
    return true;
  }

  getExecution(id: string): PipelineExecution {
    const execution = this.executions.get(id);
    if (!execution) throw AppError.custom(ERROR_CODES.TASK_NOT_FOUND, '执行任务不存在');
    return execution;
  }

  getExecutions(options: {
    schema_id?: string;
    status?: ExecutionStatus;
    mode?: ExecutionMode;
    limit?: number;
    offset?: number;
  } = {}) {
    const { schema_id, status, mode, limit = 20, offset = 0 } = options;
    let executions: PipelineExecution[] = Array.from(this.executions.values());
    if (schema_id) executions = executions.filter((e) => e.schema_id === schema_id);
    if (status) executions = executions.filter((e) => e.status === status);
    if (mode) executions = executions.filter((e) => e.execution_mode === mode);
    executions.sort(
      (a, b) =>
        new Date(b.execution_metadata.created_at || 0).getTime() -
        new Date(a.execution_metadata.created_at || 0).getTime()
    );
    const total = executions.length;
    const paginatedExecutions = executions.slice(offset, offset + limit);
    return {
      executions: paginatedExecutions,
      pagination: { total, limit, offset, pages: Math.ceil(total / limit) }
    };
  }

  createExecutionContext(
    inputData: Record<string, unknown>,
    mode: ExecutionMode
  ): ExecutionContext {
    return {
      mode,
      variables: {},
      state: inputData,
      trace_id: this.generateId()
    };
  }

  async createExecutionSteps(
    executionId: string,
    nodeDefinitions: PipelineNodeDefinition[]
  ): Promise<ExecutionStep[]> {
    const steps: ExecutionStep[] = [];
    for (const node of nodeDefinitions || []) {
      steps.push({
        id: this.generateId(),
        execution_id: executionId,
        node_id: node.node_id,
        node_type: node.node_type,
        status: this.NODE_STATUS.PENDING as NodeStatus,
        input_data: null,
        output_data: null,
        error_message: null,
        started_at: null,
        completed_at: null,
        duration_ms: null,
        retry_count: 0,
        metadata: { node_name: node.node_name, created_at: new Date().toISOString() }
      });
    }
    this.executionSteps.set(executionId, steps);
    return steps;
  }

  async updateStepStatus(
    executionId: string,
    nodeId: string,
    status: NodeStatus,
    errorMessage: string | null = null,
    outputData: Record<string, unknown> | null = null
  ): Promise<void> {
    const steps = this.executionSteps.get(executionId) || [];
    const step = steps.find((s) => s.node_id === nodeId);
    if (step) {
      step.status = status;
      if (status === this.NODE_STATUS.RUNNING) {
        step.started_at = new Date().toISOString();
      } else if (status === this.NODE_STATUS.COMPLETED || status === this.NODE_STATUS.FAILED) {
        step.completed_at = new Date().toISOString();
        step.duration_ms = step.started_at
          ? Date.now() - new Date(step.started_at).getTime()
          : null;
      }
      if (errorMessage) step.error_message = errorMessage;
      if (outputData) step.output_data = outputData;
      this.emitExecutionEvent(executionId, 'step:updated', {
        node_id: nodeId,
        status,
        error_message: errorMessage,
        output_data: outputData
      });
    }
  }

  emitExecutionEvent(
    executionId: string,
    eventType: string,
    data: Record<string, unknown>
  ): void {
    const event = {
      type: eventType,
      execution_id: executionId,
      timestamp: new Date().toISOString(),
      ...data
    };
    this.emit('execution:event', event);
  }

  generateId(): string {
    return 'exec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  cleanupExpiredExecutions(maxAge: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    const expiredIds: string[] = [];
    for (const [executionId, execution] of this.executions.entries()) {
      const createdTime = new Date(execution.execution_metadata.created_at || 0).getTime();
      if (now - createdTime > maxAge) expiredIds.push(executionId);
    }
    for (const id of expiredIds) {
      this.executions.delete(id);
      this.executionSteps.delete(id);
    }
    if (expiredIds.length > 0) {
      logger.info(`[PipelineExecutionService] Cleaned up ${expiredIds.length} expired executions`);
    }
    return expiredIds.length;
  }

  mapInputData(
    inputData: Record<string, unknown>,
    mapping: Record<string, string>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [targetKey, sourcePath] of Object.entries(mapping)) {
      result[targetKey] = this.getNestedValue(inputData, sourcePath);
    }
    return result;
  }

  getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => {
      if (current && typeof current === 'object' && key in current) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  combineResults(results: Record<string, unknown>[]): Record<string, unknown> {
    return results.reduce(
      (combined, result) => ({ ...combined, ...(result || {}) }),
      {} as Record<string, unknown>
    );
  }

  mergeResultsArray(results: unknown[]): { merged_results: unknown[]; total_count: number } {
    return { merged_results: results, total_count: results.length };
  }

  flattenResults(results: unknown[][]): unknown[] {
    return results.flat();
  }

  executeLoopIteration(
    _execution: PipelineExecution,
    _node: ExecutionStep,
    previousResults: Record<string, NodeExecutionResult>,
    iteration: number
  ): Record<string, unknown> {
    return {
      iteration,
      input_data: previousResults,
      result: `Loop iteration ${iteration} result`
    };
  }

  executeParallelBranch(
    _execution: PipelineExecution,
    _node: ExecutionStep,
    branch: unknown,
    previousResults: Record<string, NodeExecutionResult>,
    index: number
  ): ParallelBranchResult {
    const branchConfig = branch as { name?: string };
    return {
      branch_index: index,
      branch_id: branchConfig?.name || `branch_${index}`,
      success: true,
      result: `Parallel branch ${index} result`,
      duration_ms: 0
    };
  }

  mergeResults(
    results: Record<string, NodeExecutionResult>,
    _outputSchema: unknown
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = {};
    for (const result of Object.values(results)) {
      if (result.output && typeof result.output === 'object') {
        Object.assign(merged, result.output);
      }
    }
    return merged;
  }
}

export default new PipelineExecutionService();
