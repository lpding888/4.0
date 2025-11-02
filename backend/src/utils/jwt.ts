/**
 * JWT工具函数
 * 艹，这个tm管理所有Token的生成和验证！
 */

import jwt from 'jsonwebtoken';

// JWT配置
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_this_in_production';
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m'; // 15分钟
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d'; // 7天

/**
 * Token载荷接口
 */
export interface TokenPayload {
  userId: string;
  phone: string;
  role: string;
}

/**
 * 生成Access Token（短期）
 * 艹，这个用于API访问，有效期短！
 */
export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN as string,
    issuer: 'ai-wardrobe-backend',
  } as jwt.SignOptions);
}

/**
 * 生成Refresh Token（长期）
 * 艹，这个用于刷新Access Token，有效期长！
 */
export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN as string,
    issuer: 'ai-wardrobe-backend',
  } as jwt.SignOptions);
}

/**
 * 验证Token
 * 艹，这个tm检查Token是否合法！
 */
export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'ai-wardrobe-backend',
    }) as TokenPayload;

    return decoded;
  } catch (error: any) {
    // 艹，Token验证失败！
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token已过期');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Token无效');
    } else {
      throw new Error('Token验证失败');
    }
  }
}

/**
 * 从请求头或Cookie中提取Token
 * 艹，支持两种方式：Authorization头 或 Cookie
 */
export function extractTokenFromRequest(req: any): string | null {
  // 1. 从Authorization头提取（Bearer token）
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // 2. 从Cookie提取
  const cookieToken = req.cookies?.access_token;
  if (cookieToken) {
    return cookieToken;
  }

  return null;
}
