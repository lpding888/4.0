const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const assetController = require('../controllers/asset.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireAdmin } = require('../middlewares/adminAuth.middleware');

/**
 * 管理后台路由
 * 所有路由都需要 admin 角色权限
 */

// 系统概览
router.get('/overview', authenticate, requireAdmin, adminController.getOverview);

// 用户管理
router.get('/users', authenticate, requireAdmin, adminController.getUsers);

// 任务管理
router.get('/tasks', authenticate, requireAdmin, adminController.getTasks);

// 失败任务列表
router.get('/failed-tasks', authenticate, requireAdmin, adminController.getFailedTasks);

// ========== 功能卡片管理 ==========

// 获取所有功能卡片（包括禁用的）
router.get('/features', authenticate, requireAdmin, adminController.getFeatures);

// Feature Wizard创建（CMS-208）- 艹！必须放在 /features 之前！
const featureWizardController = require('../controllers/admin/featureWizard.controller');
router.post('/features/wizard', authenticate, requireAdmin, featureWizardController.createFeatureFromWizard);

// 创建新功能卡片（旧方式）
router.post('/features', authenticate, requireAdmin, adminController.createFeature);

// 更新功能卡片
router.put('/features/:featureId', authenticate, requireAdmin, adminController.updateFeature);

// 快速切换功能启用状态
router.patch('/features/:featureId', authenticate, requireAdmin, adminController.toggleFeature);

// 软删除功能卡片
router.delete('/features/:featureId', authenticate, requireAdmin, adminController.deleteFeature);

// ========== 素材库管理 ==========

// 管理员查看所有用户素材
router.get('/assets', authenticate, requireAdmin, assetController.getAllAssets);

// ========== 分销代理管理 ==========

// 分销员列表
router.get('/distributors', authenticate, requireAdmin, adminController.getDistributors);

// 分销员详细信息
router.get('/distributors/:id', authenticate, requireAdmin, adminController.getDistributorDetail);

// 分销员推广用户列表
router.get('/distributors/:id/referrals', authenticate, requireAdmin, adminController.getDistributorReferrals);

// 分销员佣金记录
router.get('/distributors/:id/commissions', authenticate, requireAdmin, adminController.getDistributorCommissions);

// 审核分销员申请
router.patch('/distributors/:id/approve', authenticate, requireAdmin, adminController.approveDistributor);

// 禁用分销员
router.patch('/distributors/:id/disable', authenticate, requireAdmin, adminController.disableDistributor);

// 提现申请列表
router.get('/withdrawals', authenticate, requireAdmin, adminController.getWithdrawals);

// 审核通过提现
router.patch('/withdrawals/:id/approve', authenticate, requireAdmin, adminController.approveWithdrawal);

// 拒绝提现
router.patch('/withdrawals/:id/reject', authenticate, requireAdmin, adminController.rejectWithdrawal);

// 分销数据统计
router.get('/distribution/stats', authenticate, requireAdmin, adminController.getDistributionStats);

// 获取佣金设置
router.get('/distribution/settings', authenticate, requireAdmin, adminController.getDistributionSettings);

// 更新佣金设置
router.put('/distribution/settings', authenticate, requireAdmin, adminController.updateDistributionSettings);

// ========== Pipeline测试运行器 ==========
// ⚠️ 临时注释掉 - controller有TypeScript导入问题
/*
const pipelinesTestController = require('../controllers/admin/pipelines-test.controller');

// 测试运行Pipeline（艹！支持mock和真实模式！）
router.post('/pipelines/:id/test', authenticate, requireAdmin, pipelinesTestController.testPipeline);
*/

// ========== Pipeline拓扑校验（CMS-204）==========

const pipelinesValidateController = require('../controllers/admin/pipelines-validate.controller');

// 校验Pipeline拓扑结构（Kahn算法 + 变量可达性）
router.post('/pipelines/validate', authenticate, requireAdmin, pipelinesValidateController.validatePipeline);

// 获取拓扑排序（调试用）
router.post('/pipelines/topological-order', authenticate, requireAdmin, pipelinesValidateController.getTopologicalOrder);

// ========== 表单Schema管理（CMS-105）==========

const formSchemasController = require('../controllers/admin/formSchemas.controller');

// 获取表单Schema列表
router.get('/form-schemas', authenticate, requireAdmin, formSchemasController.listFormSchemas);

// 获取单个Schema（当前版本）
router.get('/form-schemas/:schemaId', authenticate, requireAdmin, formSchemasController.getFormSchema);

// 获取Schema所有版本
router.get('/form-schemas/:schemaId/versions', authenticate, requireAdmin, formSchemasController.getFormSchemaVersions);

// 创建新Schema
router.post('/form-schemas', authenticate, requireAdmin, formSchemasController.createFormSchema);

// 创建新版本
router.post('/form-schemas/:schemaId/versions', authenticate, requireAdmin, formSchemasController.createFormSchemaVersion);

// 发布Schema版本
router.patch('/form-schemas/:schemaId/versions/:version/publish', authenticate, requireAdmin, formSchemasController.publishFormSchemaVersion);

// 切换当前版本
router.patch('/form-schemas/:schemaId/versions/:version/switch', authenticate, requireAdmin, formSchemasController.switchFormSchemaVersion);

// 删除Schema（归档）
router.delete('/form-schemas/:schemaId', authenticate, requireAdmin, formSchemasController.deleteFormSchema);

// ========== Prompt模板管理（CMS-303）==========

const promptsController = require('../controllers/admin/prompts.controller');

// 预览Handlebars模板
router.post('/prompts/preview', authenticate, requireAdmin, promptsController.previewPrompt);

// 校验模板语法
router.post('/prompts/validate', authenticate, requireAdmin, promptsController.validatePrompt);

// 获取可用Helpers列表
router.get('/prompts/helpers', authenticate, requireAdmin, promptsController.getHelpers);

// ========== Prompt版本管理（CMS-304）==========
// ⚠️ 临时注释掉 - controller有TypeScript导入问题
/*
const promptVersionsController = require('../controllers/admin/promptVersions.controller');

// 艹！路由顺序很重要：具体路径必须在参数路径之前！

// 获取所有Prompt（当前版本）
router.get('/prompts', authenticate, requireAdmin, promptVersionsController.listPrompts);

// 创建新Prompt（第1版）
router.post('/prompts', authenticate, requireAdmin, promptVersionsController.createPrompt);

// 获取Prompt所有版本（艹！必须在 /:promptId 之前！）
router.get('/prompts/:promptId/versions', authenticate, requireAdmin, promptVersionsController.getPromptVersions);

// 创建新版本
router.post('/prompts/:promptId/versions', authenticate, requireAdmin, promptVersionsController.createPromptVersion);

// 发布版本（艹！必须在 /:promptId 之前！）
router.patch('/prompts/:promptId/versions/:version/publish', authenticate, requireAdmin, promptVersionsController.publishPromptVersion);

// 切换当前版本（回滚）
router.patch('/prompts/:promptId/versions/:version/switch', authenticate, requireAdmin, promptVersionsController.switchPromptVersion);

// 获取Prompt当前版本（艹！参数路径放最后！）
router.get('/prompts/:promptId', authenticate, requireAdmin, promptVersionsController.getPrompt);

// 删除Prompt（归档）
router.delete('/prompts/:promptId', authenticate, requireAdmin, promptVersionsController.deletePrompt);
*/

module.exports = router;
