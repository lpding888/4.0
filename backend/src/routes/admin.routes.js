const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const assetController = require('../controllers/asset.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireAdmin } = require('../middlewares/adminAuth.middleware');

/**
 * 管理后台路由
 * 所有路由都需要 admin 角色权限
 */

// 系统概览
router.get('/overview', authenticate, requireAdmin, adminController.getOverview);

// 用户管理
router.get('/users', authenticate, requireAdmin, adminController.getUsers);

// 任务管理
router.get('/tasks', authenticate, requireAdmin, adminController.getTasks);

// 失败任务列表
router.get('/failed-tasks', authenticate, requireAdmin, adminController.getFailedTasks);

// ========== 功能卡片管理 ==========

// 获取所有功能卡片（包括禁用的）
router.get('/features', authenticate, requireAdmin, adminController.getFeatures);

// 创建新功能卡片
router.post('/features', authenticate, requireAdmin, adminController.createFeature);

// 更新功能卡片
router.put('/features/:featureId', authenticate, requireAdmin, adminController.updateFeature);

// 快速切换功能启用状态
router.patch('/features/:featureId', authenticate, requireAdmin, adminController.toggleFeature);

// 软删除功能卡片
router.delete('/features/:featureId', authenticate, requireAdmin, adminController.deleteFeature);

// ========== 素材库管理 ==========

// 管理员查看所有用户素材
router.get('/assets', authenticate, requireAdmin, assetController.getAllAssets);

// ========== 分销代理管理 ==========

// 分销员列表
router.get('/distributors', authenticate, requireAdmin, adminController.getDistributors);

// 分销员详细信息
router.get('/distributors/:id', authenticate, requireAdmin, adminController.getDistributorDetail);

// 分销员推广用户列表
router.get('/distributors/:id/referrals', authenticate, requireAdmin, adminController.getDistributorReferrals);

// 分销员佣金记录
router.get('/distributors/:id/commissions', authenticate, requireAdmin, adminController.getDistributorCommissions);

// 审核分销员申请
router.patch('/distributors/:id/approve', authenticate, requireAdmin, adminController.approveDistributor);

// 禁用分销员
router.patch('/distributors/:id/disable', authenticate, requireAdmin, adminController.disableDistributor);

// 提现申请列表
router.get('/withdrawals', authenticate, requireAdmin, adminController.getWithdrawals);

// 审核通过提现
router.patch('/withdrawals/:id/approve', authenticate, requireAdmin, adminController.approveWithdrawal);

// 拒绝提现
router.patch('/withdrawals/:id/reject', authenticate, requireAdmin, adminController.rejectWithdrawal);

// 分销数据统计
router.get('/distribution/stats', authenticate, requireAdmin, adminController.getDistributionStats);

// 获取佣金设置
router.get('/distribution/settings', authenticate, requireAdmin, adminController.getDistributionSettings);

// 更新佣金设置
router.put('/distribution/settings', authenticate, requireAdmin, adminController.updateDistributionSettings);

module.exports = router;
