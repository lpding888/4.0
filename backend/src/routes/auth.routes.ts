/**
 * Auth Routes
 * 艹，认证相关路由！登录、注册、刷新、登出！
 */

import { Router } from 'express';
import authController from '../controllers/auth.controller';

const router = Router();

/**
 * 用户注册
 * POST /api/auth/register
 */
router.post('/register', authController.register.bind(authController));

/**
 * 用户登录
 * POST /api/auth/login
 */
router.post('/login', authController.login.bind(authController));

/**
 * 刷新Token
 * POST /api/auth/refresh
 */
router.post('/refresh', authController.refresh.bind(authController));

/**
 * 用户登出
 * POST /api/auth/logout
 */
router.post('/logout', authController.logout.bind(authController));

export default router;
