 # 🚀 AI Dev Skills - AI 辅助 Web 开发的标准化 Skills 手册

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Claude](https://img.shields.io/badge/Claude-Sonnet%204-orange.svg)
![Stars](https://img.shields.io/github/stars/你的用户名/ai-dev-skills?style=social)

**让 AI 像专业团队一样开发 Web 应用**

[快速开始](#-快速开始) • [在线演示](#-成功案例) • [完整文档](#-完整文档) • [参与贡献](#-参与贡献)

</div>

---

## 🎯 这是什么？

**AI Dev Skills** 是一套 **8 个标准化 Skills 手册**，让 AI（Claude/GPT/Gemini）能够像专业软件团队一样，按照 **后端开发、前端开发、QA、代码审查、部署** 等角色分工，**高质量、可追溯、可复现**地完成 Web 应用开发。

### 传统 AI 开发 vs AI Dev Skills

| 维度 | **传统 AI 开发** | **AI Dev Skills** |
|-----|----------------|------------------|
| 代码规范 | ❌ AI 随便写，风格不统一 | ✅ RULES 定义红线，强制规范 |
| 质量保障 | ❌ 没测试，没文档，难维护 | ✅ 覆盖率 ≥ 80%，P95 ≤ 200ms |
| 协作流程 | ❌ 一次性对话，无法追溯 | ✅ 8 步工作流，契约驱动 |
| 技术选型 | ❌ AI 乱用技术栈 | ✅ CONTEXT 锁定技术栈 |
| 代码复用 | ❌ 重复造轮子 | ✅ EXAMPLES 提供模板 |

---

## ✨ 核心特性

### 🎭 8 个专业角色，覆盖完整开发链路

```
📋 Product Planner  →  需求分析、任务卡生成
💻 Backend Dev      →  Express.js + Knex.js + MySQL 后端开发
🎨 Frontend Dev     →  Next.js + React + AntD 前端开发
☁️  SCF Worker       →  腾讯云云函数开发
🔍 Reviewer         →  代码审查、修复任务卡
✅ QA Acceptance    →  E2E 测试、质量验收
💰 Billing Guard    →  成本审计、配额管理
🚀 CodeBuddy Deploy →  部署与运维
```

### 📝 6 大核心模块，确保交付质量

每个 Skills 手册包含：

1. **README** - 职责、协作关系、交付物
2. **RULES** - 行为准则、红线约束（如：禁止跳过 OpenAPI、禁止明文密码）
3. **CONTEXT** - 技术栈、配置、数据库设计
4. **FLOW** - 8 步标准工作流程
5. **CHECKLIST** - 提交前自检清单（20+ 项检查）
6. **EXAMPLES** - 真实可用的代码模板

### 🔥 真实可落地，不是空谈

- ✅ **真实技术栈**：Express.js + Knex.js + MySQL 8 + Redis + Next.js 14
- ✅ **真实代码模板**：OpenAPI 契约、Knex 迁移、Jest 测试、React 组件
- ✅ **真实质量门禁**：覆盖率 ≥ 80%、P95 ≤ 200ms、安全审计
- ✅ **真实项目验证**：已用于开发 CMS 内容管理系统（46 张任务卡）

---

## 🚀 快速开始

### 方式 1：手动复制（5 分钟上手）

```bash
# 1. 克隆仓库
git clone https://github.com/你的用户名/ai-dev-skills.git
cd ai-dev-skills

# 2. 打开任意 SKILL.md
cat skills/backend_dev_skill/SKILL.md

# 3. 复制全部内容，粘贴给 Claude/GPT
```

**Prompt 示例**：
```markdown
你现在是 Backend Dev，请严格遵守以下 Skills 手册：

[粘贴 backend_dev_skill/SKILL.md 全部内容]

任务：实现用户认证 API（JWT + RBAC）
技术栈：Express.js + Knex.js + MySQL 8
```

### 方式 2：Claude Code 插件模式（30 分钟配置）

```bash
# 1. 创建插件目录
mkdir -p .claude/plugins/ai-dev-skills

# 2. 复制 SKILL.md 文件
cp skills/backend_dev_skill/SKILL.md .claude/plugins/ai-dev-skills/backend-dev.md
cp skills/frontend_dev_skill/SKILL.md .claude/plugins/ai-dev-skills/frontend-dev.md
# ... 复制其他 6 个 Skills

# 3. 在 Claude Code 中安装
/plugin marketplace add .claude/plugins/
/plugin install ai-dev-skills

# 4. 使用（Claude 自动判断何时使用哪个 Skill）
"实现用户认证 API"  # Claude 自动加载 backend-dev Skill
```

### 方式 3：结合任务卡使用（项目协同）

适合有明确任务拆分的项目：

```markdown
# 角色：Backend Dev
# Skills 手册：[粘贴 backend_dev_skill/SKILL.md]

# 任务卡：
{
  "taskId": "AUTH-001",
  "title": "实现 JWT 认证中间件",
  "technicalRequirements": [
    "实现 JWT 签名与验证",
    "支持 Token 刷新机制",
    "集成 RBAC 权限控制"
  ],
  "acceptanceCriteria": [
    "单元测试覆盖率 ≥ 80%",
    "JWT 过期自动刷新",
    "401/403 错误处理正确"
  ]
}

# 指令：请严格按照 Backend Dev Skills 手册执行此任务卡
```

---

## 📚 完整文档

### Skills 手册列表

| Skills 名称 | 文件路径 | 职责 | 技术栈 |
|-----------|---------|------|-------|
| [Backend Dev](skills/backend_dev_skill/SKILL.md) | `backend_dev_skill/SKILL.md` | 后端 API 开发 | Express.js + Knex.js + MySQL + Redis |
| [Frontend Dev](skills/frontend_dev_skill/SKILL.md) | `frontend_dev_skill/SKILL.md` | 前端 UI 开发 | Next.js 14 + React 18 + AntD + Zustand |
| [SCF Worker](skills/scf_worker_skill/SKILL.md) | `scf_worker_skill/SKILL.md` | 云函数开发 | 腾讯云 SCF + Node.js |
| [QA Acceptance](skills/qa_acceptance_skill/SKILL.md) | `qa_acceptance_skill/SKILL.md` | 质量验收 | Jest + Playwright + k6 |
| [Reviewer](skills/reviewer_skill/SKILL.md) | `reviewer_skill/SKILL.md` | 代码审查 | ESLint + 安全审计 |
| [Product Planner](skills/product_planner_skill/SKILL.md) | `product_planner_skill/SKILL.md` | 需求分析 | 任务卡生成 + 契约设计 |
| [Billing Guard](skills/billing_guard_skill/SKILL.md) | `billing_guard_skill/SKILL.md` | 成本审计 | 配额管理 + 限流降级 |
| [CodeBuddy Deploy](skills/codebuddy_deploy_skill/SKILL.md) | `codebuddy_deploy_skill/SKILL.md` | 部署运维 | PM2 + Nginx + 宝塔 |

### 配套文档

- 📖 [使用指南](skills/使用指南-SKILL.md格式.md) - 3 种使用方式详解
- 🔧 [MCP 配置指南](docs/推荐MCP服务器配置.md) - 推荐的 MCP 服务器
- 🏗️ [CMS 系统实战](docs/CMS自研技术方案-完整规划.md) - 完整项目案例
- 📋 [任务卡模板](tasks/cms-system/README.md) - 46 张任务卡示例

---

## 🎬 成功案例

### 案例 1：CMS 内容管理系统

**项目背景**：自研 CMS 系统，支持可视化表单设计、Pipeline 编排、Prompt 管理

**使用 Skills**：
- Product Planner → 拆分 46 张任务卡
- Backend Dev → 开发 Provider 管理、缓存系统、内容管理 API（15 张卡）
- Frontend Dev → 开发表单设计器、Pipeline 编辑器、Prompt 编辑器（27 张卡）
- SCF Worker → 开发云函数 Provider（2 张卡）
- QA Acceptance → E2E 测试 + 性能测试（2 张卡）

**开发效率**：
- 传统开发：预计 2-3 个月
- AI + Skills：**4 周完成 MVP**
- 代码质量：UT 覆盖率 **85%**，P95 响应时间 **150ms**

**关键亮点**：
- ✅ OpenAPI 契约先行，前后端零沟通成本
- ✅ 缓存分层（Local LRU → Redis → Snapshot → DB），性能提升 10x
- ✅ 配置快照机制，支持一键回滚
- ✅ 46 张任务卡全部可追溯

### 案例 2：用户认证系统

**使用 Skills**：Backend Dev

**AI 自动完成**：
- ✅ JWT 签名与验证中间件
- ✅ RBAC 权限矩阵（5 角色 × 20 权限）
- ✅ Token 刷新机制（滑动窗口）
- ✅ 单元测试 + 集成测试（覆盖率 92%）
- ✅ OpenAPI 契约 + Swagger UI
- ✅ 速率限制（登录 20 次/分钟）

**开发时间**：传统 2-3 天 → AI + Skills **4 小时**

---

## 🔧 技术栈

### 后端技术栈
- **Runtime**: Node.js 18+
- **Web 框架**: Express.js
- **数据库**: MySQL 8.0 + Knex.js ORM
- **缓存**: Redis
- **测试**: Jest + Supertest
- **文档**: OpenAPI (Swagger)
- **日志**: pino（结构化日志）
- **部署**: PM2 + Nginx

### 前端技术栈
- **框架**: Next.js 14 (App Router)
- **UI 库**: React 18 + AntD 5
- **状态管理**: Zustand
- **表单**: react-hook-form + Zod
- **测试**: Jest + Playwright
- **样式**: Tailwind CSS + CSS Modules

### 云服务
- **云函数**: 腾讯云 SCF
- **对象存储**: 腾讯云 COS
- **CDN**: 腾讯云 CDN

---

## 💡 设计理念

### 1. 契约驱动开发（Contract-Driven Development）

```
Product Planner → 生成 OpenAPI 契约
        ↓
Backend Dev → 严格按契约实现 API
        ↓
Frontend Dev → 严格按契约调用 API
        ↓
QA Acceptance → 严格按契约验证
```

**核心原则**：
- OpenAPI 契约是唯一事实来源
- 禁止在未更新契约的情况下修改接口
- 前后端通过 `API_CONTRACT_READY` 事件协同

### 2. 质量门禁内置（Quality Gates Built-in）

每个 Skills 都有严格的质量门禁：

**Backend Dev**：
- ✅ 单元测试覆盖率 ≥ 80%
- ✅ 核心接口 P95 ≤ 200ms
- ✅ SQL 防注入（Knex 参数化）
- ✅ 敏感信息脱敏（日志/响应）
- ✅ 审计日志（关键操作记录）

**Frontend Dev**：
- ✅ 组件测试覆盖率 ≥ 70%
- ✅ Lighthouse 性能分 ≥ 90
- ✅ 无障碍性（WCAG 2.1 AA）
- ✅ 响应式设计（mobile-first）

### 3. 可观测性优先（Observability First）

```javascript
// 所有日志包含 requestId，支持分布式追踪
logger.info({
  requestId: 'req-123',
  userId: 'user-456',
  route: '/api/v1/users',
  duration: 45,
  status: 200
});

// 所有错误统一格式
{
  "code": 10001,
  "message": "bad_request: field email required",
  "requestId": "req-123"
}
```

### 4. 防御性编程（Defensive Programming）

**禁止清单**（RULES 红线）：
- ❌ 禁止跳过 OpenAPI 直接实现接口
- ❌ 禁止在仓库提交明文密钥/证书
- ❌ 禁止在日志中打印敏感信息
- ❌ 禁止 SELECT * 或无索引全表扫描
- ❌ 禁止未经 Planner 确认修改契约

---

## 🌟 为什么选择 AI Dev Skills？

### vs 其他方案对比

| 方案 | 标准化 | 质量保障 | 学习成本 | 灵活性 | 综合评分 |
|-----|-------|---------|---------|-------|---------|
| **AI Dev Skills** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 纯人工 Prompt | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Cursor Rules | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| GitHub Copilot | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |

### 适用人群

✅ **创业团队**（2-5 人）
- 快速建立标准化开发流程
- AI 辅助开发占比高
- 需要质量保障但没有专职 QA

✅ **独立开发者**
- 一个人干前后端
- 需要 AI 充当"虚拟团队"
- 希望代码质量有保障

✅ **教育培训**
- 教学生规范开发流程
- 演示 AI 辅助开发最佳实践
- 作为课程案例

✅ **开源项目**
- 贡献者水平参差不齐
- 需要统一代码规范
- AI 代码审查辅助

---

## 🤝 参与贡献

我们欢迎所有形式的贡献！

### 贡献方式

1. **提交 Issue**
   - 报告 Bug
   - 提出新功能建议
   - 分享使用案例

2. **提交 Pull Request**
   - 修复 Bug
   - 增加新 Skills（如移动端开发、AI 训练）
   - 改进文档
   - 添加示例代码

3. **分享经验**
   - 在 Discussions 分享使用心得
   - 录制视频教程
   - 撰写博客文章

### 开发指南

```bash
# 1. Fork 仓库
git clone https://github.com/你的用户名/ai-dev-skills.git
cd ai-dev-skills

# 2. 创建分支
git checkout -b feature/new-skill

# 3. 修改 SKILL.md
# 确保包含：README + RULES + CONTEXT + FLOW + CHECKLIST + EXAMPLES

# 4. 测试
# 用 Claude/GPT 测试新 Skill 是否能正常工作

# 5. 提交 PR
git add .
git commit -m "feat: 添加移动端开发 Skill"
git push origin feature/new-skill
```

详见 [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 📄 开源协议

本项目采用 [MIT License](LICENSE) 开源协议。

你可以自由：
- ✅ 商业使用
- ✅ 修改
- ✅ 分发
- ✅ 私人使用

唯一要求：保留原作者版权声明。

---

## 🙏 致谢

### 灵感来源

- [Anthropic Skills](https://github.com/anthropics/skills) - Claude 官方 Skills 仓库
- [Awesome ChatGPT Prompts](https://github.com/f/awesome-chatgpt-prompts) - Prompt 工程最佳实践
- [Cursor Rules](https://cursor.directory/) - Cursor 规则集合

### 技术支持

- [Claude by Anthropic](https://claude.ai/) - AI 助手
- [Next.js](https://nextjs.org/) - React 框架
- [Express.js](https://expressjs.com/) - Node.js Web 框架
- [Knex.js](https://knexjs.org/) - SQL Query Builder

---

## 📞 联系我们

- **GitHub Issues**: [提交问题](https://github.com/你的用户名/ai-dev-skills/issues)
- **GitHub Discussions**: [参与讨论](https://github.com/你的用户名/ai-dev-skills/discussions)
- **Email**: your-email@example.com
- **Twitter**: [@your_twitter](https://twitter.com/your_twitter)

---

## 🗺️ 路线图

### v1.1（2025 Q1）
- [ ] 增加移动端开发 Skill（React Native）
- [ ] 增加 AI 训练 Skill（Fine-tuning）
- [ ] 支持更多数据库（PostgreSQL、MongoDB）

### v1.2（2025 Q2）
- [ ] Web UI 管理界面（在线编辑 Skills）
- [ ] 任务卡生成器（自动拆分任务）
- [ ] VS Code 插件

### v2.0（2025 Q3）
- [ ] 多语言支持（English、日本語）
- [ ] 企业版（团队协作、权限管理）
- [ ] SaaS 平台（在线使用）

---

## ⭐ Star History

如果这个项目对你有帮助，请给个 Star ⭐！

[![Star History Chart](https://api.star-history.com/svg?repos=你的用户名/ai-dev-skills&type=Date)](https://star-history.com/#你的用户名/ai-dev-skills&Date)

---

<div align="center">

**用 AI 开发，用 Skills 规范** 🚀

Made with ❤️ by [你的名字](https://github.com/你的用户名)

</div>
