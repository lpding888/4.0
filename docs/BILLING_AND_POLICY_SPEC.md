# BILLING_AND_POLICY_SPEC.md - 计费和策略规范

## 文档目的

本文档定义平台的计费模型、配额管理和限流策略规范，供所有技能包Agent参考。

**适用场景**：
- Product Planner设计新功能时，定义配额成本和限流策略
- Backend Dev实现配额扣减/返还时，理解事务和行锁机制
- Billing Guard审查时，验证是否符合商业模型（会员+配额）
- QA Acceptance测试时，验证配额逻辑是否正确
- Reviewer审查时，检查计费相关的P0/P1问题

**核心原则**：
✅ **会员+配额商业模型不可破坏**
✅ **所有配额操作必须使用事务+行锁**
✅ **防止重复返还配额**（`refunded`字段检查）
✅ **禁止基于主观评价返还配额**

---

## 核心概念

### 商业模型：会员+配额

**平台商业模式**：
- 用户购买会员 → 获得配额（quota）+ 有效期（30天）
- 每次创建任务 → 预扣配额（根据`quota_cost`）
- 任务成功 → 不返还配额
- 任务失败（系统原因） → 自动返还配额
- 配额用完或过期 → 无法创建新任务

**套餐等级**：
- **基础会员**（BASIC）：100次配额/月，可用所有`plan_required=null`的功能
- **PRO会员**：200次配额/月，可用所有`plan_required=PRO`及以下功能
- **PREMIUM会员**：500次配额/月，可用所有功能

**重要规则**：
- ❌ 不允许"免费无限用"
- ❌ 不允许"游客试用高成本功能"
- ❌ 不允许"基于用户主观评价（差评）返还配额"
- ✅ 只有系统故障/供应商失败时才返还配额

---

## 数据库表结构

### users 表（配额字段）

```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_id VARCHAR(50) UNIQUE NOT NULL COMMENT '账号ID',
  phone VARCHAR(20) COMMENT '手机号',

  -- 会员信息
  membership_plan VARCHAR(50) COMMENT '套餐等级（BASIC/PRO/PREMIUM）',
  membership_started_at TIMESTAMP NULL COMMENT '会员开始时间',
  membership_expires_at TIMESTAMP NULL COMMENT '会员到期时间',

  -- 配额信息
  quota_total INT DEFAULT 0 COMMENT '总配额（购买时设置）',
  quota_remaining INT DEFAULT 0 COMMENT '剩余配额',
  quota_last_reset_at TIMESTAMP NULL COMMENT '配额最后重置时间',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_membership_expires_at ON users(membership_expires_at);
CREATE INDEX idx_quota_remaining ON users(quota_remaining);
```

### quota_logs 表（配额操作日志）

```sql
CREATE TABLE quota_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL COMMENT '用户ID',
  feature_id VARCHAR(50) NOT NULL COMMENT '功能ID',
  task_id INT COMMENT '关联的任务ID（可为null）',
  operation ENUM('deduct', 'refund', 'reset', 'purchase') NOT NULL COMMENT '操作类型',
  amount INT NOT NULL COMMENT '变化量（正数=增加，负数=减少）',
  quota_before INT NOT NULL COMMENT '操作前配额',
  quota_after INT NOT NULL COMMENT '操作后配额',
  reason TEXT COMMENT '操作原因',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_user_id (user_id),
  INDEX idx_task_id (task_id),
  INDEX idx_operation (operation),
  INDEX idx_created_at (created_at)
);
```

### tasks 表（配额相关字段）

```sql
ALTER TABLE tasks ADD COLUMN eligible_for_refund BOOLEAN DEFAULT FALSE COMMENT '是否有资格返还配额';
ALTER TABLE tasks ADD COLUMN refunded BOOLEAN DEFAULT FALSE COMMENT '是否已返还配额';
ALTER TABLE tasks ADD COLUMN refunded_at TIMESTAMP NULL COMMENT '返还时间';
```

---

## 配额扣减流程（deductQuota）

### 核心规则

1. **预扣配额**：任务创建时立即扣减，不是任务完成后扣减
2. **使用事务+行锁**：防止并发超用
3. **校验会员状态**：必须是有效会员且配额充足
4. **记录日志**：所有配额操作必须记录到`quota_logs`

### 代码实现

```javascript
// backend/src/services/quota.service.js

async function deductQuota(userId, featureId, taskId) {
  return await db.transaction(async (trx) => {
    // 1. 使用FOR UPDATE行锁查询用户
    const user = await trx('users')
      .where({ id: userId })
      .forUpdate()  // ✅ 必须使用行锁
      .first();

    if (!user) {
      throw new Error('用户不存在');
    }

    // 2. 校验会员状态
    const now = new Date();
    if (!user.membership_expires_at || new Date(user.membership_expires_at) < now) {
      throw new Error('会员已过期，请续费');
    }

    // 3. 查询功能配额成本
    const feature = await trx('feature_definitions')
      .where({ feature_id: featureId })
      .first();

    if (!feature) {
      throw new Error('功能不存在');
    }

    const quotaCost = feature.quota_cost;

    // 4. 校验配额充足
    if (user.quota_remaining < quotaCost) {
      throw new Error(`配额不足，需要${quotaCost}次，剩余${user.quota_remaining}次`);
    }

    // 5. 扣减配额
    const quotaBefore = user.quota_remaining;
    const quotaAfter = quotaBefore - quotaCost;

    await trx('users')
      .where({ id: userId })
      .update({ quota_remaining: quotaAfter });

    // 6. 记录日志
    await trx('quota_logs').insert({
      user_id: userId,
      feature_id: featureId,
      task_id: taskId,
      operation: 'deduct',
      amount: -quotaCost,
      quota_before: quotaBefore,
      quota_after: quotaAfter,
      reason: `创建任务 ${taskId}，扣减配额 ${quotaCost} 次`
    });

    logger.info(`User ${userId}: Deducted ${quotaCost} quota for task ${taskId}`);

    return quotaAfter;
  });
}
```

---

## 配额返还流程（refundQuota）

### 核心规则

1. **只返还系统故障的任务**：`eligible_for_refund=true`
2. **防止重复返还**：检查`refunded=false`
3. **使用事务+行锁**：防止并发重复返还
4. **记录日志**：所有返还必须记录原因

### 代码实现

```javascript
// backend/src/services/quota.service.js

async function refundQuota(userId, featureId, taskId) {
  return await db.transaction(async (trx) => {
    // 1. 使用FOR UPDATE行锁查询任务
    const task = await trx('tasks')
      .where({ id: taskId })
      .forUpdate()  // ✅ 必须使用行锁
      .first();

    if (!task) {
      throw new Error('任务不存在');
    }

    // 2. 检查是否有资格返还
    if (!task.eligible_for_refund) {
      logger.warn(`Task ${taskId}: Not eligible for refund`);
      return;
    }

    // 3. 防止重复返还
    if (task.refunded) {
      logger.warn(`Task ${taskId}: Already refunded at ${task.refunded_at}`);
      return;
    }

    // 4. 使用FOR UPDATE行锁查询用户
    const user = await trx('users')
      .where({ id: userId })
      .forUpdate()
      .first();

    if (!user) {
      throw new Error('用户不存在');
    }

    // 5. 查询功能配额成本
    const feature = await trx('feature_definitions')
      .where({ feature_id: featureId })
      .first();

    const quotaCost = feature.quota_cost;

    // 6. 返还配额
    const quotaBefore = user.quota_remaining;
    const quotaAfter = quotaBefore + quotaCost;

    await trx('users')
      .where({ id: userId })
      .update({ quota_remaining: quotaAfter });

    // 7. 标记任务已返还
    await trx('tasks')
      .where({ id: taskId })
      .update({
        refunded: true,
        refunded_at: trx.fn.now()
      });

    // 8. 记录日志
    await trx('quota_logs').insert({
      user_id: userId,
      feature_id: featureId,
      task_id: taskId,
      operation: 'refund',
      amount: quotaCost,
      quota_before: quotaBefore,
      quota_after: quotaAfter,
      reason: `任务 ${taskId} 失败，返还配额 ${quotaCost} 次`
    });

    logger.info(`User ${userId}: Refunded ${quotaCost} quota for task ${taskId}`);

    return quotaAfter;
  });
}
```

---

## 限流策略（rate_limit_policy）

### 限流机制

**目的**：防止恶意刷量、保护系统资源

**限流维度**：
- **每小时限流**：`max_per_hour`
- **每天限流**：`max_per_day`
- **冷却时间**：`cooldown_seconds`（两次请求最小间隔）

### 限流配置示例

```json
{
  "max_per_hour": 10,
  "max_per_day": 50,
  "cooldown_seconds": 300
}
```

### 代码实现

```javascript
// backend/src/services/quota.service.js

async function checkRateLimit(userId, featureId) {
  // 1. 查询功能的限流策略
  const feature = await db('feature_definitions')
    .where({ feature_id: featureId })
    .first();

  if (!feature || !feature.rate_limit_policy) {
    return;  // 无限流策略，直接通过
  }

  const policy = JSON.parse(feature.rate_limit_policy);

  // 2. 查询最近任务数
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const recentTasks = await db('tasks')
    .where({ user_id: userId, feature_id: featureId })
    .where('created_at', '>', oneDayAgo)
    .select('created_at');

  // 3. 检查每小时限流
  if (policy.max_per_hour) {
    const tasksLastHour = recentTasks.filter(
      t => new Date(t.created_at) > oneHourAgo
    ).length;

    if (tasksLastHour >= policy.max_per_hour) {
      throw new Error(`每小时最多创建${policy.max_per_hour}个任务，请稍后再试`);
    }
  }

  // 4. 检查每天限流
  if (policy.max_per_day) {
    if (recentTasks.length >= policy.max_per_day) {
      throw new Error(`每天最多创建${policy.max_per_day}个任务，请明天再试`);
    }
  }

  // 5. 检查冷却时间
  if (policy.cooldown_seconds && recentTasks.length > 0) {
    const lastTaskTime = new Date(recentTasks[0].created_at);
    const cooldownEnd = new Date(lastTaskTime.getTime() + policy.cooldown_seconds * 1000);

    if (now < cooldownEnd) {
      const remainingSeconds = Math.ceil((cooldownEnd - now) / 1000);
      throw new Error(`请等待${remainingSeconds}秒后再试`);
    }
  }
}
```

---

## 任务创建流程（完整流程）

### 核心顺序

```
1. 校验权限（会员状态、套餐等级、白名单）
2. 校验限流（rate_limit_policy）
3. 预扣配额（事务+行锁）
4. 创建任务记录（eligible_for_refund=true）
5. 异步执行Pipeline
```

**⚠️ 重要：绝对不能先创建任务再扣配额！**

### 代码实现

```javascript
// backend/src/services/task.service.js

async function create(userId, featureId, inputData) {
  // 1. 校验权限
  await checkPermission(userId, featureId);

  // 2. 校验限流
  await quotaService.checkRateLimit(userId, featureId);

  // 3. 预扣配额（事务+行锁）
  const taskId = await db.transaction(async (trx) => {
    // 3.1 扣配额
    await quotaService.deductQuota(userId, featureId, null, trx);

    // 3.2 创建任务记录
    const [id] = await trx('tasks').insert({
      user_id: userId,
      feature_id: featureId,
      input_data: JSON.stringify(inputData),
      status: 'pending',
      eligible_for_refund: true,  // ✅ 设置为true
      refunded: false
    });

    // 3.3 更新task_id到quota_logs
    await trx('quota_logs')
      .where({ user_id: userId, task_id: null })
      .orderBy('id', 'desc')
      .limit(1)
      .update({ task_id: id });

    return id;
  });

  // 4. 异步执行Pipeline
  pipelineEngine.execute(taskId).catch(error => {
    logger.error(`Task ${taskId} pipeline failed:`, error);
    handleTaskFailure(taskId, error.message);
  });

  return taskId;
}

async function handleTaskFailure(taskId, errorMessage) {
  // 1. 标记任务失败
  await db('tasks').where({ id: taskId }).update({
    status: 'failed',
    error_reason: errorMessage
  });

  // 2. 返还配额（自动检查eligible_for_refund和refunded）
  const task = await db('tasks').where({ id: taskId }).first();
  await quotaService.refundQuota(task.user_id, task.feature_id, taskId);
}
```

---

## 完整示例

### 示例1：正常创建任务并扣配额

```javascript
// 用户信息：quota_remaining = 10

// 1. 创建任务
const taskId = await taskService.create(userId, 'basic_clean', {
  input_image: 'https://cos.../input.jpg'
});

// 执行结果：
// - users.quota_remaining: 10 → 9
// - quota_logs: 插入一条 operation='deduct', amount=-1
// - tasks: 插入一条 status='pending', eligible_for_refund=true, refunded=false
```

### 示例2：任务失败自动返还配额

```javascript
// Pipeline执行过程中失败

// 触发 handleTaskFailure()
// - tasks.status: pending → failed
// - tasks.refunded: false → true
// - tasks.refunded_at: 设置为当前时间
// - users.quota_remaining: 9 → 10
// - quota_logs: 插入一条 operation='refund', amount=1
```

### 示例3：防止重复返还配额

```javascript
// 第一次返还
await quotaService.refundQuota(userId, featureId, taskId);
// ✅ 成功返还，refunded=true

// 第二次尝试返还（恶意/误操作）
await quotaService.refundQuota(userId, featureId, taskId);
// ⚠️ 检测到refunded=true，直接返回，不重复返还
```

---

## 注意事项 / 禁止事项

### ✅ 必须遵守

1. **所有配额操作必须使用事务+行锁**（`FOR UPDATE`）
2. **任务创建时设置`eligible_for_refund=true`**
3. **返还配额前检查`refunded=false`**（防重复）
4. **所有配额操作必须记录到`quota_logs`**
5. **扣配额必须在创建任务之前**（不能先创建任务再扣配额）

### ❌ 禁止操作

1. ❌ **禁止在事务外修改配额**：必须使用事务
2. ❌ **禁止不使用行锁**：会导致并发超用
3. ❌ **禁止基于用户主观评价返还配额**：只有系统故障才能返还
4. ❌ **禁止跳过会员校验**：非会员不能使用任何功能
5. ❌ **禁止跳过限流校验**：会被恶意刷量
6. ❌ **禁止`quota_cost=0`未经审批**：免费功能容易被薅羊毛

### ⚠️ 特别警告

- **并发扣配额测试必须通过**：100个并发请求，配额总数必须正确
- **防重复返还必须验证**：同一任务多次调用`refundQuota`，只返还一次
- **`quota_cost=0`必须红色警告**：Billing Guard必须特别审查

---

## 测试要求

### 单元测试

```javascript
// backend/tests/unit/quota.service.test.js

describe('quota.service', () => {
  it('并发100次扣配额，总数正确', async () => {
    const userId = 1;
    const initialQuota = 100;

    // 设置初始配额
    await db('users').where({ id: userId }).update({ quota_remaining: initialQuota });

    // 并发100次扣配额
    const promises = Array.from({ length: 100 }, (_, i) =>
      quotaService.deductQuota(userId, 'basic_clean', i + 1)
    );

    await Promise.all(promises);

    // 验证最终配额
    const user = await db('users').where({ id: userId }).first();
    expect(user.quota_remaining).toBe(0);
  });

  it('防止重复返还配额', async () => {
    const taskId = 123;

    // 第一次返还
    await quotaService.refundQuota(userId, featureId, taskId);

    const quotaBefore = await db('users').where({ id: userId }).first();

    // 第二次返还
    await quotaService.refundQuota(userId, featureId, taskId);

    const quotaAfter = await db('users').where({ id: userId }).first();

    // 验证配额未再次增加
    expect(quotaAfter.quota_remaining).toBe(quotaBefore.quota_remaining);
  });
});
```

---

## Billing Guard审查清单

### ✅ 必须检查的项目

1. **所有配额扣减是否使用事务+行锁**
2. **所有配额返还是否检查`refunded`字段**
3. **任务创建是否设置`eligible_for_refund=true`**
4. **是否存在`quota_cost=0`的功能**（需红色警告）
5. **是否存在基于主观评价返还配额的逻辑**（禁止）
6. **限流策略是否合理**（高成本功能必须严格限流）
7. **会员校验是否完整**（非会员不能创建任务）

### ❌ 发现即拒绝

1. 配额扣减不使用`FOR UPDATE`
2. 允许重复返还配额
3. 允许非会员创建任务
4. 允许基于差评返还配额
5. `quota_cost=0`未经审批

---

## 数据库迁移示例

```javascript
// backend/src/db/migrations/YYYYMMDDHHMMSS_add_refund_fields_to_tasks.js

exports.up = function(knex) {
  return knex.schema.table('tasks', (table) => {
    table.boolean('eligible_for_refund').defaultTo(false).comment('是否有资格返还配额');
    table.boolean('refunded').defaultTo(false).comment('是否已返还配额');
    table.timestamp('refunded_at').nullable().comment('返还时间');

    table.index('refunded');
  });
};

exports.down = function(knex) {
  return knex.schema.table('tasks', (table) => {
    table.dropColumn('eligible_for_refund');
    table.dropColumn('refunded');
    table.dropColumn('refunded_at');
  });
};
```

---

## 总结

这个规范定义了平台的计费模型和配额管理机制，是**商业模型的核心保障**。

**关键点**：
- ✅ 会员+配额商业模型不可破坏
- ✅ 所有配额操作使用事务+行锁
- ✅ 防止重复返还配额
- ✅ 完整的限流策略
- ✅ 禁止基于主观评价返还配额

**所有Agent在处理计费相关需求时，必须参考本规范！**
**Billing Guard必须严格审查所有违反本规范的代码！**
