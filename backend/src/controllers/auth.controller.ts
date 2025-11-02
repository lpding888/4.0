/**
 * Auth Controller
 * 艹，这个tm负责所有认证相关操作！登录、注册、刷新、登出！
 */

import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import * as userRepo from '../repositories/users.repo';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../utils/jwt';

/**
 * Cookie配置
 * 艹，httpOnly防止XSS攻击！secure在生产环境启用！
 */
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // 生产环境用HTTPS
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
};

export class AuthController {
  /**
   * 用户注册
   * POST /api/auth/register
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone, password, referrer_id } = req.body;

      // 艹，基础校验
      if (!phone || !password) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '手机号和密码不能为空',
          },
        });
        return;
      }

      // 手机号格式校验
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '手机号格式不正确',
          },
        });
        return;
      }

      // 密码长度校验
      if (password.length < 6) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '密码长度不能少于6位',
          },
        });
        return;
      }

      // 检查手机号是否已存在
      const exists = await userRepo.phoneExists(phone);
      if (exists) {
        res.status(409).json({
          success: false,
          error: {
            code: 'PHONE_EXISTS',
            message: '手机号已被注册',
          },
        });
        return;
      }

      // 艹，密码加密！
      const hashedPassword = await bcrypt.hash(password, 10);

      // 创建用户
      const user = await userRepo.createUser({
        id: nanoid(32),
        phone,
        password: hashedPassword,
        role: 'user', // 默认普通用户
        isMember: false,
        quota_remaining: 0,
        referrer_id: referrer_id || null,
      });

      // 生成Token
      const accessToken = generateAccessToken({
        userId: user.id,
        phone: user.phone,
        role: user.role,
      });

      const refreshToken = generateRefreshToken({
        userId: user.id,
        phone: user.phone,
        role: user.role,
      });

      // 艹，设置Cookie！
      res.cookie('access_token', accessToken, COOKIE_OPTIONS);
      res.cookie('refresh_token', refreshToken, COOKIE_OPTIONS);
      res.cookie('roles', user.role, { ...COOKIE_OPTIONS, httpOnly: false }); // roles可以被JS读取

      // 返回用户信息（不含密码）
      const safeUser = userRepo.toSafeUser(user);

      res.status(201).json({
        success: true,
        data: {
          user: safeUser,
          access_token: accessToken,
          refresh_token: refreshToken,
        },
      });
    } catch (error: any) {
      console.error('[AuthController] 注册失败:', error.message);
      next(error);
    }
  }

  /**
   * 用户登录
   * POST /api/auth/login
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone, password } = req.body;

      // 艹，基础校验
      if (!phone || !password) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '手机号和密码不能为空',
          },
        });
        return;
      }

      // 查找用户
      const user = await userRepo.findUserByPhone(phone);
      if (!user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: '手机号或密码错误',
          },
        });
        return;
      }

      // 艹，验证密码！
      if (!user.password) {
        res.status(401).json({
          success: false,
          error: {
            code: 'PASSWORD_NOT_SET',
            message: '该账号未设置密码，请联系管理员',
          },
        });
        return;
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: '手机号或密码错误',
          },
        });
        return;
      }

      // 生成Token
      const accessToken = generateAccessToken({
        userId: user.id,
        phone: user.phone,
        role: user.role,
      });

      const refreshToken = generateRefreshToken({
        userId: user.id,
        phone: user.phone,
        role: user.role,
      });

      // 艹，设置Cookie！
      res.cookie('access_token', accessToken, COOKIE_OPTIONS);
      res.cookie('refresh_token', refreshToken, COOKIE_OPTIONS);
      res.cookie('roles', user.role, { ...COOKIE_OPTIONS, httpOnly: false }); // roles可以被JS读取

      // 返回用户信息（不含密码）
      const safeUser = userRepo.toSafeUser(user);

      res.json({
        success: true,
        data: {
          user: safeUser,
          access_token: accessToken,
          refresh_token: refreshToken,
        },
      });
    } catch (error: any) {
      console.error('[AuthController] 登录失败:', error.message);
      next(error);
    }
  }

  /**
   * 刷新Token
   * POST /api/auth/refresh
   */
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // 艹，从Cookie获取refresh token
      const refreshToken = req.cookies?.refresh_token;

      if (!refreshToken) {
        res.status(401).json({
          success: false,
          error: {
            code: 'NO_REFRESH_TOKEN',
            message: '未找到刷新Token',
          },
        });
        return;
      }

      // 验证refresh token
      let payload;
      try {
        payload = verifyToken(refreshToken);
      } catch (error: any) {
        res.status(401).json({
          success: false,
          error: {
            code: 'REFRESH_TOKEN_INVALID',
            message: 'Refresh Token无效或已过期',
          },
        });
        return;
      }

      // 查找用户（确保用户仍然存在）
      const user = await userRepo.findUserById(payload.userId);
      if (!user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: '用户不存在',
          },
        });
        return;
      }

      // 艹，生成新的access token！
      const newAccessToken = generateAccessToken({
        userId: user.id,
        phone: user.phone,
        role: user.role,
      });

      // 可选：也刷新refresh token（滚动刷新策略）
      const newRefreshToken = generateRefreshToken({
        userId: user.id,
        phone: user.phone,
        role: user.role,
      });

      // 更新Cookie
      res.cookie('access_token', newAccessToken, COOKIE_OPTIONS);
      res.cookie('refresh_token', newRefreshToken, COOKIE_OPTIONS);
      res.cookie('roles', user.role, { ...COOKIE_OPTIONS, httpOnly: false });

      res.json({
        success: true,
        data: {
          access_token: newAccessToken,
          refresh_token: newRefreshToken,
        },
      });
    } catch (error: any) {
      console.error('[AuthController] 刷新Token失败:', error.message);
      next(error);
    }
  }

  /**
   * 用户登出
   * POST /api/auth/logout
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // 艹，清除所有Cookie！
      res.clearCookie('access_token', COOKIE_OPTIONS);
      res.clearCookie('refresh_token', COOKIE_OPTIONS);
      res.clearCookie('roles', { ...COOKIE_OPTIONS, httpOnly: false });

      res.json({
        success: true,
        message: '登出成功',
      });
    } catch (error: any) {
      console.error('[AuthController] 登出失败:', error.message);
      next(error);
    }
  }
}

export default new AuthController();
