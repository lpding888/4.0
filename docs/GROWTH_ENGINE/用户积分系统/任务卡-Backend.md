# 任务卡 - 后端开发 (用户积分系统)

> **系统**: 用户积分系统
> **负责人**: Backend Dev Skill
> **预计工期**: 5天
> **优先级**: P0
> **依赖**: 数据库迁移任务必须完成

---

## 📋 任务概述

本任务负责开发用户积分系统的全部后端API接口和核心业务逻辑，包括：

**核心功能模块**：
1. 积分账户管理（查询、调整）
2. 积分获取（签到、任务、购买会员）
3. 积分消费（兑换配额、兑换商城商品）
4. 积分商城管理（商品CRUD、上下架）
5. 定时任务（过期积分清理）

**技术要求**：
- 使用事务保证数据一致性
- 使用行锁防止并发超扣
- 实现FIFO积分消费逻辑
- 完善的错误处理和日志记录
- Redis缓存优化高频查询

---

## 🎯 功能需求

### 模块1: 积分账户管理

#### 1.1 查询用户积分账户

**需求描述**：
用户查询自己的积分账户信息，包括可用积分、累计积分、已使用积分、已过期积分等。

**接口设计**：
```
GET /api/points/account
Authorization: Bearer <token>
```

**响应示例**：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "user_id": "user_abc123",
    "total_points": 1500,
    "available_points": 850,
    "frozen_points": 0,
    "used_points": 500,
    "expired_points": 150
  }
}
```

**技术要点**：
- 从Token中解析用户ID
- 优先从Redis缓存读取，缓存TTL=5分钟
- 如果账户不存在，自动创建（初始值全为0）

---

#### 1.2 管理员手动调整用户积分

**需求描述**：
管理员可以手动增加或减少用户积分，用于补偿或处罚。

**接口设计**：
```
POST /api/admin/points/adjust
Authorization: Bearer <admin_token>

Request Body:
{
  "user_id": "user_abc123",
  "change_amount": 100,     // 正数表示增加，负数表示减少
  "reason": "补偿用户"
}
```

**响应示例**：
```json
{
  "code": 0,
  "message": "调整成功",
  "data": {
    "user_id": "user_abc123",
    "change_amount": 100,
    "available_points": 950
  }
}
```

**技术要点**：
- 校验管理员权限
- 使用事务+行锁防止并发问题
- 记录积分变动流水（source_type='manual'）
- 调整后立即删除Redis缓存

---

### 模块2: 积分获取

#### 2.1 每日签到

**需求描述**：
用户每天可以签到一次，连续签到积分递增（第1天2积分，第2天4积分...第5天及以后10积分），中断后重置。

**接口设计**：
```
POST /api/points/checkin
Authorization: Bearer <token>
```

**响应示例**：
```json
{
  "code": 0,
  "message": "签到成功",
  "data": {
    "consecutive_days": 3,
    "points_earned": 6,
    "available_points": 856
  }
}
```

**错误响应**：
```json
{
  "code": 40001,
  "message": "今天已签到过了"
}
```

**业务逻辑**：
1. 检查今天是否已签到（查询`checkin_records`表，唯一约束：user_id + checkin_date）
2. 查询昨天的签到记录，计算连续天数
   - 如果昨天有签到：连续天数+1
   - 如果昨天没签到：连续天数=1（重新开始）
3. 根据连续天数计算积分（第1-4天递增，第5天及以后固定10积分）
4. 使用事务：
   - 创建签到记录
   - 发放积分（调用公共函数`grantPoints`）

**技术要点**：
- 使用服务器时间，禁止客户端时间篡改
- 唯一约束防止重复签到
- 签到状态缓存到Redis（key: `points:checkin:{user_id}:{date}`，TTL=24小时）

---

#### 2.2 完成任务

**需求描述**：
用户完成指定任务后获得积分，任务分为一次性任务和可重复任务，可重复任务有每日/每月限制。

**接口设计**：
```
POST /api/points/tasks/complete
Authorization: Bearer <token>

Request Body:
{
  "task_type": "profile_complete",
  "related_id": null
}
```

**任务类型**：
| 任务类型 | 积分奖励 | 可重复 | 限制 |
|---------|---------|--------|------|
| profile_complete | 20积分 | 否 | 一次性 |
| first_use | 30积分 | 否 | 一次性 |
| share | 10积分 | 是 | 每天限3次 |
| invite | 50积分 | 是 | 每月限5人 |
| purchase | 100积分 | 否 | 一次性 |
| review | 5积分 | 是 | 每天限10次 |

**响应示例**：
```json
{
  "code": 0,
  "message": "任务完成",
  "data": {
    "task_type": "profile_complete",
    "points_earned": 20,
    "available_points": 870
  }
}
```

**业务逻辑**：
1. 校验任务类型是否合法
2. 检查任务是否已完成（一次性任务）
3. 检查完成次数限制（可重复任务）
   - 每日限制：查询今天完成次数
   - 每月限制：查询本月完成次数
4. 使用事务：
   - 创建任务完成记录
   - 发放积分（调用公共函数`grantPoints`）

**技术要点**：
- 任务配置写在代码中（便于灵活调整）
- 完成次数缓存到Redis（key: `points:task:{user_id}:{task_type}:{date/month}`）
- 邀请任务需要校验推荐关系真实性

---

#### 2.3 购买会员赠送积分

**需求描述**：
用户购买会员时，按照充值金额的1:10比例赠送积分（充值100元=10积分），积分在订单支付成功后立即发放。

**触发时机**：
订单支付成功回调时自动触发（不需要用户主动调用API）

**业务逻辑**：
1. 订单支付成功后，订单服务调用积分服务发放积分
2. 检查该订单是否已发放过积分（防止重复发放）
3. 计算积分：`Math.floor(订单实付金额 / 10)`
4. 发放积分（调用公共函数`grantPoints`，source_type='purchase'）

**技术要点**：
- 使用订单ID作为`related_id`，防止重复发放
- 退款时需要扣除已发放的积分（调用`consumePoints`）

---

### 模块3: 积分消费

#### 3.1 兑换配额（核心功能）

**需求描述**：
用户使用积分兑换处理配额，兑换比例为100积分=1个配额，最低兑换100积分，每次最多兑换50个配额（5000积分）。

**接口设计**：
```
POST /api/points/redeem/quota
Authorization: Bearer <token>

Request Body:
{
  "quota_count": 8
}
```

**响应示例**：
```json
{
  "code": 0,
  "message": "兑换成功",
  "data": {
    "quota_count": 8,
    "points_cost": 800,
    "available_points": 50,
    "quota_balance": 108
  }
}
```

**错误响应**：
```json
{
  "code": 40002,
  "message": "可用积分不足"
}
```

**业务逻辑**：
1. 校验兑换数量（1-50之间）
2. 计算所需积分：`quota_count * 100`
3. 使用事务+行锁：
   - 查询积分账户（forUpdate锁行）
   - 检查可用积分是否足够
   - 扣除积分（调用公共函数`consumePoints`，实现FIFO逻辑）
   - 增加配额（更新users表的quota_balance）
   - 创建兑换记录

**技术要点**：
- 必须使用行锁（forUpdate）防止并发超扣
- 积分消费实现FIFO逻辑（优先消耗即将过期的积分）
- 事务保证原子性（扣积分和加配额必须同时成功）

---

#### 3.2 查询商城商品列表

**需求描述**：
用户查询积分商城的商品列表，支持按商品类型筛选。

**接口设计**：
```
GET /api/points/mall/items?item_type=coupon
Authorization: Bearer <token>
```

**响应示例**：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": "item_coupon_50",
        "item_type": "coupon",
        "item_name": "50元优惠券",
        "item_description": "适用于所有套餐,有效期30天",
        "points_required": 500,
        "item_value": 50,
        "stock": -1,
        "monthly_limit": 2,
        "status": "active",
        "image_url": "https://..."
      }
    ]
  }
}
```

**技术要点**：
- 只返回status='active'的商品
- 按sort_order升序排列
- 商品列表缓存到Redis（key: `points:mall:items`，TTL=10分钟）

---

#### 3.3 兑换商城商品

**需求描述**：
用户使用积分兑换商城商品（优惠券、会员、特权），需要检查库存和每月兑换次数限制。

**接口设计**：
```
POST /api/points/mall/redeem
Authorization: Bearer <token>

Request Body:
{
  "item_id": "item_coupon_50"
}
```

**响应示例**：
```json
{
  "code": 0,
  "message": "兑换成功",
  "data": {
    "redemption_id": "redemption_xyz789",
    "item_name": "50元优惠券",
    "points_cost": 500,
    "coupon_code": "COUP-ABC12345",
    "expire_at": "2025-11-30 23:59:59"
  }
}
```

**业务逻辑**：
1. 查询商品信息（检查是否存在、是否上架）
2. 检查库存（如果stock != -1，检查库存是否充足）
3. 检查每月兑换次数限制（如果有monthly_limit）
4. 使用事务+行锁：
   - 查询积分账户（forUpdate锁行）
   - 检查可用积分是否足够
   - 扣除积分（调用公共函数`consumePoints`）
   - 扣除库存（如果有限制）
   - 根据商品类型执行对应操作：
     - 优惠券：生成优惠券码，创建优惠券记录
     - 会员：延长会员时长
     - 特权：创建特权记录
   - 创建兑换记录

**技术要点**：
- 必须使用行锁防止并发超扣
- 优惠券码生成规则：`COUP-{8位随机大写字母数字}`
- 兑换次数限制缓存到Redis

---

#### 3.4 查询积分明细

**需求描述**：
用户查询自己的积分变动明细，支持按类型筛选和分页。

**接口设计**：
```
GET /api/points/records?change_type=earn&page=1&page_size=20
Authorization: Bearer <token>
```

**响应示例**：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "records": [
      {
        "id": "points_rec_xyz789",
        "change_type": "earn",
        "change_amount": 6,
        "source_type": "checkin",
        "source_description": "连续签到第3天",
        "balance_after": 856,
        "expire_at": "2026-10-30",
        "created_at": "2025-10-30 08:00:00"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 45
    }
  }
}
```

**技术要点**：
- 按created_at降序排列（最新的在前面）
- 分页查询（默认每页20条）
- 支持按change_type筛选（earn/consume/expire）

---

### 模块4: 积分商城管理（管理员）

#### 4.1 查询积分统计数据

**需求描述**：
管理员查询积分系统的统计数据，包括总发放积分、总消费积分、签到人次、兑换配额数量等。

**接口设计**：
```
GET /api/admin/points/statistics
Authorization: Bearer <admin_token>
```

**响应示例**：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "total_points_granted": 1250000,
    "total_points_consumed": 850000,
    "total_points_expired": 50000,
    "checkin_count": 8500,
    "quota_redeem_count": 2150,
    "membership_redeem_count": 320,
    "points_trend": [
      { "date": "2025-10-01", "granted": 35000, "consumed": 25000 }
    ]
  }
}
```

**技术要点**：
- 统计数据从points_records表聚合计算
- 趋势数据按天分组统计（最近30天）
- 统计结果缓存到Redis（TTL=30分钟）

---

#### 4.2 查询用户积分列表

**需求描述**：
管理员查询所有用户的积分账户信息，支持搜索和分页。

**接口设计**：
```
GET /api/admin/points/users?search=138&page=1&page_size=20
Authorization: Bearer <admin_token>
```

**响应示例**：
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "users": [
      {
        "user_id": "user_abc123",
        "phone": "138****8888",
        "available_points": 850,
        "total_points": 1500,
        "used_points": 500
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 1250
    }
  }
}
```

**技术要点**：
- 关联users表查询用户信息（phone字段）
- 支持按user_id或phone搜索
- 按available_points降序排列

---

#### 4.3 冻结/解冻用户积分

**需求描述**：
管理员可以冻结或解冻用户的积分，用于处理异常行为。

**接口设计**：
```
POST /api/admin/points/freeze
Authorization: Bearer <admin_token>

Request Body:
{
  "user_id": "user_abc123",
  "amount": 500,
  "reason": "异常行为"
}
```

**响应示例**：
```json
{
  "code": 0,
  "message": "冻结成功",
  "data": {
    "user_id": "user_abc123",
    "frozen_points": 500,
    "available_points": 350
  }
}
```

**业务逻辑**：
1. 校验管理员权限
2. 使用事务+行锁：
   - 查询积分账户（forUpdate锁行）
   - 检查可用积分是否足够（冻结时）或冻结积分是否足够（解冻时）
   - 更新积分账户（可用积分↔冻结积分）
   - 创建积分变动流水（change_type='freeze'或'unfreeze'）

**技术要点**：
- 冻结和解冻是两个独立的接口
- 冻结积分不能使用，但不会过期
- 解冻后积分恢复可用，过期时间不变

---

#### 4.4 新增/编辑商城商品

**需求描述**：
管理员可以新增或编辑积分商城的商品，包括商品名称、所需积分、库存、限制等。

**接口设计**：
```
POST /api/admin/points/mall/items
PUT /api/admin/points/mall/items/:id
Authorization: Bearer <admin_token>

Request Body:
{
  "item_type": "coupon",
  "item_name": "50元优惠券",
  "item_description": "适用于所有套餐,有效期30天",
  "points_required": 500,
  "item_value": 50,
  "stock": -1,
  "monthly_limit": 2,
  "status": "active",
  "sort_order": 1
}
```

**技术要点**：
- 新增时自动生成商品ID
- 编辑后立即删除商品列表缓存
- 校验字段合法性（points_required > 0，item_value > 0）

---

#### 4.5 上架/下架商品

**需求描述**：
管理员可以上架或下架商品，下架后用户无法兑换。

**接口设计**：
```
PUT /api/admin/points/mall/items/:id/status
Authorization: Bearer <admin_token>

Request Body:
{
  "status": "inactive"
}
```

**技术要点**：
- status只能是'active'或'inactive'
- 更新后立即删除商品列表缓存

---

### 模块5: 公共函数

#### 5.1 发放积分（grantPoints）

**函数签名**：
```javascript
async function grantPoints(trx, userId, amount, sourceType, description, relatedId = null)
```

**功能**：
1. 查询积分账户（如果不存在则创建）
2. 更新积分账户（total_points +amount, available_points +amount）
3. 创建积分记录（change_type='earn'，expire_at=365天后）

**技术要点**：
- 必须在事务中调用
- 所有积分获取操作都调用此函数（保证逻辑一致）

---

#### 5.2 消费积分（consumePoints，FIFO逻辑）

**函数签名**：
```javascript
async function consumePoints(trx, userId, amount, sourceType, description, relatedId = null)
```

**功能**：
1. 查询积分账户（forUpdate锁行）
2. 检查可用积分是否足够
3. 查询可用积分记录（change_type='earn'，is_expired=false，按expire_at升序）
4. 按FIFO顺序扣减积分：
   - 从最早过期的记录开始扣减
   - 记录消费关联（创建points_consumptions记录）
5. 更新积分账户（available_points -amount, used_points +amount）
6. 创建积分记录（change_type='consume'）

**技术要点**：
- 必须在事务中调用
- 实现FIFO消费逻辑（优先消耗即将过期的积分）
- 所有积分消费操作都调用此函数

---

### 模块6: 定时任务

#### 6.1 积分过期清理任务

**执行频率**：每天凌晨3点

**任务逻辑**：
1. 查询所有已过期但未标记的积分记录（expire_at < 今天，change_type='earn'，is_expired=false）
2. 按用户分组，计算每个用户的过期积分总量
3. 逐用户处理（使用事务）：
   - 标记积分记录为已过期（is_expired=true）
   - 更新积分账户（available_points -expired, expired_points +expired）
   - 创建过期流水记录（change_type='expire'）
4. 记录日志

**技术要点**：
- 使用索引（idx_expire_at_is_expired）提高查询效率
- 按用户分组处理，避免大事务
- 记录详细日志（用户ID、过期积分、涉及记录数）

---

## 📂 文件结构

```
backend/src/
├── controllers/
│   ├── points.controller.js           // 用户端积分接口
│   └── admin-points.controller.js     // 管理员端积分接口
├── services/
│   ├── points.service.js              // 积分核心业务逻辑
│   ├── checkin.service.js             // 签到业务逻辑
│   ├── task.service.js                // 任务业务逻辑
│   └── points-mall.service.js         // 商城业务逻辑
├── utils/
│   └── points-helper.js               // 公共函数（grantPoints、consumePoints）
├── jobs/
│   └── points-expiration.job.js       // 积分过期定时任务
├── routes/
│   ├── points.routes.js               // 用户端路由
│   └── admin-points.routes.js         // 管理员端路由
└── middlewares/
    └── points-auth.middleware.js      // 积分相关权限校验
```

---

## ✅ 验收标准

### 必须完成项

- [ ] 20个API接口全部实现
- [ ] 所有接口通过Postman测试
- [ ] 积分获取功能正常（签到、任务、购买会员）
- [ ] 积分消费功能正常（兑换配额、兑换商品）
- [ ] FIFO消费逻辑实现正确
- [ ] 行锁防并发超扣实现正确
- [ ] 定时任务正常执行（积分过期清理）
- [ ] Redis缓存生效（账户、商品列表、签到状态）
- [ ] 错误处理完善（所有异常都有友好提示）
- [ ] 日志记录完整（关键操作都有日志）

### 可选完成项

- [ ] 单元测试覆盖率>80%
- [ ] API文档（Swagger）
- [ ] 性能测试报告（并发测试）

---

## 🚨 关键技术难点

### 难点1: FIFO积分消费逻辑

**问题描述**：
消费积分时，必须优先消耗即将过期的积分（先进先出），需要记录每次消费具体从哪些earn记录扣减。

**解决方案**：
1. 查询所有可用积分记录（change_type='earn'，is_expired=false），按expire_at升序排列
2. 依次扣减，每次扣减都在points_consumptions表中记录关联关系
3. 扣减时需要计算该记录已被消费的积分（查询points_consumptions聚合）

**参考PRD**：第2.4.3节

---

### 难点2: 并发安全性

**问题描述**：
多个用户同时兑换配额时，可能出现积分超扣问题。

**解决方案**：
1. 使用数据库事务保证原子性
2. 使用行锁（forUpdate）防止并发读取
3. 扣除积分和增加配额必须在同一个事务中

**关键代码提示**：
```javascript
await db.transaction(async (trx) => {
  // 查询积分账户并加行锁
  const account = await trx('points_accounts')
    .where({ user_id: userId })
    .forUpdate()
    .first();

  // 检查余额
  if (account.available_points < amount) {
    throw new Error('可用积分不足');
  }

  // 扣除积分 + 增加配额
  // ...
});
```

---

### 难点3: 签到连续天数计算

**问题描述**：
需要判断用户昨天是否签到，计算连续签到天数。

**解决方案**：
1. 查询昨天的签到记录
2. 如果存在：连续天数 = 昨天的连续天数 + 1
3. 如果不存在：连续天数 = 1

**关键代码提示**：
```javascript
const yesterday = moment().subtract(1, 'days').format('YYYY-MM-DD');
const yesterdayCheckin = await db('checkin_records')
  .where({ user_id: userId, checkin_date: yesterday })
  .first();

let consecutiveDays = 1;
if (yesterdayCheckin) {
  consecutiveDays = yesterdayCheckin.consecutive_days + 1;
}
```

---

## 📚 参考资料

- PRD文档：[PRD-用户积分系统.md](./PRD-用户积分系统.md)
- 数据库设计：[任务卡-DatabaseMigration.md](./任务卡-DatabaseMigration.md)
- Knex事务文档：https://knexjs.org/guide/transactions.html
- Redis缓存最佳实践：https://redis.io/docs/manual/patterns/

---

## 🎯 开发建议

1. **先实现核心功能，再优化性能**：先把功能跑通，再加Redis缓存
2. **充分测试并发场景**：使用工具模拟100并发请求，验证行锁是否生效
3. **完善错误处理**：所有异常都要捕获并返回友好提示
4. **记录详细日志**：关键操作（发放积分、消费积分、过期清理）都要记录日志
5. **编写单元测试**：至少覆盖核心业务逻辑（grantPoints、consumePoints、FIFO逻辑）

---

**任务完成后，通知前端开发团队开始页面开发！**
