/**
 * 认证服务 - TS ESM版本
 * 艹，这个tm管理所有登录认证逻辑！
 * 支持三种登录方式：
 * 1. 验证码登录（主要方式）
 * 2. 密码登录（备用方式）
 * 3. 微信登录（P1核心功能）
 */

import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import axios from 'axios';
import crypto from 'crypto';
import db from '../db/index.js';
import tokenService, { TokenPair, UserForToken } from './token.service.js';
import logger from '../utils/logger.js';
import * as userRepo from '../repositories/users.repo.js';
import AppError from '../utils/AppError.js';
import { ERROR_CODES } from '../config/error-codes.js';
import cacheService from './cache.service.js';
import { sendVerificationEmail } from './email.service.js';

export interface TokenSigner {
  generateTokenPair(user: UserForToken): TokenPair;
  refreshTokens(refreshToken: string): Promise<TokenPair | null>;
  revokeUserTokens(userId: string): Promise<boolean>;
  isUserRevoked(userId: string): Promise<boolean>;
  isTokenBlacklisted(jti: string): Promise<boolean>;
}

export interface AuthResult extends TokenPair {
  user: userRepo.SafeUser;
}

export interface AuthProvider {
  sendCode(phone: string, ip: string): Promise<{ expireIn: number }>;
  sendEmailCode(email: string, ip: string): Promise<{ expireIn: number }>;
  loginWithCode(phone: string, code: string, referrerId?: string | null): Promise<AuthResult>;
  loginWithEmailCode(email: string, code: string, referrerId?: string | null): Promise<AuthResult>;
  loginWithPassword(phone: string, password: string): Promise<AuthResult>;
  registerWithPassword(
    phone: string,
    password: string,
    referrerId?: string | null
  ): Promise<AuthResult>;
  registerWithEmail(
    email: string,
    code: string,
    password: string,
    referrerId?: string | null
  ): Promise<AuthResult>;
  getUser(userId: string): Promise<userRepo.SafeUser>;
  refreshToken(refreshToken: string): Promise<TokenPair | null>;
  logout(userId: string): Promise<boolean>;
  verifyTokenStatus(userId: string, jti?: string): Promise<boolean>;
  resetPasswordWithEmail(email: string, code: string, newPassword: string): Promise<boolean>;
}

/**
 * 生成6位数字验证码
 * 艹，简单有效！
 */
function generateCode(length: number = 6): string {
  return Math.floor(Math.random() * Math.pow(10, length))
    .toString()
    .padStart(length, '0');
}

/**
 * 生成ID
 */
function generateId(length: number = 16): string {
  return nanoid(length * 2);
}

interface VerificationCodeRecord {
  id: number;
  phone: string | null;
  email: string | null;
  code: string;
  channel: 'sms' | 'email';
  expireAt: Date;
  used: boolean;
}

/**
 * 认证服务类
 */
class AuthService implements AuthProvider {
  constructor(private readonly tokenSigner: TokenSigner = tokenService) {}
  /**
   * 发送验证码
   * 艹，防刷限制一定要做！
   */
  async sendCode(phone: string, ip: string): Promise<{ expireIn: number }> {
    // 1. 防刷限制检查
    await this.checkSmsRateLimit(phone, ip);

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

    // 5. 写入缓存用于后续校验
    await cacheService.set(`sms:${phone}`, code, { ttl: 5 * 60, skipMemoryCache: true });

    logger.info(`[AuthService] 验证码已发送: phone=${phone}, ip=${ip}`);

    return {
      expireIn: 300 // 5分钟
    };
  }

  /**
   * 防刷限制检查
   * 艹，不能让恶意用户刷爆短信！
   */
  private async checkSmsRateLimit(phone: string, ip: string): Promise<void> {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // 同一手机号 1分钟内最多1次
    const phoneCount = await db('verification_codes')
      .where('phone', phone)
      .where('created_at', '>=', oneMinuteAgo)
      .count('* as count')
      .first();

    const phoneCountNum = phoneCount ? Number(phoneCount.count) : 0;
    if (phoneCountNum >= 1) {
      throw new Error('验证码发送过于频繁，请1分钟后再试');
    }

    // 同一IP 1小时内最多20次
    const ipCount = await db('verification_codes')
      .where('ip', ip)
      .where('created_at', '>=', oneHourAgo)
      .count('* as count')
      .first();

    const ipCountNum = ipCount ? Number(ipCount.count) : 0;
    if (ipCountNum >= 20) {
      throw new Error('请求过于频繁，请稍后再试');
    }
  }

  private async checkEmailRateLimit(email: string, ip: string): Promise<void> {
    const normalized = this.normalizeEmail(email);
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const emailCount = await db('verification_codes')
      .where('email', normalized)
      .where('channel', 'email')
      .where('created_at', '>=', oneMinuteAgo)
      .count('* as count')
      .first();

    if ((emailCount?.count ? Number(emailCount.count) : 0) >= 1) {
      throw new Error('邮箱验证码发送过于频繁，请1分钟后再试');
    }

    const ipCount = await db('verification_codes')
      .where('ip', ip)
      .where('channel', 'email')
      .where('created_at', '>=', oneHourAgo)
      .count('* as count')
      .first();

    if ((ipCount?.count ? Number(ipCount.count) : 0) >= 50) {
      throw new Error('请求过于频繁，请稍后再试');
    }
  }

  /**
   * 邮箱防刷限制检查
   */
  /**
   * 发送短信验证码
   * 艹，生产环境要对接腾讯云短信！
   */
  private async sendSMS(phone: string, code: string): Promise<void> {
    // 开发环境直接打印
    if (process.env.NODE_ENV !== 'production') {
      logger.info(`[SMS] 发送验证码到 ${phone}: ${code}`);
      return;
    }

    // TODO: 生产环境对接腾讯云短信服务
    logger.info(`[SMS] 发送验证码到 ${phone}: ${code}`);
  }

  /**
   * 验证码登录/注册
   * 艹，验证码校验通过后，自动注册或登录！
   */
  async loginWithCode(
    phone: string,
    code: string,
    referrerId?: string | null
  ): Promise<AuthResult> {
    // 1. 验证码校验
    const record = await this.verifyCode(phone, code);

    // 2. 查询或创建用户
    let user = await db('users').where('phone', phone).first();

    if (!user) {
      // 用户不存在，创建新用户（在事务中处理）
      await db.transaction(async (trx) => {
        const userId = generateId();

        // 创建用户
        await trx('users').insert({
          id: userId,
          phone,
          referrer_id: referrerId || null,
          isMember: false,
          quota_remaining: 0,
          quota_expireAt: null,
          role: 'user',
          created_at: new Date(),
          updated_at: new Date()
        });

        // 如果有推荐人，绑定推荐关系
        if (referrerId) {
          // TODO: 调用distribution service绑定推荐关系
          logger.info(`[AuthService] 推荐关系绑定尝试: referrerId=${referrerId}, userId=${userId}`);
        }

        logger.info(
          `[AuthService] 新用户注册: userId=${userId}, phone=${phone}, referrerId=${referrerId}`
        );
      });

      user = await db('users').where('phone', phone).first();
    }

    if (!user) {
      throw new Error('用户不存在');
    }

    // 3. 标记验证码已使用
    await this.markCodeUsed(record.id);

    // 4. 生成双Token对
    const tokens = this.tokenSigner.generateTokenPair(this.buildTokenUser(user));

    logger.info(`[AuthService] 用户登录成功: userId=${user.id}, phone=${phone}`);

    return {
      ...tokens,
      user: userRepo.toSafeUser(user)
    };
  }

  /**
   * 密码登录
   * 艹，备用登录方式！
   */
  async loginWithPassword(phone: string, password: string): Promise<AuthResult> {
    // 1. 查找用户
    const user = await userRepo.findUserByPhone(phone);
    if (!user) {
      throw new Error('手机号或密码错误');
    }

    // 2. 验证密码
    if (!user.password) {
      throw new Error('该账号未设置密码，请使用验证码登录');
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      throw new Error('手机号或密码错误');
    }

    // 3. 生成Token对
    const tokens = this.tokenSigner.generateTokenPair(this.buildTokenUser(user));

    logger.info(`[AuthService] 密码登录成功: userId=${user.id}, phone=${phone}`);

    return {
      ...tokens,
      user: userRepo.toSafeUser(user)
    };
  }

  /**
   * 注册新用户（密码方式）
   * 艹，设置密码注册！
   */
  async registerWithPassword(
    phone: string,
    password: string,
    referrerId?: string | null
  ): Promise<AuthResult> {
    // 1. 检查手机号是否已存在
    const exists = await userRepo.phoneExists(phone);
    if (exists) {
      throw new Error('手机号已被注册');
    }

    // 2. 密码加密
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. 创建用户
    const user = await userRepo.createUser({
      id: nanoid(32),
      phone,
      password: hashedPassword,
      role: 'user',
      isMember: false,
      quota_remaining: 0,
      referrer_id: referrerId || null
    });

    // 4. 生成Token
    const tokens = this.tokenSigner.generateTokenPair(this.buildTokenUser(user as userRepo.User));

    logger.info(`[AuthService] 用户注册成功: userId=${user.id}, phone=${phone}`);

    return {
      ...tokens,
      user: userRepo.toSafeUser(user)
    };
  }

  /**
   * 发送邮箱验证码
   */
  async sendEmailCode(email: string, ip: string): Promise<{ expireIn: number }> {
    if (!email) {
      throw new Error('邮箱不能为空');
    }
    if (!this.isValidEmail(email)) {
      throw new Error('邮箱格式不正确');
    }

    const normalized = this.normalizeEmail(email);
    await this.checkEmailRateLimit(normalized, ip);

    const code = generateCode(6);
    const expireAt = new Date(Date.now() + 5 * 60 * 1000);

    await db('verification_codes').insert({
      phone: null,
      email: normalized,
      code,
      ip,
      channel: 'email',
      expireAt,
      used: false,
      created_at: new Date(),
      updated_at: new Date()
    });

    await sendVerificationEmail(normalized, code);
    await cacheService.set(`email:${normalized}`, code, { ttl: 5 * 60, skipMemoryCache: true });

    logger.info(`[AuthService] 邮箱验证码已发送: email=${normalized}, ip=${ip}`);

    return { expireIn: 300 };
  }

  /**
   * 邮箱验证码登录（不存在则自动注册）
   */
  async loginWithEmailCode(
    email: string,
    code: string,
    referrerId?: string | null
  ): Promise<AuthResult> {
    if (!email || !code) {
      throw new Error('邮箱和验证码不能为空');
    }
    if (!this.isValidEmail(email)) {
      throw new Error('邮箱格式不正确');
    }

    const normalized = this.normalizeEmail(email);
    const record = await this.verifyEmailCode(normalized, code);

    let user = await userRepo.findUserByEmail(normalized);

    if (!user) {
      const userId = generateId();
      await db('users').insert({
        id: userId,
        email: normalized,
        email_verified: true,
        email_verified_at: new Date(),
        referrer_id: referrerId || null,
        isMember: false,
        quota_remaining: 0,
        quota_expireAt: null,
        role: 'user',
        created_at: new Date(),
        updated_at: new Date()
      });
      user = await userRepo.findUserById(userId);
    } else if (!user.email_verified) {
      await userRepo.updateUser(user.id, {
        email_verified: true,
        email_verified_at: new Date()
      });
      user = await userRepo.findUserById(user.id);
    }

    if (!user) {
      throw new Error('邮箱用户创建失败');
    }

    await this.markCodeUsed(record.id);
    await cacheService.delete(`email:${normalized}`);

    const tokens = this.tokenSigner.generateTokenPair(this.buildTokenUser(user));
    logger.info(`[AuthService] 邮箱验证码登录成功: email=${normalized}, userId=${user?.id}`);

    return {
      ...tokens,
      user: userRepo.toSafeUser(user)
    };
  }

  /**
   * 邮箱注册（验证码 + 密码）
   */
  async registerWithEmail(
    email: string,
    code: string,
    password: string,
    referrerId?: string | null
  ): Promise<AuthResult> {
    if (!email || !code || !password) {
      throw new Error('邮箱、验证码和密码不能为空');
    }
    if (!this.isValidEmail(email)) {
      throw new Error('邮箱格式不正确');
    }

    const normalized = this.normalizeEmail(email);
    const exists = await userRepo.emailExists(normalized);
    if (exists) {
      throw new Error('邮箱已被注册');
    }

    if (password.length < 6) {
      throw new Error('密码长度不能少于6位');
    }

    const record = await this.verifyEmailCode(normalized, code);
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await userRepo.createUser({
      id: nanoid(32),
      email: normalized,
      password: hashedPassword,
      role: 'user',
      isMember: false,
      quota_remaining: 0,
      referrer_id: referrerId || null,
      email_verified: true,
      email_verified_at: new Date()
    });

    await this.markCodeUsed(record.id);
    await cacheService.delete(`email:${normalized}`);

    const tokens = this.tokenSigner.generateTokenPair(this.buildTokenUser(user));
    logger.info(`[AuthService] 邮箱注册成功: email=${normalized}, userId=${user.id}`);

    return {
      ...tokens,
      user: userRepo.toSafeUser(user)
    };
  }

  /**
   * 验证验证码
   * 艹，检查验证码是否有效！
   */
  private async verifyCode(phone: string, code: string): Promise<VerificationCodeRecord> {
    const record = (await db('verification_codes')
      .where('phone', phone)
      .where('code', code)
      .where('channel', 'sms')
      .where('used', false)
      .where('expireAt', '>=', new Date())
      .orderBy('created_at', 'desc')
      .first()) as VerificationCodeRecord | undefined;

    if (!record) {
      throw new Error('验证码错误或已过期');
    }

    return record;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private buildTokenUser(user: userRepo.User): UserForToken {
    return {
      id: user.id,
      role: user.role,
      phone: user.phone ?? undefined
    };
  }

  private async verifyEmailCode(email: string, code: string): Promise<VerificationCodeRecord> {
    const normalized = this.normalizeEmail(email);
    const record = (await db('verification_codes')
      .where('email', normalized)
      .where('code', code)
      .where('channel', 'email')
      .where('used', false)
      .where('expireAt', '>=', new Date())
      .orderBy('created_at', 'desc')
      .first()) as VerificationCodeRecord | undefined;

    if (!record) {
      throw new Error('验证码错误或已过期');
    }

    return record;
  }

  private async markCodeUsed(recordId: number): Promise<void> {
    await db('verification_codes')
      .where({ id: recordId })
      .update({ used: true, updated_at: new Date() });
  }

  /**
   * 获取用户信息
   * 艹，通过ID获取用户详情！
   */
  async getUser(userId: string): Promise<userRepo.SafeUser> {
    const user = await userRepo.findUserById(userId);

    if (!user) {
      throw new Error('用户不存在');
    }

    return userRepo.toSafeUser(user);
  }

  /**
   * 邮箱验证码重置密码
   */
  async resetPasswordWithEmail(email: string, code: string, newPassword: string): Promise<boolean> {
    if (!email || !code || !newPassword) {
      throw new Error('邮箱、验证码和新密码不能为空');
    }
    if (!this.isValidEmail(email)) {
      throw new Error('邮箱格式不正确');
    }
    if (newPassword.length < 6) {
      throw new Error('密码至少6位');
    }

    const normalized = this.normalizeEmail(email);
    const record = await this.verifyEmailCode(normalized, code);
    const user = await userRepo.findUserByEmail(normalized);

    if (!user) {
      throw new Error('用户不存在');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await userRepo.updateUser(user.id, { password: hashedPassword });
    await this.markCodeUsed(record.id);
    await cacheService.delete(`email:${normalized}`);

    logger.info(`[AuthService] 邮箱密码重置成功: email=${normalized}, userId=${user.id}`);
    return true;
  }

  /**
   * 刷新Token
   * 艹，用Refresh Token换新的Access Token！
   */
  async refreshToken(refreshToken: string): Promise<TokenPair | null> {
    return this.tokenSigner.refreshTokens(refreshToken);
  }

  /**
   * 登出
   * 艹，撤销用户的所有Token！
   */
  async logout(userId: string): Promise<boolean> {
    return this.tokenSigner.revokeUserTokens(userId);
  }

  /**
   * 验证Token状态
   * 艹，检查Token是否还有效！
   */
  async verifyTokenStatus(userId: string, jti?: string): Promise<boolean> {
    // 检查用户是否被撤销
    const isRevoked = await this.tokenSigner.isUserRevoked(userId);
    if (isRevoked) {
      return false;
    }

    // 检查Token是否在黑名单
    if (jti) {
      const isBlacklisted = await this.tokenSigner.isTokenBlacklisted(jti);
      if (isBlacklisted) {
        return false;
      }
    }

    return true;
  }

  /**
   * 微信登录 (P1核心功能)
   * 艹！调用微信API获取用户信息并自动注册/登录
   */
  async wechatLogin(code: string): Promise<AuthResult> {
    try {
      // 1. 调用微信API code2Session获取openid和unionid
      const wxAppId = process.env.WECHAT_APP_ID;
      const wxAppSecret = process.env.WECHAT_APP_SECRET;

      if (!wxAppId || !wxAppSecret) {
        throw new Error('微信配置不完整');
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
        throw new Error('微信登录失败: ' + response.data.errmsg);
      }

      const { openid, unionid } = response.data;

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
            role: 'user',
            created_at: new Date(),
            updated_at: new Date()
          });

          logger.info(`微信新用户注册: userId=${userId}, openid=${openid}`);
        });

        user = await db('users').where('wechat_openid', openid).first();
      }

      // 3. 生成访问令牌
      const tokens = this.tokenSigner.generateTokenPair(this.buildTokenUser(user));

      logger.info(`微信登录成功: userId=${user.id}, openid=${openid}`);

      return {
        ...tokens,
        user: userRepo.toSafeUser(user)
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        const appError = error as Error & { statusCode?: number };
        if (appError.statusCode) {
          throw error;
        }
        logger.error(`微信登录异常: ${error.message}`, error);
      } else {
        logger.error(`微信登录异常:`, error);
      }
      throw new Error('微信登录失败');
    }
  }

  /**
   * 设置/修改密码 (P1核心功能)
   * 艹！用户可以设置或修改密码
   */
  async setPassword(
    userId: string,
    newPassword: string,
    oldPassword: string | null = null
  ): Promise<{ success: boolean }> {
    // 1. 查询用户
    const user = await db('users').where('id', userId).first();

    if (!user) {
      throw new AppError(ERROR_CODES.USER_NOT_FOUND);
    }

    // 2. 如果用户已有密码,验证旧密码
    if (user.password && oldPassword) {
      const isOldPasswordValid = await this.verifyPassword(oldPassword, user.password);
      if (!isOldPasswordValid) {
        throw new Error('旧密码错误');
      }
    } else if (user.password && !oldPassword) {
      throw new Error('修改密码需要提供旧密码');
    }

    // 3. 密码强度校验（至少6位）
    if (newPassword.length < 6) {
      throw new Error('密码长度至少6位');
    }

    // 4. 加密新密码
    const hashedPassword = await this.hashPassword(newPassword);

    // 5. 更新数据库
    await db('users').where('id', userId).update({
      password: hashedPassword,
      updated_at: new Date()
    });

    logger.info(`用户设置密码成功: userId=${userId}`);

    return {
      success: true
    };
  }

  /**
   * 验证推荐人有效性 (P1-017)
   * 艹！防止用户填写无效的推荐人ID
   */
  async validateReferrer(referrerId: string): Promise<boolean> {
    // 1. 检查推荐人是否存在
    const referrer = await db('users').where('id', referrerId).first();

    if (!referrer) {
      throw new Error('推荐人不存在');
    }

    // 2. 检查推荐人账号状态
    if (referrer.deleted_at) {
      throw new Error('推荐人账号已被删除');
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

  /**
   * 密码加密 (私有方法)
   * 艹！使用bcrypt加密密码
   */
  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * 密码验证 (私有方法)
   * 艹！验证密码是否匹配
   */
  private async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }
}

// 导出单例
export const authService = new AuthService();
export default authService;
