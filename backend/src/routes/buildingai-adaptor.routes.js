const express = require('express');
const { body } = require('express-validator');
const buildingAIAdaptorController = require('../controllers/buildingai-adaptor.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const cacheMiddleware = require('../middlewares/cache.middleware');

const router = express.Router();

/**
 * BuildingAI适配层API路由
 *
 * 提供BuildingAI服务的统一API接口：
 * - 图片处理（增强、生成、编辑）
 * - 文本处理（生成、翻译、摘要）
 * - 音频处理（转录）
 * - 视频处理（分析）
 * - 数据分析
 */

// 验证规则
const imageValidationRules = [
  body('imageUrl')
    .optional()
    .isURL()
    .withMessage('imageUrl必须是有效的URL'),
  body('imageBase64')
    .optional()
    .isBase64()
    .withMessage('imageBase64必须是有效的Base64编码'),
  body('level')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('level必须是low、medium或high'),
  body('outputFormat')
    .optional()
    .isIn(['png', 'jpg', 'jpeg', 'webp'])
    .withMessage('outputFormat必须是有效的图片格式')
];

const textValidationRules = [
  body('prompt')
    .notEmpty()
    .withMessage('prompt不能为空')
    .isLength({ min: 1, max: 4000 })
    .withMessage('prompt长度必须在1-4000字符之间'),
  body('maxTokens')
    .optional()
    .isInt({ min: 1, max: 4000 })
    .withMessage('maxTokens必须是1-4000之间的整数'),
  body('temperature')
    .optional()
    .isFloat({ min: 0, max: 2 })
    .withMessage('temperature必须是0-2之间的数字')
];

/**
 * @swagger
 * components:
 *   schemas:
 *     ImageEnhanceRequest:
 *       type: object
 *       required:
 *         - imageUrl or imageBase64
 *       properties:
 *         imageUrl:
 *           type: string
 *           format: uri
 *           description: 图片URL
 *         imageBase64:
 *           type: string
 *           description: Base64编码的图片数据
 *         level:
 *           type: string
 *           enum: [low, medium, high]
 *           default: medium
 *           description: 增强级别
 *         outputFormat:
 *           type: string
 *           enum: [png, jpg, jpeg, webp]
 *           default: png
 *           description: 输出格式
 *
 *     ImageGenerateRequest:
 *       type: object
 *       required:
 *         - prompt
 *       properties:
 *         prompt:
 *           type: string
 *           description: 图片描述文本
 *         style:
 *           type: string
 *           enum: [realistic, artistic, cartoon, abstract]
 *           default: realistic
 *           description: 图片风格
 *         size:
 *           type: string
 *           enum: [512x512, 1024x1024, 1024x1792, 1792x1024]
 *           default: 1024x1024
 *           description: 图片尺寸
 *         quality:
 *           type: string
 *           enum: [standard, hd]
 *           default: standard
 *           description: 图片质量
 *         count:
 *           type: integer
 *           minimum: 1
 *           maximum: 4
 *           default: 1
 *           description: 生成数量
 *
 *     TextGenerateRequest:
 *       type: object
 *       required:
 *         - prompt
 *       properties:
 *         prompt:
 *           type: string
 *           description: 文本提示
 *         maxTokens:
 *           type: integer
 *           minimum: 1
 *           maximum: 4000
 *           default: 500
 *           description: 最大生成token数
 *         temperature:
 *           type: number
 *           minimum: 0
 *           maximum: 2
 *           default: 0.7
 *           description: 生成随机性
 *         model:
 *           type: string
 *           default: gpt-3.5-turbo
 *           description: 使用的模型
 */

// ==================== 图片处理API ====================

/**
 * @swagger
 * /api/ai/image/enhance:
 *   post:
 *     tags:
 *       - AI图片处理
 *     summary: 图片增强
 *     description: 增强图片质量，提高清晰度和细节
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ImageEnhanceRequest'
 *     responses:
 *       200:
 *         description: 图片增强成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                     enhancedImage:
 *                       type: string
 *                       description: 增强后的图片URL
 *                     metadata:
 *                       type: object
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: 请求参数无效
 *       401:
 *         description: 需要登录
 *       429:
 *         description: 请求过于频繁
 *       500:
 *         description: 服务器错误
 */
router.post('/image/enhance',
  authMiddleware.authenticate,
  cacheMiddleware.userCache({ ttl: 600 }), // 10分钟缓存
  [
    ...imageValidationRules,
    body().custom((value, { req }) => {
      if (!req.body.imageUrl && !req.body.imageBase64) {
        throw new Error('imageUrl和imageBase64必须提供其中一个');
      }
      return true;
    })
  ],
  buildingAIAdaptorController.enhanceImage
);

/**
 * @swagger
 * /api/ai/image/generate:
 *   post:
 *     tags:
 *       - AI图片处理
 *     summary: 图片生成
 *     description: 根据文本描述生成高质量图片
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ImageGenerateRequest'
 *     responses:
 *       200:
 *         description: 图片生成成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                     images:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           url:
 *                             type: string
 *                           size:
 *                             type: string
 *                           revisedPrompt:
 *                             type: string
 *                     metadata:
 *                       type: object
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.post('/image/generate',
  authMiddleware.authenticate,
  [
    body('prompt')
      .notEmpty()
      .withMessage('prompt不能为空')
      .isLength({ min: 1, max: 1000 })
      .withMessage('prompt长度必须在1-1000字符之间'),
    body('style')
      .optional()
      .isIn(['realistic', 'artistic', 'cartoon', 'abstract'])
      .withMessage('style必须是有效值'),
    body('size')
      .optional()
      .isIn(['512x512', '1024x1024', '1024x1792', '1792x1024'])
      .withMessage('size必须是有效值'),
    body('quality')
      .optional()
      .isIn(['standard', 'hd'])
      .withMessage('quality必须是standard或hd'),
    body('count')
      .optional()
      .isInt({ min: 1, max: 4 })
      .withMessage('count必须是1-4之间的整数')
  ],
  buildingAIAdaptorController.generateImage
);

/**
 * @swagger
 * /api/ai/image/edit:
 *   post:
 *     tags:
 *       - AI图片处理
 *     summary: 图片编辑
 *     description: 编辑和修改现有图片
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - imageUrl or imageBase64
 *               - prompt
 *             properties:
 *               imageUrl:
 *                 type: string
 *                 format: uri
 *                 description: 原始图片URL
 *               imageBase64:
 *                 type: string
 *                 description: Base64编码的原始图片
 *               maskUrl:
 *                 type: string
 *                 format: uri
 *                 description: 蒙版图片URL
 *               maskBase64:
 *                 type: string
 *                 description: Base64编码的蒙版图片
 *               prompt:
 *                 type: string
 *                 description: 编辑描述
 *               count:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 4
 *                 default: 1
 *                 description: 生成数量
 *     responses:
 *       200:
 *         description: 图片编辑成功
 */
router.post('/image/edit',
  authMiddleware.authenticate,
  [
    ...imageValidationRules,
    body('prompt')
      .notEmpty()
      .withMessage('prompt不能为空')
      .isLength({ min: 1, max: 1000 })
      .withMessage('prompt长度必须在1-1000字符之间'),
    body('count')
      .optional()
      .isInt({ min: 1, max: 4 })
      .withMessage('count必须是1-4之间的整数')
  ],
  buildingAIAdaptorController.editImage
);

// ==================== 文本处理API ====================

/**
 * @swagger
 * /api/ai/text/generate:
 *   post:
 *     tags:
 *       - AI文本处理
 *     summary: 文本生成
 *     description: 生成各种类型的文本内容
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TextGenerateRequest'
 *     responses:
 *       200:
 *         description: 文本生成成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                     text:
 *                       type: string
 *                       description: 生成的文本
 *                     metadata:
 *                       type: object
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.post('/text/generate',
  authMiddleware.authenticate,
  textValidationRules,
  buildingAIAdaptorController.generateText
);

/**
 * @swagger
 * /api/ai/text/translate:
 *   post:
 *     tags:
 *       - AI文本处理
 *     summary: 文本翻译
 *     description: 翻译文本到多种语言
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *               - targetLanguage
 *             properties:
 *               text:
 *                 type: string
 *                 description: 要翻译的文本
 *               sourceLanguage:
 *                 type: string
 *                 default: auto
 *                 description: 源语言
 *               targetLanguage:
 *                 type: string
 *                 description: 目标语言
 *               format:
 *                 type: string
 *                 enum: [text, html, markdown]
 *                 default: text
 *                 description: 输出格式
 *     responses:
 *       200:
 *         description: 文本翻译成功
 */
router.post('/text/translate',
  authMiddleware.authenticate,
  [
    body('text')
      .notEmpty()
      .withMessage('text不能为空')
      .isLength({ min: 1, max: 10000 })
      .withMessage('text长度必须在1-10000字符之间'),
    body('sourceLanguage')
      .optional()
      .isLength({ min: 2, max: 10 })
      .withMessage('sourceLanguage长度必须在2-10字符之间'),
    body('targetLanguage')
      .notEmpty()
      .withMessage('targetLanguage不能为空')
      .isLength({ min: 2, max: 10 })
      .withMessage('targetLanguage长度必须在2-10字符之间'),
    body('format')
      .optional()
      .isIn(['text', 'html', 'markdown'])
      .withMessage('format必须是text、html或markdown')
  ],
  buildingAIAdaptorController.translateText
);

/**
 * @swagger
 * /api/ai/text/summarize:
 *   post:
 *     tags:
 *       - AI文本处理
 *     summary: 文本摘要
 *     description: 生成长文本的摘要和要点
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: 要摘要的文本
 *               length:
 *                 type: string
 *                 enum: [short, medium, long]
 *                 default: medium
 *                 description: 摘要长度
 *               style:
 *                 type: string
 *                 enum: [professional, casual, academic]
 *                 default: professional
 *                 description: 摘要风格
 *     responses:
 *       200:
 *         description: 文本摘要成功
 */
router.post('/text/summarize',
  authMiddleware.authenticate,
  [
    body('text')
      .notEmpty()
      .withMessage('text不能为空')
      .isLength({ min: 100, max: 50000 })
      .withMessage('text长度必须在100-50000字符之间'),
    body('length')
      .optional()
      .isIn(['short', 'medium', 'long'])
      .withMessage('length必须是short、medium或long'),
    body('style')
      .optional()
      .isIn(['professional', 'casual', 'academic'])
      .withMessage('style必须是professional、casual或academic')
  ],
  buildingAIAdaptorController.summarizeText
);

// ==================== 音频处理API ====================

/**
 * @swagger
 * /api/ai/audio/transcribe:
 *   post:
 *     tags:
 *       - AI音频处理
 *     summary: 音频转录
 *     description: 将音频转换为文本
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - audioUrl or audioBase64
 *             properties:
 *               audioUrl:
 *                 type: string
 *                 format: uri
 *                 description: 音频文件URL
 *               audioBase64:
 *                 type: string
 *                 description: Base64编码的音频数据
 *               language:
 *                 type: string
 *                 default: auto
 *                 description: 音频语言
 *               outputFormat:
 *                 type: string
 *                 enum: [text, srt, vtt]
 *                 default: text
 *                 description: 输出格式
 *     responses:
 *       200:
 *         description: 音频转录成功
 */
router.post('/audio/transcribe',
  authMiddleware.authenticate,
  [
    body('audioUrl')
      .optional()
      .isURL()
      .withMessage('audioUrl必须是有效的URL'),
    body('audioBase64')
      .optional()
      .isBase64()
      .withMessage('audioBase64必须是有效的Base64编码'),
    body('language')
      .optional()
      .isLength({ min: 2, max: 10 })
      .withMessage('language长度必须在2-10字符之间'),
    body('outputFormat')
      .optional()
      .isIn(['text', 'srt', 'vtt'])
      .withMessage('outputFormat必须是text、srt或vtt'),
    body().custom((value, { req }) => {
      if (!req.body.audioUrl && !req.body.audioBase64) {
        throw new Error('audioUrl和audioBase64必须提供其中一个');
      }
      return true;
    })
  ],
  buildingAIAdaptorController.transcribeAudio
);

// ==================== 视频处理API ====================

/**
 * @swagger
 * /api/ai/video/analyze:
 *   post:
 *     tags:
 *       - AI视频处理
 *     summary: 视频分析
 *     description: 分析视频内容和特征
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - videoUrl or videoBase64
 *             properties:
 *               videoUrl:
 *                 type: string
 *                 format: uri
 *                 description: 视频文件URL
 *               videoBase64:
 *                 type: string
 *                 description: Base64编码的视频数据
 *               analysisType:
 *                 type: string
 *                 enum: [content, scene, object, audio]
 *                 default: content
 *                 description: 分析类型
 *               detailLevel:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 default: medium
 *                 description: 详细程度
 *     responses:
 *       200:
 *         description: 视频分析成功
 */
router.post('/video/analyze',
  authMiddleware.authenticate,
  [
    body('videoUrl')
      .optional()
      .isURL()
      .withMessage('videoUrl必须是有效的URL'),
    body('videoBase64')
      .optional()
      .isBase64()
      .withMessage('videoBase64必须是有效的Base64编码'),
    body('analysisType')
      .optional()
      .isIn(['content', 'scene', 'object', 'audio'])
      .withMessage('analysisType必须是有效值'),
    body('detailLevel')
      .optional()
      .isIn(['low', 'medium', 'high'])
      .withMessage('detailLevel必须是low、medium或high'),
    body().custom((value, { req }) => {
      if (!req.body.videoUrl && !req.body.videoBase64) {
        throw new Error('videoUrl和videoBase64必须提供其中一个');
      }
      return true;
    })
  ],
  buildingAIAdaptorController.analyzeVideo
);

// ==================== 数据分析API ====================

/**
 * @swagger
 * /api/ai/data/analyze:
 *   post:
 *     tags:
 *       - AI数据分析
 *     summary: 数据分析
 *     description: 对数据进行分析和处理
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - data
 *             properties:
 *               data:
 *                 type: object
 *                 description: 要分析的数据
 *               analysisType:
 *                 type: string
 *                 enum: [statistical, predictive, descriptive]
 *                 default: statistical
 *                 description: 分析类型
 *               outputFormat:
 *                 type: string
 *                 enum: [json, csv, xml]
 *                 default: json
 *                 description: 输出格式
 *     responses:
 *       200:
 *         description: 数据分析成功
 */
router.post('/data/analyze',
  authMiddleware.authenticate,
  [
    body('data')
      .notEmpty()
      .withMessage('data不能为空')
      .isObject()
      .withMessage('data必须是对象'),
    body('analysisType')
      .optional()
      .isIn(['statistical', 'predictive', 'descriptive'])
      .withMessage('analysisType必须是有效值'),
    body('outputFormat')
      .optional()
      .isIn(['json', 'csv', 'xml'])
      .withMessage('outputFormat必须是json、csv或xml')
  ],
  buildingAIAdaptorController.analyzeData
);

// ==================== 通用API ====================

/**
 * @swagger
 * /api/ai/features:
 *   get:
 *     tags:
 *       - AI服务
 *     summary: 获取支持的功能列表
 *     description: 获取BuildingAI支持的所有AI功能
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 功能列表获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     features:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           key:
 *                             type: string
 *                           name:
 *                             type: string
 *                           description:
 *                             type: string
 *                           category:
 *                             type: string
 *                     count:
 *                       type: integer
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/features',
  authMiddleware.authenticate,
  cacheMiddleware.featureCache({ ttl: 3600 }), // 1小时缓存
  buildingAIAdaptorController.getSupportedFeatures
);

// ==================== 管理员API ====================

/**
 * @swagger
 * /api/admin/ai/stats:
 *   get:
 *     tags:
 *       - AI管理
 *     summary: 获取AI服务统计信息
 *     description: 管理员获取BuildingAI服务的运行统计
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 统计信息获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     initialized:
 *                       type: boolean
 *                     totalRequests:
 *                       type: integer
 *                     successfulRequests:
 *                       type: integer
 *                     failedRequests:
 *                       type: integer
 *                     averageResponseTime:
 *                       type: number
 *                     lastRequestTime:
 *                       type: string
 *                       format: date-time
 *                     errorsByType:
 *                       type: object
 *                     rateLimit:
 *                       type: object
 *                     supportedFeatures:
 *                       type: array
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: 需要管理员权限
 */
router.get('/stats',
  authMiddleware.authenticate,
  authMiddleware.requireRole(['admin']),
  buildingAIAdaptorController.getServiceStats
);

/**
 * @swagger
 * /api/admin/ai/reset-stats:
 *   post:
 *     tags:
 *       - AI管理
 *     summary: 重置AI服务统计信息
 *     description: 管理员重置BuildingAI服务的统计信息
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 统计信息重置成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: 需要管理员权限
 */
router.post('/reset-stats',
  authMiddleware.authenticate,
  authMiddleware.requireRole(['admin']),
  buildingAIAdaptorController.resetStats
);

module.exports = router;