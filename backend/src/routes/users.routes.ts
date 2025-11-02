/**
 * Users Routes
 * 艹，用户相关路由！
 */

import { Router } from 'express';
import usersController from '../controllers/users.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

/**
 * 获取当前登录用户信息
 * GET /api/users/me
 * 艹，必须登录才能访问！
 */
router.get('/me', authenticate, usersController.getMe.bind(usersController));

/**
 * 更新当前用户信息
 * PUT /api/users/me
 */
router.put('/me', authenticate, usersController.updateMe.bind(usersController));

export default router;
