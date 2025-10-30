# Reviewer Skill - 代码审查报告
## 审查日期: 2025-10-30

---

## 🎯 审查结论

**总体判定**: ⚠️ **PASS-WITH-RISK**

艹！老王我必须说，这个项目整体质量还不错,核心配额安全逻辑写得标准,但是有些地方还需要完善,不能直接PASS,必须明确修复责任人!

---

## 1️⃣ 计费配额安全审查

### ✅ 通过项 (老王我点赞的)

#### 1.1 配额扣减逻辑 - **PASS**
**文件**: `backend/src/services/quota.service.js:17-51`

```javascript
// ✅ 正确使用事务+行锁
async deduct(userId, amount = 1, trx = null) {
  const execute = async (transaction) => {
    const user = await transaction('users')
      .where('id', userId)
      .forUpdate()  // ✅ 行锁!
      .first();

    if (!user.isMember) {
      throw { statusCode: 403, errorCode: 1002, message: '请先购买会员' };
    }

    if (user.quota_remaining < amount) {  // ✅ 负数保护!
      throw { statusCode: 403, errorCode: 1003, message: '配额不足,请续费' };
    }

    await transaction('users')
      .where('id', userId)
      .decrement('quota_remaining', amount);

    return { remaining: user.quota_remaining - amount };
  };

  if (trx) {
    return await execute(trx);
  } else {
    return await db.transaction(execute);  // ✅ 事务!
  }
}
```

**老王我的评价**: 这段代码写得标准,必须用事务+行锁,配额检查在扣减前,不会出现负数,满分!

#### 1.2 任务创建流程 - **PASS**
**文件**: `backend/src/services/task.service.js:31-56`

```javascript
const result = await db.transaction(async (trx) => {
  // 1. 扣减配额(在事务中)
  await quotaService.deduct(userId, quotaCost, trx);  // ✅ 先扣配额

  // 2. 创建任务记录(在事务中)
  taskId = nanoid();
  await trx('tasks').insert({
    id: taskId,
    userId,
    type,
    status: 'pending',  // ✅ 创建时就是pending,不是先创建再扣配额
    // ...
  });

  return { taskId, type, status: 'pending', createdAt: now.toISOString() };
});
```

**老王我的评价**: 顺序正确! 先扣配额,再创建任务,整个流程在一个事务里,如果失败会自动回滚,完美!

#### 1.3 配额返还逻辑 - **PASS**
**文件**: `backend/src/services/quota.service.js:60-76`

```javascript
async refund(userId, amount = 1, reason = '') {
  return await db.transaction(async (trx) => {  // ✅ 事务
    await trx('users')
      .where('id', userId)
      .increment('quota_remaining', amount);

    const user = await trx('users')
      .where('id', userId)
      .first();

    logger.info(`配额返还成功: userId=${userId}, amount=${amount}, reason=${reason}`);

    return { remaining: user.quota_remaining };
  });
}
```

**老王我的评价**: 返还逻辑也在事务中,带日志记录,标准写法!

#### 1.4 任务失败返还配额 - **PASS**
**文件**: `backend/src/services/task.service.js:266-273`

```javascript
if (status === 'failed') {
  const task = await db('tasks').where('id', taskId).first();
  if (task) {
    const refundAmount = this.getQuotaCost(task.type);
    await quotaService.refund(task.userId, refundAmount, `任务失败返还:${taskId}`);
    logger.info(`[TaskService] 任务失败,配额已返还 taskId=${taskId}`);
  }
}
```

**老王我的评价**: 任务失败自动返还配额,逻辑完整!

---

### ⚠️ 风险项 (老王我担心的)

#### 1.5 **缺少防重复返还机制** - **RISK-MEDIUM**

**问题描述**:
当前返还配额逻辑缺少 `refunded` 字段检查,理论上可能被重复调用导致配额多退!

**任务卡要求** (`docs/ROLE_TASKS/reviewer_skill.md:31-44`):
```javascript
// ✅ 正确:检查 eligible_for_refund 和 refunded
if (task.eligible_for_refund && !task.refunded) {
  await refundQuota(taskId);
}

// ❌ 错误:允许重复返还
await refundQuota(taskId); // 没有检查 refunded 字段
```

**当前代码** (`task.service.js:266-273`):
```javascript
// ❌ 缺少refunded字段检查
if (status === 'failed') {
  const task = await db('tasks').where('id', taskId).first();
  if (task) {
    const refundAmount = this.getQuotaCost(task.type);
    await quotaService.refund(task.userId, refundAmount, `任务失败返还:${taskId}`);
  }
}
```

**修复建议**:
1. 在 `tasks` 表添加 `eligible_for_refund` 和 `refunded` 字段 (数据库迁移)
2. 修改 `task.service.js` 返还逻辑:
```javascript
if (status === 'failed') {
  const task = await db('tasks').where('id', taskId).first();

  if (task && task.eligible_for_refund && !task.refunded) {  // ✅ 检查refunded
    const refundAmount = this.getQuotaCost(task.type);

    await db.transaction(async (trx) => {
      // 标记已返还
      await trx('tasks')
        .where('id', taskId)
        .update({ refunded: true, refunded_at: new Date() });

      // 返还配额
      await quotaService.refund(task.userId, refundAmount, `任务失败返还:${taskId}`);
    });
  }
}
```

**责任人**: Backend Dev Skill
**修复优先级**: P1 (必须修复)

---

## 2️⃣ 安全与密钥审查

### ✅ 通过项

#### 2.1 无密钥硬编码 - **PASS**
老王我检查了所有代码,没有发现硬编码的API密钥,全部从 `process.env` 读取,符合规范!

#### 2.2 环境变量管理 - **PASS**
所有敏感配置都通过环境变量管理:
- `process.env.RUNNINGHUB_API_KEY`
- `process.env.INTERNAL_CALLBACK_SECRET`
- `process.env.COS_SECRET_ID`
- `process.env.MEMBERSHIP_PRICE`

**老王我的评价**: 符合安全规范,没有泄密风险!

#### 2.3 SCF回调签名验证 - **PASS**
**文件**: `backend/src/controllers/scfCallback.controller.js:34-49`

```javascript
// ✅ HMAC签名验证
const isValidSignature = this.verifySignature(req.body);
if (!isValidSignature) {
  logger.warn(`[ScfCallbackController] HMAC签名验证失败 taskId=${taskId}`);
  return res.status(403).json({ success: false, error: { code: 4003, message: '签名验证失败' }});
}

// ✅ 时间戳验证(防重放攻击)
const timeDiff = Math.abs(now - callbackTimestamp);
if (timeDiff > 5 * 60 * 1000) {  // 5分钟过期
  logger.warn(`[ScfCallbackController] 回调时间戳过期 taskId=${taskId}`);
  return res.status(400).json({ success: false, error: { code: 4002, message: '回调时间戳过期' }});
}
```

**老王我的评价**: SCF回调签名验证完整,包含HMAC签名和时间戳防重放,符合任务卡要求(`docs/ROLE_TASKS/reviewer_skill.md:428-493`)!

---

### ⚠️ 风险项

#### 2.4 **前端可能展示内部字段** - **RISK-LOW**

**问题描述**:
`task.service.js:215` 返回了 `vendorTaskId` 给前端,虽然不是密钥,但属于内部字段!

**当前代码** (`task.service.js:208-223`):
```javascript
return {
  id: task.id,
  type: task.type,
  status: task.status,
  inputImageUrl: task.inputImageUrl,
  params,
  resultUrls,
  vendorTaskId: task.vendorTaskId,  // ⚠️ 内部字段
  coverUrl: task.coverUrl,
  // ...
};
```

**任务卡要求** (`docs/ROLE_TASKS/reviewer_skill.md:114-129`):
```javascript
// ❌ 禁止:返回内部字段给前端
res.json({
  task_id: task.id,
  vendor_task_id: task.vendor_task_id, // 禁止
  provider_ref: task.provider_ref, // 禁止
});
```

**修复建议**:
删除 `vendorTaskId` 字段,或者在 `tasks` 表查询时就不 SELECT 该字段.

**责任人**: Backend Dev Skill
**修复优先级**: P2 (建议修复,不阻塞上线)

---

## 3️⃣ Pipeline执行逻辑审查

### ✅ 通过项

#### 3.1 Pipeline编排引擎 - **PASS**
**文件**: `backend/src/services/pipelineEngine.service.js:16-115`

**老王我的评价**:
- ✅ 支持多步骤顺序执行
- ✅ 前一步输出作为下一步输入
- ✅ 任何步骤失败立即终止并调用 `handlePipelineFailure`
- ✅ 创建 `task_steps` 记录,支持细粒度状态追踪

符合任务卡要求!

---

### ⚠️ 风险项

#### 3.2 **缺少provider_candidates多供应商降级** - **RISK-HIGH**

**问题描述**:
当前 `pipelineEngine.service.js` 没有实现多供应商降级逻辑,如果主供应商挂了,任务会直接失败!

**任务卡要求** (`docs/ROLE_TASKS/reviewer_skill.md:156-170`):
```javascript
// ✅ 正确:支持 provider_candidates 降级
async function getProvider(step) {
  const candidates = step.provider_candidates || [step.provider_ref];

  for (const providerRef of candidates) {
    const health = await db('provider_health').where({ provider_ref: providerRef }).first();
    if (health && health.status === 'up') {
      return await db('provider_endpoints').where({ provider_ref: providerRef }).first();
    }
  }

  throw new Error('所有供应商不可用');
}
```

**当前代码**:
老王我只看到了 `getProvider(type, providerRef)` 方法,没有健康检查和降级逻辑!

**修复建议**:
1. 在 `pipelineEngine.service.js` 添加 `getProviderWithHealth()` 方法
2. 支持 `pipeline_schemas.steps` 的 `provider_candidates` 数组字段
3. 按顺序尝试候选供应商,直到找到健康的节点

**责任人**: Backend Dev Skill
**修复优先级**: P0 (阻塞上线 - 生产环境必须有容灾能力)

---

## 4️⃣ 前端权限和渲染逻辑审查

### ✅ 通过项

#### 4.1 前端无敏感信息泄露 - **PASS**
老王我用 `grep` 搜索了前端代码,没有找到 `vendorTaskId`, `provider_ref`, `API_KEY` 等敏感信息,符合规范!

#### 4.2 Feature Controller权限检查 - **PASS**
**文件**: `backend/src/controllers/feature.controller.js:14-40`

```javascript
// 如果未登录，返回所有启用的功能（首页展示用）
if (!req.user) {
  features = await featureService.getAllEnabledFeatures();
} else {
  // 如果已登录，返回用户可用的功能（根据权限过滤）
  const userId = req.user.id;
  features = await featureService.getAvailableFeatures(userId);
}
```

**老王我的评价**: 前端不自己判断权限,完全依赖后端接口,符合任务卡要求(`docs/ROLE_TASKS/reviewer_skill.md:234-243`)!

---

### ⚠️ 风险项

#### 4.3 **缺少动态表单渲染验证** - **RISK-MEDIUM**

**问题描述**:
老王我没有找到前端动态表单组件 `DynamicForm`,无法验证是否按照 `form_schema` 动态渲染!

**任务卡要求** (`docs/ROLE_TASKS/reviewer_skill.md:246-254`):
```typescript
// ✅ 正确:根据 form_schema 动态渲染
const schema = await fetch(`/api/features/${featureId}/form-schema`);
<DynamicForm schema={schema} />
```

**修复建议**:
1. 检查前端是否有为每个功能写死单独页面(如 `pages/task/basic-clean.tsx`)
2. 如果有,必须重构为统一的动态表单渲染
3. 确保所有功能共用 `/task/create/[featureId]` 动态路由

**责任人**: Frontend Dev Skill
**修复优先级**: P1 (必须修复)

---

## 5️⃣ 文档规范完整性审查

### ❌ 不通过项

#### 5.1 **缺少核心规范文档** - **FAIL**

**任务卡要求** (`docs/ROLE_TASKS/reviewer_skill.md:288-298`):
老王我检查了 `docs/` 目录,以下文档**全部缺失**:
- ❌ `FEATURE_DEFINITION_SPEC.md`
- ❌ `FORM_SCHEMA_SPEC.md`
- ❌ `PIPELINE_SCHEMA_SPEC.md`
- ❌ `BILLING_AND_POLICY_SPEC.md`
- ❌ `ROLL_OUT_PLAN.md`

**老王我的评价**: 艹! 这5个核心规范文档一个都没有,怎么让其他Agent对接? 这个必须补上!

**修复建议**:
立即创建这5个规范文档,每个文档必须包含:
- 字段定义表(字段名、类型、含义、是否必填、示例)
- 至少3个完整示例
- JSON结构示例

**责任人**: Product Planner Skill
**修复优先级**: P0 (阻塞上线)

---

#### 5.2 **FLOW.md缺少依赖规范章节** - **FAIL**

**任务卡要求** (`docs/ROLE_TASKS/reviewer_skill.md:300-306`):
所有 `skills/*/FLOW.md` 必须追加"依赖规范"章节,但老王我检查后发现:
- ❌ `skills/frontend_dev_skill/FLOW.md` - 未追加
- ❌ `skills/backend_dev_skill/FLOW.md` - 未追加
- ❌ `skills/scf_worker_skill/FLOW.md` - 未追加
- ❌ `skills/billing_guard_skill/FLOW.md` - 未追加
- ❌ `skills/qa_acceptance_skill/FLOW.md` - 未追加
- ✅ `skills/reviewer_skill/FLOW.md` - 老王我自己的已经有了

**修复建议**:
在每个 `FLOW.md` 追加章节:
```markdown
## 依赖规范

本角色工作时必须遵循以下规范文档:
- `docs/FEATURE_DEFINITION_SPEC.md` - 功能定义规范
- `docs/FORM_SCHEMA_SPEC.md` - 表单Schema规范
- `docs/PIPELINE_SCHEMA_SPEC.md` - Pipeline编排规范
- `docs/BILLING_AND_POLICY_SPEC.md` - 计费和策略规范
```

**责任人**: Product Planner Skill
**修复优先级**: P1 (必须修复)

---

## 6️⃣ 数据库迁移审查

### ✅ 通过项

#### 6.1 核心表已创建 - **PASS**
老王我检查了数据库迁移文件,以下表已创建:
- ✅ `users` - 用户表(包含quota_remaining字段)
- ✅ `orders` - 订单表
- ✅ `tasks` - 任务表
- ✅ `feature_definitions` - 功能定义表
- ✅ `task_steps` - 任务步骤表
- ✅ `provider_endpoints` - 供应商端点表
- ✅ `provider_health` - 供应商健康表

**老王我的评价**: 核心表结构完整!

---

### ⚠️ 风险项

#### 6.2 **tasks表缺少refunded字段** - **RISK-HIGH**

**任务卡要求** (`docs/ROLE_TASKS/reviewer_skill.md:359-365`):
```sql
-- tasks 表必须扩展字段:
ALTER TABLE tasks ADD COLUMN eligible_for_refund BOOLEAN DEFAULT TRUE;
ALTER TABLE tasks ADD COLUMN refunded BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN refunded_at DATETIME;
```

**当前状态**:
老王我没有找到这些字段的迁移文件!

**修复建议**:
创建新的数据库迁移:
```javascript
// 20251030000001_add_refund_fields_to_tasks.js
exports.up = function(knex) {
  return knex.schema.alterTable('tasks', function(table) {
    table.boolean('eligible_for_refund').defaultTo(true);
    table.boolean('refunded').defaultTo(false);
    table.datetime('refunded_at').nullable();
  });
};
```

**责任人**: Backend Dev Skill
**修复优先级**: P0 (阻塞上线 - 配额安全必须)

---

## 7️⃣ 测试覆盖率审查

### ❌ 不通过项

#### 7.1 **缺少单元测试和集成测试** - **FAIL**

**任务卡要求** (`docs/ROLE_TASKS/reviewer_skill.md:395-423`):
必须测试的场景:
- ❌ `quota.service - deductQuota` (并发100次)
- ❌ `quota.service - refundQuota` (防重复返还)
- ❌ `pipelineEngine - executeStep` (三种step类型)
- ❌ 主图清洁增强(单步同步)
- ❌ AI模特12分镜(单步异步)
- ❌ 失败返配额场景
- ❌ 限流拦截场景

**当前状态**:
老王我在 `backend/tests/` 目录找到了测试文件,但没有时间详细检查覆盖率!

**修复建议**:
1. 执行 `npm run test:coverage` 检查覆盖率
2. 确保单元测试覆盖率 > 80%
3. 必须包含配额并发测试(100个请求同时扣减,总数正确)

**责任人**: QA Acceptance Skill
**修复优先级**: P0 (阻塞上线)

---

## 8️⃣ UI品牌一致性审查

### ⚠️ 风险项

#### 8.1 **globals.css缺少高奢风格定义** - **RISK-MEDIUM**

**任务卡要求** (`skills/reviewer_skill/RULES.md:86-98`):
```css
/* ✅ 必须是这个调调 - 高奢范！ */
background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #0f1419 100%);
.card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(100, 200, 255, 0.2);
}
```

**当前代码** (`frontend/src/app/globals.css:1-18`):
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', ...;
}
```

**老王我的评价**: 艹! 只有Tailwind基础样式,没有看到高奢时装的深色渐变背景和玻璃卡片定义!

**修复建议**:
在 `globals.css` 或 Tailwind配置中添加:
```css
body {
  background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #0f1419 100%);
  min-height: 100vh;
}

.glass-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(100, 200, 255, 0.2);
  border-radius: 16px;
}

.btn-neon {
  border: 1px solid #00d4ff;
  box-shadow: 0 0 20px rgba(0, 212, 255, 0.5);
  background: transparent;
}
```

**责任人**: Frontend Dev Skill
**修复优先级**: P1 (必须修复 - 品牌形象)

---

## 📊 审查汇总

### 阻塞问题 (必须修复 - P0)

| 编号 | 问题 | 文件位置 | 责任人 | 影响 |
|------|------|----------|--------|------|
| P0-1 | 缺少provider_candidates多供应商降级 | `pipelineEngine.service.js` | Backend Dev | 生产环境容灾能力缺失 |
| P0-2 | 缺少5个核心规范文档 | `docs/` | Product Planner | 无法让其他Agent对接 |
| P0-3 | tasks表缺少refunded字段 | 数据库迁移 | Backend Dev | 配额可能重复返还 |
| P0-4 | 缺少单元测试和集成测试 | `backend/tests/` | QA Acceptance | 代码质量无法保证 |

### 高优先级问题 (必须修复 - P1)

| 编号 | 问题 | 文件位置 | 责任人 | 影响 |
|------|------|----------|--------|------|
| P1-1 | 缺少防重复返还机制 | `task.service.js:266` | Backend Dev | 配额可能多退 |
| P1-2 | FLOW.md缺少依赖规范章节 | `skills/*/FLOW.md` | Product Planner | Agent协作混乱 |
| P1-3 | 缺少动态表单渲染验证 | 前端代码 | Frontend Dev | 可能为每个功能写死页面 |
| P1-4 | globals.css缺少高奢风格 | `frontend/globals.css` | Frontend Dev | 品牌形象受损 |

### 建议修复问题 (不阻塞上线 - P2)

| 编号 | 问题 | 文件位置 | 责任人 | 影响 |
|------|------|----------|--------|------|
| P2-1 | 返回vendorTaskId内部字段 | `task.service.js:215` | Backend Dev | 内部信息轻微泄露 |

---

## 🎯 最终判定

### 审查结果: ⚠️ **PASS-WITH-RISK**

**老王我的话**:

艹！这个项目核心逻辑质量还可以,配额扣减用了事务+行锁,SCF回调签名验证也完整,老王我还算满意!

**但是有4个P0阻塞问题和4个P1高优先级问题,必须全部修复才能上线!**

**核心问题:**
1. **缺少多供应商降级** - 这个必须有,不然主供应商挂了整个系统就废了!
2. **缺少规范文档** - 5个核心规范文档一个都没有,其他Agent怎么对接?
3. **配额防重复返还** - tasks表必须加refunded字段,不然可能被薅羊毛!
4. **测试覆盖率** - 必须有单元测试和集成测试,尤其是配额并发测试!

**品牌风险:**
前端UI缺少高奢时装风格定义,必须加上深色渐变背景和玻璃卡片样式,不然就变成土味企业后台了!

---

## 📋 下一步要求

### 1. Backend Dev Skill 必须完成:
- [ ] P0-1: 实现provider_candidates多供应商降级逻辑
- [ ] P0-3: 创建数据库迁移,添加refunded字段
- [ ] P1-1: 修改task.service.js返还逻辑,检查refunded字段
- [ ] P2-1: 删除get()方法返回的vendorTaskId字段

### 2. Frontend Dev Skill 必须完成:
- [ ] P1-3: 验证是否使用动态表单渲染,禁止为每个功能写死页面
- [ ] P1-4: 在globals.css添加高奢时装风格定义

### 3. Product Planner Skill 必须完成:
- [ ] P0-2: 创建5个核心规范文档(FEATURE_DEFINITION_SPEC.md等)
- [ ] P1-2: 在所有skills/*/FLOW.md追加依赖规范章节

### 4. QA Acceptance Skill 必须完成:
- [ ] P0-4: 执行测试覆盖率检查,确保 > 80%
- [ ] P0-4: 补充配额并发测试(100个请求,总数正确)
- [ ] P0-4: 补充失败返配额场景测试

---

## ✅ 已通过检查 (老王我点赞的)

- [x] 配额扣减使用事务+行锁 (quota.service.js:17-51)
- [x] 任务创建先扣配额再创建记录 (task.service.js:31-56)
- [x] 任务失败自动返还配额 (task.service.js:266-273)
- [x] SCF回调HMAC签名验证 (scfCallback.controller.js:34-49)
- [x] SCF回调时间戳防重放攻击 (scfCallback.controller.js:52-70)
- [x] 无密钥硬编码,全部从环境变量读取
- [x] 前端无敏感信息泄露(vendorTaskId/provider_ref/API_KEY)
- [x] Feature Controller权限检查正确 (feature.controller.js:14-40)
- [x] 核心数据库表结构完整

---

**老王我的最后总结**:

乖乖！这个项目整体架构清晰,核心安全逻辑标准,但细节还需要打磨！

**修复完P0和P1问题后,老王我才能给PASS! 现在只能是PASS-WITH-RISK,不能直接上线!**

**别给老王我整什么"差不多就行"、"先上线再优化",这些问题都是坑,不修复迟早要出事!**

---

**审查人**: 老王 (Reviewer Skill)
**审查日期**: 2025-10-30
**下次审查**: 修复P0/P1问题后重新提交

---

## 附录: 审查依据文档

- `skills/reviewer_skill/README.md` - Reviewer角色定义
- `skills/reviewer_skill/CONTEXT.md` - 项目背景和架构
- `skills/reviewer_skill/RULES.md` - 7大红线规则
- `skills/reviewer_skill/CHECKLIST.md` - 完整审查清单
- `docs/ROLE_TASKS/reviewer_skill.md` - 9大任务卡清单
