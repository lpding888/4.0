/**
 * Auth Controller
 * 艹，这个tm负责所有认证相关操作！登录、注册、刷新、登出！
 */

import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import * as userRepo from '../repositories/users.repo.js';
import authService from '../services/auth.service.js';
import tokenService from '../services/token.service.js';
import { verifyToken } from '../utils/jwt.js';
import cacheService from '../services/cache.service.js';

/**
 * Cookie配置
 * 艹，httpOnly防止XSS攻击！secure在生产环境启用！
 */
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // 生产环境用HTTPS
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7天
};

export class AuthController {
  /**
   * 发送验证码
   * POST /api/auth/send-code
   */
  async sendCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone } = req.body as { phone?: string };
      if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
        res.status(400).json({ success: false, error: { code: 2000, message: '手机号格式错误' } });
        return;
      }
      const ip = (req.ip || (req.socket?.remoteAddress ?? '')) as string;
      const result = await authService.sendCode(phone, ip);
      res.json({ success: true, data: result, message: '验证码已发送' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 发送邮箱验证码
   * POST /api/auth/email/send-code
   */
  async sendEmailCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body as { email?: string };
      if (!email) {
        res.status(400).json({
          success: false,
          error: {
            code: 'EMAIL_REQUIRED',
            message: '邮箱不能为空'
          }
        });
        return;
      }
      const ip = (req.ip || (req.socket?.remoteAddress ?? '')) as string;
      const result = await authService.sendEmailCode(email, ip);
      res.json({ success: true, data: result, message: '验证码已发送' });
    } catch (error) {
      next(error);
    }
  }

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
            message: '手机号和密码不能为空'
          }
        });
        return;
      }

      // 手机号格式校验
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '手机号格式不正确'
          }
        });
        return;
      }

      // 密码长度校验
      if (password.length < 6) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '密码长度不能少于6位'
          }
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
            message: '手机号已被注册'
          }
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
        referrer_id: referrer_id || null
      });

      // 生成Token
      const { accessToken, refreshToken } = tokenService.generateTokenPair({
        id: user.id,
        phone: user.phone ?? undefined,
        role: user.role
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
          refresh_token: refreshToken
        }
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[AuthController] 注册失败:', err.message);
      next(error);
    }
  }

  /**
   * 邮箱注册
   * POST /api/auth/email/register
   */
  async registerWithEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, code, password, referrer_id } = req.body as {
        email?: string;
        code?: string;
        password?: string;
        referrer_id?: string | null;
      };

      if (!email || !code || !password) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '邮箱、验证码和密码不能为空'
          }
        });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PASSWORD',
            message: '密码长度不能少于6位'
          }
        });
        return;
      }

      const result = await authService.registerWithEmail(
        email,
        code,
        password,
        referrer_id ?? null
      );

      res.cookie('access_token', result.accessToken, COOKIE_OPTIONS);
      res.cookie('refresh_token', result.refreshToken, COOKIE_OPTIONS);
      res.cookie('roles', result.user.role, { ...COOKIE_OPTIONS, httpOnly: false });

      res.status(201).json({
        success: true,
        data: {
          user: result.user,
          access_token: result.accessToken,
          refresh_token: result.refreshToken
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 用户登录
   * POST /api/auth/login
   */
  async loginPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone, password } = req.body;

      // 艹，基础校验
      if (!phone || !password) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '手机号和密码不能为空'
          }
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
            message: '手机号或密码错误'
          }
        });
        return;
      }

      // 艹，验证密码！
      if (!user.password) {
        res.status(401).json({
          success: false,
          error: {
            code: 'PASSWORD_NOT_SET',
            message: '该账号未设置密码，请联系管理员'
          }
        });
        return;
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: '手机号或密码错误'
          }
        });
        return;
      }

      // 生成Token
      const { accessToken, refreshToken } = tokenService.generateTokenPair({
        id: user.id,
        phone: user.phone ?? undefined,
        role: user.role
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
          refresh_token: refreshToken
        }
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[AuthController] 登录失败:', err.message);
      next(error);
    }
  }

  /**
   * 邮箱验证码登录
   * POST /api/auth/email/login
   */
  async loginWithEmailCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, code, referrer_id } = req.body as {
        email?: string;
        code?: string;
        referrer_id?: string | null;
      };

      if (!email || !code) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '邮箱和验证码不能为空'
          }
        });
        return;
      }

      const result = await authService.loginWithEmailCode(email, code, referrer_id ?? null);

      res.cookie('access_token', result.accessToken, COOKIE_OPTIONS);
      res.cookie('refresh_token', result.refreshToken, COOKIE_OPTIONS);
      res.cookie('roles', result.user.role, { ...COOKIE_OPTIONS, httpOnly: false });

      res.json({
        success: true,
        data: {
          user: result.user,
          access_token: result.accessToken,
          refresh_token: result.refreshToken
        }
      });
    } catch (error) {
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
            message: '未找到刷新Token'
          }
        });
        return;
      }

      // 验证refresh token
      let payload;
      try {
        payload = verifyToken(refreshToken);
      } catch (error: unknown) {
        res.status(401).json({
          success: false,
          error: {
            code: 'REFRESH_TOKEN_INVALID',
            message: 'Refresh Token无效或已过期'
          }
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
            message: '用户不存在'
          }
        });
        return;
      }

      // 统一通过token服务刷新
      const pair = await tokenService.refreshTokens(refreshToken);
      if (!pair) {
        res.status(401).json({
          success: false,
          error: { code: 'REFRESH_TOKEN_INVALID', message: 'Refresh Token无效或已过期' }
        });
        return;
      }

      // 更新Cookie
      res.cookie('access_token', pair.accessToken, COOKIE_OPTIONS);
      res.cookie('refresh_token', pair.refreshToken, COOKIE_OPTIONS);
      res.cookie('roles', user.role, { ...COOKIE_OPTIONS, httpOnly: false });

      res.json({
        success: true,
        data: {
          access_token: pair.accessToken,
          refresh_token: pair.refreshToken
        }
      });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[AuthController] 刷新Token失败:', err.message);
      next(error);
    }
  }

  /**
   * 用户登出
   * POST /api/auth/logout
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // 清除Cookie
      res.clearCookie('access_token', COOKIE_OPTIONS);
      res.clearCookie('refresh_token', COOKIE_OPTIONS);
      res.clearCookie('roles', { ...COOKIE_OPTIONS, httpOnly: false });

      res.json({ success: true, message: '登出成功' });
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[AuthController] 登出失败:', err.message);
      next(error);
    }
  }

  /**
   * 验证码登录
   * POST /api/auth/login
   */
  async loginCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone, code, referrer_id } = req.body as {
        phone?: string;
        code?: string;
        referrer_id?: string | null;
      };
      if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
        res.status(400).json({ success: false, error: { code: 2000, message: '手机号格式错误' } });
        return;
      }
      if (!code || !/^\d{6}$/.test(code)) {
        res.status(400).json({ success: false, error: { code: 2002, message: '验证码格式错误' } });
        return;
      }
      const result = await authService.loginWithCode(phone, code, referrer_id ?? null);
      res.cookie('access_token', result.accessToken, COOKIE_OPTIONS);
      res.cookie('refresh_token', result.refreshToken, COOKIE_OPTIONS);
      res.cookie('roles', result.user.role, { ...COOKIE_OPTIONS, httpOnly: false });
      res.json({
        success: true,
        data: {
          user: result.user,
          access_token: result.accessToken,
          refresh_token: result.refreshToken
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 邮箱验证码登录
   * POST /api/auth/login/email
   * 艹，用邮箱验证码登录，首次登录自动注册！
   */
  async loginEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.loginWithEmailCode(req, res, next);
  }

  /**
   * 获取当前用户信息（需要认证）
   * GET /api/auth/me
   */
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId =
        (req as unknown as { userId?: string }).userId ??
        (req.user as { id?: string } | undefined)?.id;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } });
        return;
      }
      const user = await authService.getUser(userId);
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 验证Token状态（需要认证）
   * GET /api/auth/verify
   */
  async verify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.user as { id?: string } | undefined)?.id as string | undefined;
      const jti = (req.user as { jti?: string } | undefined)?.jti as string | undefined;
      if (!userId) {
        res
          .status(401)
          .json({ success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } });
        return;
      }
      const ok = await authService.verifyTokenStatus(userId, jti);
      const getTokenRemainingTime = (
        tokenService as unknown as { getTokenRemainingTime?: (token: unknown) => unknown }
      ).getTokenRemainingTime;
      const token = (req as unknown as { token?: unknown }).token;
      const iat = (req.user as { iat?: unknown } | undefined)?.iat;
      const exp = (req.user as { exp?: unknown } | undefined)?.exp;
      res.json({
        success: ok,
        data: {
          user: req.user,
          remainingTime: getTokenRemainingTime?.(token) ?? null,
          iat,
          exp
        },
        message: ok ? 'Token有效' : 'Token无效'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 设置/修改密码
   * POST /api/auth/set-password
   * 艹！用户首次设置密码或修改密码！
   */
  async setPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { newPassword, oldPassword } = req.body;
      const userId = (req.user as { userId?: string } | undefined)?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: '未登录' }
        });
        return;
      }

      if (!newPassword || newPassword.length < 6) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_PASSWORD', message: '密码至少6位' }
        });
        return;
      }

      const user = await userRepo.findUserById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: '用户不存在' }
        });
        return;
      }

      // 如果已有密码，需要验证旧密码
      if (user.password) {
        if (!oldPassword) {
          res.status(400).json({
            success: false,
            error: { code: 'OLD_PASSWORD_REQUIRED', message: '请输入旧密码' }
          });
          return;
        }
        const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
        if (!isOldPasswordValid) {
          res.status(400).json({
            success: false,
            error: { code: 'INVALID_OLD_PASSWORD', message: '旧密码错误' }
          });
          return;
        }
      }

      // 设置新密码
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await userRepo.updateUser(userId, { password: hashedPassword });

      res.json({
        success: true,
        message: user.password ? '密码修改成功' : '密码设置成功'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 重置密码
   * POST /api/auth/reset-password
   * 艹！忘记密码用验证码重置！
   */
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone, email, code, newPassword } = req.body as {
        phone?: string;
        email?: string;
        code?: string;
        newPassword?: string;
      };

      if (!code || !newPassword || (!phone && !email)) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_PARAMS', message: '缺少必要参数' }
        });
        return;
      }

      if (newPassword.length < 6) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_PASSWORD', message: '密码至少6位' }
        });
        return;
      }

      if (email) {
        await authService.resetPasswordWithEmail(email, code, newPassword);
        res.json({
          success: true,
          message: '密码重置成功'
        });
        return;
      }

      if (!phone) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_PARAMS', message: '请提供手机号或邮箱' }
        });
        return;
      }

      const cachedCode = await cacheService.get<string>(`sms:${phone}`);
      if (!cachedCode || cachedCode !== code) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_CODE', message: '验证码错误或已过期' }
        });
        return;
      }

      const user = await userRepo.findUserByPhone(phone);
      if (!user) {
        res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: '用户不存在' }
        });
        return;
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await userRepo.updateUser(user.id, { password: hashedPassword });
      await cacheService.delete(`sms:${phone}`);

      res.json({
        success: true,
        message: '密码重置成功'
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new AuthController();
