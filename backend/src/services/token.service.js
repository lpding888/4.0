const jwt = require('jsonwebtoken');
const Redis = require('ioredis');
const logger = require('../utils/logger');

/**
 * 双Token认证服务
 *
 * 实现 Access Token + Refresh Token 机制:
 * - Access Token: 15分钟有效期，用于API访问
 * - Refresh Token: 7天有效期，用于刷新Access Token
 * - 黑名单机制: 刷新后的旧Refresh Token加入黑名单
 * - 旋转机制: 每次刷新生成新的Refresh Token
 */
class TokenService {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: process.env.REDIS_DB || 0,
      keyPrefix: 'auth:',
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });

    // Token配置
    this.accessTokenExpiry = '15m'; // 15分钟
    this.refreshTokenExpiry = '7d'; // 7天
    this.blacklistTTL = 7 * 24 * 60 * 60; // 7天秒数

    this.redis.on('error', (err) => {
      logger.error('[TokenService] Redis连接错误', err);
    });
  }

  /**
   * 生成Access Token
   * @param {Object} payload - JWT载荷
   * @returns {string} Access Token
   */
  generateAccessToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: this.accessTokenExpiry,
      issuer: 'ai-photo-platform',
      audience: 'ai-photo-client',
      jwtid: this.generateJTI()
    });
  }

  /**
   * 生成Refresh Token
   * @param {Object} payload - JWT载荷
   * @returns {string} Refresh Token
   */
  generateRefreshToken(payload) {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
      expiresIn: this.refreshTokenExpiry,
      issuer: 'ai-photo-platform',
      audience: 'ai-photo-client',
      jwtid: this.generateJTI()
    });
  }

  /**
   * 生成Token对
   * @param {Object} user - 用户信息
   * @returns {Object} {accessToken, refreshToken, expiresIn}
   */
  generateTokenPair(user) {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      uid: user.id,
      role: user.role || 'user',
      phone: user.phone,
      iat: now
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken({
      uid: user.id,
      type: 'refresh',
      iat: now
    });

    // 计算Access Token过期时间（Unix时间戳）
    const expiresIn = Math.floor(Date.now() / 1000) + (15 * 60); // 15分钟后过期

    logger.info(`[TokenService] 生成Token对: uid=${user.id}, role=${user.role}`);

    return {
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer'
    };
  }

  /**
   * 验证Access Token
   * @param {string} token - Access Token
   * @returns {Object|null} 解码后的载荷
   */
  verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'ai-photo-platform',
        audience: 'ai-photo-client'
      });

      return decoded;
    } catch (error) {
      logger.warn(`[TokenService] Access Token验证失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 验证Refresh Token
   * @param {string} token - Refresh Token
   * @returns {Object|null} 解码后的载荷
   */
  verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
        issuer: 'ai-photo-platform',
        audience: 'ai-photo-client'
      });

      // 检查token类型
      if (decoded.type !== 'refresh') {
        logger.warn('[TokenService] Refresh Token类型错误');
        return null;
      }

      return decoded;
    } catch (error) {
      logger.warn(`[TokenService] Refresh Token验证失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 刷新Token
   * @param {string} refreshToken - 旧的Refresh Token
   * @returns {Promise<Object|null>} 新的Token对
   */
  async refreshTokens(refreshToken) {
    try {
      // 1. 验证旧的Refresh Token
      const oldPayload = this.verifyRefreshToken(refreshToken);
      if (!oldPayload) {
        throw new Error('无效的Refresh Token');
      }

      // 2. 检查是否在黑名单中
      const isInBlacklist = await this.isTokenBlacklisted(oldPayload.jti);
      if (isInBlacklist) {
        throw new Error('Refresh Token已失效');
      }

      // 3. 获取用户信息
      const db = require('../config/database');
      const user = await db('users')
        .where('id', oldPayload.uid)
        .first();

      if (!user) {
        throw new Error('用户不存在');
      }

      // 4. 将旧的Refresh Token加入黑名单
      await this.addToBlacklist(oldPayload.jti, this.blacklistTTL);

      // 5. 生成新的Token对
      const newTokens = this.generateTokenPair(user);

      logger.info(`[TokenService] Token刷新成功: uid=${user.id}`);

      return newTokens;

    } catch (error) {
      logger.error(`[TokenService] Token刷新失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 将Token加入黑名单
   * @param {string} jti - JWT ID
   * @param {number} ttl - 过期时间（秒）
   * @returns {Promise<boolean>}
   */
  async addToBlacklist(jti, ttl = this.blacklistTTL) {
    try {
      const key = `blacklist:${jti}`;
      await this.redis.setex(key, ttl, '1');
      logger.info(`[TokenService] Token加入黑名单: jti=${jti}, ttl=${ttl}`);
      return true;
    } catch (error) {
      logger.error(`[TokenService] 加入黑名单失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 检查Token是否在黑名单中
   * @param {string} jti - JWT ID
   * @returns {Promise<boolean>}
   */
  async isTokenBlacklisted(jti) {
    try {
      const key = `blacklist:${jti}`;
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`[TokenService] 检查黑名单失败: ${error.message}`);
      // Redis异常时默认不在黑名单，避免影响正常使用
      return false;
    }
  }

  /**
   * 撤销用户的所有Token（用户主动登出）
   * @param {string} userId - 用户ID
   * @returns {Promise<boolean>}
   */
  async revokeUserTokens(userId) {
    try {
      // 将用户ID加入黑名单，所有该用户的Token都会被拒绝
      const key = `user_blacklist:${userId}`;
      await this.redis.setex(key, this.blacklistTTL, '1');

      logger.info(`[TokenService] 撤销用户Token: userId=${userId}`);
      return true;
    } catch (error) {
      logger.error(`[TokenService] 撤销用户Token失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 检查用户Token是否被撤销
   * @param {string} userId - 用户ID
   * @returns {Promise<boolean>}
   */
  async isUserRevoked(userId) {
    try {
      const key = `user_blacklist:${userId}`;
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`[TokenService] 检查用户撤销状态失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 清理过期的黑名单记录（定时任务）
   * @returns {Promise<number>} 清理的记录数
   */
  async cleanupExpiredBlacklist() {
    try {
      // Redis会自动清理过期的key，这里可以添加额外的清理逻辑
      logger.info('[TokenService] 黑名单清理完成（自动过期）');
      return 0;
    } catch (error) {
      logger.error(`[TokenService] 清理黑名单失败: ${error.message}`);
      return 0;
    }
  }

  /**
   * 生成唯一的JWT ID
   * @returns {string}
   */
  generateJTI() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}_${random}`;
  }

  /**
   * 获取Token剩余有效时间
   * @param {string} token - JWT Token
   * @returns {number|null} 剩余秒数
   */
  getTokenRemainingTime(token) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.exp) {
        return null;
      }

      const now = Math.floor(Date.now() / 1000);
      const remaining = decoded.exp - now;

      return remaining > 0 ? remaining : 0;
    } catch (error) {
      logger.error(`[TokenService] 获取Token剩余时间失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 关闭Redis连接
   */
  async disconnect() {
    if (this.redis) {
      await this.redis.quit();
      logger.info('[TokenService] Redis连接已关闭');
    }
  }
}

module.exports = new TokenService();