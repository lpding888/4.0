/**
 * AnnouncementsController 单元测试
 * 艹，快速覆盖核心逻辑！
 */

import { Request, Response, NextFunction } from 'express';
import { AnnouncementsController } from '../../../src/controllers/announcements.controller';
import * as announcementRepo from '../../../src/repositories/announcements.repo';

jest.mock('../../../src/repositories/announcements.repo');

describe('AnnouncementsController - 单元测试', () => {
  let controller: AnnouncementsController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    controller = new AnnouncementsController();
    mockReq = { params: {}, query: {}, body: {}, user: { id: 1 } };
    mockRes = { json: jest.fn().mockReturnThis(), status: jest.fn().mockReturnThis() };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('listAnnouncements', () => {
    test('应该成功列出公告', async () => {
      const mockAnnouncements = [{ id: 1, title: '测试公告' }];
      (announcementRepo.listAnnouncements as jest.Mock).mockResolvedValue(mockAnnouncements);

      await controller.listAnnouncements(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ items: mockAnnouncements }),
      });
    });
  });

  describe('createAnnouncement', () => {
    test('应该成功创建公告', async () => {
      const input = { title: '新公告', content: '内容' };
      const created = { id: 1, ...input };
      (announcementRepo.createAnnouncement as jest.Mock).mockResolvedValue(created);

      mockReq.body = input;

      await controller.createAnnouncement(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: created });
    });

    test('标题为空应该返回400', async () => {
      mockReq.body = { title: '', content: '内容' };

      await controller.createAnnouncement(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('内容为空应该返回400', async () => {
      mockReq.body = { title: '标题', content: '' };

      await controller.createAnnouncement(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getAnnouncement', () => {
    test('应该成功获取公告', async () => {
      const mock = { id: 1, title: '测试' };
      (announcementRepo.getAnnouncementById as jest.Mock).mockResolvedValue(mock);

      mockReq.params = { id: '1' };

      await controller.getAnnouncement(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: mock });
    });

    test('公告不存在应该返回404', async () => {
      (announcementRepo.getAnnouncementById as jest.Mock).mockResolvedValue(null);

      mockReq.params = { id: '999' };

      await controller.getAnnouncement(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('updateAnnouncement', () => {
    test('应该成功更新公告', async () => {
      const updated = { id: 1, title: '更新后' };
      (announcementRepo.updateAnnouncement as jest.Mock).mockResolvedValue(updated);

      mockReq.params = { id: '1' };
      mockReq.body = { title: '更新后' };

      await controller.updateAnnouncement(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: updated });
    });
  });

  describe('deleteAnnouncement', () => {
    test('应该成功删除公告', async () => {
      (announcementRepo.deleteAnnouncement as jest.Mock).mockResolvedValue(true);

      mockReq.params = { id: '1' };

      await controller.deleteAnnouncement(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, message: '公告已删除' });
    });

    test('删除不存在的公告应该返回404', async () => {
      (announcementRepo.deleteAnnouncement as jest.Mock).mockResolvedValue(false);

      mockReq.params = { id: '999' };

      await controller.deleteAnnouncement(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });
});
