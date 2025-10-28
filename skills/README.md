# Skills - AI 技能包目录

本目录包含了服装AI处理SaaS平台的完整AI技能包体系，每个技能包都有明确的角色定位和标准化工作手册。

## 技能包清单

### 🎯 产品规划类
- **product_planner_skill** - 产品/需求分析师
  - 职责：将业务目标转化为清晰的任务说明和需求文档
  - 手册：ROLE.md, FLOW.md, CHECKLIST.md

### 🏗️ 开发实现类
- **backend_dev_skill** - 后端架构师
  - 职责：API设计、数据库架构、业务逻辑实现
  - 手册：ROLE.md, FLOW.md, CHECKLIST.md

- **frontend_dev_skill** - 前端实现工程师
  - 职责：UI/交互实现、页面组件、状态管理
  - 手册：ROLE.md, FLOW.md, CHECKLIST.md

- **scf_worker_skill** - 云函数工人
  - 职责：重任务处理、大文件上传、AI供应商调用
  - 手册：ROLE.md, FLOW.md, CHECKLIST.md

### 💰 审计风控类
- **billing_guard_skill** - 计费守门人
  - 职责：审计计费逻辑、防止薅羊毛、配额安全
  - 手册：ROLE.md, FLOW.md, CHECKLIST.md

- **reviewer_skill** - 最终合并审查官
  - 职责：代码审查、安全检查、最终放行决策
  - 手册：ROLE.md, FLOW.md, CHECKLIST.md

### 🧪 质量保障类
- **qa_acceptance_skill** - 功能验收官
  - 职责：真实用户路径测试、功能验收、演示保障
  - 手册：ROLE.md, FLOW.md, CHECKLIST.md

### 🚀 运维部署类
- **codebuddy_deploy_skill** - 部署运维工程师
  - 职责：部署到腾讯云、环境管理、快速回滚
  - 手册：ROLE.md, FLOW.md, CHECKLIST.md

## 使用规范

每个技能包都包含三个标准化手册：

1. **ROLE.md** - 角色定位和职责边界
2. **FLOW.md** - 标准工作流程和交付规范
3. **CHECKLIST.md** - 自检清单和质量要求

## 协作流程

```
产品规划 → 后端开发 → 前端开发 → 云函数开发 → 计费审计 → 最终审查 → 功能验收 → 部署上线
```

每个技能包严格按照自己的手册执行，确保职责清晰、质量可控、风险可控。

## 重要提醒

- 禁止跨技能包越权操作
- 所有变更必须经过 develop → main 流程
- 密钥和敏感信息必须通过环境变量管理
- 计费逻辑必须经过 billing_guard_skill 审计

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

## 文档结构

```
skills/
├── README.md                 # 本文档
├── product_planner_skill/    # 产品规划技能
├── backend_dev_skill/        # 后端开发技能
├── frontend_dev_skill/       # 前端开发技能
├── qa_acceptance_skill/      # 质量保证技能
├── reviewer_skill/           # 代码审查技能
├── billing_guard_skill/      # 计费守护技能
├── codebuddy_deploy_skill/   # 部署运维技能
└── scf_worker_skill/         # 云函数开发技能
```

---

**重要提醒**：每个角色都必须严格遵守权限边界，确保代码安全和项目稳定！