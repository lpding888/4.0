const jwt = require('jsonwebtoken');
const tokenService = require('../services/token.service');
const logger = require('../utils/logger');

/**
 * JWT认证中间件 - 支持双Token机制
 */
async function authenticate(req, res, next) {
  try {
    // 获取token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '未登录或Token格式错误'
        }
      });
    }

    const token = authHeader.substring(7);
    req.token = token; // 保存原始token供其他中间件使用

    // 验证Access Token
    const decoded = tokenService.verifyAccessToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token无效'
        }
      });
    }

    // 检查Token是否在黑名单中
    const isBlacklisted = await tokenService.isTokenBlacklisted(decoded.jti);
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_BLACKLISTED',
          message: 'Token已失效'
        }
      });
    }

    // 检查用户是否被撤销
    const isRevoked = await tokenService.isUserRevoked(decoded.uid);
    if (isRevoked) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_REVOKED',
          message: '用户登录状态已失效'
        }
      });
    }

    // 将用户信息附加到请求对象
    req.userId = decoded.uid;
    req.user = decoded;

    logger.debug(`[AuthMiddleware] 用户认证成功: userId=${decoded.uid}, role=${decoded.role}`);
    next();

  } catch (error) {
    logger.error('JWT验证失败:', error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: '登录已过期，请刷新Token或重新登录'
        }
      });
    }

    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Token无效'
      }
    });
  }
}

/**
 * 可选认证中间件(用于某些接口既可登录也可不登录访问)
 */
async function optionalAuthenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      req.token = token;

      // 尝试验证token
      const decoded = tokenService.verifyAccessToken(token);
      if (decoded) {
        // 检查黑名单和撤销状态
        const isBlacklisted = await tokenService.isTokenBlacklisted(decoded.jti);
        const isRevoked = await tokenService.isUserRevoked(decoded.uid);

        if (!isBlacklisted && !isRevoked) {
          req.userId = decoded.uid;
          req.user = decoded;
        }
      }
    }
    next();
  } catch (error) {
    // 可选认证失败不阻止请求继续
    logger.debug('可选认证失败:', error.message);
    next();
  }
}

/**
 * 角色权限检查中间件
 * @param {string|string[]} requiredRoles - 需要的角色
 * @returns {Function} 中间件函数
 */
function requireRole(requiredRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '未登录'
        }
      });
    }

    const userRole = req.user.role;
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: '权限不足'
        }
      });
    }

    logger.debug(`[AuthMiddleware] 权限检查通过: userId=${req.user.uid}, role=${userRole}, required=${roles.join(',')}`);
    next();
  };
}

/**
 * 管理员权限检查
 */
const requireAdmin = requireRole(['admin']);

/**
 * 用户或管理员权限检查
 */
const requireUserOrAdmin = requireRole(['user', 'admin']);

/**
 * API Key认证中间件（用于系统间调用）
 */
async function authenticateApiKey(req, res, next) {
  try {
    const apiKey = req.headers['x-api-key'];
    const validApiKeys = process.env.VALID_API_KEYS ? process.env.VALID_API_KEYS.split(',') : [];

    if (!apiKey || !validApiKeys.includes(apiKey)) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'API Key无效'
        }
      });
    }

    // 设置系统用户标识
    req.user = {
      uid: 'system',
      role: 'system',
      source: 'api_key'
    };
    req.userId = 'system';

    logger.debug('[AuthMiddleware] API Key认证成功');
    next();

  } catch (error) {
    logger.error('API Key认证失败:', error);
    return res.status(401).json({
      success: false,
      error: {
        code: 'API_KEY_AUTH_FAILED',
        message: 'API Key认证失败'
      }
    });
  }
}

module.exports = {
  authenticate,
  optionalAuthenticate,
  requireRole,
  requireAdmin,
  requireUserOrAdmin,
  authenticateApiKey
};