import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import swaggerUi from 'swagger-ui-express';

import { requestIdMiddleware } from './middlewares/request-id.middleware.js';
import { appErrorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { loggerStream } from './utils/logger.js';
import { startAnnouncementScheduler } from './services/announcementScheduler.service.js';
import { startBannerScheduler } from './services/bannerScheduler.service.js';
import cronJobsService from './services/cronJobs.service.js';
import swaggerSpec from './config/swagger.config.js';
import logger from './utils/logger.js';
import metricsMiddleware from './middlewares/metrics.middleware.js';
import metricsService from './services/metrics.service.js';

type RouterModule = { default?: express.Router } | express.Router;

interface RouteDefinition {
  mountPath: string;
  modulePath: string;
}

const routeDefinitions: RouteDefinition[] = [
  { mountPath: '/', modulePath: './routes/health.routes.js' },
  { mountPath: '/api/auth', modulePath: './routes/auth.routes.js' },
  { mountPath: '/api/users', modulePath: './routes/users.routes.js' },
  { mountPath: '/api', modulePath: './routes/providers.routes.js' },
  { mountPath: '/api', modulePath: './routes/announcements.routes.js' },
  { mountPath: '/api', modulePath: './routes/banners.routes.js' },
  { mountPath: '/api', modulePath: './routes/membershipPlans.routes.js' },
  { mountPath: '/api', modulePath: './routes/membershipBenefits.routes.js' },
  { mountPath: '/api', modulePath: './routes/contentTexts.routes.js' },
  { mountPath: '/api', modulePath: './routes/auditLogs.routes.js' },
  { mountPath: '/api', modulePath: './routes/importExport.routes.js' },
  { mountPath: '/api/ai', modulePath: './routes/ai.route.js' },
  { mountPath: '/api/admin/kb', modulePath: './routes/admin/kb.route.js' },
  { mountPath: '/api/admin/uploads', modulePath: './routes/admin/uploads.route.js' },
  { mountPath: '/api/admin/features', modulePath: './routes/feature-catalog.routes.js' },
  { mountPath: '/api/admin/ui', modulePath: './routes/ui.routes.js' },
  { mountPath: '/api/admin/pipeline-schemas', modulePath: './routes/pipelineSchemas.routes.js' },
  {
    mountPath: '/api/admin/pipeline-execution',
    modulePath: './routes/pipelineExecution.routes.js'
  },
  { mountPath: '/api/admin/mcp-endpoints', modulePath: './routes/mcpEndpoints.routes.js' },
  { mountPath: '/api/buildingai', modulePath: './routes/buildingai-adaptor.routes.js' },
  { mountPath: '/api/membership', modulePath: './routes/membership.routes.js' },
  { mountPath: '/api/media', modulePath: './routes/media.routes.js' },
  { mountPath: '/api/task', modulePath: './routes/task.routes.js' },
  // 前台功能列表与表单Schema
  { mountPath: '/api/features', modulePath: './routes/feature.routes.js' },
  { mountPath: '/api/assets', modulePath: './routes/asset.routes.js' },
  { mountPath: '/api/admin', modulePath: './routes/admin.routes.js' },
  { mountPath: '/api/system-config', modulePath: './routes/systemConfig.routes.js' },
  { mountPath: '/api/scf', modulePath: './routes/scfCallback.routes.js' },
  { mountPath: '/api/cache', modulePath: './routes/cache.routes.js' },
  { mountPath: '/api/distribution', modulePath: './routes/distribution.routes.js' },
  { mountPath: '/api/circuit-breaker', modulePath: './routes/circuitBreaker.routes.js' },
  { mountPath: '/api/payment', modulePath: './routes/payment.routes.js' },
  { mountPath: '/api/auth/wechat', modulePath: './routes/wechat-login.routes.js' },
  { mountPath: '/api/ai', modulePath: './routes/buildingai-adaptor.routes.js' },
  { mountPath: '/api/invite-codes', modulePath: './routes/invite-code.routes.js' },
  { mountPath: '/api/user-profile', modulePath: './routes/user-profile.routes.js' },
  { mountPath: '/api/referral-validation', modulePath: './routes/referral-validation.routes.js' },
  { mountPath: '/api/kms', modulePath: './routes/kms.routes.js' },
  { mountPath: '/api/admin/errors', modulePath: './routes/error-management.routes.js' },
  { mountPath: '/api/docs', modulePath: './routes/docs.routes.js' },
  { mountPath: '/api/ui', modulePath: './routes/ui.routes.js' },
  { mountPath: '/api/cms/features', modulePath: './routes/cmsFeatures.routes.js' },
  { mountPath: '/api/cms/providers', modulePath: './routes/cmsProviders.routes.js' },
  { mountPath: '/api/pipeline-schemas', modulePath: './routes/pipelineSchemas.routes.js' },
  { mountPath: '/api/pipeline-executions', modulePath: './routes/pipelineExecution.routes.js' },
  { mountPath: '/api/mcp-endpoints', modulePath: './routes/mcpEndpoints.routes.js' },
  { mountPath: '/api/prompt-templates', modulePath: './routes/promptTemplates.routes.js' }
];

const loadRouter = async (modulePath: string): Promise<express.Router> => {
  const module = (await import(modulePath)) as RouterModule;
  const rawRouter = module && 'default' in module ? module.default : module;
  const router = rawRouter as express.Router | undefined;
  if (!router) {
    throw new Error(`模块 ${modulePath} 未导出 Router`);
  }
  return router;
};

const registerRoutes = async (app: Express): Promise<void> => {
  for (const { mountPath, modulePath } of routeDefinitions) {
    const router = await loadRouter(modulePath);
    app.use(mountPath, router);
  }
};

const createRateLimiter = () =>
  rateLimit({
    legacyHeaders: false,
    standardHeaders: true,
    windowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10),
    limit: Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '100', 10),
    message: '请求过于频繁，请稍后再试'
  });

export interface CreateAppOptions {
  corsOrigins?: string[] | string;
}

export async function createApp(options: CreateAppOptions = {}): Promise<Express> {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestIdMiddleware);
  app.use(helmet());

  // 防止NoSQL注入（艹！虽然用的是MySQL，但防患于未然）
  app.use(mongoSanitize());

  const allowedOrigins =
    options.corsOrigins ??
    (process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : ['http://localhost:3001']);

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());
  app.use(morgan('combined', { stream: loggerStream }));
  app.use(createRateLimiter());

  // P1-014: Prometheus指标收集中间件（艹！监控HTTP请求）
  app.use(metricsMiddleware);

  app.get('/', (_req, res) => {
    res.json({
      message: '欢迎使用AI照片处理后端API',
      version: '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString()
    });
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // P1-014: Prometheus指标暴露端点（艹！Prometheus从这个接口抓取指标）
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', metricsService.getContentType());
      const metrics = await metricsService.getMetrics();
      res.end(metrics);
    } catch (error) {
      logger.error('[Metrics] 获取指标失败:', error);
      res.status(500).end('Error collecting metrics');
    }
  });

  // P1-013: Swagger API文档（艹！所有API文档一目了然，访问 /api-docs 查看）
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'AI Photo API文档',
      customCss: '.swagger-ui .topbar { display: none }',
      swaggerOptions: {
        persistAuthorization: true, // 持久化认证信息
        docExpansion: 'none', // 默认折叠所有接口
        filter: true, // 启用搜索过滤
        tryItOutEnabled: true // 启用"Try it out"功能
      }
    })
  );

  // Swagger JSON规范
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  await registerRoutes(app);

  app.use(notFoundHandler);
  app.use(appErrorHandler);

  return app;
}

let announcementScheduler: NodeJS.Timeout | null = null;
let bannerScheduler: NodeJS.Timeout | null = null;

export const startSchedulers = (): void => {
  announcementScheduler = startAnnouncementScheduler();
  bannerScheduler = startBannerScheduler();
  // 启动基于 node-cron 的定时任务集合
  try {
    cronJobsService.startAll();
  } catch (err) {
    // 这个SB错误别阻塞主进程，打个日志继续跑
    console.error('[App] 启动cron失败', err);
  }
};

export const stopSchedulers = (): void => {
  if (announcementScheduler) {
    clearInterval(announcementScheduler);
    announcementScheduler = null;
  }
  if (bannerScheduler) {
    clearInterval(bannerScheduler);
    bannerScheduler = null;
  }
  try {
    cronJobsService.stopAll();
  } catch (err) {
    console.error('[App] 停止cron失败', err);
  }
};

// 艹，创建默认app实例供测试和老版本代码使用！
const defaultApp = await createApp();
export default defaultApp;
