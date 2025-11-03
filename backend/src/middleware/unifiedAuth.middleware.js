const jwt = require('jsonwebtoken');
const tokenService = require('../services/token.service');
const permissionService = require('../services/permission.service');
const logger = require('../utils/logger');

/**
 * 统一认证中间件
 *
 * 提供完整的认证和授权功能：
 * - JWT令牌验证
 * - 双Token支持
 * - RBAC权限控制
 * - API Key认证
 * - 会话管理
 * - 安全增强
 */
class UnifiedAuthMiddleware {
  constructor() {
    this.initialized = false;
    this.config = {
      // Token配置
      tokenHeader: 'authorization',
      tokenPrefix: 'Bearer ',
      apiKeyHeader: 'x-api-key',

      // 缓存配置
      sessionCache: true,
      sessionTTL: 300, // 5分钟

      // 安全配置
      maxFailedAttempts: 5,
      lockoutDuration: 15 * 60 * 1000, // 15分钟
      requireIP: false,

      // 监控配置
      auditEnabled: true,
      metricsEnabled: true
    };

    // 失败尝试计数器
    this.failedAttempts = new Map();

    // 统计信息
    this.stats = {
      totalRequests: 0,
      successfulAuth: 0,
      failedAuth: 0,
      blockedRequests: 0,
      lastReset: Date.now()
    };
  }

  /**
   * 初始化认证中间件
   */
  async initialize() {
    if (this.initialized) {
      logger.warn('[UnifiedAuth] 认证中间件已初始化');
      return;
    }

    try {
      // 确保权限服务已初始化
      await permissionService.initialize();

      this.initialized = true;
      logger.info('[UnifiedAuth] 统一认证中间件初始化成功');

    } catch (error) {
      logger.error('[UnifiedAuth] 认证中间件初始化失败:', error);
      throw error;
    }
  }

  /**
   * 主要认证中间件
   */
  authenticate() {
    return async (req, res, next) => {
      const startTime = Date.now();
      this.stats.totalRequests++;

      try {
        // 检查IP限制
        if (this.config.requireIP && this.isBlockedIP(req.ip)) {
          return this.blockedResponse(req, res, 'IP已被封禁');
        }

        // 获取认证信息
        const authResult = await this.extractAuthInfo(req);

        if (!authResult.success) {
          return this.authErrorResponse(res, authResult.error);
        }

        // 验证认证信息
        const validationResult = await this.validateAuth(authResult, req);

        if (!validationResult.success) {
          return this.authErrorResponse(res, validationResult.error);
        }

        // 设置用户信息
        this.setUserInfo(req, validationResult.user);

        // 记录成功认证
        this.stats.successfulAuth++;
        this.recordAuthSuccess(validationResult.user, req);

        // 添加审计信息
        req.authInfo = {
          type: authResult.type,
          authenticatedAt: new Date(),
          duration: Date.now() - startTime,
          permissions: validationResult.permissions || []
        };

        logger.debug(`[UnifiedAuth] 认证成功: userId=${validationResult.user.uid}, type=${authResult.type}`);
        next();

      } catch (error) {
        this.stats.failedAuth++;
        logger.error('[UnifiedAuth] 认证中间件异常:', error);

        return res.status(500).json({
          success: false,
          error: {
            code: 'AUTH_INTERNAL_ERROR',
            message: '认证服务内部错误'
          }
        });
      }
    };
  }

  /**
   * 可选认证中间件
   */
  optionalAuthenticate() {
    return async (req, res, next) => {
      try {
        const authResult = await this.extractAuthInfo(req);

        if (authResult.success) {
          const validationResult = await this.validateAuth(authResult, req);

          if (validationResult.success) {
            this.setUserInfo(req, validationResult.user);
            req.authInfo = {
              type: authResult.type,
              authenticatedAt: new Date(),
              optional: true
            };
          }
        }

        next();

      } catch (error) {
        // 可选认证失败不阻止请求
        logger.debug('[UnifiedAuth] 可选认证失败:', error.message);
        next();
      }
    };
  }

  /**
   * 权限检查中间件
   * @param {string|string[]} permissions - 需要的权限
   * @param {Object} options - 检查选项
   */
  requirePermissions(permissions, options = {}) {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return this.authErrorResponse(res, {
            code: 'UNAUTHORIZED',
            message: '未登录'
          });
        }

        const { requireAll = false, skipCache = false } = options;
        const userId = req.user.uid;
        const permissionArray = Array.isArray(permissions) ? permissions : [permissions];

        let hasPermission = false;

        if (requireAll) {
          // 需要所有权限
          hasPermission = await permissionService.hasAllPermissions(userId, permissionArray);
        } else {
          // 需要任一权限
          hasPermission = await permissionService.hasAnyPermission(userId, permissionArray);
        }

        if (!hasPermission) {
          this.recordPermissionDenied(req.user, permissionArray, req);

          return res.status(403).json({
            success: false,
            error: {
              code: 'INSUFFICIENT_PERMISSIONS',
              message: '权限不足',
              required: permissionArray,
              requireAll
            }
          });
        }

        // 记录权限检查成功
        this.recordPermissionSuccess(req.user, permissionArray, req);

        logger.debug(`[UnifiedAuth] 权限检查通过: userId=${userId}, permissions=${permissionArray.join(',')}`);
        next();

      } catch (error) {
        logger.error('[UnifiedAuth] 权限检查异常:', error);

        return res.status(500).json({
          success: false,
          error: {
            code: 'PERMISSION_CHECK_ERROR',
            message: '权限检查服务错误'
          }
        });
      }
    };
  }

  /**
   * 角色检查中间件
   * @param {string|string[]} roles - 需要的角色
   */
  requireRoles(roles) {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return this.authErrorResponse(res, {
            code: 'UNAUTHORIZED',
            message: '未登录'
          });
        }

        const userRoles = await permissionService.getUserRoles(req.user.uid);
        const requiredRoles = Array.isArray(roles) ? roles : [roles];

        const hasRole = requiredRoles.some(role => userRoles.includes(role));

        if (!hasRole) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'INSUFFICIENT_ROLE',
              message: '角色权限不足',
              required: requiredRoles,
              current: userRoles
            }
          });
        }

        logger.debug(`[UnifiedAuth] 角色检查通过: userId=${req.user.uid}, roles=${userRoles.join(',')}`);
        next();

      } catch (error) {
        logger.error('[UnifiedAuth] 角色检查异常:', error);

        return res.status(500).json({
          success: false,
          error: {
            code: 'ROLE_CHECK_ERROR',
            message: '角色检查服务错误'
          }
        });
      }
    };
  }

  /**
   * 用户资源所有权检查
   * @param {string} resourceParam - 资源ID参数名
   * @param {string} resourceType - 资源类型
   */
  requireOwnership(resourceParam = 'id', resourceType = 'resource') {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return this.authErrorResponse(res, {
            code: 'UNAUTHORIZED',
            message: '未登录'
          });
        }

        const resourceId = req.params[resourceParam];
        const userId = req.user.uid;

        // 管理员可以访问所有资源
        const userRoles = await permissionService.getUserRoles(userId);
        if (userRoles.includes('admin')) {
          return next();
        }

        // 检查资源所有权
        const isOwner = await this.checkResourceOwnership(userId, resourceId, resourceType);

        if (!isOwner) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'RESOURCE_ACCESS_DENIED',
              message: '无权访问此资源',
              resourceType,
              resourceId
            }
          });
        }

        next();

      } catch (error) {
        logger.error('[UnifiedAuth] 所有权检查异常:', error);

        return res.status(500).json({
          success: false,
          error: {
            code: 'OWNERSHIP_CHECK_ERROR',
            message: '资源所有权检查错误'
          }
        });
      }
    };
  }

  /**
   * 提取认证信息
   * @param {Object} req - 请求对象
   * @returns {Object} 认证结果
   * @private
   */
  async extractAuthInfo(req) {
    // 1. 检查Bearer Token
    const authHeader = req.headers[this.config.tokenHeader];
    if (authHeader && authHeader.startsWith(this.config.tokenPrefix)) {
      const token = authHeader.substring(this.config.tokenPrefix.length);
      return { success: true, type: 'jwt', token };
    }

    // 2. 检查API Key
    const apiKey = req.headers[this.config.apiKeyHeader];
    if (apiKey) {
      return { success: true, type: 'api_key', apiKey };
    }

    // 3. 检查查询参数中的Token（仅用于特定场景）
    const queryToken = req.query.token;
    if (queryToken && this.allowQueryParamToken(req)) {
      return { success: true, type: 'jwt_query', token: queryToken };
    }

    return { success: false, error: { code: 'NO_AUTH_CREDENTIALS', message: '缺少认证凭据' } };
  }

  /**
   * 验证认证信息
   * @param {Object} authResult - 认证结果
   * @param {Object} req - 请求对象
   * @returns {Object} 验证结果
   * @private
   */
  async validateAuth(authResult, req) {
    switch (authResult.type) {
      case 'jwt':
      case 'jwt_query':
        return await this.validateJWT(authResult.token, req);
      case 'api_key':
        return await this.validateApiKey(authResult.apiKey, req);
      default:
        return { success: false, error: { code: 'UNSUPPORTED_AUTH_TYPE', message: '不支持的认证类型' } };
    }
  }

  /**
   * 验证JWT令牌
   * @param {string} token - JWT令牌
   * @param {Object} req - 请求对象
   * @returns {Object} 验证结果
   * @private
   */
  async validateJWT(token, req) {
    try {
      // 验证Access Token
      const decoded = tokenService.verifyAccessToken(token);
      if (!decoded) {
        return { success: false, error: { code: 'INVALID_TOKEN', message: 'Token无效' } };
      }

      // 检查Token是否在黑名单中
      const isBlacklisted = await tokenService.isTokenBlacklisted(decoded.jti);
      if (isBlacklisted) {
        return { success: false, error: { code: 'TOKEN_BLACKLISTED', message: 'Token已失效' } };
      }

      // 检查用户是否被撤销
      const isRevoked = await tokenService.isUserRevoked(decoded.uid);
      if (isRevoked) {
        return { success: false, error: { code: 'USER_REVOKED', message: '用户登录状态已失效' } };
      }

      // 获取用户权限
      const permissions = await permissionService.getUserPermissions(decoded.uid);

      return {
        success: true,
        user: decoded,
        permissions,
        tokenType: 'access_token'
      };

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return { success: false, error: { code: 'TOKEN_EXPIRED', message: '登录已过期，请刷新Token或重新登录' } };
      }

      return { success: false, error: { code: 'INVALID_TOKEN', message: 'Token无效' } };
    }
  }

  /**
   * 验证API Key
   * @param {string} apiKey - API密钥
   * @param {Object} req - 请求对象
   * @returns {Object} 验证结果
   * @private
   */
  async validateApiKey(apiKey, req) {
    const validApiKeys = process.env.VALID_API_KEYS ? process.env.VALID_API_KEYS.split(',') : [];

    if (!validApiKeys.includes(apiKey)) {
      return { success: false, error: { code: 'INVALID_API_KEY', message: 'API Key无效' } };
    }

    // 设置系统用户标识
    const systemUser = {
      uid: 'system',
      role: 'system',
      source: 'api_key',
      permissions: await permissionService.getUserPermissions('system')
    };

    return {
      success: true,
      user: systemUser,
      permissions: systemUser.permissions,
      tokenType: 'api_key'
    };
  }

  /**
   * 设置用户信息到请求对象
   * @param {Object} req - 请求对象
   * @param {Object} user - 用户信息
   * @private
   */
  setUserInfo(req, user) {
    req.user = user;
    req.userId = user.uid;
    req.userRoles = [user.role]; // 基础角色
  }

  /**
   * 检查资源所有权
   * @param {string} userId - 用户ID
   * @param {string} resourceId - 资源ID
   * @param {string} resourceType - 资源类型
   * @returns {Promise<boolean>} 是否拥有资源
   * @private
   */
  async checkResourceOwnership(userId, resourceId, resourceType) {
    try {
      const db = require('../config/database');

      switch (resourceType) {
        case 'task':
          const task = await db('tasks').where('id', resourceId).select('user_id').first();
          return task && task.user_id === userId;

        case 'asset':
          const asset = await db('assets').where('id', resourceId).select('user_id').first();
          return asset && asset.user_id === userId;

        case 'notification':
          const notification = await db('notifications').where('id', resourceId).select('user_id').first();
          return notification && notification.user_id === userId;

        default:
          logger.warn(`[UnifiedAuth] 未知的资源类型: ${resourceType}`);
          return false;
      }

    } catch (error) {
      logger.error(`[UnifiedAuth] 检查资源所有权失败: ${resourceType}:${resourceId}`, error);
      return false;
    }
  }

  /**
   * 允许查询参数Token的请求
   * @param {Object} req - 请求对象
   * @returns {boolean} 是否允许
   * @private
   */
  allowQueryParamToken(req) {
    // 仅在特定场景下允许查询参数Token，如WebSocket连接、文件下载等
    const allowedPaths = ['/ws', '/download', '/webhook'];
    return allowedPaths.some(path => req.path.startsWith(path));
  }

  /**
   * 检查IP是否被封禁
   * @param {string} ip - IP地址
   * @returns {boolean} 是否被封禁
   * @private
   */
  isBlockedIP(ip) {
    const attempts = this.failedAttempts.get(ip) || { count: 0, lastAttempt: 0 };
    const now = Date.now();

    // 检查是否在封禁期内
    if (attempts.count >= this.config.maxFailedAttempts &&
        now - attempts.lastAttempt < this.config.lockoutDuration) {
      return true;
    }

    // 重置过期的封禁记录
    if (now - attempts.lastAttempt > this.config.lockoutDuration) {
      this.failedAttempts.delete(ip);
    }

    return false;
  }

  /**
   * 认证错误响应
   * @param {Object} res - 响应对象
   * @param {Object} error - 错误信息
   * @private
   */
  authErrorResponse(res, error) {
    const response = {
      success: false,
      error,
      timestamp: new Date().toISOString()
    };

    // 根据错误类型返回相应的HTTP状态码
    const statusCodeMap = {
      'UNAUTHORIZED': 401,
      'TOKEN_EXPIRED': 401,
      'TOKEN_BLACKLISTED': 401,
      'USER_REVOKED': 401,
      'INVALID_TOKEN': 401,
      'INVALID_API_KEY': 401,
      'INSUFFICIENT_PERMISSIONS': 403,
      'INSUFFICIENT_ROLE': 403,
      'RESOURCE_ACCESS_DENIED': 403,
      'NO_AUTH_CREDENTIALS': 401
    };

    const statusCode = statusCodeMap[error.code] || 401;
    return res.status(statusCode).json(response);
  }

  /**
   * 封禁响应
   * @param {Object} res - 响应对象
   * @param {string} message - 错误消息
   * @private
   */
  blockedResponse(res, message) {
    return res.status(429).json({
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message,
        retryAfter: Math.ceil(this.config.lockoutDuration / 1000)
      },
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 记录认证成功
   * @param {Object} user - 用户信息
   * @param {Object} req - 请求对象
   * @private
   */
  recordAuthSuccess(user, req) {
    if (!this.config.auditEnabled) return;

    // 清除失败尝试计数
    this.failedAttempts.delete(req.ip);

    // 记录审计日志
    logger.info('[UnifiedAuth] 认证成功', {
      userId: user.uid,
      role: user.role,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      path: req.path,
      method: req.method
    });
  }

  /**
   * 记录权限拒绝
   * @param {Object} user - 用户信息
   * @param {string[]} permissions - 需要的权限
   * @param {Object} req - 请求对象
   * @private
   */
  recordPermissionDenied(user, permissions, req) {
    if (!this.config.auditEnabled) return;

    logger.warn('[UnifiedAuth] 权限不足', {
      userId: user.uid,
      role: user.role,
      requiredPermissions: permissions,
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.headers['user-agent']
    });
  }

  /**
   * 记录权限成功
   * @param {Object} user - 用户信息
   * @param {string[]} permissions - 检查的权限
   * @param {Object} req - 请求对象
   * @private
   */
  recordPermissionSuccess(user, permissions, req) {
    if (!this.config.auditEnabled) return;

    logger.debug('[UnifiedAuth] 权限检查通过', {
      userId: user.uid,
      role: user.role,
      permissions,
      path: req.path,
      method: req.method
    });
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const now = Date.now();
    const uptime = now - this.stats.lastReset;

    return {
      ...this.stats,
      uptime,
      successRate: this.stats.totalRequests > 0 ?
        (this.stats.successfulAuth / this.stats.totalRequests * 100).toFixed(2) + '%' : '0%',
      failureRate: this.stats.totalRequests > 0 ?
        (this.stats.failedAuth / this.stats.totalRequests * 100).toFixed(2) + '%' : '0%',
      blockedIps: this.failedAttempts.size,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      successfulAuth: 0,
      failedAuth: 0,
      blockedRequests: 0,
      lastReset: Date.now()
    };
    this.failedAttempts.clear();

    logger.info('[UnifiedAuth] 统计信息已重置');
  }
}

// 创建单例实例
const unifiedAuth = new UnifiedAuthMiddleware();

// 导出便捷方法
module.exports = {
  // 初始化方法
  initialize: () => unifiedAuth.initialize(),

  // 认证中间件
  authenticate: () => unifiedAuth.authenticate(),
  optionalAuthenticate: () => unifiedAuth.optionalAuthenticate(),

  // 权限中间件
  requirePermissions: (permissions, options) => unifiedAuth.requirePermissions(permissions, options),
  requireRoles: (roles) => unifiedAuth.requireRoles(roles),
  requireOwnership: (resourceParam, resourceType) => unifiedAuth.requireOwnership(resourceParam, resourceType),

  // 常用权限检查快捷方法
  requireAdmin: unifiedAuth.requireRoles(['admin']),
  requireUserOrAdmin: unifiedAuth.requireRoles(['user', 'admin']),

  // 统计和管理方法
  getStats: () => unifiedAuth.getStats(),
  resetStats: () => unifiedAuth.resetStats(),

  // 内部实例（用于高级用法）
  _instance: unifiedAuth
};