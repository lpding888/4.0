/**
 * RunningHubProvider - RunningHub工作流Provider
 *
 * 职责：
 * - 触发RunningHub工作流
 * - 轮询工作流状态
 * - 获取工作流结果
 *
 * TODO: 实现具体的RunningHub API调用逻辑
 * 艹，这个需要对接RunningHub的API，目前是符合IProvider规范的占位实现！
 */

import { BaseProvider } from '../base/base-provider';
import {
  ExecContext,
  ExecResult,
  ProviderErrorCode,
} from '../types';

/**
 * RunningHub Provider输入格式
 */
export interface RunningHubInput {
  /** 工作流ID（必填） */
  workflowId: string;

  /** API密钥（必填） */
  apiKey: string;

  /** 工作流输入参数（必填） */
  params: Record<string, any>;

  /** 轮询间隔（可选，毫秒，默认5000ms） */
  pollInterval?: number;

  /** 最大轮询时间（可选，毫秒，默认300000ms = 5分钟） */
  maxPollTime?: number;

  /** API基础URL（可选，默认使用环境变量或固定值） */
  baseUrl?: string;
}

/**
 * RunningHubProvider实现
 * 继承BaseProvider，自动获得重试、超时控制、日志等能力
 *
 * 艹，这个Provider遵循SOLID原则！
 */
export class RunningHubProvider extends BaseProvider {
  public readonly key = 'runninghub';
  public readonly name = 'RunningHub Workflow Provider';

  /** 默认轮询间隔（毫秒） */
  private readonly DEFAULT_POLL_INTERVAL = 5000;

  /** 默认最大轮询时间（毫秒） */
  private readonly DEFAULT_MAX_POLL_TIME = 300000;

  /**
   * 参数校验
   * 艹，这个方法必须严格校验所有参数！
   * @param input - 输入数据
   * @returns 校验错误信息，null表示校验通过
   */
  public validate(input: any): string | null {
    if (!input || typeof input !== 'object') {
      return '输入参数必须是对象';
    }

    const { workflowId, apiKey, params } = input as RunningHubInput;

    // 校验workflowId
    if (!workflowId || typeof workflowId !== 'string') {
      return '缺少或无效的workflowId字段';
    }

    // 校验apiKey
    if (!apiKey || typeof apiKey !== 'string') {
      return '缺少或无效的apiKey字段';
    }

    // 校验params
    if (!params || typeof params !== 'object') {
      return '缺少或无效的params字段';
    }

    // 校验轮询配置（可选）
    if (input.pollInterval !== undefined) {
      if (typeof input.pollInterval !== 'number' || input.pollInterval < 1000) {
        return 'pollInterval必须是数字且不小于1000ms';
      }
    }

    if (input.maxPollTime !== undefined) {
      if (typeof input.maxPollTime !== 'number' || input.maxPollTime < 10000) {
        return 'maxPollTime必须是数字且不小于10000ms';
      }
    }

    return null;
  }

  /**
   * 执行RunningHub工作流
   * 艹，这个方法才是真正干活的地方！
   * @param context - 执行上下文
   * @returns Promise<ExecResult> - 执行结果
   */
  protected async doExecute(context: ExecContext): Promise<ExecResult> {
    const input = context.input as RunningHubInput;
    const {
      workflowId,
      apiKey,
      params,
      pollInterval = this.DEFAULT_POLL_INTERVAL,
      maxPollTime = this.DEFAULT_MAX_POLL_TIME,
      baseUrl,
    } = input;

    try {
      this.logger.info(`[${this.key}] 准备执行RunningHub工作流`, {
        taskId: context.taskId,
        workflowId,
        pollInterval,
        maxPollTime,
      });

      // TODO: 实现RunningHub API调用
      //
      // 实现步骤：
      // 1. 触发工作流
      //    POST {baseUrl}/api/workflows/{workflowId}/trigger
      //    Headers: { 'Authorization': `Bearer ${apiKey}` }
      //    Body: { params }
      //
      // 2. 获取runId
      //    响应: { runId: string, status: 'running' }
      //
      // 3. 轮询状态（直到完成或超时）
      //    GET {baseUrl}/api/workflows/runs/{runId}/status
      //    响应: { status: 'running' | 'completed' | 'failed' }
      //
      // 4. 获取结果
      //    GET {baseUrl}/api/workflows/runs/{runId}/result
      //    响应: { result: any, error?: string }

      this.logger.warn(
        `[${this.key}] RunningHubProvider尚未实现，返回占位结果`,
        { taskId: context.taskId }
      );

      // 艹，占位实现（返回成功但提示未实现）
      return {
        success: true,
        data: {
          message: 'RunningHubProvider尚未实现，请先实现RunningHub API集成',
          workflowId,
          params,
          pollInterval,
          maxPollTime,
          // TODO: 实现后应该返回真实的工作流结果
          // 例如：runId, status, result, duration等
        },
      };
    } catch (error: any) {
      // 艹，RunningHub工作流失败了！
      this.logger.error(`[${this.key}] RunningHub工作流失败`, {
        taskId: context.taskId,
        workflowId,
        error: error.message,
      });

      return {
        success: false,
        error: {
          code: ProviderErrorCode.ERR_PROVIDER_EXECUTION_FAILED,
          message: `RunningHub工作流失败: ${error.message}`,
          details: {
            taskId: context.taskId,
            workflowId,
            originalError: error.message,
            stack: error.stack,
          },
        },
      };
    }
  }

  /**
   * 健康检查（可选）
   * 艹，这里可以检查RunningHub API是否可达
   * @returns Promise<boolean> - true表示健康
   */
  public async healthCheck(): Promise<boolean> {
    // TODO: 实现真正的健康检查（可选）
    // 例如：调用RunningHub的health端点
    // GET {baseUrl}/api/health
    return true;
  }
}

// 导出默认实例（兼容ProviderLoader）
export default RunningHubProvider;
