const express = require('express');
const router = express.Router();
const systemConfigController = require('../controllers/systemConfig.controller');
const { authenticate } = require('../middlewares/auth.middleware');

/**
 * 系统配置路由
 * 提供动态配置管理功能
 * 注意：固定路径必须在参数路径之前定义，避免路由冲突
 */

// 获取配置列表 (需要管理员权限，这里简化为登录即可)
router.get('/', authenticate, systemConfigController.list);

// 获取配置分类
router.get('/categories', authenticate, systemConfigController.getCategories);

// 获取分类配置
router.get('/category/:category', authenticate, systemConfigController.getCategory);

// 重新加载配置缓存
router.post('/reload-cache', authenticate, systemConfigController.reloadCache);

// 导出配置 (必须在 /:key 之前)
router.get('/export', authenticate, systemConfigController.export);

// 导入配置
router.post('/import', authenticate, systemConfigController.import);

// 批量设置配置
router.post('/batch', authenticate, systemConfigController.setBatch);

// 获取单个配置值 (必须在所有固定路径之后)
router.get('/:key', authenticate, systemConfigController.getValue);

// 设置配置值
router.put('/:key', authenticate, systemConfigController.setValue);

// 删除配置
router.delete('/:key', authenticate, systemConfigController.delete);

module.exports = router;