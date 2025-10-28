# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个服装AI处理 SaaS 平台，为服装电商提供AI图片处理服务，包括基础修图和AI模特上身功能。

**核心业务模式**：会员制订阅服务（¥99/月 = 100次配额）

**技术架构**：前后端分离架构
- 后端：Node.js + Express + MySQL + Knex.js
- 前端：Next.js 14 + TypeScript + Ant Design
- 部署：PM2集群 + 腾讯云COS + RunningHub AI集成

## 项目结构

```
├── backend/                 # 后端API服务
│   ├── src/
│   │   ├── controllers/     # 控制器层
│   │   ├── services/        # 业务逻辑层
│   │   ├── models/          # 数据模型层
│   │   ├── middleware/      # 中间件
│   │   ├── routes/          # 路由定义
│   │   ├── utils/           # 工具函数
│   │   └── config/          # 配置文件
│   ├── migrations/          # 数据库迁移文件
│   └── package.json
├── frontend/               # 前端Next.js应用
│   ├── src/
│   │   ├── app/            # App Router页面
│   │   ├── components/     # React组件
│   │   ├── hooks/          # 自定义Hooks
│   │   ├── store/          # Zustand状态管理
│   │   ├── services/       # API调用服务
│   │   └── utils/          # 工具函数
│   └── package.json
└── README.md               # 项目导航文档
```

## 核心功能模块

### 1. 认证系统
- 手机号 + 验证码登录
- JWT token认证
- 用户session管理

### 2. 会员管理
- 月费会员购买（¥99/月）
- 配额管理（100次/月）
- 会员状态检查

### 3. 任务处理
- **基础修图**（basic_clean）：腾讯数据万象，同步处理
- **AI模特12分镜**（model_pose12）：RunningHub AI，异步处理
- 任务状态跟踪和结果管理

### 4. 配额管理
- 事务级配额扣减和返还
- 防并发竞争（行锁）
- 失败任务自动返还配额

### 5. 媒体服务
- 腾讯云COS对象存储
- STS临时密钥生成
- 直传支持

### 6. 支付集成
- 微信支付API v3
- 支付回调处理
- 订单状态管理

## 常用开发命令

### 后端开发
```bash
cd backend
npm install                    # 安装依赖
npm run dev                    # 开发模式启动（nodemon）
npm start                      # 生产模式启动
npm run lint                   # 代码检查
npm run format                 # 代码格式化

# 数据库操作
npm run db:migrate             # 执行数据库迁移
npm run db:rollback            # 回滚迁移
npm run db:seed                # 执行种子数据
```

### 前端开发
```bash
cd frontend
npm install                    # 安装依赖
npm run dev                    # 开发服务器（localhost:3000）
npm run build                  # 构建生产版本
npm start                      # 启动生产服务器
npm run lint                   # 代码检查
```

## 数据库设计

### 核心表结构
- **users**: 用户信息，会员状态，配额余额
- **orders**: 订单记录，支付状态
- **tasks**: 任务记录，类型，状态，结果
- **verification_codes**: 手机验证码

### 重要约束
1. **配额管理NON-NEGATIVE保证**：必须使用事务和行锁确保配额不会出现负数
2. **RunningHub查询约束**：仅在processing状态查询外部服务，done/failed后不再查询
3. **配额值配置化**：使用环境变量配置配额值，避免硬编码

## 关键业务流程

### 1. 用户注册登录流程
```
手机号输入 → 发送验证码 → 验证码校验 → JWT生成 → 用户登录
```

### 2. 会员购买流程
```
选择套餐 → 创建订单 → 微信支付 → 支付回调 → 配额发放 → 会员激活
```

### 3. 任务处理流程
```
配额检查 → 扣减配额 → 任务创建 → 第三方处理 → 结果回调 → 状态更新
```

## 关键技术约束

### 配额管理约束 ⚠️
```javascript
// ✅ 正确：使用事务和行锁
await transaction(async (trx) => {
  const user = await trx('users')
    .where({ id: userId })
    .forUpdate()  // 行锁
    .first();

  if (user.quota_remaining <= 0) {
    throw new Error('配额不足');
  }

  await trx('users')
    .where({ id: userId })
    .decrement('quota_remaining', 1);
});
```

### RunningHub查询约束 ⚠️
```javascript
// ✅ 正确：仅在processing时查询
if (task.status === 'processing' && task.type === 'model_pose12') {
  const rhStatus = await runningHubAPI.getStatus(task.vendorTaskId);
  // 处理结果并一次性落库
}
```

## 环境配置

### 必需的环境变量
```bash
# 数据库配置
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=ai_photo

# JWT配置
JWT_SECRET=your_jwt_secret

# 腾讯云配置
TENCENT_SECRET_ID=your_secret_id
TENCENT_SECRET_KEY=your_secret_key
COS_BUCKET=ai-photo-prod-1379020062
COS_REGION=ap-guangzhou

# 微信支付配置
WECHAT_APP_ID=your_app_id
WECHAT_MCH_ID=your_mch_id
WECHAT_API_KEY=your_api_key

# RunningHub配置
RUNNINGHUB_API_KEY=your_api_key
RUNNINGHUB_BASE_URL=https://api.runninghub.com

# Redis配置（用于Bull队列）
REDIS_HOST=localhost
REDIS_PORT=6379
```

## 部署信息

- **服务器**: 43.139.187.166
- **API域名**: api.aizhao.icu
- **前端域名**: @.aizhao.icu
- **数据库**: MySQL 8.0
- **存储**: 腾讯云COS（ai-photo-prod-1379020062）

## API接口规范

### 统一响应格式
```javascript
{
  success: true,
  data: {},
  message: "操作成功",
  code: 200
}
```

### 认证头格式
```
Authorization: Bearer <jwt_token>
```

## 测试要求

### 功能验收清单
- [ ] 用户注册登录（手机号+验证码）
- [ ] 会员购买（支付成功→配额到账100次）
- [ ] 基础修图功能（上传→生成白底主图→扣1次）
- [ ] AI模特生成功能（上传→12张分镜→扣1次）
- [ ] 失败处理（配额自动返还）
- [ ] 管理后台（用户/任务查询）

### 性能要求
- 基础修图响应时间: < 5秒（P95）
- AI模特生成时间: < 3分钟（P95）
- 任务列表加载: < 1秒

## 文档参考

详细文档请参考：
- `README.md` - 完整项目导航和设计文档
- `IMPLEMENTATION_GUIDE.md` - 实施指南和代码示例
- `API_DOCUMENTATION.md` - 完整API接口文档
- `TECH_STACK_GUIDE.md` - 技术栈选型和配置指南
- `TECH_CLARIFICATION.md` - 技术边界说明

## 开发注意事项

1. **第一条闭环约束**：支付对接/会员开通/配额管理/任务创建必须在同一迭代内同时联调通过
2. **事务安全**：配额操作必须使用数据库事务和行锁
3. **成本控制**：RunningHub API调用仅限于必要场景
4. **安全考虑**：API密钥不能暴露在前端，使用STS临时密钥进行COS上传
5. **错误处理**：任务失败必须自动返还配额，避免用户损失