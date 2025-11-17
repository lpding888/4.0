import { Router } from 'express';
import systemConfigController from '../controllers/systemConfig.controller.js';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware.js';
import { securityAudit } from '../middlewares/security.middleware.js';

const router = Router();

// 艹，系统配置都是全局影响的东西，一律限制管理员并记录审计日志
router.get('/', authenticate, requireAdmin, systemConfigController.list);
router.get('/categories', authenticate, requireAdmin, systemConfigController.getCategories);
router.get('/category/:category', authenticate, requireAdmin, systemConfigController.getCategory);
router.post(
  '/reload-cache',
  authenticate,
  requireAdmin,
  securityAudit({ includeRequestData: true }),
  systemConfigController.reloadCache
);
router.get('/export', authenticate, requireAdmin, systemConfigController.export);
router.post(
  '/import',
  authenticate,
  requireAdmin,
  securityAudit({ includeRequestData: true }),
  systemConfigController.import
);
router.post(
  '/batch',
  authenticate,
  requireAdmin,
  securityAudit({ includeRequestData: true }),
  systemConfigController.setBatch
);
router.get('/:key', authenticate, requireAdmin, systemConfigController.getValue);
router.put(
  '/:key',
  authenticate,
  requireAdmin,
  securityAudit({ includeRequestData: true }),
  systemConfigController.setValue
);
router.delete(
  '/:key',
  authenticate,
  requireAdmin,
  securityAudit({ includeRequestData: true }),
  systemConfigController.delete
);

export default router;
