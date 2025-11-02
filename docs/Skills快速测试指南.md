# 🚀 Skills 快速测试指南

> 老王手把手教你测试 AI Dev Skills 是否安装成功！

---

## ✅ 安装状态

### 已完成的安装步骤：

1. ✅ **创建项目本地插件目录**：`.claude/plugins/ai-dev-skills/`
2. ✅ **复制 8 个 SKILL.md 文件**到本地插件目录
3. ✅ **安装到系统目录**：`~/.claude/plugins/marketplaces/ai-dev-skills/`
4. ✅ **创建插件配置**：`plugin.json`
5. ✅ **更新 Claude Code**：v2.0.28 → v2.0.30

### 安装位置：

```
系统插件目录：C:\Users\qq100\.claude\plugins\marketplaces\ai-dev-skills\

包含文件：
- backend-dev.md        (17KB)
- frontend-dev.md       (26KB)
- scf-worker.md         (19KB)
- qa-acceptance.md      (16KB)
- reviewer.md           (22KB)
- product-planner.md    (18KB)
- billing-guard.md      (15KB)
- codebuddy-deploy.md   (16KB)
- plugin.json           (配置文件)
```

---

## 🎯 测试方法 1：Skill 工具（推荐）

### 步骤：

1. **打开 Claude Code**（如果已打开，重启一下）
2. **开新对话**
3. **输入以下命令**：

```
请使用 backend-dev skill

任务：开发健康检查 API
- 路径：GET /health
- 返回：{ status: "ok", timestamp: 当前时间戳 }
```

### 预期结果：

如果 Skill 生效，Claude 会：
- ✅ 提到 "OpenAPI 先行"
- ✅ 先设计 OpenAPI 契约（yaml 格式）
- ✅ 实现代码（路由/控制器）
- ✅ 编写测试（Jest + Supertest）
- ✅ 使用统一响应格式：`{ code: 0, message: "ok", data: {...} }`
- ✅ 最后用 CHECKLIST 自检

---

## 🎯 测试方法 2：直接读取文件（100% 有效）

### 步骤：

1. **打开 Claude Code**
2. **开新对话**
3. **输入以下 Prompt**：

```
请读取文件：C:\Users\qq100\.claude\plugins\marketplaces\ai-dev-skills\backend-dev.md

然后严格按照这个 Skill 的规范，帮我开发一个健康检查 API：
- 路径：GET /health
- 返回：{ status: "ok", timestamp: 当前时间戳 }
- 技术栈：Express.js

请按照 Backend Dev Skill 的 8 步工作流程执行。
```

### 预期结果：

Claude 会严格遵守 Skills 手册，按照 FLOW 中的 8 步执行：
1. 接收任务卡 ✅
2. 理解需求与契约 ✅
3. 设计 API（OpenAPI 先行）✅
4. 设计数据模型 ✅
5. 实现代码 ✅
6. 编写测试 ✅
7. 代码审查（自检）✅
8. 部署上线（提供说明）✅

---

## 🎯 测试方法 3：项目内引用（便捷）

### 步骤：

1. **在你的项目目录下**（当前目录就可以）
2. **开新对话**
3. **输入**：

```
请读取文件：.claude/plugins/ai-dev-skills/backend-dev.md

任务：开发用户登录 API
- POST /api/v1/auth/login
- 接收：email + password
- 返回：JWT token
- 技术栈：Express.js + MySQL

请严格按照 backend-dev Skill 执行。
```

---

## 🔍 如何判断 Skill 是否生效？

### ✅ 生效的 10 个标志：

1. Claude 会说 "我已读取 backend-dev.md"
2. 会先设计 **OpenAPI 契约**（yaml 格式）
3. 会提供完整的 **目录结构**
4. 响应格式是 `{ code: 0, message: "ok", data: {...}, requestId: "..." }`
5. 会编写 **单元测试**（Jest）
6. 会编写 **集成测试**（Supertest）
7. 会提到 "覆盖率 ≥ 80%"
8. 会提到 "P95 ≤ 200ms"
9. 会遵循 **分层架构**（路由/控制器/服务/仓储）
10. 最后会用 **CHECKLIST 自检**

### ❌ 没生效的标志：

1. 直接写代码，不设计 OpenAPI
2. 响应格式乱七八糟
3. 没有测试
4. 目录结构随意
5. 没有提到 "OpenAPI 先行"
6. 没有 CHECKLIST 自检

---

## 🎬 完整测试案例

### 案例 1：简单 API（5 分钟）

**Prompt**：
```
请使用 backend-dev skill

任务：开发健康检查 API
- GET /health
- 返回：{ status: "ok", timestamp: 当前时间 }
```

**预期产出**：
- `openapi/health.yaml`（OpenAPI 契约）
- `src/api/health.js`（路由/控制器）
- `tests/integration/health.spec.js`（测试）
- README 更新

---

### 案例 2：用户认证 API（15 分钟）

**Prompt**：
```
请读取文件：.claude/plugins/ai-dev-skills/backend-dev.md

任务：开发用户登录 API
- POST /api/v1/auth/login
- 接收：{ email: string, password: string }
- 返回：{ token: string, user: { id, email, name } }
- 技术栈：Express.js + MySQL + JWT
- 要求：
  - JWT 过期时间 24 小时
  - 密码使用 bcrypt 加密
  - 登录失败 5 次锁定 15 分钟（速率限制）
  - 审计日志记录

请严格按照 Backend Dev Skill 的规范执行。
```

**预期产出**：
- `openapi/auth.yaml`（完整的 OpenAPI 契约）
- `migrations/xxx_create_users_table.js`（Knex 迁移）
- `src/api/auth/login.js`（路由/控制器）
- `src/services/authService.js`（业务逻辑）
- `src/repositories/userRepository.js`（数据访问）
- `src/middlewares/rateLimit.js`（速率限制中间件）
- `tests/unit/authService.spec.js`（单元测试）
- `tests/integration/auth.spec.js`（集成测试）
- 覆盖率报告（≥ 80%）

---

### 案例 3：完整功能开发（30 分钟）

**Prompt**：
```
请依次使用以下 Skills：

1. Product Planner：拆分任务卡
2. Backend Dev：开发后端 API
3. Frontend Dev：开发前端页面
4. QA Acceptance：测试验收

功能需求：用户管理 CRUD
- 列表（分页、搜索、排序）
- 详情
- 创建
- 更新
- 删除（软删除）

技术栈：
- 后端：Express.js + Knex.js + MySQL 8
- 前端：Next.js 14 + React 18 + AntD 5

请从 Product Planner 开始，依次完成。
```

---

## 🐛 故障排查

### 问题 1：Claude 说找不到文件

**解决方案**：
```bash
# 检查文件是否存在
ls ~/.claude/plugins/marketplaces/ai-dev-skills/

# 如果不存在，重新复制
cd "c:\Users\qq100\Desktop\迭代目录\新建文件夹 (4)"
cp .claude/plugins/ai-dev-skills/*.md ~/.claude/plugins/marketplaces/ai-dev-skills/
```

---

### 问题 2：Claude 没有按 Skill 规范执行

**解决方案**：
1. **明确告诉 Claude 要严格遵守**：
   ```
   ⚠️ 重要警告 ⚠️
   你必须严格遵守 backend-dev Skill 的所有规则！
   违反任何一条将被 Reviewer 退回！

   重点：
   1. OpenAPI 先行（禁止跳过）
   2. TDD 推动（覆盖率 ≥ 80%）
   3. 禁止在日志中打印敏感信息
   ```

2. **分步骤明确要求**：
   ```
   第一步：设计 OpenAPI 契约
   第二步：设计数据库表
   第三步：实现代码
   第四步：编写测试
   第五步：用 CHECKLIST 自检
   ```

---

### 问题 3：Skill 工具无法使用

**解决方案**：用方法 2（直接读取文件），100% 有效：
```
请读取文件：C:\Users\qq100\.claude\plugins\marketplaces\ai-dev-skills\backend-dev.md

然后严格按照规范执行任务...
```

---

## 📊 测试记录表

| 测试项 | 方法 | 状态 | 备注 |
|-------|------|------|------|
| Skill 工具 | `请使用 backend-dev skill` | ⏳ 待测试 | 如果不支持，用方法 2 |
| 读取文件 | `请读取文件：xxx/backend-dev.md` | ⏳ 待测试 | 100% 有效 |
| 项目内引用 | `请读取文件：.claude/plugins/xxx` | ⏳ 待测试 | 便捷方式 |
| 健康检查 API | 简单测试案例 | ⏳ 待测试 | 5 分钟 |
| 用户登录 API | 中等测试案例 | ⏳ 待测试 | 15 分钟 |
| 完整 CRUD | 复杂测试案例 | ⏳ 待测试 | 30 分钟 |

---

## 🎯 下一步行动

### 立即测试（5 分钟）

1. **重启 Claude Code**（让新安装的插件生效）
2. **开新对话**
3. **复制粘贴测试案例 1**（健康检查 API）
4. **查看 Claude 的输出**
5. **对照"生效标志"检查**

### 测试成功后

1. **截图或复制 Claude 的输出**
2. **确认 Skill 已生效**
3. **开始用 Skills 开发真实项目**

### 测试失败后

1. **复制 Claude 的输出给老王看**
2. **老王帮你排查问题**
3. **调整配置后重新测试**

---

## 💡 老王的小提示

1. **新对话很重要**：每次测试都开新对话，避免上下文污染
2. **明确指令**：清楚告诉 Claude 要用哪个 Skill
3. **耐心等待**：第一次加载 Skill 可能需要几秒钟
4. **对照检查**：用"生效标志"对照 Claude 的输出
5. **有问题找老王**：截图或复制输出，老王帮你分析

---

艹，现在就去试试吧！记得反馈结果给老王！💪
