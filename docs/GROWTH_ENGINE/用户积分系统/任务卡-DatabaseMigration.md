# 任务卡 - 数据库迁移 (用户积分系统)

> **系统**: 用户积分系统
> **负责人**: DatabaseMigration Skill
> **预计工期**: 1天
> **优先级**: P0 (最高优先级,其他任务依赖此任务)

---

## 📋 任务概述

本任务负责创建用户积分系统所需的全部数据库表结构,包括:
1. 积分账户表
2. 积分记录流水表
3. 积分消费关联表(FIFO逻辑)
4. 签到记录表
5. 任务完成记录表
6. 积分商城商品表
7. 积分兑换记录表

**核心要求**:
- 所有表必须包含完整的索引和唯一约束
- 关键字段必须有明确的注释
- 必须初始化积分商城商品数据
- 必须符合财务数据安全规范

---

## 🗄️ 数据库表设计

### 表1: 积分账户表 (points_accounts)

**用途**: 存储每个用户的积分账户核心数据

**迁移文件**: `backend/src/db/migrations/XXX_create_points_accounts.js`

```javascript
exports.up = function(knex) {
  return knex.schema.createTable('points_accounts', function(table) {
    // 主键
    table.string('user_id', 50).notNullable().primary().comment('用户ID');

    // 积分字段
    table.integer('total_points').notNullable().defaultTo(0).comment('累计获得积分(历史总和)');
    table.integer('available_points').notNullable().defaultTo(0).comment('可用积分(当前可使用)');
    table.integer('frozen_points').notNullable().defaultTo(0).comment('冻结积分(异常行为冻结)');
    table.integer('used_points').notNullable().defaultTo(0).comment('已使用积分(兑换消耗)');
    table.integer('expired_points').notNullable().defaultTo(0).comment('已过期积分(过期清零)');

    // 时间戳
    table.datetime('created_at').notNullable().defaultTo(knex.fn.now()).comment('创建时间');
    table.datetime('updated_at').notNullable().defaultTo(knex.fn.now()).comment('更新时间');

    // 索引
    table.index('available_points', 'idx_available_points');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('points_accounts');
};
```

**字段说明**:
- `user_id`: 用户ID,主键,关联users表
- `total_points`: 累计获得积分,只增不减,用于统计用户总贡献
- `available_points`: 可用积分,当前可以使用的积分余额
- `frozen_points`: 冻结积分,异常行为时冻结,无法使用
- `used_points`: 已使用积分,通过兑换消耗的积分
- `expired_points`: 已过期积分,超过有效期被清零的积分

**数据一致性约束**:
```sql
available_points = total_points - frozen_points - used_points - expired_points
```

**索引说明**:
- `idx_available_points`: 用于查询可用积分排行榜

---

### 表2: 积分记录流水表 (points_records)

**用途**: 记录所有积分变动的流水,确保可追溯

**迁移文件**: `backend/src/db/migrations/XXX_create_points_records.js`

```javascript
exports.up = function(knex) {
  return knex.schema.createTable('points_records', function(table) {
    // 主键
    table.string('id', 50).notNullable().primary().comment('记录ID');

    // 用户信息
    table.string('user_id', 50).notNullable().comment('用户ID');

    // 变动信息
    table.enu('change_type', ['earn', 'consume', 'expire', 'freeze', 'unfreeze']).notNullable().comment('变动类型');
    table.integer('change_amount').notNullable().comment('变动数量(正数或负数)');

    // 来源信息
    table.string('source_type', 50).notNullable().comment('来源类型:register,checkin,task,purchase,redeem,invite,manual,system');
    table.string('source_description', 200).notNullable().comment('来源描述');
    table.string('related_id', 50).nullable().comment('关联ID(任务ID/订单ID等)');

    // 余额快照
    table.integer('balance_before').notNullable().comment('变动前余额');
    table.integer('balance_after').notNullable().comment('变动后余额');

    // 过期信息
    table.date('expire_at').nullable().comment('过期时间(获得积分时设置)');
    table.boolean('is_expired').notNullable().defaultTo(false).comment('是否已过期(0:未过期, 1:已过期)');

    // 时间戳
    table.datetime('created_at').notNullable().defaultTo(knex.fn.now()).comment('创建时间');

    // 索引
    table.index('user_id', 'idx_user_id');
    table.index('change_type', 'idx_change_type');
    table.index(['expire_at', 'is_expired'], 'idx_expire_at_is_expired');
    table.index('created_at', 'idx_created_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('points_records');
};
```

**字段说明**:
- `change_type`: 变动类型
  - `earn`: 获得积分
  - `consume`: 消耗积分
  - `expire`: 过期积分
  - `freeze`: 冻结积分
  - `unfreeze`: 解冻积分
- `source_type`: 来源类型
  - `register`: 注册奖励
  - `checkin`: 每日签到
  - `task`: 任务完成
  - `purchase`: 购买会员
  - `redeem`: 兑换配额/商品
  - `invite`: 邀请好友
  - `manual`: 管理员手动调整
  - `system`: 系统操作(过期/冻结)
- `expire_at`: 过期时间,仅当`change_type='earn'`时有值
- `is_expired`: 是否已过期,定时任务标记

**索引说明**:
- `idx_user_id`: 查询用户积分明细
- `idx_change_type`: 按类型统计积分变动
- `idx_expire_at_is_expired`: 过期积分扫描(定时任务使用)
- `idx_created_at`: 按时间查询积分记录

---

### 表3: 积分消费关联表 (points_consumptions)

**用途**: 记录积分消费时具体从哪些earn记录扣减的积分,实现FIFO消费逻辑

**迁移文件**: `backend/src/db/migrations/XXX_create_points_consumptions.js`

```javascript
exports.up = function(knex) {
  return knex.schema.createTable('points_consumptions', function(table) {
    // 主键
    table.string('id', 50).notNullable().primary().comment('记录ID');

    // 用户信息
    table.string('user_id', 50).notNullable().comment('用户ID');

    // 关联信息
    table.string('earn_record_id', 50).notNullable().comment('获得积分记录ID');
    table.integer('consumed_amount').notNullable().comment('消费数量');

    // 消费信息
    table.string('consume_type', 50).notNullable().comment('消费类型:redeem,mall');
    table.string('consume_description', 200).notNullable().comment('消费描述');
    table.string('related_id', 50).nullable().comment('关联ID');

    // 时间戳
    table.datetime('created_at').notNullable().defaultTo(knex.fn.now()).comment('创建时间');

    // 索引
    table.index('user_id', 'idx_user_id');
    table.index('earn_record_id', 'idx_earn_record_id');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('points_consumptions');
};
```

**字段说明**:
- `earn_record_id`: 关联`points_records`表中`change_type='earn'`的记录ID
- `consumed_amount`: 从该记录中扣减的积分数量
- `consume_type`: 消费类型
  - `redeem`: 兑换配额
  - `mall`: 商城兑换
- `consume_description`: 消费描述(如"兑换8个处理配额")

**FIFO消费逻辑**:
消费积分时,按照`points_records.expire_at`升序查询所有`change_type='earn'`且`is_expired=false`的记录,依次扣减,并在`points_consumptions`表中记录每次扣减的来源。

**索引说明**:
- `idx_user_id`: 查询用户积分消费明细
- `idx_earn_record_id`: 查询某条earn记录被消费的情况

---

### 表4: 签到记录表 (checkin_records)

**用途**: 记录用户每日签到情况,计算连续签到天数

**迁移文件**: `backend/src/db/migrations/XXX_create_checkin_records.js`

```javascript
exports.up = function(knex) {
  return knex.schema.createTable('checkin_records', function(table) {
    // 主键
    table.string('id', 50).notNullable().primary().comment('记录ID');

    // 用户信息
    table.string('user_id', 50).notNullable().comment('用户ID');

    // 签到信息
    table.date('checkin_date').notNullable().comment('签到日期');
    table.integer('consecutive_days').notNullable().defaultTo(1).comment('连续签到天数');
    table.integer('points_earned').notNullable().comment('本次获得积分');

    // 时间戳
    table.datetime('created_at').notNullable().defaultTo(knex.fn.now()).comment('创建时间');

    // 唯一约束(防止同一天重复签到)
    table.unique(['user_id', 'checkin_date'], 'uk_user_checkin_date');

    // 索引
    table.index('user_id', 'idx_user_id');
    table.index('checkin_date', 'idx_checkin_date');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('checkin_records');
};
```

**字段说明**:
- `checkin_date`: 签到日期,DATE类型,格式为`YYYY-MM-DD`
- `consecutive_days`: 连续签到天数,中断后清零
- `points_earned`: 本次签到获得的积分(根据连续天数计算)

**唯一约束**:
- `uk_user_checkin_date`: 防止同一用户在同一天重复签到

**连续签到积分规则**:
- 第1天: 2积分
- 第2天: 4积分
- 第3天: 6积分
- 第4天: 8积分
- 第5天及以后: 10积分

**索引说明**:
- `idx_user_id`: 查询用户签到历史
- `idx_checkin_date`: 查询某天签到人数

---

### 表5: 任务完成记录表 (task_completions)

**用途**: 记录用户完成的任务,校验任务完成次数限制

**迁移文件**: `backend/src/db/migrations/XXX_create_task_completions.js`

```javascript
exports.up = function(knex) {
  return knex.schema.createTable('task_completions', function(table) {
    // 主键
    table.string('id', 50).notNullable().primary().comment('记录ID');

    // 用户信息
    table.string('user_id', 50).notNullable().comment('用户ID');

    // 任务信息
    table.string('task_type', 50).notNullable().comment('任务类型:profile_complete,first_use,share,invite,purchase,review');
    table.string('task_description', 200).notNullable().comment('任务描述');
    table.integer('points_earned').notNullable().comment('获得积分');
    table.string('related_id', 50).nullable().comment('关联ID(邀请的用户ID等)');

    // 时间戳
    table.datetime('completed_at').notNullable().defaultTo(knex.fn.now()).comment('完成时间');

    // 索引
    table.index('user_id', 'idx_user_id');
    table.index('task_type', 'idx_task_type');
    table.index('completed_at', 'idx_completed_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('task_completions');
};
```

**字段说明**:
- `task_type`: 任务类型
  - `profile_complete`: 完善个人资料(一次性)
  - `first_use`: 首次使用AI功能(一次性)
  - `share`: 分享作品(每天限3次)
  - `invite`: 邀请好友注册(每月限5人)
  - `purchase`: 首次购买会员(一次性)
  - `review`: 评价AI生成结果(每天限10次)

**任务限制规则**:
| 任务类型 | 积分奖励 | 可重复 | 限制 |
|---------|---------|--------|------|
| profile_complete | 20积分 | 否 | 一次性 |
| first_use | 30积分 | 否 | 一次性 |
| share | 10积分 | 是 | 每天限3次 |
| invite | 50积分 | 是 | 每月限5人 |
| purchase | 100积分 | 否 | 一次性 |
| review | 5积分 | 是 | 每天限10次 |

**唯一约束**:
一次性任务需要在应用层校验唯一性,可重复任务需校验每日/每月完成次数。

**索引说明**:
- `idx_user_id`: 查询用户任务完成历史
- `idx_task_type`: 按任务类型统计完成人次
- `idx_completed_at`: 查询每日/每月完成次数

---

### 表6: 积分商城商品表 (points_mall_items)

**用途**: 存储积分商城的商品信息

**迁移文件**: `backend/src/db/migrations/XXX_create_points_mall_items.js`

```javascript
exports.up = function(knex) {
  return knex.schema.createTable('points_mall_items', function(table) {
    // 主键
    table.string('id', 50).notNullable().primary().comment('商品ID');

    // 商品信息
    table.enu('item_type', ['coupon', 'membership', 'privilege', 'quota']).notNullable().comment('商品类型');
    table.string('item_name', 100).notNullable().comment('商品名称');
    table.text('item_description').nullable().comment('商品描述');

    // 价格和价值
    table.integer('points_required').notNullable().comment('所需积分');
    table.integer('item_value').notNullable().comment('商品价值(优惠券面额/会员天数等)');

    // 库存和限制
    table.integer('stock').notNullable().defaultTo(-1).comment('库存(-1表示不限)');
    table.integer('monthly_limit').nullable().comment('每月兑换次数限制(null表示不限)');

    // 状态
    table.enu('status', ['active', 'soldout', 'inactive']).notNullable().defaultTo('active').comment('状态');

    // 展示
    table.string('image_url', 500).nullable().comment('商品图片');
    table.integer('sort_order').notNullable().defaultTo(0).comment('排序');

    // 时间戳
    table.datetime('created_at').notNullable().defaultTo(knex.fn.now()).comment('创建时间');
    table.datetime('updated_at').notNullable().defaultTo(knex.fn.now()).comment('更新时间');

    // 索引
    table.index('status', 'idx_status');
    table.index('sort_order', 'idx_sort_order');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('points_mall_items');
};
```

**字段说明**:
- `item_type`: 商品类型
  - `coupon`: 优惠券
  - `membership`: 会员时长
  - `privilege`: 特权(如高优先级处理)
  - `quota`: 处理配额(预留,当前通过专门接口兑换)
- `item_value`: 商品价值
  - 优惠券: 面额(元)
  - 会员: 天数
  - 特权: 天数
- `stock`: 库存,-1表示不限
- `monthly_limit`: 每月兑换次数限制,null表示不限

**索引说明**:
- `idx_status`: 查询上架商品
- `idx_sort_order`: 按排序展示商品

---

### 表7: 积分兑换记录表 (points_redemptions)

**用途**: 记录用户兑换配额和商城商品的记录

**迁移文件**: `backend/src/db/migrations/XXX_create_points_redemptions.js`

```javascript
exports.up = function(knex) {
  return knex.schema.createTable('points_redemptions', function(table) {
    // 主键
    table.string('id', 50).notNullable().primary().comment('兑换记录ID');

    // 用户信息
    table.string('user_id', 50).notNullable().comment('用户ID');

    // 商品信息
    table.string('item_id', 50).nullable().comment('商品ID(商城兑换时有值)');
    table.string('item_type', 50).notNullable().comment('商品类型:quota,coupon,membership,privilege');
    table.string('item_name', 100).notNullable().comment('商品名称');
    table.integer('points_cost').notNullable().comment('消耗积分');
    table.integer('item_value').notNullable().comment('商品价值');

    // 兑换状态
    table.enu('status', ['completed', 'pending', 'failed']).notNullable().defaultTo('completed').comment('状态');

    // 兑换结果
    table.string('coupon_code', 50).nullable().comment('优惠券码(如果是优惠券)');
    table.datetime('expire_at').nullable().comment('过期时间(优惠券/特权)');

    // 时间戳
    table.datetime('created_at').notNullable().defaultTo(knex.fn.now()).comment('创建时间');

    // 索引
    table.index('user_id', 'idx_user_id');
    table.index('item_type', 'idx_item_type');
    table.index('created_at', 'idx_created_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('points_redemptions');
};
```

**字段说明**:
- `item_id`: 商品ID,从`points_mall_items`表查询,如果是兑换配额则为null
- `item_type`: 商品类型
  - `quota`: 处理配额
  - `coupon`: 优惠券
  - `membership`: 会员时长
  - `privilege`: 特权
- `status`: 兑换状态
  - `completed`: 已完成
  - `pending`: 处理中
  - `failed`: 失败
- `coupon_code`: 优惠券码,兑换优惠券时生成
- `expire_at`: 过期时间,优惠券和特权有效期

**索引说明**:
- `idx_user_id`: 查询用户兑换历史
- `idx_item_type`: 按类型统计兑换数据
- `idx_created_at`: 按时间统计兑换趋势

---

## 🔧 初始化数据

### 初始化积分商城商品

**迁移文件**: `backend/src/db/seeds/004_points_mall_items_init.js`

```javascript
exports.seed = async function(knex) {
  // 清空表(仅开发环境)
  if (process.env.NODE_ENV === 'development') {
    await knex('points_mall_items').del();
  }

  // 插入初始商品
  await knex('points_mall_items').insert([
    {
      id: 'item_coupon_50',
      item_type: 'coupon',
      item_name: '50元优惠券',
      item_description: '适用于所有套餐,有效期30天',
      points_required: 500,
      item_value: 50,
      stock: -1,
      monthly_limit: 2,
      status: 'active',
      sort_order: 1
    },
    {
      id: 'item_coupon_100',
      item_type: 'coupon',
      item_name: '100元优惠券',
      item_description: '适用于所有套餐,有效期30天',
      points_required: 900,
      item_value: 100,
      stock: -1,
      monthly_limit: 1,
      status: 'active',
      sort_order: 2
    },
    {
      id: 'item_membership_1m',
      item_type: 'membership',
      item_name: '1个月会员',
      item_description: '高级会员权益,价值99元',
      points_required: 2000,
      item_value: 30,
      stock: -1,
      monthly_limit: null,
      status: 'active',
      sort_order: 3
    },
    {
      id: 'item_membership_3m',
      item_type: 'membership',
      item_name: '3个月会员',
      item_description: '高级会员权益,价值237元',
      points_required: 5000,
      item_value: 90,
      stock: -1,
      monthly_limit: null,
      status: 'active',
      sort_order: 4
    },
    {
      id: 'item_privilege_priority',
      item_type: 'privilege',
      item_name: '高优先级处理特权(7天)',
      item_description: '任务优先处理,有效期7天',
      points_required: 800,
      item_value: 7,
      stock: -1,
      monthly_limit: null,
      status: 'active',
      sort_order: 5
    },
    {
      id: 'item_privilege_support',
      item_type: 'privilege',
      item_name: '专属客服通道(30天)',
      item_description: '1v1专属客服,有效期30天',
      points_required: 1500,
      item_value: 30,
      stock: -1,
      monthly_limit: null,
      status: 'active',
      sort_order: 6
    }
  ]);

  console.log('[Seed] 积分商城商品初始化完成,共6个商品');
};
```

---

## ✅ 执行步骤

### 步骤1: 创建迁移文件

```bash
cd backend

# 创建7个迁移文件
npx knex migrate:make create_points_accounts
npx knex migrate:make create_points_records
npx knex migrate:make create_points_consumptions
npx knex migrate:make create_checkin_records
npx knex migrate:make create_task_completions
npx knex migrate:make create_points_mall_items
npx knex migrate:make create_points_redemptions
```

---

### 步骤2: 编写迁移代码

将上述7个表的迁移代码复制到对应的迁移文件中。

**注意事项**:
1. 迁移文件按照创建顺序命名(时间戳)
2. 确保所有字段都有明确的注释
3. 确保索引和唯一约束正确创建

---

### 步骤3: 执行迁移

```bash
# 执行迁移
npx knex migrate:latest

# 验证迁移是否成功
npx knex migrate:status
```

**预期输出**:
```
Batch 4 - 7 migrations:
  XXX_create_points_accounts.js
  XXX_create_points_records.js
  XXX_create_points_consumptions.js
  XXX_create_checkin_records.js
  XXX_create_task_completions.js
  XXX_create_points_mall_items.js
  XXX_create_points_redemptions.js
```

---

### 步骤4: 创建初始化数据Seed文件

```bash
# 创建Seed文件
npx knex seed:make 004_points_mall_items_init
```

将上述初始化商品代码复制到Seed文件中。

---

### 步骤5: 执行初始化数据

```bash
# 执行Seed
npx knex seed:run

# 验证数据是否插入成功
npx knex migrate:status
```

**验证SQL**:
```sql
SELECT * FROM points_mall_items;
```

**预期结果**: 6条商品记录

---

## 🔍 数据验证

### 验证1: 检查表是否创建成功

```sql
SHOW TABLES LIKE 'points_%';
SHOW TABLES LIKE 'checkin_records';
SHOW TABLES LIKE 'task_completions';
```

**预期结果**: 7张表

---

### 验证2: 检查索引是否创建成功

```sql
SHOW INDEX FROM points_accounts;
SHOW INDEX FROM points_records;
SHOW INDEX FROM points_consumptions;
SHOW INDEX FROM checkin_records;
SHOW INDEX FROM task_completions;
SHOW INDEX FROM points_mall_items;
SHOW INDEX FROM points_redemptions;
```

**检查要点**:
- `points_accounts`: 1个索引(`idx_available_points`)
- `points_records`: 4个索引(`idx_user_id`, `idx_change_type`, `idx_expire_at_is_expired`, `idx_created_at`)
- `points_consumptions`: 2个索引(`idx_user_id`, `idx_earn_record_id`)
- `checkin_records`: 3个索引(主键 + `uk_user_checkin_date` + `idx_user_id` + `idx_checkin_date`)
- `task_completions`: 3个索引(`idx_user_id`, `idx_task_type`, `idx_completed_at`)
- `points_mall_items`: 2个索引(`idx_status`, `idx_sort_order`)
- `points_redemptions`: 3个索引(`idx_user_id`, `idx_item_type`, `idx_created_at`)

---

### 验证3: 检查唯一约束

```sql
SHOW INDEX FROM checkin_records WHERE Key_name = 'uk_user_checkin_date';
```

**预期结果**: 1条记录,表示唯一约束创建成功

---

### 验证4: 检查商品初始化数据

```sql
SELECT id, item_name, points_required, item_value, status FROM points_mall_items ORDER BY sort_order;
```

**预期结果**: 6条商品记录,按`sort_order`排序

---

## 🛡️ 财务安全检查清单

### ✅ 检查1: 积分账户数据一致性

**验证SQL**:
```sql
-- 创建测试账户
INSERT INTO points_accounts (user_id, total_points, available_points, frozen_points, used_points, expired_points)
VALUES ('test_user_001', 1000, 600, 100, 200, 100);

-- 验证数据一致性
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
WHERE user_id = 'test_user_001';

-- 清理测试数据
DELETE FROM points_accounts WHERE user_id = 'test_user_001';
```

**预期结果**: `is_consistent = 1` (数据一致)

---

### ✅ 检查2: 签到唯一约束防重复

**验证SQL**:
```sql
-- 插入第一次签到记录
INSERT INTO checkin_records (id, user_id, checkin_date, consecutive_days, points_earned)
VALUES ('test_checkin_001', 'test_user_001', '2025-10-30', 1, 2);

-- 尝试插入重复签到记录(应该失败)
INSERT INTO checkin_records (id, user_id, checkin_date, consecutive_days, points_earned)
VALUES ('test_checkin_002', 'test_user_001', '2025-10-30', 1, 2);

-- 清理测试数据
DELETE FROM checkin_records WHERE user_id = 'test_user_001';
```

**预期结果**: 第二次插入失败,报错`Duplicate entry`

---

### ✅ 检查3: 过期积分索引效率

**验证SQL**:
```sql
-- 查询过期积分(使用索引)
EXPLAIN SELECT * FROM points_records
WHERE expire_at < CURDATE()
AND change_type = 'earn'
AND is_expired = 0;
```

**预期结果**: `Extra`列显示`Using index condition`,表示使用了索引

---

### ✅ 检查4: 商城商品库存字段

**验证SQL**:
```sql
-- 验证库存字段默认值
SELECT id, item_name, stock FROM points_mall_items;
```

**预期结果**: 所有商品的`stock = -1`(不限库存)

---

## 📊 性能测试

### 测试1: 插入积分记录性能

```sql
-- 批量插入1000条积分记录
INSERT INTO points_records (id, user_id, change_type, change_amount, source_type, source_description, balance_before, balance_after, expire_at, is_expired)
SELECT
  CONCAT('test_rec_', LPAD(@row_num := @row_num + 1, 6, '0')),
  CONCAT('test_user_', LPAD((@row_num % 100) + 1, 3, '0')),
  'earn',
  10,
  'checkin',
  '测试签到',
  0,
  10,
  DATE_ADD(CURDATE(), INTERVAL 365 DAY),
  0
FROM (SELECT @row_num := 0) AS init,
     (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) AS t1,
     (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) AS t2,
     (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) AS t3,
     (SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) AS t4
LIMIT 1000;

-- 查询性能测试
SELECT user_id, COUNT(*) AS record_count, SUM(change_amount) AS total_points
FROM points_records
WHERE user_id LIKE 'test_user_%'
GROUP BY user_id;

-- 清理测试数据
DELETE FROM points_records WHERE id LIKE 'test_rec_%';
```

**预期性能**: 插入1000条记录 < 1秒,查询 < 100ms

---

### 测试2: 过期积分扫描性能

```sql
-- 创建测试数据(100个用户,每人10条积分记录)
-- 省略插入代码...

-- 扫描过期积分
SELECT user_id, COUNT(*) AS expired_count, SUM(change_amount) AS expired_amount
FROM points_records
WHERE expire_at < CURDATE()
AND change_type = 'earn'
AND is_expired = 0
GROUP BY user_id;
```

**预期性能**: 扫描1000条记录 < 50ms

---

## 📝 回滚计划

如果迁移失败或需要回滚,执行以下命令:

```bash
# 回滚最后一个批次(7个迁移)
npx knex migrate:rollback

# 验证回滚是否成功
npx knex migrate:status
```

**注意事项**:
1. 回滚会删除所有表和数据,请谨慎操作
2. 生产环境禁止回滚,只能通过新的迁移修复问题

---

## 🎯 验收标准

### ✅ 必须完成项

- [ ] 7张表全部创建成功
- [ ] 所有索引创建成功
- [ ] 唯一约束创建成功(`uk_user_checkin_date`)
- [ ] 商城商品初始化数据插入成功(6条记录)
- [ ] 数据一致性验证通过
- [ ] 签到防重复验证通过
- [ ] 过期积分索引效率验证通过
- [ ] 性能测试通过(插入和查询性能达标)

### ✅ 可选完成项

- [ ] 编写数据库设计文档(ER图)
- [ ] 创建数据字典(所有表和字段说明)
- [ ] 编写数据备份脚本

---

## 📚 参考资料

- [Knex.js 官方文档](https://knexjs.org/)
- [MySQL 索引优化最佳实践](https://dev.mysql.com/doc/)
- [财务数据表设计规范](https://www.database-design-book.com/)

---

## 🚨 注意事项

1. **数据一致性**: `points_accounts`表的数据必须满足一致性约束
2. **唯一约束**: `checkin_records`表必须有唯一约束防止重复签到
3. **索引覆盖**: 确保查询频繁的字段都有索引
4. **字段注释**: 所有字段必须有明确的中文注释
5. **初始化数据**: 商城商品初始化数据必须插入成功
6. **性能测试**: 插入和查询性能必须达标
7. **回滚计划**: 准备好回滚脚本以防万一

---

**任务完成后,通知后端开发团队开始API开发!**
