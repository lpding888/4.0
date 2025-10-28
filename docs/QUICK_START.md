# AI照 SaaS 平台 - 快速启动指南

## 🎯 项目概述

服装AI处理 SaaS 平台 - 提供基础修图和AI模特上身功能的会员制服务

**核心业务**: 单月会员(¥99) = 100次生成配额

---

## 📦 已交付内容

### 文档 (7份)
- README.md - 项目总览
- IMPLEMENTATION_GUIDE.md - 实施指南
- TECH_STACK_GUIDE.md - 技术栈指南  
- API_DOCUMENTATION.md - API文档
- PROJECT_SUMMARY.md - 项目启动总结
- PROGRESS_REPORT.md - 开发进度
- FINAL_DELIVERY_SUMMARY.md - 最终交付总结

### 后端代码 (可运行)
- ✅ Express + Knex + MySQL
- ✅ 认证服务(验证码、登录、JWT)
- ✅ 会员服务(购买、支付回调、状态查询)
- ✅ 配额管理(事务级扣减/返还)
- ✅ 4张数据库表

### 前端代码 (可运行)
- ✅ Next.js 14 + TypeScript
- ✅ API客户端封装
- ✅ 状态管理(Zustand)

---

## 🚀 5分钟快速启动

### 1. 后端启动

```bash
# 进入后端目录
cd backend

# 安装依赖(首次)
npm install

# 配置环境变量
cp .env.example .env
# 编辑.env文件,填入:
# - DB_PASSWORD=7236e7b4b31ebc7e
# - TENCENT_SECRET_ID=AKIDWxogYJsGRXVKAreFftFRTK82rXFpCQSJ  
# - TENCENT_SECRET_KEY=wgDXjlbEhElBNdpunW6UfeS4UjnfKn37

# 创建数据库
mysql -u root -p
CREATE DATABASE ai_photo CHARACTER SET utf8mb4;
exit;

# 运行数据库迁移
npm run db:migrate

# 启动开发服务器
npm run dev

# ✅ 后端运行在 http://localhost:3000
# 测试: curl http://localhost:3000/health
```

### 2. 前端启动

```bash
# 打开新终端,进入前端目录
cd frontend

# 安装依赖(首次)
npm install

# 配置环境变量
cp .env.local.example .env.local

# 启动开发服务器
npm run dev

# ✅ 前端运行在 http://localhost:3000
```

### 3. 测试API

```bash
# 发送验证码
curl -X POST http://localhost:3000/api/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000"}'

# 登录(验证码在后端日志中)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","code":"123456"}'

# 获取用户信息(需要token)
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📚 核心文档速查

### 新手入门
1. 先读 **README.md** - 了解项目全貌
2. 再读 **QUICK_START.md**(本文档) - 快速启动
3. 然后读 **TECH_STACK_GUIDE.md** - 技术栈详解

### 开发必读
- **IMPLEMENTATION_GUIDE.md** - 核心代码示例
- **API_DOCUMENTATION.md** - API接口文档

### 进度跟踪
- **PROGRESS_REPORT.md** - 当前进度
- **FINAL_DELIVERY_SUMMARY.md** - 已完成内容

---

## 🎯 核心功能清单

### 已实现 (后端)
- ✅ POST /api/auth/send-code - 发送验证码
- ✅ POST /api/auth/login - 登录/注册
- ✅ GET /api/auth/me - 获取用户信息
- ✅ POST /api/membership/purchase - 购买会员
- ✅ POST /api/membership/payment-callback - 支付回调
- ✅ GET /api/membership/status - 会员状态

### 待实现
- ⏳ 前端页面(登录、购买、工作台)
- ⏳ 媒体服务(STS临时密钥)
- ⏳ 任务服务(创建、查询)
- ⏳ 腾讯数据万象集成
- ⏳ RunningHub集成

---

## ⚠️ 重要约束

### 1. 配额管理 - NON-NEGATIVE保证
```javascript
// ✅ 必须使用事务+行锁
await db.transaction(async (trx) => {
  const user = await trx('users').where('id', userId).forUpdate().first();
  await trx('users').decrement('quota_remaining', 1);
});
```

### 2. 配额值配置化
```bash
# ✅ 使用环境变量
PLAN_MONTHLY_QUOTA=100

# ❌ 禁止硬编码
const QUOTA = 100;
```

### 3. 第一条闭环约束
> 支付、会员、配额、任务必须同步开发,不能各做各的

---

## 🐛 常见问题

### Q1: 数据库连接失败?
A: 检查 .env 文件中的 DB_PASSWORD 是否正确

### Q2: 验证码收不到?
A: 开发环境验证码会打印在后端控制台日志中

### Q3: API请求401?
A: 检查 Authorization 头是否包含有效token

### Q4: 前端跨域问题?
A: 后端已配置CORS,确保API_URL配置正确

---

## 📞 技术支持

- **文档目录**: 项目根目录下的 *.md 文件
- **后端代码**: backend/src/
- **前端代码**: frontend/src/
- **数据库迁移**: backend/src/db/migrations/

---

## 🎉 下一步

1. ✅ 启动后端和前端
2. ✅ 测试已实现的API
3. 📝 阅读 IMPLEMENTATION_GUIDE.md
4. 💻 开始开发前端页面
5. 🔗 打通第一条闭环

---

**祝开发顺利!** 🚀

有疑问请查阅对应文档,所有设计和代码都有详细说明。
