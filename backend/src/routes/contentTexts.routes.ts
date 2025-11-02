/**
 * Content Texts Routes
 * 艹，文案配置路由！
 */

import { Router } from 'express';
import textsController from '../controllers/contentTexts.controller';

const router = Router();

// 管理端路由（需要admin权限）
router.get('/admin/content/texts', textsController.listTexts.bind(textsController));
router.post('/admin/content/texts', textsController.createText.bind(textsController));
router.get('/admin/content/texts/:id', textsController.getText.bind(textsController));
router.put('/admin/content/texts/:id', textsController.updateText.bind(textsController));
router.delete('/admin/content/texts/:id', textsController.deleteText.bind(textsController));

// 艹，批量导入/更新
router.post('/admin/content/texts/batch', textsController.batchUpsertTexts.bind(textsController));

// 前台路由（公开访问）
router.get('/content/texts/:page', textsController.getPageTexts.bind(textsController));

export default router;
