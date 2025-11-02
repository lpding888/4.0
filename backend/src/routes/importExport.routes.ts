/**
 * Import/Export Routes
 * 艹，批量导入导出路由！
 */

import { Router } from 'express';
import importExportController from '../controllers/importExport.controller';

const router = Router();

// 管理端路由（需要admin权限）

// 艹，导出实体数据
router.get(
  '/admin/export/:entityType',
  importExportController.exportEntity.bind(importExportController)
);

// 艹，导入文案数据
router.post(
  '/admin/import/content-texts',
  importExportController.importContentTexts.bind(importExportController)
);

export default router;
