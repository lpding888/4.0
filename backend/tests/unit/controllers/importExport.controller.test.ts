/**
 * ImportExportController 单元测试
 * 艹，快速覆盖核心逻辑！
 */

import { Request, Response, NextFunction } from 'express';
import { ImportExportController } from '../../../src/controllers/importExport.controller';
import * as importExportService from '../../../src/services/importExport.service';

jest.mock('../../../src/services/importExport.service');

describe('ImportExportController - 单元测试', () => {
  let controller: ImportExportController;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    controller = new ImportExportController();
    mockReq = { params: {}, query: {}, body: {}, user: { id: 1 } };
    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('exportEntity', () => {
    test('应该成功导出JSON格式', async () => {
      const mockData = [{ page: 'home', key: 'title', value: '标题' }];
      (importExportService.exportEntity as jest.Mock).mockResolvedValue(mockData);

      mockReq.params = { entityType: 'content_texts' };
      mockReq.query = { format: 'json' };

      await controller.exportEntity(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockData,
      });
    });

    test('应该成功导出CSV格式', async () => {
      const mockCSV = 'page,key,value\nhome,title,标题';
      (importExportService.exportEntity as jest.Mock).mockResolvedValue(mockCSV);

      mockReq.params = { entityType: 'content_texts' };
      mockReq.query = { format: 'csv' };

      await controller.exportEntity(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalled();
      expect(mockRes.send).toHaveBeenCalledWith(mockCSV);
    });

    test('format无效应该返回400', async () => {
      mockReq.params = { entityType: 'content_texts' };
      mockReq.query = { format: 'xml' };

      await controller.exportEntity(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('importContentTexts', () => {
    test('应该成功导入JSON数据', async () => {
      (importExportService.importContentTextsJSON as jest.Mock).mockResolvedValue({
        created: 2,
        updated: 1,
        errors: [],
      });

      mockReq.body = {
        data: [
          { page: 'home', key: 'title', value: '标题' },
          { page: 'home', key: 'subtitle', value: '副标题' },
        ],
        format: 'json',
      };

      await controller.importContentTexts(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({ created: 2, updated: 1 }),
        message: expect.any(String),
      });
    });

    test('data为空应该返回400', async () => {
      mockReq.body = {};

      await controller.importContentTexts(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    test('data不是数组应该返回400', async () => {
      mockReq.body = { data: { notArray: true }, format: 'json' };

      await controller.importContentTexts(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });
});
