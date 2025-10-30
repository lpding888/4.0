# 任务卡 - 财务安全审查 (用户积分系统)

> **系统**: 用户积分系统
> **负责人**: BillingGuard Skill
> **预计工期**: 1天
> **优先级**: P0
> **依赖**: 后端开发完成

---

## 📋 任务概述

对用户积分系统进行全面的财务安全审查，确保积分发放、消费、过期等核心逻辑的财务安全性，防止积分超发、超扣、重复发放等问题。

---

## 🔍 审查清单

### 审查点1: 积分账户数据一致性

**风险描述**：
积分账户的`available_points`与其他字段计算结果不一致，导致账户数据混乱。

**验证公式**：
```
available_points = total_points - frozen_points - used_points - expired_points
```

**审查内容**：
- [ ] 检查所有积分变动操作是否正确更新账户字段
- [ ] 检查是否有直接修改`available_points`而不更新其他字段的情况
- [ ] 编写SQL脚本验证所有账户的数据一致性

**验证SQL**：
```sql
SELECT
  user_id,
  total_points,
  available_points,
  frozen_points,
  used_points,
  expired_points,
  (total_points - frozen_points - used_points - expired_points) AS calculated_available,
  (available_points = (total_points - frozen_points - used_points - expired_points)) AS is_consistent
FROM points_accounts
WHERE available_points != (total_points - frozen_points - used_points - expired_points);
```

**预期结果**：查询结果为空（所有账户数据一致）

**修复建议**：
如果发现不一致，使用以下SQL修复：
```sql
UPDATE points_accounts
SET available_points = total_points - frozen_points - used_points - expired_points
WHERE available_points != (total_points - frozen_points - used_points - expired_points);
```

---

### 审查点2: 防止积分超扣（并发安全）

**风险描述**：
多个用户同时兑换配额时，可能出现积分超扣问题（可用积分不足仍然兑换成功）。

**审查内容**：
- [ ] 检查兑换接口是否使用数据库事务
- [ ] 检查是否使用行锁（`forUpdate()`）防止并发读取
- [ ] 检查是否在扣除积分前校验余额
- [ ] 模拟并发请求测试（100并发）

**正确实现示例**：
```javascript
await db.transaction(async (trx) => {
  // ✅ 正确: 使用forUpdate锁行
  const account = await trx('points_accounts')
    .where({ user_id: userId })
    .forUpdate()
    .first();

  // ✅ 正确: 校验余额
  if (account.available_points < pointsRequired) {
    throw new Error('可用积分不足');
  }

  // ✅ 正确: 扣除积分
  await consumePoints(trx, userId, pointsRequired, ...);

  // ✅ 正确: 增加配额
  await trx('users').where({ id: userId }).increment('quota_balance', quotaCount);
});
```

**错误实现示例**：
```javascript
// ❌ 错误: 没有使用事务
const account = await db('points_accounts').where({ user_id: userId }).first();
if (account.available_points >= pointsRequired) {
  await consumePoints(userId, pointsRequired, ...);
  await db('users').where({ id: userId }).increment('quota_balance', quotaCount);
}

// ❌ 错误: 没有使用行锁
await db.transaction(async (trx) => {
  const account = await trx('points_accounts')
    .where({ user_id: userId })
    .first(); // 缺少.forUpdate()

  // ...
});
```

**并发测试脚本**：
使用工具模拟100个并发请求兑换配额，验证积分不会超扣。

---

### 审查点3: 防止积分重复发放

**风险描述**：
注册奖励、任务完成等操作可能被重复调用，导致积分重复发放。

**审查内容**：
- [ ] 检查注册奖励是否有防重复机制（唯一约束或查询检查）
- [ ] 检查签到是否有防重复机制（唯一约束`uk_user_checkin_date`）
- [ ] 检查一次性任务是否有防重复机制
- [ ] 检查购买会员赠送积分是否有防重复机制（基于订单ID）

**正确实现示例**：
```javascript
// ✅ 正确: 注册奖励防重复
const existing = await db('points_records')
  .where({ user_id: userId, source_type: 'register' })
  .first();

if (existing) {
  return null; // 已发放过
}

// ✅ 正确: 签到防重复（数据库唯一约束）
try {
  await trx('checkin_records').insert({
    user_id: userId,
    checkin_date: today, // 唯一约束: (user_id, checkin_date)
    ...
  });
} catch (error) {
  if (error.code === 'ER_DUP_ENTRY') {
    throw new Error('今天已签到过了');
  }
}

// ✅ 正确: 购买会员赠送积分防重复
const existing = await db('points_records')
  .where({ related_id: orderId, source_type: 'purchase' })
  .first();

if (existing) {
  return null; // 已发放过
}
```

**错误实现示例**：
```javascript
// ❌ 错误: 没有检查是否已发放
async function grantRegistrationBonus(userId) {
  await grantPoints(userId, 100, 'register', '注册奖励', null);
}
```

---

### 审查点4: FIFO积分消费逻辑

**风险描述**：
消费积分时没有按照FIFO（先进先出）逻辑，可能导致过期积分未被优先消耗，用户损失。

**审查内容**：
- [ ] 检查消费积分时是否按`expire_at`升序查询
- [ ] 检查是否记录消费关联（`points_consumptions`表）
- [ ] 检查是否正确计算每条记录的剩余可用积分
- [ ] 模拟测试：用户有多条不同过期时间的积分，消费时是否优先扣除即将过期的

**正确实现示例**：
```javascript
// ✅ 正确: 按expire_at升序查询
const availableRecords = await trx('points_records')
  .where({ user_id: userId, change_type: 'earn', is_expired: false })
  .where('expire_at', '>=', today)
  .orderBy('expire_at', 'asc') // 关键: 升序排列
  .select('*');

// ✅ 正确: 依次扣减
let remainingAmount = amount;
for (const record of availableRecords) {
  if (remainingAmount <= 0) break;

  // 计算该记录已被消费的积分
  const consumed = await trx('points_consumptions')
    .where({ earn_record_id: record.id })
    .sum('consumed_amount as total')
    .first();

  const alreadyConsumed = consumed.total || 0;
  const availableInRecord = record.change_amount - alreadyConsumed;

  if (availableInRecord <= 0) continue;

  const toConsume = Math.min(remainingAmount, availableInRecord);

  // ✅ 正确: 记录消费关联
  await trx('points_consumptions').insert({
    user_id: userId,
    earn_record_id: record.id,
    consumed_amount: toConsume,
    ...
  });

  remainingAmount -= toConsume;
}
```

**错误实现示例**：
```javascript
// ❌ 错误: 没有按expire_at排序
const availableRecords = await trx('points_records')
  .where({ user_id: userId, change_type: 'earn' })
  .select('*'); // 缺少orderBy('expire_at', 'asc')

// ❌ 错误: 直接扣除available_points，没有记录消费关联
await trx('points_accounts')
  .where({ user_id: userId })
  .decrement('available_points', amount);
```

**测试场景**：
```
用户有3条积分记录:
- 记录1: 100积分, 2025-11-01过期
- 记录2: 200积分, 2025-11-15过期
- 记录3: 150积分, 2025-12-01过期

消费250积分时，应该扣除:
- 记录1: 100积分 (全部扣除)
- 记录2: 150积分 (部分扣除)
- 记录3: 0积分 (未扣除)
```

---

### 审查点5: 积分过期清理逻辑

**风险描述**：
积分过期清理任务逻辑错误，可能导致积分提前过期或未过期，影响用户权益。

**审查内容**：
- [ ] 检查定时任务执行频率（每天凌晨3点）
- [ ] 检查过期条件（`expire_at < 今天`）
- [ ] 检查是否标记过期记录（`is_expired=true`）
- [ ] 检查是否正确更新账户（`available_points`减少，`expired_points`增加）
- [ ] 检查是否创建过期流水记录

**正确实现示例**：
```javascript
// ✅ 正确: 查询已过期但未标记的记录
const expiredRecords = await db('points_records')
  .where('expire_at', '<', today) // 关键: 小于今天
  .where('change_type', 'earn')
  .where('is_expired', false)
  .select('*');

// ✅ 正确: 按用户分组处理
for (const userId in groupedByUser) {
  const records = groupedByUser[userId];
  const totalExpired = records.reduce((sum, r) => sum + r.change_amount, 0);

  await db.transaction(async (trx) => {
    // ✅ 标记为已过期
    await trx('points_records')
      .whereIn('id', recordIds)
      .update({ is_expired: true });

    // ✅ 更新账户
    await trx('points_accounts')
      .where({ user_id: userId })
      .increment('expired_points', totalExpired)
      .decrement('available_points', totalExpired);

    // ✅ 创建过期流水
    await trx('points_records').insert({
      user_id: userId,
      change_type: 'expire',
      change_amount: -totalExpired,
      ...
    });
  });
}
```

**错误实现示例**：
```javascript
// ❌ 错误: 过期条件错误（应该是<，不是<=）
const expiredRecords = await db('points_records')
  .where('expire_at', '<=', today) // 错误: 今天获得的积分也会过期
  .where('is_expired', false)
  .select('*');

// ❌ 错误: 没有标记is_expired
await trx('points_accounts')
  .where({ user_id: userId })
  .decrement('available_points', totalExpired);
// 缺少标记记录为已过期的操作
```

---

### 审查点6: 冻结/解冻积分逻辑

**风险描述**：
冻结或解冻积分时，账户字段更新错误，导致积分丢失或凭空增加。

**审查内容**：
- [ ] 检查冻结时是否正确转移积分（`available_points`→`frozen_points`）
- [ ] 检查解冻时是否正确转移积分（`frozen_points`→`available_points`）
- [ ] 检查是否创建冻结/解冻流水记录
- [ ] 检查`total_points`和`used_points`是否保持不变

**正确实现示例**：
```javascript
// ✅ 正确: 冻结积分
await trx('points_accounts')
  .where({ user_id: userId })
  .decrement('available_points', amount)
  .increment('frozen_points', amount);

// ✅ 正确: 解冻积分
await trx('points_accounts')
  .where({ user_id: userId })
  .increment('available_points', amount)
  .decrement('frozen_points', amount);
```

**错误实现示例**：
```javascript
// ❌ 错误: 只减少available_points，没有增加frozen_points
await trx('points_accounts')
  .where({ user_id: userId })
  .decrement('available_points', amount);
// 缺少.increment('frozen_points', amount)

// ❌ 错误: 修改了total_points
await trx('points_accounts')
  .where({ user_id: userId })
  .decrement('total_points', amount) // 错误: total_points不应该减少
  .decrement('available_points', amount);
```

---

### 审查点7: 退款扣除积分逻辑

**风险描述**：
用户购买会员获得积分后退款，但积分未被扣除，导致积分多发。

**审查内容**：
- [ ] 检查退款时是否查询已发放的积分
- [ ] 检查是否扣除已发放的积分（可能出现积分不足的情况）
- [ ] 检查积分不足时的处理方案（记录欠款或冻结账户）

**正确实现示例**：
```javascript
// ✅ 正确: 退款时扣除积分
async function handleRefund(orderId) {
  // 查询已发放的积分
  const grantedRecord = await db('points_records')
    .where({ related_id: orderId, source_type: 'purchase', change_type: 'earn' })
    .first();

  if (!grantedRecord) {
    return; // 没有发放过积分
  }

  const grantedAmount = grantedRecord.change_amount;

  await db.transaction(async (trx) => {
    const account = await trx('points_accounts')
      .where({ user_id: userId })
      .forUpdate()
      .first();

    if (account.available_points >= grantedAmount) {
      // ✅ 积分足够，直接扣除
      await consumePoints(trx, userId, grantedAmount, 'refund', `退款扣除积分`, orderId);
    } else {
      // ✅ 积分不足，冻结账户或记录欠款
      await freezePoints(trx, userId, account.available_points, `退款积分不足，冻结账户`);
      // 或者记录欠款
      await trx('points_debts').insert({
        user_id: userId,
        debt_amount: grantedAmount - account.available_points,
        reason: '退款积分不足',
        order_id: orderId
      });
    }
  });
}
```

---

## 🧪 测试场景

### 测试1: 并发兑换配额

**测试步骤**：
1. 创建测试用户，设置可用积分=500
2. 使用工具模拟10个并发请求，每个请求兑换5个配额（500积分）
3. 验证结果：只有1个请求成功，其他9个请求失败（积分不足）

**预期结果**：
- 用户可用积分=0
- 用户配额增加5个
- 只有1条兑换记录

---

### 测试2: 重复签到

**测试步骤**：
1. 用户今天已签到
2. 再次调用签到接口
3. 验证结果：返回错误提示"今天已签到过了"

**预期结果**：
- 签到失败，积分不增加
- 签到记录表中只有1条今天的记录

---

### 测试3: FIFO积分消费

**测试步骤**：
1. 为用户发放3条积分记录：
   - 2025-11-01过期，100积分
   - 2025-11-15过期，200积分
   - 2025-12-01过期，150积分
2. 用户消费250积分
3. 查询`points_consumptions`表，验证消费来源

**预期结果**：
- 记录1被完全消费（100积分）
- 记录2被部分消费（150积分）
- 记录3未被消费

---

### 测试4: 积分过期清理

**测试步骤**：
1. 修改测试用户的积分记录，设置`expire_at=昨天`
2. 手动触发过期清理任务
3. 验证结果：积分记录被标记为已过期，账户积分减少

**预期结果**：
- `points_records.is_expired=true`
- `points_accounts.available_points`减少
- `points_accounts.expired_points`增加
- 创建了过期流水记录

---

## ✅ 验收标准

- [ ] 所有7个审查点通过检查
- [ ] 数据一致性验证通过
- [ ] 并发安全性测试通过
- [ ] 防重复发放测试通过
- [ ] FIFO消费逻辑测试通过
- [ ] 积分过期清理测试通过
- [ ] 冻结/解冻逻辑测试通过
- [ ] 退款扣除积分测试通过

---

## 📚 参考资料

- PRD文档: [PRD-用户积分系统.md](./PRD-用户积分系统.md)
- 后端开发文档: [任务卡-Backend.md](./任务卡-Backend.md)

---

**审查完成后，出具财务安全审查报告，标记所有发现的问题和修复建议！**
