const express = require('express');
const circuitBreakerController = require('../controllers/circuitBreaker.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { validateCircuitBreakerOperation } = require('../middleware/validation.middleware');

const router = express.Router();

/**
 * 熔断器监控和管理API路由
 */

// 公开路由 - 健康检查
router.get('/health', circuitBreakerController.healthCheck);

// 需要认证的路由
router.use(authenticate);

// 需要管理员权限的路由
router.use(authorize('admin'));

/**
 * 熔断器状态查询
 */
router.get('/circuit-breakers', circuitBreakerController.getAllCircuitBreakers);
router.get('/circuit-breakers/stats', circuitBreakerController.getCircuitBreakerStats);
router.get('/circuit-breakers/:name', circuitBreakerController.getCircuitBreaker);

/**
 * Provider状态查询
 */
router.get('/providers', circuitBreakerController.getProviderStates);
router.get('/providers/registered', circuitBreakerController.getRegisteredProviders);
router.get('/providers/:name', circuitBreakerController.getProviderState);

/**
 * 熔断器控制操作
 */
router.post('/circuit-breakers/:name/open',
  validateCircuitBreakerOperation,
  circuitBreakerController.openCircuitBreaker
);

router.post('/circuit-breakers/:name/close',
  validateCircuitBreakerOperation,
  circuitBreakerController.closeCircuitBreaker
);

router.post('/circuit-breakers/:name/reset',
  validateCircuitBreakerOperation,
  circuitBreakerController.resetCircuitBreaker
);

/**
 * Provider统计操作
 */
router.post('/providers/:name/reset-stats',
  validateCircuitBreakerOperation,
  circuitBreakerController.resetProviderStats
);

/**
 * 批量操作
 */
router.post('/circuit-breakers/batch',
  validateCircuitBreakerOperation,
  circuitBreakerController.batchOperateCircuitBreakers
);

/**
 * 清理操作
 */
router.delete('/circuit-breakers/cleanup',
  validateCircuitBreakerOperation,
  circuitBreakerController.cleanupInactiveCircuitBreakers
);

/**
 * 测试操作（仅在开发环境）
 */
if (process.env.NODE_ENV === 'development') {
  router.post('/providers/:providerName/:methodName/execute',
    circuitBreakerController.executeProviderMethod
  );
}

module.exports = router;