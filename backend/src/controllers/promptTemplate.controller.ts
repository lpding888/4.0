import type { Request, Response, NextFunction } from 'express';
import promptTemplateService from '../services/promptTemplate.service.js';
import logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES } from '../config/error-codes.js';
import type { BatchPreviewItem } from '../types/prompt-template.types.js';

class PromptTemplateController {
  async getTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        page = '1',
        limit = '20',
        category,
        status,
        search,
        sortBy = 'updated_at',
        sortOrder = 'desc',
        created_by
      } = req.query as Record<string, string>;
      const result = await promptTemplateService.getTemplates({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        category: category as 'system' | 'user' | 'assistant' | 'function' | undefined,
        status: status
          ? Array.isArray(status)
            ? (status as ('draft' | 'published' | 'archived')[])
            : ((status as string).split(',') as ('draft' | 'published' | 'archived')[])
          : undefined,
        search,
        sortBy,
        sortOrder: sortOrder as 'asc' | 'desc',
        created_by
      });
      res.json({
        success: true,
        data: result,
        requestId: req.id
      });
    } catch (error) {
      logger.error('[PromptTemplateController] Get templates failed:', error);
      next(error);
    }
  }

  async getTemplateById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const template = await promptTemplateService.getTemplateById(id);
      res.json({
        success: true,
        data: template,
        requestId: req.id
      });
    } catch (error) {
      logger.error('[PromptTemplateController] Get template by ID failed:', error);
      next(error);
    }
  }

  async getTemplateByKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { key } = req.params as { key: string };
      const { version } = req.query as Record<string, string>;
      const template = await promptTemplateService.getTemplateByKey(
        key,
        version ? parseInt(version, 10) : null
      );
      res.json({
        success: true,
        data: template,
        requestId: req.id
      });
    } catch (error) {
      logger.error('[PromptTemplateController] Get template by key failed:', error);
      next(error);
    }
  }

  async createTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw AppError.custom(ERROR_CODES.UNAUTHORIZED, '未授权');
      }
      const templateData = { ...(req.body as Record<string, unknown>), created_by: userId };
      const template = await promptTemplateService.createTemplate(
        templateData as Parameters<typeof promptTemplateService.createTemplate>[0],
        userId
      );
      res.status(201).json({
        success: true,
        data: template,
        message: '提示词模板创建成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error('[PromptTemplateController] Create template failed:', error);
      next(error);
    }
  }

  async updateTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const userId = req.user?.id;
      if (!userId) {
        throw AppError.custom(ERROR_CODES.UNAUTHORIZED, '未授权');
      }
      const updateData = { ...(req.body as Record<string, unknown>), updated_by: userId };
      const template = await promptTemplateService.updateTemplate(id, updateData, userId);
      res.json({
        success: true,
        data: template,
        message: '提示词模板更新成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error('[PromptTemplateController] Update template failed:', error);
      next(error);
    }
  }

  async deleteTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const userId = req.user?.id;
      if (!userId) {
        throw AppError.custom(ERROR_CODES.UNAUTHORIZED, '未授权');
      }
      await promptTemplateService.deleteTemplate(id, userId);
      res.json({
        success: true,
        message: '提示词模板删除成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error('[PromptTemplateController] Delete template failed:', error);
      next(error);
    }
  }

  async getTemplateVersions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { page = '1', limit = '20' } = req.query as Record<string, string>;
      const result = await promptTemplateService.getTemplateVersions(id, {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
      });
      res.json({
        success: true,
        data: result,
        requestId: req.id
      });
    } catch (error) {
      logger.error('[PromptTemplateController] Get template versions failed:', error);
      next(error);
    }
  }

  async previewTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const variables = req.body as Record<string, unknown>;
      const result = await promptTemplateService.previewTemplate(id, variables);
      res.json({
        success: true,
        data: result,
        requestId: req.id
      });
    } catch (error) {
      logger.error('[PromptTemplateController] Preview template failed:', error);
      next(error);
    }
  }

  async validateTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const result = await promptTemplateService.validateTemplate(id);
      res.json({
        success: true,
        data: result,
        requestId: req.id
      });
    } catch (error) {
      logger.error('[PromptTemplateController] Validate template failed:', error);
      next(error);
    }
  }

  async publishTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const userId = req.user?.id;
      if (!userId) {
        throw AppError.custom(ERROR_CODES.UNAUTHORIZED, '未授权');
      }
      const template = await promptTemplateService.publishTemplate(id, userId);
      res.json({
        success: true,
        data: template,
        message: '模板发布成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error('[PromptTemplateController] Publish template failed:', error);
      next(error);
    }
  }

  async archiveTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const userId = req.user?.id;
      if (!userId) {
        throw AppError.custom(ERROR_CODES.UNAUTHORIZED, '未授权');
      }
      const template = await promptTemplateService.archiveTemplate(id, userId);
      res.json({
        success: true,
        data: template,
        message: '模板已归档',
        requestId: req.id
      });
    } catch (error) {
      logger.error('[PromptTemplateController] Archive template failed:', error);
      next(error);
    }
  }

  async rollbackToVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { version } = req.body as { version?: number };
      const userId = req.user?.id;
      if (!userId) {
        throw AppError.custom(ERROR_CODES.UNAUTHORIZED, '未授权');
      }
      if (!version && version !== 0) {
        throw AppError.custom(ERROR_CODES.MISSING_PARAMETERS, '版本号不能为空');
      }
      const template = await promptTemplateService.rollbackToVersion(id, version, userId);
      res.json({
        success: true,
        data: template,
        message: `已回滚到版本 ${version}`,
        requestId: req.id
      });
    } catch (error) {
      logger.error('[PromptTemplateController] Rollback template failed:', error);
      next(error);
    }
  }

  async duplicateTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { new_key, new_name } = req.body as { new_key?: string; new_name?: string };
      const userId = req.user?.id;
      if (!userId) {
        throw AppError.custom(ERROR_CODES.UNAUTHORIZED, '未授权');
      }
      if (!new_key || !new_name) {
        throw AppError.custom(ERROR_CODES.MISSING_PARAMETERS, '新模板key和名称不能为空');
      }
      const original = await promptTemplateService.getTemplateById(id);
      const duplicateData = {
        key: new_key,
        name: new_name,
        description: `${original.description || ''} (复制)`,
        content: original.content,
        category: original.category,
        variables: original.variables,
        metadata: original.metadata,
        status: 'draft' as const
      };
      const duplicated = await promptTemplateService.createTemplate(duplicateData, userId);
      res.status(201).json({
        success: true,
        data: duplicated,
        message: '模板复制成功',
        requestId: req.id
      });
    } catch (error) {
      logger.error('[PromptTemplateController] Duplicate template failed:', error);
      next(error);
    }
  }

  async getTemplateStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await promptTemplateService.getTemplateStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('[PromptTemplateController] Get template stats failed:', error);
      next(error);
    }
  }

  async getTemplateCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await promptTemplateService.getTemplateCategories();
      res.json({ success: true, data: categories });
    } catch (error) {
      logger.error('[PromptTemplateController] Get template categories failed:', error);
      next(error);
    }
  }

  async getTemplateExamples(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const examples = await promptTemplateService.getTemplateExamples();
      res.json({ success: true, data: examples ?? [], requestId: undefined });
    } catch (error) {
      logger.error('[PromptTemplateController] Get template examples failed:', error);
      next(error);
    }
  }

  async batchPreviewTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { templates } = req.body as {
        templates?: BatchPreviewItem[];
      };
      if (!Array.isArray(templates) || templates.length === 0) {
        throw AppError.custom(ERROR_CODES.MISSING_PARAMETERS, '缺少模板列表');
      }
      const result = await promptTemplateService.batchPreviewTemplates(templates);
      res.json({
        success: true,
        data: result,
        requestId: req.id
      });
    } catch (error) {
      logger.error('[PromptTemplateController] Batch preview templates failed:', error);
      next(error);
    }
  }

  async healthCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'prompt-template',
        memory_usage: process.memoryUsage(),
        uptime: process.uptime()
      };
      res.json({
        success: true,
        data: health,
        requestId: req.id
      });
    } catch (error) {
      logger.error('[PromptTemplateController] Health check failed:', error);
      next(error);
    }
  }
}

export default new PromptTemplateController();
