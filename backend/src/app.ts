/**
 * Express应用配置
 * 艹，主应用入口！集成所有routes和middleware
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

// 艹，导入所有routes
import authRoutes from './routes/auth.routes';
import usersRoutes from './routes/users.routes';
import providersRoutes from './routes/providers.routes';
import announcementsRoutes from './routes/announcements.routes';
import bannersRoutes from './routes/banners.routes';
import membershipPlansRoutes from './routes/membershipPlans.routes';
import membershipBenefitsRoutes from './routes/membershipBenefits.routes';
import contentTextsRoutes from './routes/contentTexts.routes';
import auditLogsRoutes from './routes/auditLogs.routes';
import importExportRoutes from './routes/importExport.routes';

// 艹，导入调度器
import { startAnnouncementScheduler } from './services/announcementScheduler.service';
import { startBannerScheduler } from './services/bannerScheduler.service';

const app: Express = express();

// ===== 基础中间件 =====
app.use(helmet()); // 安全头部

// 艹，CORS配置！必须支持credentials才能传Cookie！
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true, // 允许Cookie跨域
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json()); // 解析JSON
app.use(express.urlencoded({ extended: true })); // 解析表单
app.use(cookieParser()); // 艹，解析Cookie！
app.use(morgan('combined')); // 日志

// ===== 限流 =====
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制100次请求
  message: '请求过于频繁，请稍后再试',
});
app.use('/api/', limiter);

// ===== 健康检查 =====
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===== 注册所有routes =====
// 认证相关（公开）
app.use('/api/auth', authRoutes);

// 用户相关（需要登录）
app.use('/api/users', usersRoutes);

// CMS相关
app.use('/api', providersRoutes);
app.use('/api', announcementsRoutes);
app.use('/api', bannersRoutes);
app.use('/api', membershipPlansRoutes);
app.use('/api', membershipBenefitsRoutes);
app.use('/api', contentTextsRoutes);
app.use('/api', auditLogsRoutes);
app.use('/api', importExportRoutes);

// ===== 404处理 =====
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `路由未找到: ${req.method} ${req.path}`,
    },
  });
});

// ===== 全局错误处理 =====
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[ERROR]', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || '服务器内部错误';

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
});

// ===== 启动定时调度器 =====
let announcementScheduler: NodeJS.Timeout | null = null;
let bannerScheduler: NodeJS.Timeout | null = null;

export function startSchedulers(): void {
  console.log('[APP] 启动定时调度器');
  announcementScheduler = startAnnouncementScheduler();
  bannerScheduler = startBannerScheduler();
}

export function stopSchedulers(): void {
  console.log('[APP] 停止定时调度器');
  if (announcementScheduler) clearInterval(announcementScheduler);
  if (bannerScheduler) clearInterval(bannerScheduler);
}

export default app;
