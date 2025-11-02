/**
 * Announcements Controller
 * 艹，公告管理控制器！
 */

import { Request, Response, NextFunction } from 'express';
import * as announcementRepo from '../repositories/announcements.repo';
import { CreateAnnouncementInput } from '../repositories/announcements.repo';

export class AnnouncementsController {
  /**
   * 列出公告（管理端）
   */
  async listAnnouncements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, position, limit = 50, offset = 0, includeExpired } = req.query;

      const announcements = await announcementRepo.listAnnouncements({
        status: status as string,
        position: position as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        includeExpired: includeExpired === 'true',
      });

      res.json({
        success: true,
        data: {
          items: announcements,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        },
      });
    } catch (error: any) {
      console.error('[AnnouncementsController] 列出公告失败:', error.message);
      next(error);
    }
  }

  /**
   * 获取当前有效公告（前台）
   */
  async getActiveAnnouncements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { position, target_audience } = req.query;

      const announcements = await announcementRepo.getActiveAnnouncements({
        position: position as string,
        target_audience: target_audience as any,
      });

      res.json({
        success: true,
        data: announcements,
      });
    } catch (error: any) {
      console.error('[AnnouncementsController] 获取有效公告失败:', error.message);
      next(error);
    }
  }

  /**
   * 获取单个公告
   */
  async getAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const announcement = await announcementRepo.getAnnouncementById(id);

      if (!announcement) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '公告不存在' },
        });
        return;
      }

      res.json({ success: true, data: announcement });
    } catch (error: any) {
      console.error('[AnnouncementsController] 获取公告失败:', error.message);
      next(error);
    }
  }

  /**
   * 创建公告
   */
  async createAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input: CreateAnnouncementInput = {
        ...req.body,
        created_by: (req as any).user?.id,
      };

      // 艹，基础校验
      if (!input.title?.trim()) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '标题不能为空' },
        });
        return;
      }

      if (!input.content?.trim()) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '内容不能为空' },
        });
        return;
      }

      const announcement = await announcementRepo.createAnnouncement(input);

      res.status(201).json({ success: true, data: announcement });
    } catch (error: any) {
      console.error('[AnnouncementsController] 创建公告失败:', error.message);
      next(error);
    }
  }

  /**
   * 更新公告
   */
  async updateAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;

      const announcement = await announcementRepo.updateAnnouncement(id, updates);

      res.json({ success: true, data: announcement });
    } catch (error: any) {
      if (error.message.includes('不存在')) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: error.message },
        });
        return;
      }
      console.error('[AnnouncementsController] 更新公告失败:', error.message);
      next(error);
    }
  }

  /**
   * 删除公告
   */
  async deleteAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const deleted = await announcementRepo.deleteAnnouncement(id);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '公告不存在' },
        });
        return;
      }

      res.json({ success: true, message: '公告已删除' });
    } catch (error: any) {
      console.error('[AnnouncementsController] 删除公告失败:', error.message);
      next(error);
    }
  }
}

export default new AnnouncementsController();
