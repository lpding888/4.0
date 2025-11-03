const logger = require('../utils/logger');
const providerWrapperService = require('./provider-wrapper.service');
const imageProcessService = require('./imageProcess.service');
const aiModelService = require('./aiModel.service');
const cacheService = require('./cache.service');
const queueService = require('./queue.service');
const db = require('../config/database');

// 导入Provider类
const SyncImageProcessProvider = require('../providers/syncImageProcess.provider');
const RunninghubWorkflowProvider = require('../providers/runninghubWorkflow.provider');
const ScfPostProcessProvider = require('../providers/scfPostProcess.provider');

/**
 * Provider注册服务
 *
 * 负责注册和配置所有外部Provider到包装器服务：
 * - 自动注册内置服务
 * - 配置熔断参数
 * - 设置降级策略
 * - 监控Provider状态
 */
class ProviderRegistryService {
  constructor() {
    this.registeredProviders = new Map();
    this.providerConfigs = new Map();
    this.initialized = false;
  }

  /**
   * 初始化所有Provider
   */
  async initialize() {
    if (this.initialized) {
      logger.warn('[ProviderRegistry] 已经初始化过，跳过重复初始化');
      return;
    }

    try {
      logger.info('[ProviderRegistry] 开始注册Provider...');

      // 注册内置服务Provider
      await this.registerBuiltinProviders();

      // 注册外部API Provider
      await this.registerExternalProviders();

      // 注册数据库Provider
      await this.registerDatabaseProviders();

      // 注册缓存Provider
      await this.registerCacheProviders();

      // 注册队列Provider
      await this.registerQueueProviders();

      this.initialized = true;
      logger.info(`[ProviderRegistry] Provider注册完成，共注册 ${this.registeredProviders.size} 个Provider`);

    } catch (error) {
      logger.error('[ProviderRegistry] Provider初始化失败:', error);
      throw error;
    }
  }

  /**
   * 注册内置服务Provider
   * @private
   */
  async registerBuiltinProviders() {
    // 图像处理服务
    this.registerProvider('imageProcess', imageProcessService, {
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
        maxDelay: 8000,
        backoff: 'exponential'
      },
      timeout: 60000, // 图像处理超时时间更长
      cache: {
        ttl: 300,
        enabled: true
      }
    });

    // AI模型服务
    this.registerProvider('aiModel', aiModelService, {
      circuitBreaker: {
        failureThreshold: 2, // AI服务更容易失败，降低阈值
        resetTimeout: 60000,
        monitoringPeriod: 15000,
        halfOpenMaxCalls: 1,
        successThreshold: 1
      },
      retry: {
        maxAttempts: 1, // AI服务通常不需要重试
        baseDelay: 2000,
        maxDelay: 5000,
        backoff: 'linear'
      },
      timeout: 120000, // AI处理时间更长
      cache: {
        ttl: 600,
        enabled: true
      }
    });

    // 注册Pipeline兼容的Provider
    this.registerProvider('SYNC_IMAGE_PROCESS', new SyncImageProcessProvider('default'), {
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeout: 30000,
        monitoringPeriod: 10000,
        halfOpenMaxCalls: 2,
        successThreshold: 2
      },
      retry: {
        maxAttempts: 2,
        baseDelay: 1500,
        maxDelay: 10000,
        backoff: 'exponential'
      },
      timeout: 90000, // Pipeline中的图像处理
      cache: {
        ttl: 600,
        enabled: false // Pipeline步骤通常不缓存
      }
    });

    this.registerProvider('RUNNINGHUB_WORKFLOW', new RunninghubWorkflowProvider('default'), {
      circuitBreaker: {
        failureThreshold: 2, // AI工作流更容易失败
        resetTimeout: 60000,
        monitoringPeriod: 15000,
        halfOpenMaxCalls: 1,
        successThreshold: 1
      },
      retry: {
        maxAttempts: 1, // AI工作流不重试
        baseDelay: 3000,
        maxDelay: 8000,
        backoff: 'linear'
      },
      timeout: 180000, // AI工作流处理时间更长
      cache: {
        ttl: 1200,
        enabled: false
      }
    });

    this.registerProvider('SCF_POST_PROCESS', new ScfPostProcessProvider('default'), {
      circuitBreaker: {
        failureThreshold: 4, // SCF后处理相对稳定
        resetTimeout: 20000,
        monitoringPeriod: 8000,
        halfOpenMaxCalls: 3,
        successThreshold: 3
      },
      retry: {
        maxAttempts: 2,
        baseDelay: 1000,
        maxDelay: 5000,
        backoff: 'linear'
      },
      timeout: 30000, // SCF处理相对较快
      cache: {
        ttl: 300,
        enabled: false
      }
    });

    logger.info('[ProviderRegistry] 内置服务Provider注册完成');
  }

  /**
   * 注册外部API Provider
   * @private
   */
  async registerExternalProviders() {
    // 微信API服务
    const wechatApiService = {
      async sendMessage(templateId, data, openid) {
        // TODO: 实现微信API调用
        logger.info(`[WechatAPI] 发送模板消息: ${templateId} -> ${openid}`);
        return { success: true, msgid: 'mock_msgid_' + Date.now() };
      },

      async getAccessToken() {
        // TODO: 实现获取access token
        return 'mock_access_token_' + Date.now();
      },

      async getUserInfo(accessToken, openid) {
        // TODO: 实现获取用户信息
        return {
          openid,
          nickname: '测试用户',
          headimgurl: 'https://example.com/avatar.jpg'
        };
      }
    };

    this.registerProvider('wechatApi', wechatApiService, {
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 30000,
        monitoringPeriod: 10000,
        halfOpenMaxCalls: 3,
        successThreshold: 3
      },
      retry: {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        backoff: 'exponential'
      },
      timeout: 10000,
      cache: {
        ttl: 7200, // access token缓存2小时
        enabled: true
      }
    });

    // 支付服务
    const paymentService = {
      async createOrder(orderData) {
        // TODO: 实现支付订单创建
        logger.info(`[Payment] 创建支付订单:`, orderData);
        return {
          orderId: 'order_' + Date.now(),
          paymentUrl: 'https://payment.example.com/pay/' + Date.now(),
          status: 'pending'
        };
      },

      async queryOrderStatus(orderId) {
        // TODO: 实现订单状态查询
        return {
          orderId,
          status: 'paid',
          paidAt: new Date().toISOString()
        };
      },

      async refund(orderId, amount) {
        // TODO: 实现退款
        logger.info(`[Payment] 退款: ${orderId}, 金额: ${amount}`);
        return {
          refundId: 'refund_' + Date.now(),
          status: 'success'
        };
      }
    };

    this.registerProvider('payment', paymentService, {
      circuitBreaker: {
        failureThreshold: 2, // 支付服务敏感度低
        resetTimeout: 120000,
        monitoringPeriod: 20000,
        halfOpenMaxCalls: 1,
        successThreshold: 1
      },
      retry: {
        maxAttempts: 1, // 支付操作不重试
        baseDelay: 5000,
        maxDelay: 5000,
        backoff: 'linear'
      },
      timeout: 30000,
      cache: {
        ttl: 300,
        enabled: false // 支付操作不缓存
      }
    });

    logger.info('[ProviderRegistry] 外部API Provider注册完成');
  }

  /**
   * 注册数据库Provider
   * @private
   */
  async registerDatabaseProviders() {
    // 数据库查询服务
    const databaseService = {
      async query(sql, bindings) {
        return await db.raw(sql, bindings);
      },

      async transaction(callback) {
        return await db.transaction(callback);
      },

      async healthCheck() {
        try {
          await db.raw('SELECT 1');
          return { status: 'healthy', timestamp: new Date().toISOString() };
        } catch (error) {
          throw new Error(`数据库连接失败: ${error.message}`);
        }
      }
    };

    this.registerProvider('database', databaseService, {
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeout: 10000, // 数据库恢复较快
        monitoringPeriod: 5000,
        halfOpenMaxCalls: 2,
        successThreshold: 2
      },
      retry: {
        maxAttempts: 2,
        baseDelay: 500,
        maxDelay: 2000,
        backoff: 'linear'
      },
      timeout: 5000,
      cache: {
        ttl: 60,
        enabled: false // 数据库查询通常不在这里缓存
      }
    });

    logger.info('[ProviderRegistry] 数据库Provider注册完成');
  }

  /**
   * 注册缓存Provider
   * @private
   */
  async registerCacheProviders() {
    // Redis缓存服务
    const redisService = {
      async get(key) {
        return await cacheService.get(key);
      },

      async set(key, value, ttl) {
        return await cacheService.set(key, value, ttl);
      },

      async delete(key) {
        return await cacheService.delete(key);
      },

      async deletePattern(pattern) {
        return await cacheService.deletePattern(pattern);
      },

      async healthCheck() {
        return await cacheService.healthCheck();
      }
    };

    this.registerProvider('redis', redisService, {
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 30000,
        monitoringPeriod: 10000,
        halfOpenMaxCalls: 3,
        successThreshold: 3
      },
      retry: {
        maxAttempts: 2,
        baseDelay: 1000,
        maxDelay: 5000,
        backoff: 'exponential'
      },
      timeout: 3000,
      cache: {
        ttl: 0,
        enabled: false // 缓存服务本身不缓存
      }
    });

    logger.info('[ProviderRegistry] 缓存Provider注册完成');
  }

  /**
   * 注册队列Provider
   * @private
   */
  async registerQueueProviders() {
    // 队列服务
    const queueProviderService = {
      async add(queueName, jobName, data, options) {
        return await queueService.add(queueName, jobName, data, options);
      },

      async getQueueStatus(queueName) {
        return await queueService.getQueueStatus(queueName);
      },

      async healthCheck() {
        return await queueService.healthCheck();
      }
    };

    this.registerProvider('queue', queueProviderService, {
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeout: 20000,
        monitoringPeriod: 8000,
        halfOpenMaxCalls: 2,
        successThreshold: 2
      },
      retry: {
        maxAttempts: 2,
        baseDelay: 1000,
        maxDelay: 3000,
        backoff: 'linear'
      },
      timeout: 5000,
      cache: {
        ttl: 0,
        enabled: false
      }
    });

    logger.info('[ProviderRegistry] 队列Provider注册完成');
  }

  /**
   * 注册单个Provider
   * @param {string} name - Provider名称
   * @param {Object} provider - Provider实例
   * @param {Object} config - 配置参数
   */
  registerProvider(name, provider, config) {
    try {
      // 注册到包装器服务
      providerWrapperService.registerProvider(name, provider, config);

      // 保存注册信息
      this.registeredProviders.set(name, {
        name,
        provider,
        config,
        registeredAt: new Date(),
        status: 'active'
      });

      this.providerConfigs.set(name, config);

      logger.info(`[ProviderRegistry] Provider注册成功: ${name}`);

    } catch (error) {
      logger.error(`[ProviderRegistry] Provider注册失败: ${name}`, error);
      throw error;
    }
  }

  /**
   * 获取Provider包装器
   * @param {string} name - Provider名称
   * @returns {Object|null} 包装器实例
   */
  getWrapper(name) {
    return providerWrapperService.getWrapper(name);
  }

  /**
   * 执行Provider方法
   * @param {string} providerName - Provider名称
   * @param {string} methodName - 方法名称
   * @param {Array} args - 参数列表
   * @param {Object} options - 执行选项
   * @returns {Promise<any>} 执行结果
   */
  async execute(providerName, methodName, args = [], options = {}) {
    return await providerWrapperService.execute(providerName, methodName, args, options);
  }

  /**
   * 获取所有Provider状态
   * @returns {Object} 所有Provider状态
   */
  getAllProviderStates() {
    const wrapperStates = providerWrapperService.getAllProviderStates();
    const registryStates = {};

    // 添加注册信息
    for (const [name, providerInfo] of this.registeredProviders) {
      registryStates[name] = {
        ...providerInfo,
        wrapperState: wrapperStates.providers[name]
      };
    }

    return {
      providers: registryStates,
      totalProviders: this.registeredProviders.size,
      activeProviders: wrapperStates.activeProviders,
      initialized: this.initialized,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 获取Provider统计信息
   * @param {string} providerName - Provider名称
   * @returns {Object} 统计信息
   */
  getProviderStats(providerName) {
    const wrapperStats = providerWrapperService.getProviderStats(providerName);
    const providerInfo = this.registeredProviders.get(providerName);

    return {
      provider: {
        name: providerName,
        registeredAt: providerInfo?.registeredAt,
        status: providerInfo?.status
      },
      wrapper: wrapperStats,
      config: this.providerConfigs.get(providerName)
    };
  }

  /**
   * 重置Provider统计
   * @param {string} providerName - Provider名称
   * @returns {boolean} 是否成功
   */
  resetProviderStats(providerName) {
    return providerWrapperService.resetProviderStats(providerName);
  }

  /**
   * 健康检查
   * @returns {Promise<Object>} 健康状态
   */
  async healthCheck() {
    try {
      const providerStates = this.getAllProviderStates();
      const wrapperHealth = await providerWrapperService.healthCheck();

      // 检查各个Provider的健康状态
      const providerHealths = [];
      for (const [name, providerInfo] of this.registeredProviders) {
        try {
          const wrapper = this.getWrapper(name);
          if (wrapper && wrapper.circuitBreaker) {
            const isHealthy = wrapper.circuitBreaker.getState() !== 'open';
            providerHealths.push({
              name,
              status: isHealthy ? 'healthy' : 'unhealthy',
              state: wrapper.circuitBreaker.getState(),
              failureRate: wrapper.circuitBreaker.getFailureRate()
            });
          }
        } catch (error) {
          providerHealths.push({
            name,
            status: 'error',
            error: error.message
          });
        }
      }

      const unhealthyCount = providerHealths.filter(p => p.status === 'unhealthy').length;
      const healthyCount = providerHealths.filter(p => p.status === 'healthy').length;

      return {
        status: unhealthyCount === 0 ? 'healthy' : unhealthyCount > healthyCount ? 'unhealthy' : 'degraded',
        registry: {
          initialized: this.initialized,
          totalProviders: this.registeredProviders.size,
          healthyProviders: healthyCount,
          unhealthyProviders: unhealthyCount
        },
        wrapper: wrapperHealth,
        providers: providerHealths,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('[ProviderRegistry] 健康检查失败', error);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 重新初始化
   */
  async reinitialize() {
    this.initialized = false;
    this.registeredProviders.clear();
    this.providerConfigs.clear();

    // 清理现有的包装器服务
    providerWrapperService.wrappers.clear();
    providerWrapperService.providers.clear();

    await this.initialize();
  }

  /**
   * 获取注册的Provider列表
   * @returns {Array} Provider列表
   */
  getRegisteredProviders() {
    return Array.from(this.registeredProviders.keys());
  }

  /**
   * 检查Provider是否已注册
   * @param {string} name - Provider名称
   * @returns {boolean} 是否已注册
   */
  isProviderRegistered(name) {
    return this.registeredProviders.has(name);
  }
}

module.exports = new ProviderRegistryService();