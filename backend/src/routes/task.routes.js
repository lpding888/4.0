const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');
const { authenticate, requireRole } = require('../middlewares/auth.middleware');

/**
 * 任务路由 - 处理AI处理任务相关请求
 * 所有接口都需要登录
 */

// 基于功能卡片创建任务（新架构）
router.post('/create-by-feature', authenticate, taskController.createByFeature);

// 创建任务（旧接口，保留兼容性）
router.post('/create', authenticate, taskController.create);

// 获取任务详情
router.get('/:taskId', authenticate, taskController.get);

// 获取任务列表（支持游标分页和传统分页）
router.get('/list', authenticate, taskController.list);

// 更新任务状态(内部使用)
router.put('/:taskId/status', authenticate, taskController.updateStatus);

// ========== 管理员路由 ==========

// 管理员获取任务列表
router.get('/admin/tasks', authenticate, requireRole('admin'), taskController.adminList);

// 搜索任务
router.get('/admin/tasks/search', authenticate, requireRole('admin'), taskController.search);

// 获取数据库性能分析
router.get('/admin/db/performance', authenticate, requireRole('admin'), taskController.getDbPerformance);

module.exports = router;
