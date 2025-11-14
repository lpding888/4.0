import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger.js';

type AnyObject = Record<string, unknown>;

interface SwaggerConfig extends Record<string, unknown> {
  definition: { info: { title: string; version: string } };
  apis: string[];
  outputFormats: string[];
  generateDocs: boolean;
  autoGenerate: boolean;
  watchMode: boolean;
  updateInterval: number;
  lastUpdate: number;
  updateTimer?: NodeJS.Timeout | null;
}

interface SwaggerStats {
  totalEndpoints: number;
  totalSchemas: number;
  generatedAt: Date | null;
  lastUpdate: number | null;
  updateCount: number;
}

interface GenerateDocsResult {
  success: boolean;
  spec: AnyObject;
  stats: SwaggerStats | Record<string, unknown>;
  outputPath: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  spec?: AnyObject;
}

interface SwaggerEndpoint {
  path: string;
  method: string;
  operationId?: unknown;
  summary?: unknown;
  description?: unknown;
  tags: unknown[];
  parameters: unknown[];
  responses: Record<string, unknown>;
}

interface SchemaEntry {
  name: string;
  schema: unknown;
  required: unknown[];
  properties: Record<string, unknown>;
}

class SwaggerService {
  private initialized = false;
  private swaggerConfig: AnyObject | null = null;
  private generatedSpec: AnyObject | null = null;
  private outputDir = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '../../docs/swagger'
  );
  private outputFile = path.join(this.outputDir, 'swagger.json');
  private htmlFile = path.join(this.outputDir, 'index.html');

  private config: SwaggerConfig = {
    definition: {
      info: { title: 'API文档', version: '1.0.0' }
    },
    apis: [
      './src/routes/*.js',
      './src/controllers/*.js',
      './src/middlewares/*.js',
      './src/services/*.js'
    ],
    outputFormats: ['json', 'html', 'yaml'],
    generateDocs: true,
    autoGenerate: process.env.NODE_ENV !== 'production',
    watchMode: process.env.NODE_ENV === 'development',
    updateInterval: 30000,
    lastUpdate: 0
  };

  private stats: SwaggerStats = {
    totalEndpoints: 0,
    totalSchemas: 0,
    generatedAt: null,
    lastUpdate: null,
    updateCount: 0
  };

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('[Swagger] Swagger服务已初始化');
      return;
    }
    try {
      // 动态引入 TS 配置（.js 扩展保持 NodeNext 约束）

      this.swaggerConfig = (await import('../config/swagger.config.js')).default ?? null;
      await this.ensureOutputDirectory();
      if (this.config.autoGenerate) await this.generateDocs();
      if (this.config.watchMode) this.startAutoUpdate();
      this.initialized = true;
      logger.info('[Swagger] Swagger文档服务初始化成功');
    } catch (error) {
      logger.error('[Swagger] Swagger服务初始化失败:', error);
      throw error;
    }
  }

  async generateDocs(): Promise<GenerateDocsResult> {
    try {
      logger.info('[Swagger] 开始生成API文档...');
      this.generatedSpec = swaggerJsdoc(this.config as Record<string, unknown>) as AnyObject;
      this.updateStats();
      if (this.config.generateDocs) await this.writeDocs();
      this.stats.generatedAt = new Date();
      this.stats.lastUpdate = Date.now();
      this.stats.updateCount++;
      logger.info(
        `[Swagger] API文档生成完成: ${this.stats.totalEndpoints}个端点, ${this.stats.totalSchemas}个模型`
      );
      return {
        success: true,
        spec: this.generatedSpec,
        stats: this.stats,
        outputPath: this.outputDir
      };
    } catch (error) {
      const err = error as Error;
      logger.error('[Swagger] 生成API文档失败:', error);
      throw error;
    }
  }

  getSpec(): AnyObject | null {
    return this.generatedSpec || null;
  }

  getEndpoints(): SwaggerEndpoint[] {
    if (!this.generatedSpec || !this.generatedSpec.paths) return [];
    const endpoints: SwaggerEndpoint[] = [];
    for (const [p, methods] of Object.entries(this.generatedSpec.paths)) {
      for (const [method, spec] of Object.entries(methods as Record<string, unknown>)) {
        const specRecord = spec as Record<string, unknown>;
        endpoints.push({
          path: p,
          method: method.toUpperCase(),
          operationId: specRecord.operationId,
          summary: specRecord.summary,
          description: specRecord.description,
          tags: (specRecord.tags || []) as unknown[],
          parameters: (specRecord.parameters || []) as unknown[],
          responses: (specRecord.responses || {}) as Record<string, unknown>
        });
      }
    }
    return endpoints;
  }

  getEndpointsByTag(): Record<string, SwaggerEndpoint[]> {
    const grouped: Record<string, SwaggerEndpoint[]> = {};
    this.getEndpoints().forEach((e) => {
      (e.tags as unknown[]).forEach((tag) => {
        const tagStr = String(tag);
        (grouped[tagStr] ||= []).push(e);
      });
    });
    return grouped;
  }

  getSchemas(): SchemaEntry[] {
    const spec = this.generatedSpec as {
      components?: {
        schemas?: Record<string, unknown>;
      };
    };
    const schemas = spec?.components?.schemas;
    if (!schemas) return [];
    return Object.entries(schemas).map(([name, schema]) => {
      const schemaRecord = schema as Record<string, unknown>;
      return {
        name,
        schema,
        required: (schemaRecord.required || []) as unknown[],
        properties: (schemaRecord.properties || {}) as Record<string, unknown>
      };
    });
  }

  validateDocs(): ValidationResult {
    try {
      const spec = this.getSpec();
      if (!spec) return { valid: false, errors: ['未找到API规范'] };
      const errors: string[] = [];
      const specRecord = spec as Record<string, unknown>;
      if (!specRecord.openapi) errors.push('缺少OpenAPI版本');
      if (!specRecord.info) errors.push('缺少API信息');
      const paths = specRecord.paths as Record<string, unknown> | undefined;
      if (!paths || Object.keys(paths).length === 0) errors.push('未定义API路径');
      for (const [p, methods] of Object.entries(paths || {})) {
        for (const [method, mSpec] of Object.entries(methods as Record<string, unknown>)) {
          const mSpecRecord = mSpec as Record<string, unknown>;
          if (!mSpecRecord.summary) errors.push(`${method.toUpperCase()} ${p} 缺少摘要`);
          if (!mSpecRecord.responses) errors.push(`${method.toUpperCase()} ${p} 缺少响应定义`);
        }
      }
      return { valid: errors.length === 0, errors, spec };
    } catch (error) {
      const err = error as Error;
      logger.error('[Swagger] 验证API文档失败:', error);
      return { valid: false, errors: [`验证过程出错: ${err.message}`] };
    }
  }

  getStats(): Record<string, unknown> {
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

  async regenerateDocs(): Promise<GenerateDocsResult> {
    logger.info('[Swagger] 手动重新生成API文档');
    return await this.generateDocs();
  }

  setAutoUpdate(enabled: boolean): void {
    this.config.watchMode = enabled;
    if (enabled && !this.config.updateTimer) this.startAutoUpdate();
    else if (!enabled && this.config.updateTimer) {
      clearInterval(this.config.updateTimer);
      this.config.updateTimer = null;
    }
    logger.info(`[Swagger] 自动更新已${enabled ? '启用' : '禁用'}`);
  }

  private async ensureOutputDirectory(): Promise<void> {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
      logger.info(`[Swagger] 创建输出目录: ${this.outputDir}`);
    }
  }

  private async writeDocs(): Promise<void> {
    fs.writeFileSync(this.outputFile, JSON.stringify(this.generatedSpec, null, 2));
    if (this.config.outputFormats.includes('html')) await this.generateHtmlDoc();
    if (this.config.outputFormats.includes('yaml')) await this.generateYamlDoc();
    logger.debug(`[Swagger] 文档写入完成: ${this.outputDir}`);
  }

  private async generateHtmlDoc(): Promise<void> {
    const spec = this.generatedSpec as Record<string, unknown>;
    const specInfo = spec.info as Record<string, unknown>;
    const generatedAtDate = this.stats.generatedAt || new Date();
    const htmlTemplate = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${specInfo.title} - API文档</title><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css"></head><body><div class="header"><h1>${specInfo.title}</h1><p>${specInfo.description ?? ''}</p><div class="stats"><strong>文档统计:</strong> 端点数量: ${this.stats.totalEndpoints} | 模型数量: ${this.stats.totalSchemas} | 生成时间: ${new Date(generatedAtDate).toLocaleString()}</div></div><div id="swagger-ui"></div><div class="footer"><p>API文档生成时间: ${new Date().toLocaleString()}</p><p> powered by Swagger</p></div><script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script><script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-standalone-preset.js"></script><script>window.onload=function(){SwaggerUIBundle({url:'./swagger.json',dom_id:'#swagger-ui',deepLinking:true,presets:[SwaggerUIBundle.presets.apis,SwaggerUIStandalonePreset],plugins:[SwaggerUIBundle.plugins.DownloadUrl]});}</script></body></html>`;
    fs.writeFileSync(this.htmlFile, htmlTemplate);
  }

  private async generateYamlDoc(): Promise<void> {
    const spec = this.generatedSpec as Record<string, unknown>;
    interface ServerEntry {
      url: string;
      description: string;
    }
    interface TagEntry {
      name: string;
      description: string;
    }
    const servers = (spec.servers || []) as ServerEntry[];
    const tags = (spec.tags || []) as TagEntry[];
    const specInfo = spec.info as Record<string, unknown>;
    const componentSchemas =
      (spec.components as Record<string, unknown> | undefined)?.schemas ?? {};
    const yamlContent = `openapi: 3.0.0\ninfo:\n  title: ${specInfo.title}\n  version: ${specInfo.version}\n  description: ${specInfo.description}\nservers:\n${servers.map((s) => `  - url: ${s.url}\n    description: ${s.description}`).join('\n')}\n\ntags:\n${tags.map((t) => `  - name: ${t.name}\n    description: ${t.description}`).join('\n')}\n\npaths:\n${JSON.stringify(spec.paths, null, 2)}\n\ncomponents:\n  securitySchemes:\n    bearerAuth:\n      type: http\n      scheme: bearer\n      bearerFormat: JWT\n  schemas:\n${Object.entries(
      componentSchemas as Record<string, unknown>
    )
      .map(([name, schema]) => `    ${name}:\n${JSON.stringify(schema, null, 4)}`)
      .join('\n')}\n`;
    const yamlFile = this.outputFile.replace('.json', '.yaml');
    fs.writeFileSync(yamlFile, yamlContent);
  }

  private updateStats(): void {
    const spec = this.generatedSpec as Record<string, unknown>;
    let endpointCount = 0;
    if (spec?.paths) {
      const paths = spec.paths as Record<string, unknown>;
      endpointCount = Object.values(paths).reduce(
        (acc: number, methods: unknown) =>
          acc + Object.keys(methods as Record<string, unknown>).length,
        0
      );
    }
    this.stats.totalEndpoints = endpointCount;
    const components = spec?.components as Record<string, unknown> | undefined;
    const schemas = components?.schemas as Record<string, unknown> | undefined;
    this.stats.totalSchemas = schemas ? Object.keys(schemas).length : 0;
  }

  private startAutoUpdate(): void {
    if (this.config.updateTimer) {
      clearInterval(this.config.updateTimer);
    }
    this.config.updateTimer = setInterval(async () => {
      try {
        await this.generateDocs();
      } catch (error) {
        const err = error as Error;
        logger.error('[Swagger] 自动更新文档失败:', error);
      }
    }, this.config.updateInterval);
    logger.info(`[Swagger] 自动更新已启动，间隔: ${this.config.updateInterval}ms`);
  }

  private stopAutoUpdate(): void {
    if (this.config.updateTimer) {
      clearInterval(this.config.updateTimer);
      this.config.updateTimer = null;
      logger.info('[Swagger] 自动更新已停止');
    }
  }

  async close(): Promise<void> {
    this.stopAutoUpdate();
    this.initialized = false;
    logger.info('[Swagger] Swagger服务已关闭');
  }
}

export default new SwaggerService();
