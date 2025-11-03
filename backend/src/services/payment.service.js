const logger = require('../utils/logger');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const AlipaySdk = require('alipay-sdk');
const { WxPay, Builder } = require('wechatpay-node-v3');
const paymentConfig = require('../config/payment.config');
const crypto = require('crypto');
const cacheService = require('./cache.service');

/**
 * 支付服务类
 *
 * 支持支付宝和微信支付：
 * - 创建支付订单
 * - 处理支付回调
 * - 退款处理
 * - 订单查询
 * - 安全验证
 */
class PaymentService {
  constructor() {
    this.alipaySdk = null;
    this.wxpay = null;
    this.initialized = false;

    // 缓存配置
    this.cacheConfig = {
      orderCacheTTL: 3600,      // 订单缓存1小时
      configCacheTTL: 86400     // 配置缓存24小时
    };
  }

  /**
   * 初始化支付服务
   */
  async initialize() {
    if (this.initialized) {
      logger.warn('[Payment] 支付服务已初始化');
      return;
    }

    try {
      // 初始化支付宝SDK
      try {
        paymentConfig.validateConfig('alipay');
        const alipayConfig = paymentConfig.getConfig('alipay');
        this.alipaySdk = new AlipaySdk({
          appId: alipayConfig.appId,
          privateKey: alipayConfig.privateKey,
          alipayPublicKey: alipayConfig.publicKey,
          gateway: alipayConfig.gateway,
          charset: 'utf-8',
          version: '1.0',
          signType: 'RSA2'
        });
        logger.info('[Payment] 支付宝SDK初始化成功');
      } catch (error) {
        logger.warn('[Payment] 支付宝SDK初始化失败:', error.message);
      }

      // 初始化微信支付SDK
      try {
        paymentConfig.validateConfig('wechat');
        const wechatConfig = paymentConfig.getConfig('wechat');
        this.wxpay = new WxPay.Builder()
          .setAppid(wechatConfig.appId)
          .setMchid(wechatConfig.mchId)
          .setPrivateKey(wechatConfig.privateKey)
          .setPublicKey(wechatConfig.publicKey)
          .setApiV3Key(wechatConfig.apiV3Key)
          .setMerchantSerialNumber(wechatConfig.merchantSerialNumber)
          .build();
        logger.info('[Payment] 微信支付SDK初始化成功');
      } catch (error) {
        logger.warn('[Payment] 微信支付SDK初始化失败:', error.message);
      }

      this.initialized = true;
      logger.info('[Payment] 支付服务初始化成功');

    } catch (error) {
      logger.error('[Payment] 支付服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 创建支付订单
   * @param {string} userId - 用户ID
   * @param {Object} orderData - 订单数据
   * @returns {Promise<Object>} 支付订单信息
   */
  async createPaymentOrder(userId, orderData) {
    const {
      productType,
      productId,
      productName,
      productDescription,
      amount,
      paymentMethod,
      returnUrl,
      notifyUrl
    } = orderData;

    try {
      // 验证参数
      this.validateOrderData(orderData);

      // 检查用户是否存在
      const user = await db('users').where('id', userId).first();
      if (!user) {
        throw new Error('用户不存在');
      }

      // 生成订单号和ID
      const orderId = this.generateOrderId();
      const orderNo = this.generateOrderNo();

      // 计算过期时间
      const expiredAt = new Date();
      expiredAt.setMinutes(expiredAt.getMinutes() + paymentConfig.common.timeout.orderExpireMinutes);

      // 创建订单记录
      const orderRecord = {
        id: orderId,
        user_id: userId,
        order_no: orderNo,
        product_type: productType,
        product_id: productId,
        product_name: productName,
        product_description: productDescription,
        amount: amount,
        currency: 'CNY',
        payment_method: paymentMethod,
        status: 'pending',
        expired_at: expiredAt
      };

      await db('payment_orders').insert(orderRecord);

      // 创建交易记录
      const transactionNo = this.generateTransactionNo();
      await db('payment_transactions').insert({
        id: this.generateId(),
        order_id: orderId,
        user_id: userId,
        transaction_no: transactionNo,
        payment_method: paymentMethod,
        action_type: 'payment',
        amount: amount,
        status: 'pending'
      });

      // 生成支付参数
      let paymentParams = null;
      if (paymentMethod === 'alipay' && this.alipaySdk) {
        paymentParams = await this.createAlipayOrder(orderRecord, returnUrl, notifyUrl);
      } else if (paymentMethod === 'wechat' && this.wxpay) {
        paymentParams = await this.createWechatOrder(orderRecord, notifyUrl);
      } else {
        throw new Error(`不支持的支付方式: ${paymentMethod}`);
      }

      // 更新订单的支付参数
      await db('payment_orders')
        .where('id', orderId)
        .update({
          payment_params: JSON.stringify(paymentParams),
          updated_at: new Date()
        });

      // 缓存订单信息
      const cacheKey = `payment_order:${orderId}`;
      await cacheService.set(cacheKey, { ...orderRecord, payment_params: paymentParams }, this.cacheConfig.orderCacheTTL);

      logger.info(`[Payment] 支付订单创建成功: orderId=${orderId}, amount=${amount}, method=${paymentMethod}`);

      return {
        orderId,
        orderNo,
        paymentParams,
        expireTime: expiredAt.toISOString()
      };

    } catch (error) {
      logger.error(`[Payment] 创建支付订单失败:`, error);
      throw error;
    }
  }

  /**
   * 处理支付宝回调
   * @param {Object} callbackData - 回调数据
   * @returns {Promise<Object>} 处理结果
   */
  async handleAlipayCallback(callbackData) {
    try {
      // 验证签名
      if (!this.alipaySdk) {
        throw new Error('支付宝SDK未初始化');
      }

      const signVerified = this.alipaySdk.checkNotifySign(callbackData);
      if (!signVerified) {
        throw new Error('支付宝回调签名验证失败');
      }

      const { out_trade_no, trade_no, trade_status, total_amount, gmt_payment } = callbackData;

      // 查找订单
      const order = await db('payment_orders').where('order_no', out_trade_no).first();
      if (!order) {
        throw new Error('订单不存在');
      }

      // 验证金额
      if (parseFloat(total_amount) !== parseFloat(order.amount)) {
        throw new Error('金额不匹配');
      }

      // 检查订单状态
      if (order.status !== 'pending') {
        logger.warn(`[Payment] 订单状态异常: orderNo=${out_trade_no}, status=${order.status}`);
        return { success: true, message: '订单已处理' };
      }

      // 更新订单状态
      await db.transaction(async (trx) => {
        // 更新订单
        await trx('payment_orders')
          .where('id', order.id)
          .update({
            status: 'paid',
            trade_no: trade_no,
            payment_result: JSON.stringify(callbackData),
            paid_at: new Date(gmt_payment),
            updated_at: new Date()
          });

        // 更新交易记录
        await trx('payment_transactions')
          .where('order_id', order.id)
          .where('action_type', 'payment')
          .update({
            status: 'success',
            gateway_transaction_no: trade_no,
            response_data: JSON.stringify(callbackData)
          });

        // 执行业务逻辑（如增加配额、开通会员等）
        await this.processOrderPaid(order.id, order.user_id, order.product_type, order.product_id);
      });

      // 清除缓存
      const cacheKey = `payment_order:${order.id}`;
      await cacheService.delete(cacheKey);

      logger.info(`[Payment] 支付宝回调处理成功: orderNo=${out_trade_no}, tradeNo=${trade_no}`);

      return { success: true, message: '支付成功' };

    } catch (error) {
      logger.error('[Payment] 处理支付宝回调失败:', error);
      throw error;
    }
  }

  /**
   * 处理微信支付回调
   * @param {Object} callbackData - 回调数据
   * @returns {Promise<Object>} 处理结果
   */
  async handleWechatCallback(callbackData) {
    try {
      // 验证签名
      if (!this.wxpay) {
        throw new Error('微信支付SDK未初始化');
      }

      const { id, event_type, resource, summary } = callbackData;

      // 验证资源签名
      const decryptedData = this.wxpay.decryptResource(resource);
      if (!decryptedData) {
        throw new Error('微信回调签名验证失败');
      }

      const { out_trade_no, transaction_id, trade_state, amount: { total }, success_time } = decryptedData;

      // 查找订单
      const order = await db('payment_orders').where('order_no', out_trade_no).first();
      if (!order) {
        throw new Error('订单不存在');
      }

      // 验证金额（分为单位）
      if (total !== Math.round(parseFloat(order.amount) * 100)) {
        throw new Error('金额不匹配');
      }

      // 只处理支付成功事件
      if (event_type !== 'TRANSACTION.SUCCESS' || trade_state !== 'SUCCESS') {
        logger.warn(`[Payment] 微信回调事件异常: orderNo=${out_trade_no}, eventType=${event_type}, tradeState=${trade_state}`);
        return { success: true, message: '事件已记录' };
      }

      // 检查订单状态
      if (order.status !== 'pending') {
        logger.warn(`[Payment] 订单状态异常: orderNo=${out_trade_no}, status=${order.status}`);
        return { success: true, message: '订单已处理' };
      }

      // 更新订单状态
      await db.transaction(async (trx) => {
        // 更新订单
        await trx('payment_orders')
          .where('id', order.id)
          .update({
            status: 'paid',
            trade_no: transaction_id,
            payment_result: JSON.stringify(callbackData),
            paid_at: new Date(success_time),
            updated_at: new Date()
          });

        // 更新交易记录
        await trx('payment_transactions')
          .where('order_id', order.id)
          .where('action_type', 'payment')
          .update({
            status: 'success',
            gateway_transaction_no: transaction_id,
            response_data: JSON.stringify(callbackData)
          });

        // 执行业务逻辑
        await this.processOrderPaid(order.id, order.user_id, order.product_type, order.product_id);
      });

      // 清除缓存
      const cacheKey = `payment_order:${order.id}`;
      await cacheService.delete(cacheKey);

      logger.info(`[Payment] 微信回调处理成功: orderNo=${out_trade_no}, transactionId=${transaction_id}`);

      return { success: true, message: '支付成功' };

    } catch (error) {
      logger.error('[Payment] 处理微信回调失败:', error);
      throw error;
    }
  }

  /**
   * 申请退款
   * @param {string} orderId - 订单ID
   * @param {string} userId - 用户ID
   * @param {Object} refundData - 退款数据
   * @returns {Promise<Object>} 退款结果
   */
  async createRefund(orderId, userId, refundData) {
    const { refundAmount, refundReason } = refundData;

    try {
      // 查找订单
      const order = await db('payment_orders')
        .where({ id: orderId, user_id: userId, status: 'paid' })
        .first();

      if (!order) {
        throw new Error('订单不存在或状态异常');
      }

      // 检查退款金额
      if (parseFloat(refundAmount) > parseFloat(order.amount)) {
        throw new Error('退款金额不能大于订单金额');
      }

      // 检查是否已有退款记录
      const existingRefund = await db('refund_records')
        .where('order_id', orderId)
        .where('status', 'in', ['pending', 'success'])
        .first();

      if (existingRefund) {
        throw new Error('订单已申请退款');
      }

      // 生成退款单号
      const refundId = this.generateId();
      const refundNo = this.generateRefundNo();

      // 创建退款记录
      const refundRecord = {
        id: refundId,
        order_id: orderId,
        user_id: userId,
        refund_no: refundNo,
        payment_method: order.payment_method,
        order_amount: order.amount,
        refund_amount: refundAmount,
        status: 'pending',
        refund_reason: refundReason
      };

      await db('refund_records').insert(refundRecord);

      // 创建退款交易记录
      const transactionNo = this.generateTransactionNo();
      await db('payment_transactions').insert({
        id: this.generateId(),
        order_id: orderId,
        user_id: userId,
        transaction_no: transactionNo,
        payment_method: order.payment_method,
        action_type: 'refund',
        amount: refundAmount,
        status: 'pending'
      });

      // 调用支付网关退款接口
      let refundResult = null;
      if (order.payment_method === 'alipay' && this.alipaySdk) {
        refundResult = await this.createAlipayRefund(order, refundRecord);
      } else if (order.payment_method === 'wechat' && this.wxpay) {
        refundResult = await this.createWechatRefund(order, refundRecord);
      } else {
        throw new Error(`不支持的支付方式退款: ${order.payment_method}`);
      }

      // 更新退款记录
      await db('refund_records')
        .where('id', refundId)
        .update({
          gateway_refund_no: refundResult.refundNo,
          refund_result: JSON.stringify(refundResult),
          status: refundResult.success ? 'success' : 'failed',
          refunded_at: refundResult.success ? new Date() : null,
          updated_at: new Date()
        });

      // 更新交易记录
      await db('payment_transactions')
        .where('transaction_no', transactionNo)
        .update({
          status: refundResult.success ? 'success' : 'failed',
          gateway_transaction_no: refundResult.refundNo,
          response_data: JSON.stringify(refundResult)
        });

      // 更新订单状态
      if (refundResult.success) {
        const newOrderStatus = parseFloat(refundAmount) >= parseFloat(order.amount) ? 'refunded' : 'partial_refunded';
        await db('payment_orders')
          .where('id', orderId)
          .update({ status: newOrderStatus, updated_at: new Date() });

        // 执行业务回滚逻辑
        await this.processOrderRefunded(orderId, userId, order.product_type, refundAmount);
      }

      logger.info(`[Payment] 退款申请处理完成: refundId=${refundId}, amount=${refundAmount}, success=${refundResult.success}`);

      return {
        refundId,
        refundNo,
        refundAmount,
        status: refundResult.success ? 'success' : 'failed',
        message: refundResult.message
      };

    } catch (error) {
      logger.error('[Payment] 创建退款失败:', error);
      throw error;
    }
  }

  /**
   * 查询订单状态
   * @param {string} orderId - 订单ID
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 订单信息
   */
  async getOrderStatus(orderId, userId = null) {
    try {
      // 先从缓存获取
      const cacheKey = `payment_order:${orderId}`;
      let order = await cacheService.get(cacheKey);

      if (!order) {
        const query = db('payment_orders').where('id', orderId);
        if (userId) {
          query.where('user_id', userId);
        }
        order = await query.first();

        if (order) {
          // 缓存订单信息
          await cacheService.set(cacheKey, order, this.cacheConfig.orderCacheTTL);
        }
      }

      if (!order) {
        throw new Error('订单不存在');
      }

      return {
        orderId: order.id,
        orderNo: order.order_no,
        status: order.status,
        amount: order.amount,
        productType: order.product_type,
        productName: order.product_name,
        paymentMethod: order.payment_method,
        paidAt: order.paid_at,
        createdAt: order.created_at,
        expiredAt: order.expired_at
      };

    } catch (error) {
      logger.error(`[Payment] 查询订单状态失败: orderId=${orderId}`, error);
      throw error;
    }
  }

  // 私有方法

  /**
   * 验证订单数据
   * @param {Object} orderData - 订单数据
   * @private
   */
  validateOrderData(orderData) {
    const { productType, productName, amount, paymentMethod } = orderData;

    if (!productType || !productName || !amount || !paymentMethod) {
      throw new Error('订单数据不完整');
    }

    if (!['alipay', 'wechat'].includes(paymentMethod)) {
      throw new Error('不支持的支付方式');
    }

    if (parseFloat(amount) <= 0) {
      throw new Error('金额必须大于0');
    }

    // 验证商品类型
    try {
      paymentConfig.getProductConfig(productType);
    } catch (error) {
      throw new Error(`不支持的商品类型: ${productType}`);
    }
  }

  /**
   * 创建支付宝订单
   * @param {Object} order - 订单数据
   * @param {string} returnUrl - 返回地址
   * @param {string} notifyUrl - 回调地址
   * @returns {Promise<Object>} 支付参数
   * @private
   */
  async createAlipayOrder(order, returnUrl = null, notifyUrl = null) {
    const config = paymentConfig.getConfig('alipay');
    const returnUrlUrl = returnUrl || config.callbacks.return;
    const notifyUrlUrl = notifyUrl || config.callbacks.notify;

    const bizContent = {
      out_trade_no: order.order_no,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      total_amount: order.amount,
      subject: order.product_name,
      body: order.product_description,
      timeout_express: `${paymentConfig.common.timeout.orderExpireMinutes}m`
    };

    const result = await this.alipaySdk.pageExec('alipay.trade.page.pay', {
      notify_url: notifyUrlUrl,
      return_url: returnUrlUrl,
      biz_content: bizContent
    });

    return {
      method: 'redirect',
      url: result
    };
  }

  /**
   * 创建微信支付订单
   * @param {Object} order - 订单数据
   * @param {string} notifyUrl - 回调地址
   * @returns {Promise<Object>} 支付参数
   * @private
   */
  async createWechatOrder(order, notifyUrl = null) {
    const config = paymentConfig.getConfig('wechat');
    const notifyUrlUrl = notifyUrl || config.callbacks.notify;

    const params = {
      description: order.product_name,
      out_trade_no: order.order_no,
      amount: {
        total: Math.round(order.amount * 100), // 转换为分
        currency: 'CNY'
      },
      notify_url: notifyUrlUrl,
      time_expire: new Date(order.expired_at).toISOString().replace(/\.\d{3}Z$/, '+08:00')
    };

    const result = await this.wxpay.transactions_jsapi(params);

    return {
      method: 'jsapi',
      params: result
    };
  }

  /**
   * 创建支付宝退款
   * @param {Object} order - 订单数据
   * @param {Object} refund - 退款数据
   * @returns {Promise<Object>} 退款结果
   * @private
   */
  async createAlipayRefund(order, refund) {
    try {
      const result = await this.alipaySdk.exec('alipay.trade.refund', {
        biz_content: {
          out_trade_no: order.order_no,
          refund_amount: refund.refund_amount,
          refund_reason: refund.refund_reason,
          out_request_no: refund.refund_no
        }
      });

      return {
        success: result.code === '10000',
        refundNo: result.refund_no || result.out_request_no,
        message: result.msg || result.sub_msg
      };

    } catch (error) {
      logger.error('[Payment] 支付宝退款失败:', error);
      return {
        success: false,
        refundNo: null,
        message: error.message
      };
    }
  }

  /**
   * 创建微信支付退款
   * @param {Object} order - 订单数据
   * @param {Object} refund - 退款数据
   * @returns {Promise<Object>} 退款结果
   * @private
   */
  async createWechatRefund(order, refund) {
    try {
      const params = {
        out_trade_no: order.order_no,
        out_refund_no: refund.refund_no,
        amount: {
          refund: Math.round(refund.refund_amount * 100), // 转换为分
          total: Math.round(order.order_amount * 100),
          currency: 'CNY'
        },
        reason: refund.refund_reason
      };

      const result = await this.wxpay.refund(params);

      return {
        success: result.status === 'SUCCESS' || result.status === 'PROCESSING',
        refundNo: result.refund_id,
        message: '退款申请成功'
      };

    } catch (error) {
      logger.error('[Payment] 微信退款失败:', error);
      return {
        success: false,
        refundNo: null,
        message: error.message
      };
    }
  }

  /**
   * 处理订单支付成功后的业务逻辑
   * @param {string} orderId - 订单ID
   * @param {string} userId - 用户ID
   * @param {string} productType - 商品类型
   * @param {string} productId - 商品ID
   * @private
   */
  async processOrderPaid(orderId, userId, productType, productId) {
    try {
      logger.info(`[Payment] 处理订单支付成功: orderId=${orderId}, productType=${productType}`);

      // 根据商品类型执行不同的业务逻辑
      switch (productType) {
        case 'membership':
          // 开通会员逻辑
          await this.activateMembership(userId, productId);
          break;
        case 'quota':
          // 增加配额逻辑
          await this.addQuota(userId, productId);
          break;
        case 'premium':
          // 开通高级功能逻辑
          await this.activatePremium(userId, productId);
          break;
        default:
          logger.warn(`[Payment] 未知的商品类型: ${productType}`);
      }

      // 发送支付成功通知
      await this.sendPaymentNotification(userId, orderId, productType, 'paid');

    } catch (error) {
      logger.error(`[Payment] 处理订单支付成功业务逻辑失败: orderId=${orderId}`, error);
      // 不抛出错误，避免影响支付流程
    }
  }

  /**
   * 处理订单退款后的业务逻辑
   * @param {string} orderId - 订单ID
   * @param {string} userId - 用户ID
   * @param {string} productType - 商品类型
   * @param {number} refundAmount - 退款金额
   * @private
   */
  async processOrderRefunded(orderId, userId, productType, refundAmount) {
    try {
      logger.info(`[Payment] 处理订单退款: orderId=${orderId}, productType=${productType}, amount=${refundAmount}`);

      // 根据商品类型执行不同的回滚逻辑
      switch (productType) {
        case 'membership':
          // 会员退费逻辑
          await this.deactivateMembership(userId);
          break;
        case 'quota':
          // 减少配额逻辑
          await this.deductQuota(userId, refundAmount);
          break;
        case 'premium':
          // 取消高级功能逻辑
          await this.deactivatePremium(userId);
          break;
        default:
          logger.warn(`[Payment] 未知的商品类型: ${productType}`);
      }

      // 发送退款通知
      await this.sendPaymentNotification(userId, orderId, productType, 'refunded');

    } catch (error) {
      logger.error(`[Payment] 处理订单退款业务逻辑失败: orderId=${orderId}`, error);
      // 不抛出错误，避免影响退款流程
    }
  }

  /**
   * 发送支付通知
   * @param {string} userId - 用户ID
   * @param {string} orderId - 订单ID
   * @param {string} productType - 商品类型
   * @param {string} status - 状态
   * @private
   */
  async sendPaymentNotification(userId, orderId, productType, status) {
    try {
      // 这里可以集成通知服务（邮件、短信、站内信等）
      logger.info(`[Payment] 发送支付通知: userId=${userId}, orderId=${orderId}, status=${status}`);
    } catch (error) {
      logger.error('[Payment] 发送支付通知失败:', error);
    }
  }

  /**
   * 激活会员
   * @param {string} userId - 用户ID
   * @param {string} productId - 商品ID
   * @private
   */
  async activateMembership(userId, productId) {
    // 实现会员激活逻辑
    logger.info(`[Payment] 激活会员: userId=${userId}, productId=${productId}`);
  }

  /**
   * 增加配额
   * @param {string} userId - 用户ID
   * @param {string} productId - 商品ID
   * @private
   */
  async addQuota(userId, productId) {
    // 实现配额增加逻辑
    logger.info(`[Payment] 增加配额: userId=${userId}, productId=${productId}`);
  }

  /**
   * 激活高级功能
   * @param {string} userId - 用户ID
   * @param {string} productId - 商品ID
   * @private
   */
  async activatePremium(userId, productId) {
    // 实现高级功能激活逻辑
    logger.info(`[Payment] 激活高级功能: userId=${userId}, productId=${productId}`);
  }

  /**
   * 取消会员
   * @param {string} userId - 用户ID
   * @private
   */
  async deactivateMembership(userId) {
    // 实现会员取消逻辑
    logger.info(`[Payment] 取消会员: userId=${userId}`);
  }

  /**
   * 扣减配额
   * @param {string} userId - 用户ID
   * @param {number} amount - 金额
   * @private
   */
  async deductQuota(userId, amount) {
    // 实现配额扣减逻辑
    logger.info(`[Payment] 扣减配额: userId=${userId}, amount=${amount}`);
  }

  /**
   * 取消高级功能
   * @param {string} userId - 用户ID
   * @private
   */
  async deactivatePremium(userId) {
    // 实现高级功能取消逻辑
    logger.info(`[Payment] 取消高级功能: userId=${userId}`);
  }

  /**
   * 生成订单ID
   * @returns {string}
   * @private
   */
  generateOrderId() {
    return `pay_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * 生成订单号
   * @returns {string}
   * @private
   */
  generateOrderNo() {
    const date = new Date();
    const dateStr = date.getFullYear().toString() +
                   (date.getMonth() + 1).toString().padStart(2, '0') +
                   date.getDate().toString().padStart(2, '0');
    const timeStr = Date.now().toString().slice(-6);
    const randomStr = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `PAY${dateStr}${timeStr}${randomStr}`;
  }

  /**
   * 生成退款单号
   * @returns {string}
   * @private
   */
  generateRefundNo() {
    const date = new Date();
    const dateStr = date.getFullYear().toString() +
                   (date.getMonth() + 1).toString().padStart(2, '0') +
                   date.getDate().toString().padStart(2, '0');
    const timeStr = Date.now().toString().slice(-6);
    const randomStr = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `REF${dateStr}${timeStr}${randomStr}`;
  }

  /**
   * 生成交易流水号
   * @returns {string}
   * @private
   */
  generateTransactionNo() {
    const date = new Date();
    const dateStr = date.getFullYear().toString() +
                   (date.getMonth() + 1).toString().padStart(2, '0') +
                   date.getDate().toString().padStart(2, '0');
    const timeStr = Date.now().toString().slice(-8);
    const randomStr = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `TXN${dateStr}${timeStr}${randomStr}`;
  }

  /**
   * 生成ID
   * @returns {string}
   * @private
   */
  generateId() {
    return uuidv4().replace(/-/g, '');
  }

  /**
   * 关闭支付服务
   */
  async close() {
    this.initialized = false;
    this.alipaySdk = null;
    this.wxpay = null;
    logger.info('[Payment] 支付服务已关闭');
  }
}

module.exports = new PaymentService();