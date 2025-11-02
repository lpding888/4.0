const taskService = require('../services/task.service');
const imageProcessService = require('../services/imageProcess.service');
const aiModelService = require('../services/aiModel.service');
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
   * 获取任务列表
   * GET /api/task/list?limit=10&offset=0&status=success&type=basic_clean
   */
  async list(req, res, next) {
    try {
      const userId = req.user.id;
      const { limit, offset, status, type } = req.query;

      const options = {
        limit: limit ? parseInt(limit) : 10,
        offset: offset ? parseInt(offset) : 0,
        status: status || null,
        type: type || null
      };

      const result = await taskService.list(userId, options);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error(`[TaskController] 获取任务列表失败: ${error.message}`, error);
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
