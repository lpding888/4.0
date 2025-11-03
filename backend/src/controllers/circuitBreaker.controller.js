const logger = require('../utils/logger');
const circuitBreakerService = require('../services/circuit-breaker.service');
const providerWrapperService = require('../services/provider-wrapper.service');
const providerRegistryService = require('../services/provider-registry.service');

/**
 * 熔断器控制器
 *
 * 提供熔断器状态监控和管理API：
 * - 查看熔断器状态
 * - 手动控制熔断器
 * - 获取性能统计
 * - 健康检查
 */
class CircuitBreakerController {
  /**
   * 获取所有熔断器状态
   */
  async getAllCircuitBreakers(req, res) {
    try {
      const states = circuitBreakerService.getAllCircuitBreakerStates();

      res.json({
        success: true,
        data: states,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[CircuitBreakerController] 获取熔断器状态失败:', error);
      res.status(500).json({
        success: false,
        error: '获取熔断器状态失败',
        message: error.message
      });
    }
  }

  /**
   * 获取单个熔断器状态
   */
  async getCircuitBreaker(req, res) {
    try {
      const { name } = req.params;
      const state = circuitBreakerService.getCircuitBreakerState(name);

      if (!state) {
        return res.status(404).json({
          success: false,
          error: '熔断器不存在',
          name
        });
      }

      res.json({
        success: true,
        data: state,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[CircuitBreakerController] 获取熔断器状态失败:', error);
      res.status(500).json({
        success: false,
        error: '获取熔断器状态失败',
        message: error.message
      });
    }
  }

  /**
   * 手动打开熔断器
   */
  async openCircuitBreaker(req, res) {
    try {
      const { name } = req.params;
      const { reason } = req.body;

      const success = circuitBreakerService.openCircuitBreaker(name, reason);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: '熔断器不存在',
          name
        });
      }

      res.json({
        success: true,
        message: `熔断器 ${name} 已手动打开`,
        reason: reason || 'manual',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[CircuitBreakerController] 打开熔断器失败:', error);
      res.status(500).json({
        success: false,
        error: '打开熔断器失败',
        message: error.message
      });
    }
  }

  /**
   * 手动关闭熔断器
   */
  async closeCircuitBreaker(req, res) {
    try {
      const { name } = req.params;

      const success = circuitBreakerService.closeCircuitBreaker(name);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: '熔断器不存在',
          name
        });
      }

      res.json({
        success: true,
        message: `熔断器 ${name} 已手动关闭`,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[CircuitBreakerController] 关闭熔断器失败:', error);
      res.status(500).json({
        success: false,
        error: '关闭熔断器失败',
        message: error.message
      });
    }
  }

  /**
   * 重置熔断器
   */
  async resetCircuitBreaker(req, res) {
    try {
      const { name } = req.params;

      const success = circuitBreakerService.resetCircuitBreaker(name);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: '熔断器不存在',
          name
        });
      }

      res.json({
        success: true,
        message: `熔断器 ${name} 已重置`,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[CircuitBreakerController] 重置熔断器失败:', error);
      res.status(500).json({
        success: false,
        error: '重置熔断器失败',
        message: error.message
      });
    }
  }

  /**
   * 获取Provider状态
   */
  async getProviderStates(req, res) {
    try {
      const states = providerWrapperService.getAllProviderStates();

      res.json({
        success: true,
        data: states,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[CircuitBreakerController] 获取Provider状态失败:', error);
      res.status(500).json({
        success: false,
        error: '获取Provider状态失败',
        message: error.message
      });
    }
  }

  /**
   * 获取单个Provider状态
   */
  async getProviderState(req, res) {
    try {
      const { name } = req.params;
      const stats = providerWrapperService.getProviderStats(name);

      if (!stats) {
        return res.status(404).json({
          success: false,
          error: 'Provider不存在',
          name
        });
      }

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[CircuitBreakerController] 获取Provider状态失败:', error);
      res.status(500).json({
        success: false,
        error: '获取Provider状态失败',
        message: error.message
      });
    }
  }

  /**
   * 重置Provider统计
   */
  async resetProviderStats(req, res) {
    try {
      const { name } = req.params;

      const success = providerWrapperService.resetProviderStats(name);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'Provider不存在',
          name
        });
      }

      res.json({
        success: true,
        message: `Provider ${name} 统计已重置`,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[CircuitBreakerController] 重置Provider统计失败:', error);
      res.status(500).json({
        success: false,
        error: '重置Provider统计失败',
        message: error.message
      });
    }
  }

  /**
   * 获取注册的Provider列表
   */
  async getRegisteredProviders(req, res) {
    try {
      const providers = providerRegistryService.getRegisteredProviders();
      const states = providerRegistryService.getAllProviderStates();

      res.json({
        success: true,
        data: {
          providers,
          states,
          total: providers.length
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[CircuitBreakerController] 获取注册Provider失败:', error);
      res.status(500).json({
        success: false,
        error: '获取注册Provider失败',
        message: error.message
      });
    }
  }

  /**
   * 执行Provider方法（测试用）
   */
  async executeProviderMethod(req, res) {
    try {
      const { providerName, methodName } = req.params;
      const { args = [], options = {} } = req.body;

      // 验证Provider是否存在
      if (!providerRegistryService.isProviderRegistered(providerName)) {
        return res.status(404).json({
          success: false,
          error: 'Provider不存在',
          providerName
        });
      }

      const result = await providerRegistryService.execute(
        providerName,
        methodName,
        args,
        options
      );

      res.json({
        success: true,
        data: result,
        providerName,
        methodName,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[CircuitBreakerController] 执行Provider方法失败:', error);
      res.status(500).json({
        success: false,
        error: '执行Provider方法失败',
        message: error.message,
        providerName: req.params.providerName,
        methodName: req.params.methodName
      });
    }
  }

  /**
   * 熔断器健康检查
   */
  async healthCheck(req, res) {
    try {
      const [circuitBreakerHealth, providerHealth, registryHealth] = await Promise.all([
        circuitBreakerService.healthCheck(),
        providerWrapperService.healthCheck(),
        providerRegistryService.healthCheck()
      ]);

      const overallStatus = [
        circuitBreakerHealth.status,
        providerHealth.status,
        registryHealth.status
      ].includes('unhealthy') ? 'unhealthy' :
        [circuitBreakerHealth.status, providerHealth.status, registryHealth.status]
          .includes('degraded') ? 'degraded' : 'healthy';

      res.json({
        success: true,
        data: {
          status: overallStatus,
          services: {
            circuitBreaker: circuitBreakerHealth,
            providerWrapper: providerHealth,
            providerRegistry: registryHealth
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[CircuitBreakerController] 健康检查失败:', error);
      res.status(500).json({
        success: false,
        error: '健康检查失败',
        message: error.message,
        status: 'unhealthy'
      });
    }
  }

  /**
   * 获取熔断器统计信息
   */
  async getCircuitBreakerStats(req, res) {
    try {
      const stats = circuitBreakerService.getStats();

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[CircuitBreakerController] 获取熔断器统计失败:', error);
      res.status(500).json({
        success: false,
        error: '获取熔断器统计失败',
        message: error.message
      });
    }
  }

  /**
   * 清理不活跃的熔断器
   */
  async cleanupInactiveCircuitBreakers(req, res) {
    try {
      const { inactiveThresholdMs = 3600000 } = req.query; // 默认1小时
      const cleanedCount = circuitBreakerService.cleanupInactiveCircuitBreakers(
        parseInt(inactiveThresholdMs)
      );

      res.json({
        success: true,
        message: `清理完成，删除了 ${cleanedCount} 个不活跃的熔断器`,
        cleanedCount,
        thresholdMs: parseInt(inactiveThresholdMs),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[CircuitBreakerController] 清理熔断器失败:', error);
      res.status(500).json({
        success: false,
        error: '清理熔断器失败',
        message: error.message
      });
    }
  }

  /**
   * 批量操作熔断器
   */
  async batchOperateCircuitBreakers(req, res) {
    try {
      const { operation, names } = req.body;

      if (!operation || !Array.isArray(names) || names.length === 0) {
        return res.status(400).json({
          success: false,
          error: '参数错误',
          message: '需要提供 operation 和 names 数组'
        });
      }

      const results = [];
      let successCount = 0;
      let failureCount = 0;

      for (const name of names) {
        try {
          let success = false;
          switch (operation) {
            case 'open':
              success = circuitBreakerService.openCircuitBreaker(name, 'batch operation');
              break;
            case 'close':
              success = circuitBreakerService.closeCircuitBreaker(name);
              break;
            case 'reset':
              success = circuitBreakerService.resetCircuitBreaker(name);
              break;
            default:
              throw new Error(`不支持的操作: ${operation}`);
          }

          results.push({
            name,
            success,
            operation
          });

          if (success) {
            successCount++;
          } else {
            failureCount++;
          }

        } catch (error) {
          results.push({
            name,
            success: false,
            operation,
            error: error.message
          });
          failureCount++;
        }
      }

      res.json({
        success: true,
        data: {
          operation,
          results,
          summary: {
            total: names.length,
            successCount,
            failureCount
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[CircuitBreakerController] 批量操作熔断器失败:', error);
      res.status(500).json({
        success: false,
        error: '批量操作熔断器失败',
        message: error.message
      });
    }
  }
}

module.exports = new CircuitBreakerController();