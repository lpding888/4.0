const db = require('../config/database');
const tokenService = require('./token.service');
const { generateCode, generateId } = require('../utils/generator');
const logger = require('../utils/logger');

/**
 * 认证服务
 */
class AuthService {
  /**
   * 发送验证码
   * @param {string} phone - 手机号
   * @param {string} ip - 请求IP
   * @returns {Promise<{expireIn: number}>}
   */
  async sendCode(phone, ip) {
    // 1. 防刷限制检查
    await this.checkRateLimit(phone, ip);

    // 2. 生成验证码
    const code = generateCode(6);
    const expireAt = new Date(Date.now() + 5 * 60 * 1000); // 5分钟有效期

    // 3. 保存验证码到数据库
    await db('verification_codes').insert({
      phone,
      code,
      ip,
      expireAt,
      used: false,
      created_at: new Date(),
      updated_at: new Date()
    });

    // 4. 调用短信服务发送验证码
    await this.sendSMS(phone, code);

    logger.info(`验证码已发送: phone=${phone}, ip=${ip}`);

    return {
      expireIn: 300 // 5分钟
    };
  }

  /**
   * 防刷限制检查
   * @param {string} phone - 手机号
   * @param {string} ip - 请求IP
   */
  async checkRateLimit(phone, ip) {
    const now = new Date();
    const oneMinuteAgo = new Date(now - 60 * 1000);
    const oneHourAgo = new Date(now - 60 * 60 * 1000);

    // 同一手机号 1分钟内最多5次
    const phoneCount = await db('verification_codes')
      .where('phone', phone)
      .where('created_at', '>=', oneMinuteAgo)
      .count('* as count')
      .first();

    if (phoneCount.count >= 5) {
      throw {
        statusCode: 429,
        errorCode: 2004,
        message: '验证码发送过于频繁,请1分钟后再试'
      };
    }

    // 同一IP 1小时内最多20次
    const ipCount = await db('verification_codes')
      .where('ip', ip)
      .where('created_at', '>=', oneHourAgo)
      .count('* as count')
      .first();

    if (ipCount.count >= 20) {
      throw {
        statusCode: 429,
        errorCode: 2005,
        message: '请求过于频繁,请稍后再试'
      };
    }
  }

  /**
   * 发送短信验证码
   * @param {string} phone - 手机号
   * @param {string} code - 验证码
   */
  async sendSMS(phone, code) {
    // TODO: 集成腾讯云短信服务
    // 暂时只打印日志
    logger.info(`[SMS] 发送验证码到 ${phone}: ${code}`);
    
    // 开发环境直接返回
    if (process.env.NODE_ENV !== 'production') {
      return;
    }

    // 生产环境调用腾讯云短信API
    // const tencentcloud = require('tencentcloud-sdk-nodejs');
    // const SmsClient = tencentcloud.sms.v20210111.Client;
    // ...
  }

  /**
   * 登录/注册
   * @param {string} phone - 手机号
   * @param {string} code - 验证码
   * @param {string} referrerId - 推荐人用户ID(可选)
   * @returns {Promise<{accessToken, refreshToken, expiresIn, user: object}>}
   */
  async login(phone, code, referrerId = null) {
    // 1. 验证码校验
    await this.verifyCode(phone, code);

    // 2. 查询或创建用户
    let user = await db('users').where('phone', phone).first();

    if (!user) {
      // 用户不存在,创建新用户(在事务中处理)
      await db.transaction(async (trx) => {
        const userId = generateId();

        // 创建用户
        await trx('users').insert({
          id: userId,
          phone,
          referrer_id: referrerId || null, // 记录推荐人
          isMember: false,
          quota_remaining: 0,
          quota_expireAt: null,
          created_at: new Date(),
          updated_at: new Date()
        });

        // 如果有推荐人,绑定推荐关系
        if (referrerId) {
          const distributionService = require('./distribution.service');
          await distributionService.bindReferralRelationship(trx, referrerId, userId);
          logger.info(`推荐关系绑定尝试: referrerId=${referrerId}, userId=${userId}`);
        }

        logger.info(`新用户注册: userId=${userId}, phone=${phone}, referrerId=${referrerId}`);
      });

      user = await db('users').where('phone', phone).first();
    }

    // 3. 标记验证码已使用
    await db('verification_codes')
      .where('phone', phone)
      .where('code', code)
      .update({ used: true });

    // 4. 生成双Token对
    const tokens = tokenService.generateTokenPair(user);

    logger.info(`用户登录成功: userId=${user.id}, phone=${phone}`);

    return {
      ...tokens,
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role || 'user',
        isMember: user.isMember,
        quota_remaining: user.quota_remaining,
        quota_expireAt: user.quota_expireAt
      }
    };
  }

  /**
   * 验证验证码
   * @param {string} phone - 手机号
   * @param {string} code - 验证码
   */
  async verifyCode(phone, code) {
    const record = await db('verification_codes')
      .where('phone', phone)
      .where('code', code)
      .where('used', false)
      .where('expireAt', '>=', new Date())
      .orderBy('created_at', 'desc')
      .first();

    if (!record) {
      throw {
        statusCode: 400,
        errorCode: 2001,
        message: '验证码错误或已过期'
      };
    }
  }

  /**
   * 获取用户信息
   * @param {string} userId - 用户ID
   * @returns {Promise<object>}
   */
  async getUser(userId) {
    const user = await db('users').where('id', userId).first();

    if (!user) {
      throw {
        statusCode: 404,
        errorCode: 1004,
        message: '用户不存在'
      };
    }

    return {
      id: user.id,
      phone: user.phone,
      role: user.role || 'user', // 艹，补上role字段！
      isMember: user.isMember,
      quota_remaining: user.quota_remaining,
      quota_expireAt: user.quota_expireAt,
      createdAt: user.created_at
    };
  }
}

module.exports = new AuthService();
