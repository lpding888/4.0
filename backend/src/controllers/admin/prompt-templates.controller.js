const promptTemplateService = require('../../services/prompt-template.service');
const { createSuccessResponse, createErrorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');

class PromptTemplatesController {
  /**
   * 获取模板列表
   */
  async getTemplates(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        published,
        enabled,
        search,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        filters: {
          category,
          published: published !== undefined ? published === 'true' : undefined,
          enabled: enabled !== undefined ? enabled === 'true' : undefined
        },
        search,
        sortBy,
        sortOrder: sortOrder === 'asc' ? 'asc' : 'desc'
      };

      const result = await promptTemplateService.getTemplates(options);

      res.json(createSuccessResponse({
        templates: result.templates,
        pagination: result.pagination
      }, '获取模板列表成功'));
    } catch (error) {
      logger.error('获取模板列表失败:', error);
      next(error);
    }
  }

  /**
   * 获取模板分类
   */
  async getCategories(req, res, next) {
    try {
      const categories = await promptTemplateService.getCategories();

      res.json(createSuccessResponse(categories, '获取模板分类成功'));
    } catch (error) {
      logger.error('获取模板分类失败:', error);
      next(error);
    }
  }

  /**
   * 获取单个模板详情
   */
  async getTemplateById(req, res, next) {
    try {
      const { id } = req.params;
      const template = await promptTemplateService.getTemplateById(id);

      res.json(createSuccessResponse(template, '获取模板详情成功'));
    } catch (error) {
      logger.error('获取模板详情失败:', error);
      next(error);
    }
  }

  /**
   * 获取模板版本历史
   */
  async getTemplateVersions(req, res, next) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit)
      };

      const result = await promptTemplateService.getTemplateVersions(id, options);

      res.json(createSuccessResponse({
        versions: result.versions,
        pagination: result.pagination
      }, '获取模板版本历史成功'));
    } catch (error) {
      logger.error('获取模板版本历史失败:', error);
      next(error);
    }
  }

  /**
   * 创建模板
   */
  async createTemplate(req, res, next) {
    try {
      const userId = req.user.id;
      const templateData = {
        ...req.body,
        created_by: userId
      };

      const template = await promptTemplateService.createTemplate(templateData, userId);

      res.status(201).json(
        createSuccessResponse(template, '创建模板成功')
      );
    } catch (error) {
      logger.error('创建模板失败:', error);
      next(error);
    }
  }

  /**
   * 更新模板
   */
  async updateTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const updateData = {
        ...req.body,
        updated_by: userId
      };

      const template = await promptTemplateService.updateTemplate(id, updateData, userId);

      res.json(createSuccessResponse(template, '更新模板成功'));
    } catch (error) {
      logger.error('更新模板失败:', error);
      next(error);
    }
  }

  /**
   * 删除模板
   */
  async deleteTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      await promptTemplateService.deleteTemplate(id, userId);

      res.json(createSuccessResponse(null, '删除模板成功'));
    } catch (error) {
      logger.error('删除模板失败:', error);
      next(error);
    }
  }

  /**
   * 发布/取消发布模板
   */
  async togglePublish(req, res, next) {
    try {
      const { id } = req.params;
      const { published } = req.body;
      const userId = req.user.id;

      const template = await promptTemplateService.togglePublish(id, published, userId);

      res.json(createSuccessResponse(template, `${published ? '发布' : '取消发布'}模板成功`));
    } catch (error) {
      logger.error('切换模板发布状态失败:', error);
      next(error);
    }
  }

  /**
   * 复制模板
   */
  async copyTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const { name } = req.body;
      const userId = req.user.id;

      const copiedTemplate = await promptTemplateService.copyTemplate(id, name, userId);

      res.status(201).json(
        createSuccessResponse(copiedTemplate, '复制模板成功')
      );
    } catch (error) {
      logger.error('复制模板失败:', error);
      next(error);
    }
  }

  /**
   * 预览模板渲染
   */
  async previewTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const { variables } = req.body;

      const preview = await promptTemplateService.previewTemplate(id, variables);

      res.json(createSuccessResponse(preview, '预览模板成功'));
    } catch (error) {
      logger.error('预览模板失败:', error);
      next(error);
    }
  }

  /**
   * 验证模板
   */
  async validateTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const { template, variables } = req.body;

      const validation = await promptTemplateService.validateTemplate(template, variables);

      res.json(createSuccessResponse(validation, '验证模板完成'));
    } catch (error) {
      logger.error('验证模板失败:', error);
      next(error);
    }
  }

  /**
   * 使用模板
   */
  async useTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const {
        variables,
        contextType,
        contextId,
        resultSummary,
        tokensUsed,
        cost
      } = req.body;
      const userId = req.user.id;

      const result = await promptTemplateService.useTemplate(
        id,
        variables,
        {
          contextType,
          contextId,
          userId,
          resultSummary,
          tokensUsed,
          cost
        }
      );

      res.json(createSuccessResponse(result, '使用模板成功'));
    } catch (error) {
      logger.error('使用模板失败:', error);
      next(error);
    }
  }

  /**
   * 获取模板使用记录
   */
  async getUsageLogs(req, res, next) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 50, contextType } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        filters: {
          context_type: contextType
        }
      };

      const result = await promptTemplateService.getUsageLogs(id, options);

      res.json(createSuccessResponse({
        logs: result.logs,
        pagination: result.pagination
      }, '获取使用记录成功'));
    } catch (error) {
      logger.error('获取使用记录失败:', error);
      next(error);
    }
  }

  /**
   * 获取模板统计
   */
  async getTemplateStats(req, res, next) {
    try {
      const { id } = req.params;
      const stats = await promptTemplateService.getTemplateStats(id);

      res.json(createSuccessResponse(stats, '获取模板统计成功'));
    } catch (error) {
      logger.error('获取模板统计失败:', error);
      next(error);
    }
  }

  /**
   * 回滚到指定版本
   */
  async rollbackToVersion(req, res, next) {
    try {
      const { id, version } = req.params;
      const userId = req.user.id;

      const template = await promptTemplateService.rollbackToVersion(id, version, userId);

      res.json(createSuccessResponse(template, `回滚到版本${version}成功`));
    } catch (error) {
      logger.error('回滚模板版本失败:', error);
      next(error);
    }
  }

  /**
   * 比较版本差异
   */
  async compareVersions(req, res, next) {
    try {
      const { id, fromVersion, toVersion } = req.params;

      const comparison = await promptTemplateService.compareVersions(id, fromVersion, toVersion);

      res.json(createSuccessResponse(comparison, '比较版本差异成功'));
    } catch (error) {
      logger.error('比较版本差异失败:', error);
      next(error);
    }
  }
}

module.exports = new PromptTemplatesController();