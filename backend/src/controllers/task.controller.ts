import type { Request, Response, NextFunction } from 'express';
import taskService from '../services/task.service.js';
import imageProcessService from '../services/imageProcess.service.js';
import aiModelService from '../services/aiModel.service.js';
import paginationService, { type TaskFilters } from '../services/pagination.service.js';
import logger from '../utils/logger.js';
import type {
  CreateFeatureTaskRequest,
  CreateTaskRequest,
  UpdateTaskStatusRequest,
  AdminTaskQuery,
  TaskSearchQuery,
  DbPerformanceQuery,
  TaskError,
  TaskCreateResult
} from '../types/task.types.js';

class TaskController {
  async createByFeature(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { featureId, inputData } = (req.body ?? {}) as CreateFeatureTaskRequest;
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: 4003, message: '未授权操作' } });
        return;
      }
      if (!featureId) {
        res
          .status(400)
          .json({ success: false, error: { code: 4001, message: '缺少必要参数:featureId' } });
        return;
      }
      if (!inputData || typeof inputData !== 'object') {
        res
          .status(400)
          .json({ success: false, error: { code: 4001, message: 'inputData必须是一个对象' } });
        return;
      }
      const task: TaskCreateResult = await taskService.createByFeature(userId, featureId, inputData);
      logger.info(
        `[TaskController] Feature任务创建成功 taskId=${task.taskId} userId=${userId} featureId=${featureId}`
      );
      res.json({ success: true, data: task });
    } catch (error) {
      const err = error as TaskError;
      logger.error(
        `[TaskController] 创建Feature任务失败: ${err.message || String(error)}`,
        error
      );
      if (err?.errorCode === 4029) {
        res.status(429).json({
          success: false,
          error: { code: err.errorCode, message: err.message, rateLimitInfo: err.rateLimitInfo }
        });
        return;
      }
      if (err?.errorCode) {
        res.status(400).json({ success: false, error: { code: err.errorCode, message: err.message } });
        return;
      }
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type, inputImageUrl, params } = (req.body ?? {}) as CreateTaskRequest;
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: 4003, message: '未授权操作' } });
        return;
      }
      if (!type || !inputImageUrl) {
        res.status(400).json({
          success: false,
          error: { code: 4001, message: '缺少必要参数:type和inputImageUrl' }
        });
        return;
      }
      const task: TaskCreateResult = await taskService.create(userId, type, inputImageUrl, params);
      logger.info(`[TaskController] 任务创建成功 taskId=${task.taskId} userId=${userId}`);
      if (type === 'basic_clean') {
        imageProcessService
          .processBasicClean(task.taskId, inputImageUrl, params)
          .catch((err: Error) => {
            logger.error(`[TaskController] 异步处理失败: ${err.message}`, {
              taskId: task.taskId
            });
          });
      }
      if (type === 'model_pose12') {
        aiModelService
          .createModelTask(task.taskId, inputImageUrl, params)
          .catch((err: Error) => {
            logger.error(`[TaskController] AI模特任务创建失败: ${err.message}`, {
              taskId: task.taskId
            });
          });
      }
      res.json({ success: true, data: task });
    } catch (error) {
      const err = error as Error;
      logger.error(`[TaskController] 创建任务失败: ${err.message}`, error);
      next(error);
    }
  }

  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { taskId } = req.params as { taskId: string };
      const task = await taskService.get(taskId);
      res.json({ success: true, data: task });
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: 4003, message: '未授权操作' } });
        return;
      }
      const result = await taskService.list(userId, req.query as Record<string, string>);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { taskId } = req.params as { taskId: string };
      const { status, resultUrls, errorMessage } = (req.body ?? {}) as UpdateTaskStatusRequest;
      if (!status) {
        res
          .status(400)
          .json({ success: false, error: { code: 4001, message: '缺少必要参数:status' } });
        return;
      }
      await taskService.updateStatus(taskId, status, { resultUrls, errorMessage });
      res.json({ success: true, message: '任务状态更新成功' });
    } catch (error) {
      const err = error as Error;
      logger.error(`[TaskController] 更新任务状态失败: ${err.message}`, error);
      next(error);
    }
  }

  async adminList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userRole = req.user?.role;
      if (userRole !== 'admin') {
        res.status(403).json({ success: false, error: { code: 4003, message: '需要管理员权限' } });
        return;
      }
      const {
        page = '1',
        limit = '20',
        status,
        type,
        userId,
        startDate,
        endDate
      } = req.query as AdminTaskQuery;
      const filters: TaskFilters = {};
      if (status) filters.status = status;
      if (type) filters.type = type;
      if (userId) filters.userId = userId;
      if (startDate || endDate) {
        filters.createdRange = {
          start: startDate ? String(startDate) : undefined,
          end: endDate ? String(endDate) : undefined
        };
      }
      const result = await paginationService.getTaskList(filters, {
        page: Number(page),
        limit: Math.min(Number(limit), 100)
      });
      res.json({ success: true, data: result.data, pagination: result.pageInfo });
    } catch (error) {
      const err = error as Error;
      logger.error(
        `[TaskController] 管理员获取任务列表失败: ${err.message}`,
        error
      );
      next(error);
    }
  }

  async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userRole = req.user?.role;
      if (userRole !== 'admin') {
        res.status(403).json({ success: false, error: { code: 4003, message: '需要管理员权限' } });
        return;
      }
      const { q: searchTerm, page = '1', limit = '20', status, type } = req.query as TaskSearchQuery;
      if (!searchTerm || String(searchTerm).trim().length === 0) {
        res
          .status(400)
          .json({ success: false, error: { code: 4001, message: '搜索关键词不能为空' } });
        return;
      }
      const filters: TaskFilters = {};
      if (status) filters.status = status;
      if (type) filters.type = type;
      const result = await paginationService.searchTasks(String(searchTerm).trim(), {
        page: Number(page),
        limit: Math.min(Number(limit), 100),
        where: filters
      });
      res.json({
        success: true,
        data: result.data,
        pagination: result.pageInfo,
        searchTerm: String(searchTerm).trim()
      });
    } catch (error) {
      const err = error as Error;
      logger.error(`[TaskController] 任务搜索失败: ${err.message}`, error);
      next(error);
    }
  }

  async getDbPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userRole = req.user?.role;
      if (userRole !== 'admin') {
        res.status(403).json({ success: false, error: { code: 4003, message: '需要管理员权限' } });
        return;
      }
      const { table, status } = req.query as DbPerformanceQuery;
      if (!table) {
        res.status(400).json({ success: false, error: { code: 4001, message: '缺少表名参数' } });
        return;
      }
      const where: Record<string, string> = {};
      if (status) where.status = status;
      const analysis = await paginationService.analyzeQuery(table, where, [
        { column: 'created_at', direction: 'desc' },
        { column: 'id', direction: 'desc' }
      ]);
      res.json({
        success: true,
        data: { table, query: analysis.sql, bindings: analysis.bindings, explain: analysis.explain }
      });
    } catch (error) {
      const err = error as Error;
      logger.error(
        `[TaskController] 获取数据库性能分析失败: ${err.message}`,
        error
      );
      next(error);
    }
  }
}

export default new TaskController();
