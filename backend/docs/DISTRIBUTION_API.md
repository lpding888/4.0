# 分销系统 API 文档

> **更新时间**: 2025-10-30
> **作者**: 老王（后端开发）

---

## 📋 目录

- [用户端接口（8个）](#用户端接口)
- [管理端接口（9个）](#管理端接口)
- [错误码说明](#错误码说明)

---

## 用户端接口

所有用户端接口都需要JWT认证，请在请求头中携带 `Authorization: Bearer <token>`

### 1. 申请成为分销员

**接口**: `POST /api/distribution/apply`

**请求体**:
```json
{
  "realName": "张三",
  "idCard": "110101199001011234",
  "contact": "13800138000",
  "channel": "微信朋友圈"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "distributorId": "abc123",
    "inviteCode": "A1B2C3",
    "status": "pending"
  },
  "message": "申请已提交，请等待审核"
}
```

---

### 2. 查询分销员状态（简单版）

**接口**: `GET /api/distribution/status`

**响应**:
```json
{
  "success": true,
  "data": {
    "isDistributor": true,
    "status": "active",
    "inviteCode": "A1B2C3",
    "inviteLink": "https://yourapp.com/register?ref=USER_ID_123",
    "approvalTime": "2025-10-29T10:00:00.000Z"
  }
}
```

**状态说明**:
- `pending`: 待审核
- `active`: 已激活
- `disabled`: 已禁用

---

### 3. 查询分销员详细信息（新增）⭐

**接口**: `GET /api/distribution/detail`

**响应**:
```json
{
  "success": true,
  "data": {
    // 基本信息
    "id": "distributor_123",
    "userId": "user_456",
    "phone": "138****8000",
    "realName": "张三",
    "contact": "13800138000",
    "channel": "微信朋友圈",
    "status": "active",
    "inviteCode": "A1B2C3",
    "inviteLink": "https://yourapp.com/register?ref=user_456",

    // 申请与审核信息
    "appliedAt": "2025-10-28T10:00:00.000Z",
    "approvalTime": "2025-10-29T10:00:00.000Z",

    // 推广数据
    "totalReferrals": 50,
    "paidReferrals": 30,

    // 佣金数据
    "totalCommission": 450.00,
    "availableCommission": 200.00,
    "frozenCommission": 150.00,
    "withdrawnCommission": 100.00,
    "pendingWithdrawal": 50.00
  }
}
```

---

### 4. 分销中心数据概览

**接口**: `GET /api/distribution/dashboard`

**响应**:
```json
{
  "success": true,
  "data": {
    "totalReferrals": 50,
    "paidReferrals": 30,
    "totalCommission": 450.00,
    "availableCommission": 200.00,
    "frozenCommission": 150.00,
    "withdrawnCommission": 100.00
  }
}
```

---

### 5. 推广用户列表

**接口**: `GET /api/distribution/referrals?status=all&limit=20&offset=0`

**查询参数**:
- `status`: 筛选状态（`all`/`paid`/`unpaid`），默认 `all`
- `limit`: 每页数量，默认 `20`
- `offset`: 偏移量，默认 `0`

**响应**:
```json
{
  "success": true,
  "data": {
    "referrals": [
      {
        "userId": "user_789",
        "phone": "138****8000",
        "registeredAt": "2025-10-25T10:00:00.000Z",
        "hasPaid": true,
        "paidAt": "2025-10-26T15:30:00.000Z",
        "commissionAmount": 15.00
      }
    ],
    "total": 50
  }
}
```

---

### 6. 佣金明细

**接口**: `GET /api/distribution/commissions?status=all&limit=20&offset=0`

**查询参数**:
- `status`: 筛选状态（`all`/`frozen`/`available`/`cancelled`），默认 `all`
- `limit`: 每页数量，默认 `20`
- `offset`: 偏移量，默认 `0`

**响应**:
```json
{
  "success": true,
  "data": {
    "commissions": [
      {
        "id": "commission_123",
        "orderId": "order_456",
        "referredUserPhone": "138****8000",
        "orderAmount": 99.00,
        "commissionAmount": 15.00,
        "status": "available",
        "createdAt": "2025-10-26T15:30:00.000Z",
        "settledAt": "2025-11-02T15:30:00.000Z"
      }
    ],
    "total": 30
  }
}
```

**佣金状态说明**:
- `frozen`: 冻结中（7天冻结期）
- `available`: 可提现
- `cancelled`: 已取消（订单退款）

---

### 7. 提现记录

**接口**: `GET /api/distribution/withdrawals?limit=20&offset=0`

**查询参数**:
- `limit`: 每页数量，默认 `20`
- `offset`: 偏移量，默认 `0`

**响应**:
```json
{
  "success": true,
  "data": {
    "withdrawals": [
      {
        "id": "withdrawal_123",
        "amount": 50.00,
        "method": "alipay",
        "accountInfo": {
          "account": "138****8000",
          "name": "张三"
        },
        "status": "pending",
        "rejectReason": null,
        "createdAt": "2025-10-30T10:00:00.000Z",
        "approvedAt": null
      }
    ],
    "total": 5
  }
}
```

**提现状态说明**:
- `pending`: 待审核
- `approved`: 已通过
- `rejected`: 已拒绝

---

### 8. 申请提现

**接口**: `POST /api/distribution/withdraw`

**请求体**:
```json
{
  "amount": 50.00,
  "method": "alipay",
  "accountInfo": {
    "account": "13800138000",
    "name": "张三"
  }
}
```

**提现方式**:
- `alipay`: 支付宝
- `wechat`: 微信
- `bank`: 银行卡

**响应**:
```json
{
  "success": true,
  "data": {
    "withdrawalId": "withdrawal_123"
  },
  "message": "提现申请已提交，请等待审核"
}
```

---

## 管理端接口

所有管理端接口都需要JWT认证 + 管理员权限

**接口数量**: 11个

### 1. 分销员列表

**接口**: `GET /api/admin/distributors?status=all&keyword=&limit=20&offset=0`

**查询参数**:
- `status`: 筛选状态（`all`/`pending`/`active`/`disabled`），默认不筛选
- `keyword`: 关键词搜索（姓名/手机号/邀请码）
- `limit`: 每页数量，默认 `20`
- `offset`: 偏移量，默认 `0`

**响应**:
```json
{
  "success": true,
  "data": {
    "distributors": [
      {
        "id": "distributor_123",
        "user_id": "user_456",
        "phone": "138****8000",
        "real_name": "张三",
        "id_card": "110101199001011234",
        "contact": "13800138000",
        "channel": "微信朋友圈",
        "status": "active",
        "invite_code": "A1B2C3",
        "total_commission": 450.00,
        "available_commission": 200.00,
        "withdrawn_commission": 100.00,
        "created_at": "2025-10-28T10:00:00.000Z",
        "approval_time": "2025-10-29T10:00:00.000Z",
        "totalReferrals": 50
      }
    ],
    "total": 100
  }
}
```

---

### 2. 分销员详细信息（新增）⭐

**接口**: `GET /api/admin/distributors/:id`

**响应**:
```json
{
  "success": true,
  "data": {
    // 基本信息
    "id": "distributor_123",
    "userId": "user_456",
    "phone": "13800138000",
    "realName": "张三",
    "idCard": "110101199001011234",
    "contact": "13800138000",
    "channel": "微信朋友圈",
    "status": "active",
    "inviteCode": "A1B2C3",
    "inviteLink": "https://yourapp.com/register?ref=user_456",

    // 申请与审核信息
    "appliedAt": "2025-10-28T10:00:00.000Z",
    "approvalTime": "2025-10-29T10:00:00.000Z",
    "updatedAt": "2025-10-30T10:00:00.000Z",

    // 推广数据
    "totalReferrals": 50,
    "paidReferrals": 30,

    // 佣金数据
    "totalCommission": 450.00,
    "availableCommission": 200.00,
    "frozenCommission": 150.00,
    "withdrawnCommission": 100.00,
    "pendingWithdrawal": 50.00,

    // 提现记录数
    "withdrawalCount": 5
  }
}
```

---

### 3. 分销员推广用户列表（新增）⭐

**接口**: `GET /api/admin/distributors/:id/referrals?status=all&limit=20&offset=0`

**查询参数**:
- `status`: 筛选状态（`all`/`paid`/`unpaid`），默认 `all`
- `limit`: 每页数量，默认 `20`
- `offset`: 偏移量，默认 `0`

**响应**:
```json
{
  "success": true,
  "data": {
    "referrals": [
      {
        "userId": "user_789",
        "phone": "13800138000",
        "registeredAt": "2025-10-25T10:00:00.000Z",
        "hasPaid": true,
        "paidAt": "2025-10-26T15:30:00.000Z",
        "commissionAmount": 15.00
      }
    ],
    "total": 50
  }
}
```

**说明**:
- 管理端显示**完整手机号**（不脱敏）
- 可以查看指定分销员的所有推广用户
- 支持按付费状态筛选

---

### 4. 分销员佣金记录（新增）⭐

**接口**: `GET /api/admin/distributors/:id/commissions?status=all&limit=20&offset=0`

**查询参数**:
- `status`: 筛选状态（`all`/`frozen`/`available`/`cancelled`），默认 `all`
- `limit`: 每页数量，默认 `20`
- `offset`: 偏移量，默认 `0`

**响应**:
```json
{
  "success": true,
  "data": {
    "commissions": [
      {
        "id": "commission_123",
        "orderId": "order_456",
        "userId": "user_789",
        "referredUserPhone": "13800138000",
        "orderAmount": 99.00,
        "commissionAmount": 15.00,
        "commissionRate": 15.00,
        "status": "available",
        "freezeUntil": "2025-11-02T15:30:00.000Z",
        "createdAt": "2025-10-26T15:30:00.000Z",
        "settledAt": "2025-11-02T15:30:00.000Z"
      }
    ],
    "total": 30
  }
}
```

**说明**:
- 管理端显示**完整手机号**（不脱敏）
- 可以查看指定分销员的所有佣金记录
- 支持按佣金状态筛选
- 额外返回 `commissionRate`（佣金比例）和 `freezeUntil`（冻结截止时间）

---

### 5. 审核分销员申请

**接口**: `PATCH /api/admin/distributors/:id/approve`

**响应**:
```json
{
  "success": true,
  "message": "分销员已激活"
}
```

---

### 6. 禁用分销员

**接口**: `PATCH /api/admin/distributors/:id/disable`

**响应**:
```json
{
  "success": true,
  "message": "分销员已禁用"
}
```

---

### 7. 提现申请列表

**接口**: `GET /api/admin/withdrawals?status=all&limit=20&offset=0`

**查询参数**:
- `status`: 筛选状态（`all`/`pending`/`approved`/`rejected`），默认不筛选
- `limit`: 每页数量，默认 `20`
- `offset`: 偏移量，默认 `0`

**响应**:
```json
{
  "success": true,
  "data": {
    "withdrawals": [
      {
        "id": "withdrawal_123",
        "distributor_id": "distributor_123",
        "realName": "张三",
        "phone": "138****8000",
        "amount": 50.00,
        "method": "alipay",
        "account_info": "{\"account\":\"13800138000\",\"name\":\"张三\"}",
        "status": "pending",
        "reject_reason": null,
        "created_at": "2025-10-30T10:00:00.000Z",
        "approved_at": null
      }
    ],
    "total": 20
  }
}
```

---

### 8. 审核通过提现

**接口**: `PATCH /api/admin/withdrawals/:id/approve`

**响应**:
```json
{
  "success": true,
  "message": "审核通过，请尽快打款"
}
```

---

### 9. 拒绝提现

**接口**: `PATCH /api/admin/withdrawals/:id/reject`

**请求体**:
```json
{
  "rejectReason": "账户信息有误，请重新提交"
}
```

**响应**:
```json
{
  "success": true,
  "message": "已拒绝提现申请"
}
```

---

### 10. 分销数据统计

**接口**: `GET /api/admin/distribution/stats`

**响应**:
```json
{
  "success": true,
  "data": {
    "totalDistributors": 100,
    "activeDistributors": 80,
    "pendingDistributors": 10,
    "totalCommission": 45000.00,
    "availableCommission": 20000.00,
    "withdrawnCommission": 15000.00,
    "pendingWithdrawals": 10,
    "pendingWithdrawalAmount": 5000.00
  }
}
```

---

### 11. 获取/更新系统设置

**获取设置**: `GET /api/admin/distribution/settings`

**响应**:
```json
{
  "success": true,
  "data": {
    "commission_rate": 15,
    "freeze_days": 7,
    "min_withdrawal_amount": 100
  }
}
```

**更新设置**: `PUT /api/admin/distribution/settings`

**请求体**:
```json
{
  "commission_rate": 15,
  "freeze_days": 7,
  "min_withdrawal_amount": 100
}
```

**响应**:
```json
{
  "success": true,
  "message": "系统设置已更新"
}
```

---

## 错误码说明

| 错误码 | 含义 | HTTP状态码 |
|--------|------|-----------|
| 6000 | 请求参数不完整 | 400 |
| 6001 | 用户不存在 | 404 |
| 6002 | 申请审核中 | 400 |
| 6003 | 已是分销员 | 400 |
| 6004 | 分销员已禁用 | 400 |
| 6005 | 不是活跃分销员 | 403 |
| 6006 | 提现金额无效 | 400 |
| 6007 | 不是分销员 / 分销员不存在 | 404 / 403 |
| 6008 | 分销员资格已被禁用 | 403 |
| 6009 | 低于最低提现金额 | 400 |
| 6010 | 可提现余额不足 | 400 |
| 6011 | 分销员不存在（管理端） | 404 |
| 6012 | 分销员状态不正确 | 400 |
| 6013 | 提现记录不存在 | 404 |
| 6014 | 提现申请已处理 | 400 |
| 6015 | 未填写拒绝原因 | 400 |

---

## 🔐 安全措施

### 用户端
- 所有接口需要JWT认证
- 手机号脱敏（135****8000）
- 仅能查看自己的数据

### 管理端
- JWT认证 + 管理员角色校验
- 可查看完整手机号和身份证
- 提现审核使用行锁防并发

### 数据库
- 事务保护所有关键操作
- 行锁保护提现申请和审核
- 唯一索引防止重复计佣
- 首单计佣检查
- 7天冻结期保护

---

## 📝 业务规则

1. **推荐关系绑定**：用户注册时，如果携带 `ref` 参数，会自动绑定推荐关系（一次性，不可修改）
2. **首单计佣**：只有用户首次付费会产生佣金，后续付费不再计佣
3. **佣金冻结期**：佣金生成后冻结7天，防止订单退款作弊
4. **佣金解冻**：定时任务每小时自动解冻到期佣金
5. **提现限制**：最低提现金额 ¥100（可在系统设置中调整）
6. **提现审核**：管理员审核通过后，需手动打款到分销员账户

---

**✅ 文档完成**: 分销系统API文档已更新

**更新内容**:
- 新增用户端分销员详情接口
- 新增管理端分销员详情接口
- 新增管理端分销员推广用户列表接口
- 新增管理端分销员佣金记录接口

**接口统计**:
- 用户端接口：8个
- 管理端接口：11个
- 总计：19个

**作者**: 老王（后端开发）
**更新日期**: 2025-10-30
**更新轮次**: 第二轮（补齐P0接口）
