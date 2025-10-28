# 技术栈选型与项目初始化指南

## 📚 推荐技术栈

### 后端技术栈

**核心框架**: Node.js + Express.js (或 Koa.js / Fastify)
- **理由**: 
  - 成熟稳定,生态丰富
  - 异步I/O适合图片处理场景
  - 腾讯云SDK支持完善

**数据库**: MySQL 8.0+
- **理由**:
  - 事务支持(配额扣减必需)
  - 行锁机制(防并发竞争)
  - JSON字段支持(存储params和resultUrls)

**ORM**: Knex.js 或 Prisma
- **Knex.js**: 灵活,支持原生SQL,适合复杂查询
- **Prisma**: 类型安全,代码生成,开发效率高

**身份认证**: jsonwebtoken (JWT)
- 无状态,易扩展
- 与前端对接简单

**文件上传**: 腾讯云 COS SDK
- `cos-nodejs-sdk-v5`

**支付**: 
- 微信支付: `wechatpay-node-v3`
- 支付宝: `alipay-sdk`

**短信验证码**: 腾讯云短信SDK
- `tencentcloud-sdk-nodejs`

**任务队列**: Bull (基于Redis)
- 处理异步任务(RunningHub轮询)
- 失败重试机制

**日志**: Winston + Morgan
- 结构化日志
- 分级输出

**进程管理**: PM2
- 多进程,自动重启
- 日志管理

---

### 前端技术栈

**框架**: React 18 + Next.js 14 (App Router)
- **理由**:
  - SSR/ISR支持,SEO友好
  - 内置API路由(可选)
  - 部署简单(Vercel/自建)

**替代方案**: React 18 + Vite (纯SPA)
- 构建速度快
- 配置简单
- 适合纯客户端应用

**状态管理**: Zustand 或 React Query
- **Zustand**: 轻量,简单
- **React Query**: 服务端状态管理,缓存优化

**UI组件库**: Ant Design 或 Tailwind CSS + shadcn/ui
- **Ant Design**: 企业级,开箱即用
- **shadcn/ui**: 现代化,可定制性强

**文件上传**: 
- `cos-js-sdk-v5` (腾讯云COS)
- `react-dropzone` (拖拽上传)

**支付**: 
- 微信JSSDK (H5支付)
- 支付宝网页支付SDK

**HTTP客户端**: Axios 或 Fetch API
- 拦截器(添加token)
- 错误统一处理

---

## 🚀 项目初始化步骤

### 1. 后端项目初始化

```bash
# 创建项目目录
mkdir ai-photo-backend
cd ai-photo-backend

# 初始化package.json
npm init -y

# 安装核心依赖
npm install express cors dotenv jsonwebtoken bcryptjs

# 安装数据库相关
npm install knex mysql2

# 安装腾讯云SDK
npm install cos-nodejs-sdk-v5 tencentcloud-sdk-nodejs

# 安装支付SDK(选一个)
npm install wechatpay-node-v3
# 或
npm install alipay-sdk

# 安装工具库
npm install winston morgan bull ioredis axios

# 安装开发依赖
npm install --save-dev nodemon eslint prettier

# TypeScript项目(可选)
npm install --save-dev typescript @types/node @types/express ts-node
```

**项目结构**:

```
ai-photo-backend/
├── src/
│   ├── config/           # 配置文件
│   │   ├── database.js
│   │   ├── cos.js
│   │   └── payment.js
│   ├── controllers/      # 控制器
│   │   ├── auth.controller.js
│   │   ├── membership.controller.js
│   │   ├── task.controller.js
│   │   └── media.controller.js
│   ├── services/         # 业务逻辑
│   │   ├── auth.service.js
│   │   ├── membership.service.js
│   │   ├── quota.service.js
│   │   ├── task.service.js
│   │   └── orchestration.service.js
│   ├── models/           # 数据模型
│   │   ├── user.model.js
│   │   ├── order.model.js
│   │   └── task.model.js
│   ├── middlewares/      # 中间件
│   │   ├── auth.middleware.js
│   │   ├── errorHandler.middleware.js
│   │   └── rateLimiter.middleware.js
│   ├── routes/           # 路由
│   │   ├── auth.routes.js
│   │   ├── membership.routes.js
│   │   ├── task.routes.js
│   │   ├── media.routes.js
│   │   └── admin.routes.js
│   ├── utils/            # 工具函数
│   │   ├── logger.js
│   │   ├── validator.js
│   │   └── generator.js
│   ├── jobs/             # 后台任务
│   │   └── pollRunningHub.job.js
│   ├── db/               # 数据库迁移
│   │   ├── migrations/
│   │   └── seeds/
│   ├── app.js            # Express应用
│   └── server.js         # 启动入口
├── .env                  # 环境变量
├── .env.example          # 环境变量示例
├── ecosystem.config.js   # PM2配置
├── knexfile.js           # Knex配置
└── package.json
```

**package.json scripts**:

```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "db:migrate": "knex migrate:latest",
    "db:rollback": "knex migrate:rollback",
    "db:seed": "knex seed:run",
    "lint": "eslint src/",
    "format": "prettier --write src/"
  }
}
```

---

### 2. 前端项目初始化 (Next.js)

```bash
# 使用create-next-app
npx create-next-app@latest ai-photo-frontend

# 选项:
# ✔ TypeScript? Yes
# ✔ ESLint? Yes
# ✔ Tailwind CSS? Yes (或选No用Ant Design)
# ✔ App Router? Yes
# ✔ Import alias? Yes (@/*)

cd ai-photo-frontend

# 安装UI组件库(选一个)
npm install antd
# 或
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu class-variance-authority clsx tailwind-merge

# 安装工具库
npm install axios zustand react-query cos-js-sdk-v5 react-dropzone
```

**项目结构**:

```
ai-photo-frontend/
├── src/
│   ├── app/                 # App Router页面
│   │   ├── layout.tsx
│   │   ├── page.tsx         # 首页
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── purchase/
│   │   │   └── page.tsx
│   │   ├── workspace/
│   │   │   └── page.tsx
│   │   ├── task/
│   │   │   ├── basic/page.tsx
│   │   │   ├── model/page.tsx
│   │   │   └── [id]/page.tsx
│   │   └── admin/
│   │       └── page.tsx
│   ├── components/          # 组件
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   └── CodeInput.tsx
│   │   ├── upload/
│   │   │   └── ImageUploader.tsx
│   │   ├── task/
│   │   │   ├── TaskCard.tsx
│   │   │   ├── TaskList.tsx
│   │   │   └── TaskDetail.tsx
│   │   └── common/
│   │       ├── Header.tsx
│   │       └── Loading.tsx
│   ├── lib/                 # 工具库
│   │   ├── api.ts           # API客户端
│   │   ├── cos.ts           # COS上传
│   │   ├── payment.ts       # 支付
│   │   └── utils.ts
│   ├── hooks/               # 自定义Hooks
│   │   ├── useAuth.ts
│   │   ├── useMembership.ts
│   │   ├── useTask.ts
│   │   └── useUpload.ts
│   ├── store/               # 状态管理
│   │   ├── authStore.ts
│   │   └── taskStore.ts
│   └── types/               # TypeScript类型
│       ├── user.ts
│       ├── task.ts
│       └── api.ts
├── public/                  # 静态资源
├── .env.local               # 环境变量
└── package.json
```

**环境变量 (.env.local)**:

```bash
NEXT_PUBLIC_API_URL=https://api.aizhao.icu
NEXT_PUBLIC_COS_BUCKET=ai-photo-prod-1379020062
NEXT_PUBLIC_COS_REGION=ap-guangzhou
```

---

### 3. 数据库初始化

**Knex迁移文件示例**:

```bash
# 创建迁移文件
npx knex migrate:make create_users_table
npx knex migrate:make create_orders_table
npx knex migrate:make create_tasks_table
```

**migrations/001_create_users_table.js**:

```javascript
exports.up = function(knex) {
  return knex.schema.createTable('users', function(table) {
    table.string('id', 32).primary();
    table.string('phone', 11).unique().notNullable();
    table.boolean('isMember').defaultTo(false);
    table.integer('quota_remaining').defaultTo(0);
    table.datetime('quota_expireAt').nullable();
    table.timestamps(true, true);
    
    table.index('phone');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('users');
};
```

**migrations/002_create_orders_table.js**:

```javascript
exports.up = function(knex) {
  return knex.schema.createTable('orders', function(table) {
    table.string('id', 32).primary();
    table.string('userId', 32).notNullable();
    table.string('status', 20).notNullable();
    table.decimal('amount', 10, 2).notNullable();
    table.string('channel', 20).notNullable();
    table.string('transactionId', 64).unique().nullable();
    table.datetime('createdAt').notNullable();
    table.datetime('paidAt').nullable();
    
    table.foreign('userId').references('users.id');
    table.index('userId');
    table.index(['userId', 'status']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('orders');
};
```

**migrations/003_create_tasks_table.js**:

```javascript
exports.up = function(knex) {
  return knex.schema.createTable('tasks', function(table) {
    table.string('id', 32).primary();
    table.string('userId', 32).notNullable();
    table.string('type', 20).notNullable();
    table.string('status', 20).notNullable();
    table.text('inputUrl').notNullable();
    table.json('resultUrls').nullable();
    table.string('vendorTaskId', 64).nullable();
    table.json('params').nullable();
    table.text('errorReason').nullable();
    table.timestamps(true, true);
    
    table.foreign('userId').references('users.id');
    table.index('userId');
    table.index(['userId', 'createdAt']);
    table.index('vendorTaskId');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('tasks');
};
```

**运行迁移**:

```bash
npm run db:migrate
```

---

### 4. 核心配置文件

**knexfile.js**:

```javascript
require('dotenv').config();

module.exports = {
  development: {
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'ai_photo'
    },
    pool: {
      min: parseInt(process.env.DATABASE_POOL_MIN) || 2,
      max: parseInt(process.env.DATABASE_POOL_MAX) || 10
    },
    migrations: {
      directory: './src/db/migrations'
    },
    seeds: {
      directory: './src/db/seeds'
    }
  },

  production: {
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    },
    pool: {
      min: parseInt(process.env.DATABASE_POOL_MIN) || 5,
      max: parseInt(process.env.DATABASE_POOL_MAX) || 20
    },
    migrations: {
      directory: './src/db/migrations'
    }
  }
};
```

**ecosystem.config.js (PM2)**:

```javascript
module.exports = {
  apps: [{
    name: 'ai-photo-api',
    script: './src/server.js',
    instances: 2,  // 2个进程
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    max_memory_restart: '500M',
    autorestart: true,
    watch: false
  }]
};
```

**src/server.js**:

```javascript
require('dotenv').config();
const app = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
  });
});
```

**src/app.js**:

```javascript
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const logger = require('./utils/logger');
const errorHandler = require('./middlewares/errorHandler.middleware');

// 路由
const authRoutes = require('./routes/auth.routes');
const membershipRoutes = require('./routes/membership.routes');
const taskRoutes = require('./routes/task.routes');
const mediaRoutes = require('./routes/media.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: logger.stream }));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/membership', membershipRoutes);
app.use('/api/task', taskRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/admin', adminRoutes);

// 错误处理
app.use(errorHandler);

module.exports = app;
```

---

### 5. 工具函数示例

**src/utils/logger.js**:

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Morgan stream
logger.stream = {
  write: (message) => logger.info(message.trim())
};

module.exports = logger;
```

**src/utils/generator.js**:

```javascript
const crypto = require('crypto');

// 生成随机ID
function generateId(length = 16) {
  return crypto.randomBytes(length).toString('hex');
}

// 生成随机seed (1 ~ 2147483647)
function generateSeed() {
  return Math.floor(Math.random() * 2147483647) + 1;
}

// 生成验证码
function generateCode(length = 6) {
  return Math.floor(Math.random() * Math.pow(10, length))
    .toString()
    .padStart(length, '0');
}

module.exports = {
  generateId,
  generateSeed,
  generateCode
};
```

---

### 6. 前端API客户端

**src/lib/api.ts**:

```typescript
import axios, { AxiosInstance } from 'axios';

class APIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // 请求拦截器(添加token)
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // 响应拦截器(错误处理)
    this.client.interceptors.response.use(
      (response) => response.data,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // 认证
  auth = {
    sendCode: (phone: string) => 
      this.client.post('/api/auth/send-code', { phone }),
    
    login: (phone: string, code: string) => 
      this.client.post('/api/auth/login', { phone, code }),
    
    me: () => 
      this.client.get('/api/auth/me')
  };

  // 会员
  membership = {
    purchase: (channel: string) => 
      this.client.post('/api/membership/purchase', { channel }),
    
    status: () => 
      this.client.get('/api/membership/status')
  };

  // 任务
  task = {
    create: (data: any) => 
      this.client.post('/api/task/create', data),
    
    get: (taskId: string) => 
      this.client.get(`/api/task/${taskId}`),
    
    list: (params: any) => 
      this.client.get('/api/task/list', { params })
  };

  // 媒体
  media = {
    getSTS: (taskId: string) => 
      this.client.get(`/api/media/sts?taskId=${taskId}`)
  };
}

export const api = new APIClient();
```

---

## 📝 开发规范

### 代码风格

- **后端**: ESLint + Airbnb规范
- **前端**: ESLint + Prettier
- **命名**:
  - 变量/函数: camelCase
  - 常量: UPPER_SNAKE_CASE
  - 类: PascalCase
  - 文件: kebab-case

### Git工作流

```bash
# 分支命名
feature/login-page
fix/quota-negative-bug
hotfix/payment-callback

# Commit规范
feat: 添加会员购买功能
fix: 修复配额并发扣减问题
docs: 更新API文档
refactor: 重构任务查询逻辑
test: 添加配额管理单元测试
```

### 环境管理

- **开发环境**: `.env.development`
- **测试环境**: `.env.test`
- **生产环境**: `.env.production`

---

## 🔒 安全检查清单

- [ ] 环境变量不提交到代码仓库(.gitignore)
- [ ] API密钥加密存储
- [ ] 密码使用bcrypt加密
- [ ] JWT密钥强度足够(至少32位)
- [ ] SQL使用参数化查询(防注入)
- [ ] 文件上传限制类型和大小
- [ ] 频率限制(登录、验证码、任务创建)
- [ ] CORS配置正确
- [ ] HTTPS强制跳转
- [ ] CSP头配置

---

## 📦 依赖版本锁定

**package.json 建议**:

```json
{
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

**使用package-lock.json或pnpm-lock.yaml锁定版本**

---

这份文档提供了完整的技术栈选型和初始化指南,开发团队可以按照这个标准快速搭建项目骨架。
