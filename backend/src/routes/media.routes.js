const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/media.controller');
const { authenticate } = require('../middlewares/auth.middleware');

/**
 * 媒体路由 - 处理COS上传相关请求
 * 所有接口都需要登录
 */

// 获取STS临时密钥
router.get('/sts', authenticate, mediaController.getSTS);

// 验证文件上传参数
router.post('/validate', authenticate, mediaController.validateUpload);

module.exports = router;
