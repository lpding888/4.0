/**
 * Audit Logs Routes
 * 艹，审计日志路由！
 */

import { Router } from 'express';
import auditLogsController from '../controllers/auditLogs.controller';

const router = Router();

// 管理端路由（需要admin权限）
router.get('/admin/audit-logs', auditLogsController.listAuditLogs.bind(auditLogsController));
router.get('/admin/audit-logs/:id', auditLogsController.getAuditLog.bind(auditLogsController));

// 艹，获取实体操作历史
router.get(
  '/admin/audit-logs/entity/:entity_type/:entity_id',
  auditLogsController.getEntityHistory.bind(auditLogsController)
);

// 艹，获取用户操作历史
router.get(
  '/admin/audit-logs/user/:user_id',
  auditLogsController.getUserHistory.bind(auditLogsController)
);

export default router;
