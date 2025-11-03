const logger = require('../utils/logger');
const unifiedLoginService = require('../services/unified-login.service');
const { body, validationResult } = require('express-validator');

/**
 * 统一登录控制器
 *
 * 处理所有登录相关的请求：
 * - 多种登录方式
 * - 用户注册
 * - 登录方式绑定/解绑
 * - 验证码发送
 * - 统一登录接口
 */
class UnifiedLoginController {
  /**
   * 获取可用的登录方式
   * GET /api/auth/login/methods
   */
  async getAvailableLoginMethods(req, res) {
    try {
      const methods = unifiedLoginService.getAvailableLoginMethods();

      res.json({
        success: true,
        data: methods,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[UnifiedLoginController] 获取登录方式失败:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_METHODS_ERROR',
          message: '获取登录方式失败'
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 统一登录接口
   * POST /api/auth/login
   */
  async unifiedLogin(req, res) {
    try {
      // 参数验证
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数验证失败',
            details: errors.array()
          }
        });
      }

      const { method, loginData } = req.body;

      // 根据登录方式调用不同的登录方法
      let result;
      switch (method) {
        case 'email':
          result = await unifiedLoginService.loginWithEmail(
            loginData.email,
            loginData.password
          );
          break;
        case 'phone':
          result = await unifiedLoginService.loginWithPhone(
            loginData.phone,
            loginData.verificationCode
          );
          break;
        case 'wechat':
          result = await unifiedLoginService.loginWithWechat(
            loginData.platform,
            loginData
          );
          break;
        default:
          return res.status(400).json({
            success: false,
            error: {
              code: 'UNSUPPORTED_METHOD',
              message: '不支持的登录方式'
            }
          });
      }

      res.json({
        success: true,
        data: result,
        message: '登录成功',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[UnifiedLoginController] 统一登录失败:', error);

      res.status(401).json({
        success: false,
        error: {
          code: 'LOGIN_ERROR',
          message: error.message || '登录失败'
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 用户注册
   * POST /api/auth/register
   */
  async register(req, res) {
    try {
      // 参数验证
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数验证失败',
            details: errors.array()
          }
        });
      }

      const { userData, loginMethod } = req.body;

      // 调用注册服务
      const result = await unifiedLoginService.registerUser(userData, loginMethod);

      res.status(201).json({
        success: true,
        data: result,
        message: '注册成功',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[UnifiedLoginController] 用户注册失败:', error);

      res.status(400).json({
        success: false,
        error: {
          code: 'REGISTER_ERROR',
          message: error.message || '注册失败'
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 发送手机验证码
   * POST /api/auth/verification/send
   */
  async sendVerificationCode(req, res) {
    try {
      // 参数验证
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数验证失败',
            details: errors.array()
          }
        });
      }

      const { phone } = req.body;

      // 发送验证码
      const result = await unifiedLoginService.sendPhoneVerificationCode(phone);

      res.json({
        success: true,
        data: result,
        message: '验证码发送成功',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[UnifiedLoginController] 发送验证码失败:', error);

      res.status(400).json({
        success: false,
        error: {
          code: 'SEND_VERIFICATION_ERROR',
          message: error.message || '发送验证码失败'
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 绑定登录方式
   * POST /api/auth/bind-method
   */
  async bindLoginMethod(req, res) {
    try {
      // 参数验证
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数验证失败',
            details: errors.array()
          }
        });
      }

      const userId = req.user.id;
      const { type, value, password } = req.body;

      // 绑定登录方式
      const result = await unifiedLoginService.bindLoginMethod(userId, {
        type,
        value,
        password
      });

      res.json({
        success: true,
        data: result,
        message: result.message,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[UnifiedLoginController] 绑定登录方式失败:', error);

      res.status(400).json({
        success: false,
        error: {
          code: 'BIND_METHOD_ERROR',
          message: error.message || '绑定登录方式失败'
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 解除登录方式绑定
   * DELETE /api/auth/bind-method
   */
  async unbindLoginMethod(req, res) {
    try {
      // 参数验证
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数验证失败',
            details: errors.array()
          }
        });
      }

      const userId = req.user.id;
      const { type } = req.body;

      // 解除绑定
      const result = await unifiedLoginService.unbindLoginMethod(userId, type);

      res.json({
        success: true,
        data: result,
        message: result.message,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[UnifiedLoginController] 解除登录方式绑定失败:', error);

      res.status(400).json({
        success: false,
        error: {
          code: 'UNBIND_METHOD_ERROR',
          message: error.message || '解除登录方式绑定失败'
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 获取用户登录方式信息
   * GET /api/auth/bindings
   */
  async getUserLoginMethods(req, res) {
    try {
      const userId = req.user.id;

      // 获取登录方式信息
      const methods = await unifiedLoginService.getUserLoginMethods(userId);

      res.json({
        success: true,
        data: methods,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[UnifiedLoginController] 获取用户登录方式信息失败:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_BINDINGS_ERROR',
          message: '获取登录方式信息失败'
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 邮箱登录
   * POST /api/auth/login/email
   */
  async loginWithEmail(req, res) {
    try {
      // 参数验证
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数验证失败',
            details: errors.array()
          }
        });
      }

      const { email, password } = req.body;

      // 邮箱登录
      const result = await unifiedLoginService.loginWithEmail(email, password);

      res.json({
        success: true,
        data: result,
        message: '登录成功',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[UnifiedLoginController] 邮箱登录失败:', error);

      res.status(401).json({
        success: false,
        error: {
          code: 'EMAIL_LOGIN_ERROR',
          message: error.message || '邮箱登录失败'
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 手机号登录
   * POST /api/auth/login/phone
   */
  async loginWithPhone(req, res) {
    try {
      // 参数验证
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数验证失败',
            details: errors.array()
          }
        });
      }

      const { phone, verificationCode } = req.body;

      // 手机号登录
      const result = await unifiedLoginService.loginWithPhone(phone, verificationCode);

      res.json({
        success: true,
        data: result,
        message: '登录成功',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[UnifiedLoginController] 手机号登录失败:', error);

      res.status(401).json({
        success: false,
        error: {
          code: 'PHONE_LOGIN_ERROR',
          message: error.message || '手机号登录失败'
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 获取统一登录统计信息
   * GET /api/auth/stats
   */
  async getUnifiedLoginStats(req, res) {
    try {
      const stats = unifiedLoginService.getStats();

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[UnifiedLoginController] 获取统一登录统计失败:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_STATS_ERROR',
          message: '获取统计信息失败'
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 登出接口
   * POST /api/auth/logout
   */
  async logout(req, res) {
    try {
      // TODO: 实现登出逻辑
      // 1. 将access_token加入黑名单
      // 2. 清除用户会话缓存
      // 3. 记录登出日志

      const userId = req.user.id;

      logger.info(`[UnifiedLoginController] 用户登出: userId=${userId}`);

      res.json({
        success: true,
        message: '登出成功',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[UnifiedLoginController] 登出失败:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'LOGOUT_ERROR',
          message: '登出失败'
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 刷新令牌接口
   * POST /api/auth/refresh
   */
  async refreshToken(req, res) {
    try {
      // 参数验证
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求参数验证失败',
            details: errors.array()
          }
        });
      }

      const { refreshToken } = req.body;

      // TODO: 实现令牌刷新逻辑
      // 1. 验证refresh token
      // 2. 检查token是否在黑名单中
      // 3. 生成新的access token
      // 4. 返回新的token对

      logger.info('[UnifiedLoginController] 刷新令牌请求');

      res.json({
        success: true,
        message: '令牌刷新功能开发中',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[UnifiedLoginController] 刷新令牌失败:', error);

      res.status(401).json({
        success: false,
        error: {
          code: 'REFRESH_TOKEN_ERROR',
          message: '刷新令牌失败'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
}

module.exports = new UnifiedLoginController();