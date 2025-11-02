# 任务卡：后端开发 - 活动营销系统

> **负责技能**：backend_dev_skill
> **功能模块**：活动营销系统
> **任务类型**：后端接口开发
> **优先级**：P0

---

## 任务目标

实现活动营销系统的后端接口，包括用户端优惠券领取/使用功能，以及管理员端活动管理功能。

---

## 目录范围

### ✅ 可修改
- `backend/src/controllers/promotion.controller.js`（新建）
- `backend/src/services/promotion.service.js`（新建）
- `backend/src/routes/promotion.routes.js`（新建）
- `backend/src/controllers/admin.controller.js`（新增方法）
- `backend/src/controllers/membership.controller.js`（改造订单创建逻辑）
- `backend/src/services/payment.service.js`（改造支付回调逻辑）

### ❌ 禁止修改
- `backend/src/services/quota.service.js`（配额逻辑）
- `backend/src/middlewares/auth.middleware.js`（认证中间件）

---

## 产出物清单

### 1. 用户端接口
- `GET /promotions/list` - 获取活动列表
- `POST /promotions/:id/claim` - 领取优惠券
- `GET /coupons/my` - 获取用户优惠券列表
- `POST /orders/create`（改造）- 支持优惠券参数

### 2. 管理员端接口
- `GET /admin/promotions` - 获取活动列表
- `POST /admin/promotions` - 创建活动
- `PUT /admin/promotions/:id` - 更新活动
- `PATCH /admin/promotions/:id/offline` - 下线活动
- `GET /admin/promotions/:id` - 获取活动详情
- `GET /admin/promotions/:id/claims` - 获取领券记录
- `GET /admin/promotions/:id/usages` - 获取核销记录

### 3. Service层
- `promotion.service.js` - 活动和优惠券业务逻辑
- `payment.service.js`（改造）- 支付回调更新优惠券状态

---

## 核心技术要求

### 1. 领取优惠券防超发（行锁）
```javascript
// promotion.service.js - claimCoupon 方法
async claimCoupon(userId, promotionId) {
  return await db.transaction(async (trx) => {
    // 使用行锁查询活动
    const promotion = await trx('promotions')
      .where({ id: promotionId })
      .forUpdate()  // 🔥 关键：行锁防止并发
      .first();

    // 校验活动有效性
    if (!promotion) throw new Error('活动不存在');
    if (promotion.status !== 'active') throw new Error('活动已结束');
    if (promotion.claimed_count >= promotion.total_quota) throw new Error('优惠券已抢光');

    // 检查用户是否已领取
    const existingCoupon = await trx('user_coupons')
      .where({ user_id: userId, promotion_id: promotionId })
      .first();
    if (existingCoupon) throw new Error('您已领取过该券');

    // 更新已领取数量
    await trx('promotions')
      .where({ id: promotionId })
      .increment('claimed_count', 1);

    // 创建用户优惠券
    const couponId = shortid.generate();
    await trx('user_coupons').insert({
      id: couponId,
      user_id: userId,
      promotion_id: promotionId,
      status: 'unused',
      claimed_at: new Date(),
      expire_at: promotion.end_at
    });

    return couponId;
  });
}
```

### 2. 订单创建时使用优惠券（事务）
```javascript
// membership.controller.js - createOrder 方法改造
async createOrder(req, res, next) {
  try {
    const { planType, couponId } = req.body;  // 新增couponId参数
    const userId = req.user.id;

    let originalAmount = 99; // 根据planType获取原价
    let discountAmount = 0;
    let finalAmount = originalAmount;

    // 如果使用优惠券，计算折后价
    if (couponId) {
      const couponInfo = await promotionService.validateAndLockCoupon(
        userId,
        couponId,
        originalAmount
      );
      discountAmount = couponInfo.discountAmount;
      finalAmount = originalAmount - discountAmount;
    }

    // 创建订单
    const order = await db.transaction(async (trx) => {
      const orderId = shortid.generate();
      await trx('orders').insert({
        id: orderId,
        user_id: userId,
        plan_type: planType,
        coupon_id: couponId || null,
        original_amount: originalAmount,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        status: 'pending',
        created_at: new Date()
      });

      return orderId;
    });

    // 调用微信支付（使用finalAmount）
    const paymentUrl = await paymentService.createWechatPayment(order, finalAmount);

    res.json({
      success: true,
      data: {
        orderId: order,
        originalAmount,
        discountAmount,
        finalAmount,
        paymentUrl
      }
    });

  } catch (error) {
    next(error);
  }
}
```

### 3. 优惠券锁定和校验
```javascript
// promotion.service.js - validateAndLockCoupon 方法
async validateAndLockCoupon(userId, couponId, orderAmount) {
  return await db.transaction(async (trx) => {
    // 使用行锁查询优惠券
    const coupon = await trx('user_coupons')
      .where({ id: couponId, user_id: userId })
      .forUpdate()
      .first();

    // 校验优惠券
    if (!coupon) throw new Error('优惠券不存在');
    if (coupon.status !== 'unused') throw new Error('优惠券不可用');
    if (new Date(coupon.expire_at) < new Date()) throw new Error('优惠券已过期');

    // 查询活动信息
    const promotion = await trx('promotions')
      .where({ id: coupon.promotion_id })
      .first();

    // 校验订单金额
    if (orderAmount < promotion.min_order_amount) {
      throw new Error(`订单金额不满足使用条件（最低¥${promotion.min_order_amount}）`);
    }

    // 计算折扣金额
    let discountAmount;
    if (promotion.discount_type === 'fixed_amount') {
      discountAmount = promotion.discount_value;
    } else if (promotion.discount_type === 'percentage') {
      discountAmount = Math.floor(orderAmount * promotion.discount_value / 100);
    }

    // 确保折后价不为负
    discountAmount = Math.min(discountAmount, orderAmount);

    // 锁定优惠券
    await trx('user_coupons')
      .where({ id: couponId })
      .update({
        status: 'locked',
        updated_at: new Date()
      });

    return { discountAmount, couponId };
  });
}
```

### 4. 支付回调更新优惠券状态
```javascript
// payment.service.js - handlePaymentCallback 方法改造
async handlePaymentCallback(orderData) {
  return await db.transaction(async (trx) => {
    const order = await trx('orders')
      .where({ id: orderData.orderId })
      .first();

    if (orderData.paymentStatus === 'success') {
      // 更新订单状态
      await trx('orders')
        .where({ id: orderData.orderId })
        .update({ status: 'paid' });

      // 增加用户配额（现有逻辑）
      await trx('users')
        .where({ id: order.user_id })
        .increment('quota_remaining', 100);

      // 🔥 新增：更新优惠券状态为已使用
      if (order.coupon_id) {
        await trx('user_coupons')
          .where({ id: order.coupon_id })
          .update({
            status: 'used',
            order_id: order.id,
            used_at: new Date()
          });
      }

    } else if (orderData.paymentStatus === 'failed' || orderData.paymentStatus === 'timeout') {
      // 更新订单状态为取消
      await trx('orders')
        .where({ id: orderData.orderId })
        .update({ status: 'cancelled' });

      // 🔥 新增：释放优惠券（locked → unused）
      if (order.coupon_id) {
        await trx('user_coupons')
          .where({ id: order.coupon_id, status: 'locked' })
          .update({
            status: 'unused',
            updated_at: new Date()
          });
      }
    }
  });
}
```

---

## 接口详细设计

### 用户端接口

#### 1. GET /promotions/list
**Query参数**：
- `status`（可选）：`active` | `ended`，默认`active`
- `limit`（可选）：每页数量，默认20
- `offset`（可选）：偏移量，默认0

**响应示例**：
```json
{
  "success": true,
  "data": {
    "promotions": [
      {
        "id": "promo_123",
        "name": "双十一特惠",
        "discountType": "fixed_amount",
        "discountValue": 20,
        "minOrderAmount": 99,
        "totalQuota": 1000,
        "claimedCount": 856,
        "userClaimedStatus": "not_claimed"
      }
    ],
    "total": 10
  }
}
```

#### 2. POST /promotions/:id/claim
**请求体**：无

**响应示例**：
```json
{
  "success": true,
  "data": {
    "couponId": "coupon_abc123",
    "message": "领取成功！"
  }
}
```

#### 3. GET /coupons/my
**Query参数**：
- `status`（可选）：`unused` | `used` | `expired`

**响应示例**：
```json
{
  "success": true,
  "data": {
    "coupons": [
      {
        "id": "coupon_abc123",
        "promotionName": "双十一特惠",
        "discountType": "fixed_amount",
        "discountValue": 20,
        "status": "unused",
        "expireAt": "2025-11-11T23:59:59Z"
      }
    ]
  }
}
```

### 管理员端接口

#### 1. POST /admin/promotions
**请求体**：
```json
{
  "name": "双十一特惠",
  "type": "coupon",
  "discountType": "fixed_amount",
  "discountValue": 20,
  "startAt": "2025-11-01T00:00:00Z",
  "endAt": "2025-11-11T23:59:59Z",
  "releaseRule": "manual_claim",
  "minOrderAmount": 99,
  "totalQuota": 1000,
  "maxPerUser": 1
}
```

---

## 禁止事项

### ❌ 严格禁止
1. 不允许跳过优惠券有效性校验
2. 不允许前端传入折后价（必须后端计算）
3. 不允许在非事务环境中更新优惠券状态
4. 不允许修改配额相关逻辑（quota_remaining）

---

## 验证清单

### 功能测试
- [ ] 领取优惠券成功
- [ ] 重复领取提示"已领取"
- [ ] 优惠券库存为0时提示"已抢光"
- [ ] 使用优惠券创建订单，折后价计算正确
- [ ] 支付成功后券状态变为"已使用"
- [ ] 支付失败后券状态恢复为"未使用"

### 并发测试
```bash
# 使用ab工具测试100并发领券
ab -n 100 -c 100 -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/promotions/promo_123/claim
```
- [ ] 最终claimed_count准确，无超发

---

## 交付方式

```bash
git add backend/src/controllers/promotion.controller.js
git add backend/src/services/promotion.service.js
git add backend/src/routes/promotion.routes.js
git commit -m "feat(backend): implement promotion and coupon APIs"
git push origin develop
```

---

## 预计工作量

**预计时间**：3-4天

---

**任务卡结束**
