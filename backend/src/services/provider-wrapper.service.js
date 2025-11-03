const logger = require('../utils/logger');
const circuitBreakerService = require('./circuit-breaker.service');
const cacheService = require('./cache.service');

/**
 * Provider包装器服务
 *
 * 为外部Provider提供熔断和降级保护：
 * - 自动熔断保护
 * - 降级处理
 * - 重试机制
 * - 性能监控
 * - 缓存支持
 */
class ProviderWrapperService {
  constructor() {
    this.providers = new Map();
    this.wrappers = new Map();
    this.defaultConfig = {
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeout: 30000,
        monitoringPeriod: 10000,
        halfOpenMaxCalls: 2,
        successThreshold: 2
      },
      retry: {
        maxAttempts: 2,
        baseDelay: 1000,
        maxDelay: 10000,
        backoff: 'exponential'
      },
      timeout: 30000,
      cache: {
        ttl: 300,
        enabled: true
      }
    };
  }

  /**
   * 注册Provider
   * @param {string} name - Provider名称
   * @param {Object} provider - Provider实例
   * @param {Object} config - 配置参数
   */
  registerProvider(name, provider, config = {}) {
    try {
      const fullConfig = {
        ...this.defaultConfig,
        ...config
      };

      // 创建熔断器
      const circuitBreakerName = `provider_${name}`;
      const circuitBreaker = circuitBreaker.getCircuitBreaker(
        circuitBreakerName,
        fullConfig.circuitBreaker
      );

      // 创建包装器
      const wrapper = new ProviderWrapper(name, provider, fullConfig, circuitBreaker);

      this.providers.set(name, provider);
      this.wrappers.set(name, wrapper);

      logger.info(`[ProviderWrapper] Provider注册成功: ${name}`);

    } catch (error) {
      logger.error(`[ProviderWrapper] Provider注册失败: ${name}`, error);
    }
  }

  /**
   * 获取Provider包装器
   * @param {string} name - Provider名称
   * @returns {ProviderWrapper|null} 包装器实例
   */
  getWrapper(name) {
    return this.wrappers.get(name) || null;
  }

  /**
   * 获取原始Provider
   * @param {string} name - Provider名称
   * @returns {Object|null} Provider实例
   */
  getProvider(name) {
    return this.providers.get(name) || null;
  }

  /**
   * 执行Provider方法
   @param {string} providerName - Provider名称
   @param {string} methodName - 方法名称
   @param {Array} args - 参数列表
   * @param {Object} options - 执行选项
   * @returns {Promise<any>} 执行结果
   */
  async execute(providerName, methodName, args = [], options = {}) {
    const wrapper = this.getWrapper(providerName);
    if (!wrapper) {
      throw new Error(`Provider不存在: ${providerName}`);
    }

    return wrapper.execute(methodName, args, options);
  }

  /**
   * 获取所有Provider状态
   * @returns {Object} 所有Provider状态
   */
  getAllProviderStates() {
    const states = {};

    for (const [name, wrapper] of this.wrappers) {
      states[name] = wrapper.getState();
    }

    return {
      providers: states,
      totalProviders: this.wrappers.size,
      activeProviders: Array.from(this.wrappers.values())
        .filter(wrapper => wrapper.circuitBreaker.getState() !== 'open')
        .length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 获取Provider性能统计
   * @param {string} providerName - Provider名称
   * @returns {Object} 性能统计
   */
  getProviderStats(providerName) {
    const wrapper = this.getWrapper(providerName);
    if (!wrapper) {
      return null;
    }

    return wrapper.getStats();
  }

  /**
   * 重置Provider统计
   * @param {string} providerName - Provider名称
   * @returns {boolean} 是否成功
   */
  resetProviderStats(providerName) {
    const wrapper = this.getWrapper(providerName);
    if (!wrapper) {
      return false;
    }

    wrapper.resetStats();
    logger.info(`[ProviderWrapper] Provider统计已重置: ${providerName}`);
    return true;
  }

  /**
   * 健康检查
   * @returns {Promise<Object>} 健康状态
   */
  async healthCheck() {
    try {
      const healthChecks = [];
      const providerStates = this.getAllProviderStates();

      for (const [name, state] of Object.entries(providerStates.providers)) {
        try {
          const isHealthy = state.circuitBreaker.state !== 'open';
          healthChecks.push({
            name,
            status: isHealthy ? 'healthy' : 'unhealthy',
            state: state.circuitBreaker.state,
            failureRate: state.circuitBreaker.getFailureRate(),
            requestCount: state.stats.totalRequests
          });
        } catch (error) {
          healthChecks.push({
            name,
            status: 'error',
            error: error.message
          });
        }
      }

      const unhealthyCount = healthChecks.filter(check => check.status === 'unhealthy').length;
      const healthyCount = healthChecks.filter(check => check.status === 'healthy').length;

      return {
        status: unhealthyCount === 0 ? 'healthy' : unhealthyCount > healthyCount ? 'unhealthy' : 'degraded',
        totalProviders: this.wrappers.size,
        healthyProviders: healthyCount,
        unhealthyProviders: unhealthyCount,
        providers: healthChecks,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('[ProviderWrapper] 健康检查失败', error);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

/**
 * Provider包装器类
 */
class ProviderWrapper {
  constructor(name, provider, config, circuitBreaker) {
    this.name = name;
    this.provider = provider;
    this.config = config;
    this.circuitBreaker = circuitBreaker;

    // 统计信息
    this.stats = {
      totalRequests: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      totalTimeouts: 0,
      totalCaches: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      lastRequestTime: null,
      lastSuccessTime: null,
      lastFailureTime: null
    };

    // 缓存配置
    this.cacheEnabled = config.cache.enabled;
    this.cacheTTL = config.cache.ttl;
  }

  /**
   * 执行方法
   @param {string} methodName - 方法名称
   * @param {Array} args - 参数列表
   * @param {Object} options - 执行选项
   * @returns {Promise<any>} 执行结果
   */
  async execute(methodName, args = [], options = {}) {
    const startTime = Date.now();
    const methodKey = `${this.name}.${methodName}`;
    const cacheKey = this.generateCacheKey(methodKey, args);

    try {
      this.stats.totalRequests++;
      this.stats.lastRequestTime = startTime;

      // 检查缓存
      if (this.cacheEnabled && !options.skipCache) {
        const cachedResult = await cacheService.get(cacheKey);
        if (cachedResult !== null) {
          this.stats.totalCaches++;
          const duration = Date.now() - startTime;
          this.updateResponseTime(duration);
          logger.debug(`[ProviderWrapper] 缓存命中: ${methodKey}`);
          return cachedResult;
        }
      }

      // 执行带熔断保护的操作
      const result = await circuitBreakerService.execute(
        methodKey,
        () => this.executeWithRetry(methodName, args, options),
        (error) => this.handleFallback(methodName, args, error, options),
        this.config.circuitBreaker
      );

      // 缓存结果
      if (this.cacheEnabled && result !== undefined && !options.skipCache) {
        await cacheService.set(cacheKey, result, this.cacheTTL);
      }

      // 更新统计
      const duration = Date.now() - startTime;
      this.stats.totalSuccesses++;
      this.stats.lastSuccessTime = startTime;
      this.updateResponseTime(duration);

      logger.debug(`[ProviderWrapper] 方法执行成功: ${methodKey}, 耗时: ${duration}ms`);
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.stats.totalFailures++;
      this.stats.lastFailureTime = startTime;
      this.updateResponseTime(duration);

      logger.error(`[ProviderWrapper] 方法执行失败: ${methodKey}`, {
        error: error.message,
        duration: `${duration}ms`,
        args: this.sanitizeArgs(args)
      });

      throw error;
    }
  }

  /**
   * 带重试机制执行
   * @param {string} methodName - 方法名称
   * @param {Array} args - 参数列表
   * @param {Object} options - 执行选项
   * @returns {Promise<any>} 执行结果
   * @private
   */
  async executeWithRetry(methodName, args, options) {
    const retryConfig = {
      maxAttempts: options.maxAttempts || this.config.retry.maxAttempts,
      baseDelay: options.baseDelay || this.config.retry.baseDelay,
      maxDelay: options.maxDelay || this.config.retry.maxDelay,
      backoff: options.backoff || this.config.retry.backoff
    };

    let lastError;
    let attempt = 1;

    while (attempt <= retryConfig.maxAttempts) {
      try {
        // 检查超时
        const timeout = options.timeout || this.config.timeout;
        const result = await this.executeWithTimeout(methodName, args, timeout);

        if (attempt > 1) {
          logger.info(`[ProviderWrapper] 重试成功: ${this.name}.${methodName}, 尝试次数: ${attempt}`);
        }

        return result;

      } catch (error) {
        lastError = error;

        // 检查是否应该重试
        const shouldRetry = this.shouldRetry(error, attempt, retryConfig);

        if (!shouldRetry || attempt >= retryConfig.maxAttempts) {
          break;
        }

        // 计算延迟时间
        const delay = this.calculateRetryDelay(attempt, retryConfig);

        logger.warn(`[ProviderWrapper] 重试: ${this.name}.${methodName}, 尝试次数: ${attempt}, 延迟: ${delay}ms, 错误: ${error.message}`);

        // 等待
        await this.sleep(delay);
        attempt++;
      }
    }

    throw lastError;
  }

  /**
   * 带超时执行
   * @param {string} methodName - 方法名称
   * @param {Array} args - 参数列表
   * @param {number} timeout - 超时时间
   * @returns {Promise<any>} 执行结果
   * @private
   */
  async executeWithTimeout(methodName, args, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.stats.totalTimeouts++;
        reject(new Error(`Method execution timeout: ${methodName} (${timeout}ms)`));
      }, timeout);

      this.executeDirect(methodName, args)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * 直接执行方法
   * @param {string} methodName - 方法名称
   * @param {Array} args - 参数列表
   * @returns {Promise<any>} 执行结果
   * @private
   */
  async executeDirect(methodName, args) {
    if (!this.provider[methodName] || typeof this.provider[methodName] !== 'function') {
      throw new Error(`Method not found: ${methodName}`);
    }

    return await this.provider[methodName](...args);
  }

  /**
   * 处理降级
   * @param {string} methodName - 方法名称
   * @param {Array} args - 参数列表
   * @param {Error} error - 错误对象
   * @param {Object} options - 执行选项
   * @returns {Promise<any>} 降级结果
   * @private
   */
  async handleFallback(methodName, args, error, options) {
    if (options.fallback) {
      try {
        logger.info(`[ProviderWrapper] 执行降级操作: ${this.name}.${methodName}`);
        return await options.fallback(error, args);
      } catch (fallbackError) {
        logger.error(`[ProviderWrapper] 降级操作失败: ${this.name}.${methodName}`, fallbackError);
        throw fallbackError;
      }
    } else {
      // 默认降级策略
      logger.warn(`[ProviderWrapper] 使用默认降级策略: ${this.name}.${methodName}`);

      // 根据方法类型返回默认值
      if (methodName.includes('get') || methodName.includes('fetch')) {
        return null;
      } else if (methodName.includes('create') || methodName.includes('process')) {
        return { success: false, error: error.message, fallback: true };
      } else {
        throw error;
      }
    }
  }

  /**
   * 判断是否应该重试
   * @param {Error} error - 错误对象
   * @param {number} attempt - 当前尝试次数
   * @param {Object} retryConfig - 重试配置
   * @returns {boolean} 是否应该重试
   * @private
   */
  shouldRetry(error, attempt, retryConfig) {
    // 网络错误或超时错误可以重试
    const retryableErrors = [
      'ECONNRESET',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'timeout',
      'Network Error',
      'fetch failed'
    ];

    const isRetryableError = retryableErrors.some(retryableError =>
      error.message.includes(retryableError) ||
      error.code === retryableError ||
      error.name === retryableError
    );

    return isRetryableError && attempt < retryConfig.maxAttempts;
  }

  /**
   * 计算重试延迟
   * @param {number} attempt - 尝试次数
   * @param {Object} retryConfig - 重试配置
   * @returns {number} 延迟时间
   * @private
   */
  calculateRetryDelay(attempt, retryConfig) {
    const { baseDelay, maxDelay, backoff } = retryConfig;

    let delay;
    switch (backoff) {
      case 'linear':
        delay = baseDelay * attempt;
        break;
      case 'exponential':
        delay = baseDelay * Math.pow(2, attempt - 1);
        break;
      default:
        delay = baseDelay;
    }

    return Math.min(delay, maxDelay);
  }

  /**
   * 生成缓存键
   * @param {string} methodKey - 方法键
   * @param {Array} args - 参数列表
   * @returns {string} 缓存键
   * @private
   */
  generateCacheKey(methodKey, args) {
    try {
      const argsHash = this.hashArgs(args);
      return `provider_cache:${methodKey}:${argsHash}`;
    } catch (error) {
      logger.warn(`[ProviderWrapper] 生成缓存键失败: ${methodKey}`, error);
      return `provider_cache:${methodKey}:${Date.now()}`;
    }
  }

  /**
   * 哈希参数
   @param {Array} args - 参数列表
   * @returns {string} 哈希值
   * @private
   */
  hashArgs(args) {
    const crypto = require('crypto');
    const argsStr = JSON.stringify(args);
    return crypto.createHash('md5').update(argsStr).digest('hex');
  }

  /**
   * 清理参数（用于日志）
   * @param {Array} args - 参数列表
   * @returns {Array} 清理后的参数
   * @private
   */
  sanitizeArgs(args) {
    try {
      return args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          // 移除敏感信息
          const sanitized = { ...arg };
          if (sanitized.password) sanitized.password = '***';
          if (sanitized.token) sanitized.token = '***';
          return sanitized;
        }
        return arg;
      });
    } catch (error) {
      return args;
    }
  }

  /**
   * 更新响应时间统计
   * @param {number} responseTime - 响应时间
   * @private
   */
  updateResponseTime(responseTime) {
    this.stats.totalResponseTime += responseTime;
    const totalRequests = this.stats.totalRequests;
    if (totalRequests > 0) {
      this.stats.averageResponseTime = this.stats.totalResponseTime / totalRequests;
    }
  }

  /**
   * 获取包装器状态
   * @returns {Object} 包装器状态
   */
  getState() {
    return {
      name: this.name,
      circuitBreaker: {
        state: this.circuitBreaker.getState(),
        failureCount: this.circuitBreaker.getFailureCount(),
        successCount: this.circuitBreaker.getSuccessCount(),
        lastFailureTime: this.circuitBreaker.getLastFailureTime(),
        lastSuccessTime: this.circuitBreaker.getLastSuccessTime(),
        nextAttempt: this.circuitBreaker.getNextAttempt()
      },
      stats: { ...this.stats },
      config: {
        cacheEnabled: this.cacheEnabled,
        cacheTTL: this.cacheTTL,
        timeout: this.config.timeout,
        retry: this.config.retry
      }
    };
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      ...this.stats,
      circuitBreaker: this.circuitBreaker.getRequestStats(),
      successRate: this.stats.totalRequests > 0
        ? (this.stats.totalSuccesses / this.stats.totalRequests * 100).toFixed(2) + '%'
        : '0%',
      failureRate: this.stats.totalRequests > 0
        ? (this.stats.totalFailures / this.stats.totalRequests * 100).toFixed(2) + '%'
        : '0%',
      cacheHitRate: this.stats.totalRequests > 0
        ? (this.stats.totalCaches / this.stats.totalRequests * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      totalTimeouts: 0,
      totalCaches: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      lastRequestTime: null,
      lastSuccessTime: null,
      lastFailureTime: null
    };
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟时间（毫秒）
   * @returns {Promise<void>}
   * @private
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new ProviderWrapperService();