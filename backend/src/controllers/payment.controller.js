const paymentService = require('../services/payment.service');
const logger = require('../utils/logger');

/**
 * 支付控制器 (P0-008)
 * 艹！处理所有支付相关的HTTP请求
 */
class PaymentController {
  /**
   * 创建微信支付订单
   * POST /api/payment/wechat/create
   */
  async createWechatOrder(req, res, next) {
    try {
      const userId = req.userId; // 从认证中间件获取
      const { amount, description } = req.body;

      // 参数验证
      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 3005,
            message: '金额必须大于0'
          }
        });
      }

      const result = await paymentService.createWechatOrder(
        userId,
        amount,
        description || '会员充值'
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 创建支付宝订单
   * POST /api/payment/alipay/create
   */
  async createAlipayOrder(req, res, next) {
    try {
      const userId = req.userId;
      const { amount, subject } = req.body;

      // 参数验证
      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 3005,
            message: '金额必须大于0'
          }
        });
      }

      const result = await paymentService.createAlipayOrder(
        userId,
        amount,
        subject || '会员充值'
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 微信支付回调
   * POST /api/payment/wechat/notify
   * 艹！这个接口不需要认证，由微信服务器调用
   */
  async wechatNotify(req, res, next) {
    try {
      const notifyData = req.body;

      await paymentService.handleWechatNotify(notifyData);

      // 返回微信要求的格式
      res.json({
        code: 'SUCCESS',
        message: '成功'
      });
    } catch (error) {
      logger.error('微信支付回调处理失败:', error);
      // 返回失败，微信会重试
      res.status(500).json({
        code: 'FAIL',
        message: error.message || '处理失败'
      });
    }
  }

  /**
   * 支付宝支付回调
   * POST /api/payment/alipay/notify
   * 艹！这个接口也不需要认证，由支付宝服务器调用
   */
  async alipayNotify(req, res, next) {
    try {
      const notifyData = req.body;

      await paymentService.handleAlipayNotify(notifyData);

      // 返回支付宝要求的格式
      res.send('success');
    } catch (error) {
      logger.error('支付宝回调处理失败:', error);
      // 返回失败，支付宝会重试
      res.send('fail');
    }
  }

  /**
   * 查询订单状态
   * GET /api/payment/order/:orderId
   */
  async getOrderStatus(req, res, next) {
    try {
      const { orderId } = req.params;
      const userId = req.userId;

      const order = await paymentService.getOrderStatus(orderId);

      // 验证订单归属
      const dbOrder = await require('../config/database')('orders')
        .where('id', orderId)
        .first();

      if (dbOrder.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: {
            code: 3006,
            message: '无权查看该订单'
          }
        });
      }

      res.json({
        success: true,
        data: order
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PaymentController();
