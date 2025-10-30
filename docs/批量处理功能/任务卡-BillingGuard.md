# 任务卡:计费审查 - 批量处理功能

> **负责技能**:billing_guard_skill
> **功能模块**:批量处理功能
> **任务类型**:计费与配额策略审查
> **优先级**:P0

---

## 任务目标

审查批量处理功能的计费策略、配额扣减/返还逻辑、限流策略,确保财务安全和业务模型不被破坏。

---

## 审查范围

### ✅ 必须审查
- 批量任务配额扣减逻辑
- 批量任务配额返还逻辑
- 限流策略配置
- 前端配额消耗提示
- 重试失败项的配额扣减

### ❌ 不在审查范围
- UI样式和布局
- 代码性能优化
- 单张任务逻辑(已有审查)

---

## 核心审查点

### 1. 配额扣减规则

**✅ 合格标准**:
- 批量任务按"实际图片数量×单价"扣配额
- 在事务中扣配额,使用`FOR UPDATE`行锁
- 扣配额前检查配额是否足够
- 扣配额和创建任务记录在同一事务中

**❌ 不合格场景**:
- 批量任务享受折扣(如10张图只扣9配额)
- 前端传入配额消耗数量
- 非事务环境扣配额
- 扣配额后任务创建失败但配额未返还

**审查代码**:
```javascript
// backend/src/services/task.service.js - createBatchTask方法

// ✅ 正确示例
const quotaCost = inputImages.length * feature.quota_cost; // 后端计算
await db.transaction(async (trx) => {
  await quotaService.deduct(userId, quotaCost, trx); // 事务中扣配额
  await trx('tasks').insert({...}); // 事务中创建任务
});

// ❌ 错误示例
const { quotaCost } = req.body; // ❌ 前端传入配额(严重安全漏洞)
await quotaService.deduct(userId, quotaCost); // ❌ 非事务环境
await db('tasks').insert({...}); // ❌ 不在同一事务
```

### 2. 配额返还规则

**✅ 合格标准**:
- 只返还失败的图片配额(N张失败=N配额)
- 检查`eligible_for_refund`和`refunded`字段,防止重复返还
- 在事务中返还配额
- 返还后标记`refunded=true`和`refunded_at`

**❌ 不合格场景**:
- 返还配额超过实际扣减数量
- 未检查`refunded`字段,导致重复返还
- 成功的图片也返还配额

**审查代码**:
```javascript
// backend/src/services/batchProcessor.service.js - refundFailedItems方法

// ✅ 正确示例
const quotaToRefund = failedCount * feature.quota_cost; // 只返还失败项
await quotaService.refund(taskId, userId, quotaToRefund, reason); // 内部检查refunded字段

// ❌ 错误示例
const quotaToRefund = task.batch_total * feature.quota_cost; // ❌ 返还全部配额(包括成功的)
```

### 3. 限流策略

**✅ 合格标准**:
- 单次批量最多50张图片(硬限制)
- 每小时最多5个批量任务
- 每天最多20个批量任务
- 批量任务也计入总任务数限流

**❌ 不合格场景**:
- 无限制批量上传
- 批量任务不计入限流
- 限流策略可被前端绕过

**审查配置**:
```json
// feature_definitions.rate_limit_policy

// ✅ 正确配置
{
  "max_per_hour": 5,
  "max_per_day": 20,
  "max_images_per_batch": 50
}

// ❌ 错误配置
{
  "max_images_per_batch": 1000 // ❌ 单次批量1000张,服务器会崩溃
}
```

### 4. 前端配额消耗提示

**✅ 合格标准**:
- 批量上传时实时显示"N张图 × 单价 = 总配额"
- 提交前确认弹窗显示配额消耗和剩余
- 配额不足时禁用提交按钮并提示
- 重试失败项时提示将扣减X配额

**❌ 不合格场景**:
- 不显示配额消耗
- 允许配额不足时提交
- 配额计算错误

**审查前端代码**:
```tsx
// frontend/src/components/BatchImageUploader.tsx

// ✅ 正确示例
<div className="quota-preview">
  已选择: {images.length}张图片 × {quotaCostPerImage}配额 = {images.length * quotaCostPerImage}配额
</div>

// ✅ 提交确认弹窗
Modal.confirm({
  title: '确认批量生成',
  content: (
    <div>
      <p>本次操作将消耗 <strong>{quotaCost}</strong> 配额</p>
      <p>当前剩余: {quotaRemaining}配额</p>
      <p>处理后剩余: {quotaRemaining - quotaCost}配额</p>
    </div>
  )
});
```

### 5. 重试失败项配额扣减

**✅ 合格标准**:
- 重试前检查配额是否足够
- 按失败项数量扣配额(5张失败=5配额)
- 重试成功不返还配额,重试失败才返还

**❌ 不合格场景**:
- 重试不扣配额(免费重试)
- 重试成功也返还配额
- 重试超过实际失败数量

---

## 财务安全检查

### 检查1:配额扣减≥配额返还

```sql
-- 验证配额一致性
SELECT
  t.id AS task_id,
  t.batch_total,
  t.batch_success,
  t.batch_failed,
  (t.batch_total * f.quota_cost) AS expected_deduct,
  (t.batch_failed * f.quota_cost) AS expected_refund,
  t.refunded
FROM tasks t
JOIN feature_definitions f ON t.feature_id = f.feature_id
WHERE t.is_batch = true;

-- 预期结果:
-- expected_deduct - expected_refund = 实际消耗配额
-- refunded字段正确标记
```

### 检查2:批量任务总配额≤用户配额

```sql
-- 批量任务不能导致配额变成负数
SELECT
  u.id AS user_id,
  u.quota_remaining,
  COUNT(t.id) AS batch_tasks,
  SUM(t.batch_total * f.quota_cost) AS total_quota_cost
FROM users u
LEFT JOIN tasks t ON u.id = t.userId
LEFT JOIN feature_definitions f ON t.feature_id = f.feature_id
WHERE t.is_batch = true
GROUP BY u.id;

-- 预期结果:total_quota_cost不能超过用户历史配额总和
```

### 检查3:重复返还防护

```sql
-- 检查是否存在重复返还
SELECT
  id,
  userId,
  refunded,
  refunded_at,
  batch_failed
FROM tasks
WHERE is_batch = true
  AND refunded = true
  AND batch_failed = 0;

-- 预期结果:0行(失败数为0的任务不应该返还配额)
```

---

## 业务模型合规性

### 1. 会员+配额模式不变

**✅ 合格**:
- 批量处理仍需会员权限
- 批量处理仍需配额
- 批量处理不享受折扣

**❌ 不合格**:
- 非会员可以批量处理
- 批量处理免费
- 批量处理享受折扣(如买10送2)

### 2. 限流保护服务器

**✅ 合格**:
- 单次批量限制在服务器承受范围内(50张)
- 每小时批量任务数限制
- 并发处理数限制(5张/次)

**❌ 不合格**:
- 无限制批量上传
- 无并发控制
- 无限流策略

---

## 审查清单

### 配额扣减审查
- [ ] 批量任务配额计算公式正确(N×单价)
- [ ] 配额扣减在事务中执行
- [ ] 使用`FOR UPDATE`行锁
- [ ] 前端不传入配额数量
- [ ] 配额不足时返回403错误

### 配额返还审查
- [ ] 只返还失败项配额
- [ ] 检查`eligible_for_refund`字段
- [ ] 检查`refunded`字段防止重复返还
- [ ] 返还后标记`refunded=true`
- [ ] 返还在事务中执行

### 限流策略审查
- [ ] 单次批量最多50张
- [ ] 每小时最多5个批量任务
- [ ] 每天最多20个批量任务
- [ ] 前端校验图片数量限制

### 前端提示审查
- [ ] 批量上传显示配额消耗
- [ ] 提交确认弹窗显示详细配额
- [ ] 配额不足时禁用提交按钮
- [ ] 重试失败项提示配额消耗

### 重试功能审查
- [ ] 重试前检查配额
- [ ] 重试按失败项数量扣配额
- [ ] 重试成功不返还配额

---

## 禁止事项

### ❌ 严格禁止
1. 批量处理享受配额折扣
2. 前端传入配额消耗数量
3. 非事务环境扣减/返还配额
4. 跳过配额检查
5. 批量任务绕过限流
6. 重复返还配额

---

## 审查结果模板

```markdown
## 批量处理功能 - 计费审查报告

### 审查日期
2025-10-XX

### 审查结论
[ ] ✅ 通过 - 无问题
[ ] ⚠️ 通过(有建议) - 有改进建议但不影响上线
[ ] ❌ 不通过 - 有严重问题必须修复

### 发现问题

#### P0(阻塞上线)
- 无

#### P1(建议修复)
- 建议在前端增加配额消耗动画提示

#### P2(可选优化)
- 可考虑未来推出"批量VIP会员",单次支持100张

### 审查通过签字
Billing Guard: [签名]
日期: 2025-10-XX
```

---

## 预计工作量

**预计时间**:0.5天

**细分**:
- 代码审查:2小时
- SQL验证查询:1小时
- 编写审查报告:1小时

---

**任务卡结束**
