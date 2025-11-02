/**
 * Provider管理路由
 * 艹，这个tm处理Provider配置的所有HTTP请求！
 */

import { Router } from 'express';
import providersController from '../controllers/providers.controller';

const router = Router();

/**
 * Provider管理路由
 * 所有路由都需要admin权限
 *
 * 注意：中间件（authenticate, requireAdmin）需要在app.js中统一应用到/admin路径
 */

// 列出所有Provider端点
router.get('/', providersController.listProviders.bind(providersController));

// 创建Provider端点
router.post('/', providersController.createProvider.bind(providersController));

// 获取单个Provider端点
router.get('/:provider_ref', providersController.getProvider.bind(providersController));

// 更新Provider端点
router.put('/:provider_ref', providersController.updateProvider.bind(providersController));

// 删除Provider端点
router.delete('/:provider_ref', providersController.deleteProvider.bind(providersController));

// 测试Provider连接
router.post('/:provider_ref/test-connection', providersController.testConnection.bind(providersController));

export default router;
