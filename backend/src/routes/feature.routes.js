const express = require('express');
const router = express.Router();
const featureController = require('../controllers/feature.controller');
const { authenticate } = require('../middlewares/auth.middleware');

/**
 * Feature Routes - 功能卡片路由
 * 艹！获取功能列表不需要登录，方便首页展示！
 */

// GET /api/features - 获取用户可用的功能卡片列表（公开接口，无需登录）
router.get('/', featureController.getFeatures);

// GET /api/features/:featureId/form-schema - 获取功能的表单Schema（需要登录）
router.get('/:featureId/form-schema', authenticate, featureController.getFormSchema);

module.exports = router;
