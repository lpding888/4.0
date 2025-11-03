const logger = require('../utils/logger');
const db = require('../config/database');
const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const NodeCache = require('node-cache');
const wechatConfig = require('../config/wechat.config');
const cacheService = require('./cache.service');
const tokenService = require('./token.service');

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
  async initialize() {
    if (this.initialized) {
      logger.warn('[WechatLogin] 微信登录服务已初始化');
      return;
    }

    try {
      // 验证配置
      const platforms = ['officialAccount', 'miniProgram', 'openPlatform'];
      for (const platform of platforms) {
        try {
          wechatConfig.validateConfig(platform);
          logger.info(`[WechatLogin] ${platform} 配置验证成功`);
        } catch (error) {
          logger.warn(`[WechatLogin] ${platform} 配置验证失败:`, error.message);
        }
      }

      // 清理过期数据
      this.startCleanupJob();

      this.initialized = true;
      logger.info('[WechatLogin] 微信登录服务初始化成功');

    } catch (error) {
      logger.error('[WechatLogin] 微信登录服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 生成微信公众号OAuth授权URL
   * @param {string} redirectUri - 回调地址
   * @param {string} scope - 授权范围
   * @param {string} state - 状态参数
   * @returns {string} 授权URL
   */
  generateOfficialOAuthUrl(redirectUri, scope = 'snsapi_userinfo', state = null) {
    try {
      const config = wechatConfig.getConfig('officialAccount');

      // 生成state参数
      const finalState = state || wechatConfig.generateState();

      // 存储state和回调地址
      this.sessionStore.set(`state:${finalState}`, {
        redirectUri,
        platform: 'officialAccount',
        createdAt: Date.now()
      });

      const params = {
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

    } catch (error) {
      logger.error('[WechatLogin] 生成微信公众号授权URL失败:', error);
      throw error;
    }
  }

  /**
   * 处理微信公众号OAuth回调
   * @param {string} code - 授权码
   * @param {string} state - 状态参数
   * @returns {Promise<Object>} 登录结果
   */
  async handleOfficialOAuthCallback(code, state) {
    try {
      // 验证state参数
      const stateData = this.sessionStore.get(`state:${state}`);
      if (!stateData) {
        throw new Error('无效的state参数或已过期');
      }

      if (!wechatConfig.verifyState(state)) {
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

      logger.info(`[WechatLogin] 微信公众号登录成功: openid=${userInfo.openid}, userId=${loginResult.userId}`);

      return {
        success: true,
        user: loginResult.user,
        tokens: loginResult.tokens,
        isNewUser: loginResult.isNewUser,
        platform: 'officialAccount'
      };

    } catch (error) {
      logger.error('[WechatLogin] 处理微信公众号OAuth回调失败:', error);
      this.stats.failedLogins++;
      throw error;
    }
  }

  /**
   * 微信小程序登录
   * @param {string} code - 小程序登录凭证
   * @param {Object} userInfo - 用户信息
   * @returns {Promise<Object>} 登录结果
   */
  async handleMiniProgramLogin(code, userInfo = {}) {
    try {
      // 获取session_key和openid
      const sessionData = await this.getMiniProgramSession(code);

      // 构建用户数据
      const wechatUser = {
        openid: sessionData.openid,
        unionid: sessionData.unionid,
        platform: 'miniProgram',
        ...userInfo
      };

      // 处理用户登录
      const loginResult = await this.processWechatUserLogin(wechatUser, 'miniProgram');

      logger.info(`[WechatLogin] 微信小程序登录成功: openid=${sessionData.openid}, userId=${loginResult.userId}`);

      return {
        success: true,
        user: loginResult.user,
        tokens: loginResult.tokens,
        isNewUser: loginResult.isNewUser,
        platform: 'miniProgram',
        sessionKey: sessionData.session_key
      };

    } catch (error) {
      logger.error('[WechatLogin] 微信小程序登录失败:', error);
      this.stats.failedLogins++;
      throw error;
    }
  }

  /**
   * 微信开放平台扫码登录
   * @param {string} redirectUri - 回调地址
   * @param {string} state - 状态参数
   * @returns {string} 授权URL
   */
  generateOpenPlatformOAuthUrl(redirectUri, state = null) {
    try {
      const config = wechatConfig.getConfig('openPlatform');

      // 生成state参数
      const finalState = state || wechatConfig.generateState();

      // 存储state和回调地址
      this.sessionStore.set(`state:${finalState}`, {
        redirectUri,
        platform: 'openPlatform',
        createdAt: Date.now()
      });

      const params = {
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

    } catch (error) {
      logger.error('[WechatLogin] 生成微信开放平台授权URL失败:', error);
      throw error;
    }
  }

  /**
   * 处理微信开放平台扫码回调
   * @param {string} code - 授权码
   * @param {string} state - 状态参数
   * @returns {Promise<Object>} 登录结果
   */
  async handleOpenPlatformCallback(code, state) {
    try {
      // 验证state参数
      const stateData = this.sessionStore.get(`state:${state}`);
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

      logger.info(`[WechatLogin] 微信开放平台登录成功: openid=${userInfo.openid}, userId=${loginResult.userId}`);

      return {
        success: true,
        user: loginResult.user,
        tokens: loginResult.tokens,
        isNewUser: loginResult.isNewUser,
        platform: 'openPlatform'
      };

    } catch (error) {
      logger.error('[WechatLogin] 处理微信开放平台扫码回调失败:', error);
      this.stats.failedLogins++;
      throw error;
    }
  }

  /**
   * 处理微信用户登录
   * @param {Object} wechatUser - 微信用户信息
   * @param {string} platform - 登录平台
   * @returns {Promise<Object>} 登录结果
   * @private
   */
  async processWechatUserLogin(wechatUser, platform) {
    try {
      const { openid, unionid } = wechatUser;

      // 查找现有用户
      let user = null;
      let isNewUser = false;

      if (unionid) {
        // 优先通过unionid查找用户
        user = await db('users')
          .where('wechat_unionid', unionid)
          .first();
      }

      if (!user && openid) {
        // 通过openid查找用户
        user = await db('users')
          .where('wechat_openid', openid)
          .first();
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
      await db('users')
        .where('id', user.id)
        .update({
          last_login_at: new Date(),
          last_login_platform: platform,
          updated_at: new Date()
        });

      // 缓存用户会话
      const sessionKey = `wechat_session:${user.id}`;
      await cacheService.set(sessionKey, {
        openid,
        unionid,
        platform,
        loginAt: Date.now()
      }, wechatConfig.common.cache.sessionTTL);

      this.stats.totalLogins++;
      this.stats.successfulLogins++;

      return {
        user,
        tokens,
        isNewUser
      };

    } catch (error) {
      logger.error('[WechatLogin] 处理微信用户登录失败:', error);
      throw error;
    }
  }

  /**
   * 创建新的微信用户
   * @param {Object} wechatUser - 微信用户信息
   * @param {string} platform - 登录平台
   * @returns {Promise<Object>} 用户信息
   * @private
   */
  async createNewWechatUser(wechatUser, platform) {
    try {
      const userId = uuidv4().replace(/-/g, '');
      const now = new Date();

      const userData = {
        id: userId,
        email: `wechat_${wechatUser.openid}@placeholder.com`, // 占位邮箱
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
        quota_remaining: 5, // 新用户默认配额
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

      return {
        id: userId,
        email: userData.email,
        username: userData.username,
        wechat_nickname: userData.wechat_nickname,
        wechat_avatar: userData.wechat_avatar,
        role: userData.role,
        isMember: userData.isMember,
        quota_remaining: userData.quota_remaining,
        created_at: userData.created_at
      };

    } catch (error) {
      logger.error('[WechatLogin] 创建新微信用户失败:', error);
      throw error;
    }
  }

  /**
   * 更新微信用户信息
   * @param {string} userId - 用户ID
   * @param {Object} wechatUser - 微信用户信息
   * @param {string} platform - 登录平台
   * @private
   */
  async updateWechatUser(userId, wechatUser, platform) {
    try {
      const updateData = {
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
        updateData.wechat_nickname = wechatUser.nickname || wechatUser.nickName;
      }

      if (wechatUser.headimgurl || wechatUser.avatarUrl) {
        updateData.wechat_avatar = wechatUser.headimgurl || wechatUser.avatarUrl;
      }

      await db('users')
        .where('id', userId)
        .update(updateData);

      logger.debug(`[WechatLogin] 更新微信用户信息: userId=${userId}`);

    } catch (error) {
      logger.error('[WechatLogin] 更新微信用户信息失败:', error);
      throw error;
    }
  }

  /**
   * 获取微信公众号access_token
   * @param {string} code - 授权码
   * @returns {Promise<Object>} token数据
   * @private
   */
  async getOfficialAccessToken(code) {
    try {
      const config = wechatConfig.getConfig('officialAccount');
      const tokenUrl = wechatConfig.getApiUrl('officialAccount', '/sns/oauth2/access_token');

      const params = {
        appid: config.appId,
        secret: config.appSecret,
        code: code,
        grant_type: 'authorization_code'
      };

      const response = await axios.get(tokenUrl, { params, timeout: 10000 });

      if (response.data.errcode) {
        throw new Error(`微信API错误: ${response.data.errcode} - ${response.data.errmsg}`);
      }

      return response.data;

    } catch (error) {
      logger.error('[WechatLogin] 获取微信公众号access_token失败:', error);
      throw error;
    }
  }

  /**
   * 获取微信公众号用户信息
   * @param {string} accessToken - 访问令牌
   * @param {string} openid - 用户openid
   * @returns {Promise<Object>} 用户信息
   * @private
   */
  async getOfficialUserInfo(accessToken, openid) {
    try {
      const userInfoUrl = wechatConfig.getApiUrl('officialAccount', '/sns/userinfo');

      const params = {
        access_token: accessToken,
        openid: openid,
        lang: 'zh_CN'
      };

      const response = await axios.get(userInfoUrl, { params, timeout: 10000 });

      if (response.data.errcode) {
        throw new Error(`微信API错误: ${response.data.errcode} - ${response.data.errmsg}`);
      }

      return response.data;

    } catch (error) {
      logger.error('[WechatLogin] 获取微信公众号用户信息失败:', error);
      throw error;
    }
  }

  /**
   * 获取小程序session
   * @param {string} code - 登录凭证
   * @returns {Promise<Object>} session数据
   * @private
   */
  async getMiniProgramSession(code) {
    try {
      const config = wechatConfig.getConfig('miniProgram');
      const sessionUrl = wechatConfig.getApiUrl('officialAccount', '/sns/jscode2session');

      const params = {
        appid: config.appId,
        secret: config.appSecret,
        js_code: code,
        grant_type: 'authorization_code'
      };

      const response = await axios.get(sessionUrl, { params, timeout: 10000 });

      if (response.data.errcode) {
        throw new Error(`微信API错误: ${response.data.errcode} - ${response.data.errmsg}`);
      }

      return response.data;

    } catch (error) {
      logger.error('[WechatLogin] 获取小程序session失败:', error);
      throw error;
    }
  }

  /**
   * 获取开放平台access_token
   * @param {string} code - 授权码
   * @returns {Promise<Object>} token数据
   * @private
   */
  async getOpenPlatformAccessToken(code) {
    try {
      const config = wechatConfig.getConfig('openPlatform');
      const tokenUrl = wechatConfig.getApiUrl('openPlatform', '/sns/oauth2/access_token');

      const params = {
        appid: config.appId,
        secret: config.appSecret,
        code: code,
        grant_type: 'authorization_code'
      };

      const response = await axios.get(tokenUrl, { params, timeout: 10000 });

      if (response.data.errcode) {
        throw new Error(`微信API错误: ${response.data.errcode} - ${response.data.errmsg}`);
      }

      return response.data;

    } catch (error) {
      logger.error('[WechatLogin] 获取开放平台access_token失败:', error);
      throw error;
    }
  }

  /**
   * 获取开放平台用户信息
   * @param {string} accessToken - 访问令牌
   * @param {string} openid - 用户openid
   * @returns {Promise<Object>} 用户信息
   * @private
   */
  async getOpenPlatformUserInfo(accessToken, openid) {
    try {
      const userInfoUrl = wechatConfig.getApiUrl('openPlatform', '/sns/userinfo');

      const params = {
        access_token: accessToken,
        openid: openid
      };

      const response = await axios.get(userInfoUrl, { params, timeout: 10000 });

      if (response.data.errcode) {
        throw new Error(`微信API错误: ${response.data.errcode} - ${response.data.errmsg}`);
      }

      return response.data;

    } catch (error) {
      logger.error('[WechatLogin] 获取开放平台用户信息失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户微信绑定信息
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 绑定信息
   */
  async getUserWechatBindings(userId) {
    try {
      const user = await db('users')
        .where('id', userId)
        .first(['wechat_openid', 'wechat_unionid', 'wechat_nickname', 'wechat_avatar', 'last_login_platform']);

      if (!user) {
        throw new Error('用户不存在');
      }

      const bindings = {};

      if (user.wechat_openid) {
        bindings.openid = user.wechat_openid;
      }

      if (user.wechat_unionid) {
        bindings.unionid = user.wechat_unionid;
      }

      if (user.wechat_nickname) {
        bindings.nickname = user.wechat_nickname;
      }

      if (user.wechat_avatar) {
        bindings.avatar = user.wechat_avatar;
      }

      if (user.last_login_platform) {
        bindings.lastLoginPlatform = user.last_login_platform;
      }

      return bindings;

    } catch (error) {
      logger.error('[WechatLogin] 获取用户微信绑定信息失败:', error);
      throw error;
    }
  }

  /**
   * 解除微信绑定
   * @param {string} userId - 用户ID
   * @returns {Promise<boolean>} 是否成功
   */
  async unbindWechat(userId) {
    try {
      await db('users')
        .where('id', userId)
        .update({
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

    } catch (error) {
      logger.error('[WechatLogin] 解除微信绑定失败:', error);
      throw error;
    }
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计数据
   */
  getStats() {
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
  startCleanupJob() {
    // 每30分钟清理一次过期数据
    setInterval(() => {
      this.cleanupExpiredData();
    }, 30 * 60 * 1000);

    logger.info('[WechatLogin] 清理任务已启动');
  }

  /**
   * 清理过期数据
   * @private
   */
  cleanupExpiredData() {
    try {
      const now = Date.now();
      const maxAge = 10 * 60 * 1000; // 10分钟

      // 清理过期的state数据
      const stateKeys = this.sessionStore.keys().filter(key => key.startsWith('state:'));
      let cleanedStates = 0;

      for (const key of stateKeys) {
        const data = this.sessionStore.get(key);
        if (data && now - data.createdAt > maxAge) {
          this.sessionStore.del(key);
          cleanedStates++;
        }
      }

      logger.debug(`[WechatLogin] 清理过期数据完成: ${cleanedStates}个state`);

    } catch (error) {
      logger.error('[WechatLogin] 清理过期数据失败:', error);
    }
  }

  /**
   * 关闭微信登录服务
   */
  async close() {
    try {
      // 清空所有缓存
      this.accessTokenCache.flushAll();
      this.jsapiTicketCache.flushAll();
      this.sessionStore.flushAll();

      this.initialized = false;
      logger.info('[WechatLogin] 微信登录服务已关闭');

    } catch (error) {
      logger.error('[WechatLogin] 关闭微信登录服务失败:', error);
    }
  }
}

module.exports = new WechatLoginService();