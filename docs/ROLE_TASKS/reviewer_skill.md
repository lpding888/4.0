# Reviewer Skill - 任务卡清单

## 任务1:代码审查 - 配额扣减和返还逻辑

**产出物**:
- PR 审查评论
- CHANGELOG.md 更新

**执行内容**:

### 1.1 必须检查的代码模式

**配额扣减检查**:
```javascript
// ✅ 正确:使用事务+行锁
await db.transaction(async (trx) => {
  const user = await trx('users').where({ id: userId }).forUpdate().first();
  // 检查余额
  await trx('users').where({ id: userId }).update({ quota_remaining: ... });
});

// ❌ 错误:没有行锁
const user = await db('users').where({ id: userId }).first();
await db('users').where({ id: userId }).update({ quota_remaining: ... });

// ❌ 错误:在事务外修改配额
await db('users').where({ id: userId }).increment('quota_remaining', amount);
```

**返还配额检查**:
```javascript
// ✅ 正确:检查 eligible_for_refund 和 refunded
if (task.eligible_for_refund && !task.refunded) {
  await refundQuota(taskId);
}

// ❌ 错误:允许重复返还
await refundQuota(taskId); // 没有检查 refunded 字段

// ❌ 错误:基于主观评价返还
if (user.feedback === 'bad') {
  await refundQuota(taskId); // 禁止
}
```

**任务创建流程检查**:
```javascript
// ✅ 正确顺序:
// 1. 校验权限
// 2. 校验限流
// 3. 预扣配额(事务+行锁)
// 4. 创建任务记录
// 5. 异步执行 pipeline

// ❌ 错误顺序:
// 1. 创建任务
// 2. 执行完成后再扣配额 (禁止)
```

**验收标准**:
- 所有配额操作必须使用行锁
- 扣减和返还在同一事务中
- 不允许基于主观评价返还配额
- 任务创建必须先扣配额

**禁止合并的情况**:
- 配额扣减不使用 `FOR UPDATE`
- 允许重复返还配额
- 跳过配额检查直接创建任务
- 在事务外修改 quota_remaining

---

## 任务2:代码审查 - 敏感信息和硬编码检查

**产出物**:
- 安全检查报告

**执行内容**:

### 2.1 禁止模式检查

**密钥硬编码检查**:
```javascript
// ❌ 禁止:硬编码密钥
const apiKey = 'sk-abc123def456';
const secret = 'my-secret-key';

// ✅ 正确:从环境变量读取
const apiKey = process.env.RUNNINGHUB_API_KEY;
const secret = process.env.INTERNAL_CALLBACK_SECRET;
```

**域名硬编码检查**:
```javascript
// ❌ 禁止:硬编码生产域名
const url = 'https://api.runninghub.com/v1/workflow';
const cosUrl = 'https://my-bucket-1234567890.cos.ap-guangzhou.myqcloud.com';

// ✅ 正确:从配置读取
const url = config.providers.runninghub.endpoint;
const cosUrl = `https://${process.env.COS_BUCKET}.cos.${process.env.COS_REGION}.myqcloud.com`;
```

**价格硬编码检查**:
```javascript
// ❌ 禁止:在前端硬编码价格
const price = 99; // 禁止

// ✅ 正确:从后端接口获取
const { price } = await fetch('/api/membership/plans/pro');
```

**内部字段泄露检查**:
```javascript
// ❌ 禁止:返回内部字段给前端
res.json({
  task_id: task.id,
  vendor_task_id: task.vendor_task_id, // 禁止
  provider_ref: task.provider_ref, // 禁止
  internal_status: task.internal_status // 禁止
});

// ✅ 正确:只返回必要字段
res.json({
  task_id: task.id,
  status: task.status,
  artifacts: task.artifacts
});
```

**验收标准**:
- 代码中无密钥硬编码
- 代码中无域名硬编码
- 前端代码无价格硬编码
- 接口响应不包含内部字段

**禁止合并的情况**:
- 发现任何密钥硬编码
- 发现真实域名硬编码
- 前端展示 vendorTaskId 或 provider_ref
- credentials 明文存储
- 前端硬编码价格(必须从后端接口获取)

---

## 任务3:代码审查 - Pipeline 执行逻辑

**产出物**:
- Pipeline 逻辑审查报告

**执行内容**:

### 3.1 必须检查的逻辑

**多供应商降级检查**:
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

// ❌ 错误:硬编码单一 provider
const provider = await db('provider_endpoints').where({ provider_ref: 'runninghub' }).first();
```

**Step 失败处理检查**:
```javascript
// ✅ 正确:任何 step 失败立即中断并返还配额
try {
  await executeStep(step);
} catch (error) {
  await handleTaskFailure(taskId, stepId, error.message);
  return; // 中断执行
}

// ❌ 错误:step 失败后继续执行
try {
  await executeStep(step);
} catch (error) {
  logger.error(error);
  // 没有中断,继续执行下一个 step (禁止)
}
```

**SCF 回调逻辑检查**:
```javascript
// ✅ 正确:SCF 只能通过回调更新状态
// 在 SCF 中:
await axios.post('/api/internal/tasks/:taskId/steps/:stepIndex/callback', {
  status: 'success',
  output_url: finalUrl
}, {
  headers: { 'X-Internal-Signature': signature }
});

// ❌ 错误:SCF 直接操作数据库
await db('task_steps').where({ id: stepId }).update({ output: ... }); // 禁止
```

**验收标准**:
- PipelineEngine 支持多供应商降级
- step 失败时立即中断并返还配额
- SCF 只能通过回调接口更新状态
- 不跳过任何 step

**禁止合并的情况**:
- 硬编码 provider_ref,不支持降级
- step 失败后继续执行
- SCF 直接操作数据库
- 跳过 step 执行

---

## 任务4:代码审查 - 前端权限和渲染逻辑

**产出物**:
- 前端代码审查报告

**执行内容**:

### 4.1 权限检查

**前端不自行判断权限**:
```typescript
// ❌ 错误:前端本地判断权限
if (user.membershipLevel === 'PRO') {
  showFeature('model_pose12'); // 禁止
}

// ✅ 正确:只展示后端返回的功能列表
const features = await fetch('/api/features?enabled=true');
features.forEach(feature => showFeature(feature));
```

**动态表单渲染检查**:
```typescript
// ❌ 错误:为每个功能写死单独页面
// pages/task/basic-clean.tsx
// pages/task/model-pose12.tsx

// ✅ 正确:根据 form_schema 动态渲染
const schema = await fetch(`/api/features/${featureId}/form-schema`);
<DynamicForm schema={schema} />
```

**内部字段展示检查**:
```typescript
// ❌ 错误:展示内部字段
<div>Vendor Task ID: {task.vendor_task_id}</div> // 禁止
<div>Provider: {task.provider_ref}</div> // 禁止

// ✅ 正确:只展示必要信息
<div>Task ID: {task.task_id}</div>
<div>Status: {task.status}</div>
```

**验收标准**:
- 前端不本地判断权限
- 使用动态表单渲染,不写死页面
- 不展示内部字段

**禁止合并的情况**:
- 前端本地判断 plan_required
- 为每个功能写死单独页面
- 展示 vendorTaskId 或 provider_ref

---

## 任务5:文档审查 - 规范完整性检查

**产出物**:
- 文档审查报告

**执行内容**:

### 5.1 必须存在的文档

**docs/ 目录必须包含**:
- [ ] `FEATURE_DEFINITION_SPEC.md`
- [ ] `FORM_SCHEMA_SPEC.md`
- [ ] `PIPELINE_SCHEMA_SPEC.md`
- [ ] `BILLING_AND_POLICY_SPEC.md`
- [ ] `ROLL_OUT_PLAN.md`

**每个文档必须包含**:
- 字段定义表(字段名、类型、含义、是否必填、示例)
- 至少 3 个完整示例
- JSON 结构示例

**skills/*/FLOW.md 必须追加**:
- [ ] `skills/frontend_dev_skill/FLOW.md` - 依赖规范章节
- [ ] `skills/backend_dev_skill/FLOW.md` - 依赖规范章节
- [ ] `skills/scf_worker_skill/FLOW.md` - 依赖规范章节
- [ ] `skills/billing_guard_skill/FLOW.md` - 依赖规范章节
- [ ] `skills/qa_acceptance_skill/FLOW.md` - 依赖规范章节
- [ ] `skills/reviewer_skill/FLOW.md` - 依赖规范章节

### 5.2 禁止内容检查

**不允许出现的内容**:
- [ ] qa_profile_ref (已删除)
- [ ] 自动质检逻辑
- [ ] 基于画质的自动返配额
- [ ] "TODO" 或 "待定义" 占位符

**验收标准**:
- 所有规范文档完整
- 所有示例完整可用
- 所有 FLOW.md 已追加对接说明
- 无禁止内容

**禁止合并的情况**:
- 文档缺失
- 示例不完整
- 存在 TODO 占位符
- 包含 qa_profile_ref

---

## 任务6:数据库迁移审查

**产出物**:
- 数据库迁移审查报告

**执行内容**:

### 6.1 必须存在的表和字段

**必须创建的表**:
- [ ] feature_definitions
- [ ] form_schemas
- [ ] pipeline_schemas
- [ ] task_steps
- [ ] provider_endpoints
- [ ] provider_health
- [ ] assets
- [ ] quota_logs

**feature_definitions 必须包含字段**:
- [ ] feature_id (PK)
- [ ] access_scope (新增,取值 plan/whitelist)
- [ ] allowed_accounts (新增,TEXT 类型)
- [ ] is_enabled
- [ ] plan_required
- [ ] quota_cost
- [ ] rate_limit_policy
- [ ] save_to_asset_library

**tasks 表必须扩展字段**:
- [ ] feature_id
- [ ] input_data (JSON)
- [ ] artifacts (JSON)
- [ ] eligible_for_refund
- [ ] refunded
- [ ] refunded_at

**pipeline_schemas.steps 必须支持字段**:
- [ ] provider_candidates (数组,多供应商降级)
- [ ] polling (轮询配置)
- [ ] timeout_seconds
- [ ] retry

**验收标准**:
- 所有表都已创建
- 所有关键字段都已添加
- 外键约束正确设置
- 索引已创建(user_id, created_at 等)

**禁止合并的情况**:
- 缺少任何必须表
- 缺少关键字段(access_scope、provider_candidates)
- credentials 明文存储

---

## 任务7:测试覆盖率审查

**产出物**:
- 测试覆盖率报告

**执行内容**:

### 7.1 必须测试的场景

**单元测试**:
- [ ] quota.service - deductQuota (并发 100 次,配额正确)
- [ ] quota.service - refundQuota (防重复返还)
- [ ] quota.service - checkRateLimit (限流策略)
- [ ] pipelineEngine - executeStep (三种 step 类型)
- [ ] pipelineEngine - getProviderWithHealth (多供应商降级)

**集成测试**:
- [ ] 主图清洁增强(单步同步)
- [ ] AI模特12分镜(单步异步)
- [ ] 上新合辑短片(多步 pipeline)
- [ ] 失败返配额场景
- [ ] 限流拦截场景
- [ ] 套餐权限场景
- [ ] 白名单权限场景

**性能测试**:
- [ ] 并发 100 个请求扣配额,配额总数正确
- [ ] P95 响应时间 < 500ms

**验收标准**:
- 单元测试覆盖率 > 80%
- 集成测试覆盖 3 个完整功能流程
- 性能测试通过

**禁止合并的情况**:
- 单元测试覆盖率 < 80%
- 缺少集成测试
- 并发测试失败(配额总数不对)

---

## 任务8:安全审查 - SCF 回调签名

**产出物**:
- 安全审查报告

**执行内容**:

### 8.1 回调签名检查

**后端签名验证**:
```javascript
// ✅ 正确:验证签名和时间戳
function verifyInternalSignature(req, res, next) {
  const signature = req.headers['x-internal-signature'];
  const timestamp = req.headers['x-timestamp'];
  
  // 防重放攻击
  if (Math.abs(Date.now() - timestamp * 1000) > 5 * 60 * 1000) {
    return res.status(401).json({ error: '签名已过期' });
  }
  
  // 验证签名
  const expectedSignature = crypto.createHmac('sha256', secret)
    .update(`${taskId}${stepIndex}${timestamp}`)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    return res.status(401).json({ error: '签名验证失败' });
  }
  
  next();
}

// ❌ 错误:不验证签名
// 直接允许回调 (禁止)
```

**SCF 签名发送**:
```javascript
// ✅ 正确:SCF 发送签名
const timestamp = Math.floor(Date.now() / 1000);
const signature = crypto.createHmac('sha256', secret)
  .update(`${taskId}${stepIndex}${timestamp}`)
  .digest('hex');

await axios.post(callbackUrl, data, {
  headers: {
    'X-Internal-Signature': signature,
    'X-Timestamp': timestamp
  }
});

// ❌ 错误:不发送签名
await axios.post(callbackUrl, data); // 禁止
```

**验收标准**:
- 后端回调接口验证签名
- 时间戳验证防重放攻击
- SCF 正确计算并发送签名

**禁止合并的情况**:
- 回调接口不验证签名
- 不验证时间戳(防重放攻击)
- SCF 不发送签名
- 签名算法与后端不一致(payload 拼接顺序/hex digest)

---

## 任务9:上线前最终检查清单

**产出物**:
- 上线检查清单(勾选完成)

**执行内容**:

### 9.1 功能完整性
- [ ] 管理后台能新增/编辑/删除功能卡片
- [ ] 管理后台能切换 is_enabled 开关
- [ ] 前端工作台动态展示功能卡片
- [ ] 前端动态表单正确渲染
- [ ] 任务创建流程完整(权限->限流->扣配额->执行)
- [ ] PipelineEngine 支持三种 step 类型
- [ ] SCF 回调正确更新任务状态
- [ ] 失败任务自动返还配额
- [ ] 素材库自动保存结果

### 9.2 多供应商冗余
- [ ] pipeline_schema 支持 provider_candidates
- [ ] provider_health 表有数据
- [ ] 定时任务更新 provider_health
- [ ] PipelineEngine 根据健康状态选择 provider
- [ ] 主 provider down 时自动切换

### 9.3 灰度/白名单
- [ ] feature_definitions 有 access_scope 字段
- [ ] access_scope=whitelist 时有 allowed_accounts(存储为 JSON 数组字符串)
- [ ] GET /api/features 按用户过滤(套餐+白名单)
- [ ] GET /api/features 过滤 deleted_at IS NULL
- [ ] 白名单功能只对指定账号可见
- [ ] Admin 后台 allowed_accounts 字段规范化(多行文本 → JSON 数组)

### 9.4 素材库
- [ ] assets 表已创建
- [ ] 成功任务自动写入 assets
- [ ] GET /api/assets 接口可用
- [ ] 前端 /library 页面可用

### 9.5 计费正确性
- [ ] 任务创建时预扣配额(事务+行锁)
- [ ] 失败时返还配额(事务+行锁)
- [ ] 限流策略正确拦截
- [ ] 套餐权限正确验证
- [ ] quota_logs 正确记录

### 9.6 安全性
- [ ] 无密钥硬编码
- [ ] 无域名硬编码
- [ ] 无价格硬编码(前端)
- [ ] credentials 加密存储
- [ ] SCF 回调签名验证(签名算法一致)
- [ ] 前端不展示内部字段
- [ ] Admin 后台 quota_cost=0 开启时红色警告

### 9.7 文档完整性
- [ ] 5 个规范文档完整
- [ ] 6 个 FLOW.md 已追加对接说明
- [ ] 无 TODO 占位符
- [ ] 无 qa_profile_ref

### 9.8 测试通过
- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试全部通过
- [ ] 性能测试通过
- [ ] 人工验收通过

**验收标准**:
- 所有清单项勾选完成
- 无阻塞问题

**禁止合并的情况**:
- 任何清单项未完成
- 存在阻塞问题

---

## 依赖规范

### 审查顺序
1. **文档审查**: 先检查文档是否完整
2. **数据库审查**: 检查表结构和字段
3. **代码审查**: 检查核心逻辑(配额/pipeline/回调)
4. **安全审查**: 检查密钥/签名/权限
5. **测试审查**: 检查测试覆盖率
6. **最终检查**: 勾选上线清单

### 阻塞问题定义
以下问题必须修复后才能合并:
- 配额扣减不使用行锁
- 密钥硬编码
- SCF 回调不验证签名
- credentials 明文存储
- 前端展示内部字段
- 文档缺失
- 测试覆盖率 < 80%

### 警告问题定义
以下问题建议修复,但不阻塞合并:
- 代码注释不足
- 变量命名不规范
- 日志级别不合理

### 审查反馈格式
```markdown
## 审查结果: PASS / FAIL / NEEDS_CHANGES

### 阻塞问题 (必须修复)
- [ ] 问题1: quota.service.js:45 - 配额扣减未使用行锁
- [ ] 问题2: config/provider.js:12 - 硬编码 API Key

### 警告问题 (建议修复)
- [ ] 问题1: task.controller.js:78 - 缺少注释

### 已通过检查
- [x] 文档完整性
- [x] 数据库结构
- [x] 测试覆盖率

### 审查意见
(详细说明)
```

### 合并要求
- 所有阻塞问题已修复
- 至少 1 个 reviewer approve
- 所有测试通过
- 文档完整

### 交付标准
- PR 审查完成
- 审查报告已归档
- CHANGELOG.md 已更新
- 上线清单已勾选完成
