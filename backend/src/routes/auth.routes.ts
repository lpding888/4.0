/**
 * Auth Routes
 * 艹，认证相关路由！登录、注册、刷新、登出！
 */

import { Router } from 'express';
import authController from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { rateLimit as securityRateLimit } from '../middlewares/security.middleware.js';

const router = Router();

// 登录/注册限流（按手机号/邮箱+IP）
const authRateLimiter = securityRateLimit({
  windowMs: 60 * 1000,
  maxRequests: 20,
  keyGenerator: (req) => {
    const body = (req.body || {}) as { phone?: string; email?: string };
    const ip = (req.ip || (req.socket?.remoteAddress as string | undefined) || '') as string;
    const identity = body.phone || body.email;
    // 这个SB限流优先按手机号/邮箱，其次按IP，避免某个IP爆刷
    return identity ? `auth:login:${identity}` : `auth:login:ip:${ip}`;
  }
});

// 验证码发送限流（额外的IP级保护，配合DB内的防刷逻辑）
const sendCodeRateLimiter = securityRateLimit({
  windowMs: 60 * 1000,
  maxRequests: 60,
  keyGenerator: (req) => {
    const ip = (req.ip || (req.socket?.remoteAddress as string | undefined) || '') as string;
    return `auth:send-code:ip:${ip}`;
  }
});

/**
 * 用户注册
 * POST /api/auth/register
 */
router.post('/register', authRateLimiter, authController.register.bind(authController));
router.post(
  '/email/register',
  authRateLimiter,
  authController.registerWithEmail.bind(authController)
);

/**
 * 用户登录
 * POST /api/auth/login
 */
router.post('/login', authRateLimiter, authController.loginCode.bind(authController));
router.post('/login/password', authRateLimiter, authController.loginPassword.bind(authController));
router.post(
  '/email/login',
  authRateLimiter,
  authController.loginWithEmailCode.bind(authController)
);

/**
 * 刷新Token
 * POST /api/auth/refresh
 */
router.post('/refresh', authRateLimiter, authController.refresh.bind(authController));

/**
 * 用户登出
 * POST /api/auth/logout
 */
router.post('/logout', authenticate, authController.logout.bind(authController));
// 发送验证码
router.post('/send-code', sendCodeRateLimiter, authController.sendCode.bind(authController));
router.post(
  '/email/send-code',
  sendCodeRateLimiter,
  authController.sendEmailCode.bind(authController)
);

// 发送邮箱验证码
router.post(
  '/send-email-code',
  sendCodeRateLimiter,
  authController.sendEmailCode.bind(authController)
);

// 邮箱验证码登录
router.post('/login/email', authRateLimiter, authController.loginEmail.bind(authController));

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
