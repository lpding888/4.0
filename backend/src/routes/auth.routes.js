const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');

/**
 * @route POST /api/auth/send-code
 * @desc 发送验证码
 * @access Public
 */
router.post('/send-code', authController.sendCode);

/**
 * @route POST /api/auth/login
 * @desc 登录/注册
 * @access Public
 */
router.post('/login', authController.login);

/**
 * @route GET /api/auth/me
 * @desc 获取当前用户信息
 * @access Private
 */
router.get('/me', authenticate, authController.getMe);

/**
 * @route POST /api/auth/refresh
 * @desc 刷新Token
 * @access Public
 */
router.post('/refresh', authController.refresh);

/**
 * @route POST /api/auth/logout
 * @desc 登出（撤销Token）
 * @access Private
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @route GET /api/auth/verify
 * @desc 验证Token状态
 * @access Private
 */
router.get('/verify', authenticate, authController.verify);

module.exports = router;
