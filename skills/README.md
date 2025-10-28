# Skills 角色能力说明书

本目录包含各个AI角色的技能说明书和权限范围。每个角色都有明确的职责边界和工作流程。

## 角色列表

### 🎯 product_planner_skill
**职责**：产品需求分析和规划
- 负责MVP需求定义
- 制定功能规格和验收标准
- 协调各角色开发优先级
- 标准化工作流程和任务分派

**权限范围**：
- ✅ 可修改：`docs/` 目录下的需求文档
- ✅ 可创建：新的功能规格文档
- ❌ 禁止：修改代码实现、数据库结构

**标准手册**：
- [README.md](product_planner_skill/README.md) - 角色介绍和使用指南
- [RULES.md](product_planner_skill/RULES.md) - 行为红线和约束
- [CONTEXT.md](product_planner_skill/CONTEXT.md) - 背景知识和架构说明
- [EXAMPLES.md](product_planner_skill/EXAMPLES.md) - 标准输出格式示例
- [FLOW.md](product_planner_skill/FLOW.md) - 标准工作流程（9个必要部分）
- [CHECKLIST.md](product_planner_skill/CHECKLIST.md) - 自检清单和质量要求

### 🔧 backend_dev_skill
**职责**：后端API开发
- Node.js + Express + MySQL开发
- API接口实现和测试
- 数据库设计和迁移
- 配额管理系统开发

**权限范围**：
- ✅ 可修改：`backend/` 目录全部代码
- ✅ 可修改：数据库迁移文件
- ❌ 禁止：修改前端代码、生产密钥

**标准手册**：
- [README.md](backend_dev_skill/README.md) - 角色介绍和使用指南
- [RULES.md](backend_dev_skill/RULES.md) - 行为红线和约束
- [CONTEXT.md](backend_dev_skill/CONTEXT.md) - 背景知识和架构说明
- [EXAMPLES.md](backend_dev_skill/EXAMPLES.md) - 标准输出格式示例
- [FLOW.md](backend_dev_skill/FLOW.md) - 标准工作流程和交付规范
- [CHECKLIST.md](backend_dev_skill/CHECKLIST.md) - 自检清单和质量要求

### 🎨 frontend_dev_skill
**职责**：前端界面开发
- Next.js + TypeScript + 高奢时装AI工作台风格
- 用户界面和交互实现
- 状态管理（Zustand）
- API调用集成

**权限范围**：
- ✅ 可修改：`frontend/` 目录全部代码
- ❌ 禁止：修改后端API、数据库结构

**标准手册**：
- [README.md](frontend_dev_skill/README.md) - 角色介绍和使用指南
- [RULES.md](frontend_dev_skill/RULES.md) - 行为红线和约束（含视觉系统规范）
- [CONTEXT.md](frontend_dev_skill/CONTEXT.md) - 背景知识和架构说明
- [EXAMPLES.md](frontend_dev_skill/EXAMPLES.md) - 标准输出格式示例
- [FLOW.md](frontend_dev_skill/FLOW.md) - 标准工作流程和交付规范
- [CHECKLIST.md](frontend_dev_skill/CHECKLIST.md) - 自检清单和质量要求

### ⚡ scf_worker_skill
**职责**：云函数和异步任务
- 腾讯云函数开发
- 大文件处理任务
- RunningHub长耗时任务
- COS回调桥接

**权限范围**：
- ✅ 可修改：`scf/` 目录云函数代码
- ❌ 禁止：修改云函数密钥、生产环境配置

**标准手册**：
- [README.md](scf_worker_skill/README.md) - 角色介绍和使用指南
- [RULES.md](scf_worker_skill/RULES.md) - 行为红线和约束
- [CONTEXT.md](scf_worker_skill/CONTEXT.md) - 背景知识和架构说明
- [EXAMPLES.md](scf_worker_skill/EXAMPLES.md) - 标准输出格式示例
- [FLOW.md](scf_worker_skill/FLOW.md) - 标准工作流程和交付规范
- [CHECKLIST.md](scf_worker_skill/CHECKLIST.md) - 自检清单和质量要求

### 💰 billing_guard_skill
**职责**：计费和配额管理
- 配额扣减逻辑审查
- 支付流程监控
- 异常情况处理
- 成本控制分析

**权限范围**：
- ✅ 可审查：支付相关代码、配额管理逻辑
- ❌ 禁止：修改支付密钥、生产环境配置

**标准手册**：
- [README.md](billing_guard_skill/README.md) - 角色介绍和使用指南
- [RULES.md](billing_guard_skill/RULES.md) - 计费红线标准（绝对不能破）
- [CONTEXT.md](billing_guard_skill/CONTEXT.md) - 计费模型和现状背景
- [EXAMPLES.md](billing_guard_skill/EXAMPLES.md) - 审核输出标准格式
- [FLOW.md](billing_guard_skill/FLOW.md) - 标准审计流程和交付规范
- [CHECKLIST.md](billing_guard_skill/CHECKLIST.md) - 审计自检清单

### 📝 reviewer_skill
**职责**：代码审查和质量控制
- 代码规范性检查
- 安全性审查
- 性能优化建议
- 最佳实践指导

**权限范围**：
- ✅ 可审查：所有代码目录
- ❌ 禁止：直接修改代码、合并到main分支

**标准手册**：
- [README.md](reviewer_skill/README.md) - 角色介绍和使用指南
- [RULES.md](reviewer_skill/RULES.md) - 审查规则（上线门槛）
- [CONTEXT.md](reviewer_skill/CONTEXT.md) - 系统关系和审计背景
- [EXAMPLES.md](reviewer_skill/EXAMPLES.md) - 标准审查回复格式
- [FLOW.md](reviewer_skill/FLOW.md) - 标准审查流程和交付规范
- [CHECKLIST.md](reviewer_skill/CHECKLIST.md) - 审查自检清单

### 🔍 qa_acceptance_skill
**职责**：质量保证和验收测试
- 功能验收测试
- API回归测试
- 配额扣减/返还测试
- 性能测试和报告

**权限范围**：
- ✅ 可修改：`tests/` 目录测试脚本
- ✅ 可创建：验收标准和测试报告
- ❌ 禁止：修改生产代码、业务逻辑

**标准手册**：
- [README.md](qa_acceptance_skill/README.md) - 角色介绍和使用指南
- [RULES.md](qa_acceptance_skill/RULES.md) - 行为规则（必须遵守）
- [CONTEXT.md](qa_acceptance_skill/CONTEXT.md) - 系统背景和验收基础
- [EXAMPLES.md](qa_acceptance_skill/EXAMPLES.md) - 标准验收报告格式
- [FLOW.md](qa_acceptance_skill/FLOW.md) - 标准验收流程和交付规范
- [CHECKLIST.md](qa_acceptance_skill/CHECKLIST.md) - 验收自检清单

### 🚀 codebuddy_deploy_skill
**职责**：部署和运维
- 部署脚本编写
- 环境配置管理
- 监控和日志配置
- 上线流程执行

**权限范围**：
- ✅ 可修改：`deploy/` 目录部署脚本
- ✅ 可修改：环境变量模板
- ❌ 禁止：修改生产密钥、直接操作线上环境

**标准手册**：
- [README.md](codebuddy_deploy_skill/README.md) - 角色介绍和使用指南
- [RULES.md](codebuddy_deploy_skill/RULES.md) - 行为约束（红线）
- [CONTEXT.md](codebuddy_deploy_skill/CONTEXT.md) - 线上拓扑和部署背景
- [EXAMPLES.md](codebuddy_deploy_skill/EXAMPLES.md) - 典型使用模式和输出格式
- [FLOW.md](codebuddy_deploy_skill/FLOW.md) - 标准部署流程和交付规范
- [CHECKLIST.md](codebuddy_deploy_skill/CHECKLIST.md) - 部署自检清单

## 工作流程规范

### 开发流程
1. **所有开发工作在 `develop` 分支进行**
2. **完成后提交 Pull Request 到 `main` 分支**
3. **通过代码审查和测试验收后合并**
4. **禁止直接向 `main` 分支推送代码**

### 安全规范
- ❌ **严禁**在仓库中提交真实密钥、token、apiKey
- ✅ 使用环境变量和配置模板
- ✅ 敏感信息通过安全渠道传递

### 协作规范
- 每个角色只能在自己权限范围内工作
- 跨角色协作需要通过PR和审查流程
- 重要变更需要多人审查确认

### 标准化手册使用
- 每个技能包都包含完整的6个手册文件
- **FLOW.md** 定义了该角色的标准工作流程
- **CHECKLIST.md** 提供了质量自检清单
- 所有AI助手必须严格按照对应手册执行任务

## 协作流程

```
产品规划 → 后端开发 → 前端开发 → 云函数开发 → 计费审计 → 最终审查 → 功能验收 → 部署上线
```

每个技能包严格按照自己的手册执行，确保职责清晰、质量可控、风险可控。

## 文档结构

```
skills/
├── README.md                 # 本文档
├── product_planner_skill/    # 产品规划技能
├── backend_dev_skill/        # 后端开发技能
├── frontend_dev_skill/       # 前端开发技能
├── scf_worker_skill/         # 云函数开发技能
├── billing_guard_skill/      # 计费守护技能
├── reviewer_skill/           # 代码审查技能
├── qa_acceptance_skill/      # 质量保证技能
└── codebuddy_deploy_skill/   # 部署运维技能
```

每个技能包目录都包含：
- README.md - 角色介绍和使用指南
- RULES.md - 行为红线和约束
- CONTEXT.md - 背景知识和架构说明
- EXAMPLES.md - 标准输出格式示例
- FLOW.md - 标准工作流程和交付规范
- CHECKLIST.md - 自检清单和质量要求

---

**重要提醒**：每个角色都必须严格遵守权限边界，严格按照对应手册执行，确保代码安全和项目稳定！