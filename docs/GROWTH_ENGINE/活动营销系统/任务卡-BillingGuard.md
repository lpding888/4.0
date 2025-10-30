# 任务卡：财务安全审查 - 活动营销系统

> **负责技能**：billing_guard_skill
> **优先级**：P0（阻塞性任务）
> **预计工期**：1天

---

## 任务目标

审查活动营销系统的所有财务相关逻辑，确保优惠券金额计算准确、防止并发超发、订单支付金额正确，杜绝任何财务漏洞。

---

## 审查范围

### ✅ 必须审查
1. 优惠券金额计算逻辑
2. 订单创建时的折扣处理
3. 支付金额准确性
4. 优惠券状态流转
5. 并发控制机制
6. 数据库事务完整性

### ❌ 无需审查
- 配额扣减逻辑（本功能不涉及）
- AI任务处理逻辑（与优惠券无关）

---

## 审查清单

### 1. 金额计算安全性

#### 🔍 审查要点
- [ ] **所有折扣金额计算是否在后端进行**
  - 检查：前端是否只传`couponId`，不传折扣金额
  - 检查：后端是否重新计算折后价
  - 检查：是否禁止前端传入`discountAmount`或`finalAmount`

- [ ] **折扣计算逻辑是否正确**
  ```javascript
  // ✅ 正确：固定金额折扣
  discountAmount = promotion.discount_value;

  // ✅ 正确：百分比折扣（向下取整）
  discountAmount = Math.floor(orderAmount * promotion.discount_value / 100);

  // ✅ 正确：确保折后价不为负
  discountAmount = Math.min(discountAmount, orderAmount);
  finalAmount = orderAmount - discountAmount;
  ```

- [ ] **折扣基准是否正确**
  - 检查：是否基于订单实付金额计算（非原价）
  - 检查：如果用户已使用其他优惠券，是否正确处理

**❌ 严重错误示例**：
```javascript
// ❌ 错误：信任前端传来的折扣金额
const { couponId, discountAmount } = req.body;
finalAmount = originalAmount - discountAmount;  // 危险！

// ❌ 错误：折后价为负数
finalAmount = originalAmount - discountAmount;  // 没有检查是否为负
```

**✅ 正确实现**：
```javascript
// ✅ 正确：后端重新计算
const coupon = await getCoupon(couponId);
const promotion = await getPromotion(coupon.promotion_id);
const discountAmount = calculateDiscount(promotion, originalAmount);
const finalAmount = Math.max(0, originalAmount - discountAmount);
```

---

### 2. 并发控制安全性

#### 🔍 审查要点
- [ ] **领券时是否使用行锁**
  ```javascript
  // ✅ 正确：使用forUpdate()行锁
  const promotion = await trx('promotions')
    .where({ id: promotionId })
    .forUpdate()  // 必须有！
    .first();
  ```

- [ ] **库存更新是否原子性**
  ```javascript
  // ✅ 正确：在事务中更新库存
  await trx('promotions')
    .where({ id: promotionId })
    .increment('claimed_count', 1);
  ```

- [ ] **是否有并发测试验证**
  - 检查：是否有100并发领券测试
  - 检查：测试结果是否显示无超发

**❌ 严重错误示例**：
```javascript
// ❌ 错误：没有行锁，可能并发超发
const promotion = await db('promotions').where({ id: promotionId }).first();
if (promotion.claimed_count >= promotion.total_quota) {
  throw new Error('已抢光');
}
await db('promotions').where({ id: promotionId }).increment('claimed_count', 1);
```

**✅ 正确实现**：
```javascript
// ✅ 正确：事务+行锁
return await db.transaction(async (trx) => {
  const promotion = await trx('promotions')
    .where({ id: promotionId })
    .forUpdate()
    .first();

  if (promotion.claimed_count >= promotion.total_quota) {
    throw new Error('已抢光');
  }

  await trx('promotions')
    .where({ id: promotionId })
    .increment('claimed_count', 1);
});
```

---

### 3. 优惠券状态流转安全性

#### 🔍 审查要点
- [ ] **状态流转是否完整**
  ```
  unused（未使用）→ locked（锁定）→ used（已使用）
                    ↓
                  unused（支付失败释放）
  ```

- [ ] **订单创建时是否锁定券**
  ```javascript
  // ✅ 正确：创建订单时锁定券
  await trx('user_coupons')
    .where({ id: couponId })
    .update({ status: 'locked', order_id: orderId });
  ```

- [ ] **支付成功时是否更新为已使用**
  ```javascript
  // ✅ 正确：支付成功后更新状态
  await trx('user_coupons')
    .where({ id: couponId })
    .update({ status: 'used', used_at: new Date() });
  ```

- [ ] **支付失败时是否释放券**
  ```javascript
  // ✅ 正确：支付失败释放券
  await trx('user_coupons')
    .where({ id: couponId, status: 'locked' })
    .update({ status: 'unused', order_id: null });
  ```

**❌ 严重错误示例**：
```javascript
// ❌ 错误：创建订单时直接标记为已使用
await db('user_coupons').where({ id: couponId }).update({ status: 'used' });
// 问题：支付失败后券无法恢复
```

---

### 4. 支付金额准确性

#### 🔍 审查要点
- [ ] **微信支付订单金额是否使用折后价**
  ```javascript
  // ✅ 正确：使用后端计算的finalAmount
  const wechatOrder = await wechatPay.createOrder({
    amount: finalAmount,  // 使用折后价
    description: `购买会员-${planType}`
  });
  ```

- [ ] **订单记录是否完整**
  - 检查：是否记录`original_amount`（原价）
  - 检查：是否记录`discount_amount`（优惠金额）
  - 检查：是否记录`final_amount`（实付金额）
  - 检查：是否记录`coupon_id`（使用的券）

- [ ] **支付回调金额是否校验**
  ```javascript
  // ✅ 正确：校验支付金额
  if (callbackData.amount !== order.final_amount) {
    throw new Error('支付金额不匹配');
  }
  ```

**❌ 严重错误示例**：
```javascript
// ❌ 错误：微信支付金额使用原价
const wechatOrder = await wechatPay.createOrder({
  amount: originalAmount,  // 错误！应该用finalAmount
});
```

---

### 5. 防止重复使用

#### 🔍 审查要点
- [ ] **是否有唯一约束防止重复领取**
  ```sql
  UNIQUE KEY uk_user_promotion (user_id, promotion_id)
  ```

- [ ] **创建订单时是否检查券状态**
  ```javascript
  // ✅ 正确：检查券是否可用
  if (coupon.status !== 'unused') {
    throw new Error('优惠券不可用');
  }
  ```

- [ ] **是否防止同一券多次核销**
  - 检查：是否使用事务+行锁
  - 检查：状态变更是否原子性

---

### 6. 数据一致性

#### 🔍 审查要点
- [ ] **优惠券库存一致性**
  ```sql
  -- 验证SQL：已领取数 = 实际券数
  SELECT
    p.claimed_count AS promotion_claimed,
    COUNT(uc.id) AS actual_claimed
  FROM promotions p
  LEFT JOIN user_coupons uc ON p.id = uc.promotion_id
  WHERE p.id = 'promo_123'
  GROUP BY p.id;
  ```

- [ ] **GMV计算准确性**
  ```sql
  -- 验证SQL：GMV = 所有使用该券的订单实付之和
  SELECT SUM(final_amount) AS gmv
  FROM orders
  WHERE coupon_id IN (
    SELECT id FROM user_coupons WHERE promotion_id = 'promo_123'
  ) AND status = 'paid';
  ```

---

## 审查产出物

### 审查报告模板

```markdown
# 活动营销系统财务安全审查报告

## 审查时间
2025-10-XX

## 审查人
billing_guard_skill

## 审查结果总览
- 🔴 严重问题：X 个（必须修复）
- 🟡 中等问题：X 个（建议修复）
- 🟢 轻微问题：X 个（可选修复）

## 详细审查结果

### 1. 金额计算安全性
- [x] 所有折扣金额在后端计算 ✅
- [x] 折扣计算逻辑正确 ✅
- [x] 折扣基准正确（基于实付） ✅

### 2. 并发控制安全性
- [x] 领券使用行锁 ✅
- [x] 库存更新原子性 ✅
- [x] 100并发测试通过 ✅

### 3. 优惠券状态流转
- [x] 状态流转完整 ✅
- [x] 支付失败正确释放 ✅

### 4. 支付金额准确性
- [x] 微信支付金额正确 ✅
- [x] 订单记录完整 ✅

### 5. 防止重复使用
- [x] 唯一约束已设置 ✅
- [x] 状态检查完整 ✅

### 6. 数据一致性
- [x] 库存数据一致 ✅
- [x] GMV计算准确 ✅

## 发现的问题

### 🔴 严重问题
无

### 🟡 中等问题
无

### 🟢 轻微问题
无

## 最终判定
☑️ **通过审查**，可以合并到主分支

签字：____________
日期：____________
```

---

## 禁止事项

❌ **严格禁止**：
1. 不允许通过有明显财务漏洞的实现
2. 不允许跳过并发控制审查
3. 不允许跳过金额计算逻辑审查
4. 不允许通过未经测试的代码

---

## 交付方式

```bash
git add docs/GROWTH_ENGINE/活动营销系统/REVIEW-BillingGuard.md
git commit -m "docs: add billing guard review report for promotion system"
git push origin develop
```

---

**预计工作量**：1天
