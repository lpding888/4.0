# Skills 使用指南 - SKILL.md 格式

> 老王出品，必属精品！这份指南教你怎么用压缩后的官方格式 Skills 手册。

---

## 🎯 你现在有什么

### 1. 原始 Skills 手册（已备份）
**位置**：`.backups/skills_backup_20251031_112506/skills/`

**结构**：每个 Skill 有 6 个文件
```
backend_dev_skill/
├── README.md          # 职责与基本信息
├── RULES.md           # 行为准则与红线
├── CONTEXT.md         # 项目背景与技术栈
├── EXAMPLES.md        # 代码示例
├── FLOW.md            # 工作流程
└── CHECKLIST.md       # 自检清单
```

### 2. 官方格式 Skills（新生成）
**位置**：`skills/<skill_name>/SKILL.md`

**结构**：每个 Skill 只有 1 个文件
```
backend_dev_skill/
└── SKILL.md           # 所有内容压缩成一个文件
```

**格式**：
```markdown
---
name: backend-dev
description: 后端开发专家，负责 Express.js + Knex.js...
---

# Backend Dev Skill - 后端开发手册
[原 6 个文件的内容按顺序组织]
```

---

## 📦 可用的 8 个 Skills

| Skill 名称 | SKILL.md 位置 | 职责 |
|-----------|--------------|-----|
| **Backend Dev** | `skills/backend_dev_skill/SKILL.md` | Express.js 后端开发（Provider/API/缓存） |
| **Frontend Dev** | `skills/frontend_dev_skill/SKILL.md` | Next.js 前端开发（表单/Pipeline/Prompt 编辑器） |
| **SCF Worker** | `skills/scf_worker_skill/SKILL.md` | 腾讯云云函数开发 |
| **QA Acceptance** | `skills/qa_acceptance_skill/SKILL.md` | E2E 测试与质量验收 |
| **Reviewer** | `skills/reviewer_skill/SKILL.md` | 代码审查与修复任务 |
| **Product Planner** | `skills/product_planner_skill/SKILL.md` | 需求分析与任务卡生成 |
| **Billing Guard** | `skills/billing_guard_skill/SKILL.md` | 成本审计与配额管理 |
| **CodeBuddy Deploy** | `skills/codebuddy_deploy_skill/SKILL.md` | 部署与运维 |

---

## 🚀 三种使用方式

### 方式 1：Claude Code 官方插件模式（推荐！）

**适合场景**：你希望 Claude 自动判断何时使用哪个 Skill

#### Step 1：创建插件市场仓库

在项目根目录创建 `.claude/plugins/` 目录：

```bash
mkdir -p .claude/plugins/ai-wardrobe-skills
```

#### Step 2：复制 SKILL.md 文件

```bash
# 复制所有 SKILL.md 到插件目录
cp skills/backend_dev_skill/SKILL.md .claude/plugins/ai-wardrobe-skills/backend-dev.md
cp skills/frontend_dev_skill/SKILL.md .claude/plugins/ai-wardrobe-skills/frontend-dev.md
cp skills/scf_worker_skill/SKILL.md .claude/plugins/ai-wardrobe-skills/scf-worker.md
cp skills/qa_acceptance_skill/SKILL.md .claude/plugins/ai-wardrobe-skills/qa-acceptance.md
cp skills/reviewer_skill/SKILL.md .claude/plugins/ai-wardrobe-skills/reviewer.md
cp skills/product_planner_skill/SKILL.md .claude/plugins/ai-wardrobe-skills/product-planner.md
cp skills/billing_guard_skill/SKILL.md .claude/plugins/ai-wardrobe-skills/billing-guard.md
cp skills/codebuddy_deploy_skill/SKILL.md .claude/plugins/ai-wardrobe-skills/codebuddy-deploy.md
```

#### Step 3：安装插件

在 Claude Code 中执行：

```bash
# 注册本地插件市场
/plugin marketplace add .claude/plugins/

# 安装所有 Skills
/plugin install ai-wardrobe-skills
```

#### Step 4：使用

**Claude 会自动判断何时使用哪个 Skill！**

```
你："实现 CMS Provider 动态加载机制"
Claude：[自动加载 backend-dev Skill] 开始按照 Backend Dev 规范开发...

你："设计表单编辑器组件"
Claude：[自动加载 frontend-dev Skill] 开始按照 Frontend Dev 规范开发...
```

---

### 方式 2：手动复制到 Prompt（快速上手）

**适合场景**：你想直接用，不想折腾插件配置

#### Step 1：打开对应的 SKILL.md

例如：`skills/backend_dev_skill/SKILL.md`

#### Step 2：复制全部内容

全选复制（Ctrl+A → Ctrl+C）

#### Step 3：粘贴给 AI

```
角色：Backend Dev
Skills 手册：
[粘贴 backend_dev_skill/SKILL.md 的全部内容]

任务卡：
[粘贴 tasks/cms-system/Backend Dev.json 中的某张任务卡]

请按照 Skills 手册的规范执行任务卡。
```

---

### 方式 3：结合任务卡使用（项目协同）

**适合场景**：你在执行 CMS 系统开发任务

#### Step 1：选择角色和任务卡

例如开发 Provider 管理：
- **角色**：Backend Dev
- **任务卡**：`tasks/cms-system/Backend Dev.json` 中的 `CMS-002`

#### Step 2：组合 Prompt

```markdown
# 角色
Backend Dev

# Skills 手册
[粘贴 skills/backend_dev_skill/SKILL.md 全部内容]

# 任务卡
{
  "taskId": "CMS-002",
  "module": "Provider管理",
  "title": "定义IProvider接口与BaseProvider基类",
  "phase": "Week 1",
  "estimatedHours": 4,
  "priority": "P0",
  "dependencies": ["CMS-001"],
  "technicalRequirements": [
    "定义 IProvider 接口（exec, validate, getSchema）",
    "实现 BaseProvider 基类（共享逻辑：缓存、日志、错误处理）"
  ],
  "acceptanceCriteria": [
    "IProvider 接口包含 exec/validate/getSchema 方法",
    "BaseProvider 提供缓存装饰器与统一错误处理"
  ]
}

# 指令
请严格按照 Backend Dev Skills 手册的规范执行此任务卡。
```

#### Step 3：AI 执行

Claude/GPT 会：
1. 按照 **FLOW** 执行 8 步流程
2. 遵循 **RULES** 的红线（OpenAPI 先行、TDD 推动）
3. 参考 **CONTEXT** 的技术栈（Express.js + Knex.js）
4. 使用 **EXAMPLES** 的代码模板
5. 完成后用 **CHECKLIST** 自检

---

## 🎓 最佳实践

### 1. 单任务单 Skill

❌ **错误做法**：
```
"帮我开发 Provider 管理 API 和表单编辑器"
[同时用 Backend Dev + Frontend Dev]
```

✅ **正确做法**：
```
第一次对话：
"帮我开发 Provider 管理 API"
[只用 Backend Dev Skill]

第二次对话：
"帮我开发表单编辑器"
[只用 Frontend Dev Skill]
```

### 2. 任务卡优先

如果有任务卡，**必须提供任务卡**！

```markdown
# Skills 手册
[粘贴 SKILL.md]

# 任务卡（重要！）
{
  "taskId": "CMS-XXX",
  ...
}
```

任务卡包含：
- `acceptanceCriteria`：验收标准（AI 会严格遵守）
- `technicalRequirements`：技术要求
- `aiPromptSuggestion`：AI 提示建议

### 3. 定期自检

AI 执行完后，让它用 CHECKLIST 自检：

```
请按照 Backend Dev Skills 手册的 CHECKLIST 自检，
列出已完成和未完成的项。
```

### 4. 跨 Skill 协作

有些任务需要多个 Skill 协同：

```markdown
# 场景：实现 Provider 管理功能（前后端联调）

## 第一步：Backend Dev 开发 API
[用 Backend Dev Skill + CMS-002 任务卡]

## 第二步：Frontend Dev 开发 UI
[用 Frontend Dev Skill + CMS-007 任务卡]
注意：等待 Backend Dev 发布 API_CONTRACT_READY 事件

## 第三步：QA Acceptance 测试
[用 QA Acceptance Skill + CMS-504 任务卡]
```

---

## 🔧 常见问题

### Q1：原来的 6 个文件还能用吗？

**答**：能！已经备份到 `.backups/skills_backup_20251031_112506/skills/`

如果你喜欢原来的方式，可以继续手动复制 6 个文件给 AI。

### Q2：SKILL.md 和原 6 个文件有啥区别？

**答**：
- **内容一样**：SKILL.md 是 6 个文件的压缩版，信息无损
- **格式不同**：SKILL.md 有 YAML frontmatter，符合官方规范
- **使用体验**：SKILL.md 可以用 `/plugin install` 自动加载

### Q3：Claude Code 的插件功能怎么用？

**答**：参考上面的"方式 1：Claude Code 官方插件模式"

简单说就是：
1. 把 SKILL.md 文件放到 `.claude/plugins/` 目录
2. 用 `/plugin install` 安装
3. Claude 自动判断何时使用

### Q4：我可以修改 SKILL.md 吗？

**答**：当然可以！SKILL.md 就是你的项目规范，随时可以改。

修改后：
- 如果用插件模式，需要重新 `/plugin install`
- 如果手动复制，直接用新版本即可

### Q5：AI 不遵守 Skills 手册怎么办？

**答**：在 Prompt 中强调：

```
⚠️ 严格警告 ⚠️
你必须严格遵守 Backend Dev Skills 手册的所有规则！
违反任何一条将触发 Reviewer 退回！

重点：
1. OpenAPI 先行（禁止跳过）
2. TDD 推动（覆盖率 ≥ 80%）
3. 禁止在日志中打印敏感信息
```

---

## 📊 对比：三种方式的优劣

| 维度 | 方式1：插件模式 | 方式2：手动复制 | 方式3：任务卡协同 |
|-----|---------------|---------------|----------------|
| **便捷性** | ⭐⭐⭐⭐⭐ 自动加载 | ⭐⭐⭐ 需手动复制 | ⭐⭐⭐⭐ 半自动 |
| **精准度** | ⭐⭐⭐⭐ Claude 自动判断 | ⭐⭐⭐⭐⭐ 你明确指定 | ⭐⭐⭐⭐⭐ 任务卡驱动 |
| **学习成本** | ⭐⭐⭐ 需了解插件机制 | ⭐⭐⭐⭐⭐ 无需学习 | ⭐⭐⭐⭐ 需理解任务卡 |
| **适用场景** | Claude Code 日常开发 | 任何 AI（GPT/Claude） | 项目开发（CMS 系统） |
| **版本控制** | ⭐⭐⭐⭐⭐ Git 管理 | ⭐⭐⭐ 手动管理 | ⭐⭐⭐⭐⭐ Git + 任务卡 |

**老王推荐**：
- **日常开发**：用方式 1（插件模式）
- **快速试验**：用方式 2（手动复制）
- **项目开发**：用方式 3（任务卡协同）

---

## 🎬 快速开始

### 5 分钟上手（手动复制）

```bash
# 1. 打开任意 SKILL.md
code skills/backend_dev_skill/SKILL.md

# 2. 全选复制（Ctrl+A, Ctrl+C）

# 3. 粘贴给 Claude/GPT
"你现在是 Backend Dev，请严格遵守以下 Skills 手册：
[粘贴内容]

任务：实现 Provider 动态加载机制"

# 4. 开始干活！
```

### 30 分钟配置插件模式

```bash
# 1. 创建插件目录
mkdir -p .claude/plugins/ai-wardrobe-skills

# 2. 复制所有 SKILL.md（批量）
for skill in backend_dev frontend_dev scf_worker qa_acceptance reviewer product_planner billing_guard codebuddy_deploy; do
  cp skills/${skill}_skill/SKILL.md .claude/plugins/ai-wardrobe-skills/${skill//_/-}.md
done

# 3. 在 Claude Code 中安装
/plugin marketplace add .claude/plugins/
/plugin install ai-wardrobe-skills

# 4. 验证
/plugin list

# 5. 开始用！
"实现 Provider 管理 API"
[Claude 自动加载 backend-dev Skill]
```

---

## 🔥 实战案例

### 案例 1：开发 CMS Provider 管理 API

**步骤**：
1. 打开 `skills/backend_dev_skill/SKILL.md`
2. 打开 `tasks/cms-system/Backend Dev.json`
3. 找到任务卡 `CMS-002`
4. 组合 Prompt：

```markdown
# 角色
Backend Dev

# Skills 手册
[粘贴 backend_dev_skill/SKILL.md 全部内容]

# 任务卡
{
  "taskId": "CMS-002",
  "module": "Provider管理",
  "title": "定义IProvider接口与BaseProvider基类",
  ...
}

# 指令
请严格按照 Backend Dev Skills 手册执行此任务卡。
特别注意：
1. OpenAPI 先行
2. 覆盖率 ≥ 80%
3. 提供健康检查接口
```

**AI 输出**：
- `openapi/provider.yaml`：API 契约
- `src/api/providers/`：路由/控制器
- `src/services/providerService.js`：业务逻辑
- `src/repositories/providerRepository.js`：数据访问
- `tests/unit/providerService.spec.js`：单元测试
- `tests/integration/providers.spec.js`：集成测试

### 案例 2：开发表单编辑器 UI

**步骤**：
1. 打开 `skills/frontend_dev_skill/SKILL.md`
2. 打开 `tasks/cms-system/Frontend Dev.json`
3. 找到任务卡 `CMS-101`
4. 组合 Prompt：

```markdown
# 角色
Frontend Dev

# Skills 手册
[粘贴 frontend_dev_skill/SKILL.md 全部内容]

# 任务卡
{
  "taskId": "CMS-101",
  "module": "表单设计器",
  "title": "初始化Form.io React库与基础布局",
  ...
}

# 指令
请严格按照 Frontend Dev Skills 手册执行此任务卡。
```

**AI 输出**：
- `src/app/admin/forms/page.tsx`：表单编辑器页面
- `src/components/FormDesigner.tsx`：表单设计器组件
- `src/hooks/useFormBuilder.ts`：表单构建 Hook
- `tests/e2e/form-designer.spec.ts`：E2E 测试

---

## 📚 进阶技巧

### 1. 链式任务卡执行

```markdown
# 第一步：CMS-002（定义 IProvider 接口）
[用 Backend Dev Skill]
完成后发布 API_CONTRACT_READY 事件

# 第二步：CMS-003（实现 BaseProvider）
[用 Backend Dev Skill]
依赖：CMS-002

# 第三步：CMS-004（实现 SCF Provider）
[用 SCF Worker Skill]
依赖：CMS-003

# 第四步：CMS-504（E2E 测试）
[用 QA Acceptance Skill]
依赖：CMS-002/003/004
```

### 2. 跨 Skill 协作矩阵

| 场景 | 主 Skill | 协作 Skill | 关键契约 |
|-----|---------|-----------|---------|
| Provider 管理功能 | Backend Dev | Frontend Dev | OpenAPI 契约 |
| 表单编辑器 | Frontend Dev | Backend Dev | UFS Schema |
| Pipeline 编排器 | Frontend Dev | Backend Dev + SCF Worker | 事件契约 |
| E2E 测试 | QA Acceptance | 所有 Skills | 验收标准 |
| 代码审查 | Reviewer | 所有 Skills | 修复任务卡 |

### 3. 错误修复流程

```markdown
# 场景：Reviewer 发现安全问题

## Step 1：Reviewer 生成修复任务卡
[用 Reviewer Skill]
输出：CMS-B-002-FIX-01（修复 SQL 注入风险）

## Step 2：Backend Dev 执行修复
[用 Backend Dev Skill + 修复任务卡]
遵循 RULES 中的安全规范

## Step 3：Reviewer 验证修复
[用 Reviewer Skill]
确认修复效果

## Step 4：QA 回归测试
[用 QA Acceptance Skill]
确保无副作用
```

---

## 🎉 总结

你现在有 **3 种方式** 使用 Skills：

1. **插件模式**（自动加载）→ 适合 Claude Code 日常开发
2. **手动复制**（快速上手）→ 适合任何 AI（GPT/Claude）
3. **任务卡协同**（项目规范）→ 适合 CMS 系统开发

**核心优势**：
- ✅ **标准化开发流程**：8 个 Skills 覆盖完整开发链路
- ✅ **质量门禁内置**：RULES + CHECKLIST 确保高质量
- ✅ **真实可落地**：包含代码示例、配置模板、测试用例
- ✅ **灵活协同**：支持跨 Skill 协作与任务卡驱动

**老王建议**：
- 新手先用 **方式 2**（手动复制）快速上手
- 熟悉后用 **方式 1**（插件模式）提升效率
- 项目开发用 **方式 3**（任务卡协同）确保规范

---

艹，写完了！有问题随时问老王！🚀
