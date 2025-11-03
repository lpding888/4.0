const logger = require('../utils/logger');
const paymentService = require('../services/payment.service');
const db = require('../config/database');
const { body, param, validationResult } = require('express-validator');

/**
 * 支付控制器
 *
 * 处理支付相关的HTTP请求：
 * - 创建支付订单
 * - 支付回调处理
 * - 退款申请
 * - 订单查询
 */
class PaymentController {
  /**
   * 创建支付订单
   * POST /api/payment/create
   */
  async createPaymentOrder(req, res) {
    try {
      // 参数验证
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数验证失败',
            details: errors.array()
          }
        });
      }

      const {
        productType,
        productId,
        productName,
        productDescription,
        amount,
        paymentMethod,
        returnUrl,
        notifyUrl
      } = req.body;

      const userId = req.user.id;

      // 创建支付订单
      const result = await paymentService.createPaymentOrder(userId, {
        productType,
        productId,
        productName,
        productDescription,
        amount,
        paymentMethod,
        returnUrl,
        notifyUrl
      });

      res.json({
        success: true,
        data: result,
        message: '支付订单创建成功',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[PaymentController] 创建支付订单失败:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_ORDER_ERROR',
          message: error.message || '创建支付订单失败'
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 处理支付宝回调
   * POST /api/payment/alipay/notify
   */
  async handleAlipayNotify(req, res) {
    try {
      logger.info('[PaymentController] 收到支付宝回调:', req.body);

      const result = await paymentService.handleAlipayCallback(req.body);

      // 支付宝回调要求返回纯文本success
      if (result.success) {
        res.send('success');
      } else {
        res.send('fail');
      }

    } catch (error) {
      logger.error('[PaymentController] 处理支付宝回调失败:', error);
      res.send('fail');
    }
  }

  /**
   * 处理微信支付回调
   * POST /api/payment/wechat/notify
   */
  async handleWechatNotify(req, res) {
    try {
      logger.info('[PaymentController] 收到微信回调:', req.body);

      const result = await paymentService.handleWechatCallback(req.body);

      if (result.success) {
        res.json({
          code: 'SUCCESS',
          message: 'success'
        });
      } else {
        res.json({
          code: 'FAIL',
          message: result.message
        });
      }

    } catch (error) {
      logger.error('[PaymentController] 处理微信回调失败:', error);
      res.json({
        code: 'FAIL',
        message: error.message
      });
    }
  }

  /**
   * 申请退款
   * POST /api/payment/refund
   */
  async createRefund(req, res) {
    try {
      // 参数验证
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数验证失败',
            details: errors.array()
          }
        });
      }

      const { orderId, refundAmount, refundReason } = req.body;
      const userId = req.user.id;

      // 创建退款
      const result = await paymentService.createRefund(orderId, userId, {
        refundAmount,
        refundReason
      });

      res.json({
        success: true,
        data: result,
        message: '退款申请提交成功',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[PaymentController] 创建退款失败:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_REFUND_ERROR',
          message: error.message || '创建退款失败'
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 查询订单状态
   * GET /api/payment/order/:orderId
   */
  async getOrderStatus(req, res) {
    try {
      const { orderId } = req.params;
      const userId = req.user.id;

      // 查询订单状态
      const order = await paymentService.getOrderStatus(orderId, userId);

      res.json({
        success: true,
        data: order,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[PaymentController] 查询订单状态失败:', error);

      res.status(404).json({
        success: false,
        error: {
          code: 'ORDER_NOT_FOUND',
          message: error.message || '订单不存在'
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 获取用户支付记录
   * GET /api/payment/records
   */
  async getUserPaymentRecords(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, status, paymentMethod } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      // 构建查询条件
      let query = db('payment_orders')
        .where('user_id', userId)
        .orderBy('created_at', 'desc')
        .limit(parseInt(limit))
        .offset(offset);

      // 添加筛选条件
      if (status) {
        query = query.where('status', status);
      }
      if (paymentMethod) {
        query = query.where('payment_method', paymentMethod);
      }

      const orders = await query;

      // 获取总数
      let countQuery = db('payment_orders').where('user_id', userId);
      if (status) countQuery = countQuery.where('status', status);
      if (paymentMethod) countQuery = countQuery.where('payment_method', paymentMethod);
      const total = await countQuery.count('* as total').first();

      res.json({
        success: true,
        data: {
          orders,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: parseInt(total.total),
            pages: Math.ceil(total.total / parseInt(limit))
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[PaymentController] 获取支付记录失败:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_RECORDS_ERROR',
          message: '获取支付记录失败'
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 获取退款记录
   * GET /api/payment/refunds
   */
  async getUserRefundRecords(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, status } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);

      // 构建查询条件
      let query = db('refund_records')
        .leftJoin('payment_orders', 'refund_records.order_id', 'payment_orders.id')
        .select(
          'refund_records.*',
          'payment_orders.product_name',
          'payment_orders.order_no as original_order_no'
        )
        .where('refund_records.user_id', userId)
        .orderBy('refund_records.created_at', 'desc')
        .limit(parseInt(limit))
        .offset(offset);

      // 添加筛选条件
      if (status) {
        query = query.where('refund_records.status', status);
      }

      const refunds = await query;

      // 获取总数
      let countQuery = db('refund_records').where('user_id', userId);
      if (status) countQuery = countQuery.where('status', status);
      const total = await countQuery.count('* as total').first();

      res.json({
        success: true,
        data: {
          refunds,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: parseInt(total.total),
            pages: Math.ceil(total.total / parseInt(limit))
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[PaymentController] 获取退款记录失败:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_REFUNDS_ERROR',
          message: '获取退款记录失败'
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 支付成功页面
   * GET /api/payment/success
   */
  async paymentSuccess(req, res) {
    try {
      const { orderId, out_trade_no } = req.query;

      let order = null;
      if (orderId) {
        order = await paymentService.getOrderStatus(orderId);
      } else if (out_trade_no) {
        // 通过订单号查询
        const orderRecord = await db('payment_orders').where('order_no', out_trade_no).first();
        if (orderRecord) {
          order = await paymentService.getOrderStatus(orderRecord.id);
        }
      }

      if (!order) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'ORDER_NOT_FOUND',
            message: '订单不存在'
          }
        });
      }

      res.json({
        success: true,
        data: order,
        message: '支付成功',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[PaymentController] 支付成功页面处理失败:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'PAYMENT_SUCCESS_ERROR',
          message: '处理支付成功页面失败'
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 支付取消页面
   * GET /api/payment/cancel
   */
  async paymentCancel(req, res) {
    try {
      const { orderId, out_trade_no } = req.query;

      let order = null;
      if (orderId) {
        order = await paymentService.getOrderStatus(orderId);
      } else if (out_trade_no) {
        // 通过订单号查询
        const orderRecord = await db('payment_orders').where('order_no', out_trade_no).first();
        if (orderRecord) {
          order = await paymentService.getOrderStatus(orderRecord.id);
        }
      }

      if (order) {
        // 如果订单还是pending状态，可以标记为取消
        if (order.status === 'pending') {
          await db('payment_orders')
            .where('id', order.orderId)
            .update({ status: 'cancelled', updated_at: new Date() });

          order.status = 'cancelled';
        }
      }

      res.json({
        success: true,
        data: order,
        message: '支付已取消',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[PaymentController] 支付取消页面处理失败:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'PAYMENT_CANCEL_ERROR',
          message: '处理支付取消页面失败'
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 获取支付统计信息
   * GET /api/payment/stats
   */
  async getPaymentStats(req, res) {
    try {
      const userId = req.user.id;

      // 获取用户支付统计
      const [
        totalOrders,
        paidOrders,
        totalAmount,
        totalRefunds,
        refundAmount
      ] = await Promise.all([
        db('payment_orders').where('user_id', userId).count('* as count').first(),
        db('payment_orders').where({ user_id: userId, status: 'paid' }).count('* as count').first(),
        db('payment_orders').where({ user_id: userId, status: 'paid' }).sum('amount as total').first(),
        db('refund_records').where({ user_id: userId, status: 'success' }).count('* as count').first(),
        db('refund_records').where({ user_id: userId, status: 'success' }).sum('refund_amount as total').first()
      ]);

      res.json({
        success: true,
        data: {
          totalOrders: parseInt(totalOrders.count),
          paidOrders: parseInt(paidOrders.count),
          totalAmount: parseFloat(totalAmount.total) || 0,
          totalRefunds: parseInt(totalRefunds.count),
          refundAmount: parseFloat(refundAmount.total) || 0
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[PaymentController] 获取支付统计失败:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_STATS_ERROR',
          message: '获取支付统计失败'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
}

module.exports = new PaymentController();