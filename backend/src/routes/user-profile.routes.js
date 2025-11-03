const express = require('express');
const multer = require('multer');
const userProfileController = require('../controllers/user-profile.controller');
const { authenticateToken, requireAdmin } = require('../middlewares/auth.middleware');
const { body, param } = require('express-validator');
const validate = require('../middlewares/validate.middleware');

const router = express.Router();

// 文件上传配置
const upload = multer({
  dest: 'uploads/temp/',
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 JPG、PNG、GIF、WebP 格式的图片'), false);
    }
  }
});

// 验证规则
const userIdValidation = [
  param('userId')
    .optional()
    .isUUID()
    .withMessage('用户ID格式无效')
];

const educationIdValidation = [
  param('educationId')
    .isUUID()
    .withMessage('教育经历ID格式无效')
];

const workIdValidation = [
  param('workId')
    .isUUID()
    .withMessage('工作经历ID格式无效')
];

const skillIdValidation = [
  param('skillId')
    .isUUID()
    .withMessage('技能ID格式无效')
];

const updateBasicInfoValidation = [
  body('first_name')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('名最多50个字符'),
  body('last_name')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('姓最多50个字符'),
  body('birth_date')
    .optional()
    .isISO8601()
    .withMessage('出生日期格式无效'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other', 'prefer_not_to_say'])
    .withMessage('无效的性别选项'),
  body('phone')
    .optional()
    .isMobilePhone('zh-CN')
    .withMessage('手机号格式无效'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('邮箱格式无效'),
  body('country')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('国家名称最多50个字符'),
  body('state')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('省/州名称最多50个字符'),
  body('city')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('城市名称最多50个字符'),
  body('address')
    .optional()
    .isString()
    .isLength({ max: 200 })
    .withMessage('详细地址最多200个字符'),
  body('postal_code')
    .optional()
    .isString()
    .isLength({ max: 20 })
    .withMessage('邮政编码最多20个字符'),
  body('occupation')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('职业名称最多100个字符'),
  body('company')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('公司名称最多100个字符'),
  body('industry')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('行业名称最多50个字符'),
  body('education_level')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('教育程度最多50个字符'),
  body('university')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('大学名称最多100个字符'),
  body('bio')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('个人简介最多1000个字符'),
  body('avatar_url')
    .optional()
    .isURL()
    .withMessage('头像URL格式无效'),
  body('banner_url')
    .optional()
    .isURL()
    .withMessage('横幅图片URL格式无效'),
  body('language')
    .optional()
    .isIn(['zh-CN', 'en-US', 'ja-JP', 'ko-KR'])
    .withMessage('无效的语言选项'),
  body('timezone')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('时区格式无效'),
  body('profile_public')
    .optional()
    .isBoolean()
    .withMessage('资料公开设置必须为布尔值'),
  body('show_email')
    .optional()
    .isBoolean()
    .withMessage('邮箱显示设置必须为布尔值'),
  body('show_phone')
    .optional()
    .isBoolean()
    .withMessage('手机号显示设置必须为布尔值')
];

const addEducationValidation = [
  body('school_name')
    .notEmpty()
    .withMessage('学校名称不能为空')
    .isString()
    .isLength({ max: 200 })
    .withMessage('学校名称最多200个字符'),
  body('degree')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('学位名称最多100个字符'),
  body('major')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('专业名称最多100个字符'),
  body('education_level')
    .optional()
    .isIn(['high_school', 'bachelor', 'master', 'phd', 'other'])
    .withMessage('无效的教育水平选项'),
  body('start_date')
    .optional()
    .isISO8601()
    .withMessage('开始日期格式无效'),
  body('end_date')
    .optional()
    .isISO8601()
    .withMessage('结束日期格式无效'),
  body('is_current')
    .optional()
    .isBoolean()
    .withMessage('是否在读必须为布尔值'),
  body('description')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('描述最多1000个字符'),
  body('gpa')
    .optional()
    .isFloat({ min: 0, max: 4.0 })
    .withMessage('GPA必须在0-4.0之间'),
  body('activities')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('课外活动最多500个字符'),
  body('achievements')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('成就最多1000个字符'),
  body('is_public')
    .optional()
    .isBoolean()
    .withMessage('是否公开必须为布尔值')
];

const addWorkExperienceValidation = [
  body('company_name')
    .notEmpty()
    .withMessage('公司名称不能为空')
    .isString()
    .isLength({ max: 200 })
    .withMessage('公司名称最多200个字符'),
  body('job_title')
    .notEmpty()
    .withMessage('职位名称不能为空')
    .isString()
    .isLength({ max: 100 })
    .withMessage('职位名称最多100个字符'),
  body('department')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('部门名称最多100个字符'),
  body('employment_type')
    .optional()
    .isIn(['full_time', 'part_time', 'contract', 'internship', 'freelance', 'other'])
    .withMessage('无效的雇佣类型选项'),
  body('start_date')
    .optional()
    .isISO8601()
    .withMessage('开始日期格式无效'),
  body('end_date')
    .optional()
    .isISO8601()
    .withMessage('结束日期格式无效'),
  body('is_current')
    .optional()
    .isBoolean()
    .withMessage('是否在职必须为布尔值'),
  body('location')
    .optional()
    .isString()
    .isLength({ max: 200 })
    .withMessage('工作地点最多200个字符'),
  body('description')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('工作描述最多1000个字符'),
  body('responsibilities')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('职责描述最多1000个字符'),
  body('achievements')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('成就最多1000个字符'),
  body('salary_start')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('起始薪资必须为正数'),
  body('salary_end')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('结束薪资必须为正数'),
  body('currency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage('货币代码必须为3个字符'),
  body('skills')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('技能标签最多500个字符'),
  body('is_public')
    .optional()
    .isBoolean()
    .withMessage('是否公开必须为布尔值')
];

const addSkillValidation = [
  body('skill_name')
    .notEmpty()
    .withMessage('技能名称不能为空')
    .isString()
    .isLength({ max: 100 })
    .withMessage('技能名称最多100个字符'),
  body('skill_level')
    .optional()
    .isIn(['beginner', 'intermediate', 'advanced', 'expert'])
    .withMessage('无效的技能水平选项'),
  body('experience_years')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('经验年限必须在0-50年之间'),
  body('description')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('技能描述最多500个字符'),
  body('is_public')
    .optional()
    .isBoolean()
    .withMessage('是否公开必须为布尔值')
];

const batchUpdateValidation = [
  body('basicInfo')
    .optional()
    .isObject()
    .withMessage('基础信息必须为对象'),
  body('education')
    .optional()
    .isArray()
    .withMessage('教育经历必须为数组'),
  body('workExperience')
    .optional()
    .isArray()
    .withMessage('工作经历必须为数组'),
  body('skills')
    .optional()
    .isArray()
    .withMessage('技能必须为数组')
];

/**
 * 用户资料相关路由
 *
 * 支持的功能：
 * - 用户基础信息管理
 * - 教育和工作经历管理
 * - 技能和兴趣标签管理
 * - 社交媒体链接管理
 * - 资料完整度计算
 * - 隐私设置控制
 * - 头像和横幅上传
 */

// 需要登录的路由
router.use(authenticateToken);

// 获取用户完整资料
router.get('/full/:userId?',
  userIdValidation,
  validate,
  userProfileController.getUserFullProfile
);

// 获取当前用户完整资料
router.get('/profile',
  userProfileController.getUserFullProfile
);

// 获取用户基础信息
router.get('/basic/:userId?',
  userIdValidation,
  validate,
  userProfileController.getUserBasicInfo
);

// 更新用户基础信息
router.put('/basic',
  updateBasicInfoValidation,
  validate,
  userProfileController.updateUserBasicInfo
);

// 批量更新用户资料
router.put('/batch',
  batchUpdateValidation,
  validate,
  userProfileController.batchUpdateProfile
);

// 教育经历相关路由
router.get('/education/:userId?',
  userIdValidation,
  validate,
  userProfileController.getUserEducation
);

router.post('/education',
  addEducationValidation,
  validate,
  userProfileController.addEducation
);

router.put('/education/:educationId',
  educationIdValidation,
  addEducationValidation,
  validate,
  userProfileController.updateEducation
);

router.delete('/education/:educationId',
  educationIdValidation,
  validate,
  userProfileController.deleteEducation
);

// 工作经历相关路由
router.get('/work/:userId?',
  userIdValidation,
  validate,
  userProfileController.getUserWorkExperience
);

router.post('/work',
  addWorkExperienceValidation,
  validate,
  userProfileController.addWorkExperience
);

router.put('/work/:workId',
  workIdValidation,
  addWorkExperienceValidation,
  validate,
  userProfileController.updateWorkExperience
);

router.delete('/work/:workId',
  workIdValidation,
  validate,
  userProfileController.deleteWorkExperience
);

// 技能相关路由
router.get('/skills/:userId?',
  userIdValidation,
  validate,
  userProfileController.getUserSkills
);

router.post('/skills',
  addSkillValidation,
  validate,
  userProfileController.addSkill
);

router.put('/skills/:skillId',
  skillIdValidation,
  addSkillValidation,
  validate,
  userProfileController.updateSkill
);

router.delete('/skills/:skillId',
  skillIdValidation,
  validate,
  userProfileController.deleteSkill
);

// 兴趣标签相关路由
router.get('/interests/:userId?',
  userIdValidation,
  validate,
  userProfileController.getUserInterests
);

// 社交媒体链接相关路由
router.get('/social/:userId?',
  userIdValidation,
  validate,
  userProfileController.getUserSocialLinks
);

// 资料完整度相关路由
router.get('/completeness/:userId?',
  userIdValidation,
  validate,
  userProfileController.getUserProfileCompleteness
);

router.post('/completeness/recalculate',
  userProfileController.recalculateProfileCompleteness
);

router.get('/suggestions',
  userProfileController.getProfileSuggestions
);

// 文件上传相关路由
router.post('/upload/avatar',
  upload.single('avatar'),
  userProfileController.uploadAvatar
);

router.post('/upload/banner',
  upload.single('banner'),
  userProfileController.uploadBanner
);

// 错误处理中间件（处理multer错误）
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: '文件大小超过限制（最大5MB）'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: '文件数量超过限制'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: '意外的文件字段'
      });
    }
  }

  if (error.message === '只支持 JPG、PNG、GIF、WebP 格式的图片') {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }

  next(error);
});

module.exports = router;