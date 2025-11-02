# Product Planner Skill - 项目背景(CONTEXT)

## 项目概述

### 1. 项目定位
- **项目名称**:0基础 AI 协同开发系统
- **目标用户**:不懂技术的老板/产品经理
- **核心价值**:让0基础用户只需"说目标",AI团队自动完成开发、测试、上线

### 2. 技术栈

#### 前端技术栈
- **框架**:Next.js 14 (App Router)
- **语言**:TypeScript 5
- **UI库**:React 18 + TailwindCSS + shadcn/ui
- **状态管理**:Zustand
- **HTTP客户端**:axios
- **部署**:Vercel / 腾讯云COS静态托管

#### 后端技术栈
- **框架**:Express.js 4
- **语言**:Node.js 18 + TypeScript
- **ORM**:Knex.js
- **数据库**:MySQL 8 + Redis 7
- **认证**:JWT + bcrypt
- **进程管理**:PM2 cluster
- **部署**:腾讯云轻量应用服务器

#### 云服务
- **无服务器函数**:腾讯云 SCF (Serverless Cloud Function)
- **对象存储**:腾讯云 COS
- **CDN**:腾讯云 CDN
- **数据库**:腾讯云 MySQL
- **缓存**:腾讯云 Redis

### 3. 系统架构

#### 分层架构
```
┌─────────────────────────────────────────┐
│         用户层(0基础老板)                │
│     "我想做一个CMS配置系统"              │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│       Product Planner(项目总导演)        │
│  需求澄清 → 深度分析 → 任务拆解          │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│        执行层(多部门并行协作)            │
│  Backend | Frontend | SCF | QA          │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│        质量门禁(Reviewer + QA)           │
│  代码审查 | 测试验收 | 成本审批          │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│        部署层(Deploy + Monitor)          │
│  灰度发布 | 监控告警 | 回滚机制          │
└─────────────────────────────────────────┘
```

#### 协作模式
- **契约优先**:OpenAPI / UI原型 / 事件契约为唯一事实来源
- **事件驱动**:标准事件(API_CONTRACT_READY等)驱动异步并行
- **门禁治理**:Reviewer / QA / Billing Guard 作为质量闸口

### 4. AI协同开发角色体系

#### 核心角色
1. **Product Planner(我)**:项目总导演,需求澄清、任务拆解、协作编排
2. **Backend Dev**:后端开发,API实现、数据库设计、业务逻辑
3. **Frontend Dev**:前端开发,UI实现、状态管理、用户交互
4. **SCF Dev**:无服务器函数开发,异步任务、定时任务
5. **Reviewer**:代码审查,安全、规范、架构审查
6. **QA Acceptance**:测试验收,冒烟/回归/性能测试
7. **Billing Guard**:成本审计,预算门禁、成本优化建议
8. **Deploy Ops**:部署运维,灰度发布、监控告警、回滚机制

#### 协作流程
```
Product Planner(规划) 
    → Backend/Frontend/SCF(并行开发) 
    → Reviewer(代码审查) 
    → QA(测试验收) 
    → Deploy(灰度上线)
```

## 业务背景

### 1. 典型场景

#### 场景A:CMS内容管理系统
- **需求**:"我想做一个CMS配置系统,4周可演示,预算1500美金"
- **输出**:
  - 澄清问题(≤8个关键问题)
  - 深度分析(用户痛点、商业价值、技术选型)
  - 任务拆解(20-30个任务卡,按部门分组)
  - 周级里程碑(Week1-4)
  - 协作契约(OpenAPI/UI/事件)

#### 场景B:会员配额管理
- **需求**:"加入会员配额管理与结算"
- **输出**:
  - 澄清现有系统(已有用户/订单/支付模块?)
  - 设计配额模型(配额类型/扣减规则/充值策略)
  - 拆解任务(Backend 8卡 + Frontend 5卡 + SCF 3卡)
  - 集成现有系统(最小改动原则)

#### 场景C:AI图片处理Pipeline
- **需求**:"实现AI图片处理Pipeline(抠图+换背景+融合)"
- **输出**:
  - 技术选型(自研vs第三方vs混合)
  - 架构设计(任务队列/状态机/供应商降级)
  - 成本预估(API调用成本/存储成本/流量成本)
  - 任务拆解(Backend 12卡 + SCF 8卡 + Frontend 6卡)

### 2. 业务约束

#### 时间约束
- **MVP周期**:通常4周
- **每周里程碑**:每周五必须有可演示的功能
- **紧急需求**:1-2周快速交付

#### 成本约束
- **云服务成本**:腾讯云API调用、存储、流量成本
- **人力成本**:AI协同开发成本(按任务卡估算)
- **预算门禁**:成本超预算80%时触发预警

#### 质量约束
- **代码质量**:UT覆盖率≥80%,Reviewer审查通过
- **产品质量**:QA验收通过,Lighthouse评分>90
- **安全质量**:HTTPS、CSRF防护、SQL注入防护

## 协作上下文

### 1. 标准事件(Event)

#### API契约事件
- `API_CONTRACT_READY`:Backend产出OpenAPI契约
- `API_CONTRACT_ACK`:Frontend确认契约并开始开发

#### SCF任务事件
- `SCF_JOB_IMAGE_PROCESSING_SUBMITTED`:提交图片处理任务
- `SCF_JOB_IMAGE_PROCESSING_COMPLETED`:任务完成
- `SCF_JOB_IMAGE_PROCESSING_FAILED`:任务失败

#### 质量门禁事件
- `REVIEW_REQUIRED`:需要Reviewer审查
- `REVIEW_APPROVED`:审查通过
- `REVIEW_REJECTED`:审查拒绝,需要修复

#### 测试验收事件
- `QA_REQUIRED`:需要QA验收
- `QA_PASSED`:验收通过
- `QA_FAILED`:验收失败,需要修复

#### 成本门禁事件
- `BILLING_BUDGET_EXCEEDED`:成本超预算
- `BILLING_OPTIMIZATION_SUGGESTED`:建议成本优化

### 2. 标准产物(Artifact)

#### 规划产物
- `clarifications.yaml`:澄清问题 + 默认假设清单
- `product_spec.md`:完整规划(10部分)
- `tasks/*.json`:按部门分组的任务卡
- `timeline.md`:周级里程碑排期
- `handoff.md`:交付口径(演示路径/协作契约/门禁要求)

#### 契约产物
- `openapi/*.yaml`:OpenAPI契约(Backend产出,Frontend消费)
- `ui-prototypes/*.html`:UI原型(Product Planner产出,Frontend实现)
- `event-schemas/*.json`:事件契约(定义异步任务的输入输出)

#### 代码产物
- `backend/src/**/*.ts`:后端代码
- `frontend/src/**/*.tsx`:前端代码
- `scf/**/*.js`:SCF函数代码
- `migrations/**/*.sql`:数据库迁移脚本

#### 测试产物
- `backend/tests/**/*.spec.ts`:后端单元测试
- `frontend/tests/**/*.test.tsx`:前端单元测试
- `qa/smoke-tests/**/*.md`:冒烟测试用例
- `qa/performance-tests/**/*.js`:性能测试脚本

## 技术约束

### 1. 编码规范
- **TypeScript严格模式**:启用strict模式
- **ESLint + Prettier**:统一代码风格
- **Commit规范**:Conventional Commits

### 2. 数据库规范
- **迁移脚本**:所有表结构变更必须通过Knex迁移
- **索引策略**:高频查询字段必须建索引
- **外键约束**:重要关联关系使用外键

### 3. API规范
- **RESTful**:遵循REST规范(GET/POST/PUT/DELETE)
- **OpenAPI 3.0**:所有API必须有OpenAPI文档
- **统一响应**:`{ code, message, data }`

### 4. 安全规范
- **认证**:JWT Token + 刷新Token
- **鉴权**:RBAC权限控制
- **加密**:敏感数据bcrypt加密
- **HTTPS**:生产环境强制HTTPS

---

> 📘 **Product Planner必须深刻理解以上项目背景,才能产出高质量的规划!**
