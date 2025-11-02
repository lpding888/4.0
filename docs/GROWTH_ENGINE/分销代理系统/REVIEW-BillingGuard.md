# 分销代理系统财务安全审查报告

## 审查时间
2025-10-30

## 审查人
billing_guard_skill (老王)

## 审查结果总览
- 🔴 **严重问题**: 1 个 (必须修复)
- 🟡 **中等问题**: 0 个
- 🟢 **轻微问题**: 0 个

---

## 详细审查结果

### 1. 佣金计算安全性

#### ✅ 仅首单计佣

**审查位置**: [commission.service.js:14-23](../../../backend/src/services/commission.service.js#L14-L23)

```javascript
// 1. 检查是否是该用户首次购买
const orderCount = await trx('orders')
  .where({ userId, status: 'paid' })
  .count('id as count')
  .first();

if (orderCount.count > 1) {
  logger.info(`不是首单,不计佣: userId=${userId}, orderId=${orderId}`);
  return null;
}
```

**判定**: ✅ 合格 - 正确检查了首单,只在首次购买时计佣。

---

#### ✅ 佣金计算逻辑正确

**审查位置**: [commission.service.js:51-54](../../../backend/src/services/commission.service.js#L51-L54)

```javascript
// 5. 计算佣金金额
const commissionAmount = parseFloat(
  (orderAmount * commissionRate / 100).toFixed(2)
);
```

**判定**: ✅ 合格 - 佣金计算逻辑正确,四舍五入到2位小数。

---

#### 🔴 佣金基于订单原价,而非实付金额 (严重问题)

**审查位置**: [membership.service.js:135-140](../../../backend/src/services/membership.service.js#L135-L140)

```javascript
// 🔥 新增:触发佣金计算(首单计佣)
try {
  const commissionService = require('./commission.service');
  await commissionService.calculateAndCreateCommission(
    trx,
    order.userId,
    order.id,
    order.amount / 100 // 🔴 问题:这是订单原价,不是实付价!
  );
}
```

**问题描述**:
- 当前实现使用`order.amount`作为佣金计算基础
- `order.amount`是订单的原始价格(99元),**没有考虑优惠券折扣**
- 根据PRD要求,佣金应该基于**订单实付金额**计算

**PRD要求**: [PRD-分销代理系统.md:264-268](../PRD-分销代理系统.md#L264-L268)
> 佣金金额 = 订单实付金额 × 佣金比例
> - 如果订单使用了优惠券,佣金基于折后价计算

**影响**:
- 如果用户使用了优惠券,分销员仍然按原价获得佣金
- 平台需要支付更多佣金,财务损失
- 违反了PRD规定的计费规则

**修复建议**:
1. 在`orders`表中新增`final_amount`字段,记录实付金额
2. 修改`membership.service.js`,使用`order.final_amount`而非`order.amount`计算佣金
3. 如果有优惠券系统,确保优惠券折扣后的金额正确记录到`final_amount`

**判定**: ❌ **不合格** - 必须修复!

---

### 2. 防止重复计佣

#### ✅ 唯一索引已设置

**审查位置**: [20251029110003_create_commissions_table.js:29](../../../backend/src/db/migrations/20251029110003_create_commissions_table.js#L29)

```javascript
// 唯一约束:防止同一订单重复计佣
table.unique(['order_id', 'distributor_id'], 'uk_order_distributor');
```

**判定**: ✅ 合格 - 有唯一索引防止重复计佣。

---

#### ✅ 重复插入处理正确

**审查位置**: [commission.service.js:63-82](../../../backend/src/services/commission.service.js#L63-L82)

```javascript
try {
  await trx('commissions').insert({...});
} catch (error) {
  if (error.code === 'ER_DUP_ENTRY') {
    logger.warn(`订单已计佣,跳过: orderId=${orderId}`);
    return null;
  }
  throw error;
}
```

**判定**: ✅ 合格 - 正确捕获了唯一索引冲突,防止重复计佣。

---

#### ✅ 支付回调幂等

**审查位置**: [membership.service.js:103-106](../../../backend/src/services/membership.service.js#L103-L106)

```javascript
// 3. 幂等性检查
if (order.status === 'paid') {
  logger.info(`订单已处理,跳过: orderId=${orderId}`);
  return { success: true, message: '订单已处理' };
}
```

**判定**: ✅ 合格 - 订单支付回调有幂等性检查,不会重复处理。

---

### 3. 推荐关系绑定

#### ✅ 永久绑定不可更改

**审查位置**: [distribution.service.js:122-129](../../../backend/src/services/distribution.service.js#L122-L129)

```javascript
// 检查被推荐人是否已有推荐关系
const existingRelation = await trx('referral_relationships')
  .where({ referred_user_id: referredUserId })
  .first();

if (existingRelation) {
  logger.info(`被推荐人已有推荐关系,不重复绑定: referredUserId=${referredUserId}`);
  return null;
}
```

**判定**: ✅ 合格 - 正确检查了是否已有推荐关系,不重复绑定。

---

#### ✅ 唯一约束已设置

**审查位置**: [20251029110002_create_referral_relationships_table.js:22](../../../backend/src/db/migrations/20251029110002_create_referral_relationships_table.js#L22)

```javascript
// 唯一约束:每个用户只能被推荐一次
table.unique('referred_user_id', 'uk_referred_user');
```

**判定**: ✅ 合格 - 有唯一约束防止重复绑定。

---

#### ✅ 校验分销员资格

**审查位置**: [distribution.service.js:112-119](../../../backend/src/services/distribution.service.js#L112-L119)

```javascript
// 查询推荐人是否是分销员
const referrer = await trx('distributors')
  .where({ user_id: referrerUserId, status: 'active' })
  .first();

if (!referrer) {
  logger.info(`推荐人不是分销员,不绑定关系: referrerUserId=${referrerUserId}`);
  return null;
}
```

**判定**: ✅ 合格 - 正确校验了推荐人必须是活跃的分销员。

---

### 4. 提现金额安全性

#### ✅ 使用行锁

**审查位置**: [distribution.service.js:450-454](../../../backend/src/services/distribution.service.js#L450-L454)

```javascript
// 使用行锁查询分销员
const distributor = await trx('distributors')
  .where({ user_id: userId })
  .forUpdate()
  .first();
```

**判定**: ✅ 合格 - 正确使用了`forUpdate()`行锁。

---

#### ✅ 余额校验正确

**审查位置**: [distribution.service.js:485-491](../../../backend/src/services/distribution.service.js#L485-L491)

```javascript
// 检查可提现余额
if (distributor.available_commission < amount) {
  throw {
    statusCode: 400,
    errorCode: 6010,
    message: `可提现余额不足(当前¥${distributor.available_commission})`
  };
}
```

**判定**: ✅ 合格 - 正确校验了可提现余额。

---

#### ✅ 事务完整性

**审查位置**: [distribution.service.js:449-514](../../../backend/src/services/distribution.service.js#L449-L514)

```javascript
return await db.transaction(async (trx) => {
  // 扣除可提现余额
  await trx('distributors')
    .where({ id: distributor.id })
    .decrement('available_commission', amount);

  // 创建提现记录
  await trx('withdrawals').insert({...});
});
```

**判定**: ✅ 合格 - 扣除余额和创建提现记录在同一事务中。

---

#### ✅ 拒绝时正确退还

**审查位置**: [admin.controller.js:1107-1110](../../../backend/src/controllers/admin.controller.js#L1107-L1110)

```javascript
// 退还可提现余额
await trx('distributors')
  .where({ id: withdrawal.distributor_id })
  .increment('available_commission', withdrawal.amount);
```

**判定**: ✅ 合格 - 提现审核拒绝时正确退还余额。

---

### 5. 佣金状态流转

#### ✅ 状态流转完整

**审查位置**: [20251029110003_create_commissions_table.js:13](../../../backend/src/db/migrations/20251029110003_create_commissions_table.js#L13)

```sql
status: frozen=冻结中, available=可提现, withdrawn=已提现, cancelled=已取消
```

**判定**: ✅ 合格 - 状态流转定义完整。

---

#### ✅ 解冻逻辑正确

**审查位置**: [commission.service.js:101-138](../../../backend/src/services/commission.service.js#L101-L138)

```javascript
// 使用行锁查询冻结期已结束的佣金(防止并发重复解冻)
const frozenCommissions = await trx('commissions')
  .where({ status: 'frozen' })
  .where('freeze_until', '<=', new Date())
  .forUpdate()
  .select('*');

for (const commission of frozenCommissions) {
  // 更新佣金状态为可提现
  await trx('commissions')
    .where({ id: commission.id })
    .update({ status: 'available', settled_at: new Date() });

  // 增加分销员可提现余额
  await trx('distributors')
    .where({ id: commission.distributor_id })
    .increment('available_commission', commission.commission_amount);
}
```

**判定**: ✅ 合格 - 佣金解冻逻辑正确,使用了行锁防止并发重复解冻。

---

#### ✅ 提现成功后更新状态

**审查位置**: [admin.controller.js:1040-1043](../../../backend/src/controllers/admin.controller.js#L1040-L1043)

```javascript
// 更新分销员已提现金额
await trx('distributors')
  .where({ id: withdrawal.distributor_id })
  .increment('withdrawn_commission', withdrawal.amount);
```

**判定**: ✅ 合格 - 提现成功后正确更新了分销员的`withdrawn_commission`字段。

---

### 6. 数据一致性

#### ✅ 累计佣金一致

**数据一致性公式**:
```
累计佣金(total_commission) = SUM(所有佣金记录的commission_amount)
```

**更新逻辑**:
1. 佣金计算时增加: [commission.service.js:84-87](../../../backend/src/services/commission.service.js#L84-L87)
2. 佣金取消时减少: [commission.service.js:164-167](../../../backend/src/services/commission.service.js#L164-L167)

**判定**: ✅ 合格 - 累计佣金逻辑完整。

---

#### ✅ 可提现佣金准确

**数据一致性公式**:
```
可提现佣金(available_commission) + 已提现佣金(withdrawn_commission)
= 累计佣金(total_commission) - 冻结佣金(frozen)
```

**更新逻辑**:
1. 佣金解冻时增加: [commission.service.js:125-128](../../../backend/src/services/commission.service.js#L125-L128)
2. 申请提现时减少: [distribution.service.js:494-496](../../../backend/src/services/distribution.service.js#L494-L496)
3. 拒绝提现时增加: [admin.controller.js:1108-1110](../../../backend/src/controllers/admin.controller.js#L1108-L1110)
4. 审核通过时增加已提现: [admin.controller.js:1041-1043](../../../backend/src/controllers/admin.controller.js#L1041-L1043)

**验证示例**:
```
初始状态:
- total_commission = 100
- available_commission = 100
- withdrawn_commission = 0

用户申请提现¥50:
- available_commission = 50

审核通过后:
- withdrawn_commission = 50

验证: available_commission + withdrawn_commission = 50 + 50 = 100 = total_commission ✅
```

**判定**: ✅ 合格 - 可提现佣金逻辑正确。

---

#### ✅ 推荐人数准确

**数据统计位置**: [distribution.service.js:197-208](../../../backend/src/services/distribution.service.js#L197-L208)

```javascript
// 查询推荐用户总数
const totalReferrals = await db('referral_relationships')
  .where({ referrer_distributor_id: distributor.id })
  .count('id as count')
  .first();

// 查询已付费推荐用户数
const paidReferrals = await db('referral_relationships as rr')
  .join('orders as o', 'rr.referred_user_id', 'o.userId')
  .where({ 'rr.referrer_distributor_id': distributor.id, 'o.status': 'paid' })
  .countDistinct('rr.referred_user_id as count')
  .first();
```

**判定**: ✅ 合格 - 推荐人数统计逻辑准确。

---

### 7. 防止自推自买

#### ✅ 检查自己推荐自己

**审查位置**: [distribution.service.js:105-109](../../../backend/src/services/distribution.service.js#L105-L109)

```javascript
// 检查自己推荐自己
if (referrerUserId === referredUserId) {
  logger.warn(`自己推荐自己,忽略: referrerUserId=${referrerUserId}`);
  return null;
}
```

**判定**: ✅ 合格 - 防止自己推荐自己。

---

#### ⚠️ 未实现IP/设备监控机制

**PRD要求**: [PRD-分销代理系统.md:282-287](../PRD-分销代理系统.md#L282-L287)
> **风控点1:防止自推自买**
> - 问题:分销员自己注册小号购买会员,赚取佣金
> - 方案:
>   - 限制同一设备/IP短期内注册多账号
>   - 后台监控异常推广行为(同一IP多次购买)
>   - 人工审核异常订单

**当前状态**: 未实现IP/设备监控机制

**建议**:
- 这是后续优化项,不阻塞当前上线
- 建议在V2版本中实现异常行为监控
- 当前可通过人工审核异常订单来防范

**判定**: ⚠️ 警告 - 建议后续实现。

---

## 发现的问题

### 🔴 严重问题

#### P0-1: 佣金计算基于订单原价,而非实付金额

**位置**: [membership.service.js:139](../../../backend/src/services/membership.service.js#L139)

**问题**:
- 佣金计算使用`order.amount`(原价),未考虑优惠券折扣
- 违反PRD要求:"佣金应基于订单实付金额计算"

**影响**:
- 财务损失:平台需要支付更多佣金
- 违反商业规则

**修复方案**:
1. 在`orders`表中新增`final_amount`字段
2. 修改佣金计算逻辑使用实付金额
3. 确保优惠券系统正确记录折后价

**优先级**: 🔴 **P0 - 必须修复**

---

### 🟡 中等问题

无

---

### 🟢 轻微问题

无

---

## 最终判定

### ❌ **FAIL-BLOCK (不准上线,必须返工)**

**原因**:
- 存在1个严重财务安全问题(P0-1)
- 佣金计算基于原价而非实付金额,违反PRD要求
- 可能造成平台财务损失

**必须修复**:
- P0-1: 修改佣金计算逻辑,使用订单实付金额

**修复后需要**:
- 重新提交代码审查
- 通过Billing Guard审查后方可上线

---

## 审查总结

### 做得好的地方 ✅

1. **防重复计佣机制完善**: 唯一索引 + 异常捕获,双重保护
2. **推荐关系绑定安全**: 唯一约束 + 代码校验,防止重复绑定
3. **提现金额安全**: 行锁 + 事务 + 余额校验,防止并发超扣
4. **佣金状态流转完整**: 冻结 → 可提现 → 已提现,逻辑清晰
5. **数据一致性保证**: 所有余额增减都有对应事务操作

### 需要修复的问题 ❌

1. **佣金计算基于原价**: 必须改为基于实付金额
2. **未实现IP/设备监控**: 建议后续版本实现(不阻塞当前上线)

### 建议

1. **立即修复**: P0-1佣金计算问题
2. **后续优化**: 实现IP/设备监控机制,防止自推自买
3. **测试验证**: 修复后进行完整的财务数据一致性测试

---

**签字**: billing_guard_skill (老王)
**日期**: 2025-10-30

---

**备注**: 老王我虽然嘴上骂骂咧咧,但这个分销代理系统大部分代码写得还是挺tm规范的!就是佣金计算那个地方有个SB问题,改了就完美了!
