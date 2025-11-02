const express = require('express');
const rateLimit = require('express-rate-limit');
const referralValidationController = require('../controllers/referral-validation.controller');
const { authenticateToken, requireAdmin } = require('../middlewares/auth.middleware');
const { body, param, query } = require('express-validator');
const validate = require('../middlewares/validate.middleware');

const router = express.Router();

// 验证频率限制 - 防止恶意验证
const validationRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 30, // 最多30次
  message: {
    success: false,
    error: '验证请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 创建推荐频率限制 - 防止刷推荐
const createReferralRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 10, // 最多10次
  message: {
    success: false,
    error: '推荐创建过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 验证规则
const userIdValidation = [
  param('userId')
    .isUUID()
    .withMessage('用户ID格式无效')
];

const validateQualificationValidation = [
  query('qualificationType')
    .optional()
    .isIn(['active_user', 'premium_member', 'verified_user', 'content_creator', 'partner'])
    .withMessage('无效的资格类型')
];

const validateReferralValidation = [
  body('referrerId')
    .notEmpty()
    .withMessage('推荐人ID不能为空')
    .isUUID()
    .withMessage('推荐人ID格式无效'),
  body('refereeId')
    .notEmpty()
    .withMessage('被推荐人ID不能为空')
    .isUUID()
    .withMessage('被推荐人ID格式无效'),
  body('referralData')
    .optional()
    .isObject()
    .withMessage('推荐数据必须为对象')
];

const createReferralValidation = [
  body('referrerId')
    .notEmpty()
    .withMessage('推荐人ID不能为空')
    .isUUID()
    .withMessage('推荐人ID格式无效'),
  body('refereeId')
    .notEmpty()
    .withMessage('被推荐人ID不能为空')
    .isUUID()
    .withMessage('被推荐人ID格式无效'),
  body('referralCode')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('推荐码最多50个字符'),
  body('type')
    .optional()
    .isIn(['user', 'invite_code', 'link', 'qr_code'])
    .withMessage('无效的推荐类型'),
  body('source')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('推荐来源最多100个字符'),
  body('campaign')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('推荐活动最多100个字符'),
  body('referralData')
    .optional()
    .isObject()
    .withMessage('推荐数据必须为对象')
];

const updateFraudDetectionValidation = [
  param('detectionId')
    .isUUID()
    .withMessage('检测ID格式无效'),
  body('status')
    .isIn(['detected', 'investigating', 'confirmed', 'false_positive', 'resolved'])
    .withMessage('无效的状态选项'),
  body('resolutionNotes')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('处理备注最多1000个字符')
];

const revalidateQualificationValidation = [
  param('userId')
    .isUUID()
    .withMessage('用户ID格式无效'),
  body('qualificationType')
    .optional()
    .isIn(['active_user', 'premium_member', 'verified_user', 'content_creator', 'partner'])
    .withMessage('无效的资格类型')
];

const batchValidateValidation = [
  body('referralIds')
    .isArray({ min: 1, max: 100 })
    .withMessage('推荐ID列表必须是1-100个元素的数组'),
  body('referralIds.*')
    .isUUID()
    .withMessage('推荐ID格式无效')
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
    .isIn(['created_at', 'updated_at', 'validated_at', 'completed_at'])
    .withMessage('无效的排序字段'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('无效的排序方向')
];

/**
 * 推荐验证相关路由
 *
 * 支持的功能：
 * - 推荐人资格验证
 * - 推荐关系验证
 * - 推荐记录创建
 * - 欺诈检测
 * - 推荐统计
 * - 推荐链管理
 */

// 公开路由 - 验证推荐关系（不需要登录）
router.post('/validate-relationship',
  validationRateLimit,
  validateReferralValidation,
  validate,
  referralValidationController.validateReferralRelationship
);

// 需要登录的路由
router.use(authenticateToken);

// 推荐人资格验证
router.get('/validate-qualification/:userId',
  validationRateLimit,
  userIdValidation,
  validateQualificationValidation,
  validate,
  referralValidationController.validateReferrerQualification
);

// 验证当前用户资格
router.get('/validate-my-qualification',
  validationRateLimit,
  validateQualificationValidation,
  validate,
  referralValidationController.validateCurrentUserQualification
);

// 手动重新验证资格
router.post('/revalidate-qualification/:userId',
  validationRateLimit,
  userIdValidation,
  revalidateQualificationValidation,
  validate,
  referralValidationController.revalidateReferrerQualification
);

// 创建推荐记录
router.post('/create',
  createReferralRateLimit,
  createReferralValidation,
  validate,
  referralValidationController.createReferral
);

// 获取推荐记录列表
router.get('/referrals',
  queryValidation,
  validate,
  referralValidationController.getReferrals
);

// 获取推荐链信息
router.get('/chain/:userId',
  userIdValidation,
  validate,
  referralValidationController.getReferralChain
);

// 获取推荐统计信息
router.get('/statistics/:userId',
  userIdValidation,
  validate,
  referralValidationController.getReferralStatistics
);

// 获取推荐人资格列表
router.get('/qualifications',
  validate,
  referralValidationController.getReferrerQualifications
);

// 获取欺诈检测记录
router.get('/fraud-detections',
  validate,
  referralValidationController.getFraudDetections
);

// 获取验证规则
router.get('/validation-rules',
  validate,
  referralValidationController.getValidationRules
);

// 批量验证推荐关系
router.post('/batch-validate',
  validationRateLimit,
  batchValidateValidation,
  validate,
  referralValidationController.batchValidateReferrals
);

// 管理员路由
router.use(requireAdmin);

// 更新欺诈检测状态
router.put('/fraud-detections/:detectionId/status',
  updateFraudDetectionValidation,
  validate,
  referralValidationController.updateFraudDetectionStatus
);

module.exports = router;