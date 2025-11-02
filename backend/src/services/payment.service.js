const db = require('../config/database');
const logger = require('../utils/logger');
const { generateId } = require('../utils/generator');
const Payment = require('wechatpay-node-v3');
const AlipaySdk = require('alipay-sdk').default;

/**
 * 支付服务 (P0-008)
 * 艹！这个服务处理微信支付和支付宝支付的所有逻辑
 */
class PaymentService {
  constructor() {
    this.initWechatPay();
    this.initAlipay();
  }

  /**
   * 初始化微信支付SDK
   * 艹！微信支付V3的配置真TM复杂
   */
  initWechatPay() {
    try {
      const {
        WECHAT_APP_ID,
        WECHAT_PAY_MCHID,
        WECHAT_PAY_SERIAL_NO,
        WECHAT_PAY_PRIVATE_KEY,
        WECHAT_PAY_APIV3_KEY
      } = process.env;

      if (!WECHAT_APP_ID || !WECHAT_PAY_MCHID) {
        logger.warn('微信支付配置不完整，将使用Mock模式');
        this.wechatPay = null;
        return;
      }

      this.wechatPay = new Payment({
        appid: WECHAT_APP_ID,
        mchid: WECHAT_PAY_MCHID,
        serial_no: WECHAT_PAY_SERIAL_NO,
        privateKey: WECHAT_PAY_PRIVATE_KEY,
        key: WECHAT_PAY_APIV3_KEY
      });

      logger.info('微信支付SDK初始化成功');
    } catch (error) {
      logger.error('微信支付SDK初始化失败:', error);
      this.wechatPay = null;
    }
  }

  /**
   * 初始化支付宝SDK
   * 艹！支付宝的SDK也不简单
   */
  initAlipay() {
    try {
      const {
        ALIPAY_APP_ID,
        ALIPAY_PRIVATE_KEY,
        ALIPAY_PUBLIC_KEY
      } = process.env;

      if (!ALIPAY_APP_ID || !ALIPAY_PRIVATE_KEY) {
        logger.warn('支付宝配置不完整，将使用Mock模式');
        this.alipaySdk = null;
        return;
      }

      this.alipaySdk = new AlipaySdk({
        appId: ALIPAY_APP_ID,
        privateKey: ALIPAY_PRIVATE_KEY,
        alipayPublicKey: ALIPAY_PUBLIC_KEY,
        gateway: process.env.NODE_ENV === 'production'
          ? 'https://openapi.alipay.com/gateway.do'
          : 'https://openapi.alipaydev.com/gateway.do',
        signType: 'RSA2'
      });

      logger.info('支付宝SDK初始化成功');
    } catch (error) {
      logger.error('支付宝SDK初始化失败:', error);
      this.alipaySdk = null;
    }
  }

  /**
   * 创建微信Native支付订单
   * @param {string} userId - 用户ID
   * @param {number} amount - 金额(元)
   * @param {string} description - 商品描述
   * @returns {Promise<{orderId: string, qrCodeUrl: string}>}
   */
  async createWechatOrder(userId, amount, description) {
    try {
      // 1. 生成订单ID
      const orderId = generateId();
      const amountInCents = Math.round(amount * 100); // 转换为分

      // 2. 创建数据库订单记录
      await db('orders').insert({
        id: orderId,
        userId,
        status: 'pending',
        amount: amountInCents,
        channel: 'wechat',
        transactionId: null,
        createdAt: new Date(),
        paidAt: null
      });

      // 3. 调用微信支付API
      if (!this.wechatPay) {
        // Mock模式：开发环境返回假的二维码URL
        logger.warn(`[Mock] 微信支付订单创建: orderId=${orderId}, amount=${amount}`);
        return {
          orderId,
          qrCodeUrl: `https://mock-qrcode.example.com/${orderId}`
        };
      }

      const result = await this.wechatPay.transactions_native({
        description,
        out_trade_no: orderId,
        amount: {
          total: amountInCents
        },
        notify_url: `${process.env.API_BASE_URL}/api/payment/wechat/notify`
      });

      logger.info(`微信支付订单创建成功: orderId=${orderId}, qrCodeUrl=${result.code_url}`);

      return {
        orderId,
        qrCodeUrl: result.code_url
      };
    } catch (error) {
      logger.error('创建微信支付订单失败:', error);
      throw {
        statusCode: 500,
        errorCode: 3000,
        message: '创建支付订单失败'
      };
    }
  }

  /**
   * 创建支付宝预创建订单
   * @param {string} userId - 用户ID
   * @param {number} amount - 金额(元)
   * @param {string} subject - 商品标题
   * @returns {Promise<{orderId: string, qrCodeUrl: string}>}
   */
  async createAlipayOrder(userId, amount, subject) {
    try {
      // 1. 生成订单ID
      const orderId = generateId();
      const amountInCents = Math.round(amount * 100);

      // 2. 创建数据库订单记录
      await db('orders').insert({
        id: orderId,
        userId,
        status: 'pending',
        amount: amountInCents,
        channel: 'alipay',
        transactionId: null,
        createdAt: new Date(),
        paidAt: null
      });

      // 3. 调用支付宝API
      if (!this.alipaySdk) {
        // Mock模式
        logger.warn(`[Mock] 支付宝订单创建: orderId=${orderId}, amount=${amount}`);
        return {
          orderId,
          qrCodeUrl: `https://mock-qrcode.example.com/${orderId}`
        };
      }

      const result = await this.alipaySdk.exec(
        'alipay.trade.precreate',
        {
          notifyUrl: `${process.env.API_BASE_URL}/api/payment/alipay/notify`,
          bizContent: {
            outTradeNo: orderId,
            totalAmount: amount.toFixed(2),
            subject,
            productCode: 'FACE_TO_FACE_PAYMENT'
          }
        }
      );

      logger.info(`支付宝订单创建成功: orderId=${orderId}, qrCodeUrl=${result.qrCode}`);

      return {
        orderId,
        qrCodeUrl: result.qrCode
      };
    } catch (error) {
      logger.error('创建支付宝订单失败:', error);
      throw {
        statusCode: 500,
        errorCode: 3001,
        message: '创建支付订单失败'
      };
    }
  }

  /**
   * 处理微信支付回调
   * 艹！这个方法必须保证幂等性，否则用户充值一次配额加N次！
   * @param {object} notifyData - 微信回调数据
   * @returns {Promise<{success: boolean}>}
   */
  async handleWechatNotify(notifyData) {
    try {
      // 1. 验证签名（真实环境）
      if (this.wechatPay) {
        const isValid = await this.wechatPay.verifySignature(notifyData);
        if (!isValid) {
          logger.error('微信支付回调签名验证失败');
          throw {
            statusCode: 400,
            errorCode: 3002,
            message: '签名验证失败'
          };
        }
      }

      const { out_trade_no: orderId, transaction_id, trade_state } = notifyData;

      // 2. 查询订单
      const order = await db('orders').where('id', orderId).first();

      if (!order) {
        logger.error(`订单不存在: orderId=${orderId}`);
        throw {
          statusCode: 404,
          errorCode: 3003,
          message: '订单不存在'
        };
      }

      // 3. 幂等性检查：如果订单已支付，直接返回成功
      if (order.status === 'paid') {
        logger.warn(`订单已支付，跳过处理: orderId=${orderId}`);
        return { success: true };
      }

      // 4. 只处理支付成功的回调
      if (trade_state !== 'SUCCESS') {
        logger.warn(`订单支付未成功: orderId=${orderId}, state=${trade_state}`);
        return { success: true };
      }

      // 5. 在事务中处理支付成功逻辑
      await db.transaction(async (trx) => {
        // 5.1 更新订单状态
        await trx('orders')
          .where('id', orderId)
          .update({
            status: 'paid',
            transactionId: transaction_id,
            paidAt: new Date()
          });

        // 5.2 处理业务逻辑（开通会员、增加配额）
        await this.handlePaymentSuccess(trx, order);

        logger.info(`微信支付回调处理成功: orderId=${orderId}, transactionId=${transaction_id}`);
      });

      return { success: true };
    } catch (error) {
      logger.error('处理微信支付回调失败:', error);
      throw error;
    }
  }

  /**
   * 处理支付宝支付回调
   * 艹！同样要保证幂等性
   * @param {object} notifyData - 支付宝回调数据
   * @returns {Promise<{success: boolean}>}
   */
  async handleAlipayNotify(notifyData) {
    try {
      // 1. 验证签名（真实环境）
      if (this.alipaySdk) {
        const isValid = this.alipaySdk.checkNotifySign(notifyData);
        if (!isValid) {
          logger.error('支付宝回调签名验证失败');
          throw {
            statusCode: 400,
            errorCode: 3004,
            message: '签名验证失败'
          };
        }
      }

      const { out_trade_no: orderId, trade_no, trade_status } = notifyData;

      // 2. 查询订单
      const order = await db('orders').where('id', orderId).first();

      if (!order) {
        logger.error(`订单不存在: orderId=${orderId}`);
        throw {
          statusCode: 404,
          errorCode: 3003,
          message: '订单不存在'
        };
      }

      // 3. 幂等性检查
      if (order.status === 'paid') {
        logger.warn(`订单已支付，跳过处理: orderId=${orderId}`);
        return { success: true };
      }

      // 4. 只处理支付成功的回调
      if (trade_status !== 'TRADE_SUCCESS') {
        logger.warn(`订单支付未成功: orderId=${orderId}, status=${trade_status}`);
        return { success: true };
      }

      // 5. 在事务中处理支付成功逻辑
      await db.transaction(async (trx) => {
        // 5.1 更新订单状态
        await trx('orders')
          .where('id', orderId)
          .update({
            status: 'paid',
            transactionId: trade_no,
            paidAt: new Date()
          });

        // 5.2 处理业务逻辑
        await this.handlePaymentSuccess(trx, order);

        logger.info(`支付宝回调处理成功: orderId=${orderId}, transactionId=${trade_no}`);
      });

      return { success: true };
    } catch (error) {
      logger.error('处理支付宝回调失败:', error);
      throw error;
    }
  }

  /**
   * 处理支付成功后的业务逻辑
   * 艹！这个方法在事务中执行，必须保证原子性
   * @param {object} trx - Knex事务对象
   * @param {object} order - 订单对象
   */
  async handlePaymentSuccess(trx, order) {
    const { userId, amount } = order;

    // TODO: 根据订单金额确定会员时长和配额
    // 艹！这里的逻辑需要根据你的产品定价来定
    let memberDays = 0;
    let quotaAmount = 0;

    if (amount >= 9900) { // 99元
      memberDays = 365; // 1年会员
      quotaAmount = 100000;
    } else if (amount >= 4900) { // 49元
      memberDays = 90; // 3个月会员
      quotaAmount = 30000;
    } else if (amount >= 1900) { // 19元
      memberDays = 30; // 1个月会员
      quotaAmount = 10000;
    }

    // 1. 开通/续费会员
    if (memberDays > 0) {
      const user = await trx('users').where('id', userId).first();

      let newExpireAt;
      if (user.isMember && user.quota_expireAt && new Date(user.quota_expireAt) > new Date()) {
        // 已是会员，延长有效期
        newExpireAt = new Date(new Date(user.quota_expireAt).getTime() + memberDays * 24 * 60 * 60 * 1000);
      } else {
        // 新开通会员
        newExpireAt = new Date(Date.now() + memberDays * 24 * 60 * 60 * 1000);
      }

      await trx('users')
        .where('id', userId)
        .update({
          isMember: true,
          quota_expireAt: newExpireAt,
          updated_at: new Date()
        });

      logger.info(`会员开通成功: userId=${userId}, expireAt=${newExpireAt}`);
    }

    // 2. 增加配额
    if (quotaAmount > 0) {
      await trx('users')
        .where('id', userId)
        .increment('quota_remaining', quotaAmount);

      logger.info(`配额增加成功: userId=${userId}, amount=${quotaAmount}`);
    }
  }

  /**
   * 查询订单状态
   * @param {string} orderId - 订单ID
   * @returns {Promise<object>} 订单信息
   */
  async getOrderStatus(orderId) {
    const order = await db('orders').where('id', orderId).first();

    if (!order) {
      throw {
        statusCode: 404,
        errorCode: 3003,
        message: '订单不存在'
      };
    }

    return {
      orderId: order.id,
      status: order.status,
      amount: order.amount / 100, // 转换为元
      channel: order.channel,
      createdAt: order.createdAt,
      paidAt: order.paidAt
    };
  }
}

module.exports = new PaymentService();
