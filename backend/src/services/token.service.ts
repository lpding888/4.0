import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import type { Redis as RedisInstance } from 'ioredis';
import Redis from 'ioredis';
import logger from '../utils/logger.js';

type AccessTokenPayload = JwtPayload & {
  uid: string;
  userId: string;
  role?: string;
  phone?: string;
};

type RefreshTokenPayload = JwtPayload & {
  uid: string;
  userId: string;
  role?: string;
  phone?: string;
  type: 'refresh';
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
};

export type UserForToken = {
  id: string;
  role?: string;
  phone?: string;
};

type RedisConstructor = new (...args: unknown[]) => RedisInstance;
const RedisCtor = Redis as unknown as RedisConstructor;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isTestEnvironment = process.env.NODE_ENV === 'test';

class TokenService {
  private readonly redis: RedisInstance;

  private readonly accessTokenExpiry = '15m';

  private readonly refreshTokenExpiry = '7d';

  private readonly blacklistTTL = 7 * 24 * 60 * 60; // 7 天

  constructor() {
    this.redis = new RedisCtor({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: Number(process.env.REDIS_DB) || 0,
      keyPrefix: 'auth:',
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: isTestEnvironment
    });

    this.redis.on('error', (err) => {
      logger.error('[TokenService] Redis连接错误', err);
    });
  }

  generateTokenPair(user: UserForToken): TokenPair {
    const issuedAt = Math.floor(Date.now() / 1000);
    const accessPayload: AccessTokenPayload = {
      uid: user.id,
      userId: user.id,
      role: user.role ?? 'user',
      phone: user.phone,
      iat: issuedAt
    };

    const refreshPayload: RefreshTokenPayload = {
      uid: user.id,
      userId: user.id,
      role: user.role ?? 'user',
      phone: user.phone,
      type: 'refresh',
      iat: issuedAt
    };

    const accessToken = this.generateAccessToken(accessPayload);
    const refreshToken = this.generateRefreshToken(refreshPayload);
    const expiresIn = Math.floor(Date.now() / 1000) + 15 * 60;

    logger.info(`[TokenService] 生成Token对: uid=${user.id}, role=${user.role ?? 'user'}`);

    return {
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer'
    };
  }

  generateAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(payload, this.getAccessSecret(), {
      expiresIn: this.accessTokenExpiry,
      issuer: 'ai-photo-platform',
      audience: 'ai-photo-client',
      jwtid: this.generateJTI()
    } satisfies SignOptions);
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair | null> {
    const decoded = this.verifyRefreshToken(refreshToken);
    if (!decoded || decoded.type !== 'refresh') {
      return null;
    }

    const userId = decoded.uid || decoded.userId;
    if (!userId) {
      return null;
    }

    if (decoded.jti && (await this.isTokenBlacklisted(decoded.jti))) {
      return null;
    }

    if (await this.isUserRevoked(userId)) {
      return null;
    }

    if (decoded.jti) {
      await this.addToBlacklist(decoded.jti);
    }

    const userPayload: UserForToken = {
      id: userId,
      role: decoded.role,
      phone: decoded.phone
    };

    return this.generateTokenPair(userPayload);
  }

  generateRefreshToken(payload: RefreshTokenPayload): string {
    return jwt.sign(payload, this.getRefreshSecret(), {
      expiresIn: this.refreshTokenExpiry,
      issuer: 'ai-photo-platform',
      audience: 'ai-photo-client',
      jwtid: this.generateJTI()
    } satisfies SignOptions);
  }

  verifyAccessToken(token: string): AccessTokenPayload | null {
    try {
      return jwt.verify(token, this.getAccessSecret(), {
        issuer: 'ai-photo-platform',
        audience: 'ai-photo-client'
      }) as AccessTokenPayload;
    } catch (error) {
      logger.warn(`[TokenService] Access Token验证失败: ${getErrorMessage(error)}`);
      return null;
    }
  }

  verifyRefreshToken(token: string): RefreshTokenPayload | null {
    try {
      return jwt.verify(token, this.getRefreshSecret(), {
        issuer: 'ai-photo-platform',
        audience: 'ai-photo-client'
      }) as RefreshTokenPayload;
    } catch (error) {
      logger.warn(`[TokenService] Refresh Token验证失败: ${getErrorMessage(error)}`);
      return null;
    }
  }

  decodeToken(token: string): JwtPayload | null {
    try {
      const decoded = jwt.decode(token);
      if (!decoded || typeof decoded === 'string') {
        return null;
      }
      return decoded;
    } catch (error) {
      logger.warn(`[TokenService] Token 解码失败: ${getErrorMessage(error)}`);
      return null;
    }
  }

  async addToBlacklist(jti: string, ttl: number = this.blacklistTTL): Promise<boolean> {
    try {
      await this.redis.setex(`blacklist:${jti}`, ttl, '1');
      logger.info(`[TokenService] Token加入黑名单: jti=${jti}, ttl=${ttl}`);
      return true;
    } catch (error) {
      logger.error(`[TokenService] 加入黑名单失败: ${getErrorMessage(error)}`);
      return false;
    }
  }

  async isTokenBlacklisted(jti: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(`blacklist:${jti}`);
      return result === 1;
    } catch (error) {
      logger.error(`[TokenService] 检查黑名单失败: ${getErrorMessage(error)}`);
      return false;
    }
  }

  async revokeUserTokens(userId: string): Promise<boolean> {
    try {
      await this.redis.setex(`user_blacklist:${userId}`, this.blacklistTTL, '1');
      logger.info(`[TokenService] 撤销用户Token: userId=${userId}`);
      return true;
    } catch (error) {
      logger.error(`[TokenService] 撤销用户Token失败: ${getErrorMessage(error)}`);
      return false;
    }
  }

  async isUserRevoked(userId: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(`user_blacklist:${userId}`);
      return result === 1;
    } catch (error) {
      logger.error(`[TokenService] 检查用户撤销状态失败: ${getErrorMessage(error)}`);
      return false;
    }
  }

  async cleanupExpiredBlacklist(): Promise<number> {
    try {
      logger.info('[TokenService] 黑名单清理完成（自动过期）');
      return 0;
    } catch (error) {
      logger.error(`[TokenService] 清理黑名单失败: ${getErrorMessage(error)}`);
      return 0;
    }
  }

  getTokenRemainingTime(token: string): number | null {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded?.exp) {
        return null;
      }

      const now = Math.floor(Date.now() / 1000);
      const remaining = decoded.exp - now;
      return remaining > 0 ? remaining : 0;
    } catch (error) {
      logger.error(`[TokenService] 获取Token剩余时间失败: ${getErrorMessage(error)}`);
      return null;
    }
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      logger.info('[TokenService] Redis连接已关闭');
    }
  }

  private getAccessSecret(): string {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET 未配置');
    }
    return process.env.JWT_SECRET;
  }

  private getRefreshSecret(): string {
    const secret = process.env.JWT_REFRESH_SECRET ?? process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET 未配置');
    }
    return secret;
  }

  private generateJTI(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}_${random}`;
  }
}

const tokenService = new TokenService();
export default tokenService;
