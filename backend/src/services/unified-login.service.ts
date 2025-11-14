import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import { db } from '../config/database.js';
import tokenService from './token.service.js';
import wechatLoginService from './wechat-login.service.js';
import cacheService from './cache.service.js';
import type { OAuthCallbackResult, MiniProgramLoginResult } from '../types/wechat-login.types.js';

type WechatLoginResponse = OAuthCallbackResult | MiniProgramLoginResult;

// Type definitions
interface LoginMethodConfig {
  name: string;
  enabled: boolean;
  requiresPassword?: boolean;
  requiresVerification?: boolean;
  thirdParty?: boolean;
  fields: string[];
}

interface LoginMethods {
  email: LoginMethodConfig;
  phone: LoginMethodConfig;
  wechat: LoginMethodConfig;
}

interface VerificationCacheData {
  code: string;
  timestamp: number;
  attempts: number;
}

interface LoginAttemptData {
  count: number;
  lastAttempt: number;
  lockedUntil?: number;
}

interface LoginStats {
  totalLogins: number;
  successfulLogins: number;
  failedLogins: number;
  newUsers: number;
  existingUsers: number;
  loginMethods: {
    email: number;
    phone: number;
    wechat: number;
  };
  lastReset: number;
}

interface User {
  id: string;
  email?: string;
  phone?: string;
  password?: string;
  username?: string;
  status?: string;
  created_at?: Date;
  updated_at?: Date;
  last_login_at?: Date;
  last_login_platform?: string;
  wechat_openid?: string;
  wechat_unionid?: string;
  wechat_nickname?: string;
  email_verified?: boolean;
  phone_verified?: boolean;
  auth_type?: string;
  [key: string]: unknown;
}

interface LoginResult {
  success: boolean;
  user: User;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
  loginMethod: string;
  platform?: string;
  isNewUser?: boolean;
}

interface UserLoginMethod {
  type: string;
  value: string;
  verified?: boolean;
  isPrimary?: boolean;
  nickname?: string;
  platform?: string;
}

interface BindingData {
  type: string;
  value: string;
  password?: string;
}

/**
 * 统一登录服务类
 *
 * 整合多种登录方式：
 * - 邮箱密码登录
 * - 手机号验证码登录
 * - 微信登录（公众号、小程序、开放平台）
 * - 登录方式管理和切换
 * - 统一的用户认证流程
 */
class UnifiedLoginService {
  private initialized: boolean;
  private loginMethods: LoginMethods;
  private verificationCache: Map<string, VerificationCacheData>;
  private loginAttempts: Map<string, LoginAttemptData>;
  private stats: LoginStats;

  constructor() {
    this.initialized = false;

    // 登录方式配置
    this.loginMethods = {
      email: {
        name: '邮箱登录',
        enabled: true,
        requiresPassword: true,
        fields: ['email', 'password']
      },
      phone: {
        name: '手机号登录',
        enabled: false, // 需要短信服务
        requiresVerification: true,
        fields: ['phone', 'verification_code']
      },
      wechat: {
        name: '微信登录',
        enabled: true,
        thirdParty: true,
        fields: ['code', 'platform']
      }
    };

    // 验证码缓存
    this.verificationCache = new Map<string, VerificationCacheData>();

    // 登录尝试限制
    this.loginAttempts = new Map<string, LoginAttemptData>();

    // 统计信息
    this.stats = {
      totalLogins: 0,
      successfulLogins: 0,
      failedLogins: 0,
      newUsers: 0,
      existingUsers: 0,
      loginMethods: {
        email: 0,
        phone: 0,
        wechat: 0
      },
      lastReset: Date.now()
    };
  }

  /**
   * 初始化统一登录服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('[UnifiedLogin] 统一登录服务已初始化');
      return;
    }

    try {
      // 启动清理任务
      this.startCleanupJob();

      this.initialized = true;
      logger.info('[UnifiedLogin] 统一登录服务初始化成功');
    } catch (error) {
      logger.error('[UnifiedLogin] 统一登录服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取可用的登录方式
   * @returns {Array} 登录方式列表
   */
  getAvailableLoginMethods(): Array<{
    key: string;
    name: string;
    requiresPassword?: boolean;
    requiresVerification?: boolean;
    thirdParty?: boolean;
    fields: string[];
  }> {
    return Object.entries(this.loginMethods)
      .filter(([_, config]) => config.enabled)
      .map(([key, config]) => ({
        key,
        name: config.name,
        requiresPassword: config.requiresPassword,
        requiresVerification: config.requiresVerification,
        thirdParty: config.thirdParty,
        fields: config.fields
      }));
  }

  /**
   * 邮箱密码登录
   * @param {string} email - 邮箱
   * @param {string} password - 密码
   * @returns {Promise<LoginResult>} 登录结果
   */
  async loginWithEmail(email: string, password: string): Promise<LoginResult> {
    try {
      // 检查登录限制
      await this.checkLoginAttempts(email);

      // 查找用户
      const user = await db('users').where('email', email).first();

      if (!user) {
        throw new Error('用户不存在');
      }

      // 验证密码
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        await this.recordFailedLogin(email);
        throw new Error('密码错误');
      }

      // 检查用户状态
      if (user.status !== 'active') {
        throw new Error('用户账号已被禁用');
      }

      // 生成JWT令牌
      const tokens = tokenService.generateTokenPair(user);

      // 更新登录信息
      await this.updateLoginInfo(user.id, 'email');

      // 清除登录尝试记录
      this.loginAttempts.delete(email);

      // 更新统计
      this.updateStats('email', false);

      logger.info(`[UnifiedLogin] 邮箱登录成功: email=${email}, userId=${user.id}`);

      return {
        success: true,
        user: this.sanitizeUser(user),
        tokens,
        loginMethod: 'email'
      };
    } catch (error) {
      logger.error('[UnifiedLogin] 邮箱登录失败:', error);
      this.stats.failedLogins++;
      throw error;
    }
  }

  /**
   * 手机号验证码登录
   * @param {string} phone - 手机号
   * @param {string} verificationCode - 验证码
   * @returns {Promise<LoginResult>} 登录结果
   */
  async loginWithPhone(phone: string, verificationCode: string): Promise<LoginResult> {
    try {
      // 检查登录限制
      await this.checkLoginAttempts(phone);

      // 验证验证码
      const cachedData = this.verificationCache.get(phone);
      if (!cachedData) {
        throw new Error('验证码已过期，请重新获取');
      }

      if (cachedData.code !== verificationCode) {
        await this.recordFailedLogin(phone);
        throw new Error('验证码错误');
      }

      if (Date.now() - cachedData.timestamp > 5 * 60 * 1000) {
        // 5分钟过期
        this.verificationCache.delete(phone);
        throw new Error('验证码已过期，请重新获取');
      }

      // 查找或创建用户
      let user = await db('users').where('phone', phone).first();

      if (!user) {
        user = await this.createUserWithPhone(phone);
      } else if (user.status !== 'active') {
        throw new Error('用户账号已被禁用');
      }

      // 生成JWT令牌
      const tokens = tokenService.generateTokenPair(user);

      // 更新登录信息
      await this.updateLoginInfo(user.id, 'phone');

      // 清除验证码和登录尝试记录
      this.verificationCache.delete(phone);
      this.loginAttempts.delete(phone);

      // 更新统计
      this.updateStats('phone', !user.created_at || user.created_at === user.updated_at);

      logger.info(`[UnifiedLogin] 手机号登录成功: phone=${phone}, userId=${user.id}`);

      return {
        success: true,
        user: this.sanitizeUser(user),
        tokens,
        loginMethod: 'phone'
      };
    } catch (error) {
      logger.error('[UnifiedLogin] 手机号登录失败:', error);
      this.stats.failedLogins++;
      throw error;
    }
  }

  /**
   * 微信登录（统一入口）
   * @param {string} platform - 微信平台
   * @param {Object} loginData - 登录数据
   * @returns {Promise<LoginResult>} 登录结果
   */
  async loginWithWechat(
    platform: string,
    loginData: Record<string, unknown>
  ): Promise<LoginResult> {
    try {
      let result: WechatLoginResponse;

      switch (platform) {
        case 'officialAccount':
          result = await wechatLoginService.handleOfficialOAuthCallback(
            loginData.code as string,
            loginData.state as string
          );
          break;
        case 'miniProgram':
          result = await wechatLoginService.handleMiniProgramLogin(
            loginData.code as string,
            loginData.userInfo as Record<string, unknown>
          );
          break;
        case 'openPlatform':
          result = await wechatLoginService.handleOpenPlatformCallback(
            loginData.code as string,
            loginData.state as string
          );
          break;
        default:
          throw new Error(`不支持的微信平台: ${platform}`);
      }

      // 更新统计
      const loginResult: LoginResult = {
        success: result.success,
        user: this.sanitizeUser(result.user as unknown as User),
        tokens: {
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken
        },
        loginMethod: 'wechat',
        platform: result.platform ?? (platform as string),
        isNewUser: result.isNewUser
      };

      this.updateStats('wechat', loginResult.isNewUser === true);

      logger.info(
        `[UnifiedLogin] 微信登录成功: platform=${loginResult.platform}, userId=${loginResult.user.id}`
      );

      return loginResult;
    } catch (error) {
      logger.error('[UnifiedLogin] 微信登录失败:', error);
      this.stats.failedLogins++;
      throw error;
    }
  }

  /**
   * 发送手机验证码
   * @param {string} phone - 手机号
   * @returns {Promise<Object>} 发送结果
   */
  async sendPhoneVerificationCode(
    phone: string
  ): Promise<{ success: boolean; message: string; expiresIn: number }> {
    try {
      // 验证手机号格式
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        throw new Error('手机号格式不正确');
      }

      // 检查发送频率限制
      const cachedData = this.verificationCache.get(phone);
      if (cachedData && Date.now() - cachedData.timestamp < 60 * 1000) {
        // 1分钟内不能重复发送
        throw new Error('验证码发送过于频繁，请稍后再试');
      }

      // 生成6位验证码
      const verificationCode = Math.random().toString().substr(2, 6);

      // 缓存验证码
      this.verificationCache.set(phone, {
        code: verificationCode,
        timestamp: Date.now(),
        attempts: 0
      });

      // TODO: 集成短信服务发送验证码
      // await smsService.sendVerificationCode(phone, verificationCode);
      logger.info(`[UnifiedLogin] 模拟发送验证码: phone=${phone}, code=${verificationCode}`);

      logger.info(`[UnifiedLogin] 验证码发送成功: phone=${phone}`);

      return {
        success: true,
        message: '验证码已发送',
        expiresIn: 300 // 5分钟
      };
    } catch (error) {
      logger.error('[UnifiedLogin] 发送验证码失败:', error);
      throw error;
    }
  }

  /**
   * 用户注册
   * @param {Object} userData - 用户数据
   * @param {string} loginMethod - 登录方式
   * @returns {Promise<LoginResult>} 注册结果
   */
  async registerUser(userData: Record<string, unknown>, loginMethod: string): Promise<LoginResult> {
    try {
      const { email, phone, password, username } = userData;
      const emailValue = typeof email === 'string' ? email : undefined;
      const phoneValue = typeof phone === 'string' ? phone : undefined;
      const usernameValue = typeof username === 'string' ? username : undefined;
      const passwordValue = typeof password === 'string' ? password : undefined;

      // 检查用户是否已存在
      let existingUser = null;
      if (emailValue) {
        existingUser = await db('users').where('email', emailValue).first();
      }
      if (phoneValue && !existingUser) {
        existingUser = await db('users').where('phone', phoneValue).first();
      }

      if (existingUser) {
        throw new Error('用户已存在，请直接登录');
      }

      // 生成用户ID
      const userId = uuidv4().replace(/-/g, '');
      const now = new Date();

      // 加密密码
      let hashedPassword = null;
      if (passwordValue) {
        hashedPassword = await bcrypt.hash(passwordValue, 10);
      }

      // 构建用户数据
      const newUserData = {
        id: userId,
        email: emailValue || `user_${userId}@placeholder.com`,
        username: usernameValue || `user_${userId.substr(0, 8)}`,
        phone: phoneValue || null,
        password: hashedPassword,
        auth_type: loginMethod,
        status: 'active',
        is_verified: loginMethod === 'phone' ? true : false,
        isMember: false,
        quota_remaining: 5, // 新用户默认配额
        role: 'user',
        created_at: now,
        updated_at: now,
        last_login_at: now,
        last_login_platform: loginMethod
      };

      await db('users').insert(newUserData);

      // 创建用户配置记录
      await db('user_configs').insert({
        user_id: userId,
        auto_renew: false,
        quality_threshold: 0.8,
        max_daily_tasks: 10,
        created_at: now,
        updated_at: now
      });

      // 生成JWT令牌
      const user = await db('users').where('id', userId).first();
      const tokens = tokenService.generateTokenPair(user);

      // 更新统计
      this.updateStats(loginMethod, true);

      logger.info(`[UnifiedLogin] 用户注册成功: loginMethod=${loginMethod}, userId=${userId}`);

      return {
        success: true,
        user: this.sanitizeUser(user),
        tokens,
        loginMethod,
        isNewUser: true
      };
    } catch (error) {
      logger.error('[UnifiedLogin] 用户注册失败:', error);
      throw error;
    }
  }

  /**
   * 绑定登录方式到现有用户
   * @param {string} userId - 用户ID
   * @param {Object} bindingData - 绑定数据
   * @returns {Promise<Object>} 绑定结果
   */
  async bindLoginMethod(
    userId: string,
    bindingData: BindingData
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { type, value, password } = bindingData;

      // 验证用户是否存在
      const user = await db('users').where('id', userId).first();
      if (!user) {
        throw new Error('用户不存在');
      }

      // 检查绑定项是否已被其他用户使用
      let conflictUser = null;
      if (type === 'email') {
        conflictUser = await db('users').where('email', value).whereNot('id', userId).first();
      } else if (type === 'phone') {
        conflictUser = await db('users').where('phone', value).whereNot('id', userId).first();
      }

      if (conflictUser) {
        throw new Error(`${type === 'email' ? '邮箱' : '手机号'}已被其他用户使用`);
      }

      // 验证密码（如果是绑定邮箱）
      if (type === 'email' && password) {
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          throw new Error('密码验证失败');
        }
      }

      // 更新用户信息
      const updateData: Record<string, unknown> = { updated_at: new Date() };
      if (type === 'email') {
        updateData.email = value;
        updateData.email_verified = true;
      } else if (type === 'phone') {
        updateData.phone = value;
        updateData.phone_verified = true;
      }

      await db('users').where('id', userId).update(updateData);

      logger.info(
        `[UnifiedLogin] 绑定登录方式成功: userId=${userId}, type=${type}, value=${value}`
      );

      return {
        success: true,
        message: `${type === 'email' ? '邮箱' : '手机号'}绑定成功`
      };
    } catch (error) {
      logger.error('[UnifiedLogin] 绑定登录方式失败:', error);
      throw error;
    }
  }

  /**
   * 解除登录方式绑定
   * @param {string} userId - 用户ID
   * @param {string} type - 绑定类型
   * @returns {Promise<Object>} 解除结果
   */
  async unbindLoginMethod(
    userId: string,
    type: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // 验证用户是否存在
      const user = await db('users').where('id', userId).first();
      if (!user) {
        throw new Error('用户不存在');
      }

      // 检查是否为主要登录方式
      if (type === 'email' && !user.phone && !user.wechat_openid) {
        throw new Error('无法解除主要登录方式，请先绑定其他登录方式');
      }

      // 更新用户信息
      const updateData: Record<string, unknown> = { updated_at: new Date() };
      if (type === 'email') {
        updateData.email = `user_${userId}@placeholder.com`;
        updateData.email_verified = false;
      } else if (type === 'phone') {
        updateData.phone = null;
        updateData.phone_verified = false;
      }

      await db('users').where('id', userId).update(updateData);

      logger.info(`[UnifiedLogin] 解除登录方式绑定成功: userId=${userId}, type=${type}`);

      return {
        success: true,
        message: `${type === 'email' ? '邮箱' : '手机号'}解除绑定成功`
      };
    } catch (error) {
      logger.error('[UnifiedLogin] 解除登录方式绑定失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户登录方式信息
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 登录方式信息
   */
  async getUserLoginMethods(userId: string): Promise<{
    userId: string;
    methods: UserLoginMethod[];
    primaryMethod: string | undefined;
    lastLoginPlatform: string | undefined;
  }> {
    try {
      const user = await db('users')
        .where('id', userId)
        .first([
          'email',
          'phone',
          'wechat_openid',
          'wechat_unionid',
          'wechat_nickname',
          'email_verified',
          'phone_verified',
          'auth_type',
          'last_login_platform'
        ]);

      if (!user) {
        throw new Error('用户不存在');
      }

      const methods = [];

      // 邮箱登录方式
      if (user.email && !user.email.includes('@placeholder.com')) {
        methods.push({
          type: 'email',
          value: this.maskEmail(user.email),
          verified: user.email_verified,
          isPrimary: user.auth_type === 'email'
        });
      }

      // 手机号登录方式
      if (user.phone) {
        methods.push({
          type: 'phone',
          value: this.maskPhone(user.phone),
          verified: user.phone_verified,
          isPrimary: user.auth_type === 'phone'
        });
      }

      // 微信登录方式
      if (user.wechat_openid || user.wechat_unionid) {
        methods.push({
          type: 'wechat',
          value: user.wechat_unionid || user.wechat_openid,
          nickname: user.wechat_nickname,
          verified: true,
          isPrimary: user.auth_type === 'wechat',
          platform: user.last_login_platform
        });
      }

      return {
        userId,
        methods,
        primaryMethod: user.auth_type,
        lastLoginPlatform: user.last_login_platform
      };
    } catch (error) {
      logger.error('[UnifiedLogin] 获取用户登录方式信息失败:', error);
      throw error;
    }
  }

  // 私有方法

  /**
   * 检查登录尝试限制
   * @param {string} identifier - 登录标识
   * @private
   */
  private async checkLoginAttempts(identifier: string): Promise<void> {
    const attempts = this.loginAttempts.get(identifier);

    if (attempts && attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
      const remainingTime = Math.ceil((attempts.lockedUntil - Date.now()) / 1000 / 60);
      throw new Error(`登录尝试过于频繁，请${remainingTime}分钟后再试`);
    }

    if (attempts && attempts.count >= 5) {
      // 锁定30分钟
      const lockedUntil = Date.now() + 30 * 60 * 1000;
      this.loginAttempts.set(identifier, {
        count: attempts.count,
        lastAttempt: attempts.lastAttempt,
        lockedUntil
      });

      throw new Error('登录尝试过于频繁，账号已被锁定30分钟');
    }
  }

  /**
   * 记录失败登录
   * @param {string} identifier - 登录标识
   * @private
   */
  private async recordFailedLogin(identifier: string): Promise<void> {
    const attempts = this.loginAttempts.get(identifier) || { count: 0, lastAttempt: Date.now() };

    this.loginAttempts.set(identifier, {
      count: attempts.count + 1,
      lastAttempt: Date.now(),
      lockedUntil: attempts.lockedUntil
    });
  }

  /**
   * 创建手机号用户
   * @param {string} phone - 手机号
   * @returns {Promise<User>} 用户信息
   * @private
   */
  private async createUserWithPhone(phone: string): Promise<User> {
    const userId = uuidv4().replace(/-/g, '');
    const now = new Date();

    const userData = {
      id: userId,
      email: `user_${userId}@placeholder.com`,
      username: `user_${phone.substr(-4)}`,
      phone: phone,
      auth_type: 'phone',
      status: 'active',
      is_verified: true,
      isMember: false,
      quota_remaining: 5,
      role: 'user',
      created_at: now,
      updated_at: now,
      last_login_at: now,
      last_login_platform: 'phone'
    };

    await db('users').insert(userData);

    // 创建用户配置记录
    await db('user_configs').insert({
      user_id: userId,
      auto_renew: false,
      quality_threshold: 0.8,
      max_daily_tasks: 10,
      created_at: now,
      updated_at: now
    });

    return await db('users').where('id', userId).first();
  }

  /**
   * 更新登录信息
   * @param {string} userId - 用户ID
   * @param {string} loginMethod - 登录方式
   * @private
   */
  private async updateLoginInfo(userId: string, loginMethod: string): Promise<void> {
    await db('users').where('id', userId).update({
      last_login_at: new Date(),
      last_login_platform: loginMethod,
      updated_at: new Date()
    });

    // 缓存用户会话
    const sessionKey = `user_session:${userId}`;
    await cacheService.set(
      sessionKey,
      {
        loginMethod,
        loginAt: Date.now()
      },
      3600
    ); // 1小时缓存
  }

  /**
   * 更新统计信息
   * @param {string} loginMethod - 登录方式
   * @param {boolean} isNewUser - 是否新用户
   * @private
   */
  private updateStats(loginMethod: string, isNewUser: boolean): void {
    this.stats.totalLogins++;
    this.stats.successfulLogins++;
    this.stats.loginMethods[loginMethod as keyof LoginStats['loginMethods']] =
      (this.stats.loginMethods[loginMethod as keyof LoginStats['loginMethods']] || 0) + 1;

    if (isNewUser) {
      this.stats.newUsers++;
    } else {
      this.stats.existingUsers++;
    }
  }

  /**
   * 清理用户敏感信息
   * @param {Object} user - 用户对象
   * @returns {Object} 清理后的用户对象
   * @private
   */
  private sanitizeUser(user: User): User {
    const { password, ...sanitizedUser } = user;
    return sanitizedUser as User;
  }

  /**
   * 邮箱脱敏
   * @param {string} email - 邮箱
   * @returns {string} 脱敏后的邮箱
   * @private
   */
  private maskEmail(email: string): string {
    const [username, domain] = email.split('@');
    if (!username || !domain) {
      return email;
    }
    if (username.length <= 3) {
      return `${username[0]}***@${domain}`;
    }
    return `${username.substring(0, 3)}***@${domain}`;
  }

  /**
   * 手机号脱敏
   * @param {string} phone - 手机号
   * @returns {string} 脱敏后的手机号
   * @private
   */
  private maskPhone(phone: string): string {
    return `${phone.substring(0, 3)}****${phone.substring(7)}`;
  }

  /**
   * 启动清理任务
   * @private
   */
  private startCleanupJob(): void {
    // 每10分钟清理一次过期数据
    setInterval(
      () => {
        this.cleanupExpiredData();
      },
      10 * 60 * 1000
    );

    logger.info('[UnifiedLogin] 清理任务已启动');
  }

  /**
   * 清理过期数据
   * @private
   */
  private cleanupExpiredData(): void {
    try {
      const now = Date.now();
      let cleanedCount = 0;

      // 清理过期的验证码
      for (const [phone, data] of this.verificationCache) {
        if (now - data.timestamp > 5 * 60 * 1000) {
          // 5分钟过期
          this.verificationCache.delete(phone);
          cleanedCount++;
        }
      }

      // 清理过期的登录尝试记录
      for (const [identifier, data] of this.loginAttempts) {
        if (data.lockedUntil && now > data.lockedUntil && now - data.lastAttempt > 60 * 60 * 1000) {
          // 1小时后清理
          this.loginAttempts.delete(identifier);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.debug(`[UnifiedLogin] 清理过期数据完成: ${cleanedCount}条`);
      }
    } catch (error) {
      logger.error('[UnifiedLogin] 清理过期数据失败:', error);
    }
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计数据
   */
  getStats(): LoginStats & {
    uptime: number;
    activeVerifications: number;
    activeLoginAttempts: number;
    availableMethods: Array<{
      key: string;
      name: string;
      requiresPassword?: boolean;
      requiresVerification?: boolean;
      thirdParty?: boolean;
      fields: string[];
    }>;
    timestamp: string;
  } {
    const now = Date.now();
    const uptime = now - this.stats.lastReset;

    return {
      ...this.stats,
      uptime,
      activeVerifications: this.verificationCache.size,
      activeLoginAttempts: this.loginAttempts.size,
      availableMethods: this.getAvailableLoginMethods(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 关闭统一登录服务
   */
  async close(): Promise<void> {
    try {
      this.verificationCache.clear();
      this.loginAttempts.clear();
      this.initialized = false;
      logger.info('[UnifiedLogin] 统一登录服务已关闭');
    } catch (error) {
      logger.error('[UnifiedLogin] 关闭统一登录服务失败:', error);
    }
  }
}

const unifiedLoginService = new UnifiedLoginService();

export default unifiedLoginService;
