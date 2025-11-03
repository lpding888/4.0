const express = require('express');
const router = express.Router();
const promptTemplatesController = require('../../controllers/admin/prompt-templates.controller');
const { authenticateToken } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/require-permission.middleware');
const { validatePromptTemplate } = require('../../middlewares/validate.middleware');

// 所有路由都需要认证
router.use(authenticateToken);

// 获取模板列表 - viewer权限
router.get('/', requirePermission('prompt_templates', 'read'), promptTemplatesController.getTemplates);

// 获取模板分类 - viewer权限
router.get('/categories', requirePermission('prompt_templates', 'read'), promptTemplatesController.getCategories);

// 获取单个模板详情 - viewer权限
router.get('/:id', requirePermission('prompt_templates', 'read'), promptTemplatesController.getTemplateById);

// 获取模板版本历史 - viewer权限
router.get('/:id/versions', requirePermission('prompt_templates', 'read'), promptTemplatesController.getTemplateVersions);

// 创建模板 - editor权限
router.post('/',
  requirePermission('prompt_templates', 'create'),
  validatePromptTemplate,
  promptTemplatesController.createTemplate
);

// 更新模板 - editor权限
router.put('/:id',
  requirePermission('prompt_templates', 'update'),
  validatePromptTemplate,
  promptTemplatesController.updateTemplate
);

// 删除模板 - admin权限
router.delete('/:id', requirePermission('prompt_templates', 'delete'), promptTemplatesController.deleteTemplate);

// 发布/取消发布模板 - editor权限
router.patch('/:id/publish', requirePermission('prompt_templates', 'update'), promptTemplatesController.togglePublish);

// 复制模板 - editor权限
router.post('/:id/copy', requirePermission('prompt_templates', 'create'), promptTemplatesController.copyTemplate);

// 预览模板渲染 - viewer权限
router.post('/:id/preview', requirePermission('prompt_templates', 'read'), promptTemplatesController.previewTemplate);

// 验证模板 - viewer权限
router.post('/:id/validate', requirePermission('prompt_templates', 'read'), promptTemplatesController.validateTemplate);

// 使用模板 - editor权限
router.post('/:id/use', requirePermission('prompt_templates', 'test'), promptTemplatesController.useTemplate);

// 获取模板使用记录 - viewer权限
router.get('/:id/usage', requirePermission('prompt_templates', 'read'), promptTemplatesController.getUsageLogs);

// 获取模板统计 - viewer权限
router.get('/:id/stats', requirePermission('prompt_templates', 'read'), promptTemplatesController.getTemplateStats);

// 回滚到指定版本 - editor权限
router.post('/:id/rollback/:version', requirePermission('prompt_templates', 'update'), promptTemplatesController.rollbackToVersion);

// 比较版本差异 - viewer权限
router.get('/:id/compare/:fromVersion/:toVersion', requirePermission('prompt_templates', 'read'), promptTemplatesController.compareVersions);

module.exports = router;