const express = require('express');
const { body, param, query } = require('express-validator');
const authMiddleware = require('../middlewares/auth.middleware');
const paymentController = require('../controllers/payment.controller');
const rateLimit = require('express-rate-limit');

const router = express.Router();

/**
 * 支付API路由
 *
 * 支持支付宝和微信支付：
 * - 创建支付订单
 * - 支付回调处理
 * - 退款申请和查询
 * - 订单状态查询
 */

// 通用限流
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每个用户最多100次请求
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: '请求过于频繁，请稍后再试'
    }
  }
});

// 创建支付订单限流（更严格）
const createOrderLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: 5, // 每个用户最多5次创建订单
  message: {
    success: false,
    error: {
      code: 'CREATE_ORDER_RATE_LIMIT',
      message: '创建订单过于频繁，请稍后再试'
    }
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     CreatePaymentOrderRequest:
 *       type: object
 *       required:
 *         - productType
 *         - productName
 *         - amount
 *         - paymentMethod
 *       properties:
 *         productType:
 *           type: string
 *           enum: [membership, quota, premium]
 *           description: 商品类型
 *         productId:
 *           type: string
 *           description: 商品ID
 *         productName:
 *           type: string
 *           maxLength: 100
 *           description: 商品名称
 *         productDescription:
 *           type: string
 *           description: 商品描述
 *         amount:
 *           type: number
 *           minimum: 0.01
 *           description: 支付金额
 *         paymentMethod:
 *           type: string
 *           enum: [alipay, wechat]
 *           description: 支付方式
 *         returnUrl:
 *           type: string
 *           format: uri
 *           description: 支付成功返回地址
 *         notifyUrl:
 *           type: string
 *           format: uri
 *           description: 支付回调地址
 *
 *     PaymentOrderResponse:
 *       type: object
 *       properties:
 *         orderId:
 *           type: string
 *           description: 订单ID
 *         orderNo:
 *           type: string
 *           description: 订单号
 *         paymentParams:
 *           type: object
 *           description: 支付参数
 *         expireTime:
 *           type: string
 *           format: date-time
 *           description: 过期时间
 */

/**
 * @swagger
 * /api/payment/create:
 *   post:
 *     tags:
 *       - 支付
 *     summary: 创建支付订单
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePaymentOrderRequest'
 *     responses:
 *       200:
 *         description: 支付订单创建成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/PaymentOrderResponse'
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.post('/create',
  authMiddleware.authenticate,
  createOrderLimiter,
  [
    body('productType')
      .isIn(['membership', 'quota', 'premium'])
      .withMessage('商品类型必须是: membership, quota, premium'),
    body('productName')
      .notEmpty()
      .isLength({ max: 100 })
      .withMessage('商品名称不能为空且不超过100个字符'),
    body('productDescription')
      .optional()
      .isLength({ max: 500 })
      .withMessage('商品描述不超过500个字符'),
    body('amount')
      .isFloat({ min: 0.01 })
      .withMessage('金额必须大于0.01'),
    body('paymentMethod')
      .isIn(['alipay', 'wechat'])
      .withMessage('支付方式必须是: alipay, wechat'),
    body('returnUrl')
      .optional()
      .isURL()
      .withMessage('返回地址格式不正确'),
    body('notifyUrl')
      .optional()
      .isURL()
      .withMessage('回调地址格式不正确')
  ],
  paymentController.createPaymentOrder
);

/**
 * @swagger
 * /api/payment/alipay/notify:
 *   post:
 *     tags:
 *       - 支付
 *     summary: 支付宝支付回调
 *     description: 处理支付宝服务器发来的支付结果通知
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               out_trade_no:
 *                 type: string
 *                 description: 商户订单号
 *               trade_no:
 *                 type: string
 *                 description: 支付宝交易号
 *               trade_status:
 *                 type: string
 *                 description: 交易状态
 *               total_amount:
 *                 type: string
 *                 description: 支付金额
 *     responses:
 *       200:
 *         description: 回调处理结果
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               enum: [success, fail]
 */
router.post('/alipay/notify', paymentController.handleAlipayNotify);

/**
 * @swagger
 * /api/payment/wechat/notify:
 *   post:
 *     tags:
 *       - 支付
 *     summary: 微信支付回调
 *     description: 处理微信支付服务器发来的支付结果通知
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: 通知ID
 *               event_type:
 *                 type: string
 *                 description: 事件类型
 *               resource:
 *                 type: object
 *                 description: 加密的数据资源
 *     responses:
 *       200:
 *         description: 回调处理结果
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: string
 *                   enum: [SUCCESS, FAIL]
 *                 message:
 *                   type: string
 */
router.post('/wechat/notify', paymentController.handleWechatNotify);

/**
 * @swagger
 * /api/payment/refund:
 *   post:
 *     tags:
 *       - 支付
 *     summary: 申请退款
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *               - refundAmount
 *             properties:
 *               orderId:
 *                 type: string
 *                 description: 订单ID
 *               refundAmount:
 *                 type: number
 *                 minimum: 0.01
 *                 description: 退款金额
 *               refundReason:
 *                 type: string
 *                 maxLength: 200
 *                 description: 退款原因
 *     responses:
 *       200:
 *         description: 退款申请成功
 */
router.post('/refund',
  authMiddleware.authenticate,
  paymentLimiter,
  [
    body('orderId')
      .notEmpty()
      .withMessage('订单ID不能为空'),
    body('refundAmount')
      .isFloat({ min: 0.01 })
      .withMessage('退款金额必须大于0.01'),
    body('refundReason')
      .optional()
      .isLength({ max: 200 })
      .withMessage('退款原因不超过200个字符')
  ],
  paymentController.createRefund
);

/**
 * @swagger
 * /api/payment/order/{orderId}:
 *   get:
 *     tags:
 *       - 支付
 *     summary: 查询订单状态
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: 订单ID
 *     responses:
 *       200:
 *         description: 订单信息
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
 *                     orderId:
 *                       type: string
 *                     orderNo:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [pending, paid, cancelled, refunded, partial_refunded]
 *                     amount:
 *                       type: number
 *                     productType:
 *                       type: string
 *                     productName:
 *                       type: string
 *                     paymentMethod:
 *                       type: string
 *                     paidAt:
 *                       type: string
 *                       format: date-time
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     expiredAt:
 *                       type: string
 *                       format: date-time
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: 订单不存在
 */
router.get('/order/:orderId',
  authMiddleware.authenticate,
  [
    param('orderId')
      .notEmpty()
      .withMessage('订单ID不能为空')
  ],
  paymentController.getOrderStatus
);

/**
 * @swagger
 * /api/payment/records:
 *   get:
 *     tags:
 *       - 支付
 *     summary: 获取用户支付记录
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: 每页数量
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, paid, cancelled, refunded, partial_refunded]
 *         description: 订单状态筛选
 *       - in: query
 *         name: paymentMethod
 *         schema:
 *           type: string
 *           enum: [alipay, wechat]
 *         description: 支付方式筛选
 *     responses:
 *       200:
 *         description: 支付记录列表
 */
router.get('/records',
  authMiddleware.authenticate,
  paymentLimiter,
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('页码必须是正整数'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('每页数量必须在1-100之间'),
    query('status')
      .optional()
      .isIn(['pending', 'paid', 'cancelled', 'refunded', 'partial_refunded'])
      .withMessage('状态值不正确'),
    query('paymentMethod')
      .optional()
      .isIn(['alipay', 'wechat'])
      .withMessage('支付方式不正确')
  ],
  paymentController.getUserPaymentRecords
);

/**
 * @swagger
 * /api/payment/refunds:
 *   get:
 *     tags:
 *       - 支付
 *     summary: 获取用户退款记录
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: 每页数量
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, success, failed, cancelled]
 *         description: 退款状态筛选
 *     responses:
 *       200:
 *         description: 退款记录列表
 */
router.get('/refunds',
  authMiddleware.authenticate,
  paymentLimiter,
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('页码必须是正整数'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('每页数量必须在1-100之间'),
    query('status')
      .optional()
      .isIn(['pending', 'success', 'failed', 'cancelled'])
      .withMessage('状态值不正确')
  ],
  paymentController.getUserRefundRecords
);

/**
 * @swagger
 * /api/payment/success:
 *   get:
 *     tags:
 *       - 支付
 *     summary: 支付成功页面
 *     description: 支付成功后的跳转页面
 *     parameters:
 *       - in: query
 *         name: orderId
 *         schema:
 *           type: string
 *         description: 订单ID
 *       - in: query
 *         name: out_trade_no
 *         schema:
 *           type: string
 *         description: 第三方订单号
 *     responses:
 *       200:
 *         description: 支付成功信息
 */
router.get('/success', paymentController.paymentSuccess);

/**
 * @swagger
 * /api/payment/cancel:
 *   get:
 *     tags:
 *       - 支付
 *     summary: 支付取消页面
 *     description: 支付取消后的跳转页面
 *     parameters:
 *       - in: query
 *         name: orderId
 *         schema:
 *           type: string
 *         description: 订单ID
 *       - in: query
 *         name: out_trade_no
 *         schema:
 *           type: string
 *         description: 第三方订单号
 *     responses:
 *       200:
 *         description: 支付取消信息
 */
router.get('/cancel', paymentController.paymentCancel);

/**
 * @swagger
 * /api/payment/stats:
 *   get:
 *     tags:
 *       - 支付
 *     summary: 获取支付统计信息
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 用户支付统计信息
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
 *                     totalOrders:
 *                       type: integer
 *                       description: 总订单数
 *                     paidOrders:
 *                       type: integer
 *                       description: 已支付订单数
 *                     totalAmount:
 *                       type: number
 *                       description: 总支付金额
 *                     totalRefunds:
 *                       type: integer
 *                       description: 总退款次数
 *                     refundAmount:
 *                       type: number
 *                       description: 总退款金额
 */
router.get('/stats',
  authMiddleware.authenticate,
  paymentController.getPaymentStats
);

module.exports = router;