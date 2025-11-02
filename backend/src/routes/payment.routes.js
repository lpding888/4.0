const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { authenticate } = require('../middlewares/auth.middleware');

/**
 * @route POST /api/payment/wechat/create
 * @desc 创建微信支付订单
 * @access Private
 */
router.post('/wechat/create', authenticate, paymentController.createWechatOrder);

/**
 * @route POST /api/payment/alipay/create
 * @desc 创建支付宝订单
 * @access Private
 */
router.post('/alipay/create', authenticate, paymentController.createAlipayOrder);

/**
 * @route POST /api/payment/wechat/notify
 * @desc 微信支付回调（不需要认证，由微信服务器调用）
 * @access Public
 */
router.post('/wechat/notify', paymentController.wechatNotify);

/**
 * @route POST /api/payment/alipay/notify
 * @desc 支付宝回调（不需要认证，由支付宝服务器调用）
 * @access Public
 */
router.post('/alipay/notify', paymentController.alipayNotify);

/**
 * @route GET /api/payment/order/:orderId
 * @desc 查询订单状态
 * @access Private
 */
router.get('/order/:orderId', authenticate, paymentController.getOrderStatus);

module.exports = router;
