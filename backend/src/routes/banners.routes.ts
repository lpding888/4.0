/**
 * Banners Routes
 * 艹，轮播图路由！
 */

import { Router } from 'express';
import bannersController from '../controllers/banners.controller';

const router = Router();

// 管理端路由（需要admin权限）
router.get('/admin/banners', bannersController.listBanners.bind(bannersController));
router.post('/admin/banners', bannersController.createBanner.bind(bannersController));
router.get('/admin/banners/:id', bannersController.getBanner.bind(bannersController));
router.put('/admin/banners/:id', bannersController.updateBanner.bind(bannersController));
router.delete('/admin/banners/:id', bannersController.deleteBanner.bind(bannersController));

// 艹，拖拽排序批量更新
router.put('/admin/banners-sort-order', bannersController.updateSortOrder.bind(bannersController));

// 艹，COS上传相关
router.post('/admin/banners/upload-credentials', bannersController.getUploadCredentials.bind(bannersController));
router.post('/admin/banners/upload', bannersController.uploadImage.bind(bannersController));

// 前台路由（公开访问）
router.get('/banners/active', bannersController.getActiveBanners.bind(bannersController));

export default router;
