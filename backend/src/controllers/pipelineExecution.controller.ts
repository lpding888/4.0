import type { Request, Response, NextFunction } from 'express';
import pipelineExecutionService from '../services/pipelineExecution.service.js';
import logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES } from '../config/error-codes.js';
import type { ExecutionMode, ExecutionStatus, PipelineExecution } from '../engine/pipeline-types.js';

interface CreateExecutionBody {
  schema_id: string;
  input_data?: Record<string, unknown>;
  mode?: string;
}

interface GetExecutionOptionsQuery {
  schema_id?: string;
  status?: string;
  mode?: string;
  page?: string;
  limit?: string;
  offset?: string;
}

interface ExecutionEventData {
  execution_id: string;
  event: string;
  [key: string]: unknown;
}

interface BatchOperateBody {
  execution_ids: string[];
  operation: 'cancel' | 'start' | string;
}

interface BatchOperateResult {
  execution_id: string;
  success: boolean;
  operation?: string;
  error?: string;
}

interface ExecutionItem {
  status: string;
  execution_mode: string;
  duration_ms?: number;
}

interface ExecutionStats {
  total_executions: number;
  by_status: Record<string, number>;
  by_mode: Record<string, number>;
  average_duration: number;
  success_rate: number;
}

interface CleanupBody {
  max_age?: string | number;
}

const parseExecutionMode = (value: unknown, fallback: ExecutionMode = 'mock'): ExecutionMode => {
  if (value === 'real') return 'real';
  return fallback;
};

const parseExecutionStatus = (value: unknown): ExecutionStatus | undefined => {
  if (
    value === 'pending' ||
    value === 'running' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'cancelled'
  ) {
    return value;
  }
  return undefined;
};

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

class PipelineExecutionController {
  async createExecution(req: Request, res: Response, next: NextFunction) {
    try {
      const { schema_id, input_data, mode = 'mock' } = req.body as unknown as CreateExecutionBody;
      const userId = req.user?.id as string;
      if (!schema_id) {
        throw AppError.custom(ERROR_CODES.MISSING_PARAMETERS, '缺少流程模板ID');
      }
      const executionMode = parseExecutionMode(mode);
      const execution = await pipelineExecutionService.createExecution(
        schema_id,
        input_data || {},
        executionMode,
        userId
      );
      res.status(201).json({
        success: true,
        data: execution,
        message: '执行任务创建成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error('[PipelineExecutionController] Create execution failed:', error);
      next(error);
    }
  }

  async startExecution(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      // 异步启动
      pipelineExecutionService.startExecution(id).catch((error: unknown) => {
        logger.error('[PipelineExecutionController] Async start execution failed:', error);
      });
      res.json({
        success: true,
        message: '执行已启动',
        data: { execution_id: id },
        requestId: req.id
      });
    } catch (error) {
      logger.error('[PipelineExecutionController] Start execution failed:', error);
      next(error);
    }
  }

  async createAndStartExecution(req: Request, res: Response, next: NextFunction) {
    try {
      const { schema_id, input_data, mode = 'mock' } = req.body as unknown as CreateExecutionBody;
      const userId = req.user?.id as string;
      if (!schema_id) {
        throw AppError.custom(ERROR_CODES.MISSING_PARAMETERS, '缺少流程模板ID');
      }
      const executionMode = parseExecutionMode(mode);
      const execution = await pipelineExecutionService.createExecution(
        schema_id,
        input_data || {},
        executionMode,
        userId
      );
      pipelineExecutionService.startExecution(execution.id).catch((error: unknown) => {
        logger.error('[PipelineExecutionController] Async start execution failed:', error);
      });
      res.status(201).json({
        success: true,
        data: execution,
        message: '执行任务创建并启动成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error('[PipelineExecutionController] Create and start execution failed:', error);
      next(error);
    }
  }

  async getExecution(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      const execution = pipelineExecutionService.getExecution(id);
      res.json({ success: true, data: execution, requestId: req.id });
    } catch (error) {
      logger.error('[PipelineExecutionController] Get execution failed:', error);
      next(error);
    }
  }

  async getExecutions(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        schema_id,
        status,
        mode,
        page = '1',
        limit = '20',
        offset = '0'
      } = req.query as unknown as GetExecutionOptionsQuery;
      const options = {
        schema_id,
        status: parseExecutionStatus(status),
        mode: mode ? parseExecutionMode(mode, 'mock') : undefined,
        limit: toInt(limit, 20),
        offset: toInt(offset, 0)
      };
      const result = pipelineExecutionService.getExecutions(options);
      res.json({ success: true, data: result, requestId: req.id });
    } catch (error) {
      logger.error('[PipelineExecutionController] Get executions failed:', error);
      next(error);
    }
  }

  async cancelExecution(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      const { reason } = req.body as { reason?: string };
      await pipelineExecutionService.cancelExecution(id, reason || '用户取消');
      res.json({ success: true, message: '执行已取消', requestId: req.id });
    } catch (error) {
      logger.error('[PipelineExecutionController] Cancel execution failed:', error);
      next(error);
    }
  }

  async getExecutionEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params as { id: string };
      try {
        pipelineExecutionService.getExecution(id);
      } catch (error) {
        throw AppError.custom(ERROR_CODES.TASK_NOT_FOUND, '执行任务不存在');
      }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });
      res.write(
        `event: connected\ndata: ${JSON.stringify({
          type: 'connected',
          execution_id: id,
          timestamp: new Date().toISOString()
        })}\n\n`
      );
      const onEvent = (data: ExecutionEventData) => {
        if (!data || data.execution_id !== id) return;
        res.write(`event: ${data.event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };
      pipelineExecutionService.on('execution:event', onEvent);
      req.on('close', () => {
        pipelineExecutionService.off('execution:event', onEvent);
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      const appError = error as { statusCode?: number; message?: string };
      if (appError?.statusCode === 404) {
        res.write(
          `event: error\ndata: ${JSON.stringify({
            type: 'error',
            error: appError.message || err.message,
            timestamp: new Date().toISOString()
          })}\n\n`
        );
        res.end();
      } else {
        next(error);
      }
    }
  }

  async batchOperateExecutions(req: Request, res: Response, next: NextFunction) {
    try {
      const { execution_ids, operation } = req.body as unknown as BatchOperateBody;
      const userId = req.user?.id as string; // reserved
      if (!execution_ids || !Array.isArray(execution_ids)) {
        throw AppError.custom(ERROR_CODES.MISSING_PARAMETERS, '请提供执行ID列表');
      }
      if (!operation) {
        throw AppError.custom(ERROR_CODES.MISSING_PARAMETERS, '请指定操作类型');
      }
      const results: BatchOperateResult[] = [];
      let success_count = 0;
      let failed_count = 0;
      for (const executionId of execution_ids) {
        try {
          switch (operation) {
            case 'cancel':
              await pipelineExecutionService.cancelExecution(executionId);
              results.push({ execution_id: executionId, success: true, operation: 'cancelled' });
              success_count++;
              break;
            case 'start':
              await pipelineExecutionService.startExecution(executionId);
              results.push({ execution_id: executionId, success: true, operation: 'started' });
              success_count++;
              break;
            default:
              results.push({
                execution_id: executionId,
                success: false,
                error: `不支持的操作: ${operation}`
              });
              failed_count++;
          }
        } catch (e: unknown) {
          const error = e instanceof Error ? e : new Error(String(e));
          results.push({ execution_id: executionId, success: false, error: error.message });
          failed_count++;
        }
      }
      res.json({
        success: true,
        data: {
          results,
          summary: { total: execution_ids.length, success: success_count, failed: failed_count }
        },
        message: `批量操作完成: ${success_count} 成功, ${failed_count} 失败`,
        requestId: req.id
      });
    } catch (error) {
      logger.error('[PipelineExecutionController] Batch operate executions failed:', error);
      next(error);
    }
  }

  async getExecutionStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { schema_id } = req.query as unknown as { schema_id?: string };
      const options = { schema_id };
      const executions = pipelineExecutionService.getExecutions({
        ...options,
        limit: 1000
      });
      const stats: ExecutionStats = {
        total_executions: (executions.executions as ExecutionItem[]).length,
        by_status: {},
        by_mode: {},
        average_duration: 0,
        success_rate: 0
      };
      let total_duration = 0;
      let completed_count = 0;
      for (const execution of executions.executions as ExecutionItem[]) {
        stats.by_status[execution.status] = (stats.by_status[execution.status] || 0) + 1;
        stats.by_mode[execution.execution_mode] =
          (stats.by_mode[execution.execution_mode] || 0) + 1;
        if (execution.duration_ms) {
          total_duration += execution.duration_ms;
          completed_count++;
        }
      }
      if (completed_count > 0) {
        stats.average_duration = Math.round(total_duration / completed_count);
      }
      const completed = stats.by_status.completed || 0;
      const failed = stats.by_status.failed || 0;
      const total_completed = completed + failed;
      if (total_completed > 0) {
        stats.success_rate = Math.round((completed / total_completed) * 100);
      }
      res.json({ success: true, data: stats, requestId: req.id });
    } catch (error) {
      logger.error('[PipelineExecutionController] Get execution stats failed:', error);
      next(error);
    }
  }

  async cleanupExecutions(req: Request, res: Response, next: NextFunction) {
    try {
      const { max_age } = req.body as unknown as CleanupBody;
      const maxAgeMs = max_age ? parseInt(String(max_age)) * 1000 : 24 * 60 * 60 * 1000;
      const cleanedCount = pipelineExecutionService.cleanupExpiredExecutions(maxAgeMs);
      res.json({
        success: true,
        data: { cleaned_count: cleanedCount },
        message: `已清理 ${cleanedCount} 个过期执行记录`,
        requestId: req.id
      });
    } catch (error) {
      logger.error('[PipelineExecutionController] Cleanup executions failed:', error);
      next(error);
    }
  }

  async healthCheck(req: Request, res: Response, next: NextFunction) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'pipeline-execution',
        active_executions: pipelineExecutionService.getActiveExecutionCount(),
        memory_usage: process.memoryUsage(),
        uptime: process.uptime()
      };
      res.json({ success: true, data: health, requestId: req.id });
    } catch (error) {
      logger.error('[PipelineExecutionController] Health check failed:', error);
      next(error);
    }
  }
}

export default new PipelineExecutionController();
