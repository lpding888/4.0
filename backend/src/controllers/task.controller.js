const taskService = require('../services/task.service');
const imageProcessService = require('../services/imageProcess.service');
const aiModelService = require('../services/aiModel.service');
const paginationService = require('../services/pagination.service');
const logger = require('../utils/logger');

/**
 * 任务控制器 - 处理AI处理任务相关请求
 */
class TaskController {
  /**
   * 基于功能卡片创建任务（新架构）
   * POST /api/task/create-by-feature
   */
  async createByFeature(req, res, next) {
    try {
      const { featureId, inputData } = req.body;
      const userId = req.user.id;

      // 参数验证
      if (!featureId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 4001,
            message: '缺少必要参数:featureId'
          }
        });
      }

      if (!inputData || typeof inputData !== 'object') {
        return res.status(400).json({
          success: false,
          error: {
            code: 4001,
            message: 'inputData必须是一个对象'
          }
        });
      }

      // 创建任务
      const task = await taskService.createByFeature(userId, featureId, inputData);

      logger.info(
        `[TaskController] Feature任务创建成功 taskId=${task.taskId} ` +
        `userId=${userId} featureId=${featureId}`
      );

      res.json({
        success: true,
        data: task
      });

    } catch (error) {
      logger.error(`[TaskController] 创建Feature任务失败: ${error.message}`, error);

      // 处理限流错误
      if (error.errorCode === 4029) {
        return res.status(429).json({
          success: false,
          error: {
            code: error.errorCode,
            message: error.message,
            rateLimitInfo: error.rateLimitInfo
          }
        });
      }

      // 处理其他业务错误
      if (error.errorCode) {
        return res.status(400).json({
          success: false,
          error: {
            code: error.errorCode,
            message: error.message
          }
        });
      }

      next(error);
    }
  }

  /**
   * 创建任务
   * POST /api/task/create
   */
  async create(req, res, next) {
    try {
      const { type, inputImageUrl, params } = req.body;
      const userId = req.user.id;

      // 参数验证
      if (!type || !inputImageUrl) {
        return res.status(400).json({
          success: false,
          error: {
            code: 4001,
            message: '缺少必要参数:type和inputImageUrl'
          }
        });
      }

      // 创建任务
      const task = await taskService.create(userId, type, inputImageUrl, params);

      logger.info(`[TaskController] 任务创建成功 taskId=${task.taskId} userId=${userId}`);

      // 如果是基础修图,立即开始处理
      if (type === 'basic_clean') {
        // 异步处理,不阻塞响应
        imageProcessService.processBasicClean(task.taskId, inputImageUrl, params)
          .catch(err => {
            logger.error(`[TaskController] 异步处理失败: ${err.message}`, { taskId: task.taskId });
          });
      }

      // 如果是AI模特,提交到RunningHub
      if (type === 'model_pose12') {
        aiModelService.createModelTask(task.taskId, inputImageUrl, params)
          .catch(err => {
            logger.error(`[TaskController] AI模特任务创建失败: ${err.message}`, { taskId: task.taskId });
          });
      }

      res.json({
        success: true,
        data: task
      });

    } catch (error) {
      logger.error(`[TaskController] 创建任务失败: ${error.message}`, error);
      
      if (error.errorCode) {
        return res.status(400).json({
          success: false,
          error: {
            code: error.errorCode,
            message: error.message
          }
        });
      }
      
      next(error);
    }
  }

  /**
   * 获取任务详情
   * GET /api/task/:taskId
   */
  async get(req, res, next) {
    try {
      const { taskId } = req.params;
      const userId = req.user.id;

      const task = await taskService.get(taskId, userId);

      res.json({
        success: true,
        data: task
      });

    } catch (error) {
      logger.error(`[TaskController] 获取任务失败: ${error.message}`, error);
      
      if (error.errorCode) {
        return res.status(error.errorCode === 4004 ? 404 : 403).json({
          success: false,
          error: {
            code: error.errorCode,
            message: error.message
          }
        });
      }
      
      next(error);
    }
  }

  /**
   * 获取用户任务列表（游标分页）
   * GET /api/task/list?cursor=xxx&limit=20&status=success&type=basic_clean
   */
  async list(req, res, next) {
    try {
      const userId = req.user.id;
      const { cursor, limit, status, type, pagination = 'cursor' } = req.query;

      // 构建过滤条件
      const filters = {};
      if (status) filters.status = status;
      if (type) filters.type = type;

      let result;

      if (pagination === 'offset') {
        // 传统分页（兼容性）
        const { page = 1 } = req.query;
        result = await paginationService.offsetPaginate({
          table: 'tasks',
          columns: ['id', 'userId', 'type', 'status', 'created_at', 'completed_at', 'resultUrls'],
          where: { userId, ...filters },
          orderBy: [
            { column: 'created_at', direction: 'desc' },
            { column: 'id', direction: 'desc' }
          ],
          page: parseInt(page),
          limit: limit ? parseInt(limit) : 20
        });
      } else {
        // 游标分页（推荐）
        result = await paginationService.getUserTasks(userId, {
          cursor,
          limit: limit ? parseInt(limit) : 20,
          where: filters
        });
      }

      res.json({
        success: true,
        data: result.data,
        pagination: result.pageInfo,
        paginationType: result.paginationType
      });

    } catch (error) {
      logger.error(`[TaskController] 获取任务列表失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 管理员获取任务列表
   * GET /api/admin/tasks?page=1&limit=20&status=success&userId=xxx
   */
  async adminList(req, res, next) {
    try {
      // 验证管理员权限
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: {
            code: 4003,
            message: '需要管理员权限'
          }
        });
      }

      const {
        page = 1,
        limit = 20,
        status,
        type,
        userId,
        startDate,
        endDate
      } = req.query;

      // 构建过滤条件
      const filters = {};
      if (status) filters.status = status;
      if (type) filters.type = type;
      if (userId) filters.userId = userId;

      // 日期范围过滤
      if (startDate || endDate) {
        const dateCondition = function() {
          if (startDate && endDate) {
            this.whereBetween('created_at', [startDate, endDate]);
          } else if (startDate) {
            this.where('created_at', '>=', startDate);
          } else if (endDate) {
            this.where('created_at', '<=', endDate);
          }
        };
        filters.created_at = dateCondition;
      }

      const result = await paginationService.getTaskList(filters, {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100) // 限制最大100条
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pageInfo
      });

    } catch (error) {
      logger.error(`[TaskController] 管理员获取任务列表失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 搜索任务
   * GET /api/admin/tasks/search?q=keyword&page=1&limit=20
   */
  async search(req, res, next) {
    try {
      // 验证管理员权限
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: {
            code: 4003,
            message: '需要管理员权限'
          }
        });
      }

      const {
        q: searchTerm,
        page = 1,
        limit = 20,
        status,
        type
      } = req.query;

      if (!searchTerm || searchTerm.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 4001,
            message: '搜索关键词不能为空'
          }
        });
      }

      // 构建过滤条件
      const filters = {};
      if (status) filters.status = status;
      if (type) filters.type = type;

      const result = await paginationService.searchTasks(searchTerm.trim(), {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100),
        where: filters
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pageInfo,
        searchTerm: searchTerm.trim()
      });

    } catch (error) {
      logger.error(`[TaskController] 任务搜索失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 获取数据库性能分析
   * GET /api/admin/db/performance?table=tasks&status=success
   */
  async getDbPerformance(req, res, next) {
    try {
      // 验证管理员权限
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: {
            code: 4003,
            message: '需要管理员权限'
          }
        });
      }

      const { table, status } = req.query;

      if (!table) {
        return res.status(400).json({
          success: false,
          error: {
            code: 4001,
            message: '缺少表名参数'
          }
        });
      }

      // 构建查询条件
      const where = {};
      if (status) where.status = status;

      // 分析查询性能
      const analysis = await paginationService.analyzeQuery(table, where, [
        { column: 'created_at', direction: 'desc' },
        { column: 'id', direction: 'desc' }
      ]);

      res.json({
        success: true,
        data: {
          table,
          query: analysis.sql,
          bindings: analysis.bindings,
          explain: analysis.explain
        }
      });

    } catch (error) {
      logger.error(`[TaskController] 获取数据库性能分析失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 更新任务状态(内部使用,或管理员使用)
   * PUT /api/task/:taskId/status
   */
  async updateStatus(req, res, next) {
    try {
      const { taskId } = req.params;
      const { status, resultUrls, errorMessage } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          error: {
            code: 4001,
            message: '缺少必要参数:status'
          }
        });
      }

      await taskService.updateStatus(taskId, status, {
        resultUrls,
        errorMessage
      });

      res.json({
        success: true,
        message: '任务状态更新成功'
      });

    } catch (error) {
      logger.error(`[TaskController] 更新任务状态失败: ${error.message}`, error);
      next(error);
    }
  }
}

module.exports = new TaskController();
