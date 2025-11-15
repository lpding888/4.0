import { Router } from 'express';
import taskController from '../controllers/task.controller.js';
import { authenticate, requireRole } from '../middlewares/auth.middleware.js';
import { rateLimit } from '../middlewares/security.middleware.js';
import { idempotencyMiddleware } from '../middlewares/idempotency.middleware.js';

const router = Router();

const taskCreateRateLimit = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: 10,
  keyGenerator: (req) => {
    const userId = req.user?.id;
    // 这个SB限流优先按用户ID，其次按IP，避免匿名刷接口
    return userId ? `rate:task:create:user:${userId}` : `rate:task:create:ip:${req.ip}`;
  }
});

router.post(
  '/create-by-feature',
  authenticate,
  taskController.createByFeature.bind(taskController)
);
router.post(
  '/create',
  authenticate,
  taskCreateRateLimit,
  idempotencyMiddleware('task_create'),
  taskController.create.bind(taskController)
);
router.get('/list', authenticate, taskController.list.bind(taskController));
router.get('/:taskId', authenticate, taskController.get.bind(taskController));
router.put(
  '/:taskId/status',
  authenticate,
  requireRole('admin'),
  taskController.updateStatus.bind(taskController)
);

// 管理员
router.get(
  '/admin/tasks',
  authenticate,
  requireRole('admin'),
  taskController.adminList.bind(taskController)
);
router.get(
  '/admin/tasks/search',
  authenticate,
  requireRole('admin'),
  taskController.search.bind(taskController)
);
router.get(
  '/admin/db/performance',
  authenticate,
  requireRole('admin'),
  taskController.getDbPerformance.bind(taskController)
);

export default router;
