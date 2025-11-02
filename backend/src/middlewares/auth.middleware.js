const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

/**
 * JWT认证中间件
 */
async function authenticate(req, res, next) {
  try {
    // 获取token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 1001,
          message: '未登录'
        }
      });
    }

    const token = authHeader.substring(7);

    // 验证token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 将用户信息附加到请求对象
    req.userId = decoded.userId;
    req.user = decoded;

    next();
  } catch (error) {
    logger.error('JWT验证失败:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 1001,
          message: '登录已过期,请重新登录'
        }
      });
    }

    return res.status(401).json({
      success: false,
      error: {
        code: 1001,
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
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = decoded.userId;
      req.user = decoded;
    }
    next();
  } catch (error) {
    // 可选认证失败不阻止请求继续
    next();
  }
}

/**
 * 管理员权限验证中间件 (P0-009)
 * 艹！直接从JWT读取role，不查数据库，性能杠杠的
 * 必须在authenticate中间件之后使用
 */
function requireAdmin(req, res, next) {
  try {
    // 检查是否已认证
    if (!req.user || !req.userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 4001,
          message: '未登录'
        }
      });
    }

    // 从JWT payload读取role（不查数据库！）
    const userRole = req.user.role || 'user';

    if (userRole !== 'admin') {
      logger.warn(`[requireAdmin] 非管理员尝试访问: userId=${req.userId}, role=${userRole}`);
      return res.status(403).json({
        success: false,
        error: {
          code: 4003,
          message: '无权访问,仅限管理员'
        }
      });
    }

    // 管理员验证通过
    next();
  } catch (error) {
    logger.error('[requireAdmin] 权限验证失败:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 9999,
        message: '服务器内部错误'
      }
    });
  }
}

module.exports = {
  authenticate,
  optionalAuthenticate,
  requireAdmin
};
