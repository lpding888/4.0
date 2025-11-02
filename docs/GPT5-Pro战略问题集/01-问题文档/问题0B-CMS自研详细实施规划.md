# 问题0B：CMS配置系统自研详细实施规划

> **问题类型**：技术实施规划 + AI任务卡输出
> **优先级**：P0（确定自研后立即规划）
> **预计思考时间**：15-20分钟
> **预计输出字数**：12000-18000字

---

## 背景说明

通过问题0A的技术选型分析，我已经决定采用**方案A（完全自研）**来开发CMS配置系统。

现在需要你作为资深架构师，给出详细的实施规划，包括：
1. 技术架构设计
2. 工作量拆解和时间表
3. 技术风险识别和应对方案
4. **最重要：输出可直接交给AI编程工具执行的任务卡（Task Cards）**

---

## 我的背景

### 现有技术栈
- **前端**：Next.js 14 (App Router) + React 18 + TypeScript + Ant Design
- **后端**：Express.js + Knex.js (ORM) + MySQL 8.0 + Redis
- **部署**：4核4G云服务器（宝塔面板）+ PM2集群（3进程）
- **存储**：腾讯云COS + Redis缓存

### 核心业务架构（已实现）

1. **Pipeline执行引擎**
   - 支持多步骤串行执行（Step1 → Step2 → Step3）
   - 每个步骤可配置：Provider供应商、超时时间、重试策略
   - 步骤类型：SYNC_IMAGE_PROCESS（同步图片处理）、RUNNINGHUB_WORKFLOW（异步AI生成）、SCF_POST_PROCESS（云函数后处理）
   - 失败自动返还配额

2. **Provider供应商体系**
   - 已集成：腾讯云数据万象、RunningHub AI、云函数SCF
   - **当前问题**：Provider类型映射硬编码在 `pipelineEngine.service.js` 中（需要重构）
   - 数据表：`provider_endpoints`（存储端点URL、加密凭证、认证方式）

3. **动态配置系统**
   - `form_schemas` 表：存储表单JSON Schema（字段定义、验证规则）
   - `pipeline_schemas` 表：存储Pipeline JSON（步骤配置、执行顺序）
   - `system_configs` 表：键值对配置（API密钥、Prompt模板、工作流ID）
   - `feature_definitions` 表：功能卡片定义（配额消耗、权限控制、Schema引用）

4. **前端动态渲染**
   - 已实现根据 `form_schemas` 动态渲染表单（支持image/radio等基础类型）
   - 工作台页面展示所有功能卡片（从 `feature_definitions` 读取）

### 核心优势（重要！）
- 🚀 **AI辅助开发，极低开发成本**：
  - 创始人通过Claude Code、Cursor、GPT-5 Pro等AI工具独立开发
  - 传统需要3-5人团队3个月的CMS系统，AI辅助下1人2-3周即可完成
  - 开发成本降低90%以上，迭代速度极快
  - **关键决策影响**：可以大胆选择自研方案，开发成本几乎可忽略不计
  - **请在技术选型时优先考虑灵活性和可扩展性**，不要因为担心开发工作量而妥协
- 💰 **灵活的资源配置**：
  - 服务器资源有限（4核4G单机）
  - 但开发时间充足（可以投入2-4周）
  - 优先考虑"适合现有架构、长期可维护"的方案

### 开发资源
- **开发人员**：1人（创始人），利用AI工具（Claude Code、Cursor、GPT-5 Pro）
- **开发时间**：可投入2-4周全职开发（每天6-8小时）
- **技能水平**：
  - 熟悉Next.js、React、Express.js、MySQL
  - AI辅助开发经验丰富，能快速学习新技术
  - 0基础，但通过AI工具可以实现专业级开发

---

## CMS系统功能需求（详细）

### 模块1：功能卡片管理（Feature Management）

**目标**：让管理员通过4步向导创建新功能卡片，无需手动编写JSON

**功能流程**：
```
Step 1: 基本信息
  - 功能名称、描述、图标、分类
  - 配额消耗（每次调用扣多少配额）
  - 权限控制（免费用户 / 会员用户 / 企业用户）

Step 2: 表单设计器
  - 拖拽式添加字段（10种类型：image/text/number/select/radio/checkbox/slider/color/date/textarea）
  - 字段配置：标签、占位符、验证规则、默认值、帮助文本
  - 实时预览表单效果
  - 生成 form_schemas JSON

Step 3: 流程编排器
  - 可视化配置Pipeline（拖拽节点连线）
  - 节点类型：API调用 / 云函数 / 条件判断 / 并行执行
  - 节点配置：选择Provider、配置参数、超时时间、重试策略
  - 实时预览流程图（React Flow可视化）
  - 生成 pipeline_schemas JSON

Step 4: 预览发布
  - 预览表单效果 + Pipeline流程图
  - 测试运行：提交测试数据，查看执行结果
  - 发布：写入 feature_definitions 表，立即生效
```

**技术需求**：
- 表单设计器：集成 Form.io React 或自研拖拽组件
- 流程编辑器：集成 React Flow
- JSON Schema生成器：根据UI配置生成标准JSON
- 测试运行器：调用Pipeline引擎执行测试任务

---

### 模块2：API供应商管理（Provider Management）

**目标**：动态添加新的API供应商，无需修改代码

**功能列表**：
- **Provider列表页**：展示所有已添加的Provider（名称、类型、状态、最后调用时间）
- **添加Provider**：
  - 基本信息：Provider名称、类型（REST API / GraphQL / gRPC / 云函数）
  - 端点配置：Base URL、认证方式（API Key / OAuth2 / HMAC）
  - 凭证配置：AES-256-CBC加密存储
  - 请求配置：Headers、超时时间、重试策略
- **编辑Provider**：修改配置参数
- **删除Provider**：软删除（标记为disabled，不物理删除）
- **测试连接**：发送测试请求，验证API可用性
- **健康监控**（可选，后续迭代）：查看成功率、平均响应时间

**技术需求**：
- **重构 pipelineEngine.service.js**：
  - 当前：硬编码的 `getProvider()` 方法（switch-case映射）
  - 目标：动态加载机制（从 `provider_endpoints` 表读取配置，动态require Provider类）
- **Provider接口规范**：
  - 所有Provider实现统一的 `IProvider` 接口
  - 必须实现 `execute(params)` 方法
  - 必须实现 `validate(params)` 方法
- **ProviderLoader类**：
  - 根据 `provider_type` 字段动态加载Provider类
  - 缓存已加载的Provider实例（避免重复require）
- **数据库改造**：
  - `provider_endpoints` 表新增 `provider_handler` 字段（存储类名或文件路径）

---

### 模块3：Prompt模板管理中心

**目标**：可视化管理AI Prompt，支持变量替换和版本历史

**功能列表**：
- **Prompt分类管理**：按场景分组（AI模特生成 / 视频拍摄 / 文案创作 / 其他）
- **Prompt编辑器**：
  - Monaco代码编辑器（语法高亮、自动补全）
  - 变量系统：支持 `{{变量名}}` 语法
  - 变量列表：展示当前Prompt使用的所有变量
  - 实时预览：输入测试变量值，查看渲染结果
- **Prompt测试**：
  - 输入测试变量，调用AI API，查看生成结果
  - 保存测试记录，方便对比不同版本效果
- **版本历史**（可选，后续迭代）：
  - 保留每次修改记录（版本号、修改时间、修改人、修改内容）
  - 回滚到历史版本

**技术需求**：
- Monaco Editor集成：React Monaco Editor
- 变量替换引擎：
  - 方案A：正则表达式替换（简单，但不支持条件渲染）
  - 方案B：Handlebars.js（支持 `{{#if}}`、`{{#each}}` 等复杂逻辑）
  - 方案C：Mustache.js（轻量级，中间方案）
- 变量提示和自动补全：Monaco Editor配置自定义语法提示
- 数据库改造：
  - `system_configs` 表扩展：增加 `category`、`description`、`variables`（JSON）字段
  - 新增 `prompt_versions` 表（可选）：存储历史版本

---

### 模块4：内容配置管理（Content Management）

**目标**：动态配置网站内容，无需修改代码

**子模块列表**：

#### 4.1 公告管理
- **列表页**：展示所有公告（标题、类型、状态、目标用户、创建时间）
- **创建公告**：
  - 标题、内容（富文本编辑器）
  - 展示类型：弹窗 / 横幅 / 通知中心
  - 目标用户：全体 / 会员 / 新用户 / 指定用户组
  - 定时发布：立即发布 / 指定时间发布
  - 过期时间：永久有效 / 指定过期时间
- **编辑/删除公告**

**数据库设计**：
```sql
CREATE TABLE announcements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  type ENUM('modal', 'banner', 'notification') DEFAULT 'modal',
  target_audience VARCHAR(50) DEFAULT 'all',
  status ENUM('draft', 'published', 'expired') DEFAULT 'draft',
  publish_at DATETIME,
  expire_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 4.2 轮播图管理
- **列表页**：展示所有轮播图（缩略图、标题、排序、状态）
- **创建轮播图**：
  - 上传图片（腾讯云COS）
  - 标题、描述
  - 跳转链接（站内链接 / 站外链接）
  - 排序：拖拽调整顺序
  - 定时上下线：立即上线 / 指定时间上线
- **拖拽排序**：React DnD库实现

**数据库设计**：
```sql
CREATE TABLE banners (
  id INT PRIMARY KEY AUTO_INCREMENT,
  image_url VARCHAR(500) NOT NULL,
  title VARCHAR(255),
  link_url VARCHAR(500),
  sort_order INT DEFAULT 0,
  status ENUM('active', 'inactive') DEFAULT 'active',
  publish_at DATETIME,
  expire_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 4.3 会员套餐配置
- **列表页**：展示所有套餐（名称、价格、配额、状态）
- **创建套餐**：
  - 套餐名称、描述、推荐标签（如"最超值"）
  - 价格配置：原价、现价、折扣
  - 配额配置：包含多少配额
  - 有效期：30天 / 90天 / 365天 / 永久
  - 功能权限：勾选可用的功能（从 feature_definitions 读取）
  - 显示顺序：拖拽调整

**数据库设计**：
```sql
CREATE TABLE membership_plans (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  original_price DECIMAL(10,2),
  current_price DECIMAL(10,2) NOT NULL,
  quota_amount INT NOT NULL,
  validity_days INT,
  badge VARCHAR(50),
  sort_order INT DEFAULT 0,
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE membership_benefits (
  id INT PRIMARY KEY AUTO_INCREMENT,
  plan_id INT NOT NULL,
  feature_id INT NOT NULL,
  FOREIGN KEY (plan_id) REFERENCES membership_plans(id),
  FOREIGN KEY (feature_id) REFERENCES feature_definitions(id)
);
```

#### 4.4 文案配置
- **按页面分组**：首页 / 工作台 / 会员中心 / 帮助中心
- **配置项**：
  - 页面标题、副标题
  - 空状态文案（如"暂无任务"）
  - 按钮文案（如"立即体验"）
  - 帮助提示文案
- **支持多语言**（可选，后续迭代）：中文 / 英文

**数据库改造**：
- 扩展 `system_configs` 表：增加 `page`、`locale` 字段
- 示例数据：
  ```json
  {
    "key": "home_title",
    "value": "AI服装图像处理专家",
    "page": "home",
    "locale": "zh-CN",
    "category": "copy"
  }
  ```

---

## 核心问题

请你深度分析以下问题，并输出详细的实施规划：

### 第一部分：技术架构设计

1. **表单设计器技术方案**
   - Form.io React集成方案（优劣分析、集成步骤、潜在坑点）
   - 完全自研方案（架构设计、核心组件、工作量评估）
   - 推荐方案和理由
   - JSON Schema设计示例（包含10种字段类型的完整Schema）

2. **Pipeline流程编辑器技术方案**
   - React Flow集成方案（节点设计、连线逻辑、数据结构）
   - 节点配置面板设计（弹窗 vs 侧边栏，推荐方案）
   - Pipeline JSON Schema设计示例（完整数据结构）
   - Pipeline合法性验证算法（循环依赖检测、步骤依赖分析）

3. **Provider动态加载机制**
   - 架构改造方案（详细说明如何重构 pipelineEngine.service.js）
   - IProvider接口设计（TypeScript接口定义）
   - ProviderLoader类实现思路（伪代码或架构图）
   - `provider_endpoints` 表设计（新增字段、索引优化）
   - 安全性考虑（防止恶意代码注入、沙箱隔离）

4. **Prompt变量替换引擎**
   - 技术选型：正则表达式 vs Handlebars.js vs Mustache.js（对比分析）
   - 推荐方案和理由
   - 变量提示和自动补全实现（Monaco Editor配置）
   - 实时预览功能实现思路

5. **前端动态表单渲染优化**
   - react-hook-form vs Formik（对比分析，推荐方案）
   - 大表单性能优化（虚拟滚动、懒加载、分步渲染）
   - 字段验证规则复用（前端 + 后端双重验证架构）

### 第二部分：数据库设计评审

6. **数据库表设计评审**
   - 评审我提出的5张新表（announcements、banners、membership_plans、membership_benefits、system_configs扩展）
   - 指出设计缺陷和改进建议
   - 索引策略优化（查询性能优化）
   - 数据迁移方案（如何从现有硬编码数据迁移到新表）

7. **配置缓存策略**
   - Redis缓存设计（缓存哪些数据、TTL策略、缓存失效机制）
   - 配置更新如何实时生效（无需重启服务）
   - 缓存一致性保证（数据库更新 → Redis更新 → 前端更新）

### 第三部分：工作量拆解和时间表

8. **详细的工作量拆解**
   - 将整个CMS自研项目拆解为**具体的开发任务**（每个任务4-12小时）
   - 每个任务包含：任务名称、预计工作量、依赖关系、技术要点
   - 按模块分组：Provider管理、表单设计器、流程编辑器、Prompt管理、内容管理

9. **按周实施计划**
   - Week 1：做哪些任务？预期交付什么？
   - Week 2：做哪些任务？预期交付什么？
   - Week 3：做哪些任务？预期交付什么？
   - Week 4（如果需要）：做哪些任务？预期交付什么？
   - 哪些任务可以并行开发？哪些必须串行？

10. **MVP和迭代策略**
    - MVP版本应该包含哪些核心功能？（2周交付）
    - 哪些功能可以放到后续迭代？（优先级P1、P2）
    - 如何设计降级策略（CMS不可用时，主系统仍可正常运行）？

### 第四部分：技术风险识别与应对

11. **技术风险识别**
    - Form.io React / React Flow的潜在坑点和应对方案
    - Provider动态加载的安全风险和缓解措施
    - 大表单性能风险和优化方案
    - 配置更新实时生效的技术难点

12. **开发风险识别**
    - 1人独立开发的最大风险是什么？（时间评估不准、技术难题卡住）
    - 如何降低风险？（技术预研、分阶段实施、及时求助AI工具）
    - 如果遇到技术难题，AI工具（Claude Code、Cursor）能否有效解决？

13. **业务风险识别**
    - CMS系统故障对主业务的影响评估
    - 降级策略设计（配置不可用时使用默认值）
    - 回滚方案设计（如何快速回滚到配置修改前的状态）

### 第五部分：AI开发任务卡输出（重要！）

14. **请将整个CMS自研项目拆解为可直接交给AI编程工具执行的任务卡**

**任务卡格式要求**：
```json
{
  "taskId": "CMS-001",
  "module": "Provider管理",
  "title": "实现Provider动态加载机制",
  "phase": "Week 1",
  "estimatedHours": 8,
  "priority": "P0",
  "dependencies": [],
  "description": "重构pipelineEngine.service.js，将硬编码的Provider映射改为动态加载机制",
  "technicalRequirements": [
    "在provider_endpoints表增加provider_handler字段（存储类名或文件路径）",
    "实现ProviderLoader类，支持动态require加载Provider",
    "所有Provider类实现统一的IProvider接口",
    "添加Provider缓存机制，避免重复加载"
  ],
  "acceptanceCriteria": [
    "新增一个测试Provider（如MockProvider），无需修改pipelineEngine代码即可调用",
    "所有现有Provider（TencentProvider、RunningHubProvider、SCFProvider）正常工作",
    "单元测试覆盖率达到80%",
    "性能测试：动态加载Provider的性能损耗<5ms"
  ],
  "codeLocations": [
    "backend/src/services/pipelineEngine.service.js",
    "backend/src/providers/ProviderLoader.js",
    "backend/src/providers/IProvider.interface.js",
    "backend/src/providers/base/BaseProvider.js"
  ],
  "testStrategy": [
    "单元测试：测试ProviderLoader.load()方法",
    "集成测试：测试Pipeline执行流程，验证动态加载的Provider可正常调用",
    "性能测试：测试动态加载的性能开销"
  ],
  "aiPromptSuggestion": "请帮我重构pipelineEngine.service.js的getProvider方法，实现Provider动态加载。要求：\n1. 从provider_endpoints表读取provider_handler字段（存储Provider类的文件路径）\n2. 使用require()动态加载Provider类\n3. 定义IProvider接口，所有Provider必须实现execute(params)和validate(params)方法\n4. 实现ProviderLoader类，负责Provider的加载和缓存\n5. 添加错误处理：如果Provider加载失败，返回友好错误信息\n6. 编写单元测试，覆盖正常加载、加载失败、缓存机制等场景"
}
```

**任务卡输出要求**：
1. **任务卡数量**：预计拆解为30-50个任务卡（每个任务卡4-12小时）
2. **任务分组**：按功能模块分组
   - Provider管理（5-8个任务卡）
   - 表单设计器（8-12个任务卡）
   - 流程编辑器（8-12个任务卡）
   - Prompt管理（4-6个任务卡）
   - 内容管理（6-10个任务卡）
   - 测试和优化（3-5个任务卡）
3. **依赖关系**：明确任务卡之间的依赖（用taskId表示）
4. **优先级标记**：P0（核心功能，MVP必须）、P1（重要功能，尽快完成）、P2（优化功能，后续迭代）
5. **AI提示词**：每个任务卡给出建议的AI Prompt（方便我直接复制给Claude Code）

**任务卡示例**（至少输出30个任务卡）：
- CMS-001：实现Provider动态加载机制（P0，8小时）
- CMS-002：定义IProvider接口和BaseProvider基类（P0，4小时）
- CMS-003：重构现有Provider（TencentProvider、RunningHubProvider、SCFProvider）实现IProvider接口（P0，6小时）
- CMS-004：实现Provider管理后台CRUD接口（P0，6小时）
- CMS-005：实现Provider管理前端页面（列表、创建、编辑、删除）（P0，8小时）
- CMS-006：实现Provider测试连接功能（P1，4小时）
- CMS-007：集成Form.io React到项目中（P0，6小时）
- CMS-008：实现表单设计器UI（拖拽字段、字段配置面板）（P0，12小时）
- CMS-009：实现表单Schema生成器（P0，6小时）
- CMS-010：实现表单实时预览功能（P1，6小时）
- ... （至少30个任务卡）

---

## 输出要求

请以架构师的专业视角，进行系统性的深度分析，包括：

1. **详细的技术方案设计**（每个模块给出架构设计、数据结构、伪代码示例）
2. **完整的工作量拆解**（按周拆解的详细计划，明确每周交付什么）
3. **30-50个AI任务卡**（可直接交给Claude Code执行，每个任务卡4-12小时）
4. **风险缓解措施**（识别所有潜在风险，并给出应对方案）
5. **最佳实践建议**（基于你的经验，给出行业最佳实践）

请使用你的深度推理能力，像一位资深架构师那样，进行全面、系统、批判性的分析。

**特别说明**：
- 任务卡的AI Prompt要具体、可执行，避免模糊描述
- 任务卡的验收标准要明确、可量化
- 任务卡之间的依赖关系要清晰，确保可以按顺序执行
- 优先级标记要合理，MVP版本应该只包含P0任务卡
