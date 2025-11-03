const securityService = require('../../services/security.service');
const { createSuccessResponse, createErrorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');

class SecurityController {
  /**
   * 获取系统健康状态
   */
  async getHealthStatus(req, res, next) {
    try {
      const checks = await securityService.performSecurityChecks();

      // 计算整体状态
      const overallStatus = this.calculateOverallStatus(checks);

      res.json(createSuccessResponse({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        checks
      }, '获取系统健康状态成功'));
    } catch (error) {
      logger.error('获取系统健康状态失败:', error);
      next(error);
    }
  }

  /**
   * 获取安全审计日志
   */
  async getAuditLogs(req, res, next) {
    try {
      const {
        page = 1,
        limit = 50,
        type,
        severity,
        userId,
        startDate,
        endDate
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        filters: {
          type,
          severity,
          userId,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined
        }
      };

      const result = await securityService.getAuditLogs(options);

      res.json(createSuccessResponse({
        logs: result.logs,
        pagination: result.pagination
      }, '获取安全审计日志成功'));
    } catch (error) {
      logger.error('获取安全审计日志失败:', error);
      next(error);
    }
  }

  /**
   * 获取限流状态
   */
  async getRateLimitStatus(req, res, next) {
    try {
      const { key } = req.query;

      if (!key) {
        return res.status(400).json(
          createErrorResponse('MISSING_KEY', '缺少限流key参数')
        );
      }

      const status = await securityService.getRateLimitStatus(key);

      res.json(createSuccessResponse(status, '获取限流状态成功'));
    } catch (error) {
      logger.error('获取限流状态失败:', error);
      next(error);
    }
  }

  /**
   * 重置限流计数
   */
  async resetRateLimit(req, res, next) {
    try {
      const { key } = req.body;

      if (!key) {
        return res.status(400).json(
          createErrorResponse('MISSING_KEY', '缺少限流key参数')
        );
      }

      await securityService.resetRateLimit(key);

      res.json(createSuccessResponse(null, '重置限流计数成功'));
    } catch (error) {
      logger.error('重置限流计数失败:', error);
      next(error);
    }
  }

  /**
   * 获取可疑活动报告
   */
  async getSuspiciousActivities(req, res, next) {
    try {
      const {
        page = 1,
        limit = 50,
        severity,
        startDate,
        endDate
      } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        filters: {
          severity,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined
        }
      };

      const result = await securityService.getSuspiciousActivities(options);

      res.json(createSuccessResponse({
        activities: result.activities,
        pagination: result.pagination
      }, '获取可疑活动报告成功'));
    } catch (error) {
      logger.error('获取可疑活动报告失败:', error);
      next(error);
    }
  }

  /**
   * 测试数据脱敏
   */
  async testDataMasking(req, res, next) {
    try {
      const { data, rules } = req.body;

      if (!data) {
        return res.status(400).json(
          createErrorResponse('MISSING_DATA', '缺少测试数据')
        );
      }

      const maskedData = securityService.maskSensitiveData(data, rules);

      res.json(createSuccessResponse({
        original: data,
        masked: maskedData,
        rules
      }, '测试数据脱敏成功'));
    } catch (error) {
      logger.error('测试数据脱敏失败:', error);
      next(error);
    }
  }

  /**
   * 获取安全统计
   */
  async getSecurityStats(req, res, next) {
    try {
      const { timeRange = '24h' } = req.query;

      const stats = await securityService.getSecurityStats(timeRange);

      res.json(createSuccessResponse(stats, '获取安全统计成功'));
    } catch (error) {
      logger.error('获取安全统计失败:', error);
      next(error);
    }
  }

  /**
   * 手动触发安全检查
   */
  async triggerSecurityCheck(req, res, next) {
    try {
      const { checkType } = req.body;

      const result = await securityService.triggerSecurityCheck(checkType);

      res.json(createSuccessResponse(result, '触发安全检查成功'));
    } catch (error) {
      logger.error('触发安全检查失败:', error);
      next(error);
    }
  }

  /**
   * 获取安全配置
   */
  async getSecurityConfig(req, res, next) {
    try {
      const config = await securityService.getSecurityConfig();

      res.json(createSuccessResponse(config, '获取安全配置成功'));
    } catch (error) {
      logger.error('获取安全配置失败:', error);
      next(error);
    }
  }

  /**
   * 更新安全配置
   */
  async updateSecurityConfig(req, res, next) {
    try {
      const { config } = req.body;
      const userId = req.user.id;

      const updatedConfig = await securityService.updateSecurityConfig(config, userId);

      res.json(createSuccessResponse(updatedConfig, '更新安全配置成功'));
    } catch (error) {
      logger.error('更新安全配置失败:', error);
      next(error);
    }
  }

  /**
   * 计算整体健康状态
   */
  calculateOverallStatus(checks) {
    const statusPriority = {
      'healthy': 0,
      'warning': 1,
      'unhealthy': 2
    };

    let highestPriority = 0;
    let overallStatus = 'healthy';

    for (const check of checks) {
      const priority = statusPriority[check.status] || 2;
      if (priority > highestPriority) {
        highestPriority = priority;
        overallStatus = check.status;
      }
    }

    return overallStatus;
  }
}

module.exports = new SecurityController();