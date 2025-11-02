const express = require('express');
const router = express.Router();
const scfCallbackController = require('../controllers/scfCallback.controller');

/**
 * SCF Callback Routes - 云函数回调路由
 * 用于接收来自腾讯云SCF的回调通知
 *
 * 注意:这个接口不需要登录认证,但需要HMAC签名验证
 */

// POST /api/scf/callback - 处理SCF回调
router.post('/callback', scfCallbackController.handleCallback);

module.exports = router;
