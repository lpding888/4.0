# CODEBUDDY.md This file provides guidance to CodeBuddy Code when working with code in this repository.

## 项目概述

这是一个服装AI处理SaaS平台，为服装电商提供AI图片处理服务，包括基础修图和AI模特上身功能。项目采用前后端分离架构。

## 开发命令

### 前端 (Next.js + React + TypeScript)
```bash
cd frontend
npm run dev      # 开发服务器 (端口3000)
npm run build    # 生产构建
npm run start    # 生产服务器
npm run lint     # 代码检查
```

### 后端 (Node.js + Express + MySQL)
```bash
cd backend
npm run dev      # 开发服务器 (nodemon)
npm start        # 生产服务器
npm run lint     # 代码检查
npm run format   # 代码格式化

# 数据库命令
npm run db:migrate    # 运行数据库迁移
npm run db:rollback   # 回滚迁移
npm run db:seed       # 运行种子数据
```

## 核心架构

### 前端架构
- **框架**: Next.js 14 + React 18 + TypeScript
- **状态管理**: Zustand
- **数据获取**: TanStack Query (React Query)
- **UI组件库**: Ant Design
- **文件上传**: React Dropzone + COS JS SDK

### 后端架构
- **框架**: Express.js
- **数据库**: MySQL + Knex.js (查询构建器)
- **认证**: JWT + bcryptjs
- **任务队列**: Bull + Redis
- **文件存储**: 腾讯云COS
- **AI服务**: 
  - 基础修图: 腾讯数据万象(同步)
  - AI模特: RunningHub(异步)

### 关键约束

#### 1. 配额管理 - 原子性操作
必须使用事务和行锁防止并发竞争：
```javascript
// ✅ 正确实现
await transaction(async (trx) => {
  const user = await trx('users').where({ id: userId }).forUpdate().first();
  if (user.quota_remaining <= 0) throw new Error('配额不足');
  await trx('users').where({ id: userId }).decrement('quota_remaining', 1);
});
```

#### 2. RunningHub查询约束
仅在processing状态时查询外部服务：
```javascript
// ✅ 仅在需要时查询
if (task.status === 'processing' && task.type === 'model_pose12') {
  const rhStatus = await runningHubAPI.getStatus(task.vendorTaskId);
}
```

#### 3. 第一条可跑通链路
支付对接、会员开通、配额扣减、任务创建必须在同一迭代内联调通过。

## 环境配置

### 后端环境变量 (.env.example)
```bash
# 数据库
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=ai_photo

# 腾讯云
COS_SECRET_ID=
COS_SECRET_KEY=
COS_BUCKET=ai-photo-prod-1379020062
COS_REGION=ap-guangzhou

# RunningHub
RUNNINGHUB_API_KEY=
RUNNINGHUB_BASE_URL=

# JWT
JWT_SECRET=
```

### 前端环境变量 (.env.local.example)
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_COS_BUCKET=ai-photo-prod-1379020062
NEXT_PUBLIC_COS_REGION=ap-guangzhou
```

## 数据库迁移

使用Knex.js进行数据库迁移：
```bash
cd backend
npm run db:migrate
```

迁移文件位于 `src/db/migrations/`，种子数据位于 `src/db/seeds/`。

## 部署信息

- **服务器**: 43.139.187.166
- **API域名**: api.aizhao.icu
- **前端域名**: @.aizhao.icu
- **数据库**: MySQL 8.0
- **存储**: 腾讯云COS (广州)

## 重要文档

- **README.md**: 完整项目概述和开发指南
- **API_DOCUMENTATION.md**: 详细的API接口文档
- **IMPLEMENTATION_GUIDE.md**: 实施指南和代码示例
- **TECH_STACK_GUIDE.md**: 技术栈选型指南
- **数据.md**: 腾讯云账号和服务器配置信息

## 开发注意事项

1. **配额值配置化**: 使用环境变量而非硬编码
2. **支付回调**: 必须验证签名
3. **文件上传**: 使用STS临时密钥确保安全
4. **错误处理**: 任务失败时自动返还配额
5. **日志记录**: 使用Winston进行结构化日志记录

## 测试策略

- 优先测试核心业务链路
- 重点验证配额管理的原子性
- 模拟支付回调场景
- 测试任务状态流转

## 性能要求

- 基础修图: < 5秒响应时间
- AI模特生成: < 3分钟
- 任务列表: < 1秒加载时间
- 支付回调: < 2秒处理时间