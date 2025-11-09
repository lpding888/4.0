/**
 * Account Routes
 * 艹！账户相关路由！额度查询和消费！
 */

import { Router } from 'express';
import accountController from '../controllers/account.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * 获取额度信息
 * GET /api/account/quota
 */
router.get('/quota', authenticate, accountController.getQuota.bind(accountController));

/**
 * 消费额度
 * POST /api/account/quota/consume
 */
router.post('/quota/consume', authenticate, accountController.consumeQuota.bind(accountController));

export default router;
