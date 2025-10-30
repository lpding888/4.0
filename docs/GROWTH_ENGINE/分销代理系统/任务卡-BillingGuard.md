# 任务卡:财务安全审查 - 分销代理系统

> **负责技能**:billing_guard_skill
> **优先级**:P0(阻塞性任务)
> **预计工期**:1天

---

## 任务目标

审查分销代理系统的所有财务相关逻辑,确保佣金计算准确、防止重复计佣、提现金额校验正确,杜绝任何财务漏洞。

---

## 审查范围

### ✅ 必须审查
1. 佣金计算逻辑(首单计佣)
2. 推荐关系绑定逻辑
3. 提现金额校验
4. 佣金状态流转
5. 数据一致性(累计佣金、可提现佣金)
6. 防止重复计佣机制

### ❌ 无需审查
- 配额扣减逻辑(本功能不涉及)
- AI任务处理逻辑(与分销无关)

---

## 审查清单

### 1. 佣金计算安全性

#### 🔍 审查要点
- [ ] **是否仅在首次购买时计佣**
  ```javascript
  // ✅ 正确:检查订单数量
  const orderCount = await trx('orders')
    .where({ user_id: userId, status: 'paid' })
    .count('id as count')
    .first();

  if (orderCount.count > 1) {
    // 不是首单,不计佣
    return null;
  }
  ```

- [ ] **佣金计算逻辑是否正确**
  ```javascript
  // ✅ 正确:基于订单实付金额计算
  const commissionAmount = parseFloat(
    (orderAmount * commissionRate / 100).toFixed(2)
  );

  // ❌ 错误:基于订单原价
  const commissionAmount = originalAmount * commissionRate / 100;
  ```

- [ ] **是否基于订单实付金额(非原价)**
  - 检查:佣金计算是否使用`final_amount`而非`original_amount`
  - 检查:如果用户使用了优惠券,佣金是否基于折后价

**❌ 严重错误示例**:
```javascript
// ❌ 错误:没有检查首单,每次购买都计佣
await createCommission(distributorId, orderId, amount);

// ❌ 错误:基于原价计算
const commission = order.original_amount * rate / 100;
```

**✅ 正确实现**:
```javascript
// ✅ 正确:首单检查+基于实付
const orderCount = await trx('orders')
  .where({ user_id: userId, status: 'paid' })
  .count();

if (orderCount.count === 1) {
  const commission = order.final_amount * rate / 100;
  await createCommission(trx, distributorId, orderId, commission);
}
```

---

### 2. 防止重复计佣

#### 🔍 审查要点
- [ ] **是否有唯一索引防止重复计佣**
  ```sql
  -- ✅ 正确:唯一索引
  UNIQUE KEY uk_order_distributor (order_id, distributor_id)
  ```

- [ ] **插入佣金记录时是否捕获唯一索引冲突**
  ```javascript
  // ✅ 正确:捕获重复插入错误
  try {
    await trx('commissions').insert({...});
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      // 已计佣过,忽略
      return null;
    }
    throw error;
  }
  ```

- [ ] **订单支付回调是否幂等**
  - 检查:多次回调是否会重复计佣
  - 检查:是否有唯一索引保证幂等性

**❌ 严重错误示例**:
```javascript
// ❌ 错误:没有唯一索引,可能重复计佣
await db('commissions').insert({
  distributor_id,
  order_id,
  commission_amount
});
```

---

### 3. 推荐关系绑定安全性

#### 🔍 审查要点
- [ ] **推荐关系是否永久绑定,不可更改**
  ```javascript
  // ✅ 正确:检查是否已有推荐关系
  const existing = await trx('referral_relationships')
    .where({ referred_user_id: userId })
    .first();

  if (existing) {
    // 已有推荐关系,不重复绑定
    return null;
  }
  ```

- [ ] **是否有唯一约束防止重复绑定**
  ```sql
  -- ✅ 正确:唯一约束
  UNIQUE KEY uk_referred_user (referred_user_id)
  ```

- [ ] **是否校验推荐人是分销员**
  ```javascript
  // ✅ 正确:检查推荐人分销员资格
  const referrer = await trx('distributors')
    .where({ user_id: referrerId, status: 'active' })
    .first();

  if (!referrer) {
    return null; // 推荐人不是分销员
  }
  ```

---

### 4. 提现金额安全性

#### 🔍 审查要点
- [ ] **提现时是否使用行锁**
  ```javascript
  // ✅ 正确:使用forUpdate()行锁
  const distributor = await trx('distributors')
    .where({ user_id: userId })
    .forUpdate()
    .first();
  ```

- [ ] **是否校验可提现余额**
  ```javascript
  // ✅ 正确:校验余额
  if (distributor.available_commission < amount) {
    throw new Error('可提现余额不足');
  }
  ```

- [ ] **扣除余额和创建提现记录是否在同一事务**
  ```javascript
  // ✅ 正确:事务内操作
  await trx.transaction(async (trx) => {
    // 扣除余额
    await trx('distributors')
      .where({ id: distributorId })
      .decrement('available_commission', amount);

    // 创建提现记录
    await trx('withdrawals').insert({...});
  });
  ```

- [ ] **提现审核拒绝时是否正确退还余额**
  ```javascript
  // ✅ 正确:拒绝时退还余额
  await trx('distributors')
    .where({ id: distributorId })
    .increment('available_commission', amount);
  ```

**❌ 严重错误示例**:
```javascript
// ❌ 错误:没有行锁,可能并发超扣
const distributor = await db('distributors')
  .where({ user_id: userId })
  .first();

if (distributor.available_commission >= amount) {
  await db('distributors')
    .where({ id: distributorId })
    .decrement('available_commission', amount);
}
```

---

### 5. 佣金状态流转安全性

#### 🔍 审查要点
- [ ] **状态流转是否完整**
  ```
  frozen(冻结)→ available(可提现)→ withdrawn(已提现)
  ```

- [ ] **佣金解冻逻辑是否正确**
  ```javascript
  // ✅ 正确:解冻时更新状态并增加可提现余额
  await trx('commissions')
    .where({ status: 'frozen' })
    .where('freeze_until', '<=', new Date())
    .update({ status: 'available' });

  await trx('distributors')
    .where({ id: distributorId })
    .increment('available_commission', commissionAmount);
  ```

- [ ] **提现成功后佣金状态是否更新**
  ```javascript
  // ✅ 正确:提现成功后更新分销员已提现金额
  await trx('distributors')
    .where({ id: distributorId })
    .increment('withdrawn_commission', amount);
  ```

---

### 6. 数据一致性

#### 🔍 审查要点
- [ ] **分销员累计佣金一致性**
  ```sql
  -- 验证SQL:累计佣金 = 佣金记录之和
  SELECT
    d.total_commission AS distributor_total,
    SUM(c.commission_amount) AS commission_sum
  FROM distributors d
  LEFT JOIN commissions c ON d.id = c.distributor_id
  WHERE d.id = 'dist_abc123'
  GROUP BY d.id;
  ```

- [ ] **可提现佣金计算准确性**
  ```sql
  -- 验证SQL:可提现 = 累计 - 冻结 - 已提现
  SELECT
    d.total_commission,
    d.available_commission,
    d.withdrawn_commission,
    SUM(CASE WHEN c.status = 'frozen' THEN c.commission_amount ELSE 0 END) AS frozen
  FROM distributors d
  LEFT JOIN commissions c ON d.id = c.distributor_id
  WHERE d.id = 'dist_abc123'
  GROUP BY d.id;
  ```

- [ ] **推荐人数统计准确性**
  ```sql
  -- 验证SQL:推荐人数 = 推荐关系记录数
  SELECT
    COUNT(*) AS referral_count
  FROM referral_relationships
  WHERE referrer_distributor_id = 'dist_abc123';
  ```

---

### 7. 防止自推自买

#### 🔍 审查要点
- [ ] **是否有IP/设备监控机制**
  - 检查:是否记录注册IP和设备信息
  - 检查:是否有异常检测逻辑

- [ ] **是否有人工审核机制**
  - 检查:异常推广行为是否需要人工审核
  - 检查:是否有禁用分销员的功能

- [ ] **是否限制推荐人自己注册小号**
  - 检查:同一IP短期内注册多账号是否受限
  - 检查:后台是否有异常行为监控报表

---

## 审查产出物

### 审查报告模板

```markdown
# 分销代理系统财务安全审查报告

## 审查时间
2025-10-XX

## 审查人
billing_guard_skill

## 审查结果总览
- 🔴 严重问题:X 个(必须修复)
- 🟡 中等问题:X 个(建议修复)
- 🟢 轻微问题:X 个(可选修复)

## 详细审查结果

### 1. 佣金计算安全性
- [x] 仅首单计佣 ✅
- [x] 佣金计算逻辑正确 ✅
- [x] 基于订单实付金额 ✅

### 2. 防止重复计佣
- [x] 唯一索引已设置 ✅
- [x] 重复插入处理正确 ✅
- [x] 支付回调幂等 ✅

### 3. 推荐关系绑定
- [x] 永久绑定不可更改 ✅
- [x] 唯一约束已设置 ✅
- [x] 校验分销员资格 ✅

### 4. 提现金额安全性
- [x] 使用行锁 ✅
- [x] 余额校验正确 ✅
- [x] 事务完整性 ✅
- [x] 拒绝时正确退还 ✅

### 5. 佣金状态流转
- [x] 状态流转完整 ✅
- [x] 解冻逻辑正确 ✅

### 6. 数据一致性
- [x] 累计佣金一致 ✅
- [x] 可提现佣金准确 ✅
- [x] 推荐人数准确 ✅

### 7. 防止自推自买
- [x] 有监控机制 ✅
- [x] 有人工审核 ✅

## 发现的问题

### 🔴 严重问题
无

### 🟡 中等问题
无

### 🟢 轻微问题
无

## 最终判定
☑️ **通过审查**,可以合并到主分支

签字:____________
日期:____________
```

---

## 禁止事项

❌ **严格禁止**:
1. 不允许通过有明显财务漏洞的实现
2. 不允许跳过佣金计算逻辑审查
3. 不允许跳过提现金额校验审查
4. 不允许通过未经测试的代码
5. 不允许佣金系统影响用户配额

---

## 交付方式

```bash
git add docs/GROWTH_ENGINE/分销代理系统/REVIEW-BillingGuard.md
git commit -m "docs: add billing guard review report for distribution system"
git push origin develop
```

---

**预计工作量**:1天
