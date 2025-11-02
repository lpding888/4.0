const express = require('express');
const router = express.Router();
const assetController = require('../controllers/asset.controller');
const { authenticate } = require('../middlewares/auth.middleware');

/**
 * Assets Routes - 素材库路由
 * 所有路由都需要登录认证
 */

// 获取当前用户的素材列表
router.get('/', authenticate, assetController.getAssets);

// 删除素材
router.delete('/:assetId', authenticate, assetController.deleteAsset);

module.exports = router;
