const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

/**
 * Swagger文档生成服务
 *
 * 自动生成和管理API文档：
 * - JSDoc注释解析
 * - OpenAPI规范生成
 * - 文档文件管理
 * - 实时文档更新
 * - 多格式输出
 */
class SwaggerService {
  constructor() {
    this.initialized = false;
    this.swaggerConfig = null;
    this.generatedSpec = null;
    this.outputDir = path.join(__dirname, '../../docs/swagger');
    this.outputFile = path.join(this.outputDir, 'swagger.json');
    this.htmlFile = path.join(this.outputDir, 'index.html');

    this.config = {
      // JSDoc配置
      definition: {
        info: {
          title: 'API文档',
          version: '1.0.0'
        },
        securityDefinitions: {
          Bearer: {
            type: 'apiKey',
            name: 'Authorization',
            in: 'header'
          }
        }
      },

      // 扫描配置
      apis: [
        './src/routes/*.js',
        './src/controllers/*.js',
        './src/middleware/*.js',
        './src/services/*.js'
      ],

      // 输出配置
      outputFormats: ['json', 'html', 'yaml'],
      generateDocs: true,
      autoGenerate: process.env.NODE_ENV !== 'production',

      // 更新配置
      watchMode: process.env.NODE_ENV === 'development',
      updateInterval: 30000, // 30秒
      lastUpdate: 0
    };

    // 统计信息
    this.stats = {
      totalEndpoints: 0,
      totalSchemas: 0,
      generatedAt: null,
      lastUpdate: null,
      updateCount: 0
    };
  }

  /**
   * 初始化Swagger服务
   */
  async initialize() {
    if (this.initialized) {
      logger.warn('[Swagger] Swagger服务已初始化');
      return;
    }

    try {
      // 加载Swagger配置
      this.swaggerConfig = require('../config/swagger.config');

      // 确保输出目录存在
      await this.ensureOutputDirectory();

      // 生成初始文档
      if (this.config.autoGenerate) {
        await this.generateDocs();
      }

      // 启动自动更新
      if (this.config.watchMode) {
        this.startAutoUpdate();
      }

      this.initialized = true;
      logger.info('[Swagger] Swagger文档服务初始化成功');

    } catch (error) {
      logger.error('[Swagger] Swagger服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 生成API文档
   * @returns {Promise<Object>} 生成结果
   */
  async generateDocs() {
    try {
      logger.info('[Swagger] 开始生成API文档...');

      // 生成OpenAPI规范
      this.generatedSpec = swaggerJsdoc(this.config);

      // 更新统计信息
      this.updateStats();

      // 输出到文件
      if (this.config.generateDocs) {
        await this.writeDocs();
      }

      this.stats.generatedAt = new Date();
      this.stats.lastUpdate = Date.now();
      this.stats.updateCount++;

      logger.info(`[Swagger] API文档生成完成: ${this.stats.totalEndpoints}个端点, ${this.stats.totalSchemas}个模型`);

      return {
        success: true,
        spec: this.generatedSpec,
        stats: this.stats,
        outputPath: this.outputDir
      };

    } catch (error) {
      logger.error('[Swagger] 生成API文档失败:', error);
      throw error;
    }
  }

  /**
   * 获取生成的API规范
   * @returns {Object} OpenAPI规范
   */
  getSpec() {
    return this.generatedSpec || null;
  }

  /**
   * 获取API端点列表
   * @returns {Array} 端点列表
   */
  getEndpoints() {
    if (!this.generatedSpec || !this.generatedSpec.paths) {
      return [];
    }

    const endpoints = [];

    for (const [path, methods] of Object.entries(this.generatedSpec.paths)) {
      for (const [method, spec] of Object.entries(methods)) {
        endpoints.push({
          path,
          method: method.toUpperCase(),
          operationId: spec.operationId,
          summary: spec.summary,
          description: spec.description,
          tags: spec.tags || [],
          parameters: spec.parameters || [],
          responses: spec.responses || {}
        });
      }
    }

    return endpoints;
  }

  /**
   * 获取API模型列表
   * @returns {Array} 模型列表
   */
  getSchemas() {
    if (!this.generatedSpec || !this.generatedSpec.components || !this.generatedSpec.components.schemas) {
      return [];
    }

    return Object.entries(this.generatedSpec.components.schemas).map(([name, schema]) => ({
      name,
      schema,
      required: schema.required || [],
      properties: schema.properties || {}
    }));
  }

  /**
   * 按标签分组获取端点
   * @returns {Object} 分组的端点
   */
  getEndpointsByTag() {
    const endpoints = this.getEndpoints();
    const grouped = {};

    endpoints.forEach(endpoint => {
      endpoint.tags.forEach(tag => {
        if (!grouped[tag]) {
          grouped[tag] = [];
        }
        grouped[tag].push(endpoint);
      });
    });

    return grouped;
  }

  /**
   * 验证API文档
   * @returns {Object} 验证结果
   */
  validateDocs() {
    try {
      const spec = this.getSpec();
      if (!spec) {
        return {
          valid: false,
          errors: ['未找到API规范']
        };
      }

      const errors = [];

      // 验证基本结构
      if (!spec.openapi) {
        errors.push('缺少OpenAPI版本');
      }

      if (!spec.info) {
        errors.push('缺少API信息');
      }

      if (!spec.paths || Object.keys(spec.paths).length === 0) {
        errors.push('未定义API路径');
      }

      // 验证路径定义
      for (const [path, methods] of Object.entries(spec.paths || {})) {
        for (const [method, spec] of Object.entries(methods)) {
          if (!spec.summary) {
            errors.push(`${method.toUpperCase()} ${path} 缺少摘要`);
          }
          if (!spec.responses) {
            errors.push(`${method.toUpperCase()} ${path} 缺少响应定义`);
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        spec
      };

    } catch (error) {
      logger.error('[Swagger] 验证API文档失败:', error);
      return {
        valid: false,
        errors: [`验证过程出错: ${error.message}`]
      };
    }
  }

  /**
   * 获取API统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      ...this.stats,
      outputDir: this.outputDir,
      outputFile: this.outputFile,
      htmlFile: this.htmlFile,
      autoGenerate: this.config.autoGenerate,
      watchMode: this.config.watchMode,
      lastChecked: new Date().toISOString()
    };
  }

  /**
   * 手动重新生成文档
   * @returns {Promise<Object>} 生成结果
   */
  async regenerateDocs() {
    logger.info('[Swagger] 手动重新生成API文档');
    return await this.generateDocs();
  }

  /**
   * 启用/禁用自动更新
   * @param {boolean} enabled - 是否启用
   */
  setAutoUpdate(enabled) {
    this.config.watchMode = enabled;

    if (enabled && !this.config.updateTimer) {
      this.startAutoUpdate();
    } else if (!enabled && this.config.updateTimer) {
      clearInterval(this.config.updateTimer);
      this.config.updateTimer = null;
    }

    logger.info(`[Swagger] 自动更新已${enabled ? '启用' : '禁用'}`);
  }

  // 私有方法

  /**
   * 确保输出目录存在
   * @private
   */
  async ensureOutputDirectory() {
    try {
      if (!fs.existsSync(this.outputDir)) {
        fs.mkdirSync(this.outputDir, { recursive: true });
        logger.info(`[Swagger] 创建输出目录: ${this.outputDir}`);
      }
    } catch (error) {
      logger.error('[Swagger] 创建输出目录失败:', error);
      throw error;
    }
  }

  /**
   * 写入文档文件
   * @private
   */
  async writeDocs() {
    try {
      // 写入JSON规范文件
      fs.writeFileSync(this.outputFile, JSON.stringify(this.generatedSpec, null, 2));

      // 生成HTML文档
      if (this.config.outputFormats.includes('html')) {
        await this.generateHtmlDoc();
      }

      // 生成YAML规范文件
      if (this.config.outputFormats.includes('yaml')) {
        await this.generateYamlDoc();
      }

      logger.debug(`[Swagger] 文档写入完成: ${this.outputDir}`);

    } catch (error) {
      logger.error('[Swagger] 写入文档文件失败:', error);
      throw error;
    }
  }

  /**
   * 生成HTML文档
   * @private
   */
  async generateHtmlDoc() {
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.generatedSpec.info.title} - API文档</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css">
    <style>
        body { margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .header { text-align: center; margin-bottom: 30px; }
        .footer { text-align: center; margin-top: 30px; color: #666; }
        .stats { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${this.generatedSpec.info.title}</h1>
        <p>${this.generatedSpec.info.description}</p>
        <div class="stats">
            <strong>文档统计:</strong>
            端点数量: ${this.stats.totalEndpoints} |
            模型数量: ${this.stats.totalSchemas} |
            生成时间: ${new Date(this.stats.generatedAt).toLocaleString()}
        </div>
    </div>

    <div id="swagger-ui"></div>

    <div class="footer">
        <p>API文档生成时间: ${new Date().toLocaleString()}</p>
        <p> powered by Swagger</p>
    </div>

    <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            SwaggerUIBundle({
                url: './swagger.json',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ]
            });
        }
    </script>
</body>
</html>
    `;

    fs.writeFileSync(this.htmlFile, htmlTemplate);
  }

  /**
   * 生成YAML文档
   * @private
   */
  async generateYamlDoc() {
    // 简单的YAML格式输出
    const yamlContent = `openapi: 3.0.0
info:
  title: ${this.generatedSpec.info.title}
  version: ${this.generatedSpec.info.version}
  description: ${this.generatedSpec.info.description}
servers:
${this.generatedSpec.servers.map(server => `  - url: ${server.url}\n    description: ${server.description}`).join('\n')}

tags:
${this.generatedSpec.tags.map(tag => `  - name: ${tag.name}\n    description: ${tag.description}`).join('\n')}

paths:
${JSON.stringify(this.generatedSpec.paths, null, 2)}

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
  schemas:
${Object.entries(this.generatedSpec.components.schemas || {}).map(([name, schema]) => `    ${name}:\n${JSON.stringify(schema, null, 4)}`).join('\n')}
`;

    const yamlFile = this.outputFile.replace('.json', '.yaml');
    fs.writeFileSync(yamlFile, yamlContent);
  }

  /**
   * 更新统计信息
   * @private
   */
  updateStats() {
    if (!this.generatedSpec) return;

    // 统计端点数量
    let endpointCount = 0;
    if (this.generatedSpec.paths) {
      for (const methods of Object.values(this.generatedSpec.paths)) {
        endpointCount += Object.keys(methods).length;
      }
    }
    this.stats.totalEndpoints = endpointCount;

    // 统计模型数量
    this.stats.totalSchemas = this.generatedSpec.components && this.generatedSpec.components.schemas ?
      Object.keys(this.generatedSpec.components.schemas).length : 0;
  }

  /**
   * 启动自动更新
   * @private
   */
  startAutoUpdate() {
    if (this.config.updateTimer) {
      clearInterval(this.config.updateTimer);
    }

    this.config.updateTimer = setInterval(async () => {
      try {
        await this.generateDocs();
      } catch (error) {
        logger.error('[Swagger] 自动更新文档失败:', error);
      }
    }, this.config.updateInterval);

    logger.info(`[Swagger] 自动更新已启动，间隔: ${this.config.updateInterval}ms`);
  }

  /**
   * 停止自动更新
   * @private
   */
  stopAutoUpdate() {
    if (this.config.updateTimer) {
      clearInterval(this.config.updateTimer);
      this.config.updateTimer = null;
      logger.info('[Swagger] 自动更新已停止');
    }
  }

  /**
   * 关闭Swagger服务
   */
  async close() {
    this.stopAutoUpdate();
    this.initialized = false;
    logger.info('[Swagger] Swagger服务已关闭');
  }
}

module.exports = new SwaggerService();