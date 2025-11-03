const securityService = require('../services/security.service');
const { createErrorResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * 限流中间件
 */
const rateLimit = (config) => {
  return async (req, res, next) => {
    try {
      // 生成限流key
      const key = config.keyGenerator
        ? config.keyGenerator(req)
        : `rate_limit:${req.ip}:${req.path}`;

      // 检查限流
      const result = await securityService.checkRateLimit(key, {
        windowMs: config.windowMs,
        maxRequests: config.maxRequests,
        message: config.message || '请求过于频繁，请稍后再试'
      });

      // 设置响应头
      res.set({
        'X-RateLimit-Limit': result.limit,
        'X-RateLimit-Remaining': result.remaining,
        'X-RateLimit-Reset': Math.ceil(result.resetTime.getTime() / 1000)
      });

      if (!result.allowed) {
        return res.status(429).json(
          createErrorResponse('RATE_LIMIT_EXCEEDED', config.message || '请求过于频繁，请稍后再试', {
            retryAfter: result.retryAfter,
            resetTime: result.resetTime
          })
        );
      }

      next();
    } catch (error) {
      logger.error('限流中间件错误:', error);
      // 限流服务故障时允许通过
      next();
    }
  };
};

/**
 * 数据脱敏中间件
 */
const dataMasking = (rules = []) => {
  return (req, res, next) => {
    // 保存原始的json方法
    const originalJson = res.json;

    // 重写json方法
    res.json = function(data) {
      if (data && data.data) {
        // 对响应数据进行脱敏
        data.data = securityService.maskSensitiveData(data.data, rules);
      }
      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * 安全检查中间件
 */
const securityCheck = (options = {}) => {
  return async (req, res, next) => {
    try {
      const checks = await securityService.performSecurityChecks();

      // 检查是否有严重的安全问题
      const criticalIssues = checks.filter(check =>
        check.status === 'unhealthy' &&
        check.details?.severity === 'critical'
      );

      if (criticalIssues.length > 0 && !options.skipCriticalCheck) {
        logger.error('发现严重安全问题:', criticalIssues);
        return res.status(503).json(
          createErrorResponse('SECURITY_ISSUE', '系统安全问题，暂时无法提供服务', {
            issues: criticalIssues
          })
        );
      }

      // 将安全检查结果添加到请求对象
      req.securityChecks = checks;
      next();
    } catch (error) {
      logger.error('安全检查中间件错误:', error);
      // 安全检查失败时记录日志但允许通过
      next();
    }
  };
};

/**
 * 可疑活动检测中间件
 */
const suspiciousActivityDetection = (options = {}) => {
  return async (req, res, next) => {
    try {
      const suspicious = await securityService.detectSuspiciousActivity(req, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
        userId: req.user?.id
      });

      if (suspicious.isSuspicious) {
        logger.warn('检测到可疑活动:', suspicious);

        // 记录可疑活动
        await securityService.logSecurityEvent({
          type: 'suspicious_activity',
          severity: suspicious.severity,
          userId: req.user?.id,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method,
          details: suspicious
        });

        // 根据严重程度决定是否阻止请求
        if (suspicious.severity === 'high' || suspicious.severity === 'critical') {
          return res.status(403).json(
            createErrorResponse('SUSPICIOUS_ACTIVITY', '请求被标记为可疑活动，已被阻止', suspicious)
          );
        }
      }

      next();
    } catch (error) {
      logger.error('可疑活动检测中间件错误:', error);
      next();
    }
  };
};

/**
 * 安全审计中间件
 */
const securityAudit = (options = {}) => {
  return async (req, res, next) => {
    // 记录原始的send方法
    const originalSend = res.send;
    const originalJson = res.json;
    const startTime = Date.now();

    // 审计函数
    const audit = (statusCode, data) => {
      const auditData = {
        method: req.method,
        path: req.path,
        statusCode,
        userId: req.user?.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        responseTime: Date.now() - startTime,
        requestData: options.includeRequestData ? req.body : undefined,
        responseData: options.includeResponseData ? data : undefined
      };

      // 记录访问日志
      securityService.logSecurityEvent({
        type: 'data_access',
        severity: statusCode >= 400 ? 'medium' : 'low',
        userId: req.user?.id,
        ip: req.ip,
        path: req.path,
        method: req.method,
        details: auditData
      });
    };

    // 重写响应方法
    res.send = function(data) {
      audit(res.statusCode, data);
      return originalSend.call(this, data);
    };

    res.json = function(data) {
      audit(res.statusCode, data);
      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * IP白名单中间件
 */
const ipWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;

    if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
      logger.warn(`IP ${clientIP} 不在白名单中，拒绝访问`);
      return res.status(403).json(
        createErrorResponse('IP_NOT_ALLOWED', 'IP地址不在允许范围中')
      );
    }

    next();
  };
};

/**
 * 强制HTTPS中间件
 */
const forceHTTPS = (options = {}) => {
  return (req, res, next) => {
    // 检查是否已经是HTTPS
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      return next();
    }

    // 开发环境跳过
    if (process.env.NODE_ENV === 'development' && options.skipInDev) {
      return next();
    }

    // 重定向到HTTPS
    const httpsUrl = `https://${req.headers.host}${req.url}`;
    res.redirect(301, httpsUrl);
  };
};

/**
 * 安全头设置中间件
 */
const securityHeaders = (options = {}) => {
  return (req, res, next) => {
    // 设置安全响应头
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': options.frameOptions || 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': options.hsts || 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': options.csp || "default-src 'self'",
      'Referrer-Policy': options.referrerPolicy || 'strict-origin-when-cross-origin',
      'Permissions-Policy': options.permissionsPolicy || 'geolocation=(), microphone=(), camera=()'
    });

    next();
  };
};

module.exports = {
  rateLimit,
  dataMasking,
  securityCheck,
  suspiciousActivityDetection,
  securityAudit,
  ipWhitelist,
  forceHTTPS,
  securityHeaders
};