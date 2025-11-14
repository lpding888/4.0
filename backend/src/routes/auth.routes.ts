/**
 * Auth Routes
 * 艹，认证相关路由！登录、注册、刷新、登出！
 */

import { Router } from 'express';
import authController from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * 用户注册
 * POST /api/auth/register
 */
router.post('/register', authController.register.bind(authController));
router.post('/email/register', authController.registerWithEmail.bind(authController));

/**
 * 用户登录
 * POST /api/auth/login
 */
router.post('/login', authController.loginCode.bind(authController));
router.post('/login/password', authController.loginPassword.bind(authController));
router.post('/email/login', authController.loginWithEmailCode.bind(authController));

/**
 * 刷新Token
 * POST /api/auth/refresh
 */
router.post('/refresh', authController.refresh.bind(authController));

/**
 * 用户登出
 * POST /api/auth/logout
 */
router.post('/logout', authenticate, authController.logout.bind(authController));
// 发送验证码
router.post('/send-code', authController.sendCode.bind(authController));
router.post('/email/send-code', authController.sendEmailCode.bind(authController));

// 发送邮箱验证码
router.post('/send-email-code', authController.sendEmailCode.bind(authController));

// 邮箱验证码登录
router.post('/login/email', authController.loginEmail.bind(authController));

// 获取当前登录用户
router.get('/me', authenticate, authController.getMe.bind(authController));

// 验证 Token
router.get('/verify', authenticate, authController.verify.bind(authController));

// 设置/修改密码
router.post('/set-password', authenticate, authController.setPassword.bind(authController));

// 重置密码（忘记密码）
router.post('/reset-password', authController.resetPassword.bind(authController));
router.post('/email/reset-password', authController.resetPassword.bind(authController));

export default router;
