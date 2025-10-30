const express = require('express');
const router = express.Router();
const distributionController = require('../controllers/distribution.controller');
const { authenticate } = require('../middlewares/auth.middleware');

/**
 * 分销代理路由
 */

// 用户端接口（需要登录）
router.post('/apply', authenticate, distributionController.apply);
router.get('/status', authenticate, distributionController.getStatus);
router.get('/detail', authenticate, distributionController.getDetail); // 分销员详细信息
router.get('/dashboard', authenticate, distributionController.getDashboard);
router.get('/referrals', authenticate, distributionController.getReferrals);
router.get('/commissions', authenticate, distributionController.getCommissions);
router.get('/withdrawals', authenticate, distributionController.getWithdrawals);
router.post('/withdraw', authenticate, distributionController.createWithdrawal);

module.exports = router;
