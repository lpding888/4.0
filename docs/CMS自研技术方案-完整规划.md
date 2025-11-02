# CMS自研技术方案 - 完整规划文档

> **文档版本**: v1.0
> **最后更新**: 2025-10-31
> **技术栈**: Next.js 14 + React 18 + TypeScript + AntD + Express + Knex + MySQL 8 + Redis + 腾讯云COS + PM2
> **服务器资源**: 4C/4G 单机
> **开发模式**: AI辅助开发，2-4周MVP交付

---

## 执行摘要（Executive Summary）

### 推荐方案：**完全自研（方案A）**

**核心理由**:
1. **核心价值契合**: 可视化Pipeline编排、Provider动态绑定和Prompt模板是平台核心能力，通用CMS难以原生满足
2. **资源约束适配**: 单机4C/4G环境下，避免额外CMS进程的内存与CPU开销
3. **技术掌控度**: 完全掌控数据结构与演化节奏，避免vendor lock-in
4. **开发周期可控**: AI辅助开发 + 开源组件集成，2-4周可达MVP

**风控护栏**:
1. **前置2-3天技术预研**: 验证Form.io、React Flow、Monaco三大开源组件可行性
2. **配置快照机制**: 本地JSON/数据库双写 + Redis只读缓存，确保CMS挂掉主业务仍可运行

**为什么不选Strapi/混合方案？**
- Strapi适合标准CRUD内容，但核心编排能力仍需自研
- 混合方案引入双份权限与数据模型维护，资源压力更大
- 单机资源限制下，链路复杂度与内存占用不划算

---

## 第一部分：技术架构设计

### 1.1 总览架构（读写分离）

**设计原则**: 把CMS(写路径)与运行期(读路径)强隔离，动态性集中到配置数据而非动态代码

#### 写路径（Admin管理端）
```
Next.js Admin UI → Express API (/admin/*) → MySQL (主存)
  ↓ 成功后
  1. 写审计表 + 版本号
  2. 生成配置快照JSON (config_snapshots 或 /data/snapshots)
  3. Redis Pub/Sub 发布 "cfg:invalidate" 消息
```

#### 读路径（运行期）
```
Pipeline引擎 → Local LRU Cache → Redis → 快照JSON → DB → 内置默认值
  ↓
收到Pub/Sub后精准失效，主动刷新Redis与本地LRU
```

**只读化保障**: 即使DB或Admin崩溃，运行期仍可用（快照兜底）

#### 模块边界
- **Feature管理**: 组合 form_schema + pipeline_schema + 权限/配额
- **Provider管理**: 泛化Provider(GenericHTTP/GraphQL/gRPC/SCF) + 专用Provider(TencentCI/RunningHub)，白名单注册
- **Prompt管理**: 模板 + 变量 + 版本 + 预览/测试
- **内容管理**: 公告、轮播、套餐、文案等通用CRUD

---

### 1.2 表单设计器方案

**推荐方案**: **Form.io前端库 (react-formio) + UFS适配层**

#### 技术选型
- **优点**: 开箱拖拽、组件丰富、导出JSON
- **风险应对**:
  - SSR环境需 `next/dynamic` + `ssr: false`
  - 仅使用MIT组件，避免Premium License
  - 通过适配层抽取所需字段，避免对Formio JSON结构硬依赖

#### 统一表单Schema（UFS）标准
支持10类字段类型：
```typescript
type FieldType = 'image' | 'text' | 'number' | 'select' | 'radio' |
                 'checkbox' | 'slider' | 'color' | 'date' | 'textarea';

interface UFSSchema {
  version: number;
  title: string;
  layout: { columns: number; steps: string[] };
  fields: Field[];
  validation: { crossRules: Rule[] };
}
```

**示例字段定义**:
```json
{
  "type": "image",
  "key": "input_image",
  "label": "输入图片",
  "required": true,
  "accept": ["image/jpeg", "image/png"],
  "maxSizeMB": 10,
  "step": "基础"
}
```

---

### 1.3 Pipeline流程编辑器（React Flow）

#### 节点类型设计
- `API_CALL`: 泛化HTTP/GraphQL/gRPC调用
- `PROVIDER`: TencentCI/RunningHub/GenericHTTP/SCF
- `CONDITION`: 条件分支
- `PARALLEL`: 并行开始/汇合 (FORK/JOIN)
- `POST_PROCESS`: 图像二次处理、SCF扩展
- `END`: 流程出口

#### Pipeline Schema v1 数据结构
```json
{
  "version": 1,
  "name": "ai-remove-bg",
  "vars": {
    "global": {"userId": "{{user.id}}", "requestId": "{{request.id}}"}
  },
  "nodes": [
    {
      "id": "n1",
      "type": "PROVIDER",
      "label": "上传到COS",
      "providerRefId": 101,
      "handlerKey": "TENCENT_CI",
      "timeoutMs": 20000,
      "retry": {"max": 2, "backoff": "exponential", "initialDelayMs": 500},
      "in": {"image": "{{form.input_image}}"},
      "out": {"cosKey": "{{result.key}}", "url": "{{result.url}}"}
    }
  ],
  "edges": [
    {"id": "e12", "from": "n1", "to": "n2"}
  ],
  "onError": {"policy": "FAIL_FAST", "compensate": false}
}
```

#### 合法性验证算法
1. **循环依赖检测**: Kahn拓扑排序，若剩余nodes>0则存在环
2. **入度约束**: END节点 ≥1入度
3. **条件边检查**: CONDITION节点必须存在true/false两条边
4. **变量可达性**: 数据血缘分析，确认来源于form或前序节点out
5. **Provider可用性**: providerRefId必须enabled且健康
6. **输出覆盖**: 同名输出变量不可被后续节点重复定义

#### 测试运行器
```
POST /admin/pipelines/:id/test
- 隔离的模拟执行上下文（不计配额）
- 支持真实外部调用或Mock模式
- 收集Step级日志与耗时
```

---

### 1.4 Provider动态加载机制（安全版）

#### 核心原则
- **不从DB加载可执行代码**
- DB仅决定"使用哪个白名单Handler + 参数"
- 新增供应商无需改Pipeline引擎：
  - REST/GraphQL/gRPC → Generic Handler通过请求模板配置
  - 定制逻辑 → SCF(云函数)作为扩展点

#### IProvider接口设计
```typescript
interface IProvider {
  key: string;  // 'GENERIC_HTTP' | 'RUNNINGHUB' | ...
  validate(params: unknown): {valid: true} | {valid: false; issues: string[]};
  execute(params: Record<string, any>, ctx: ExecContext): Promise<ExecResult>;
  healthcheck?(endpoint: any): Promise<{ok: boolean; latencyMs?: number; message?: string}>;
}
```

#### Provider白名单注册
```typescript
const ALLOW_LIST: Record<string, () => Promise<IProvider>> = {
  GENERIC_HTTP: async () => (await import('./handlers/generic-http')).provider,
  GENERIC_GRAPHQL: async () => (await import('./handlers/generic-graphql')).provider,
  GENERIC_GRPC: async () => (await import('./handlers/generic-grpc')).provider,
  TENCENT_CI: async () => (await import('./handlers/tencent-ci')).provider,
  RUNNINGHUB: async () => (await import('./handlers/runninghub')).provider,
  SCF: async () => (await import('./handlers/scf')).provider
};
```

#### provider_endpoints表结构增强
```sql
ALTER TABLE provider_endpoints
  ADD COLUMN provider_key VARCHAR(64) NOT NULL,
  ADD COLUMN handler_version VARCHAR(32) DEFAULT '1',
  ADD COLUMN auth JSON NULL,  -- {method:'api_key'|'oauth2'|'hmac', ...}
  ADD COLUMN req_template JSON NULL,  -- For GENERIC_*
  ADD COLUMN timeout_ms INT DEFAULT 20000,
  ADD COLUMN retry_policy JSON DEFAULT JSON_OBJECT('max',1),
  ADD COLUMN status ENUM('enabled','disabled') DEFAULT 'enabled',
  ADD INDEX idx_provider_key_status (provider_key, status);
```

#### 安全性保障
- **密钥加密**: auth中敏感字段使用AES-256-GCM应用层加密
- **模板渲染**: req_template变量在沙箱变量表中替换，不执行表达式
- **健康检查**: 后台定期调用healthcheck()，写last_health_at
- **审计**: 所有变更写provider_audit_logs

---

### 1.5 Prompt变量引擎与Monaco集成

#### 选型：Handlebars.js（受限模式）
- **理由**: 支持 `#if/#each` 等结构，语义清晰
- **安全**: 通过白名单helpers与默认转义避免注入
- **备选**: Mustache（更轻、更"无逻辑"）

#### 变量提示功能
- Monaco注册 CompletionItemProvider
- 变量来源: `form.*`, `pipeline.*`, `system.*`, `user.*`, `node.*`
- 侧边栏显示"已解析变量表"，标红未提供值的变量

#### 实时预览
```
前端: 输入变量JSON → POST /admin/prompts/preview
后端: 受限环境渲染，返回结果与缺失变量列表
```

---

### 1.6 前端动态表单渲染与性能

#### 技术选型：react-hook-form（RHF）
- **优势**: 少渲染、原生注册、性能优于Formik
- **与AntD集成**: 成熟且稳定

#### 性能策略
1. **分步渲染**: Step Wizard，同屏字段≤12
2. **虚拟滚动**: 大列表用react-window
3. **惰性注册**: 切步才注册字段
4. **受控/非受控混用**: 图片/颜色选择器保留内部状态
5. **规则复用**: UFS规则映射为RHF的register + 后端Zod校验

#### 双端校验
- **前端**: RHF + Zod共享定义
- **后端**: 提交时再次校验防穿透
- **错误结构**: 保持field-level一致性

---

## 第二部分：数据库设计评审与改进

### 2.1 新表/改表建议

#### 1) announcements表增强
```sql
ALTER TABLE announcements
  ADD COLUMN tenant_id BIGINT NULL,
  ADD COLUMN updated_at TIMESTAMP NULL,
  ADD COLUMN updated_by VARCHAR(64) NULL,
  ADD COLUMN is_deleted TINYINT(1) DEFAULT 0,
  ADD COLUMN priority INT DEFAULT 0,
  ADD COLUMN audience_filter JSON NULL,
  ADD INDEX idx_status_time (status, publish_at, expire_at),
  ADD INDEX idx_tenant (tenant_id);
```

#### 2) banners表增强
```sql
ALTER TABLE banners
  ADD COLUMN tenant_id BIGINT NULL,
  ADD COLUMN updated_at TIMESTAMP NULL,
  ADD COLUMN updated_by VARCHAR(64) NULL,
  ADD COLUMN is_deleted TINYINT(1) DEFAULT 0,
  ADD COLUMN device ENUM('pc','mobile','both') DEFAULT 'both',
  ADD COLUMN locale VARCHAR(16) DEFAULT 'zh-CN',
  ADD INDEX idx_status_sort (status, publish_at, expire_at, sort_order);
```

#### 3) membership相关表增强
```sql
ALTER TABLE membership_plans
  ADD COLUMN tenant_id BIGINT NULL,
  ADD COLUMN updated_at TIMESTAMP NULL,
  ADD COLUMN updated_by VARCHAR(64) NULL,
  ADD COLUMN is_deleted TINYINT(1) DEFAULT 0,
  ADD COLUMN billing_cycle ENUM('month','quarter','year','custom') DEFAULT 'month',
  ADD COLUMN features_json JSON NULL;
```

#### 4) system_configs扩展
```sql
ALTER TABLE system_configs
  ADD COLUMN category VARCHAR(64) NULL,
  ADD COLUMN page VARCHAR(64) NULL,
  ADD COLUMN locale VARCHAR(16) NULL,
  ADD COLUMN description TEXT NULL,
  ADD COLUMN version INT DEFAULT 1,
  ADD COLUMN updated_by VARCHAR(64) NULL,
  ADD COLUMN updated_at TIMESTAMP NULL,
  ADD COLUMN is_deleted TINYINT(1) DEFAULT 0,
  ADD INDEX idx_category_page (category, page, locale);
```

#### 5) config_snapshots新建（核心表）
```sql
CREATE TABLE config_snapshots (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  scope ENUM('feature','form','pipeline','provider','system') NOT NULL,
  ref_id BIGINT NULL,
  key_name VARCHAR(255) NULL,
  version INT NOT NULL,
  json LONGTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(64) NULL,
  INDEX idx_scope_ref (scope, ref_id, version),
  INDEX idx_scope_key (scope, key_name, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2.2 数据迁移策略

1. **Knex增量迁移**: 先建表/改表，填充基础数据
2. **Feature定义**: 赋予稳定key(slug)，增设form_schema_id/pipeline_schema_id显式版本
3. **Provider初始化**: 硬编码Provider写入provider_endpoints，设置provider_key与req_template/auth
4. **首次快照**: 创建version=1的config_snapshots，立即具备回滚能力

---

## 第三部分：工作量拆解与实施时间表

### 3.1 任务颗粒度原则

- **单任务时长**: 4-12小时
- **实施顺序**: 先内核后界面，先安全/缓存/回滚，再堆UI
- **关键路径**: Provider动态化 → Pipeline编辑/执行 → 表单设计器 → Feature向导 → Prompt中心 → 内容CRUD
- **可并行**: 内容CRUD与Prompt编辑器可在Week2下半与Pipeline验收并行

### 3.2 按周实施计划（3周 + 1周缓冲）

#### Week 1: 内核与底座
- 数据库迁移（provider增强、snapshots、新字段）
- ProviderLoader + 泛化Provider（GenericHTTP/SCF）
- Redis缓存与Pub/Sub、配置快照读写
- React Flow / Form.io 前端接入POC
- Admin基础框架（/admin布局、RBAC钩子）

#### Week 2: 核心编辑器与Feature向导
- Pipeline编辑器（节点库、侧边栏配置、校验器）
- 表单设计器（Form.io → UFS适配器 + 实时预览）
- Feature向导（Step1-4）+ 测试运行器
- Provider管理UI（CRUD、测试连接）

#### Week 3: Prompt/内容管理与稳定性
- Prompt中心（Monaco、变量、预览、版本）
- 内容管理4模块CRUD + COS上传 + 排序
- 回归与E2E（关键路径）
- 监控与告警（简单日志面板）
- 压测与缓存命中率观测
- 预留2-3天修整/打磨

#### Week 4: 可选缓冲
- 健康监控面板、更多统计
- 国际化、多租户预留字段落地
- 代码整理、文档、演示脚本

### 3.3 MVP范围（2周可交付）

**P0核心功能**:
- Provider动态加载（GenericHTTP+SCF+已接入三方）
- Pipeline编辑器（基本节点/连线/校验/保存/预览/试跑）
- 表单设计器（10类字段 + 适配器 + 预览 + 保存）
- Feature向导（Step1-4发布）
- Prompt编辑器（基本渲染与预览）
- 内容管理（公告/轮播/套餐/文案的基础CRUD）
- 缓存/快照/降级策略（只读链路打通）

**P1后续优先**:
- Provider健康看板
- Prompt版本管理
- 内容拖拽排序与定时发布
- 并行/Join节点
- 图形化回放

**P2长期迭代**:
- 多租户
- i18n国际化
- 细粒度审计
- 复杂审批流

### 3.4 降级策略

- **写失败/DB挂**: 运行期读Redis→快照→默认；Admin显示"只读模式"
- **外部Provider不健康**: 测试连接与健康检查标红，Pipeline执行走重试/熔断
- **配置误改**: 从config_snapshots一键回滚版本，再次发布并广播失效

---

## 第四部分：技术风险与应对

### 4.1 开源库风险

#### Form.io前端库
- **风险**: SSR环境兼容性、Premium组件许可
- **应对**:
  - next/dynamic关闭SSR
  - 仅使用MIT组件
  - 适配层隔离结构波动

#### React Flow
- **风险**: 大图重渲染性能问题
- **应对**:
  - useMemo/nodeTypes稳定引用
  - 局部状态管理
  - 虚拟化/缩略图

#### Monaco Editor
- **风险**: SSR水合警告
- **应对**: next/dynamic仅浏览器加载

### 4.2 安全风险

- **Provider**: 不执行DB注入代码，仅白名单Handler + 请求模板
- **密钥**: AES-256-GCM加密 + 密钥轮换 + 读写审计
- **Prompt**: 禁用任意JS执行，Handlebars仅内置helpers
- **Admin**: RBAC权限控制

### 4.3 性能风险

- **高频配置读**: Redis + 本地LRU，监控命中率
- **Provider重试**: 指数退避策略
- **表单/流程编辑**: 懒加载与分步渲染

### 4.4 单兵开发风险

- **应对策略**:
  - 严格"任务卡→PR→自动化测试"流程
  - 先做最难的20%（Provider动态化/Pipeline校验/缓存失效）
  - 每天固定时间生成AI Prompt
  - 卡住>2小时：最小复现 + 提问AI

### 4.5 业务连续性

- 快照与默认值兜底
- 一键回滚脚本
- 发布前"预生产/影子配置"冷启动验证

---

## 第五部分：关键技术点与伪代码

### Pipeline执行引擎（伪代码）
```typescript
async function runPipeline(pipelineId: number, formData: any, opts: {test?: boolean}) {
  const pipeline = await loadPipelineFromCache(pipelineId); // Redis/LRU/快照
  validateTopology(pipeline); // 抛出结构错误
  const ctx = buildExecContext(opts);
  const state = {vars: {form: formData, system: {...}, node:{}}};

  for (const step of topoSort(pipeline)) {
    const provider = await loadProvider(step.handlerKey);
    const params = materialize(step.in, state.vars); // {{var}} 替换
    const res = await withRetryTimeout(
      () => provider.execute(params, ctx),
      step.retry,
      step.timeoutMs
    );
    if (!res.ok) throw new PipelineError(step.id, res.error);
    writeOutputsToState(step.out, res.result, state.vars);
  }
  return extractFinal(state);
}
```

### 缓存失效机制（伪代码）
```typescript
// 写入时
await knex('form_schemas').insert({...});
await knex('config_snapshots').insert({scope:'form', ref_id:id, version, json});
await redis.publish('cfg:invalidate', JSON.stringify({scope:'form', key:id, version}));

// 订阅处理
redis.on('message', (ch, msg) => {
  const {scope, key} = JSON.parse(msg);
  lru.invalidate(composeKey(scope, key));
  redisClient.del(composeKey(scope, key));
});
```

### 核心路由清单
```
POST   /admin/forms
GET    /admin/forms/:id/versions
POST   /admin/forms/:id/rollback

POST   /admin/pipelines
GET    /admin/pipelines/:id/versions
POST   /admin/pipelines/:id/test

POST   /admin/features
GET    /admin/features

POST   /admin/providers/test-connection
CRUD   /admin/providers/*

POST   /admin/prompts/preview
GET    /admin/prompts/:id/versions
POST   /admin/prompts/test-run

GET    /public/content/home  # 聚合公告/轮播/文案
```

---

## 第六部分：任务卡总览

**总计**: 47张任务卡，分6组

### 组一：Provider管理（8张）
- CMS-001 ~ CMS-008
- 涵盖: Provider动态加载、IProvider接口、GenericHTTP、SCF、凭证加密、健康检查、审计、UI管理

### 组二：表单设计器（10张）
- CMS-101 ~ CMS-110
- 涵盖: Form.io集成、UFS适配器、10类字段渲染、分步Wizard、校验引擎、预览、保存、版本、回滚、UI

### 组三：流程编辑器（10张）
- CMS-201 ~ CMS-210
- 涵盖: React Flow集成、节点库、侧边栏配置、拓扑验证、执行引擎、变量替换、测试运行器、版本、回滚、UI

### 组四：Prompt管理（6张）
- CMS-301 ~ CMS-306
- 涵盖: Handlebars引擎、Monaco集成、变量提示、实时预览、版本、UI

### 组五：内容管理（8张）
- CMS-401 ~ CMS-408
- 涵盖: 公告、轮播、套餐、文案4模块CRUD、COS上传、排序、定时、聚合接口

### 组六：缓存与测试（5张）
- CMS-501 ~ CMS-505
- 涵盖: Redis缓存、Pub/Sub失效、快照读写、单元测试、E2E测试、性能基线

**详细任务卡清单**: 见 `tasks/cms-system/` 目录下按角色分组的JSON文件

---

## 第七部分：验收标准

### 技术验收
- 所有P0任务卡通过单元测试（覆盖率≥80%）
- E2E测试覆盖核心流程（创建Feature→发布→前台展示）
- 缓存命中率≥95%，p95延迟<100ms
- 配置误改可一键回滚且<3分钟恢复
- Provider健康检查异常告警<1分钟

### 功能验收
- 可视化创建包含10类字段的表单
- 可视化编排包含6类节点的Pipeline
- Pipeline测试运行器正常工作（Mock+真实模式）
- Feature向导4步流程完整可用
- Prompt编辑器支持变量提示与实时预览
- 内容管理4模块CRUD + 排序 + 定时发布
- 管理端RBAC权限正常生效

### 业务验收
- 新增功能从0到上线<2小时（含测试）
- Admin操作日志完整可追溯
- 运行期配置读取不依赖DB（快照兜底）
- 密钥加密存储且不泄露到前端

---

## 执行建议与注意事项

### 实施原则
1. **先难后易**: Week1攻克Provider动态化 + 缓存与快照 + POC
2. **MVP只做P0**: 两周闭环（新建Feature→表单/流程→试跑→发布→前台可见）
3. **持续验证**: 每晚跑E2E，每个写路径都生成快照并广播失效
4. **安全边界**: 不执行DB代码，扩展通过SCF，密钥统一加密轮换

### AI协作建议
- 每张任务卡包含aiPromptSuggestion字段
- 直接复制给Claude Code/Cursor/GPT-5 Pro执行
- 卡住>2小时：粘贴任务卡上下文与报错提问AI
- 形成"任务卡→AI实现→PR→测试"的固定节奏

### 关键里程碑
- **Day 3**: POC验证通过（Form.io+React Flow+Monaco可用）
- **Week 1末**: Provider动态化 + 缓存/快照 + Admin框架
- **Week 2末**: MVP核心功能完成（表单+流程+Feature）
- **Week 3末**: 内容管理+测试+性能优化+文档

---

## 附录：参考资源

### 开源组件
- **Form.io**: https://github.com/formio/formio.js (MIT前端库)
- **React Flow**: https://reactflow.dev/ (MIT)
- **Monaco Editor**: https://microsoft.github.io/monaco-editor/ (MIT)
- **Handlebars**: https://handlebarsjs.com/ (MIT)

### 技术文档
- Next.js 14 App Router: https://nextjs.org/docs
- React Hook Form: https://react-hook-form.com/
- Knex.js: https://knexjs.org/
- Redis Pub/Sub: https://redis.io/docs/manual/pubsub/

### 备选方案参考
- **Strapi v5**: https://docs.strapi.io/ (若未来内容团队规模大)
- **Directus**: https://docs.directus.io/ (SQL数据库即视化)
- **Payload CMS**: https://payloadcms.com/ (代码驱动CMS)
- **AdminJS**: https://adminjs.co/ (嵌入式CRUD后台)

---

**文档结束**

> 💡 **下一步**: 查看 `tasks/cms-system/README.md` 了解任务卡分配详情，按角色领取任务开始开发。
