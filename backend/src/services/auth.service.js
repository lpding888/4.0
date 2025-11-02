const db = require('../config/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { generateCode, generateId } = require('../utils/generator');
const logger = require('../utils/logger');
const axios = require('axios');
const { AppError, ErrorCode } = require('../utils/errors');

/**
 * 认证服务
 */
class AuthService {
  /**
   * 计算刷新令牌过期时间
   * @returns {Date}
   */
  getRefreshTokenExpiryDate() {
    const raw =
      process.env.REFRESH_TOKEN_TTL_DAYS ||
      process.env.JWT_REFRESH_EXPIRE_DAYS ||
      process.env.JWT_REFRESH_EXPIRE ||
      '7';
    const days = Number.isNaN(parseInt(raw, 10)) ? 7 : parseInt(raw, 10);
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  /**
   * 刷新令牌哈希
   * @param {string} token
   * @returns {string}
   */
  hashRefreshToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * 统一构建用户返回数据
   * @param {object} user
   */
  buildUserResponse(user) {
    return {
      id: user.id,
      phone: user.phone,
      role: user.role || 'user',
      isMember: user.isMember,
      quota_remaining: user.quota_remaining,
      quota_expireAt: user.quota_expireAt,
      hasPassword: Boolean(user.password)
    };
  }

  /**
   * 生成访问令牌
   * @param {object} user
   * @returns {string}
   */
  generateAccessToken(user) {
    return jwt.sign(
      {
        userId: user.id,
        phone: user.phone,
        role: user.role || 'user'
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRE || '7d'
      }
    );
  }

  /**
   * 创建刷新令牌
   * @param {string} userId
   * @param {object} trx
   * @returns {Promise<{refreshToken: string}>}
   */
  async createRefreshToken(userId, trx = db) {
    const refreshToken = crypto.randomBytes(48).toString('hex');
    const hashedToken = this.hashRefreshToken(refreshToken);
    const expiresAt = this.getRefreshTokenExpiryDate();
    await trx('refresh_tokens').insert({
      user_id: userId,
      token: hashedToken,
      expires_at: expiresAt,
      created_at: new Date(),
      updated_at: new Date()
    });
    return { refreshToken, expiresAt };
  }

  /**
   * 统一签发双 token
   * @param {object} user
   * @returns {Promise<{accessToken: string, refreshToken: string}>}
   */
  async issueTokens(user, trx = db) {
    const accessToken = this.generateAccessToken(user);
    const { refreshToken } = await this.createRefreshToken(user.id, trx);
    return { accessToken, refreshToken };
  }

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
      throw new AppError(ErrorCode.CODE_TOO_FREQUENT);
    }

    // 同一IP 1小时内最多20次
    const ipCount = await db('verification_codes')
      .where('ip', ip)
      .where('created_at', '>=', oneHourAgo)
      .count('* as count')
      .first();

    if (ipCount.count >= 20) {
      throw new AppError(ErrorCode.REQUEST_TOO_FREQUENT);
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
   * @returns {Promise<{accessToken: string, refreshToken: string, user: object, needSetPassword: boolean}>}
   */
  async login(phone, code, referrerId = null) {
    // 1. 验证码校验
    await this.verifyCode(phone, code);

    // P1-017: 推荐人验证
    if (referrerId) {
      await this.validateReferrer(referrerId);
    }

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
          referrer_verified: referrerId ? true : false, // P1-017: 标记推荐人已验证
          referrer_verified_at: referrerId ? new Date() : null, // P1-017: 记录验证时间
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

    // 4. 生成访问令牌与刷新令牌
    const { accessToken, refreshToken } = await this.issueTokens(user);

    logger.info(`用户登录成功: userId=${user.id}, phone=${phone}`);

    return {
      accessToken,
      refreshToken,
      needSetPassword: !user.password,
      user: this.buildUserResponse(user)
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
      throw new AppError(ErrorCode.INVALID_CODE);
    }
  }

  /**
   * 微信登录 (P0-006)
   * @param {string} code - 微信登录code
   * @returns {Promise<{accessToken: string, refreshToken: string, user: object}>}
   */
  async wechatLogin(code) {
    try {
      // 1. 调用微信API code2Session获取openid和unionid
      const wxAppId = process.env.WECHAT_APP_ID;
      const wxAppSecret = process.env.WECHAT_APP_SECRET;

      if (!wxAppId || !wxAppSecret) {
        throw new AppError(ErrorCode.SYSTEM_ERROR, '微信配置不完整');
      }

      const wxApiUrl = `https://api.weixin.qq.com/sns/jscode2session`;
      const response = await axios.get(wxApiUrl, {
        params: {
          appid: wxAppId,
          secret: wxAppSecret,
          js_code: code,
          grant_type: 'authorization_code'
        }
      });

      if (response.data.errcode) {
        logger.error(`微信code2Session失败: ${response.data.errmsg}`);
        throw new AppError(ErrorCode.WECHAT_LOGIN_FAILED, '微信登录失败: ' + response.data.errmsg);
      }

      const { openid, unionid, session_key } = response.data;

      // 2. 查询或创建用户（通过openid）
      let user = await db('users').where('wechat_openid', openid).first();

      if (!user) {
        // 新用户，自动注册
        await db.transaction(async (trx) => {
          const userId = generateId();

          await trx('users').insert({
            id: userId,
            phone: null, // 微信登录时phone为空，后续可绑定
            wechat_openid: openid,
            wechat_unionid: unionid || null,
            isMember: false,
            quota_remaining: 0,
            quota_expireAt: null,
            created_at: new Date(),
            updated_at: new Date()
          });

          logger.info(`微信新用户注册: userId=${userId}, openid=${openid}`);
        });

        user = await db('users').where('wechat_openid', openid).first();
      }

      // 3. 生成访问令牌与刷新令牌
      const { accessToken, refreshToken } = await this.issueTokens(user);

      logger.info(`微信登录成功: userId=${user.id}, openid=${openid}`);

      return {
        accessToken,
        refreshToken,
        needSetPassword: !user.password,
        user: this.buildUserResponse(user)
      };
    } catch (error) {
      if (error.statusCode) {
        throw error;
      }
      logger.error(`微信登录异常: ${error.message}`, error);
      throw new AppError(ErrorCode.SYSTEM_ERROR, '微信登录失败');
    }
  }

  /**
   * 密码登录 (P0-007)
   * @param {string} phone - 手机号
   * @param {string} password - 密码
   * @returns {Promise<{accessToken: string, refreshToken: string, user: object, needSetPassword: boolean}>}
   */
  async passwordLogin(phone, password) {
    // 1. 查询用户
    const user = await db('users').where('phone', phone).first();

    if (!user) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS);
    }

    // 2. 验证密码
    if (!user.password) {
      throw new AppError(ErrorCode.PASSWORD_NOT_SET);
    }

    const isPasswordValid = await this.verifyPassword(password, user.password);
    if (!isPasswordValid) {
      throw new AppError(ErrorCode.INVALID_CREDENTIALS);
    }

    // 3. 生成访问令牌与刷新令牌
    const { accessToken, refreshToken } = await this.issueTokens(user);

    logger.info(`密码登录成功: userId=${user.id}, phone=${phone}`);

    return {
      accessToken,
      refreshToken,
      user: this.buildUserResponse(user)
    };
  }

  /**
   * 刷新访问令牌
   * @param {string} refreshTokenValue
   * @returns {Promise<{accessToken: string, refreshToken: string, user: object}>}
   */
  async refreshToken(refreshTokenValue) {
    if (!refreshTokenValue) {
      throw new AppError(ErrorCode.REFRESH_TOKEN_REQUIRED);
    }

    const hashedToken = this.hashRefreshToken(refreshTokenValue);
    const record = await db('refresh_tokens')
      .where({ token: hashedToken })
      .first();

    if (!record || record.revoked_at) {
      throw new AppError(ErrorCode.REFRESH_TOKEN_INVALID);
    }

    if (new Date(record.expires_at) <= new Date()) {
      await db('refresh_tokens')
        .where({ id: record.id })
        .update({ revoked_at: new Date(), updated_at: new Date() });
      throw new AppError(ErrorCode.REFRESH_TOKEN_EXPIRED);
    }

    const user = await db('users').where('id', record.user_id).first();

    if (!user) {
      await db('refresh_tokens')
        .where({ id: record.id })
        .update({ revoked_at: new Date(), updated_at: new Date() });
      throw new AppError(ErrorCode.USER_NOT_FOUND);
    }

    return db.transaction(async (trx) => {
      const updateCount = await trx('refresh_tokens')
        .where({ id: record.id, revoked_at: null })
        .update({ revoked_at: new Date(), updated_at: new Date() });

      if (!updateCount) {
        throw new AppError(ErrorCode.REFRESH_TOKEN_INVALID);
      }

      const { accessToken, refreshToken } = await this.issueTokens(user, trx);

      return {
        accessToken,
        refreshToken,
        user: this.buildUserResponse(user)
      };
    });
  }

  /**
   * 注销登录 / 吊销刷新令牌
   * @param {string} userId
   * @param {string|null} refreshTokenValue
   */
  async logout(userId, refreshTokenValue = null) {
    if (refreshTokenValue) {
      const hashedToken = this.hashRefreshToken(refreshTokenValue);
      const affectedRows = await db('refresh_tokens')
        .where({ user_id: userId, token: hashedToken, revoked_at: null })
        .update({ revoked_at: new Date(), updated_at: new Date() });

      if (!affectedRows) {
        throw new AppError(ErrorCode.REFRESH_TOKEN_INVALID);
      }

      return { success: true };
    }

    await db('refresh_tokens')
      .where({ user_id: userId, revoked_at: null })
      .update({ revoked_at: new Date(), updated_at: new Date() });

    return { success: true };
  }

  /**
   * 设置/修改密码 (P0-007)
   * @param {string} userId - 用户ID
   * @param {string} newPassword - 新密码
   * @param {string} oldPassword - 旧密码(修改密码时需要)
   * @returns {Promise<{success: boolean}>}
   */
  async setPassword(userId, newPassword, oldPassword = null) {
    // 1. 查询用户
    const user = await db('users').where('id', userId).first();

    if (!user) {
      throw new AppError(ErrorCode.USER_NOT_FOUND);
    }

    // 2. 如果用户已有密码,验证旧密码
    if (user.password && oldPassword) {
      const isOldPasswordValid = await this.verifyPassword(oldPassword, user.password);
      if (!isOldPasswordValid) {
        throw new AppError(ErrorCode.OLD_PASSWORD_INCORRECT);
      }
    } else if (user.password && !oldPassword) {
      throw new AppError(ErrorCode.OLD_PASSWORD_REQUIRED);
    }

    // 3. 密码强度校验（至少6位）
    if (newPassword.length < 6) {
      throw new AppError(ErrorCode.PASSWORD_TOO_SHORT);
    }

    // 4. 加密新密码
    const hashedPassword = await this.hashPassword(newPassword);

    // 5. 更新数据库
    await db('users')
      .where('id', userId)
      .update({
        password: hashedPassword,
        updated_at: new Date()
      });

    logger.info(`用户设置密码成功: userId=${userId}`);

    return {
      success: true
    };
  }

  /**
   * 密码加密
   * @param {string} password - 明文密码
   * @returns {Promise<string>} 加密后的密码
   */
  async hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * 密码验证
   * @param {string} password - 明文密码
   * @param {string} hashedPassword - 加密后的密码
   * @returns {Promise<boolean>} 是否匹配
   */
  async verifyPassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }

  /**
   * 获取用户信息
   * @param {string} userId - 用户ID
   * @returns {Promise<object>}
   */
  async getUser(userId) {
    const user = await db('users').where('id', userId).first();

    if (!user) {
      throw new AppError(ErrorCode.USER_NOT_FOUND);
    }

    const result = this.buildUserResponse(user);
    return {
      ...result,
      createdAt: user.created_at
    };
  }

  /**
   * 验证推荐人有效性 (P1-017)
   * 艹！防止用户填写无效的推荐人ID
   * @param {string} referrerId - 推荐人ID
   * @returns {Promise<void>}
   */
  async validateReferrer(referrerId) {
    // 1. 检查推荐人是否存在
    const referrer = await db('users').where('id', referrerId).first();

    if (!referrer) {
      throw new AppError(ErrorCode.REFERRER_NOT_FOUND);
    }

    // 2. 检查推荐人账号状态
    if (referrer.deleted_at) {
      throw new AppError(ErrorCode.REFERRER_DELETED);
    }

    // 3. 检查推荐人是否是分销员（可选）
    const distributor = await db('distributors')
      .where('user_id', referrerId)
      .where('status', 'active')
      .first();

    if (distributor) {
      logger.info(`推荐人验证通过（分销员）: referrerId=${referrerId}`);
    } else {
      logger.info(`推荐人验证通过（普通用户）: referrerId=${referrerId}`);
    }

    return true;
  }
}

module.exports = new AuthService();
