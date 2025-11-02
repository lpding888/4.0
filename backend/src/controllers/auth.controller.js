const authService = require('../services/auth.service');
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
   * 微信登录 (P0-006)
   * POST /api/auth/wechat-login
   */
  async wechatLogin(req, res, next) {
    try {
      const { code } = req.body;

      // 参数验证
      if (!code) {
        return res.status(400).json({
          success: false,
          error: {
            code: 2000,
            message: '微信code不能为空'
          }
        });
      }

      const result = await authService.wechatLogin(code);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 密码登录 (P0-007)
   * POST /api/auth/password-login
   */
  async passwordLogin(req, res, next) {
    try {
      const { phone, password } = req.body;

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

      if (!password) {
        return res.status(400).json({
          success: false,
          error: {
            code: 2003,
            message: '密码不能为空'
          }
        });
      }

      const result = await authService.passwordLogin(phone, password);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 设置/修改密码 (P0-007)
   * POST /api/auth/set-password
   */
  async setPassword(req, res, next) {
    try {
      const userId = req.userId; // 从认证中间件获取
      const { newPassword, oldPassword } = req.body;

      // 参数验证
      if (!newPassword) {
        return res.status(400).json({
          success: false,
          error: {
            code: 2003,
            message: '新密码不能为空'
          }
        });
      }

      const result = await authService.setPassword(userId, newPassword, oldPassword);

      res.json({
        success: true,
        data: result,
        message: '密码设置成功'
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
}

module.exports = new AuthController();
