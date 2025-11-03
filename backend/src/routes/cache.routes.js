const express = require('express');
const router = express.Router();
const cacheService = require('../services/cache.service');
const cacheSubscriberService = require('../services/cache-subscriber.service');
const { authenticate, requireRole } = require('../middlewares/auth.middleware');
const logger = require('../utils/logger');

/**
 * 缓存管理路由
 *
 * 提供缓存相关的管理接口
 */

// 获取缓存统计
router.get('/stats', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const stats = cacheService.getStats();
    const subscriberStatus = cacheSubscriberService.getStatus();

    res.json({
      success: true,
      data: {
        cache: stats,
        subscriber: subscriberStatus,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('[CacheRoutes] 获取缓存统计失败', error);
    next(error);
  }
});

// 缓存健康检查
router.get('/health', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const health = await cacheService.healthCheck();

    res.json({
      success: true,
      data: health
    });

  } catch (error) {
    logger.error('[CacheRoutes] 缓存健康检查失败', error);
    next(error);
  }
});

// 手动失效缓存
router.post('/invalidate', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { namespace, pattern, reason } = req.body;

    if (!namespace) {
      return res.status(400).json({
        success: false,
        error: {
          code: 4001,
          message: '缺少命名空间参数'
        }
      });
    }

    await cacheSubscriberService.invalidateCache(
      namespace,
      pattern || '*',
      reason || 'admin_manual'
    );

    res.json({
      success: true,
      message: '缓存失效请求已发送',
      data: {
        namespace,
        pattern: pattern || '*',
        reason: reason || 'admin_manual'
      }
    });

  } catch (error) {
    logger.error('[CacheRoutes] 缓存失效失败', error);
    next(error);
  }
});

// 版本更新
router.post('/version/update', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { namespace } = req.body;

    if (!namespace) {
      return res.status(400).json({
        success: false,
        error: {
          code: 4001,
          message: '缺少命名空间参数'
        }
      });
    }

    const newVersion = await cacheSubscriberService.updateVersion(namespace);

    res.json({
      success: true,
      message: '版本更新成功',
      data: {
        namespace,
        newVersion
      }
    });

  } catch (error) {
    logger.error('[CacheRoutes] 版本更新失败', error);
    next(error);
  }
});

// 缓存预热
router.post('/preload', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { namespace, items, priority = 'normal' } = req.body;

    if (!namespace || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 4001,
          message: '缺少命名空间或预热项目参数'
        }
      });
    }

    // 验证预热项目格式
    const validItems = items.filter(item =>
      item.key && (item.value !== undefined) && typeof item.ttl === 'number'
    );

    if (validItems.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 4001,
          message: '没有有效的预热项目'
        }
      });
    }

    await cacheSubscriberService.triggerPreload(namespace, validItems, priority);

    res.json({
      success: true,
      message: '缓存预热请求已发送',
      data: {
        namespace,
        itemCount: validItems.length,
        priority
      }
    });

  } catch (error) {
    logger.error('[CacheRoutes] 缓存预热失败', error);
    next(error);
  }
});

// 批量删除缓存
router.delete('/batch', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { pattern } = req.body;

    if (!pattern) {
      return res.status(400).json({
        success: false,
        error: {
          code: 4001,
          message: '缺少模式参数'
        }
      });
    }

    const deleteCount = await cacheService.deletePattern(pattern);

    res.json({
      success: true,
      message: '批量删除完成',
      data: {
        pattern,
        deleteCount
      }
    });

  } catch (error) {
    logger.error('[CacheRoutes] 批量删除缓存失败', error);
    next(error);
  }
});

// 重置缓存统计
router.post('/stats/reset', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    cacheService.resetStats();

    res.json({
      success: true,
      message: '缓存统计已重置'
    });

  } catch (error) {
    logger.error('[CacheRoutes] 重置缓存统计失败', error);
    next(error);
  }
});

// 广播健康检查
router.post('/health/broadcast', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    await cacheSubscriberService.broadcastHealthCheck();

    res.json({
      success: true,
      message: '健康检查广播已发送'
    });

  } catch (error) {
    logger.error('[CacheRoutes] 广播健康检查失败', error);
    next(error);
  }
});

// 获取订阅服务状态
router.get('/subscriber/status', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const status = cacheSubscriberService.getStatus();

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('[CacheRoutes] 获取订阅服务状态失败', error);
    next(error);
  }
});

// 重启订阅服务
router.post('/subscriber/restart', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    await cacheSubscriberService.stop();
    await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
    await cacheSubscriberService.start();

    res.json({
      success: true,
      message: '订阅服务重启成功'
    });

  } catch (error) {
    logger.error('[CacheRoutes] 重启订阅服务失败', error);
    next(error);
  }
});

// 公共缓存统计接口（无需认证）
router.get('/public/stats', async (req, res, next) => {
  try {
    const stats = cacheService.getStats();

    // 只返回基本的统计信息，隐藏敏感数据
    const publicStats = {
      hitRate: stats.hitRate,
      memoryHitRate: stats.memoryHitRate,
      memoryCacheSize: stats.memoryCacheSize,
      uptime: stats.uptime
    };

    res.json({
      success: true,
      data: publicStats
    });

  } catch (error) {
    logger.error('[CacheRoutes] 获取公共缓存统计失败', error);
    next(error);
  }
});

module.exports = router;