const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * ProviderHealth Service - Provider健康监控服务
 * 负责定期检查各Provider的健康状态并更新数据库
 */
class ProviderHealthService {
  /**
   * 执行所有Provider的健康检查
   */
  async checkAllProviders() {
    try {
      logger.info('[ProviderHealthService] 开始健康检查');

      // 1. 获取所有需要监控的Provider配置
      const providers = await db('provider_configs')
        .where('is_enabled', true)
        .whereNull('deleted_at')
        .select('*');

      if (providers.length === 0) {
        logger.info('[ProviderHealthService] 没有需要检查的Provider');
        return;
      }

      logger.info(`[ProviderHealthService] 检查${providers.length}个Provider`);

      // 2. 并发执行健康检查
      const checkPromises = providers.map(provider =>
        this.checkProviderHealth(provider).catch(err => {
          logger.error(
            `[ProviderHealthService] Provider健康检查异常 ` +
            `providerId=${provider.provider_id} error=${err.message}`
          );
          return null;
        })
      );

      const results = await Promise.all(checkPromises);

      // 3. 统计结果
      const successCount = results.filter(r => r && r.isHealthy).length;
      const failCount = results.filter(r => r && !r.isHealthy).length;

      logger.info(
        `[ProviderHealthService] 健康检查完成 ` +
        `total=${providers.length} success=${successCount} fail=${failCount}`
      );

      return {
        total: providers.length,
        success: successCount,
        fail: failCount
      };

    } catch (error) {
      logger.error(`[ProviderHealthService] 健康检查失败: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * 检查单个Provider的健康状态
   * @param {Object} provider - Provider配置
   * @returns {Promise<Object>} {isHealthy, responseTime}
   */
  async checkProviderHealth(provider) {
    const { provider_id, type, config } = provider;
    const startTime = Date.now();

    try {
      let isHealthy = false;
      let errorMessage = null;

      // 根据type执行不同的健康检查
      switch (type) {
        case 'SYNC_IMAGE_PROCESS':
          isHealthy = await this.checkSyncImageProcessHealth(config);
          break;

        case 'RUNNINGHUB_WORKFLOW':
          isHealthy = await this.checkRunninghubHealth(config);
          break;

        case 'SCF_POST_PROCESS':
          isHealthy = await this.checkScfHealth(config);
          break;

        default:
          logger.warn(`[ProviderHealthService] 未知的Provider类型: ${type}`);
          isHealthy = true; // 未知类型默认健康
      }

      const responseTime = Date.now() - startTime;

      // 更新健康检查记录
      await this.updateHealthRecord(provider_id, isHealthy, responseTime, errorMessage);

      logger.info(
        `[ProviderHealthService] Provider检查完成 ` +
        `providerId=${provider_id} healthy=${isHealthy} responseTime=${responseTime}ms`
      );

      return { isHealthy, responseTime };

    } catch (error) {
      const responseTime = Date.now() - startTime;

      logger.error(
        `[ProviderHealthService] Provider检查失败 ` +
        `providerId=${provider_id} error=${error.message}`
      );

      // 更新为不健康状态
      await this.updateHealthRecord(provider_id, false, responseTime, error.message);

      return { isHealthy: false, responseTime };
    }
  }

  /**
   * 检查同步图片处理Provider健康状态
   * @param {Object} config - Provider配置
   * @returns {Promise<boolean>}
   */
  async checkSyncImageProcessHealth(config) {
    try {
      // TODO: 实现实际的健康检查逻辑
      // 例如: ping腾讯云数据万象API
      // 暂时返回true
      logger.debug('[ProviderHealthService] 检查同步图片处理Provider (暂时返回健康)');
      return true;

    } catch (error) {
      logger.error(`[ProviderHealthService] 同步图片处理健康检查失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 检查RunningHub工作流Provider健康状态
   * @param {Object} config - Provider配置
   * @returns {Promise<boolean>}
   */
  async checkRunninghubHealth(config) {
    try {
      // TODO: 实现实际的健康检查逻辑
      // 例如: 调用RunningHub的health endpoint
      logger.debug('[ProviderHealthService] 检查RunningHub Provider (暂时返回健康)');
      return true;

    } catch (error) {
      logger.error(`[ProviderHealthService] RunningHub健康检查失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 检查SCF云函数Provider健康状态
   * @param {Object} config - Provider配置
   * @returns {Promise<boolean>}
   */
  async checkScfHealth(config) {
    try {
      // TODO: 实现实际的健康检查逻辑
      // 例如: 调用云函数的health check接口
      logger.debug('[ProviderHealthService] 检查SCF Provider (暂时返回健康)');
      return true;

    } catch (error) {
      logger.error(`[ProviderHealthService] SCF健康检查失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 更新Provider健康检查记录
   * @param {string} providerId - Provider ID
   * @param {boolean} isHealthy - 是否健康
   * @param {number} responseTime - 响应时间(ms)
   * @param {string} errorMessage - 错误信息
   */
  async updateHealthRecord(providerId, isHealthy, responseTime, errorMessage = null) {
    try {
      const now = new Date();

      // 查询是否已存在记录
      const existing = await db('provider_health_checks')
        .where('provider_id', providerId)
        .first();

      if (existing) {
        // 更新现有记录
        const updateData = {
          is_healthy: isHealthy,
          last_check_at: now,
          response_time_ms: responseTime,
          error_message: errorMessage,
          consecutive_failures: isHealthy ? 0 : (existing.consecutive_failures || 0) + 1,
          updated_at: now
        };

        // 如果从不健康恢复为健康,记录恢复时间
        if (isHealthy && !existing.is_healthy) {
          updateData.last_recovery_at = now;
        }

        await db('provider_health_checks')
          .where('provider_id', providerId)
          .update(updateData);

      } else {
        // 创建新记录
        await db('provider_health_checks').insert({
          provider_id: providerId,
          is_healthy: isHealthy,
          last_check_at: now,
          response_time_ms: responseTime,
          error_message: errorMessage,
          consecutive_failures: isHealthy ? 0 : 1,
          created_at: now,
          updated_at: now
        });
      }

    } catch (error) {
      logger.error(
        `[ProviderHealthService] 更新健康记录失败 providerId=${providerId}`,
        error
      );
    }
  }

  /**
   * 获取所有Provider的健康状态摘要
   * @returns {Promise<Array>}
   */
  async getHealthSummary() {
    try {
      const healthRecords = await db('provider_health_checks as phc')
        .join('provider_configs as pc', 'phc.provider_id', 'pc.provider_id')
        .where('pc.is_enabled', true)
        .whereNull('pc.deleted_at')
        .select(
          'phc.provider_id',
          'pc.provider_name',
          'pc.type',
          'phc.is_healthy',
          'phc.last_check_at',
          'phc.response_time_ms',
          'phc.consecutive_failures',
          'phc.error_message'
        )
        .orderBy('phc.last_check_at', 'desc');

      return healthRecords;

    } catch (error) {
      logger.error(`[ProviderHealthService] 获取健康摘要失败: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * 获取不健康的Provider列表
   * @returns {Promise<Array>}
   */
  async getUnhealthyProviders() {
    try {
      const unhealthyProviders = await db('provider_health_checks as phc')
        .join('provider_configs as pc', 'phc.provider_id', 'pc.provider_id')
        .where('pc.is_enabled', true)
        .whereNull('pc.deleted_at')
        .where('phc.is_healthy', false)
        .select(
          'phc.provider_id',
          'pc.provider_name',
          'pc.type',
          'phc.consecutive_failures',
          'phc.last_check_at',
          'phc.error_message'
        )
        .orderBy('phc.consecutive_failures', 'desc');

      return unhealthyProviders;

    } catch (error) {
      logger.error(`[ProviderHealthService] 获取不健康Provider失败: ${error.message}`, error);
      throw error;
    }
  }
}

module.exports = new ProviderHealthService();
