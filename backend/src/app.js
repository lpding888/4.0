const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler.middleware');

// 创建Express应用
const app = express();

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

// 安全中间件 (P1-013: 允许Swagger UI的inline样式)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Swagger UI需要
      scriptSrc: ["'self'", "'unsafe-inline'"], // Swagger UI需要
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

// 日志中间件
app.use(morgan('combined', { stream: logger.stream }));

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

// Swagger API文档 (P1-013)
// 艹！所有API文档一目了然，访问 /api-docs 查看
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'AI Photo API文档',
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: {
    persistAuthorization: true, // 持久化认证信息
    docExpansion: 'none', // 默认折叠所有接口
    filter: true, // 启用搜索过滤
    tryItOutEnabled: true // 启用"Try it out"功能
  }
}));

// Swagger JSON规范
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// API路由
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/membership', require('./routes/membership.routes'));
app.use('/api/media', require('./routes/media.routes'));
app.use('/api/task', require('./routes/task.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/system-config', require('./routes/systemConfig.routes'));
app.use('/api/features', require('./routes/feature.routes'));
app.use('/api/scf', require('./routes/scfCallback.routes'));
app.use('/api/assets', require('./routes/asset.routes'));
app.use('/api/distribution', require('./routes/distribution.routes')); // 分销代理路由
app.use('/api/payment', require('./routes/payment.routes')); // 支付路由 (P0-008)

// 404处理
app.use(notFoundHandler);

// 全局错误处理
app.use(errorHandler);

module.exports = app;
