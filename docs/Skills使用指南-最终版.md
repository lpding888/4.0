# 🚀 Skills 使用指南 - 最终版

> 老王出品！经过实战验证的 AI Dev Skills 完整使用指南！

---

## ✅ 已确认可用的功能

经过测试，Claude Code v2.0.30 **完美支持** Skills 工具！

### 验证结果：

- ✅ **Skill 工具原生支持**：`请使用 backend-dev skill`
- ✅ **自动读取项目 Skills**：`skills/backend_dev_skill/SKILL.md`
- ✅ **规范完全生效**：OpenAPI 先行、TDD 推动、CHECKLIST 自检
- ✅ **多文件智能加载**：自动读取 SKILL.md + README.md + FLOW.md

---

## 🎯 推荐用法（最简单！）

### 方式 1：Skill 工具（⭐⭐⭐⭐⭐ 推荐）

```
请使用 backend-dev skill 开发健康检查 API
```

**就这么简单！** Claude 会：
1. 自动识别 `backend-dev skill`
2. 读取 `skills/backend_dev_skill/SKILL.md`
3. 按照规范执行

**适用场景**：
- ✅ 日常开发任务
- ✅ 快速原型
- ✅ 所有项目内开发

---

## 📚 8 个 Skills 快速使用

### 1. Backend Dev - 后端开发

```
请使用 backend-dev skill 开发用户登录 API
- POST /api/v1/auth/login
- 接收：email + password
- 返回：JWT token
```

**产出**：
- OpenAPI 契约（yaml）
- 数据库迁移（Knex）
- 路由/控制器/服务/仓储代码
- 单元测试 + 集成测试（覆盖率 ≥ 80%）

---

### 2. Frontend Dev - 前端开发

```
请使用 frontend-dev skill 开发用户登录页面
- 路径：/login
- 表单：email + password
- 技术栈：Next.js 14 + AntD 5
```

**产出**：
- 页面组件（page.tsx）
- 表单组件（LoginForm.tsx）
- 状态管理（Zustand）
- E2E 测试（Playwright）

---

### 3. SCF Worker - 云函数开发

```
请使用 scf-worker skill 开发图片压缩云函数
- 输入：COS 图片 URL
- 输出：压缩后图片
- 平台：腾讯云 SCF
```

**产出**：
- 云函数代码（index.js）
- 配置文件（serverless.yml）
- 单元测试
- 部署脚本

---

### 4. QA Acceptance - 质量验收

```
请使用 qa-acceptance skill 测试用户登录功能
- E2E 测试
- 性能测试
- 安全测试
```

**产出**：
- E2E 测试脚本（Playwright）
- 性能测试脚本（k6）
- 测试报告
- Bug 清单

---

### 5. Reviewer - 代码审查

```
请使用 reviewer skill 审查这段代码：

[粘贴代码]

审查维度：
- 安全性
- 性能
- 规范性
```

**产出**：
- 问题清单（P0/P1/P2 优先级）
- 修复建议
- 修复任务卡（如 CMS-B-002-FIX-01）

---

### 6. Product Planner - 产品规划

```
请使用 product-planner skill 拆分任务卡

功能需求：用户管理 CRUD
- 列表（分页、搜索、排序）
- 详情
- 创建
- 更新
- 删除（软删除）

技术栈：Express.js + Next.js
```

**产出**：
- 需求分析文档
- OpenAPI 契约
- 任务卡（JSON 格式）
- 前后端协作契约

---

### 7. Billing Guard - 计费审计

```
请使用 billing-guard skill 设计配额管理系统
- 功能：限流、降级、成本审计
```

**产出**：
- 配额表设计
- 限流策略
- 降级方案
- 成本审计日志

---

### 8. CodeBuddy Deploy - 部署运维

```
请使用 codebuddy-deploy skill 部署应用
- 平台：宝塔 + PM2
- 环境：生产环境
```

**产出**：
- 部署脚本
- Nginx 配置
- PM2 配置
- 健康检查
- 回滚方案

---

## 🔥 高级用法：链式协作

### 完整功能开发（4 个 Skills 协同）

```
我要开发"用户管理"功能，请依次使用以下 Skills：

1. product-planner skill：拆分任务卡
2. backend-dev skill：开发后端 API
3. frontend-dev skill：开发前端页面
4. qa-acceptance skill：测试验收

功能需求：
- 用户列表（分页、搜索、排序）
- 用户详情
- 创建用户
- 更新用户
- 删除用户（软删除）

技术栈：
- 后端：Express.js + Knex.js + MySQL 8
- 前端：Next.js 14 + AntD 5
```

**Claude 会**：
1. **Product Planner**：拆分 10+ 张任务卡
2. **Backend Dev**：开发 5 个 API 端点
3. **Frontend Dev**：开发 5 个页面/组件
4. **QA Acceptance**：E2E 测试 + 性能测试

**预计产出**：
- 📋 10+ 张任务卡
- 📝 OpenAPI 契约（完整）
- 💾 数据库迁移（users 表 + 索引）
- 🔧 后端代码（5 个端点）
- 🎨 前端代码（5 个页面）
- ✅ 测试代码（覆盖率 ≥ 80%）
- 📊 测试报告

---

## 🎯 实战案例

### 案例 1：5 分钟开发健康检查 API

**Prompt**：
```
请使用 backend-dev skill 开发健康检查 API
- GET /health
- 返回：{ status: "ok", timestamp: 当前时间 }
```

**产出**：
```
✅ openapi/health.yaml
✅ src/api/health.js
✅ tests/integration/health.spec.js
✅ README 更新
```

---

### 案例 2：15 分钟开发用户登录

**Prompt**：
```
请使用 backend-dev skill 开发用户登录 API
- POST /api/v1/auth/login
- 接收：{ email, password }
- 返回：{ token, user }
- 要求：JWT + bcrypt + 速率限制
```

**产出**：
```
✅ openapi/auth.yaml
✅ migrations/xxx_create_users_table.js
✅ src/api/auth/login.js
✅ src/services/authService.js
✅ src/repositories/userRepository.js
✅ src/middlewares/rateLimit.js
✅ tests/unit/authService.spec.js
✅ tests/integration/auth.spec.js
✅ 覆盖率报告（85%）
```

---

### 案例 3：30 分钟完整 CRUD

**Prompt**：
```
请依次使用以下 Skills 开发"文章管理"功能：

1. product-planner skill：拆分任务卡
2. backend-dev skill：开发后端 API
3. frontend-dev skill：开发前端页面

功能：
- 文章列表（分页、搜索、排序）
- 文章详情
- 创建文章
- 更新文章
- 删除文章（软删除）

技术栈：Express.js + Next.js + MySQL
```

---

## 📊 效果对比

### 传统 AI 开发 vs AI Dev Skills

| 维度 | **传统 AI** | **AI Dev Skills** |
|-----|-----------|------------------|
| 代码规范 | ❌ 随机风格 | ✅ 强制规范（RULES） |
| 质量保障 | ❌ 没测试 | ✅ 覆盖率 ≥ 80% |
| API 设计 | ❌ 直接写代码 | ✅ OpenAPI 先行 |
| 响应格式 | ❌ 乱七八糟 | ✅ 统一格式 |
| 性能 | ❌ 未优化 | ✅ P95 ≤ 200ms |
| 安全 | ❌ 未加固 | ✅ 鉴权/速率/审计 |
| 开发时间 | 2-3 天 | **4-6 小时** |

---

## 🔍 如何判断 Skill 是否生效？

### ✅ 生效的 10 个标志：

1. Claude 说 "我已读取 backend-dev skill"
2. 先设计 **OpenAPI 契约**（yaml 格式）
3. 提供完整的 **目录结构**
4. 响应格式是 `{ code: 0, message: "ok", data: {...}, requestId: "..." }`
5. 编写 **单元测试**（Jest）
6. 编写 **集成测试**（Supertest）
7. 提到 "覆盖率 ≥ 80%"
8. 提到 "P95 ≤ 200ms"
9. 遵循 **分层架构**（路由/控制器/服务/仓储）
10. 最后用 **CHECKLIST 自检**

### ❌ 没生效的标志：

1. 直接写代码，不设计 OpenAPI
2. 响应格式乱七八糟
3. 没有测试
4. 目录结构随意
5. 没有提到规范要求

---

## 🛠️ 故障排查

### 问题 1：Claude 说找不到 skill

**解决方案**：
```bash
# 检查 skills/ 目录是否存在
ls skills/backend_dev_skill/

# 如果不存在，创建并复制
mkdir -p skills/backend_dev_skill
cp ~/.claude/plugins/marketplaces/ai-dev-skills/backend-dev.md skills/backend_dev_skill/SKILL.md
```

---

### 问题 2：Skill 读取了但没按规范执行

**解决方案**：
```
⚠️ 严格警告 ⚠️
你必须严格遵守 backend-dev skill 的所有规则！
违反任何一条将被 Reviewer 退回！

重点：
1. OpenAPI 先行（禁止跳过）
2. TDD 推动（覆盖率 ≥ 80%）
3. 禁止在日志中打印敏感信息

请使用 backend-dev skill 开发健康检查 API
```

---

### 问题 3：想用其他 Skill

**解决方案**：
```
# 查看所有可用 Skills
ls skills/

# 使用其他 Skill
请使用 frontend-dev skill 开发登录页面
请使用 reviewer skill 审查代码
请使用 qa-acceptance skill 测试功能
```

---

## 📝 快捷模板

### 后端开发模板

```
请使用 backend-dev skill 开发 {功能名称} API

需求：
- 路径：{HTTP 方法} {路径}
- 接收：{请求体}
- 返回：{响应体}
- 技术栈：Express.js + MySQL

特殊要求：
- {如：JWT 认证、速率限制、缓存等}
```

### 前端开发模板

```
请使用 frontend-dev skill 开发 {页面名称}

需求：
- 路径：{路由}
- 功能：{功能描述}
- 技术栈：Next.js 14 + AntD 5

特殊要求：
- {如：响应式设计、无障碍性、性能优化等}
```

### 完整功能模板

```
请依次使用以下 Skills 开发"{功能名称}"：

1. product-planner skill：拆分任务卡
2. backend-dev skill：开发后端 API
3. frontend-dev skill：开发前端页面
4. qa-acceptance skill：测试验收

功能需求：
- {需求 1}
- {需求 2}
- {需求 3}

技术栈：
- 后端：Express.js + MySQL
- 前端：Next.js + AntD
```

---

## 🎉 总结

### 你现在拥有的超能力：

✅ **8 个专业 Skills**：覆盖完整开发链路
✅ **一句话调用**：`请使用 backend-dev skill`
✅ **质量保障内置**：覆盖率 ≥ 80%、P95 ≤ 200ms
✅ **真实可落地**：OpenAPI 先行、TDD 推动
✅ **跨 Skill 协作**：Product Planner → Backend Dev → Frontend Dev → QA

### 开发效率提升：

- **传统开发**：2-3 天
- **AI + Skills**：**4-6 小时** 🚀

### 代码质量提升：

- **测试覆盖率**：80%+ ✅
- **响应时间**：P95 ≤ 200ms ✅
- **安全加固**：JWT + RBAC + 速率限制 ✅
- **可观测性**：结构化日志 + requestId ✅

---

艹！现在就去用 Skills 开发你的项目吧！💪

有问题随时找老王！🚀
