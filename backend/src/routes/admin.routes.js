const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const assetController = require('../controllers/asset.controller');
const { authenticate, requireAdmin } = require('../middlewares/auth.middleware'); // P0-009: 统一认证中间件
const websocketService = require('../services/websocket.service'); // P1-011: WebSocket服务

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

// ========== WebSocket状态监控 (P1-011) ==========

// 获取WebSocket服务状态
router.get('/websocket/status', authenticate, requireAdmin, (req, res) => {
  try {
    const status = websocketService.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取WebSocket状态失败',
      error: error.message
    });
  }
});

// 检查用户在线状态
router.get('/websocket/user/:userId/online', authenticate, requireAdmin, (req, res) => {
  try {
    const { userId } = req.params;
    const isOnline = websocketService.isUserOnline(parseInt(userId));
    res.json({
      success: true,
      data: {
        userId: parseInt(userId),
        isOnline
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '检查用户在线状态失败',
      error: error.message
    });
  }
});

// 发送系统广播消息
router.post('/websocket/broadcast', authenticate, requireAdmin, (req, res) => {
  try {
    const { title, content, type = 'info' } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: '消息内容不能为空'
      });
    }

    websocketService.broadcastSystemMessage({
      title: title || '系统通知',
      content,
      type
    });

    res.json({
      success: true,
      message: '系统消息已广播'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '广播系统消息失败',
      error: error.message
    });
  }
});

module.exports = router;
