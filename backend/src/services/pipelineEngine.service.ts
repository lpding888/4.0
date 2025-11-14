import { db } from '../config/database.js';
import logger from '../utils/logger.js';
import quotaService from './quota.service.js';
import providerRegistryService from './provider-registry.service.js';

type StepRetryPolicy = {
  maxAttempts?: number;
  delayMs?: number;
  exponential?: boolean;
};

type PipelineStep = {
  type: string;
  provider_ref: string;
  timeout?: number;
  retry_policy?: StepRetryPolicy;
};

type StepConfig = {
  taskId: string;
  stepIndex: number;
  type: string;
  providerRef: string;
  timeout: number;
  retryPolicy: StepRetryPolicy;
};

type StepResult = {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
};

type ProviderExecutor = {
  execute: (input: Record<string, unknown>, taskId: string) => Promise<Record<string, unknown>>;
};

const FALLBACK_TIMEOUT = 30_000;

const normalizeProviderOutput = (result: unknown): Record<string, unknown> => {
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    return result as Record<string, unknown>;
  }
  return { result };
};

class PipelineEngine {
  async executePipeline(
    taskId: string,
    featureId: string,
    inputData: Record<string, unknown>
  ): Promise<void> {
    try {
      logger.info(`[PipelineEngine] 开始执行Pipeline taskId=${taskId} featureId=${featureId}`);

      const feature = await db('feature_definitions').where('feature_id', featureId).first();

      if (!feature || !feature.pipeline_schema_ref) {
        throw new Error('功能配置错误:缺少pipeline_schema_ref');
      }

      const pipelineSchema = await db('pipeline_schemas')
        .where('pipeline_id', feature.pipeline_schema_ref)
        .first();

      if (!pipelineSchema) {
        throw new Error(`Pipeline Schema不存在: ${feature.pipeline_schema_ref}`);
      }

      const steps = this.parseSteps(pipelineSchema.steps);
      if (steps.length === 0) {
        throw new Error('Pipeline Schema steps配置错误');
      }

      await db('tasks').where('id', taskId).update({
        status: 'processing',
        updated_at: new Date()
      });

      const taskSteps = steps.map((step, index) => ({
        task_id: taskId,
        step_index: index,
        type: step.type,
        provider_ref: step.provider_ref,
        status: 'pending',
        input: JSON.stringify(index === 0 ? inputData : {}),
        created_at: new Date()
      }));

      await db('task_steps').insert(taskSteps);
      logger.info(`[PipelineEngine] 创建${steps.length}个步骤记录 taskId=${taskId}`);

      let previousOutput: Record<string, unknown> = inputData;

      for (let i = 0; i < steps.length; i += 1) {
        const step = steps[i];
        const stepConfig: StepConfig = {
          taskId,
          stepIndex: i,
          type: step.type,
          providerRef: step.provider_ref,
          timeout: step.timeout ?? FALLBACK_TIMEOUT,
          retryPolicy: step.retry_policy ?? {}
        };

        logger.info(
          `[PipelineEngine] 执行步骤${i + 1}/${steps.length} ` +
            `taskId=${taskId} type=${step.type} provider=${step.provider_ref}`
        );

        const stepResult = await this.executeStep(stepConfig, previousOutput);
        if (!stepResult.success) {
          await this.handlePipelineFailure(taskId, featureId, i, stepResult.error ?? '未知错误');
          return;
        }

        previousOutput = stepResult.output ?? {};
      }

      await this.handlePipelineSuccess(taskId, previousOutput);
      logger.info(`[PipelineEngine] Pipeline执行成功 taskId=${taskId}`);
    } catch (error) {
      const err = error as Error;
      logger.error(`[PipelineEngine] Pipeline执行异常 taskId=${taskId} error=${err.message}`, {
        taskId,
        featureId,
        error: err
      });

      await this.handlePipelineFailure(taskId, featureId, -1, err.message);
    }
  }

  private parseSteps(schemaSteps?: string): PipelineStep[] {
    if (!schemaSteps) {
      return [];
    }

    try {
      const parsed = JSON.parse(schemaSteps) as PipelineStep[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      logger.error('[PipelineEngine] 解析Pipeline steps失败', error);
      return [];
    }
  }

  private async executeStep(
    stepConfig: StepConfig,
    input: Record<string, unknown>
  ): Promise<StepResult> {
    const { taskId, stepIndex, type, providerRef, timeout, retryPolicy } = stepConfig;
    const maxAttempts = Math.max(1, retryPolicy.maxAttempts ?? 1);

    await db('task_steps')
      .where({ task_id: taskId, step_index: stepIndex })
      .update({
        status: 'processing',
        input: JSON.stringify(input),
        started_at: new Date()
      });

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const provider = await this.getProvider(type, providerRef);
        const providerResult = await Promise.race([
          provider.execute(input, taskId),
          this.timeout(timeout, `步骤${stepIndex + 1}执行超时`)
        ]);

        const normalizedOutput =
          typeof providerResult === 'string' ? { result: providerResult } : providerResult;

        await db('task_steps')
          .where({ task_id: taskId, step_index: stepIndex })
          .update({
            status: 'success',
            output: JSON.stringify(normalizedOutput),
            completed_at: new Date(),
            updated_at: new Date(),
            retry_count: attempt - 1
          });

        return { success: true, output: normalizedOutput };
      } catch (error) {
        const err = error as Error;
        logger.error(
          `[PipelineEngine] 步骤执行失败 taskId=${taskId} step=${stepIndex} attempt=${attempt} error=${err.message}`
        );

        await db('task_steps').where({ task_id: taskId, step_index: stepIndex }).update({
          status: 'failed',
          error_message: err.message,
          updated_at: new Date(),
          retry_count: attempt
        });

        if (attempt >= maxAttempts) {
          return { success: false, error: err.message };
        }

        const delay = this.calculateRetryDelay(retryPolicy, attempt);
        if (delay > 0) {
          await this.sleep(delay);
        }
      }
    }

    return { success: false, error: '未知执行错误' };
  }

  private calculateRetryDelay(policy: StepRetryPolicy, attempt: number): number {
    const baseDelay = policy.delayMs ?? 2000;
    if (!policy.exponential) {
      return baseDelay;
    }

    return baseDelay * 2 ** (attempt - 1);
  }

  private async getProvider(type: string, providerRef: string): Promise<ProviderExecutor> {
    try {
      if (providerRegistryService.isProviderRegistered(type)) {
        logger.info(`[PipelineEngine] 使用注册的Provider type=${type}`);
        return {
          execute: async (input, taskId) => {
            const result = await providerRegistryService.execute(type, 'execute', [input, taskId]);
            return normalizeProviderOutput(result);
          }
        };
      }

      const providerMap: Record<string, string> = {
        SYNC_IMAGE_PROCESS: './providers/syncImageProcess.provider.js',
        RUNNINGHUB_WORKFLOW: './providers/runninghubWorkflow.provider.js',
        SCF_POST_PROCESS: './providers/scfPostProcess.provider.js'
      };

      const providerPath = providerMap[type];
      if (!providerPath) {
        throw new Error(`未知的Provider类型: ${type}`);
      }

      const providerModule = await import(providerPath);
      const ProviderClass = providerModule.default ?? providerModule;
      logger.info(`[PipelineEngine] 使用传统Provider type=${type} path=${providerPath}`);

      const providerInstance = new ProviderClass(providerRef);
      if (typeof providerInstance.execute !== 'function') {
        throw new Error(`Provider ${type} 不包含 execute 方法`);
      }

      return {
        execute: async (input, taskId) => {
          const result = await providerInstance.execute(input, taskId);
          return normalizeProviderOutput(result);
        }
      };
    } catch (error) {
      logger.error(`[PipelineEngine] Provider加载失败 type=${type} ref=${providerRef}`, error);
      throw new Error(`Provider加载失败: ${type}`);
    }
  }

  private async handlePipelineSuccess(
    taskId: string,
    finalOutput: Record<string, unknown>
  ): Promise<void> {
    try {
      const updateData: Record<string, unknown> = {
        status: 'success',
        artifacts: JSON.stringify(finalOutput),
        completed_at: new Date(),
        updated_at: new Date()
      };

      if (finalOutput.resultUrls) {
        updateData.resultUrls = JSON.stringify(finalOutput.resultUrls);
      }

      await db('tasks').where('id', taskId).update(updateData);

      try {
        await quotaService.confirm(taskId);
        logger.info(`[PipelineEngine] 配额确认成功 taskId=${taskId}`);
      } catch (error) {
        logger.error(`[PipelineEngine] 配额确认失败 taskId=${taskId}`, error);
      }

      logger.info(`[PipelineEngine] 任务成功完成 taskId=${taskId}`);
    } catch (error) {
      logger.error(`[PipelineEngine] 更新任务成功状态失败 taskId=${taskId}`, error);
    }
  }

  private async handlePipelineFailure(
    taskId: string,
    featureId: string,
    failedStepIndex: number,
    errorMessage: string
  ): Promise<void> {
    try {
      await db('tasks')
        .where('id', taskId)
        .update({
          status: 'failed',
          error_message: errorMessage,
          errorReason: `步骤${failedStepIndex + 1}执行失败`,
          completed_at: new Date(),
          updated_at: new Date()
        });

      try {
        await quotaService.cancel(taskId);
        logger.info(`[PipelineEngine] 配额退还成功 taskId=${taskId}`);
      } catch (error) {
        logger.error(`[PipelineEngine] 配额退还失败 taskId=${taskId}`, error);
      }

      logger.error(
        `[PipelineEngine] Pipeline执行失败 taskId=${taskId} featureId=${featureId} ` +
          `failedStep=${failedStepIndex} error=${errorMessage}`
      );
    } catch (error) {
      logger.error(`[PipelineEngine] 处理Pipeline失败异常 taskId=${taskId}`, error);
    }
  }

  private timeout(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

const pipelineEngine = new PipelineEngine();

export default pipelineEngine;
