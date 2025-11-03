const authService = require('../services/auth.service');
const tokenService = require('../services/token.service');
const logger = require('../utils/logger');

/**
 * 认证控制器
 */
class AuthController {
  /**
   * 发送验证码
   * POST /api/auth/send-code
   */
  async sendCode(req, res, next) {
    try {
      const { phone } = req.body;

      // 参数验证
      if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 2000,
            message: '手机号格式错误'
          }
        });
      }

      const ip = req.ip || req.connection.remoteAddress;
      const result = await authService.sendCode(phone, ip);

      res.json({
        success: true,
        data: result,
        message: '验证码已发送'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 登录/注册
   * POST /api/auth/login
   */
  async login(req, res, next) {
    try {
      const { phone, code } = req.body;

      // 参数验证
      if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 2000,
            message: '手机号格式错误'
          }
        });
      }

      if (!code || !/^\d{6}$/.test(code)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 2002,
            message: '验证码格式错误'
          }
        });
      }

      const result = await authService.login(phone, code);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取当前用户信息
   * GET /api/auth/me
   */
  async getMe(req, res, next) {
    try {
      const userId = req.userId;
      const user = await authService.getUser(userId);

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 刷新Token
   * POST /api/auth/refresh
   */
  async refresh(req, res, next) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REFRESH_TOKEN',
            message: '缺少Refresh Token'
          }
        });
      }

      // 刷新Token
      const newTokens = await tokenService.refreshTokens(refreshToken);

      if (!newTokens) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: '无效的Refresh Token'
          }
        });
      }

      res.json({
        success: true,
        data: newTokens,
        message: 'Token刷新成功'
      });

      logger.info(`[AuthController] Token刷新成功`);

    } catch (error) {
      logger.error(`[AuthController] Token刷新失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 登出（撤销Token）
   * POST /api/auth/logout
   */
  async logout(req, res, next) {
    try {
      const userId = req.userId;
      const refreshToken = req.body?.refreshToken;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '未授权'
          }
        });
      }

      // 撤销用户的所有Token
      await tokenService.revokeUserTokens(userId);

      // 如果提供了Refresh Token，也将其加入黑名单
      if (refreshToken) {
        try {
          const decoded = tokenService.verifyRefreshToken(refreshToken);
          if (decoded && decoded.jti) {
            await tokenService.addToBlacklist(decoded.jti);
          }
        } catch (error) {
          logger.warn(`[AuthController] 登出时验证Refresh Token失败: ${error.message}`);
        }
      }

      res.json({
        success: true,
        message: '登出成功'
      });

      logger.info(`[AuthController] 用户登出成功: userId=${userId}`);

    } catch (error) {
      logger.error(`[AuthController] 登出失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 验证Token状态
   * GET /api/auth/verify
   */
  async verify(req, res, next) {
    try {
      const user = req.user;
      const remainingTime = tokenService.getTokenRemainingTime(req.token);

      res.json({
        success: true,
        data: {
          user: {
            uid: user.uid,
            role: user.role,
            phone: user.phone
          },
          remainingTime, // 剩余秒数
          iat: user.iat,
          exp: user.exp
        },
        message: 'Token有效'
      });

    } catch (error) {
      logger.error(`[AuthController] Token验证失败: ${error.message}`, error);
      next(error);
    }
  }
}

module.exports = new AuthController();
