/**
 * Announcements Routes
 * 艹，公告路由！
 */

import { Router } from 'express';
import announcementsController from '../controllers/announcements.controller';

const router = Router();

// 管理端路由（需要admin权限）
router.get('/admin/announcements', announcementsController.listAnnouncements.bind(announcementsController));
router.post('/admin/announcements', announcementsController.createAnnouncement.bind(announcementsController));
router.get('/admin/announcements/:id', announcementsController.getAnnouncement.bind(announcementsController));
router.put('/admin/announcements/:id', announcementsController.updateAnnouncement.bind(announcementsController));
router.delete('/admin/announcements/:id', announcementsController.deleteAnnouncement.bind(announcementsController));

// 前台路由（公开访问）
router.get('/announcements/active', announcementsController.getActiveAnnouncements.bind(announcementsController));

export default router;
