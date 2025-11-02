/**
 * ContentTextsController 单元测试
 * 艹，快速覆盖核心逻辑！
 */

import { Request, Response, NextFunction } from 'express';
import { ContentTextsController } from '../../../src/controllers/contentTexts.controller';
import * as textRepo from '../../../src/repositories/contentTexts.repo';

jest.mock('../../../src/repositories/contentTexts.repo');

describe('ContentTextsController - 单元测试', () => {
  let controller: ContentTextsController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    controller = new ContentTextsController();
    mockReq = { params: {}, query: {}, body: {}, user: { id: 1 } };
    mockRes = { json: jest.fn().mockReturnThis(), status: jest.fn().mockReturnThis() };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('listTexts', () => {
    test('应该成功列出文案', async () => {
      const mockTexts = [{ id: 1, page: 'home', key: 'title', value: '首页标题' }];
      (textRepo.listTexts as jest.Mock).mockResolvedValue(mockTexts);

      await controller.listTexts(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ items: mockTexts }),
      });
    });
  });

  describe('createText', () => {
    test('应该成功创建文案', async () => {
      const input = { page: 'home', key: 'title', value: '首页标题' };
      const created = { id: 1, ...input };
      (textRepo.createText as jest.Mock).mockResolvedValue(created);

      mockReq.body = input;

      await controller.createText(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: created });
    });

    test('page为空应该返回400', async () => {
      mockReq.body = { page: '', key: 'title', value: '标题' };

      await controller.createText(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('key为空应该返回400', async () => {
      mockReq.body = { page: 'home', key: '', value: '标题' };

      await controller.createText(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('value为空应该返回400', async () => {
      mockReq.body = { page: 'home', key: 'title', value: '' };

      await controller.createText(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getText', () => {
    test('应该成功获取文案', async () => {
      const mock = { id: 1, page: 'home', key: 'title' };
      (textRepo.getTextById as jest.Mock).mockResolvedValue(mock);

      mockReq.params = { id: '1' };

      await controller.getText(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: mock });
    });

    test('文案不存在应该返回404', async () => {
      (textRepo.getTextById as jest.Mock).mockResolvedValue(null);

      mockReq.params = { id: '999' };

      await controller.getText(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('updateText', () => {
    test('应该成功更新文案', async () => {
      const updated = { id: 1, value: '更新后' };
      (textRepo.updateText as jest.Mock).mockResolvedValue(updated);

      mockReq.params = { id: '1' };
      mockReq.body = { value: '更新后' };

      await controller.updateText(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: updated });
    });
  });

  describe('deleteText', () => {
    test('应该成功删除文案', async () => {
      (textRepo.deleteText as jest.Mock).mockResolvedValue(true);

      mockReq.params = { id: '1' };

      await controller.deleteText(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, message: '文案已删除' });
    });

    test('删除不存在的文案应该返回404', async () => {
      (textRepo.deleteText as jest.Mock).mockResolvedValue(false);

      mockReq.params = { id: '999' };

      await controller.deleteText(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('batchUpsertTexts', () => {
    test('应该成功批量导入文案', async () => {
      (textRepo.batchUpsertTexts as jest.Mock).mockResolvedValue({ created: 2, updated: 1 });

      mockReq.body = {
        texts: [
          { page: 'home', key: 'title', value: '标题1' },
          { page: 'home', key: 'subtitle', value: '副标题' },
        ],
      };

      await controller.batchUpsertTexts(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { created: 2, updated: 1 },
        message: expect.any(String),
      });
    });

    test('texts为空数组应该返回400', async () => {
      mockReq.body = { texts: [] };

      await controller.batchUpsertTexts(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('texts不是数组应该返回400', async () => {
      mockReq.body = { texts: 'not-array' };

      await controller.batchUpsertTexts(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getPageTexts', () => {
    test('应该成功获取页面文案', async () => {
      const mockTexts = { title: '首页标题', subtitle: '副标题' };
      (textRepo.getPageTexts as jest.Mock).mockResolvedValue(mockTexts);

      mockReq.params = { page: 'home' };
      mockReq.query = { language: 'zh-CN' };

      await controller.getPageTexts(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: mockTexts });
    });
  });
});
