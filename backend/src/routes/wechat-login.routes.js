const express = require('express');
const { query, body } = require('express-validator');
const wechatLoginController = require('../controllers/wechat-login.controller');
const rateLimit = require('express-rate-limit');

const router = express.Router();

/**
 * 微信登录API路由
 *
 * 支持多种微信登录方式：
 * - 微信公众号OAuth登录
 * - 微信小程序登录
 * - 微信开放平台扫码登录
 * - 微信用户信息管理
 */

// 通用限流
const wechatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 50, // 每个用户最多50次请求
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '请求过于频繁，请稍后再试'
    }
  }
});

// 登录限流（更严格）
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 10, // 每个用户最多10次登录尝试
  message: {
    success: false,
    error: {
      code: 'LOGIN_RATE_LIMIT',
      message: '登录尝试过于频繁，请稍后再试'
    }
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     WechatOAuthRequest:
 *       type: object
 *       required:
 *         - redirectUri
 *       properties:
 *         redirectUri:
 *           type: string
 *           format: uri
 *           description: 回调地址
 *         scope:
 *           type: string
 *           enum: [snsapi_base, snsapi_userinfo]
 *           default: snsapi_userinfo
 *           description: 授权范围
 *         state:
 *           type: string
 *           description: 状态参数
 *
 *     WechatMiniProgramLoginRequest:
 *       type: object
 *       required:
 *         - code
 *       properties:
 *         code:
 *           type: string
 *           description: 小程序登录凭证
 *         userInfo:
 *           type: object
 *           description: 用户信息
 *           properties:
 *             nickName:
 *               type: string
 *             avatarUrl:
 *               type: string
 *             gender:
 *               type: integer
 *             city:
 *               type: string
 *             province:
 *               type: string
 *             country:
 *               type: string
 *
 *     WechatLoginResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 username:
 *                   type: string
 *                 email:
 *                   type: string
 *                 role:
 *                   type: string
 *                 isMember:
 *                   type: boolean
 *                 quota_remaining:
 *                   type: integer
 *                 wechat_nickname:
 *                   type: string
 *                 wechat_avatar:
 *                   type: string
 *             tokens:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 expiresIn:
 *                   type: integer
 *                 tokenType:
 *                   type: string
 *             isNewUser:
 *               type: boolean
 *             platform:
 *               type: string
 *               enum: [officialAccount, miniProgram, openPlatform]
 *         message:
 *           type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/auth/wechat/official/oauth:
 *   get:
 *     tags:
 *       - 微信登录
 *     summary: 生成微信公众号OAuth授权URL
 *     parameters:
 *       - in: query
 *         name: redirectUri
 *         required: true
 *         schema:
 *           type: string
 *           format: uri
 *         description: 回调地址
 *       - in: query
 *         name: scope
 *         schema:
 *           type: string
 *           enum: [snsapi_base, snsapi_userinfo]
 *           default: snsapi_userinfo
 *         description: 授权范围
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: 状态参数
 *     responses:
 *       200:
 *         description: 授权URL生成成功
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
 *                     authUrl:
 *                       type: string
 *                     state:
 *                       type: string
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/official/oauth',
  wechatLimiter,
  [
    query('redirectUri')
      .isURL()
      .withMessage('回调地址格式不正确'),
    query('scope')
      .optional()
      .isIn(['snsapi_base', 'snsapi_userinfo'])
      .withMessage('授权范围必须是: snsapi_base, snsapi_userinfo'),
    query('state')
      .optional()
      .isLength({ min: 1, max: 128 })
      .withMessage('状态参数长度必须在1-128之间')
  ],
  wechatLoginController.generateOfficialOAuthUrl
);

/**
 * @swagger
 * /api/auth/wechat/official/callback:
 *   get:
 *     tags:
 *       - 微信登录
 *     summary: 处理微信公众号OAuth回调
 *     description: 微信授权后跳转到的回调地址
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: 授权码
 *       - in: query
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *         description: 状态参数
 *     responses:
 *       200:
 *         description: 登录成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WechatLoginResponse'
 */
router.get('/official/callback',
  loginLimiter,
  wechatLoginController.handleOfficialOAuthCallback
);

/**
 * @swagger
 * /api/auth/wechat/miniprogram/login:
 *   post:
 *     tags:
 *       - 微信登录
 *     summary: 微信小程序登录
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WechatMiniProgramLoginRequest'
 *     responses:
 *       200:
 *         description: 登录成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WechatLoginResponse'
 */
router.post('/miniprogram/login',
  loginLimiter,
  [
    body('code')
      .notEmpty()
      .withMessage('登录凭证不能为空'),
    body('userInfo')
      .optional()
      .isObject()
      .withMessage('用户信息必须是对象')
  ],
  wechatLoginController.handleMiniProgramLogin
);

/**
 * @swagger
 * /api/auth/wechat/open/oauth:
 *   get:
 *     tags:
 *       - 微信登录
 *     summary: 生成微信开放平台OAuth授权URL
 *     parameters:
 *       - in: query
 *         name: redirectUri
 *         required: true
 *         schema:
 *           type: string
 *           format: uri
 *         description: 回调地址
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: 状态参数
 *     responses:
 *       200:
 *         description: 授权URL生成成功
 */
router.get('/open/oauth',
  wechatLimiter,
  [
    query('redirectUri')
      .isURL()
      .withMessage('回调地址格式不正确'),
    query('state')
      .optional()
      .isLength({ min: 1, max: 128 })
      .withMessage('状态参数长度必须在1-128之间')
  ],
  wechatLoginController.generateOpenPlatformOAuthUrl
);

/**
 * @swagger
 * /api/auth/wechat/open/callback:
 *   get:
 *     tags:
 *       - 微信登录
 *     summary: 处理微信开放平台扫码回调
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: 授权码
 *       - in: query
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *         description: 状态参数
 *     responses:
 *       200:
 *         description: 登录成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WechatLoginResponse'
 */
router.get('/open/callback',
  loginLimiter,
  wechatLoginController.handleOpenPlatformCallback
);

/**
 * @swagger
 * /api/auth/wechat/bindings:
 *   get:
 *     tags:
 *       - 微信登录
 *     summary: 获取用户微信绑定信息
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 绑定信息获取成功
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
 *                     openid:
 *                       type: string
 *                     unionid:
 *                       type: string
 *                     nickname:
 *                       type: string
 *                     avatar:
 *                       type: string
 *                     lastLoginPlatform:
 *                       type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/bindings',
  wechatLimiter,
  wechatLoginController.getUserWechatBindings
);

/**
 * @swagger
 * /api/auth/wechat/bindings:
 *   delete:
 *     tags:
 *       - 微信登录
 *     summary: 解除微信绑定
 *     security:
 *       - bearerAuth: []
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
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.delete('/bindings',
  wechatLimiter,
  wechatLoginController.unbindWechat
);

/**
 * @swagger
 * /api/auth/wechat/stats:
 *   get:
 *     tags:
 *       - 微信登录
 *     summary: 获取微信登录统计信息
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 统计信息获取成功
 */
router.get('/stats',
  wechatLimiter,
  wechatLoginController.getWechatLoginStats
);

/**
 * @swagger
 * /api/auth/wechat/official/verify:
 *   get:
 *     tags:
 *       - 微信登录
 *     summary: 微信公众号服务器验证
 *     description: 微信公众号开发者服务器验证
 *     parameters:
 *       - in: query
 *         name: signature
 *         required: true
 *         schema:
 *           type: string
 *         description: 微信签名
 *       - in: query
 *         name: timestamp
 *         required: true
 *         schema:
 *           type: string
 *         description: 时间戳
 *       - in: query
 *         name: nonce
 *         required: true
 *         schema:
 *           type: string
 *         description: 随机字符串
 *       - in: query
 *         name: echostr
 *         required: true
 *         schema:
 *           type: string
 *         description: 随机字符串
 *     responses:
 *       200:
 *         description: 验证成功
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
router.get('/official/verify', wechatLoginController.verifyOfficialServer);

/**
 * @swagger
 * /api/auth/wechat/official/verify:
 *   post:
 *     tags:
 *       - 微信登录
 *     summary: 处理微信公众号消息和事件
 *     description: 接收微信公众号的消息和事件推送
 *     parameters:
 *       - in: query
 *         name: signature
 *         required: true
 *         schema:
 *           type: string
 *         description: 微信签名
 *       - in: query
 *         name: timestamp
 *         required: true
 *         schema:
 *           type: string
 *         description: 时间戳
 *       - in: query
 *         name: nonce
 *         required: true
 *         schema:
 *           type: string
 *         description: 随机字符串
 *     requestBody:
 *       required: true
 *       content:
 *         application/xml:
 *           schema:
 *             type: string
 *     responses:
 *       200:
 *         description: 消息处理成功
 */
router.post('/official/verify', wechatLoginController.handleOfficialMessage);

/**
 * @swagger
 * /api/auth/wechat/miniprogram/update-profile:
 *   post:
 *     tags:
 *       - 微信登录
 *     summary: 更新小程序用户信息
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userInfo
 *             properties:
 *               userInfo:
 *                 type: object
 *                 properties:
 *                   nickName:
 *                     type: string
 *                   avatarUrl:
 *                     type: string
 *                   gender:
 *                     type: integer
 *                   city:
 *                     type: string
 *                   province:
 *                     type: string
 *                   country:
 *                     type: string
 *     responses:
 *       200:
 *         description: 用户信息更新成功
 */
router.post('/miniprogram/update-profile',
  wechatLimiter,
  [
    body('userInfo')
      .notEmpty()
      .isObject()
      .withMessage('用户信息不能为空且必须是对象')
  ],
  wechatLoginController.updateMiniProgramProfile
);

/**
 * @swagger
 * /api/auth/wechat/pay/bind:
 *   post:
 *     tags:
 *       - 微信登录
 *     summary: 绑定微信支付账号
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - openid
 *             properties:
 *               openid:
 *                 type: string
 *                 description: 微信支付openid
 *               unionid:
 *                 type: string
 *                 description: 微信unionid
 *     responses:
 *       200:
 *         description: 微信支付绑定成功
 */
router.post('/pay/bind',
  wechatLimiter,
  [
    body('openid')
      .notEmpty()
      .withMessage('openid不能为空'),
    body('unionid')
      .optional()
      .isString()
      .withMessage('unionid必须是字符串')
  ],
  wechatLoginController.bindWechatPay
);

module.exports = router;