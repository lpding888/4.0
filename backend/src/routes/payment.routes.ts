import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticate } from '../middlewares/auth.middleware.js';
import paymentController from '../controllers/payment.controller.js';
import rateLimit from 'express-rate-limit';
import { idempotencyMiddleware } from '../middlewares/idempotency.middleware.js';

const router = Router();

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: '请求过于频繁，请稍后再试' }
  }
});

const createOrderLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: { code: 'CREATE_ORDER_RATE_LIMIT', message: '创建订单过于频繁，请稍后再试' }
  }
});

router.post(
  '/create',
  authenticate,
  createOrderLimiter,
  idempotencyMiddleware('payment_create'),
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
    body('amount').isFloat({ min: 0.01 }).withMessage('金额必须大于0.01'),
    body('paymentMethod').isIn(['alipay', 'wechat']).withMessage('支付方式必须是: alipay, wechat'),
    body('returnUrl').optional().isURL().withMessage('返回地址格式不正确'),
    body('notifyUrl').optional().isURL().withMessage('回调地址格式不正确')
  ],
  paymentController.createPaymentOrder
);

router.post('/alipay/notify', paymentController.handleAlipayNotify);
router.post('/wechat/notify', paymentController.handleWechatNotify);

router.post(
  '/refund',
  authenticate,
  paymentLimiter,
  [
    body('orderId').notEmpty().withMessage('订单ID不能为空'),
    body('refundAmount').isFloat({ min: 0.01 }).withMessage('退款金额必须大于0.01'),
    body('refundReason').optional().isLength({ max: 200 }).withMessage('退款原因不超过200个字符')
  ],
  paymentController.createRefund
);

router.get(
  '/order/:orderId',
  authenticate,
  [param('orderId').notEmpty()],
  paymentController.getOrderStatus
);

router.get(
  '/records',
  authenticate,
  paymentLimiter,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
    query('status')
      .optional()
      .isIn(['pending', 'paid', 'cancelled', 'refunded', 'partial_refunded'])
      .withMessage('状态值不正确'),
    query('paymentMethod').optional().isIn(['alipay', 'wechat']).withMessage('支付方式不正确')
  ],
  paymentController.getUserPaymentRecords
);

router.get(
  '/refunds',
  authenticate,
  paymentLimiter,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
    query('status')
      .optional()
      .isIn(['pending', 'success', 'failed', 'cancelled'])
      .withMessage('状态值不正确')
  ],
  paymentController.getUserRefundRecords
);

router.get('/success', paymentController.paymentSuccess);
router.get('/cancel', paymentController.paymentCancel);
router.get('/stats', authenticate, paymentController.getPaymentStats);

export default router;
