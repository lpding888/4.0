const systemConfigService = require('../services/systemConfig.service');
const logger = require('../utils/logger');

/**
 * 系统配置控制器
 * 提供配置管理的API接口
 */
class SystemConfigController {
  /**
   * 获取配置值
   * GET /api/system-config/:key
   */
  async getValue(req, res, next) {
    try {
      const { key } = req.params;
      const { defaultValue = null } = req.query;

      const value = await systemConfigService.get(key, defaultValue);

      res.json({
        success: true,
        data: {
          key,
          value,
          exists: value !== null
        }
      });
    } catch (error) {
      logger.error(`[SystemConfigController] 获取配置值失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 获取分类配置
   * GET /api/system-config/category/:category
   */
  async getCategory(req, res, next) {
    try {
      const { category } = req.params;
      const { includeSecrets = false } = req.query;

      const configs = await systemConfigService.getByCategory(
        category,
        includeSecrets === 'true'
      );

      res.json({
        success: true,
        data: {
          category,
          configs
        }
      });
    } catch (error) {
      logger.error(`[SystemConfigController] 获取分类配置失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 获取配置列表
   * GET /api/system-config
   */
  async list(req, res, next) {
    try {
      const {
        category = null,
        page = 1,
        limit = 50,
        includeInactive = false
      } = req.query;

      const result = await systemConfigService.list({
        category,
        page: parseInt(page),
        limit: parseInt(limit),
        includeInactive: includeInactive === 'true'
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error(`[SystemConfigController] 获取配置列表失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 获取配置分类
   * GET /api/system-config/categories
   */
  async getCategories(req, res, next) {
    try {
      const categories = await systemConfigService.getCategories();

      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      logger.error(`[SystemConfigController] 获取配置分类失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 设置配置值
   * PUT /api/system-config/:key
   */
  async setValue(req, res, next) {
    try {
      const { key } = req.params;
      const { value, type = 'string', description = '' } = req.body;
      const userId = req.user?.id;

      if (value === undefined) {
        return res.status(400).json({
          success: false,
          error: {
            code: 4001,
            message: '配置值不能为空'
          }
        });
      }

      await systemConfigService.set(key, value, type, description, userId);

      res.json({
        success: true,
        message: '配置更新成功',
        data: {
          key,
          value,
          type,
          description
        }
      });
    } catch (error) {
      logger.error(`[SystemConfigController] 设置配置值失败: ${error.message}`, error);

      if (error.message.includes('系统配置不可删除')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 4003,
            message: error.message
          }
        });
      }

      next(error);
    }
  }

  /**
   * 批量设置配置
   * POST /api/system-config/batch
   */
  async setBatch(req, res, next) {
    try {
      const { configs } = req.body;
      const userId = req.user?.id;

      if (!Array.isArray(configs) || configs.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 4001,
            message: '配置数组不能为空'
          }
        });
      }

      // 验证配置格式
      for (const config of configs) {
        if (!config.key || config.value === undefined) {
          return res.status(400).json({
            success: false,
            error: {
              code: 4001,
              message: '每个配置必须包含key和value字段'
            }
          });
        }
      }

      await systemConfigService.setMultiple(configs, userId);

      res.json({
        success: true,
        message: `批量更新成功，共更新${configs.length}个配置`,
        data: {
          updatedCount: configs.length
        }
      });
    } catch (error) {
      logger.error(`[SystemConfigController] 批量设置配置失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 删除配置
   * DELETE /api/system-config/:key
   */
  async delete(req, res, next) {
    try {
      const { key } = req.params;
      const userId = req.user?.id;

      const deleted = await systemConfigService.delete(key, userId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: {
            code: 4004,
            message: '配置不存在'
          }
        });
      }

      res.json({
        success: true,
        message: '配置删除成功',
        data: {
          key
        }
      });
    } catch (error) {
      logger.error(`[SystemConfigController] 删除配置失败: ${error.message}`, error);

      if (error.message.includes('系统配置不可删除')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 4003,
            message: error.message
          }
        });
      }

      next(error);
    }
  }

  /**
   * 重新加载配置缓存
   * POST /api/system-config/reload-cache
   */
  async reloadCache(req, res, next) {
    try {
      await systemConfigService.reloadCache();

      res.json({
        success: true,
        message: '配置缓存重新加载成功'
      });
    } catch (error) {
      logger.error(`[SystemConfigController] 重新加载缓存失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 导出配置
   * GET /api/system-config/export
   */
  async export(req, res, next) {
    try {
      const { category = null, includeSecrets = false } = req.query;

      const result = await systemConfigService.list({
        category,
        limit: 1000,
        includeInactive: false
      });

      // 过滤敏感配置
      const exportData = result.configs.filter(config => {
        return includeSecrets === 'true' || !config.is_secret;
      }).map(config => ({
        key: config.config_key,
        value: config.config_value,
        type: config.config_type,
        category: config.category,
        description: config.description
      }));

      res.json({
        success: true,
        data: {
          configs: exportData,
          exportedAt: new Date().toISOString(),
          count: exportData.length
        }
      });
    } catch (error) {
      logger.error(`[SystemConfigController] 导出配置失败: ${error.message}`, error);
      next(error);
    }
  }

  /**
   * 导入配置
   * POST /api/system-config/import
   */
  async import(req, res, next) {
    try {
      const { configs, overwrite = false } = req.body;
      const userId = req.user?.id;

      if (!Array.isArray(configs) || configs.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 4001,
            message: '配置数组不能为空'
          }
        });
      }

      const results = {
        success: 0,
        skipped: 0,
        failed: 0,
        errors: []
      };

      for (const config of configs) {
        try {
          const { key, value, type = 'string', description = '' } = config;

          if (!key || value === undefined) {
            results.failed++;
            results.errors.push(`配置${config.key || '(未知)'}格式不正确`);
            continue;
          }

          // 检查是否已存在
          const existing = await systemConfigService.get(key);
          if (existing && !overwrite) {
            results.skipped++;
            continue;
          }

          await systemConfigService.set(key, value, type, description, userId);
          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push(`配置${config.key}导入失败: ${error.message}`);
        }
      }

      res.json({
        success: true,
        message: '配置导入完成',
        data: results
      });
    } catch (error) {
      logger.error(`[SystemConfigController] 导入配置失败: ${error.message}`, error);
      next(error);
    }
  }
}

module.exports = new SystemConfigController();