const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const enhancedErrorHandler = require('../middlewares/enhanced-error-handler.middleware');
const { ERROR_CODES } = require('../config/error-codes');

const router = express.Router();

/**
 * 错误管理API路由
 *
 * 提供错误统计、监控和管理功能：
 * - 错误统计查询
 * - 错误分析报告
 * - 错误配置管理
 * - 错误通知设置
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ErrorStats:
 *       type: object
 *       properties:
 *         totalErrors:
 *           type: integer
 *           description: 总错误数
 *         byCategory:
 *           type: object
 *           description: 按分类统计
 *         bySeverity:
 *           type: object
 *           description: 按严重程度统计
 *         criticalErrors:
 *           type: integer
 *           description: 严重错误数量
 *         topErrors:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               code:
 *                 type: integer
 *               category:
 *                 type: string
 *               severity:
 *                 type: string
 *               count:
 *                 type: integer
 *               lastOccurrence:
 *                 type: integer
 */

/**
 * @swagger
 * /api/admin/errors/stats:
 *   get:
 *     tags:
 *       - 错误管理
 *     summary: 获取错误统计信息
 *     description: 获取系统错误统计和分析数据
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 统计信息获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ErrorStats'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: 未授权访问
 *       403:
 *         description: 权限不足
 */
router.get('/stats',
  authMiddleware.authenticate,
  authMiddleware.requireRole(['admin']),
  (req, res) => {
    try {
      const stats = enhancedErrorHandler.getErrorStats();

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      req.i18n && req.i18n.locale && req.i18n.getErrorMessage
        ? res.status(500).json({
            success: false,
            error: {
              code: ERROR_CODES.INTERNAL_SERVER_ERROR,
              message: req.i18n.getErrorMessage(ERROR_CODES.INTERNAL_SERVER_ERROR),
              timestamp: new Date().toISOString()
            }
          })
        : res.status(500).json({
            success: false,
            error: {
              code: ERROR_CODES.INTERNAL_SERVER_ERROR,
              message: 'Failed to get error statistics',
              timestamp: new Date().toISOString()
            }
          });
    }
  }
);

/**
 * @swagger
 * /api/admin/errors/codes:
 *   get:
 *     tags:
 *       - 错误管理
 *     summary: 获取所有错误码列表
 *     description: 获取系统中定义的所有错误码及其分类
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 错误码列表获取成功
 */
router.get('/codes',
  authMiddleware.authenticate,
  authMiddleware.requireRole(['admin']),
  (req, res) => {
    try {
      const { ERROR_CATEGORIES, ERROR_SEVERITY, ERROR_METADATA } = require('../config/error-codes');

      const errorCodesList = Object.entries(ERROR_CODES)
        .filter(([key]) => !isNaN(key)) // 只保留数字键
        .map(([name, code]) => ({
          name,
          code,
          category: ERROR_METADATA[code]?.category || 'unknown',
          severity: ERROR_METADATA[code]?.severity || 'medium'
        }))
        .sort((a, b) => a.code - b.code);

      res.json({
        success: true,
        data: {
          categories: ERROR_CATEGORIES,
          severity: ERROR_SEVERITY,
          codes: errorCodesList
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const AppError = require('../utils/AppError');
      const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
      res.status(appError.statusCode).json(appError.toJSON(req.i18n?.locale));
    }
  }
);

/**
 * @swagger
 * /api/admin/errors/reset-stats:
 *   post:
 *     tags:
 *       - 错误管理
 *     summary: 重置错误统计
 *     description: 清空所有错误统计数据
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 统计数据重置成功
 */
router.post('/reset-stats',
  authMiddleware.authenticate,
  authMiddleware.requireRole(['admin']),
  (req, res) => {
    try {
      enhancedErrorHandler.resetStats();

      res.json({
        success: true,
        message: req.i18n ? req.i18n.getMessage('error.stats_reset') : 'Error statistics reset successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const AppError = require('../utils/AppError');
      const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
      res.status(appError.statusCode).json(appError.toJSON(req.i18n?.locale));
    }
  }
);

/**
 * @swagger
 * /api/admin/errors/test:
 *   post:
 *     tags:
 *       - 错误管理
 *     summary: 测试错误处理
 *     description: 生成测试错误以验证错误处理机制
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: integer
 *                 description: 错误码
 *               message:
 *                 type: string
 *                 description: 自定义错误消息
 *               context:
 *                 type: object
 *                 description: 错误上下文
 *     responses:
 *       200:
 *         description: 测试错误处理成功
 *       400:
 *         description: 请求参数无效
 */
router.post('/test',
  authMiddleware.authenticate,
  authMiddleware.requireRole(['admin']),
  (req, res, next) => {
    try {
      const { code, message, context = {} } = req.body;

      if (!code || typeof code !== 'number') {
        const AppError = require('../utils/AppError');
        const error = AppError.create(ERROR_CODES.INVALID_PARAMETERS, {
          field: 'code',
          reason: 'Code must be a valid error code number'
        });
        return res.status(error.statusCode).json(error.toJSON(req.i18n?.locale));
      }

      const AppError = require('../utils/AppError');
      const testError = AppError.custom(code, message, {
        ...context,
        testMode: true,
        requestedBy: req.user.id,
        timestamp: new Date().toISOString()
      });

      // 触发错误处理
      next(testError);

    } catch (error) {
      const AppError = require('../utils/AppError');
      const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
      next(appError);
    }
  }
);

/**
 * @swagger
 * /api/admin/errors/export:
 *   get:
 *     tags:
 *       - 错误管理
 *     summary: 导出错误数据
 *     description: 导出错误统计数据为CSV格式
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 导出成功
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get('/export',
  authMiddleware.authenticate,
  authMiddleware.requireRole(['admin']),
  (req, res) => {
    try {
      const stats = enhancedErrorHandler.getErrorStats();
      const { ERROR_CATEGORIES } = require('../config/error-codes');

      // 生成CSV数据
      const csvHeaders = ['Code', 'Category', 'Severity', 'Count', 'Last Occurrence', 'Message'];
      const csvRows = stats.topErrors.map(error => [
        error.code,
        error.category,
        error.severity,
        error.count,
        new Date(error.lastOccurrence).toISOString(),
        '' // 消息留空，因为示例消息可能包含敏感信息
      ]);

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="error-stats-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);

    } catch (error) {
      const AppError = require('../utils/AppError');
      const appError = AppError.fromError(error, ERROR_CODES.INTERNAL_SERVER_ERROR);
      res.status(appError.statusCode).json(appError.toJSON(req.i18n?.locale));
    }
  }
);

module.exports = router;