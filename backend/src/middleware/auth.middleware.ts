/**
 * 认证中间件
 * 艹，这个tm负责验证用户身份和权限！
 */

import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromRequest, TokenPayload } from '../utils/jwt';

/**
 * 扩展Express Request接口，添加user属性
 */
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * 认证中间件 - 验证JWT Token
 * 艹，必须登录才能访问！
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    // 1. 提取Token
    const token = extractTokenFromRequest(req);

    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '未登录，请先登录',
        },
      });
      return;
    }

    // 2. 验证Token
    try {
      const payload = verifyToken(token);

      // 3. 将用户信息附加到请求对象
      req.user = payload;

      next();
    } catch (error: any) {
      // 艹，Token无效或过期！
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_INVALID',
          message: error.message || 'Token无效或已过期',
        },
      });
      return;
    }
  } catch (error: any) {
    console.error('[Auth Middleware] 认证失败:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '认证过程发生错误',
      },
    });
  }
}

/**
 * 管理员权限中间件
 * 艹，必须是admin才能访问！
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  // 必须先通过authenticate中间件
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '未登录，请先登录',
      },
    });
    return;
  }

  // 检查角色
  if (req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: '权限不足，需要管理员权限',
      },
    });
    return;
  }

  next();
}

/**
 * 可选认证中间件 - Token存在则验证，不存在也放行
 * 艹，用于那些登录和未登录都能访问，但登录后有额外功能的接口！
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = extractTokenFromRequest(req);

    if (token) {
      try {
        const payload = verifyToken(token);
        req.user = payload;
      } catch (error) {
        // 艹，Token无效但不报错，直接当未登录处理
        console.log('[Auth Middleware] Token验证失败，当作未登录处理');
      }
    }

    next();
  } catch (error: any) {
    console.error('[Auth Middleware] 可选认证失败:', error.message);
    next();
  }
}
