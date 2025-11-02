# CMS自研系统 - AI开发任务卡

> **项目**: 可视化Pipeline编排平台CMS系统
> **开发模式**: AI辅助开发（Claude Code / Cursor / GPT-5 Pro）
> **Skills手册系统**: 配合8 Skills协同开发
> **总任务数**: 46张任务卡
> **预估周期**: 2-4周（MVP 2周）
> **技术栈**: Next.js 14 + React 18 + TypeScript + AntD + Express + Knex + MySQL 8 + Redis

---

## 任务卡分配概览（按Skills手册角色）

### 按Skills角色分组

| Skills角色 | 任务数量 | 职责范围 | Skills手册位置 | 文件位置 |
|-----------|---------|---------|---------------|---------|
| **Backend Dev** | 15张 | Provider动态加载、缓存系统、数据库设计、内容管理API | [skills/backend_dev_skill/](../../skills/backend_dev_skill/) | [Backend Dev.json](./Backend%20Dev.json) |
| **Frontend Dev** | 27张 | 表单设计器、流程编辑器、Prompt编辑器、Admin UI | [skills/frontend_dev_skill/](../../skills/frontend_dev_skill/) | [Frontend%20Dev.json](./Frontend%20Dev.json) |
| **SCF Worker** | 2张 | 云函数Provider实现与现有Provider重构 | [skills/scf_worker_skill/](../../skills/scf_worker_skill/) | [SCF%20Worker.json](./SCF%20Worker.json) |
| **QA Acceptance** | 2张 | E2E测试、性能测试与质量验收 | [skills/qa_acceptance_skill/](../../skills/qa_acceptance_skill/) | [QA%20Acceptance.json](./QA%20Acceptance.json) |

**未使用的Skills角色**: Product Planner, Reviewer, Billing Guard, CodeBuddy Deploy（本项目暂无对应任务）

### 按模块分组

| 模块 | 任务数 | 涵盖内容 | 主要负责Skills |
|------|--------|---------|---------------|
| **Provider管理** | 8张 | 动态加载、IProvider接口、GenericHTTP、凭证加密、健康检查、审计、后端API | Backend Dev + SCF Worker |
| **Provider管理UI** | 1张 | Provider管理前端页面 | Frontend Dev |
| **表单设计器** | 10张 | Form.io集成、UFS适配器、10类字段渲染、分步Wizard、校验引擎、预览、保存、版本、回滚、UI | Frontend Dev |
| **流程编辑器** | 10张 | React Flow集成、节点库、侧边栏配置、拓扑验证、执行引擎、变量替换、测试运行器、版本、回滚、UI | Frontend Dev |
| **Prompt管理** | 6张 | Handlebars引擎、Monaco集成、变量提示、实时预览、版本、UI | Frontend Dev |
| **内容管理** | 8张 | 公告、轮播、套餐、文案4模块CRUD、COS上传、排序、定时、聚合接口 | Backend Dev |
| **缓存与实时更新** | 3张 | Redis缓存、Pub/Sub失效、快照读写 | Backend Dev |
| **测试与优化** | 2张 | E2E测试、性能基线 | QA Acceptance |

---

## 任务卡详细说明（按Skills角色）

### Backend Dev（15张任务卡）

**职责**: Provider动态加载、缓存系统、数据库设计、内容管理API开发

**Skills手册**: [skills/backend_dev_skill/](../../skills/backend_dev_skill/)

#### Provider管理核心（6张）
- **CMS-002**: 定义IProvider接口与BaseProvider基类 (Week 1, 4h, P0)
- **CMS-003**: 实现GenericHTTP Provider（请求模板+变量替换） (Week 1, 8h, P0)
- **CMS-005**: 运行时凭证加密与读取（AES-256-GCM） (Week 1, 6h, P0)
- **CMS-006**: Provider管理后台CRUD API (Week 1, 6h, P0)

#### 缓存与快照（3张）
- **CMS-501**: Redis缓存封装与本地LRU（读路径） (Week 1, 8h, P0)
- **CMS-502**: 配置更新广播与精准失效（Pub/Sub） (Week 1, 6h, P0)
- **CMS-503**: 配置快照表与回滚脚本 (Week 2, 4h, P0)

#### 内容管理API（8张）
- **CMS-401**: 公告管理CRUD + 定时上下线 (Week 3, 6h, P0)
- **CMS-402**: 轮播图管理 + COS上传 + 拖拽排序 (Week 3, 6h, P0)
- **CMS-403**: 会员套餐管理（计划/权益） (Week 3, 6h, P0)
- **CMS-404**: 文案配置（按页面/语言） (Week 3, 6h, P0)
- **CMS-405**: 工作台Feature展示联动 (Week 3, 4h, P0)
- **CMS-406**: 前台文案与公告/轮播渲染接入 (Week 3, 4h, P0)
- **CMS-407**: 内容审核与审计日志（轻量版） (Week 3, 4h, P1)
- **CMS-408**: 批量导入导出 (Week 3, 6h, P1)

**依赖关系**:
- Week 1: CMS-002(基础接口) → CMS-003(GenericHTTP) → CMS-005(加密) → CMS-006(API)
- Week 1: CMS-501(缓存) → CMS-502(Pub/Sub) 可并行
- Week 2: CMS-503(快照)
- Week 3: CMS-401~404(4个CRUD并行) → CMS-405/406(联动接口)

---

### Frontend Dev（27张任务卡）

**职责**: 表单设计器、流程编辑器、Prompt编辑器、Admin UI界面开发

**Skills手册**: [skills/frontend_dev_skill/](../../skills/frontend_dev_skill/)

#### Provider管理UI（1张）
- **CMS-007**: Provider管理前端页面（AntD） (Week 2, 8h, P0) 依赖CMS-006

#### 表单设计器（10张）
- **CMS-101**: 集成react-formio（仅前端）并关闭SSR (Week 1, 6h, P0)
- **CMS-102**: Formio JSON → UFS适配器（单向） (Week 1, 8h, P0) 依赖CMS-101
- **CMS-103**: UFS表单实时预览（react-hook-form + AntD） (Week 2, 8h, P0) 依赖CMS-102
- **CMS-104**: UFS校验器（Zod）与前后端复用 (Week 2, 6h, P0) 依赖CMS-103
- **CMS-105**: 表单Schema存储API与版本化/回滚 (Week 2, 6h, P0) 依赖CMS-103
- **CMS-106**: 表单设计器UI：向导式（Step 2）整合 (Week 2, 10h, P0) 依赖CMS-102/105
- **CMS-107**: 大表单性能优化（分步+惰性注册+虚拟滚动） (Week 2, 6h, P1) 依赖CMS-103
- **CMS-108**: 字段可重用片段（Snippet）与模板库 (Week 3, 4h, P1) 依赖CMS-106
- **CMS-109**: UFS → 提交数据校验回放（预运行） (Week 2, 4h, P0) 依赖CMS-104
- **CMS-110**: UFS导入/导出（JSON） (Week 3, 4h, P1) 依赖CMS-105

#### 流程编辑器（10张）
- **CMS-201**: React Flow集成与基础节点库 (Week 1, 6h, P0)
- **CMS-202**: 节点配置侧边栏（Provider/参数/超时/重试） (Week 2, 8h, P0) 依赖CMS-201
- **CMS-203**: Pipeline JSON Schema v1定义与保存/读取API (Week 2, 6h, P0) 依赖CMS-202
- **CMS-204**: 拓扑合法性验证（Kahn算法+变量可达性） (Week 2, 8h, P0) 依赖CMS-202
- **CMS-205**: 测试运行器（模拟/真实）与可视化日志 (Week 2, 8h, P0) 依赖CMS-204
- **CMS-206**: 并行与Join节点（FORK/JOIN） (Week 3, 6h, P1) 依赖CMS-204
- **CMS-207**: 变量选择器与引用提示（form/node/system） (Week 2, 6h, P0) 依赖CMS-202
- **CMS-208**: Feature向导Step3：流程编排整合 (Week 2, 10h, P0) 依赖CMS-203/205
- **CMS-209**: 错误收敛与画布高亮（校验结果可视化） (Week 3, 4h, P1) 依赖CMS-204
- **CMS-210**: Pipeline导入/导出（JSON）与样例库 (Week 3, 4h, P1) 依赖CMS-203

#### Prompt管理（6张）
- **CMS-301**: Monaco集成与基础编辑器 (Week 2, 6h, P0)
- **CMS-302**: 变量提示与自动补全（Completion Provider） (Week 3, 6h, P0) 依赖CMS-301
- **CMS-303**: 受限Handlebars渲染与预览API (Week 2, 4h, P0)
- **CMS-304**: Prompt分类/版本/回滚 (Week 3, 4h, P1) 依赖CMS-303
- **CMS-305**: Prompt测试运行（调用AI API对比结果） (Week 3, 6h, P1) 依赖CMS-303
- **CMS-306**: Feature向导Step4：预览与发布 (Week 3, 8h, P0) 依赖CMS-303

---

### SCF Worker（2张任务卡）

**职责**: 云函数Provider实现与现有Provider重构

**Skills手册**: [skills/scf_worker_skill/](../../skills/scf_worker_skill/)

- **CMS-004**: 实现SCF Provider（云函数调用扩展点） (Week 1, 6h, P0) 依赖CMS-002
- **CMS-008**: 现有Provider重构适配IProvider（Tencent/RunningHub/SCF） (Week 2, 6h, P0) 依赖CMS-002/004

**关键点**:
- CMS-004实现新的SCF Provider支持同步/异步调用
- CMS-008重构现有三方Provider（TencentCI/RunningHub/SCF）统一接口
- 确保签名验证、幂等性、重试+DLQ机制
- 遵循CAM最小权限原则

---

### QA Acceptance（2张任务卡）

**职责**: E2E测试、性能测试与质量验收

**Skills手册**: [skills/qa_acceptance_skill/](../../skills/qa_acceptance_skill/)

- **CMS-504**: 关键路径E2E（创建Feature→试跑→发布→前台可见） (Week 3, 8h, P0) 依赖所有P0功能
- **CMS-505**: 性能基线与回归（缓存命中率/拓扑验证耗时） (Week 3, 4h, P1) 依赖CMS-501/204

**测试范围**:
- E2E: Playwright自动化（创建表单 → 编排Pipeline → 测试运行 → 发布Feature → 前台展示）
- 性能: 缓存命中率≥95%, 拓扑验证<50ms, p95延迟<100ms
- 质量: 测试数据隔离、报告完整性、阻塞不合格交付

---

## 按周实施计划（配合Skills手册）

### Week 1: 内核与底座

**目标**: 完成Provider动态化、缓存/快照、前端POC

#### Backend Dev（并行）
- Day 1-2: CMS-002(IProvider接口) + CMS-501(Redis缓存)
- Day 3-4: CMS-003(GenericHTTP) + CMS-502(Pub/Sub)
- Day 5: CMS-005(凭证加密) + CMS-006(API)

#### SCF Worker（并行）
- Day 3-4: CMS-004(SCF Provider实现)

#### Frontend Dev（并行）
- Day 1-2: CMS-101(react-formio集成) + CMS-201(React Flow集成)
- Day 3-5: CMS-102(UFS适配器)

**里程碑**: Provider可动态加载、缓存系统打通、Form.io+React Flow可用

---

### Week 2: 核心编辑器

**目标**: 完成表单+流程+Prompt核心编辑功能

#### Frontend Dev（主战场）
- Day 1-2: CMS-103(UFS渲染) + CMS-202(节点库)
- Day 3-4: CMS-104(校验) + CMS-203(Pipeline Schema) + CMS-204(拓扑验证)
- Day 5-7: CMS-205(执行引擎) + CMS-207(变量选择器)
- Day 8-9: CMS-106(表单UI) + CMS-208(流程UI)
- Day 10: CMS-301(Monaco) + CMS-303(Handlebars)

#### Backend Dev
- Day 1-3: CMS-503(快照回滚)

#### SCF Worker
- Day 1-3: CMS-008(Provider重构)

**里程碑**: 可创建表单+Pipeline+Prompt并测试运行

---

### Week 3: 内容管理+测试+优化

**目标**: 完成内容CRUD、E2E测试、性能优化

#### Backend Dev（并行）
- Day 1-3: CMS-401~404(4个CRUD模块)
- Day 4-5: CMS-405/406(联动接口)

#### Frontend Dev
- Day 1-3: CMS-302(变量提示) + CMS-306(Feature向导)
- Day 4-5: CMS-007(Provider UI) + CMS-105/109(表单完整功能)

#### QA Acceptance
- Day 4-5: CMS-504(E2E测试) + CMS-505(性能基线)

**里程碑**: MVP完整可用，E2E通过，性能达标

---

## MVP范围（2周可交付，32张P0任务卡）

### Backend Dev (7张P0)
- CMS-002/003/005/006: Provider核心
- CMS-501/502/503: 缓存快照
- CMS-401~406: 内容管理基础（6张，Week3压缩）

### Frontend Dev (20张P0)
- 表单: CMS-101/102/103/104/105/106/109 (7张)
- 流程: CMS-201/202/203/204/205/207/208 (7张)
- Prompt: CMS-301/303/306 (3张)
- Provider UI: CMS-007 (1张)
- 其他: 最小可用UI

### SCF Worker (2张P0)
- CMS-004/008: SCF Provider完整实现

### QA Acceptance (1张P0)
- CMS-504: E2E核心流程

---

## Skills手册协同开发流程

### 1. Backend Dev开发流程

参考: [skills/backend_dev_skill/FLOW.md](../../skills/backend_dev_skill/FLOW.md)

```
1. 需求确认 → 阅读任务卡JSON
2. 数据建模 → 设计/修改数据库表结构
3. API设计 → 定义REST接口与请求/响应格式
4. 业务实现 → 编写Service/Repository层
5. 单元测试 → Jest覆盖率≥80%
6. 集成测试 → Supertest测试完整链路
7. 代码审查 → 提交Reviewer审查
```

### 2. Frontend Dev开发流程

参考: [skills/frontend_dev_skill/FLOW.md](../../skills/frontend_dev_skill/FLOW.md)

```
1. 需求确认 → 阅读任务卡JSON + 设计稿
2. 组件拆分 → 原子/分子/组织/模板层级
3. 状态管理 → Zustand全局状态设计
4. UI实现 → AntD组件 + Tailwind样式
5. 交互联调 → 对接Backend Dev API
6. 单元测试 → RTL组件测试
7. 代码审查 → 提交Reviewer审查
```

### 3. SCF Worker开发流程

参考: [skills/scf_worker_skill/FLOW.md](../../skills/scf_worker_skill/FLOW.md)

```
1. 需求确认 → 阅读任务卡JSON
2. 函数设计 → 入参/出参Schema + 幂等Key
3. 签名验证 → 实现外部回调签名校验
4. 业务实现 → 编写Handler逻辑
5. 重试+DLQ → 配置指数退避与死信队列
6. 本地测试 → Mock触发器测试
7. 部署验证 → 上传SCF并验证
```

### 4. QA Acceptance验收流程

参考: [skills/qa_acceptance_skill/FLOW.md](../../skills/qa_acceptance_skill/FLOW.md)

```
1. 测试计划 → 根据验收标准设计用例
2. 环境准备 → 独立测试账户 + 数据隔离
3. E2E执行 → Playwright自动化测试
4. 性能测试 → k6压测 + 性能基线
5. 报告生成 → 测试结果汇总
6. 阻塞/放行 → 不合格直接阻塞
```

---

## 任务卡使用说明

### AI协作流程

1. **选择任务卡**: 根据Skills角色和依赖关系选择
2. **阅读Skills手册**: 查看对应角色的RULES/CONTEXT/EXAMPLES
3. **复制AI Prompt**: 任务卡的`aiPromptSuggestion`字段
4. **提供完整上下文**: 任务卡JSON + Skills手册内容
5. **AI实现**: Claude Code / Cursor / GPT-5 Pro自动实现
6. **验收测试**: 根据`acceptanceCriteria`验收
7. **Reviewer审查**: 提交代码审查（Reviewer Skill）
8. **QA验收**: 关键功能走QA Acceptance验收

### 示例：Backend Dev使用CMS-002

```json
{
  "taskId": "CMS-002",
  "title": "定义IProvider接口与BaseProvider基类",
  "aiPromptSuggestion": "用 TypeScript 编写 providers/types.ts 与 base-provider.ts：定义 IProvider/RetryPolicy/ExecContext/ExecResult，并在 BaseProvider 实现带指数退避的 executeWithRetry(fn) 与超时控制。编写UT覆盖3个分支。"
}
```

**提供给AI的完整Prompt**:
```
角色: Backend Dev
Skills手册: skills/backend_dev_skill/

任务: 定义IProvider接口与BaseProvider基类

详细要求:
- 技术要求: IProvider接口包含key/validate/execute/healthcheck
- 实现BaseProvider基类，提供executeWithRetry方法支持指数退避
- 集成AbortController实现超时控制
- 单元测试覆盖率≥80%

验收标准:
- 可被任何handler继承复用
- 单元测试覆盖BaseProvider重试与超时

代码位置:
- backend/src/providers/types.ts
- backend/src/providers/base/base-provider.ts

测试策略:
- UT：重试策略、超时中断、AbortSignal传播

请按照Backend Dev Skills手册的RULES和CONTEXT实现此任务。
```

---

## 验收标准总览

### 技术验收
- ✅ 所有P0任务卡通过单元测试（覆盖率≥80%）
- ✅ E2E测试覆盖核心流程（创建Feature→发布→前台展示）
- ✅ 缓存命中率≥95%，p95延迟<100ms
- ✅ 配置误改可一键回滚且<3分钟恢复
- ✅ Provider健康检查异常告警<1分钟

### 功能验收
- ✅ 可视化创建包含10类字段的表单
- ✅ 可视化编排包含6类节点的Pipeline
- ✅ Pipeline测试运行器正常工作（Mock+真实模式）
- ✅ Feature向导4步流程完整可用
- ✅ Prompt编辑器支持变量提示与实时预览
- ✅ 内容管理4模块CRUD + 排序 + 定时发布
- ✅ 管理端RBAC权限正常生效

### 业务验收
- ✅ 新增功能从0到上线<2小时（含测试）
- ✅ Admin操作日志完整可追溯
- ✅ 运行期配置读取不依赖DB（快照兜底）
- ✅ 密钥加密存储且不泄露到前端

---

## 相关文档

- **完整技术方案**: [../../docs/CMS自研技术方案-完整规划.md](../../docs/CMS自研技术方案-完整规划.md)
- **原始GPT-5 Pro回答**: [../../docs/GPT5-Pro战略问题集/回答/gpt5回答自研详细方案.md](../../docs/GPT5-Pro战略问题集/回答/gpt5回答自研详细方案.md)
- **Skills手册系统**: [../../skills/](../../skills/)

---

## 快速开始

### 1. Backend Dev

```bash
# 阅读Skills手册
cat skills/backend_dev_skill/README.md
cat skills/backend_dev_skill/FLOW.md

# 阅读任务卡
cat "tasks/cms-system/Backend Dev.json"

# 优先顺序
Week 1: CMS-002 → CMS-003 → CMS-005 → CMS-006
Week 1: CMS-501 → CMS-502 (可并行)
Week 2: CMS-503
Week 3: CMS-401~404 → CMS-405/406
```

### 2. Frontend Dev

```bash
# 阅读Skills手册
cat skills/frontend_dev_skill/README.md
cat skills/frontend_dev_skill/FLOW.md

# 阅读任务卡
cat "tasks/cms-system/Frontend Dev.json"

# 优先顺序
Week 1: CMS-101 + CMS-201 → CMS-102
Week 2: CMS-103 → CMS-104/202/203/204
Week 2: CMS-205/207 → CMS-106/208
Week 2-3: CMS-301/303 → CMS-306
```

### 3. SCF Worker

```bash
# 阅读Skills手册
cat skills/scf_worker_skill/README.md
cat skills/scf_worker_skill/FLOW.md

# 阅读任务卡
cat "tasks/cms-system/SCF Worker.json"

# 优先顺序
Week 1: CMS-004 (SCF Provider实现)
Week 2: CMS-008 (Provider重构)
```

### 4. QA Acceptance

```bash
# 阅读Skills手册
cat skills/qa_acceptance_skill/README.md
cat skills/qa_acceptance_skill/FLOW.md

# 阅读任务卡
cat "tasks/cms-system/QA Acceptance.json"

# 优先顺序
Week 3 Day 4-5: CMS-504 (E2E) + CMS-505 (性能)
```

---

**开始开发**: 选择你的Skills角色，阅读对应手册，打开任务卡JSON文件，按照依赖顺序开始执行！

**AI协作提示**:
1. 每张任务卡都包含`aiPromptSuggestion`字段
2. 结合对应Skills手册的RULES/CONTEXT/EXAMPLES
3. 直接复制给Claude Code/Cursor/GPT-5 Pro即可自动实现
4. 完成后提交Reviewer审查，关键功能走QA Acceptance验收
