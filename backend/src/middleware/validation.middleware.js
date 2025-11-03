const logger = require('../utils/logger');
const { body, param, query, validationResult } = require('express-validator');

/**
 * 验证中间件
 *
 * 提供各种API请求的参数验证功能
 */

/**
 * 处理验证错误
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('[Validation] 请求参数验证失败:', {
      url: req.url,
      method: req.method,
      errors: errors.array(),
      body: req.body,
      params: req.params,
      query: req.query
    });

    return res.status(400).json({
      success: false,
      error: '请求参数验证失败',
      details: errors.array().map(error => ({
        field: error.param,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

/**
 * 熔断器操作验证
 */
const validateCircuitBreakerOperation = [
  // 对于POST操作，验证body中的reason字段
  body('reason')
    .optional()
    .isString()
    .withMessage('reason必须是字符串')
    .isLength({ max: 200 })
    .withMessage('reason长度不能超过200字符'),

  // 对于批量操作，验证names数组
  body('names')
    .optional()
    .isArray({ min: 1 })
    .withMessage('names必须是非空数组')
    .custom((names) => {
      if (names.length > 50) {
        throw new Error('批量操作最多支持50个项目');
      }
      return true;
    }),

  body('names.*')
    .optional()
    .isString()
    .withMessage('names中的每一项都必须是字符串')
    .isLength({ min: 1, max: 100 })
    .withMessage('names中的每一项长度必须在1-100字符之间'),

  // 验证operation字段
  body('operation')
    .optional()
    .isIn(['open', 'close', 'reset'])
    .withMessage('operation必须是open、close或reset之一'),

  // 对于清理操作，验证threshold参数
  query('inactiveThresholdMs')
    .optional()
    .isInt({ min: 60000 }) // 最少1分钟
    .withMessage('inactiveThresholdMs必须大于等于60000（1分钟）')
    .isInt({ max: 86400000 }) // 最多24小时
    .withMessage('inactiveThresholdMs必须小于等于86400000（24小时）'),

  handleValidationErrors
];

/**
 * 熔断器名称参数验证
 */
const validateCircuitBreakerName = [
  param('name')
    .isString()
    .withMessage('熔断器名称必须是字符串')
    .isLength({ min: 1, max: 100 })
    .withMessage('熔断器名称长度必须在1-100字符之间')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('熔断器名称只能包含字母、数字、下划线和连字符'),

  handleValidationErrors
];

/**
 * Provider名称参数验证
 */
const validateProviderName = [
  param('name')
    .isString()
    .withMessage('Provider名称必须是字符串')
    .isLength({ min: 1, max: 100 })
    .withMessage('Provider名称长度必须在1-100字符之间')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Provider名称只能包含字母、数字、下划线和连字符'),

  handleValidationErrors
];

/**
 * Provider方法执行验证
 */
const validateProviderMethodExecution = [
  param('providerName')
    .isString()
    .withMessage('Provider名称必须是字符串')
    .isLength({ min: 1, max: 100 })
    .withMessage('Provider名称长度必须在1-100字符之间'),

  param('methodName')
    .isString()
    .withMessage('方法名称必须是字符串')
    .isLength({ min: 1, max: 100 })
    .withMessage('方法名称长度必须在1-100字符之间')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('方法名称只能包含字母、数字和下划线'),

  body('args')
    .optional()
    .isArray()
    .withMessage('args必须是数组'),

  body('args.*')
    .optional()
    .custom((value) => {
      // 检查参数是否可序列化
      try {
        JSON.stringify(value);
        return true;
      } catch (error) {
        throw new Error('args中的参数必须可序列化');
      }
    }),

  body('options')
    .optional()
    .isObject()
    .withMessage('options必须是对象'),

  body('options.timeout')
    .optional()
    .isInt({ min: 1000, max: 300000 })
    .withMessage('timeout必须在1000-300000毫秒之间'),

  body('options.maxAttempts')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('maxAttempts必须在1-10之间'),

  body('options.skipCache')
    .optional()
    .isBoolean()
    .withMessage('skipCache必须是布尔值'),

  handleValidationErrors
];

/**
 * 用户注册验证
 */
const validateUserRegistration = [
  body('email')
    .isEmail()
    .withMessage('请输入有效的邮箱地址')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('邮箱长度不能超过255字符'),

  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('密码长度必须在8-128字符之间')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('密码必须包含至少一个大写字母、一个小写字母和一个数字'),

  body('username')
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage('用户名长度必须在3-50字符之间')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('用户名只能包含字母、数字、下划线和连字符'),

  body('inviteCode')
    .optional()
    .isLength({ min: 6, max: 20 })
    .withMessage('邀请码长度必须在6-20字符之间')
    .matches(/^[a-zA-Z0-9]+$/)
    .withMessage('邀请码只能包含字母和数字'),

  handleValidationErrors
];

/**
 * 用户登录验证
 */
const validateUserLogin = [
  body('email')
    .isEmail()
    .withMessage('请输入有效的邮箱地址')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('密码不能为空'),

  body('rememberMe')
    .optional()
    .isBoolean()
    .withMessage('rememberMe必须是布尔值'),

  handleValidationErrors
];

/**
 * 刷新Token验证
 */
const validateTokenRefresh = [
  body('refreshToken')
    .notEmpty()
    .withMessage('refreshToken不能为空')
    .isLength({ min: 10, max: 1000 })
    .withMessage('refreshToken长度必须在10-1000字符之间'),

  handleValidationErrors
];

/**
 * 任务创建验证
 */
const validateTaskCreation = [
  body('type')
    .isString()
    .withMessage('任务类型必须是字符串')
    .isIn(['basic_clean', 'enhance', 'background_remove', 'model_pose12', 'ai_enhance', 'ai_generate'])
    .withMessage('不支持的任务类型'),

  body('imageUrl')
    .isURL()
    .withMessage('imageUrl必须是有效的URL')
    .isLength({ max: 2048 })
    .withMessage('URL长度不能超过2048字符'),

  body('params')
    .optional()
    .isObject()
    .withMessage('params必须是对象'),

  body('priority')
    .optional()
    .isIn(['low', 'normal', 'high'])
    .withMessage('priority必须是low、normal或high之一'),

  handleValidationErrors
];

/**
 * 分页参数验证
 */
const validatePagination = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit必须在1-100之间'),

  query('cursor')
    .optional()
    .isString()
    .withMessage('cursor必须是字符串')
    .isLength({ max: 500 })
    .withMessage('cursor长度不能超过500字符'),

  query('sort')
    .optional()
    .isString()
    .withMessage('sort必须是字符串')
    .isIn(['created_at', 'updated_at', 'id', 'status', 'type'])
    .withMessage('不支持的排序字段'),

  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('order必须是asc或desc'),

  handleValidationErrors
];

/**
 * 通知相关验证
 */
const validateNotificationCreation = [
  body('userId')
    .isUUID()
    .withMessage('userId必须是有效的UUID'),

  body('type')
    .isIn(['task_completed', 'task_failed', 'quota_low', 'system_maintenance', 'payment_success', 'payment_failed', 'membership_expired', 'promotion'])
    .withMessage('不支持的通知类型'),

  body('title')
    .isString()
    .withMessage('title必须是字符串')
    .isLength({ min: 1, max: 200 })
    .withMessage('title长度必须在1-200字符之间'),

  body('message')
    .isString()
    .withMessage('message必须是字符串')
    .isLength({ min: 1, max: 1000 })
    .withMessage('message长度必须在1-1000字符之间'),

  body('data')
    .optional()
    .isObject()
    .withMessage('data必须是对象'),

  body('priority')
    .optional()
    .isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('priority必须是low、normal、high或urgent之一'),

  body('channels')
    .optional()
    .isArray()
    .withMessage('channels必须是数组'),

  body('channels.*')
    .optional()
    .isIn(['database', 'email', 'sms', 'push'])
    .withMessage('channels中的每一项必须是database、email、sms或push之一'),

  handleValidationErrors
];

/**
 * 文件上传验证
 */
const validateFileUpload = [
  // 文件大小限制（10MB）
  body('fileSize')
    .optional()
    .isInt({ max: 10 * 1024 * 1024 })
    .withMessage('文件大小不能超过10MB'),

  // 文件类型限制
  body('mimeType')
    .optional()
    .isIn(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
    .withMessage('只支持JPEG、PNG、GIF、WebP格式的图片'),

  handleValidationErrors
];

/**
 * 搜索参数验证
 */
const validateSearch = [
  query('q')
    .optional()
    .isString()
    .withMessage('搜索关键词必须是字符串')
    .isLength({ min: 1, max: 100 })
    .withMessage('搜索关键词长度必须在1-100字符之间'),

  query('type')
    .optional()
    .isString()
    .withMessage('type必须是字符串'),

  query('status')
    .optional()
    .isString()
    .withMessage('status必须是字符串'),

  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('dateFrom必须是有效的ISO8601日期格式'),

  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('dateTo必须是有效的ISO8601日期格式'),

  // 验证日期范围
  query().custom((value, { req }) => {
    const { dateFrom, dateTo } = req.query;
    if (dateFrom && dateTo) {
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      if (from > to) {
        throw new Error('dateFrom不能晚于dateTo');
      }
    }
    return true;
  }),

  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateCircuitBreakerOperation,
  validateCircuitBreakerName,
  validateProviderName,
  validateProviderMethodExecution,
  validateUserRegistration,
  validateUserLogin,
  validateTokenRefresh,
  validateTaskCreation,
  validatePagination,
  validateNotificationCreation,
  validateFileUpload,
  validateSearch
};