# 任务卡:后端开发 - 分销代理系统

> **负责技能**:backend_dev_skill
> **功能模块**:分销代理系统
> **任务类型**:后端接口开发
> **优先级**:P0

---

## 任务目标

实现分销代理系统的后端接口,包括用户端分销员申请、推荐关系绑定、佣金结算、提现管理,以及管理员端分销员审核和数据统计功能。

---

## 目录范围

### ✅ 可修改
- `backend/src/controllers/distribution.controller.js`(新建)
- `backend/src/services/distribution.service.js`(新建)
- `backend/src/routes/distribution.routes.js`(新建)
- `backend/src/controllers/admin.controller.js`(新增方法)
- `backend/src/services/payment.service.js`(改造支付回调逻辑)
- `backend/src/middlewares/auth.middleware.js`(新增referrer检测)

### ❌ 禁止修改
- `backend/src/services/quota.service.js`(配额逻辑)
- `backend/src/services/cos.service.js`(COS服务)

---

## 产出物清单

### 1. 用户端接口
- `POST /distribution/apply` - 申请成为分销员
- `GET /distribution/status` - 查询分销员状态
- `GET /distribution/dashboard` - 分销中心数据概览
- `GET /distribution/referrals` - 推广用户列表
- `GET /distribution/commissions` - 佣金明细
- `GET /distribution/withdrawals` - 提现记录
- `POST /distribution/withdraw` - 申请提现

### 2. 管理员端接口
- `GET /admin/distributors` - 分销员列表
- `PATCH /admin/distributors/:id/approve` - 审核分销员申请
- `PATCH /admin/distributors/:id/disable` - 禁用分销员
- `GET /admin/withdrawals` - 提现申请列表
- `PATCH /admin/withdrawals/:id/approve` - 审核通过提现
- `PATCH /admin/withdrawals/:id/reject` - 拒绝提现
- `GET /admin/distribution/stats` - 分销数据统计
- `GET /admin/distribution/settings` - 获取佣金设置
- `PUT /admin/distribution/settings` - 更新佣金设置

### 3. Service层
- `distribution.service.js` - 分销员和推荐关系业务逻辑
- `commission.service.js`(新建) - 佣金计算和结算逻辑
- `payment.service.js`(改造) - 支付回调触发佣金计算

---

## 核心技术要求

### 1. 推荐关系绑定(注册时检测)

```javascript
// auth.controller.js - register方法改造
async register(req, res, next) {
  try {
    const { phone, password, verifyCode, referrerId } = req.body;

    // 校验验证码...

    // 创建用户
    const userId = shortid.generate();
    await db.transaction(async (trx) => {
      await trx('users').insert({
        id: userId,
        phone,
        password: bcrypt.hashSync(password, 10),
        referrer_id: referrerId || null,  // 🔥 记录推荐人
        created_at: new Date()
      });

      // 🔥 如果有推荐人,创建推荐关系
      if (referrerId) {
        await distributionService.bindReferralRelationship(
          trx,
          referrerId,
          userId
        );
      }
    });

    res.json({ success: true, data: { userId } });
  } catch (error) {
    next(error);
  }
}
```

### 2. 绑定推荐关系(事务内执行)

```javascript
// distribution.service.js - bindReferralRelationship方法
async bindReferralRelationship(trx, referrerUserId, referredUserId) {
  // 查询推荐人是否是分销员
  const referrer = await trx('distributors')
    .where({ user_id: referrerUserId, status: 'active' })
    .first();

  if (!referrer) {
    // 推荐人不是分销员,不绑定关系
    return null;
  }

  // 检查被推荐人是否已有推荐关系
  const existingRelation = await trx('referral_relationships')
    .where({ referred_user_id: referredUserId })
    .first();

  if (existingRelation) {
    // 已有推荐关系,不重复绑定
    return null;
  }

  // 创建推荐关系
  const relationId = shortid.generate();
  await trx('referral_relationships').insert({
    id: relationId,
    referrer_user_id: referrerUserId,
    referred_user_id: referredUserId,
    referrer_distributor_id: referrer.id,
    created_at: new Date()
  });

  return relationId;
}
```

### 3. 佣金计算(订单支付成功时触发)

```javascript
// payment.service.js - handlePaymentCallback方法改造
async handlePaymentCallback(orderData) {
  return await db.transaction(async (trx) => {
    const order = await trx('orders')
      .where({ id: orderData.orderId })
      .first();

    if (orderData.paymentStatus === 'success') {
      // 更新订单状态
      await trx('orders')
        .where({ id: orderData.orderId })
        .update({ status: 'paid', paid_at: new Date() });

      // 增加用户配额(现有逻辑)
      await trx('users')
        .where({ id: order.user_id })
        .increment('quota_remaining', 100);

      // 🔥 新增:触发佣金计算
      await commissionService.calculateAndCreateCommission(
        trx,
        order.user_id,
        order.id,
        order.final_amount
      );
    }
  });
}
```

### 4. 佣金计算核心逻辑(首单计佣)

```javascript
// commission.service.js - calculateAndCreateCommission方法
async calculateAndCreateCommission(trx, userId, orderId, orderAmount) {
  // 1. 检查是否是该用户首次购买
  const orderCount = await trx('orders')
    .where({ user_id: userId, status: 'paid' })
    .count('id as count')
    .first();

  if (orderCount.count > 1) {
    // 不是首单,不计佣
    return null;
  }

  // 2. 查询推荐关系
  const relation = await trx('referral_relationships')
    .where({ referred_user_id: userId })
    .first();

  if (!relation) {
    // 没有推荐人,不计佣
    return null;
  }

  // 3. 查询分销员信息
  const distributor = await trx('distributors')
    .where({ id: relation.referrer_distributor_id })
    .first();

  if (!distributor || distributor.status !== 'active') {
    // 分销员不存在或已禁用,不计佣
    return null;
  }

  // 4. 获取佣金比例(从系统设置)
  const settings = await trx('distribution_settings')
    .where({ id: 1 })
    .first();
  const commissionRate = settings?.commission_rate || 15; // 默认15%

  // 5. 计算佣金金额
  const commissionAmount = parseFloat(
    (orderAmount * commissionRate / 100).toFixed(2)
  );

  // 6. 计算冻结截止时间(默认7天)
  const freezeDays = settings?.freeze_days || 7;
  const freezeUntil = new Date();
  freezeUntil.setDate(freezeUntil.getDate() + freezeDays);

  // 7. 创建佣金记录(防止重复计佣:唯一索引)
  const commissionId = shortid.generate();
  try {
    await trx('commissions').insert({
      id: commissionId,
      distributor_id: distributor.id,
      order_id: orderId,
      referred_user_id: userId,
      order_amount: orderAmount,
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
      status: 'frozen',
      freeze_until: freezeUntil,
      created_at: new Date()
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      // 唯一索引冲突,已计佣过,忽略
      return null;
    }
    throw error;
  }

  // 8. 更新分销员累计佣金
  await trx('distributors')
    .where({ id: distributor.id })
    .increment('total_commission', commissionAmount);

  return commissionId;
}
```

### 5. 定时任务:解冻佣金(每小时执行)

```javascript
// cron/unfreeze-commissions.js
async function unfreezeCommissions() {
  await db.transaction(async (trx) => {
    // 查询冻结期已结束的佣金
    const frozenCommissions = await trx('commissions')
      .where({ status: 'frozen' })
      .where('freeze_until', '<=', new Date())
      .select('*');

    for (const commission of frozenCommissions) {
      // 更新佣金状态为可提现
      await trx('commissions')
        .where({ id: commission.id })
        .update({
          status: 'available',
          settled_at: new Date()
        });

      // 增加分销员可提现余额
      await trx('distributors')
        .where({ id: commission.distributor_id })
        .increment('available_commission', commission.commission_amount);
    }

    console.log(`✓ 解冻佣金${frozenCommissions.length}条`);
  });
}

// 每小时执行一次
setInterval(unfreezeCommissions, 60 * 60 * 1000);
```

### 6. 提现申请(行锁+事务)

```javascript
// distribution.controller.js - createWithdrawal方法
async createWithdrawal(req, res, next) {
  try {
    const { amount, method, accountInfo } = req.body;
    const userId = req.user.id;

    // 校验金额格式
    if (!amount || amount < 100) {
      throw new Error('提现金额不能低于¥100');
    }

    const withdrawalId = await db.transaction(async (trx) => {
      // 使用行锁查询分销员
      const distributor = await trx('distributors')
        .where({ user_id: userId })
        .forUpdate()
        .first();

      if (!distributor) {
        throw new Error('您不是分销员');
      }

      if (distributor.status !== 'active') {
        throw new Error('您的分销员资格已被禁用');
      }

      // 检查可提现余额
      if (distributor.available_commission < amount) {
        throw new Error(`可提现余额不足(当前¥${distributor.available_commission})`);
      }

      // 扣除可提现余额
      await trx('distributors')
        .where({ id: distributor.id })
        .decrement('available_commission', amount);

      // 创建提现记录
      const id = shortid.generate();
      await trx('withdrawals').insert({
        id,
        distributor_id: distributor.id,
        amount,
        method,
        account_info: JSON.stringify(accountInfo),
        status: 'pending',
        created_at: new Date()
      });

      return id;
    });

    res.json({
      success: true,
      data: { withdrawalId },
      message: '提现申请已提交,请等待审核'
    });

  } catch (error) {
    next(error);
  }
}
```

### 7. 提现审核通过(管理员操作)

```javascript
// admin.controller.js - approveWithdrawal方法
async approveWithdrawal(req, res, next) {
  try {
    const { id } = req.params;

    await db.transaction(async (trx) => {
      const withdrawal = await trx('withdrawals')
        .where({ id })
        .first();

      if (!withdrawal) {
        throw new Error('提现记录不存在');
      }

      if (withdrawal.status !== 'pending') {
        throw new Error('该提现申请已处理');
      }

      // 更新提现状态
      await trx('withdrawals')
        .where({ id })
        .update({
          status: 'approved',
          approved_at: new Date()
        });

      // 更新分销员已提现金额
      await trx('distributors')
        .where({ id: withdrawal.distributor_id })
        .increment('withdrawn_commission', withdrawal.amount);
    });

    res.json({
      success: true,
      message: '审核通过,请尽快打款'
    });

  } catch (error) {
    next(error);
  }
}
```

### 8. 提现审核拒绝(退还余额)

```javascript
// admin.controller.js - rejectWithdrawal方法
async rejectWithdrawal(req, res, next) {
  try {
    const { id } = req.params;
    const { rejectReason } = req.body;

    await db.transaction(async (trx) => {
      const withdrawal = await trx('withdrawals')
        .where({ id })
        .first();

      if (!withdrawal) {
        throw new Error('提现记录不存在');
      }

      if (withdrawal.status !== 'pending') {
        throw new Error('该提现申请已处理');
      }

      // 更新提现状态为已拒绝
      await trx('withdrawals')
        .where({ id })
        .update({
          status: 'rejected',
          reject_reason: rejectReason,
          approved_at: new Date()
        });

      // 退还可提现余额
      await trx('distributors')
        .where({ id: withdrawal.distributor_id })
        .increment('available_commission', withdrawal.amount);
    });

    res.json({
      success: true,
      message: '已拒绝提现申请'
    });

  } catch (error) {
    next(error);
  }
}
```

---

## 接口详细设计

### 用户端接口

#### 1. POST /distribution/apply
**请求体**:
```json
{
  "realName": "张三",
  "idCard": "110101199001011234",
  "contact": "13800138000",
  "channel": "个人博客、朋友圈"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "distributorId": "dist_abc123",
    "status": "pending",
    "message": "申请已提交,请等待审核"
  }
}
```

#### 2. GET /distribution/status
**响应示例**:
```json
{
  "success": true,
  "data": {
    "isDistributor": true,
    "status": "active",
    "inviteCode": "ABC123",
    "inviteLink": "https://yourapp.com/register?ref=user_123"
  }
}
```

#### 3. GET /distribution/dashboard
**响应示例**:
```json
{
  "success": true,
  "data": {
    "totalReferrals": 25,
    "paidReferrals": 18,
    "totalCommission": 1280.50,
    "availableCommission": 450.00,
    "frozenCommission": 120.50,
    "withdrawnCommission": 710.00
  }
}
```

#### 4. GET /distribution/referrals
**Query参数**:
- `status`(可选):`all` | `paid` | `unpaid`
- `limit`(可选):每页数量,默认20
- `offset`(可选):偏移量,默认0

**响应示例**:
```json
{
  "success": true,
  "data": {
    "referrals": [
      {
        "userId": "user_456",
        "phone": "138****8888",
        "registeredAt": "2025-10-20T10:30:00Z",
        "hasPaid": true,
        "paidAt": "2025-10-21T15:20:00Z",
        "commissionAmount": 14.85
      }
    ],
    "total": 25
  }
}
```

#### 5. GET /distribution/commissions
**Query参数**:
- `status`(可选):`frozen` | `available` | `withdrawn`

**响应示例**:
```json
{
  "success": true,
  "data": {
    "commissions": [
      {
        "id": "comm_789",
        "orderId": "order_123",
        "referredUserPhone": "138****8888",
        "orderAmount": 99.00,
        "commissionAmount": 14.85,
        "status": "available",
        "createdAt": "2025-10-21T15:20:00Z",
        "settledAt": "2025-10-28T15:20:00Z"
      }
    ]
  }
}
```

#### 6. POST /distribution/withdraw
**请求体**:
```json
{
  "amount": 450.00,
  "method": "wechat",
  "accountInfo": {
    "name": "张三",
    "account": "wechat_abc123"
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "withdrawalId": "wd_xyz789",
    "message": "提现申请已提交,请等待审核"
  }
}
```

### 管理员端接口

#### 1. GET /admin/distributors
**Query参数**:
- `status`(可选):`pending` | `active` | `disabled`
- `keyword`(可选):搜索关键词
- `limit`,`offset`:分页

**响应示例**:
```json
{
  "success": true,
  "data": {
    "distributors": [
      {
        "id": "dist_abc123",
        "userId": "user_123",
        "phone": "138****8888",
        "realName": "张三",
        "status": "active",
        "totalReferrals": 25,
        "totalCommission": 1280.50,
        "appliedAt": "2025-10-15T10:00:00Z",
        "approvedAt": "2025-10-16T14:30:00Z"
      }
    ],
    "total": 50
  }
}
```

#### 2. GET /admin/distribution/stats
**响应示例**:
```json
{
  "success": true,
  "data": {
    "totalDistributors": 50,
    "activeDistributors": 42,
    "totalReferrals": 856,
    "paidReferrals": 623,
    "totalCommissionPaid": 92480.50,
    "pendingWithdrawals": 15,
    "pendingWithdrawalAmount": 12800.00
  }
}
```

---

## 禁止事项

### ❌ 严格禁止
1. 不允许前端传入佣金金额(必须后端计算)
2. 不允许同一订单重复计佣(必须有唯一索引)
3. 不允许跳过提现金额校验
4. 不允许在非事务环境中扣除可提现余额
5. 不允许佣金计算影响用户配额(quota_remaining)

---

## 验证清单

### 功能测试
- [ ] 用户通过推荐链接注册,推荐关系正确绑定
- [ ] 被推荐用户首次购买会员,佣金正确计算
- [ ] 佣金进入7天冻结期
- [ ] 7天后佣金自动转为可提现
- [ ] 分销员提现申请成功
- [ ] 管理员审核通过提现,余额正确扣除
- [ ] 管理员拒绝提现,余额正确退还

### 财务安全测试
- [ ] 佣金基于订单实付金额计算
- [ ] 同一订单无法重复计佣(唯一索引生效)
- [ ] 提现金额不能超过可提现余额
- [ ] 被推荐用户第二次购买不产生佣金

### 数据一致性验证
```sql
-- 验证1:分销员累计佣金 = 佣金记录之和
SELECT
  d.total_commission AS distributor_total,
  SUM(c.commission_amount) AS commission_sum
FROM distributors d
LEFT JOIN commissions c ON d.id = c.distributor_id
WHERE d.id = 'dist_abc123'
GROUP BY d.id;

-- 验证2:可提现佣金 = 累计佣金 - 冻结佣金 - 已提现佣金
SELECT
  d.total_commission,
  d.available_commission,
  d.withdrawn_commission,
  SUM(CASE WHEN c.status = 'frozen' THEN c.commission_amount ELSE 0 END) AS frozen_sum
FROM distributors d
LEFT JOIN commissions c ON d.id = c.distributor_id
WHERE d.id = 'dist_abc123'
GROUP BY d.id;
```

---

## 交付方式

```bash
git add backend/src/controllers/distribution.controller.js
git add backend/src/services/distribution.service.js
git add backend/src/services/commission.service.js
git add backend/src/routes/distribution.routes.js
git add backend/cron/unfreeze-commissions.js
git commit -m "feat(backend): implement distribution and commission APIs"
git push origin develop
```

---

## 预计工作量

**预计时间**:4-5天

---

**任务卡结束**
