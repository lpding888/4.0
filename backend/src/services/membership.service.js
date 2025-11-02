const db = require('../config/database');
const { generateOrderId } = require('../utils/generator');
const logger = require('../utils/logger');

/**
 * 会员服务
 */
class MembershipService {
  /**
   * 购买会员
   * @param {string} userId - 用户ID
   * @param {string} channel - 支付渠道(wx/alipay)
   * @returns {Promise<{orderId: string, payParams: object}>}
   */
  async purchase(userId, channel) {
    // 1. 获取会员价格和配额配置
    const price = parseInt(process.env.MEMBERSHIP_PRICE) || 9900; // 99元(分)
    const quota = parseInt(process.env.PLAN_MONTHLY_QUOTA) || 100;

    // 2. 创建订单
    const orderId = generateOrderId();
    await db('orders').insert({
      id: orderId,
      userId,
      status: 'pending',
      amount: price, // 原价(分)
      final_amount: price, // 实付金额(分) - 暂时等于原价,支持优惠券后会不同
      channel,
      transactionId: null,
      createdAt: new Date(),
      paidAt: null
    });

    logger.info(`订单创建: orderId=${orderId}, userId=${userId}, channel=${channel}`);

    // 3. 调用支付渠道
    const payParams = await this.getPaymentParams(orderId, price, channel);

    return {
      orderId,
      payParams
    };
  }

  /**
   * 获取支付参数
   * @param {string} orderId - 订单ID
   * @param {number} amount - 金额(分)
   * @param {string} channel - 支付渠道
   * @returns {Promise<object>}
   */
  async getPaymentParams(orderId, amount, channel) {
    // TODO: 集成真实支付SDK
    // 这里返回模拟数据
    
    if (channel === 'wx') {
      // 微信支付参数(示例)
      return {
        appId: process.env.WECHAT_APPID,
        timeStamp: Math.floor(Date.now() / 1000).toString(),
        nonceStr: Math.random().toString(36).substring(2, 15),
        package: `prepay_id=mock_${orderId}`,
        signType: 'RSA',
        paySign: 'MOCK_SIGN_' + orderId
      };
    } else if (channel === 'alipay') {
      // 支付宝参数(示例)
      return {
        orderString: `app_id=mock&method=alipay.trade.app.pay&out_trade_no=${orderId}`
      };
    }

    throw {
      statusCode: 400,
      errorCode: 5003,
      message: '不支持的支付渠道'
    };
  }

  /**
   * 处理支付回调
   * @param {object} callbackData - 支付回调数据
   * @returns {Promise<void>}
   */
  async handlePaymentCallback(callbackData) {
    const { orderId, transactionId, channel } = callbackData;

    // 1. 验证签名(防篡改)
    // TODO: 根据不同渠道验证签名
    // await this.verifySignature(callbackData, channel);

    // 2. 查询订单
    const order = await db('orders').where('id', orderId).first();

    if (!order) {
      throw {
        statusCode: 404,
        errorCode: 5002,
        message: '订单不存在'
      };
    }

    // 3. 幂等性检查
    if (order.status === 'paid') {
      logger.info(`订单已处理,跳过: orderId=${orderId}`);
      return { success: true, message: '订单已处理' };
    }

    // 4. 使用事务开通会员
    await db.transaction(async (trx) => {
      // 更新订单状态
      await trx('orders').where('id', orderId).update({
        status: 'paid',
        transactionId,
        paidAt: new Date()
      });

      // 获取配额配置
      const quota = parseInt(process.env.PLAN_MONTHLY_QUOTA) || 100;
      const durationDays = parseInt(process.env.MEMBERSHIP_DURATION_DAYS) || 30;
      const expireAt = new Date(Date.now() + durationDays * 24 * 3600 * 1000);

      // 开通会员
      await trx('users').where('id', order.userId).update({
        isMember: true,
        quota_remaining: quota,
        quota_expireAt: expireAt,
        updated_at: new Date()
      });

      logger.info(`会员开通成功: userId=${order.userId}, quota=${quota}, expireAt=${expireAt}`);

      // 🔥 新增：触发佣金计算（首单计佣）
      try {
        const commissionService = require('./commission.service');
        await commissionService.calculateAndCreateCommission(
          trx,
          order.userId,
          order.id,
          order.final_amount / 100 // 🔥 使用实付金额,而非原价
        );
      } catch (error) {
        // 佣金计算失败不影响开通会员
        logger.error(`佣金计算失败: orderId=${orderId}, error=${error.message}`);
      }
    });

    return { success: true };
  }

  /**
   * 获取会员状态
   * @param {string} userId - 用户ID
   * @returns {Promise<object>}
   */
  async getStatus(userId) {
    const user = await db('users').where('id', userId).first();

    if (!user) {
      throw {
        statusCode: 404,
        errorCode: 1004,
        message: '用户不存在'
      };
    }

    const now = new Date();
    let isMember = user.isMember;
    let quotaRemaining = user.quota_remaining;

    // 到期检查与自动降级
    if (user.quota_expireAt && new Date(user.quota_expireAt) < now) {
      // 已到期,执行一次性降级
      if (isMember) {
        await db('users').where('id', userId).update({
          isMember: false,
          quota_remaining: 0,
          updated_at: now
        });

        isMember = false;
        quotaRemaining = 0;

        logger.info(`会员已到期,自动降级: userId=${userId}`);
      }
    }

    // 计算到期天数
    let expireDays = 0;
    if (user.quota_expireAt) {
      const expireDate = new Date(user.quota_expireAt);
      expireDays = Math.max(0, Math.ceil((expireDate - now) / (24 * 3600 * 1000)));
    }

    return {
      isMember,
      quota_remaining: quotaRemaining,
      quota_expireAt: user.quota_expireAt,
      expireDays,
      price: parseInt(process.env.MEMBERSHIP_PRICE) || 9900
    };
  }
}

module.exports = new MembershipService();
