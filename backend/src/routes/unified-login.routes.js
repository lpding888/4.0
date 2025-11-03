const express = require('express');
const { body } = require('express-validator');
const unifiedLoginController = require('../controllers/unified-login.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const rateLimit = require('express-rate-limit');

const router = express.Router();

/**
 * 统一登录API路由
 *
 * 支持多种登录方式：
 * - 邮箱密码登录
 * - 手机号验证码登录
 * - 微信登录
 * - 用户注册
 * - 登录方式绑定/解绑
 */

// 通用限流
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 20, // 每个用户最多20次登录尝试
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '登录尝试过于频繁，请稍后再试'
    }
  }
});

// 验证码限流（更严格）
const verificationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 5, // 每个手机号最多5次发送
  message: {
    success: false,
    error: {
      code: 'VERIFICATION_RATE_LIMIT',
      message: '验证码发送过于频繁，请稍后再试'
    }
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     UnifiedLoginRequest:
 *       type: object
 *       required:
 *         - method
 *         - loginData
 *       properties:
 *         method:
 *           type: string
 *           enum: [email, phone, wechat]
 *           description: 登录方式
 *         loginData:
 *           type: object
 *           description: 登录数据（根据method不同而不同）
 *
 *     EmailLoginData:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: 邮箱地址
 *         password:
 *           type: string
 *           minLength: 6
 *           description: 密码
 *
 *     PhoneLoginData:
 *       type: object
 *       required:
 *         - phone
 *         - verificationCode
 *       properties:
 *         phone:
 *           type: string
 *           pattern: ^1[3-9]\d{9}$
 *           description: 手机号
 *         verificationCode:
 *           type: string
 *           pattern: ^\d{6}$
 *           description: 6位验证码
 *
 *     WechatLoginData:
 *       type: object
 *       required:
 *         - code
 *         - platform
 *       properties:
 *         code:
 *           type: string
 *           description: 微信授权码
 *         platform:
 *           type: string
 *           enum: [officialAccount, miniProgram, openPlatform]
 *           description: 微信平台
 *         state:
 *           type: string
 *           description: 状态参数
 *         userInfo:
 *           type: object
 *           description: 用户信息（小程序用）
 *
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - userData
 *         - loginMethod
 *       properties:
 *         userData:
 *           type: object
 *           properties:
 *             email:
 *               type: string
 *               format: email
 *             phone:
 *               type: string
 *               pattern: ^1[3-9]\d{9}$
 *             username:
 *               type: string
 *             password:
 *               type: string
 *               minLength: 6
 *         loginMethod:
 *           type: string
 *           enum: [email, phone]
 *           description: 注册登录方式
 *
 *     VerificationRequest:
 *       type: object
 *       required:
 *         - phone
 *       properties:
 *         phone:
 *           type: string
 *           pattern: ^1[3-9]\d{9}$
 *           description: 手机号
 *
 *     BindMethodRequest:
 *       type: object
 *       required:
 *         - type
 *         - value
 *       properties:
 *         type:
 *           type: string
 *           enum: [email, phone]
 *           description: 绑定类型
 *         value:
 *           type: string
 *           description: 绑定值
 *         password:
 *           type: string
 *           description: 密码（邮箱绑定时需要）
 */

/**
 * @swagger
 * /api/auth/login/methods:
 *   get:
 *     tags:
 *       - 统一登录
 *     summary: 获取可用的登录方式
 *     responses:
 *       200:
 *         description: 登录方式获取成功
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
 *                       key:
 *                       type: string
 *                       example: email
 *                     name:
 *                       type: string
 *                       example: 邮箱登录
 *                       requiresPassword:
 *                         type: boolean
 *                       requiresVerification:
 *                         type: boolean
 *                       thirdParty:
 *                         type: boolean
 *                       fields:
 *                         type: array
 *                         items:
 *                           type: string
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/methods', unifiedLoginController.getAvailableLoginMethods);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags:
 *       - 统一登录
 *     summary: 统一登录接口
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UnifiedLoginRequest'
 *     responses:
 *       200:
 *         description: 登录成功
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
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         username:
 *                           type: string
 *                         email:
 *                           type: string
 *                         role:
 *                           type: string
 *                         isMember:
 *                           type: boolean
 *                         quota_remaining:
 *                           type: integer
 *                     tokens:
 *                       type: object
 *                       properties:
 *                         accessToken:
 *                           type: string
 *                         refreshToken:
 *                           type: string
 *                         expiresIn:
 *                           type: integer
 *                         tokenType:
 *                           type: string
 *                     loginMethod:
 *                       type: string
 *                       enum: [email, phone, wechat]
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: 登录失败
 */
router.post('/login',
  loginLimiter,
  [
    body('method')
      .isIn(['email', 'phone', 'wechat'])
      .withMessage('登录方式必须是: email, phone, wechat'),
    body('loginData')
      .notEmpty()
      .withMessage('登录数据不能为空')
  ],
  unifiedLoginController.unifiedLogin
);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags:
 *       - 统一登录
 *     summary: 用户注册
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: 注册成功
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
 *                     user:
 *                       type: object
 *                     tokens:
 *                       type: object
 *                     loginMethod:
 *                       type: string
 *                     isNewUser:
 *                       type: boolean
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: 注册失败
 */
router.post('/register',
  loginLimiter,
  [
    body('userData')
      .notEmpty()
      .withMessage('用户数据不能为空'),
    body('loginMethod')
      .isIn(['email', 'phone'])
      .withMessage('注册登录方式必须是: email, phone')
  ],
  unifiedLoginController.register
);

/**
 * @swagger
 * /api/auth/verification/send:
 *   post:
 *     tags:
 *       - 统一登录
 *     summary: 发送手机验证码
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerificationRequest'
 *     responses:
 *       200:
 *         description: 验证码发送成功
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
 *                     message:
 *                       type: string
 *                     expiresIn:
 *                       type: integer
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: 发送失败
 */
router.post('/verification/send',
  verificationLimiter,
  [
    body('phone')
      .matches(/^1[3-9]\d{9}$/)
      .withMessage('手机号格式不正确')
  ],
  unifiedLoginController.sendVerificationCode
);

/**
 * @swagger
 * /api/auth/bind-method:
 *   post:
 *     tags:
 *       - 统一登录
 *     summary: 绑定登录方式
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BindMethodRequest'
 *     responses:
 *       200:
 *         description: 绑定成功
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
 *                     message:
 *                       type: string
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: 绑定失败
 */
router.post('/bind-method',
  authMiddleware.authenticate,
  loginLimiter,
  [
    body('type')
      .isIn(['email', 'phone'])
      .withMessage('绑定类型必须是: email, phone'),
    body('value')
      .notEmpty()
      .withMessage('绑定值不能为空')
  ],
  unifiedLoginController.bindLoginMethod
);

/**
 * @swagger
 * /api/auth/bind-method:
 *   delete:
 *     tags:
 *       - 统一登录
 *     summary: 解除登录方式绑定
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [email, phone]
 *                 description: 绑定类型
 *     responses:
 *       200:
 *         description: 解除绑定成功
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
 *                     message:
 *                       type: string
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: 解除绑定失败
 */
router.delete('/bind-method',
  authMiddleware.authenticate,
  [
    body('type')
      .isIn(['email', 'phone'])
      .withMessage('绑定类型必须是: email, phone')
  ],
  unifiedLoginController.unbindLoginMethod
);

/**
 * @swagger
 * /api/auth/bindings:
 *   get:
 *     tags:
 *       - 统一登录
 *     summary: 获取用户登录方式信息
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 登录方式信息获取成功
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
 *                     userId:
 *                       type: string
 *                     methods:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                           type: string
 *                           enum: [email, phone, wechat]
 *                           value:
 *                             type: string
 *                           verified:
 *                             type: boolean
 *                           isPrimary:
 *                             type: boolean
 *                     primaryMethod:
 *                       type: string
 *                     lastLoginPlatform:
 *                       type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/bindings',
  authMiddleware.authenticate,
  unifiedLoginController.getUserLoginMethods
);

/**
 * @swagger
 * /api/auth/login/email:
 *   post:
 *     tags:
 *       - 统一登录
 *     summary: 邮箱登录
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmailLoginData'
 *     responses:
 *       200:
 *         description: 登录成功
 */
router.post('/login/email',
  loginLimiter,
  [
    body('email')
      .isEmail()
      .withMessage('邮箱格式不正确'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('密码至少6位')
  ],
  unifiedLoginController.loginWithEmail
);

/**
 * @swagger
 * /api/auth/login/phone:
 *   post:
 *     tags:
 *       - 统一登录
 *     summary: 手机号登录
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PhoneLoginData'
 *     responses:
 *       200:
 *         description: 登录成功
 */
router.post('/login/phone',
  loginLimiter,
  [
    body('phone')
      .matches(/^1[3-9]\d{9}$/)
      .withMessage('手机号格式不正确'),
    body('verificationCode')
      .matches(/^\d{6}$/)
      .withMessage('验证码必须是6位数字')
  ],
  unifiedLoginController.loginWithPhone
);

/**
 * @swagger
 * /api/auth/stats:
 *   get:
 *     tags:
 *       - 统一登录
 *     summary: 获取统一登录统计信息
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 统计信息获取成功
 */
router.get('/stats',
  authMiddleware.authenticate,
  unifiedLoginController.getUnifiedLoginStats
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags:
 *       - 统一登录
 *     summary: 登出
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 登出成功
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
 */
router.post('/logout',
  authMiddleware.authenticate,
  unifiedLoginController.logout
);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags:
 *       - 统一登录
 *     summary: 刷新令牌
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: 刷新令牌
 *     responses:
 *       200:
 *         description: 令牌刷新成功
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
 */
router.post('/refresh',
  [
    body('refreshToken')
      .notEmpty()
      .withMessage('刷新令牌不能为空')
  ],
  unifiedLoginController.refreshToken
);

module.exports = router;