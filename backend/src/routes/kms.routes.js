const express = require('express');
const rateLimit = require('express-rate-limit');
const kmsController = require('../controllers/kms.controller');
const { authenticateToken, requireAdmin } = require('../middlewares/auth.middleware');
const { body, param, query } = require('express-validator');
const validate = require('../middlewares/validate.middleware');

const router = express.Router();

// 加密操作频率限制 - 防止恶意加密
const encryptionRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 100, // 最多100次
  message: {
    success: false,
    error: '加密请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 密钥生成频率限制 - 防止密钥滥用
const keyGenerationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 10, // 最多10次
  message: {
    success: false,
    error: '密钥生成过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 验证规则
const keyNameValidation = [
  param('keyName')
    .notEmpty()
    .withMessage('密钥名称不能为空')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('密钥名称长度必须在1-100个字符之间')
];

const keyNameOrIdValidation = [
  param('keyNameOrId')
    .notEmpty()
    .withMessage('密钥名称或ID不能为空')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('密钥名称或ID长度必须在1-100个字符之间')
];

const generateKeyValidation = [
  body('keyName')
    .notEmpty()
    .withMessage('密钥名称不能为空')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('密钥名称长度必须在1-100个字符之间')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('密钥名称只能包含字母、数字、下划线和连字符'),
  body('keyAlias')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('密钥别名最多100个字符'),
  body('keyType')
    .optional()
    .isIn(['AES', 'RSA', 'HMAC'])
    .withMessage('无效的密钥类型'),
  body('keyPurpose')
    .optional()
    .isIn(['data_encryption', 'signing', 'verification', 'key_exchange'])
    .withMessage('无效的密钥用途'),
  body('keySize')
    .optional()
    .isInt({ min: 128, max: 4096 })
    .withMessage('密钥长度必须在128-4096位之间'),
  body('algorithm')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('算法名称最多50个字符'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('元数据必须为对象'),
  body('notAfter')
    .optional()
    .isISO8601()
    .withMessage('过期时间格式无效')
];

const encryptDataValidation = [
  body('data')
    .notEmpty()
    .withMessage('要加密的数据不能为空')
    .isString()
    .isLength({ min: 1, max: 1000000 })
    .withMessage('数据长度必须在1-1000000个字符之间'),
  body('keyNameOrId')
    .notEmpty()
    .withMessage('密钥名称或ID不能为空')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('密钥名称或ID长度必须在1-100个字符之间'),
  body('dataType')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('数据类型最多50个字符'),
  body('resourceId')
    .optional()
    .isUUID()
    .withMessage('资源ID格式无效'),
  body('resourceType')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('资源类型最多50个字符'),
  body('additionalData')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('附加数据最多1000个字符')
];

const decryptDataValidation = [
  body('encryptedDataId')
    .notEmpty()
    .withMessage('加密数据ID不能为空')
    .isString()
    .withMessage('加密数据ID必须为字符串'),
  body('keyId')
    .optional()
    .isUUID()
    .withMessage('密钥ID格式无效'),
  body('algorithm')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('算法名称最多50个字符'),
  body('iv')
    .optional()
    .isString()
    .withMessage('初始化向量必须为字符串'),
  body('tag')
    .optional()
    .isString()
    .withMessage('认证标签必须为字符串'),
  body('keyVersion')
    .optional()
    .isString()
    .isLength({ max: 20 })
    .withMessage('密钥版本最多20个字符'),
  body('additionalData')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('附加数据最多1000个字符')
];

const rotateKeyValidation = [
  param('keyName')
    .notEmpty()
    .withMessage('密钥名称不能为空')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('密钥名称长度必须在1-100个字符之间'),
  body('keyAlias')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('密钥别名最多100个字符'),
  body('reason')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('轮换原因最多100个字符'),
  body('description')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('轮换描述最多500个字符'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('元数据必须为对象')
];

const updateConfigValidation = [
  body('configKey')
    .notEmpty()
    .withMessage('配置键不能为空')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('配置键长度必须在1-100个字符之间'),
  body('configValue')
    .notEmpty()
    .withMessage('配置值不能为空')
];

const queryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('页码必须在1-1000之间'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('每页数量必须在1-100之间'),
  query('sortBy')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('排序字段最多50个字符'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('排序方向必须是asc或desc')
];

/**
 * 密钥管理服务路由
 *
 * 支持的功能：
 * - 密钥生成和管理
 * - 数据加密和解密
 * - 密钥轮换
 * - 密钥信息查询
 * - 操作审计
 * - 系统配置管理
 */

// 公开路由 - 健康检查（不需要登录）
router.get('/health',
  kmsController.healthCheck
);

// 需要登录的路由
router.use(authenticateToken);

// 密钥生成
router.post('/keys/generate',
  keyGenerationRateLimit,
  generateKeyValidation,
  validate,
  kmsController.generateKey
);

// 数据加密
router.post('/encrypt',
  encryptionRateLimit,
  encryptDataValidation,
  validate,
  kmsController.encrypt
);

// 数据解密
router.post('/decrypt',
  encryptionRateLimit,
  decryptDataValidation,
  validate,
  kmsController.decrypt
);

// 密钥轮换
router.post('/keys/:keyName/rotate',
  keyGenerationRateLimit,
  keyNameValidation,
  rotateKeyValidation,
  validate,
  kmsController.rotateKey
);

// 获取密钥信息
router.get('/keys/:keyNameOrId',
  keyNameOrIdValidation,
  validate,
  kmsController.getKeyInfo
);

// 删除密钥
router.delete('/keys/:keyNameOrId',
  keyNameOrIdValidation,
  validate,
  kmsController.deleteKey
);

// 获取密钥列表
router.get('/keys',
  queryValidation,
  validate,
  kmsController.listKeys
);

// 获取加密数据列表
router.get('/encrypted-data',
  queryValidation,
  validate,
  kmsController.listEncryptedData
);

// 获取操作日志
router.get('/operation-logs',
  queryValidation,
  validate,
  kmsController.getOperationLogs
);

// 获取密钥统计信息
router.get('/statistics',
  kmsController.getKeyStatistics
);

// 获取系统配置
router.get('/config',
  kmsController.getSystemConfig
);

// 管理员路由
router.use(requireAdmin);

// 更新系统配置
router.put('/config',
  updateConfigValidation,
  validate,
  kmsController.updateSystemConfig
);

module.exports = router;