import axios from 'axios';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import NodeCache from 'node-cache';
import logger from '../utils/logger.js';
import { db } from '../config/database.js';
import {
  wechatConfig,
  getWechatConfig,
  getWechatApiUrl,
  generateWechatState,
  verifyWechatState,
  validateWechatConfig
} from '../config/wechat.config.js';
import cacheService from './cache.service.js';
import tokenService from './token.service.js';
import type {
  WechatLoginPlatform,
  WechatUserInfo,
  OAuthCallbackResult,
  TokenData,
  UserLoginData,
  MiniProgramLoginResult,
  TokenPair,
  WechatBindings,
  AuthUrlResult,
  ProcessLoginResult,
  SessionCacheData,
  LoginStats,
  StateData
} from '../types/wechat-login.types.js';

/**
 * 微信登录服务类
 *
 * 支持多种微信登录方式：
 * - 微信公众号OAuth登录
 * - 微信小程序登录
 * - 微信开放平台扫码登录
 * - 微信用户信息获取
 * - 统一用户身份绑定
 */
class WechatLoginService {
  private initialized: boolean;

  private accessTokenCache: NodeCache;

  private jsapiTicketCache: NodeCache;

  private sessionStore: NodeCache;

  private stats: LoginStats;

  constructor() {
    this.initialized = false;

    // 缓存实例
    this.accessTokenCache = new NodeCache({ stdTTL: wechatConfig.common.cache.accessTokenTTL });
    this.jsapiTicketCache = new NodeCache({ stdTTL: wechatConfig.common.cache.jsapiTicketTTL });

    // 会话存储
    this.sessionStore = new NodeCache({ stdTTL: wechatConfig.common.cache.sessionTTL });

    // 统计信息
    this.stats = {
      totalLogins: 0,
      successfulLogins: 0,
      failedLogins: 0,
      newUsers: 0,
      existingUsers: 0,
      lastReset: Date.now()
    };
  }

  /**
   * 初始化微信登录服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('[WechatLogin] 微信登录服务已初始化');
      return;
    }

    try {
      // 验证配置
      const platforms: WechatLoginPlatform[] = ['officialAccount', 'miniProgram', 'openPlatform'];
      for (const platform of platforms) {
        try {
          validateWechatConfig(platform);
          logger.info(`[WechatLogin] ${platform} 配置验证成功`);
        } catch (error: unknown) {
          const err = error as Error;
          logger.warn(`[WechatLogin] ${platform} 配置验证失败:`, err.message);
        }
      }

      // 清理过期数据
      this.startCleanupJob();

      this.initialized = true;
      logger.info('[WechatLogin] 微信登录服务初始化成功');
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('[WechatLogin] 微信登录服务初始化失败:', err);
      throw error;
    }
  }

  /**
   * 生成微信公众号OAuth授权URL
   * @param redirectUri - 回调地址
   * @param scope - 授权范围
   * @param state - 状态参数
   * @returns 授权URL
   */
  generateOfficialOAuthUrl(
    redirectUri: string,
    scope: string = 'snsapi_userinfo',
    state: string | null = null
  ): AuthUrlResult {
    try {
      const config = getWechatConfig('officialAccount');

      // 生成state参数
      const finalState = state || generateWechatState();

      // 存储state和回调地址
      const stateData: StateData = {
        redirectUri,
        platform: 'officialAccount',
        createdAt: Date.now()
      };
      this.sessionStore.set(`state:${finalState}`, stateData);

      const params: Record<string, string> = {
        appid: config.appId,
        redirect_uri: encodeURIComponent(redirectUri),
        response_type: 'code',
        scope: scope,
        state: finalState
      };

      const queryString = Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');

      const authUrl = `${config.domains.official}/connect/oauth2/authorize?${queryString}`;

      logger.info(`[WechatLogin] 生成微信公众号授权URL: ${authUrl.substring(0, 100)}...`);

      return {
        authUrl,
        state: finalState
      };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('[WechatLogin] 生成微信公众号授权URL失败:', err);
      throw error;
    }
  }

  /**
   * 处理微信公众号OAuth回调
   * @param code - 授权码
   * @param state - 状态参数
   * @returns 登录结果
   */
  async handleOfficialOAuthCallback(code: string, state: string): Promise<OAuthCallbackResult> {
    try {
      // 验证state参数
      const stateData = this.sessionStore.get(`state:${state}`) as StateData | undefined;
      if (!stateData) {
        throw new Error('无效的state参数或已过期');
      }

      if (!verifyWechatState(state)) {
        throw new Error('state参数验证失败');
      }

      // 获取access_token
      const tokenData = await this.getOfficialAccessToken(code);

      // 获取用户信息
      const userInfo = await this.getOfficialUserInfo(tokenData.access_token, tokenData.openid);

      // 处理用户登录
      const loginResult = await this.processWechatUserLogin(userInfo, 'officialAccount');

      // 清理state
      this.sessionStore.del(`state:${state}`);

      logger.info(
        `[WechatLogin] 微信公众号登录成功: openid=${userInfo.openid}, userId=${loginResult.userId}`
      );

      return {
        success: true,
        user: loginResult.user,
        tokens: loginResult.tokens,
        isNewUser: loginResult.isNewUser,
        platform: 'officialAccount'
      };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('[WechatLogin] 处理微信公众号OAuth回调失败:', err);
      this.stats.failedLogins++;
      throw error;
    }
  }

  /**
   * 微信小程序登录
   * @param code - 小程序登录凭证
   * @param userInfo - 用户信息
   * @returns 登录结果
   */
  async handleMiniProgramLogin(
    code: string,
    userInfo: Record<string, unknown> = {}
  ): Promise<MiniProgramLoginResult> {
    try {
      // 获取session_key和openid
      const sessionData = await this.getMiniProgramSession(code);

      // 构建用户数据
      const wechatUser: WechatUserInfo = {
        openid: sessionData.openid,
        unionid: sessionData.unionid,
        platform: 'miniProgram',
        ...userInfo
      };

      // 处理用户登录
      const loginResult = await this.processWechatUserLogin(wechatUser, 'miniProgram');

      logger.info(
        `[WechatLogin] 微信小程序登录成功: openid=${sessionData.openid}, userId=${loginResult.userId}`
      );

      return {
        success: true,
        user: loginResult.user,
        tokens: loginResult.tokens,
        isNewUser: loginResult.isNewUser,
        platform: 'miniProgram',
        sessionKey: sessionData.session_key || ''
      };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('[WechatLogin] 微信小程序登录失败:', err);
      this.stats.failedLogins++;
      throw error;
    }
  }

  /**
   * 微信开放平台扫码登录
   * @param redirectUri - 回调地址
   * @param state - 状态参数
   * @returns 授权URL
   */
  generateOpenPlatformOAuthUrl(redirectUri: string, state: string | null = null): AuthUrlResult {
    try {
      const config = getWechatConfig('openPlatform');

      // 生成state参数
      const finalState = state || generateWechatState();

      // 存储state和回调地址
      const stateData: StateData = {
        redirectUri,
        platform: 'openPlatform',
        createdAt: Date.now()
      };
      this.sessionStore.set(`state:${finalState}`, stateData);

      const params: Record<string, string> = {
        appid: config.appId,
        redirect_uri: encodeURIComponent(redirectUri),
        response_type: 'code',
        scope: 'snsapi_login',
        state: finalState
      };

      const queryString = Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');

      const authUrl = `${config.domains.open}/connect/qrconnect?${queryString}`;

      logger.info(`[WechatLogin] 生成微信开放平台授权URL: ${authUrl.substring(0, 100)}...`);

      return {
        authUrl,
        state: finalState
      };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('[WechatLogin] 生成微信开放平台授权URL失败:', err);
      throw error;
    }
  }

  /**
   * 处理微信开放平台扫码回调
   * @param code - 授权码
   * @param state - 状态参数
   * @returns 登录结果
   */
  async handleOpenPlatformCallback(code: string, state: string): Promise<OAuthCallbackResult> {
    try {
      // 验证state参数
      const stateData = this.sessionStore.get(`state:${state}`) as StateData | undefined;
      if (!stateData) {
        throw new Error('无效的state参数或已过期');
      }

      // 获取access_token
      const tokenData = await this.getOpenPlatformAccessToken(code);

      // 获取用户信息
      const userInfo = await this.getOpenPlatformUserInfo(tokenData.access_token, tokenData.openid);

      // 处理用户登录
      const loginResult = await this.processWechatUserLogin(userInfo, 'openPlatform');

      // 清理state
      this.sessionStore.del(`state:${state}`);

      logger.info(
        `[WechatLogin] 微信开放平台登录成功: openid=${userInfo.openid}, userId=${loginResult.userId}`
      );

      return {
        success: true,
        user: loginResult.user,
        tokens: loginResult.tokens,
        isNewUser: loginResult.isNewUser,
        platform: 'openPlatform'
      };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('[WechatLogin] 处理微信开放平台扫码回调失败:', err);
      this.stats.failedLogins++;
      throw error;
    }
  }

  /**
   * 处理微信用户登录
   * @param wechatUser - 微信用户信息
   * @param platform - 登录平台
   * @returns 登录结果
   * @private
   */
  async processWechatUserLogin(
    wechatUser: WechatUserInfo,
    platform: WechatLoginPlatform
  ): Promise<ProcessLoginResult> {
    try {
      const { openid, unionid } = wechatUser;

      // 查找现有用户
      let user: UserLoginData | null = null;
      let isNewUser = false;

      if (unionid) {
        // 优先通过unionid查找用户
        const foundUser = (await db('users').where('wechat_unionid', unionid).first()) as
          | UserLoginData
          | undefined;
        if (foundUser) {
          user = foundUser;
        }
      }

      if (!user && openid) {
        // 通过openid查找用户
        const foundUser = (await db('users').where('wechat_openid', openid).first()) as
          | UserLoginData
          | undefined;
        if (foundUser) {
          user = foundUser;
        }
      }

      if (!user) {
        // 创建新用户
        user = await this.createNewWechatUser(wechatUser, platform);
        isNewUser = true;
        this.stats.newUsers++;
      } else {
        // 更新现有用户信息
        await this.updateWechatUser(user.id, wechatUser, platform);
        this.stats.existingUsers++;
      }

      // 生成JWT令牌
      const tokens = tokenService.generateTokenPair(user);

      // 更新最后登录时间
      await db('users').where('id', user.id).update({
        last_login_at: new Date(),
        last_login_platform: platform,
        updated_at: new Date()
      });

      // 缓存用户会话
      const sessionKey = `wechat_session:${user.id}`;
      const sessionData: SessionCacheData = {
        openid,
        unionid,
        platform,
        loginAt: Date.now()
      };
      await cacheService.set(sessionKey, sessionData, wechatConfig.common.cache.sessionTTL);

      this.stats.totalLogins++;
      this.stats.successfulLogins++;

      return {
        user,
        tokens,
        userId: user.id,
        isNewUser
      };
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('[WechatLogin] 处理微信用户登录失败:', err);
      throw error;
    }
  }

  /**
   * 创建新的微信用户
   * @param wechatUser - 微信用户信息
   * @param platform - 登录平台
   * @returns 用户信息
   * @private
   */
  async createNewWechatUser(
    wechatUser: WechatUserInfo,
    platform: WechatLoginPlatform
  ): Promise<UserLoginData> {
    try {
      const userId = uuidv4().replace(/-/g, '');
      const now = new Date();

      interface UserData {
        id: string;
        email: string;
        username: string;
        wechat_openid: string;
        wechat_unionid?: string;
        wechat_nickname: string | null;
        wechat_avatar: string | null;
        wechat_sex: number | null;
        wechat_province: string | null;
        wechat_city: string | null;
        wechat_country: string | null;
        auth_type: string;
        status: string;
        is_verified: boolean;
        isMember: boolean;
        quota_remaining: number;
        role: string;
        created_at: Date;
        updated_at: Date;
        last_login_at: Date;
        last_login_platform: WechatLoginPlatform;
      }

      const userData: UserData = {
        id: userId,
        email: `wechat_${wechatUser.openid}@placeholder.com`,
        username: `wx_${wechatUser.openid?.substr(0, 10) || 'user'}_${Date.now()}`,
        wechat_openid: wechatUser.openid,
        wechat_unionid: wechatUser.unionid,
        wechat_nickname: wechatUser.nickname || null,
        wechat_avatar: wechatUser.headimgurl || wechatUser.avatarUrl || null,
        wechat_sex: wechatUser.sex || null,
        wechat_province: wechatUser.province || null,
        wechat_city: wechatUser.city || null,
        wechat_country: wechatUser.country || null,
        auth_type: 'wechat',
        status: 'active',
        is_verified: true,
        isMember: false,
        quota_remaining: 5,
        role: 'user',
        created_at: now,
        updated_at: now,
        last_login_at: now,
        last_login_platform: platform
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

      logger.info(`[WechatLogin] 创建新微信用户: userId=${userId}, openid=${wechatUser.openid}`);

      const result: UserLoginData = {
        id: userId,
        email: userData.email,
        username: userData.username,
        wechat_nickname: userData.wechat_nickname ?? undefined,
        wechat_avatar: userData.wechat_avatar ?? undefined,
        role: userData.role,
        isMember: userData.isMember,
        quota_remaining: userData.quota_remaining,
        created_at: userData.created_at
      };

      return result;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('[WechatLogin] 创建新微信用户失败:', err);
      throw error;
    }
  }

  /**
   * 更新微信用户信息
   * @param userId - 用户ID
   * @param wechatUser - 微信用户信息
   * @param platform - 登录平台
   * @private
   */
  async updateWechatUser(
    userId: string,
    wechatUser: WechatUserInfo,
    platform: WechatLoginPlatform
  ): Promise<void> {
    try {
      interface UpdateData {
        last_login_platform: WechatLoginPlatform;
        updated_at: Date;
        wechat_openid?: string;
        wechat_unionid?: string;
        wechat_nickname?: string;
        wechat_avatar?: string;
      }

      const updateData: UpdateData = {
        last_login_platform: platform,
        updated_at: new Date()
      };

      // 更新微信相关信息（如果有的话）
      if (wechatUser.openid && !wechatUser.unionid) {
        updateData.wechat_openid = wechatUser.openid;
      }

      if (wechatUser.unionid) {
        updateData.wechat_unionid = wechatUser.unionid;
        updateData.wechat_openid = wechatUser.openid;
      }

      if (wechatUser.nickname || wechatUser.nickName) {
        updateData.wechat_nickname = wechatUser.nickname || (wechatUser.nickName as string);
      }

      if (wechatUser.headimgurl || wechatUser.avatarUrl) {
        updateData.wechat_avatar = wechatUser.headimgurl || (wechatUser.avatarUrl as string);
      }

      await db('users').where('id', userId).update(updateData);

      logger.debug(`[WechatLogin] 更新微信用户信息: userId=${userId}`);
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('[WechatLogin] 更新微信用户信息失败:', err);
      throw error;
    }
  }

  /**
   * 获取微信公众号access_token
   * @param code - 授权码
   * @returns token数据
   * @private
   */
  async getOfficialAccessToken(code: string): Promise<TokenData> {
    try {
      const config = getWechatConfig('officialAccount');
      const tokenUrl = getWechatApiUrl('officialAccount', '/sns/oauth2/access_token');

      const params: Record<string, string> = {
        appid: config.appId,
        secret: config.appSecret,
        code: code,
        grant_type: 'authorization_code'
      };

      const response = await axios.get<TokenData>(tokenUrl, { params, timeout: 10000 });

      if (response.data.errcode) {
        throw new Error(`微信API错误: ${response.data.errcode} - ${response.data.errmsg}`);
      }

      return response.data;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('[WechatLogin] 获取微信公众号access_token失败:', err);
      throw error;
    }
  }

  /**
   * 获取微信公众号用户信息
   * @param accessToken - 访问令牌
   * @param openid - 用户openid
   * @returns 用户信息
   * @private
   */
  async getOfficialUserInfo(accessToken: string, openid: string): Promise<WechatUserInfo> {
    try {
      const userInfoUrl = getWechatApiUrl('officialAccount', '/sns/userinfo');

      const params: Record<string, string> = {
        access_token: accessToken,
        openid: openid,
        lang: 'zh_CN'
      };

      const response = await axios.get<WechatUserInfo>(userInfoUrl, { params, timeout: 10000 });

      if (response.data.errcode !== undefined) {
        const errCode = response.data.errcode as unknown;
        const errMsg = response.data.errmsg as unknown;
        throw new Error(`微信API错误: ${errCode} - ${errMsg}`);
      }

      return response.data;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('[WechatLogin] 获取微信公众号用户信息失败:', err);
      throw error;
    }
  }

  /**
   * 获取小程序session
   * @param code - 登录凭证
   * @returns session数据
   * @private
   */
  async getMiniProgramSession(code: string): Promise<TokenData> {
    try {
      const config = getWechatConfig('miniProgram');
      const sessionUrl = getWechatApiUrl('officialAccount', '/sns/jscode2session');

      const params: Record<string, string> = {
        appid: config.appId,
        secret: config.appSecret,
        js_code: code,
        grant_type: 'authorization_code'
      };

      const response = await axios.get<TokenData>(sessionUrl, { params, timeout: 10000 });

      if (response.data.errcode) {
        throw new Error(`微信API错误: ${response.data.errcode} - ${response.data.errmsg}`);
      }

      return response.data;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('[WechatLogin] 获取小程序session失败:', err);
      throw error;
    }
  }

  /**
   * 获取开放平台access_token
   * @param code - 授权码
   * @returns token数据
   * @private
   */
  async getOpenPlatformAccessToken(code: string): Promise<TokenData> {
    try {
      const config = getWechatConfig('openPlatform');
      const tokenUrl = getWechatApiUrl('openPlatform', '/sns/oauth2/access_token');

      const params: Record<string, string> = {
        appid: config.appId,
        secret: config.appSecret,
        code: code,
        grant_type: 'authorization_code'
      };

      const response = await axios.get<TokenData>(tokenUrl, { params, timeout: 10000 });

      if (response.data.errcode) {
        throw new Error(`微信API错误: ${response.data.errcode} - ${response.data.errmsg}`);
      }

      return response.data;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('[WechatLogin] 获取开放平台access_token失败:', err);
      throw error;
    }
  }

  /**
   * 获取开放平台用户信息
   * @param accessToken - 访问令牌
   * @param openid - 用户openid
   * @returns 用户信息
   * @private
   */
  async getOpenPlatformUserInfo(accessToken: string, openid: string): Promise<WechatUserInfo> {
    try {
      const userInfoUrl = getWechatApiUrl('openPlatform', '/sns/userinfo');

      const params: Record<string, string> = {
        access_token: accessToken,
        openid: openid
      };

      const response = await axios.get<WechatUserInfo>(userInfoUrl, {
        params,
        timeout: 10000
      });

      if (response.data.errcode !== undefined) {
        const errCode = response.data.errcode as unknown;
        const errMsg = response.data.errmsg as unknown;
        throw new Error(`微信API错误: ${errCode} - ${errMsg}`);
      }

      return response.data;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('[WechatLogin] 获取开放平台用户信息失败:', err);
      throw error;
    }
  }

  /**
   * 获取用户微信绑定信息
   * @param userId - 用户ID
   * @returns 绑定信息
   */
  async getUserWechatBindings(userId: string): Promise<WechatBindings> {
    try {
      interface UserBindingData {
        wechat_openid?: string;
        wechat_unionid?: string;
        wechat_nickname?: string;
        wechat_avatar?: string;
        last_login_platform?: WechatLoginPlatform;
      }

      const user = await db('users')
        .where('id', userId)
        .first([
          'wechat_openid',
          'wechat_unionid',
          'wechat_nickname',
          'wechat_avatar',
          'last_login_platform'
        ]);

      if (!user) {
        throw new Error('用户不存在');
      }

      const bindingData = user as UserBindingData;
      const bindings: WechatBindings = {};

      if (bindingData.wechat_openid) {
        bindings.openid = bindingData.wechat_openid;
      }

      if (bindingData.wechat_unionid) {
        bindings.unionid = bindingData.wechat_unionid;
      }

      if (bindingData.wechat_nickname) {
        bindings.nickname = bindingData.wechat_nickname;
      }

      if (bindingData.wechat_avatar) {
        bindings.avatar = bindingData.wechat_avatar;
      }

      if (bindingData.last_login_platform) {
        bindings.lastLoginPlatform = bindingData.last_login_platform;
      }

      return bindings;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('[WechatLogin] 获取用户微信绑定信息失败:', err);
      throw error;
    }
  }

  /**
   * 解除微信绑定
   * @param userId - 用户ID
   * @returns 是否成功
   */
  async unbindWechat(userId: string): Promise<boolean> {
    try {
      await db('users').where('id', userId).update({
        wechat_openid: null,
        wechat_unionid: null,
        wechat_nickname: null,
        wechat_avatar: null,
        updated_at: new Date()
      });

      // 清除缓存
      const sessionKey = `wechat_session:${userId}`;
      await cacheService.delete(sessionKey);

      logger.info(`[WechatLogin] 解除微信绑定: userId=${userId}`);

      return true;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('[WechatLogin] 解除微信绑定失败:', err);
      throw error;
    }
  }

  /**
   * 获取统计信息
   * @returns 统计数据
   */
  getStats(): LoginStats {
    const now = Date.now();
    const uptime = now - this.stats.lastReset;

    return {
      ...this.stats,
      uptime,
      activeSessions: this.sessionStore.keys().length,
      cachedAccessTokens: this.accessTokenCache.keys().length,
      cachedJsapiTickets: this.jsapiTicketCache.keys().length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 启动清理任务
   * @private
   */
  private startCleanupJob(): void {
    // 每30分钟清理一次过期数据
    setInterval(
      (): void => {
        this.cleanupExpiredData();
      },
      30 * 60 * 1000
    );

    logger.info('[WechatLogin] 清理任务已启动');
  }

  /**
   * 清理过期数据
   * @private
   */
  private cleanupExpiredData(): void {
    try {
      const now = Date.now();
      const maxAge = 10 * 60 * 1000; // 10分钟

      // 清理过期的state数据
      const stateKeys = this.sessionStore.keys().filter((key) => key.startsWith('state:'));
      let cleanedStates = 0;

      for (const key of stateKeys) {
        const data = this.sessionStore.get(key) as StateData | undefined;
        if (data && now - data.createdAt > maxAge) {
          this.sessionStore.del(key);
          cleanedStates++;
        }
      }

      logger.debug(`[WechatLogin] 清理过期数据完成: ${cleanedStates}个state`);
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('[WechatLogin] 清理过期数据失败:', err);
    }
  }

  /**
   * 关闭微信登录服务
   */
  async close(): Promise<void> {
    try {
      // 清空所有缓存
      this.accessTokenCache.flushAll();
      this.jsapiTicketCache.flushAll();
      this.sessionStore.flushAll();

      this.initialized = false;
      logger.info('[WechatLogin] 微信登录服务已关闭');
    } catch (error: unknown) {
      const err = error as Error;
      logger.error('[WechatLogin] 关闭微信登录服务失败:', err);
    }
  }
}

const wechatLoginService: WechatLoginService = new WechatLoginService();

export default wechatLoginService;
