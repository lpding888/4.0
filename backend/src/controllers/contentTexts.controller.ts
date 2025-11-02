/**
 * Content Texts Controller
 * 艹，文案配置控制器！
 */

import { Request, Response, NextFunction } from 'express';
import * as textRepo from '../repositories/contentTexts.repo';
import { CreateTextInput } from '../repositories/contentTexts.repo';

export class ContentTextsController {
  /**
   * 列出文案（管理端）
   */
  async listTexts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, section, language, status, limit = 50, offset = 0 } = req.query;

      const texts = await textRepo.listTexts({
        page: page as string,
        section: section as string,
        language: language as string,
        status: status as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });

      res.json({
        success: true,
        data: {
          items: texts,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        },
      });
    } catch (error: any) {
      console.error('[TextsController] 列出文案失败:', error.message);
      next(error);
    }
  }

  /**
   * 获取页面文案（前台）
   */
  async getPageTexts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page } = req.params;
      const { language } = req.query;

      const texts = await textRepo.getPageTexts({
        page,
        language: (language as string) || 'zh-CN',
      });

      res.json({
        success: true,
        data: texts,
      });
    } catch (error: any) {
      console.error('[TextsController] 获取页面文案失败:', error.message);
      next(error);
    }
  }

  /**
   * 获取单个文案
   */
  async getText(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const text = await textRepo.getTextById(id);

      if (!text) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '文案不存在' },
        });
        return;
      }

      res.json({ success: true, data: text });
    } catch (error: any) {
      console.error('[TextsController] 获取文案失败:', error.message);
      next(error);
    }
  }

  /**
   * 创建文案
   */
  async createText(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input: CreateTextInput = {
        ...req.body,
        created_by: (req as any).user?.id,
      };

      // 艹，基础校验
      if (!input.page?.trim()) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'page不能为空' },
        });
        return;
      }

      if (!input.key?.trim()) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'key不能为空' },
        });
        return;
      }

      if (!input.value?.trim()) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'value不能为空' },
        });
        return;
      }

      const text = await textRepo.createText(input);

      res.status(201).json({ success: true, data: text });
    } catch (error: any) {
      console.error('[TextsController] 创建文案失败:', error.message);
      next(error);
    }
  }

  /**
   * 更新文案
   */
  async updateText(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const updates = {
        ...req.body,
        updated_by: (req as any).user?.id,
      };

      const text = await textRepo.updateText(id, updates);

      res.json({ success: true, data: text });
    } catch (error: any) {
      if (error.message.includes('不存在')) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: error.message },
        });
        return;
      }
      console.error('[TextsController] 更新文案失败:', error.message);
      next(error);
    }
  }

  /**
   * 删除文案
   */
  async deleteText(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const deleted = await textRepo.deleteText(id);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '文案不存在' },
        });
        return;
      }

      res.json({ success: true, message: '文案已删除' });
    } catch (error: any) {
      console.error('[TextsController] 删除文案失败:', error.message);
      next(error);
    }
  }

  /**
   * 批量导入/更新文案
   * 艹，支持批量upsert！
   */
  async batchUpsertTexts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { texts } = req.body;
      const updated_by = (req as any).user?.id;

      if (!Array.isArray(texts) || texts.length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'texts必须是非空数组' },
        });
        return;
      }

      const result = await textRepo.batchUpsertTexts(texts, updated_by);

      res.json({
        success: true,
        data: result,
        message: `批量导入成功: 创建${result.created}条, 更新${result.updated}条`,
      });
    } catch (error: any) {
      console.error('[TextsController] 批量导入文案失败:', error.message);
      next(error);
    }
  }
}

export default new ContentTextsController();
