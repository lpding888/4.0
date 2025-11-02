/**
 * BannersController 单元测试
 * 艹，快速覆盖核心逻辑！
 */

import { Request, Response, NextFunction } from 'express';
import { BannersController } from '../../../src/controllers/banners.controller';
import * as bannerRepo from '../../../src/repositories/banners.repo';
import * as cosService from '../../../src/services/cos.service';

jest.mock('../../../src/repositories/banners.repo');
jest.mock('../../../src/services/cos.service');

describe('BannersController - 单元测试', () => {
  let controller: BannersController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    controller = new BannersController();
    mockReq = { params: {}, query: {}, body: {}, user: { id: 1 } };
    mockRes = { json: jest.fn().mockReturnThis(), status: jest.fn().mockReturnThis() };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('listBanners', () => {
    test('应该成功列出轮播图', async () => {
      const mockBanners = [{ id: 1, title: '测试轮播图' }];
      (bannerRepo.listBanners as jest.Mock).mockResolvedValue(mockBanners);

      await controller.listBanners(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ items: mockBanners }),
      });
    });
  });

  describe('createBanner', () => {
    test('应该成功创建轮播图', async () => {
      const input = { title: '新轮播图', image_url: 'https://example.com/img.jpg' };
      const created = { id: 1, ...input };
      (bannerRepo.createBanner as jest.Mock).mockResolvedValue(created);

      mockReq.body = input;

      await controller.createBanner(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: created });
    });

    test('标题为空应该返回400', async () => {
      mockReq.body = { title: '', image_url: 'https://example.com/img.jpg' };

      await controller.createBanner(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('图片URL为空应该返回400', async () => {
      mockReq.body = { title: '标题', image_url: '' };

      await controller.createBanner(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getBanner', () => {
    test('应该成功获取轮播图', async () => {
      const mock = { id: 1, title: '测试' };
      (bannerRepo.getBannerById as jest.Mock).mockResolvedValue(mock);

      mockReq.params = { id: '1' };

      await controller.getBanner(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: mock });
    });

    test('轮播图不存在应该返回404', async () => {
      (bannerRepo.getBannerById as jest.Mock).mockResolvedValue(null);

      mockReq.params = { id: '999' };

      await controller.getBanner(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('updateBanner', () => {
    test('应该成功更新轮播图', async () => {
      const updated = { id: 1, title: '更新后' };
      (bannerRepo.updateBanner as jest.Mock).mockResolvedValue(updated);

      mockReq.params = { id: '1' };
      mockReq.body = { title: '更新后' };

      await controller.updateBanner(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, data: updated });
    });
  });

  describe('updateSortOrder', () => {
    test('应该成功批量更新排序', async () => {
      const sortOrders = [
        { id: 1, sort_order: 0 },
        { id: 2, sort_order: 1 },
      ];
      (bannerRepo.updateBannersSortOrder as jest.Mock).mockResolvedValue(undefined);

      mockReq.body = { sortOrders };

      await controller.updateSortOrder(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, message: '排序更新成功' });
    });

    test('sortOrders为空数组应该返回400', async () => {
      mockReq.body = { sortOrders: [] };

      await controller.updateSortOrder(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('sortOrders格式错误应该返回400', async () => {
      mockReq.body = { sortOrders: [{ id: 'abc', sort_order: 1 }] };

      await controller.updateSortOrder(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('deleteBanner', () => {
    test('应该成功删除轮播图', async () => {
      (bannerRepo.deleteBanner as jest.Mock).mockResolvedValue(true);

      mockReq.params = { id: '1' };

      await controller.deleteBanner(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, message: '轮播图已删除' });
    });

    test('删除不存在的轮播图应该返回404', async () => {
      (bannerRepo.deleteBanner as jest.Mock).mockResolvedValue(false);

      mockReq.params = { id: '999' };

      await controller.deleteBanner(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getUploadCredentials', () => {
    test('应该成功获取上传凭证', async () => {
      (cosService.isCOSConfigured as jest.Mock).mockReturnValue(true);
      (cosService.generateBannerKey as jest.Mock).mockReturnValue('banners/20251031/test.jpg');
      (cosService.getUploadCredentials as jest.Mock).mockResolvedValue({
        uploadUrl: 'https://test-bucket.cos.ap-guangzhou.myqcloud.com/banners/20251031/test.jpg',
        bucket: 'test-bucket',
        region: 'ap-guangzhou',
        key: 'banners/20251031/test.jpg',
      });

      mockReq.body = { filename: 'test.jpg' };

      await controller.getUploadCredentials(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ uploadUrl: expect.any(String) }),
      });
    });

    test('COS未配置应该返回503', async () => {
      (cosService.isCOSConfigured as jest.Mock).mockReturnValue(false);

      mockReq.body = { filename: 'test.jpg' };

      await controller.getUploadCredentials(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
    });

    test('文件名为空应该返回400', async () => {
      (cosService.isCOSConfigured as jest.Mock).mockReturnValue(true);

      mockReq.body = { filename: '' };

      await controller.getUploadCredentials(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('uploadImage', () => {
    test('应该成功上传图片', async () => {
      (cosService.isCOSConfigured as jest.Mock).mockReturnValue(true);
      (cosService.generateBannerKey as jest.Mock).mockReturnValue('banners/20251031/test.jpg');
      (cosService.uploadFile as jest.Mock).mockResolvedValue(
        'https://test-bucket.cos.ap-guangzhou.myqcloud.com/banners/20251031/test.jpg'
      );

      (mockReq as any).file = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test'),
        mimetype: 'image/jpeg',
      };

      await controller.uploadImage(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ url: expect.any(String) }),
      });
    });

    test('COS未配置应该返回503', async () => {
      (cosService.isCOSConfigured as jest.Mock).mockReturnValue(false);

      await controller.uploadImage(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(503);
    });

    test('未找到上传文件应该返回400', async () => {
      (cosService.isCOSConfigured as jest.Mock).mockReturnValue(true);
      (mockReq as any).file = undefined;

      await controller.uploadImage(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });
});
