/**
 * Users Controller
 * 艹，这个tm负责用户相关操作！
 */

import { Request, Response, NextFunction } from 'express';
import * as userRepo from '../repositories/users.repo';

export class UsersController {
  /**
   * 获取当前登录用户信息
   * GET /api/users/me
   * 艹，这个接口必须登录才能访问！
   */
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // req.user 由 authenticate 中间件注入
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

      // 从数据库获取最新用户信息
      const user = await userRepo.findUserById(req.user.userId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: '用户不存在',
          },
        });
        return;
      }

      // 返回安全的用户信息（不含密码）
      const safeUser = userRepo.toSafeUser(user);

      res.json({
        success: true,
        data: safeUser,
      });
    } catch (error: any) {
      console.error('[UsersController] 获取当前用户失败:', error.message);
      next(error);
    }
  }

  /**
   * 更新当前用户信息
   * PUT /api/users/me
   * 艹，这个接口用于用户更新自己的资料！
   */
  async updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
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

      // 艹，只允许更新部分字段！
      const allowedFields = ['phone']; // 可扩展：nickname, avatar等
      const updates: any = {};

      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      // 如果没有任何更新
      if (Object.keys(updates).length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'NO_UPDATES',
            message: '没有可更新的字段',
          },
        });
        return;
      }

      // 手机号格式校验（如果更新手机号）
      if (updates.phone && !/^1[3-9]\d{9}$/.test(updates.phone)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PHONE',
            message: '手机号格式不正确',
          },
        });
        return;
      }

      // 检查手机号是否被其他用户使用
      if (updates.phone) {
        const existingUser = await userRepo.findUserByPhone(updates.phone);
        if (existingUser && existingUser.id !== req.user.userId) {
          res.status(409).json({
            success: false,
            error: {
              code: 'PHONE_EXISTS',
              message: '手机号已被其他用户使用',
            },
          });
          return;
        }
      }

      // 更新用户
      const updatedUser = await userRepo.updateUser(req.user.userId, updates);

      const safeUser = userRepo.toSafeUser(updatedUser);

      res.json({
        success: true,
        data: safeUser,
      });
    } catch (error: any) {
      console.error('[UsersController] 更新当前用户失败:', error.message);
      next(error);
    }
  }
}

export default new UsersController();
