const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler.middleware');
const cacheMiddleware = require('./middlewares/cache.middleware');
const requestIdMiddleware = require('./middlewares/request-id.middleware');
const i18nService = require('./services/i18n.service');

// 创建Express应用
const app = express();

// 请求ID中间件（必须最先执行）
app.use(requestIdMiddleware);

// 国际化中间件
app.use(i18nService.middleware());

// 生产环境HTTPS强制跳转
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(`https://${req.header('host')}${req.url}`);
    }
    // 设置HSTS响应头 (强制HTTPS一年)
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
}

// 安全中间件
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  }
}));

// 防止NoSQL注入
app.use(mongoSanitize());

// CORS配置
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://aizhao.icu', 'https://www.aizhao.icu']
    : '*',
  credentials: true
}));

// 请求解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 日志中间件（添加请求ID）
app.use(morgan('combined', {
  stream: logger.stream,
  // 添加请求ID到日志
  skip: (req, res) => false
}));

// 缓存控制中间件
app.use(cacheMiddleware.cacheControl());

// 缓存统计和健康检查中间件
app.use(cacheMiddleware.cacheStats());
app.use(cacheMiddleware.cacheHealthCheck());

// 根路径 - API文档
app.get('/', (req, res) => {
  res.json({
    message: '欢迎使用AI照片处理后端API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: {
        path: '/health',
        method: 'GET',
        description: '健康检查'
      },
      auth: {
        path: '/api/auth/*',
        description: '用户认证相关接口'
      },
      features: {
        path: '/api/features',
        method: 'GET',
        description: '获取可用功能列表',
        requiresAuth: true
      },
      createTask: {
        path: '/api/task/create-by-feature',
        method: 'POST',
        description: '创建任务',
        requiresAuth: true
      },
      assets: {
        path: '/api/assets',
        method: 'GET',
        description: '获取用户素材库',
        requiresAuth: true
      },
      admin: {
        path: '/api/admin/*',
        description: '管理员接口',
        requiresAuth: true,
        requiresAdmin: true
      }
    },
    documentation: '请使用具体的API端点,根路径仅用于查看可用接口列表'
  });
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV
  });
});

// API路由
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/membership', require('./routes/membership.routes'));
app.use('/api/media', require('./routes/media.routes'));
app.use('/api/task', require('./routes/task.routes'));

// 功能配置路由 - 添加缓存
app.use('/api/features',
  cacheMiddleware.featureCache({ ttl: 3600 }), // 1小时缓存
  require('./routes/feature.routes')
);

// 素材库路由 - 添加用户缓存
app.use('/api/assets',
  cacheMiddleware.userCache({ ttl: 600 }), // 10分钟缓存
  require('./routes/asset.routes')
);

// 管理员路由 - 添加管理员缓存
app.use('/api/admin',
  cacheMiddleware.adminCache({ ttl: 300 }), // 5分钟缓存
  require('./routes/admin.routes')
);

app.use('/api/system-config', require('./routes/systemConfig.routes'));
app.use('/api/scf', require('./routes/scfCallback.routes'));
app.use('/api/cache', require('./routes/cache.routes')); // 缓存管理路由
app.use('/api/distribution', require('./routes/distribution.routes')); // 分销代理路由
app.use('/api/circuit-breaker', require('./routes/circuitBreaker.routes')); // 熔断器监控路由
app.use('/api/payment', require('./routes/payment.routes')); // 支付相关路由
app.use('/api/auth/wechat', require('./routes/wechat-login.routes')); // 微信登录路由
app.use('/api/auth', require('./routes/unified-login.routes')); // 统一登录路由
app.use('/api/admin/errors', require('./routes/error-management.routes')); // 错误管理路由
app.use('/api/docs', require('./routes/docs.routes')); // API文档路由

// 404处理
app.use(notFoundHandler);

// 全局错误处理
app.use(errorHandler);

module.exports = app;
