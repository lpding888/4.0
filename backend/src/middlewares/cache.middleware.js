const cacheService = require('../services/cache.service');
const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * 缓存中间件
 *
 * 提供API响应缓存功能，支持：
 * - 基于请求参数的智能缓存键生成
 * - 可配置的缓存TTL
 * - 缓存版本管理
 * - 条件性缓存
 */
class CacheMiddleware {
  /**
   * 响应缓存中间件
   * @param {Object} options - 缓存选项
   * @returns {Function} Express中间件
   */
  responseCache(options = {}) {
    const {
      ttl = 300, // 缓存时间（秒）
      keyGenerator = null, // 自定义键生成器
      condition = () => true, // 缓存条件
      namespace = 'api_response', // 缓存命名空间
      skipCache = false, // 是否跳过缓存
      headersToInclude = [], // 包含在缓存键中的HTTP头
      queryParamsToInclude = [] // 包含在缓存键中的查询参数
    } = options;

    return async (req, res, next) => {
      try {
        // 跳过缓存检查
        if (skipCache || !condition(req, res)) {
          return next();
        }

        // 生成缓存键
        const cacheKey = keyGenerator
          ? keyGenerator(req)
          : this.generateCacheKey(req, namespace, headersToInclude, queryParamsToInclude);

        // 尝试从缓存获取响应
        const cachedResponse = await cacheService.getWithVersion(namespace, cacheKey);
        if (cachedResponse) {
          logger.debug(`[CacheMiddleware] 缓存命中: ${cacheKey}`);

          // 设置缓存头
          res.set('X-Cache', 'HIT');
          res.set('X-Cache-Key', cacheKey);

          return res.json(cachedResponse);
        }

        // 拦截res.json方法来缓存响应
        const originalJson = res.json;
        res.json = function(data) {
          // 缓存响应数据
          cacheService.setWithVersion(namespace, cacheKey, data, ttl)
            .then(() => {
              logger.debug(`[CacheMiddleware] 响应已缓存: ${cacheKey}`);
            })
            .catch(error => {
              logger.warn(`[CacheMiddleware] 响应缓存失败: ${cacheKey}`, error);
            });

          // 设置缓存头
          res.set('X-Cache', 'MISS');
          res.set('X-Cache-Key', cacheKey);

          // 调用原始方法
          return originalJson.call(this, data);
        };

        next();

      } catch (error) {
        logger.error('[CacheMiddleware] 缓存中间件错误', error);
        next();
      }
    };
  }

  /**
   * 用户数据缓存中间件
   * @param {Object} options - 缓存选项
   * @returns {Function} Express中间件
   */
  userCache(options = {}) {
    const {
      ttl = 600, // 用户数据缓存10分钟
      namespace = 'user_data'
    } = options;

    return this.responseCache({
      ttl,
      namespace,
      keyGenerator: (req) => {
        const userId = req.user?.id || req.params.userId || req.query.userId;
        return `user:${userId}:${req.originalUrl}`;
      },
      condition: (req) => !!req.user // 只缓存已认证用户的请求
    });
  }

  /**
   * 管理员数据缓存中间件
   * @param {Object} options - 缓存选项
   * @returns {Function} Express中间件
   */
  adminCache(options = {}) {
    const {
      ttl = 180, // 管理员数据缓存3分钟
      namespace = 'admin_data'
    } = options;

    return this.responseCache({
      ttl,
      namespace,
      keyGenerator: (req) => {
        const adminId = req.user?.id;
        const path = req.originalUrl;
        const query = JSON.stringify(req.query);
        return `admin:${adminId}:${path}:${query}`;
      },
      condition: (req) => req.user?.role === 'admin' // 只缓存管理员请求
    });
  }

  /**
   * 功能配置缓存中间件
   * @param {Object} options - 缓存选项
   * @returns {Function} Express中间件
   */
  featureCache(options = {}) {
    const {
      ttl = 3600, // 功能配置缓存1小时
      namespace = 'feature_config'
    } = options;

    return this.responseCache({
      ttl,
      namespace,
      keyGenerator: (req) => {
        const featureId = req.params.featureId || req.query.featureId;
        return `feature:${featureId}`;
      },
      condition: (req) => {
        // 缓存功能相关的请求
        return req.originalUrl.includes('/feature/') ||
               req.originalUrl.includes('/api/features');
      }
    });
  }

  /**
   * 统计数据缓存中间件
   * @param {Object} options - 缓存选项
   * @returns {Function} Express中间件
   */
  statsCache(options = {}) {
    const {
      ttl = 900, // 统计数据缓存15分钟
      namespace = 'stats_data'
    } = options;

    return this.responseCache({
      ttl,
      namespace,
      keyGenerator: (req) => {
        const userId = req.user?.id;
        const path = req.originalUrl;
        const query = JSON.stringify(req.query);
        return `stats:${userId}:${path}:${query}`;
      },
      condition: (req) => {
        // 缓存统计相关的请求
        return req.originalUrl.includes('/stats/') ||
               req.originalUrl.includes('/analytics/') ||
               req.originalUrl.includes('/dashboard');
      }
    });
  }

  /**
   * 生成缓存键
   * @param {Object} req - Express请求对象
   * @param {string} namespace - 命名空间
   * @param {Array} headersToInclude - 包含的HTTP头
   * @param {Array} queryParamsToInclude - 包含的查询参数
   * @returns {string} 缓存键
   * @private
   */
  generateCacheKey(req, namespace, headersToInclude = [], queryParamsToInclude = []) {
    try {
      let keyComponents = [
        req.method.toLowerCase(),
        req.path
      ];

      // 添加用户信息
      if (req.user?.id) {
        keyComponents.push(`user:${req.user.id}`);
      }

      // 添加指定的查询参数
      if (queryParamsToInclude.length > 0) {
        const queryParams = {};
        queryParamsToInclude.forEach(param => {
          if (req.query[param] !== undefined) {
            queryParams[param] = req.query[param];
          }
        });
        if (Object.keys(queryParams).length > 0) {
          keyComponents.push(`q:${JSON.stringify(queryParams)}`);
        }
      } else {
        // 添加所有查询参数
        if (Object.keys(req.query).length > 0) {
          keyComponents.push(`q:${JSON.stringify(req.query)}`);
        }
      }

      // 添加指定的HTTP头
      if (headersToInclude.length > 0) {
        const headers = {};
        headersToInclude.forEach(header => {
          if (req.headers[header]) {
            headers[header] = req.headers[header];
          }
        });
        if (Object.keys(headers).length > 0) {
          keyComponents.push(`h:${JSON.stringify(headers)}`);
        }
      }

      // 生成基础键
      const baseKey = keyComponents.join(':');

      // 生成哈希值避免键过长
      const hash = crypto.createHash('md5').update(baseKey).digest('hex').substring(0, 8);

      return `${namespace}:${hash}:${baseKey.substring(0, 100)}`;

    } catch (error) {
      logger.error('[CacheMiddleware] 生成缓存键失败', error);
      // 降级处理：使用简单的键生成
      return `${namespace}:${req.method}:${req.path}:${Date.now()}`;
    }
  }

  /**
   * 清除缓存中间件
   * @param {string} namespace - 缓存命名空间
   * @param {string} pattern - 清除模式（可选）
   * @returns {Function} Express中间件
   */
  clearCache(namespace, pattern = null) {
    return async (req, res, next) => {
      try {
        if (pattern) {
          // 清除匹配模式的缓存
          await cacheService.deletePattern(`${namespace}:${pattern}*`);
          logger.info(`[CacheMiddleware] 清除缓存: ${namespace}:${pattern}*`);
        } else {
          // 递增版本号清除整个命名空间
          await cacheService.incrementVersion(namespace);
          logger.info(`[CacheMiddleware] 清除命名空间缓存: ${namespace}`);
        }

        next();

      } catch (error) {
        logger.error('[CacheMiddleware] 清除缓存失败', error);
        next();
      }
    };
  }

  /**
   * 缓存控制中间件
   * @returns {Function} Express中间件
   */
  cacheControl() {
    return (req, res, next) => {
      // 设置缓存控制头
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');

      // 如果请求包含nocache参数，清除相关缓存
      if (req.query.nocache === 'true') {
        const namespace = req.headers['x-cache-namespace'] || 'api_response';
        const pattern = req.headers['x-cache-pattern'];

        if (pattern) {
          cacheService.deletePattern(`${namespace}:${pattern}*`)
            .then(() => logger.info(`[CacheMiddleware] 强制清除缓存: ${namespace}:${pattern}*`))
            .catch(error => logger.warn('[CacheMiddleware] 强制清除缓存失败', error));
        } else {
          cacheService.incrementVersion(namespace)
            .then(() => logger.info(`[CacheMiddleware] 强制清除命名空间: ${namespace}`))
            .catch(error => logger.warn('[CacheMiddleware] 强制清除命名空间失败', error));
        }
      }

      next();
    };
  }

  /**
   * 条件性缓存中间件
   * @param {Function} condition - 条件函数
   * @param {Object} cacheOptions - 缓存选项
   * @returns {Function} Express中间件
   */
  conditionalCache(condition, cacheOptions = {}) {
    const options = {
      ...cacheOptions,
      condition: (req, res) => {
        try {
          return condition(req, res);
        } catch (error) {
          logger.error('[CacheMiddleware] 条件判断失败', error);
          return false;
        }
      }
    };

    return this.responseCache(options);
  }

  /**
   * 基于时间的缓存中间件
   * @param {Object} timeConfig - 时间配置
   * @param {Object} cacheOptions - 缓存选项
   * @returns {Function} Express中间件
   */
  timeBasedCache(timeConfig = {}, cacheOptions = {}) {
    const {
      workHours = { start: 9, end: 18 }, // 工作时间
      workDays = [1, 2, 3, 4, 5], // 工作日（1-5表示周一到周五）
      timezone = 'Asia/Shanghai'
    } = timeConfig;

    const options = {
      ...cacheOptions,
      condition: (req) => {
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay(); // 0=周日, 1=周一, ..., 6=周六

        // 检查是否为工作时间
        const isWorkHour = hour >= workHours.start && hour < workHours.end;
        const isWorkDay = workDays.includes(day);

        // 工作时间缓存时间短，非工作时间缓存时间长
        if (isWorkHour && isWorkDay) {
          options.ttl = cacheOptions.workTTL || 300; // 5分钟
        } else {
          options.ttl = cacheOptions.offWorkTTL || 1800; // 30分钟
        }

        return true;
      }
    };

    return this.responseCache(options);
  }

  /**
   * 缓存统计中间件
   * @returns {Function} Express中间件
   */
  cacheStats() {
    return (req, res, next) => {
      if (req.path === '/cache/stats') {
        return res.json({
          success: true,
          data: {
            ...cacheService.getStats(),
            timestamp: new Date().toISOString()
          }
        });
      }
      next();
    };
  }

  /**
   * 缓存健康检查中间件
   * @returns {Function} Express中间件
   */
  cacheHealthCheck() {
    return async (req, res, next) => {
      if (req.path === '/cache/health') {
        try {
          const health = await cacheService.healthCheck();
          return res.json({
            success: true,
            data: health
          });
        } catch (error) {
          return res.status(503).json({
            success: false,
            error: error.message
          });
        }
      }
      next();
    };
  }
}

module.exports = new CacheMiddleware();