import type { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import logger from '../utils/logger.js';
import paymentService from '../services/payment.service.js';
import { db } from '../config/database.js';
import type {
  CreatePaymentOrderRequest,
  CreateRefundRequest,
  PaymentRecordsQuery,
  RefundRecordsQuery,
  PaymentOrder,
  RefundRecord,
  PaymentService,
  OrderStatusResponse
} from '../types/payment.types.js';
import type { Knex } from 'knex';

const paymentSvc = paymentService as unknown as PaymentService;

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const requireUserId = (req: Request, res: Response): string | null => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '未授权操作' } });
    return null;
  }
  return userId;
};

class PaymentController {
  async createPaymentOrder(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数验证失败',
            details: errors.array()
          }
        });
        return;
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
      } = req.body as CreatePaymentOrderRequest;
      const userId = requireUserId(req, res);
      if (!userId) return;

      const result = await paymentSvc.createPaymentOrder(userId, {
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
      const err = error as Error;
      logger.error('[PaymentController] 创建支付订单失败:', error);
      res.status(500).json({
        success: false,
        error: { code: 'CREATE_ORDER_ERROR', message: err?.message || '创建支付订单失败' },
        timestamp: new Date().toISOString()
      });
    }
  }

  async handleAlipayNotify(req: Request, res: Response): Promise<void> {
    try {
      logger.info('[PaymentController] 收到支付宝回调:', req.body);
      const result = await paymentSvc.handleAlipayCallback(req.body);
      res.send(result?.success ? 'success' : 'fail');
    } catch (error) {
      logger.error('[PaymentController] 处理支付宝回调失败:', error);
      res.send('fail');
    }
  }

  async handleWechatNotify(req: Request, res: Response): Promise<void> {
    try {
      logger.info('[PaymentController] 收到微信回调:', req.body);
      const result = await paymentSvc.handleWechatCallback(req.body);
      if (result?.success) {
        res.json({ code: 'SUCCESS', message: 'success' });
      } else {
        res.json({ code: 'FAIL', message: result?.message || 'fail' });
      }
    } catch (error) {
      const err = error as Error;
      logger.error('[PaymentController] 处理微信回调失败:', error);
      res.json({ code: 'FAIL', message: err?.message || 'fail' });
    }
  }

  async createRefund(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数验证失败',
            details: errors.array()
          }
        });
        return;
      }

      const { orderId, refundAmount, refundReason } = req.body as CreateRefundRequest;
      const userId = requireUserId(req, res);
      if (!userId) return;
      const result = await paymentSvc.createRefund(orderId, userId, {
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
      const err = error as Error;
      logger.error('[PaymentController] 创建退款失败:', error);
      res.status(500).json({
        success: false,
        error: { code: 'CREATE_REFUND_ERROR', message: err?.message || '创建退款失败' },
        timestamp: new Date().toISOString()
      });
    }
  }

  async getOrderStatus(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params as { orderId: string };
      const userId = requireUserId(req, res);
      if (!userId) return;
      const order = await paymentSvc.getOrderStatus(orderId, userId);
      res.json({ success: true, data: order, timestamp: new Date().toISOString() });
    } catch (error) {
      const err = error as Error;
      logger.error('[PaymentController] 查询订单状态失败:', error);
      res.status(404).json({
        success: false,
        error: { code: 'ORDER_NOT_FOUND', message: err?.message || '订单不存在' },
        timestamp: new Date().toISOString()
      });
    }
  }

  async getUserPaymentRecords(req: Request, res: Response): Promise<void> {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const {
        page = '1',
        limit = '20',
        status,
        paymentMethod
      } = req.query as PaymentRecordsQuery;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      let query: Knex.QueryBuilder = db('payment_orders')
        .where('user_id', userId)
        .orderBy('created_at', 'desc')
        .limit(parseInt(limit, 10))
        .offset(offset);
      if (status) query = query.where('status', status);
      if (paymentMethod) query = query.where('payment_method', paymentMethod);
      const orders = (await query) as PaymentOrder[];
      let countQuery: Knex.QueryBuilder = db('payment_orders').where('user_id', userId);
      if (status) countQuery = countQuery.where('status', status);
      const totalRows = await countQuery.count<{ count: string | number }[]>('* as count');
      const total = toNumber(totalRows[0]?.count);
      res.json({
        success: true,
        data: {
          orders,
          pagination: {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            total,
            pages: Math.ceil(total / parseInt(limit, 10))
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[PaymentController] 获取支付记录失败:', error);
      res.status(500).json({
        success: false,
        error: { code: 'GET_RECORDS_ERROR', message: '获取支付记录失败' }
      });
    }
  }

  async getUserRefundRecords(req: Request, res: Response): Promise<void> {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const { page = '1', limit = '20', status } = req.query as RefundRecordsQuery;
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      let query: Knex.QueryBuilder = db('refund_records')
        .leftJoin('payment_orders', 'refund_records.order_id', 'payment_orders.id')
        .select(
          'refund_records.*',
          'payment_orders.product_name',
          'payment_orders.order_no as original_order_no'
        )
        .where('refund_records.user_id', userId)
        .orderBy('refund_records.created_at', 'desc')
        .limit(parseInt(limit, 10))
        .offset(offset);
      if (status) query = query.where('refund_records.status', status);
      const refunds = (await query) as RefundRecord[];
      let countQuery: Knex.QueryBuilder = db('refund_records').where('user_id', userId);
      if (status) countQuery = countQuery.where('status', status);
      const totalRows = await countQuery.count<{ count: string | number }[]>('* as count');
      const total = toNumber(totalRows[0]?.count);
      res.json({
        success: true,
        data: {
          refunds,
          pagination: {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            total,
            pages: Math.ceil(total / parseInt(limit, 10))
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[PaymentController] 获取退款记录失败:', error);
      res.status(500).json({
        success: false,
        error: { code: 'GET_REFUNDS_ERROR', message: '获取退款记录失败' }
      });
    }
  }

  async paymentSuccess(req: Request, res: Response): Promise<void> {
    try {
      const { orderId, out_trade_no } = req.query as Record<string, string>;
      let order: OrderStatusResponse | null = null;
      if (orderId) {
        order = await paymentSvc.getOrderStatus(orderId);
      } else if (out_trade_no) {
        const orderRecord = (await db('payment_orders')
          .where('order_no', out_trade_no)
          .first()) as PaymentOrder | undefined;
        if (orderRecord) {
          order = await paymentSvc.getOrderStatus(orderRecord.id);
        }
      }
      if (!order) {
        res
          .status(404)
          .json({ success: false, error: { code: 'ORDER_NOT_FOUND', message: '订单不存在' } });
        return;
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
        error: { code: 'PAYMENT_SUCCESS_ERROR', message: '处理支付成功页面失败' }
      });
    }
  }

  async paymentCancel(req: Request, res: Response): Promise<void> {
    try {
      const { orderId, out_trade_no } = req.query as Record<string, string>;
      let order: OrderStatusResponse | null = null;
      if (orderId) {
        order = await paymentSvc.getOrderStatus(orderId);
      } else if (out_trade_no) {
        const orderRecord = (await db('payment_orders')
          .where('order_no', out_trade_no)
          .first()) as PaymentOrder | undefined;
        if (orderRecord) {
          order = await paymentSvc.getOrderStatus(orderRecord.id);
        }
      }
      if (order && order.status === 'pending') {
        await db('payment_orders')
          .where('id', order.orderId)
          .update({ status: 'cancelled', updated_at: new Date() });
        order = { ...order, status: 'cancelled' };
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
        error: { code: 'PAYMENT_CANCEL_ERROR', message: '处理支付取消页面失败' }
      });
    }
  }

  async getPaymentStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = requireUserId(req, res);
      if (!userId) return;
      const [totalOrders, paidOrders, totalAmount, totalRefunds, refundAmount] = await Promise.all([
        db('payment_orders').where('user_id', userId).count('* as count').first(),
        db('payment_orders').where({ user_id: userId, status: 'paid' }).count('* as count').first(),
        db('payment_orders')
          .where({ user_id: userId, status: 'paid' })
          .sum('amount as total')
          .first(),
        db('refund_records')
          .where({ user_id: userId, status: 'success' })
          .count('* as count')
          .first(),
        db('refund_records')
          .where({ user_id: userId, status: 'success' })
          .sum('refund_amount as total')
          .first()
      ]);
      res.json({
        success: true,
        data: {
          totalOrders: toNumber((totalOrders as { count?: string | number } | undefined)?.count),
          paidOrders: toNumber((paidOrders as { count?: string | number } | undefined)?.count),
          totalAmount: toNumber((totalAmount as { total?: string | number } | undefined)?.total),
          totalRefunds: toNumber((totalRefunds as { count?: string | number } | undefined)?.count),
          refundAmount: toNumber((refundAmount as { total?: string | number } | undefined)?.total)
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('[PaymentController] 获取支付统计失败:', error);
      res
        .status(500)
        .json({ success: false, error: { code: 'GET_STATS_ERROR', message: '获取支付统计失败' } });
    }
  }
}

export default new PaymentController();
