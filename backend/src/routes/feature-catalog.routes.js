const express = require('express');
const { body, query, param } = require('express-validator');
const featureCatalogController = require('../controllers/feature-catalog.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const cacheMiddleware = require('../middlewares/cache.middleware');

const router = express.Router();

/**
 * 功能目录API路由
 *
 * 提供功能目录管理的RESTful API：
 * - 功能定义的CRUD操作
 * - 功能配置管理
 * - 权限验证和访问控制
 * - 使用统计查询
 */

// 公开的查询参数验证规则
const queryValidationRules = [
  query('category')
    .optional()
    .isIn(['image_processing', 'ai_generation', 'video_processing', 'audio_processing', 'text_processing', 'data_analysis', 'file_management', 'user_management', 'payment', 'integration'])
    .withMessage('分类必须是有效的值'),
  query('type')
    .optional()
    .isIn(['basic', 'premium', 'enterprise', 'beta'])
    .withMessage('类型必须是basic、premium、enterprise或beta'),
  query('is_public')
    .optional()
    .isBoolean()
    .withMessage('is_public必须是布尔值'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit必须是1-100之间的整数'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('offset必须是非负整数'),
  query('sort_by')
    .optional()
    .isIn(['name', 'category', 'type', 'released_at', 'created_at'])
    .withMessage('sort_by必须是有效的字段'),
  query('sort_order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('sort_order必须是asc或desc')
];

/**
 * @swagger
 * components:
 *   schemas:
 *     FeatureDefinition:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: 功能ID
 *         feature_key:
 *           type: string
 *           description: 功能唯一标识
 *         name:
 *           type: string
 *           description: 功能名称
 *         description:
 *           type: string
 *           description: 功能描述
 *         category:
 *           type: string
 *           enum: [image_processing, ai_generation, video_processing, audio_processing, text_processing, data_analysis, file_management, user_management, payment, integration]
 *           description: 功能分类
 *         type:
 *           type: string
 *           enum: [basic, premium, enterprise, beta]
 *           description: 功能类型
 *         is_active:
 *           type: boolean
 *           description: 是否激活
 *         is_public:
 *           type: boolean
 *           description: 是否公开
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: 功能标签
 *         icon:
 *           type: string
 *           description: 功能图标URL
 *         version:
 *           type: string
 *           description: 功能版本
 *         requirements:
 *           type: object
 *           description: 功能要求
 *         limits:
 *           type: object
 *           description: 使用限制
 *         pricing:
 *           type: object
 *           description: 定价信息
 *         released_at:
 *           type: string
 *           format: date-time
 *           description: 发布时间
 */

/**
 * @swagger
 * /api/features:
 *   get:
 *     tags:
 *       - 功能目录
 *     summary: 获取功能列表
 *     description: 获取系统中所有可用的功能列表，支持分类过滤和分页
 *     parameters:
 *       - name: category
 *         in: query
 *         schema:
 *           type: string
 *         description: 功能分类过滤
 *       - name: type
 *         in: query
 *         schema:
 *           type: string
 *         description: 功能类型过滤
 *       - name: is_public
 *         in: query
 *         schema:
 *           type: boolean
 *         description: 是否公开过滤
 *       - name: tags
 *         in: query
 *         schema:
 *           type: string
 *         description: 标签过滤（逗号分隔）
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 每页数量
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           default: 0
 *         description: 偏移量
 *       - name: sort_by
 *         in: query
 *         schema:
 *           type: string
 *           default: name
 *         description: 排序字段
 *       - name: sort_order
 *         in: query
 *         schema:
 *           type: string
 *           default: asc
 *         description: 排序方向
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
 *                         $ref: '#/components/schemas/FeatureDefinition'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         limit:
 *                           type: integer
 *                         offset:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/',
  cacheMiddleware.featureCache({ ttl: 1800 }), // 30分钟缓存
  queryValidationRules,
  featureCatalogController.getFeatures
);

/**
 * @swagger
 * /api/features/categories:
 *   get:
 *     tags:
 *       - 功能目录
 *     summary: 获取功能分类列表
 *     description: 获取所有可用的功能分类及其描述
 *     responses:
 *       200:
 *         description: 分类列表获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       value:
 *                         type: string
 *                       label:
 *                         type: string
 *                       description:
 *                         type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/categories',
  cacheMiddleware.featureCache({ ttl: 3600 }), // 1小时缓存
  featureCatalogController.getFeatureCategories
);

/**
 * @swagger
 * /api/features/{featureKey}:
 *   get:
 *     tags:
 *       - 功能目录
 *     summary: 获取功能详情
 *     description: 根据功能key获取详细的功能信息、配置和权限设置
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: featureKey
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: 功能唯一标识
 *     responses:
 *       200:
 *         description: 功能详情获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/FeatureDefinition'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: 功能不存在
 *       403:
 *         description: 访问被拒绝
 */
router.get('/:featureKey',
  authMiddleware.authenticate,
  [
    param('featureKey')
      .notEmpty()
      .withMessage('功能key不能为空')
      .isLength({ min: 1, max: 100 })
      .withMessage('功能key长度必须在1-100字符之间')
  ],
  featureCatalogController.getFeatureByKey
);

/**
 * @swagger
 * /api/features/{featureKey}/access:
 *   get:
 *     tags:
 *       - 功能目录
 *     summary: 检查功能访问权限
 *     description: 检查当前用户是否有权限访问指定功能
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: featureKey
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: 功能唯一标识
 *     responses:
 *       200:
 *         description: 权限检查完成
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
 *                     featureKey:
 *                       type: string
 *                     hasAccess:
 *                       type: boolean
 *                     userId:
 *                       type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: 需要登录
 */
router.get('/:featureKey/access',
  authMiddleware.authenticate,
  [
    param('featureKey')
      .notEmpty()
      .withMessage('功能key不能为空')
  ],
  featureCatalogController.checkFeatureAccess
);

/**
 * @swagger
 * /api/features/{featureKey}/usage:
 *   post:
 *     tags:
 *       - 功能目录
 *     summary: 记录功能使用
 *     description: 记录用户对功能的使用情况，用于统计分析
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: featureKey
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: 功能唯一标识
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               usageCount:
 *                 type: integer
 *                 default: 1
 *                 description: 使用次数
 *               metrics:
 *                 type: object
 *                 description: 使用指标
 *               cost:
 *                 type: number
 *                 default: 0
 *                 description: 成本
 *               status:
 *                 type: string
 *                 enum: [success, failed, partial]
 *                 default: success
 *                 description: 使用状态
 *               errorDetails:
 *                 type: object
 *                 description: 错误详情
 *     responses:
 *       200:
 *         description: 使用记录成功
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
 *         description: 需要登录
 */
router.post('/:featureKey/usage',
  authMiddleware.authenticate,
  [
    param('featureKey')
      .notEmpty()
      .withMessage('功能key不能为空'),
    body('usageCount')
      .optional()
      .isInt({ min: 1 })
      .withMessage('usageCount必须是正整数'),
    body('cost')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('cost必须是非负数'),
    body('status')
      .optional()
      .isIn(['success', 'failed', 'partial'])
      .withMessage('status必须是success、failed或partial')
  ],
  featureCatalogController.recordFeatureUsage
);

// ==================== 管理员API ====================

/**
 * @swagger
 * /api/admin/features:
 *   post:
 *     tags:
 *       - 功能管理
 *     summary: 创建功能定义
 *     description: 管理员创建新的功能定义
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - feature_key
 *               - name
 *               - category
 *             properties:
 *               feature_key:
 *                 type: string
 *                 description: 功能唯一标识
 *               name:
 *                 type: string
 *                 description: 功能名称
 *               description:
 *                 type: string
 *                 description: 功能描述
 *               category:
 *                 type: string
 *                 enum: [image_processing, ai_generation, video_processing, audio_processing, text_processing, data_analysis, file_management, user_management, payment, integration]
 *                 description: 功能分类
 *               type:
 *                 type: string
 *                 enum: [basic, premium, enterprise, beta]
 *                 default: basic
 *                 description: 功能类型
 *               is_active:
 *                 type: boolean
 *                 default: true
 *                 description: 是否激活
 *               is_public:
 *                 type: boolean
 *                 default: true
 *                 description: 是否公开
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 功能标签
 *               icon:
 *                 type: string
 *                 description: 功能图标URL
 *               requirements:
 *                 type: object
 *                 description: 功能要求
 *               limits:
 *                 type: object
 *                 description: 使用限制
 *               pricing:
 *                 type: object
 *                 description: 定价信息
 *     responses:
 *       201:
 *         description: 功能创建成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/FeatureDefinition'
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: 请求参数无效
 *       401:
 *         description: 需要管理员权限
 *       409:
 *         description: 功能key已存在
 */
router.post('/',
  authMiddleware.authenticate,
  authMiddleware.requireRole(['admin']),
  [
    body('feature_key')
      .notEmpty()
      .withMessage('功能key不能为空')
      .isLength({ min: 1, max: 100 })
      .withMessage('功能key长度必须在1-100字符之间')
      .matches(/^[a-zA-Z0-9_-]+$/)
      .withMessage('功能key只能包含字母、数字、下划线和连字符'),
    body('name')
      .notEmpty()
      .withMessage('功能名称不能为空')
      .isLength({ min: 1, max: 200 })
      .withMessage('功能名称长度必须在1-200字符之间'),
    body('category')
      .notEmpty()
      .withMessage('功能分类不能为空')
      .isIn(['image_processing', 'ai_generation', 'video_processing', 'audio_processing', 'text_processing', 'data_analysis', 'file_management', 'user_management', 'payment', 'integration'])
      .withMessage('功能分类必须是有效值'),
    body('type')
      .optional()
      .isIn(['basic', 'premium', 'enterprise', 'beta'])
      .withMessage('功能类型必须是basic、premium、enterprise或beta'),
    body('is_active')
      .optional()
      .isBoolean()
      .withMessage('is_active必须是布尔值'),
    body('is_public')
      .optional()
      .isBoolean()
      .withMessage('is_public必须是布尔值'),
    body('description')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('描述长度不能超过1000字符'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('tags必须是数组')
  ],
  featureCatalogController.createFeature
);

/**
 * @swagger
 * /api/admin/features/{featureKey}:
 *   put:
 *     tags:
 *       - 功能管理
 *     summary: 更新功能定义
 *     description: 管理员更新现有功能定义
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: featureKey
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: 功能唯一标识
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: 功能名称
 *               description:
 *                 type: string
 *                 description: 功能描述
 *               category:
 *                 type: string
 *                 enum: [image_processing, ai_generation, video_processing, audio_processing, text_processing, data_analysis, file_management, user_management, payment, integration]
 *                 description: 功能分类
 *               type:
 *                 type: string
 *                 enum: [basic, premium, enterprise, beta]
 *                 description: 功能类型
 *               is_active:
 *                 type: boolean
 *                 description: 是否激活
 *               is_public:
 *                 type: boolean
 *                 description: 是否公开
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 功能标签
 *               icon:
 *                 type: string
 *                 description: 功能图标URL
 *     responses:
 *       200:
 *         description: 功能更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/FeatureDefinition'
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: 功能不存在
 *       401:
 *         description: 需要管理员权限
 */
router.put('/:featureKey',
  authMiddleware.authenticate,
  authMiddleware.requireRole(['admin']),
  [
    param('featureKey')
      .notEmpty()
      .withMessage('功能key不能为空'),
    body('name')
      .optional()
      .isLength({ min: 1, max: 200 })
      .withMessage('功能名称长度必须在1-200字符之间'),
    body('category')
      .optional()
      .isIn(['image_processing', 'ai_generation', 'video_processing', 'audio_processing', 'text_processing', 'data_analysis', 'file_management', 'user_management', 'payment', 'integration'])
      .withMessage('功能分类必须是有效值'),
    body('type')
      .optional()
      .isIn(['basic', 'premium', 'enterprise', 'beta'])
      .withMessage('功能类型必须是basic、premium、enterprise或beta'),
    body('is_active')
      .optional()
      .isBoolean()
      .withMessage('is_active必须是布尔值'),
    body('is_public')
      .optional()
      .isBoolean()
      .withMessage('is_public必须是布尔值')
  ],
  featureCatalogController.updateFeature
);

/**
 * @swagger
 * /api/admin/features/{featureKey}:
 *   delete:
 *     tags:
 *       - 功能管理
 *     summary: 删除功能定义
 *     description: 管理员删除功能定义（软删除）
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: featureKey
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: 功能唯一标识
 *     responses:
 *       200:
 *         description: 功能删除成功
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
 *                     deleted:
 *                       type: boolean
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: 功能不存在
 *       401:
 *         description: 需要管理员权限
 */
router.delete('/:featureKey',
  authMiddleware.authenticate,
  authMiddleware.requireRole(['admin']),
  [
    param('featureKey')
      .notEmpty()
      .withMessage('功能key不能为空')
  ],
  featureCatalogController.deleteFeature
);

/**
 * @swagger
 * /api/admin/features/{featureKey}/configurations:
 *   post:
 *     tags:
 *       - 功能管理
 *     summary: 设置功能配置
 *     description: 管理员设置功能的配置参数
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: featureKey
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: 功能唯一标识
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - configurations
 *             properties:
 *               configurations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     config_key:
 *                       type: string
 *                       description: 配置键
 *                     config_value:
 *                       type: string
 *                       description: 配置值
 *                     data_type:
 *                       type: string
 *                       enum: [string, number, boolean, json, array]
 *                       default: string
 *                       description: 数据类型
 *                     description:
 *                       type: string
 *                       description: 配置描述
 *                     is_required:
 *                       type: boolean
 *                       default: false
 *                       description: 是否必需
 *                     is_sensitive:
 *                       type: boolean
 *                       default: false
 *                       description: 是否敏感信息
 *                     validation_rules:
 *                       type: object
 *                       description: 验证规则
 *                     default_value:
 *                       type: string
 *                       description: 默认值
 *                     enum_values:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: 枚举值
 *                     sort_order:
 *                       type: integer
 *                       default: 0
 *                       description: 排序
 *     responses:
 *       200:
 *         description: 配置设置成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     description: 配置列表
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: 请求参数无效
 *       404:
 *         description: 功能不存在
 *       401:
 *         description: 需要管理员权限
 */
router.post('/:featureKey/configurations',
  authMiddleware.authenticate,
  authMiddleware.requireRole(['admin']),
  [
    param('featureKey')
      .notEmpty()
      .withMessage('功能key不能为空'),
    body('configurations')
      .isArray()
      .withMessage('configurations必须是数组'),
    body('configurations.*.config_key')
      .notEmpty()
      .withMessage('配置键不能为空'),
    body('configurations.*.data_type')
      .optional()
      .isIn(['string', 'number', 'boolean', 'json', 'array'])
      .withMessage('数据类型必须是string、number、boolean、json或array')
  ],
  featureCatalogController.setFeatureConfigurations
);

/**
 * @swagger
 * /api/admin/features/stats:
 *   get:
 *     tags:
 *       - 功能管理
 *     summary: 获取使用统计
 *     description: 管理员获取功能使用统计信息
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: feature_key
 *         in: query
 *         schema:
 *           type: string
 *         description: 功能key过滤
 *       - name: user_id
 *         in: query
 *         schema:
 *           type: string
 *         description: 用户ID过滤
 *       - name: start_date
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *         description: 开始日期
 *       - name: end_date
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *         description: 结束日期
 *       - name: group_by
 *         in: query
 *         schema:
 *           type: string
 *           enum: [day, feature, user]
 *           default: day
 *         description: 分组方式
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
 *                     stats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         description: 统计数据
 *                     filters:
 *                       type: object
 *                       description: 过滤条件
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: 需要管理员权限
 */
router.get('/stats',
  authMiddleware.authenticate,
  authMiddleware.requireRole(['admin']),
  [
    query('group_by')
      .optional()
      .isIn(['day', 'feature', 'user'])
      .withMessage('group_by必须是day、feature或user')
  ],
  featureCatalogController.getUsageStats
);

/**
 * @swagger
 * /api/admin/features/service-stats:
 *   get:
 *     tags:
 *       - 功能管理
 *     summary: 获取服务统计信息
 *     description: 管理员获取功能目录服务的运行统计
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 服务统计获取成功
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
 *                     cachedFeatures:
 *                       type: integer
 *                     lastCacheUpdate:
 *                       type: integer
 *                     cacheUpdateInterval:
 *                       type: integer
 *                     cachePrefix:
 *                       type: string
 *                     cacheTTL:
 *                       type: integer
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: 需要管理员权限
 */
router.get('/service-stats',
  authMiddleware.authenticate,
  authMiddleware.requireRole(['admin']),
  featureCatalogController.getServiceStats
);

module.exports = router;