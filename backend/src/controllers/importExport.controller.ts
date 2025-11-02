/**
 * Import/Export Controller
 * 艹，批量导入导出控制器！
 */

import { Request, Response, NextFunction } from 'express';
import * as importExportService from '../services/importExport.service';

export class ImportExportController {
  /**
   * 导出实体数据
   */
  async exportEntity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { entityType } = req.params;
      const { format = 'json', ...options } = req.query;

      if (!['json', 'csv'].includes(format as string)) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'format必须是json或csv' },
        });
        return;
      }

      const data = await importExportService.exportEntity(
        entityType,
        format as 'json' | 'csv',
        options
      );

      // 艹，设置响应头
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${entityType}_${Date.now()}.csv"`
        );
        res.send(data);
      } else {
        res.json({
          success: true,
          data,
        });
      }
    } catch (error: any) {
      console.error('[ImportExportController] 导出失败:', error.message);
      next(error);
    }
  }

  /**
   * 导入文案数据
   */
  async importContentTexts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { data, format = 'json' } = req.body;
      const updated_by = (req as any).user?.id;

      if (!data) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'data不能为空' },
        });
        return;
      }

      let parsedData: any[];

      if (format === 'csv') {
        // 艹，解析CSV
        parsedData = importExportService.parseCSV(data);
      } else {
        // 艹，解析JSON
        parsedData = typeof data === 'string' ? JSON.parse(data) : data;
      }

      if (!Array.isArray(parsedData) || parsedData.length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'data必须是非空数组' },
        });
        return;
      }

      const result = await importExportService.importContentTextsJSON(parsedData, updated_by);

      res.json({
        success: true,
        data: result,
        message: `导入成功: 创建${result.created}条, 更新${result.updated}条`,
      });
    } catch (error: any) {
      console.error('[ImportExportController] 导入失败:', error.message);
      next(error);
    }
  }
}

export default new ImportExportController();
