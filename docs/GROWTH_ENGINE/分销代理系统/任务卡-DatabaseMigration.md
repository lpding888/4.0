# 任务卡：数据库迁移 - 分销代理系统

> **负责技能**：backend_dev_skill
> **优先级**：P0（必须最先完成）
> **预计工期**：0.5天

---

## 任务目标

创建分销代理系统所需的数据库表结构，包括分销员表、推荐关系表、佣金记录表、提现记录表。

---

## 目录范围

### ✅ 可修改
- `backend/src/db/migrations/`

### ❌ 禁止修改
- 现有表结构的主键和外键
- users、orders表的现有字段

---

## 产出物

### 1. 分销员表迁移文件
**文件名**：`backend/src/db/migrations/20251029110001_create_distributors_table.js`

**表结构**：
```javascript
exports.up = function(knex) {
  return knex.schema.createTable('distributors', function(table) {
    table.string('id', 32).primary().comment('分销员ID');
    table.string('user_id', 32).notNullable().unique().comment('关联用户ID');
    table.string('real_name', 50).notNullable().comment('真实姓名');
    table.string('id_card', 18).notNullable().comment('身份证号');
    table.string('contact', 50).notNullable().comment('联系方式');
    table.string('status', 20).defaultTo('pending').comment('状态: pending=待审核, active=已激活, disabled=已禁用');
    table.datetime('approval_time').nullable().comment('审核通过时间');
    table.string('invite_code', 10).unique().notNullable().comment('专属邀请码');
    table.decimal('total_commission', 10, 2).defaultTo(0).comment('累计佣金');
    table.decimal('available_commission', 10, 2).defaultTo(0).comment('可提现佣金');
    table.decimal('withdrawn_commission', 10, 2).defaultTo(0).comment('已提现佣金');
    table.timestamps(true, true);

    // 外键
    table.foreign('user_id').references('users.id').onDelete('CASCADE');

    // 索引
    table.index('user_id', 'idx_distributors_user');
    table.index('status', 'idx_distributors_status');
    table.index('invite_code', 'idx_distributors_invite_code');
  })
  .then(() => {
    console.log('✓ distributors表创建成功');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('distributors');
};
```

### 2. 推荐关系表迁移文件
**文件名**：`backend/src/db/migrations/20251029110002_create_referral_relationships_table.js`

**表结构**：
```javascript
exports.up = function(knex) {
  return knex.schema.createTable('referral_relationships', function(table) {
    table.string('id', 32).primary().comment('关系ID');
    table.string('referrer_user_id', 32).notNullable().comment('推荐人用户ID');
    table.string('referred_user_id', 32).notNullable().comment('被推荐人用户ID');
    table.string('referrer_distributor_id', 32).notNullable().comment('推荐人分销员ID');
    table.datetime('created_at').defaultTo(knex.fn.now()).comment('创建时间');

    // 外键
    table.foreign('referrer_user_id').references('users.id').onDelete('CASCADE');
    table.foreign('referred_user_id').references('users.id').onDelete('CASCADE');
    table.foreign('referrer_distributor_id').references('distributors.id').onDelete('CASCADE');

    // 索引
    table.index('referrer_distributor_id', 'idx_referral_referrer');
    table.index('referred_user_id', 'idx_referral_referred');

    // 唯一约束：每个用户只能被推荐一次
    table.unique('referred_user_id', 'uk_referred_user');
  })
  .then(() => {
    console.log('✓ referral_relationships表创建成功');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('referral_relationships');
};
```

### 3. 佣金记录表迁移文件
**文件名**：`backend/src/db/migrations/20251029110003_create_commissions_table.js`

**表结构**：
```javascript
exports.up = function(knex) {
  return knex.schema.createTable('commissions', function(table) {
    table.string('id', 32).primary().comment('佣金记录ID');
    table.string('distributor_id', 32).notNullable().comment('分销员ID');
    table.string('order_id', 32).notNullable().comment('订单ID');
    table.string('referred_user_id', 32).notNullable().comment('被推荐用户ID');
    table.decimal('order_amount', 10, 2).notNullable().comment('订单金额');
    table.decimal('commission_rate', 5, 2).notNullable().comment('佣金比例(%)');
    table.decimal('commission_amount', 10, 2).notNullable().comment('佣金金额');
    table.string('status', 20).defaultTo('frozen').comment('状态: frozen=冻结中, available=可提现, withdrawn=已提现, cancelled=已取消');
    table.datetime('freeze_until').notNullable().comment('冻结截止时间');
    table.datetime('created_at').defaultTo(knex.fn.now()).comment('创建时间');
    table.datetime('settled_at').nullable().comment('到账时间');

    // 外键
    table.foreign('distributor_id').references('distributors.id').onDelete('CASCADE');
    table.foreign('order_id').references('orders.id').onDelete('CASCADE');
    table.foreign('referred_user_id').references('users.id').onDelete('CASCADE');

    // 索引
    table.index('distributor_id', 'idx_commissions_distributor');
    table.index('order_id', 'idx_commissions_order');
    table.index(['status', 'freeze_until'], 'idx_commissions_status_freeze');

    // 唯一约束：防止同一订单重复计佣
    table.unique(['order_id', 'distributor_id'], 'uk_order_distributor');
  })
  .then(() => {
    console.log('✓ commissions表创建成功');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('commissions');
};
```

### 4. 提现记录表迁移文件
**文件名**：`backend/src/db/migrations/20251029110004_create_withdrawals_table.js`

**表结构**：
```javascript
exports.up = function(knex) {
  return knex.schema.createTable('withdrawals', function(table) {
    table.string('id', 32).primary().comment('提现记录ID');
    table.string('distributor_id', 32).notNullable().comment('分销员ID');
    table.decimal('amount', 10, 2).notNullable().comment('提现金额');
    table.string('method', 20).notNullable().comment('提现方式: wechat=微信, alipay=支付宝');
    table.text('account_info').notNullable().comment('收款账户信息(JSON)');
    table.string('status', 20).defaultTo('pending').comment('状态: pending=待审核, approved=审核通过, paid=已打款, rejected=已拒绝');
    table.string('reject_reason', 200).nullable().comment('拒绝原因');
    table.datetime('created_at').defaultTo(knex.fn.now()).comment('申请时间');
    table.datetime('approved_at').nullable().comment('审核时间');
    table.datetime('completed_at').nullable().comment('完成时间');

    // 外键
    table.foreign('distributor_id').references('distributors.id').onDelete('CASCADE');

    // 索引
    table.index('distributor_id', 'idx_withdrawals_distributor');
    table.index('status', 'idx_withdrawals_status');
    table.index('created_at', 'idx_withdrawals_created');
  })
  .then(() => {
    console.log('✓ withdrawals表创建成功');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('withdrawals');
};
```

### 5. 用户表扩展迁移文件
**文件名**：`backend/src/db/migrations/20251029110005_extend_users_for_distribution.js`

**扩展字段**：
```javascript
exports.up = function(knex) {
  return knex.schema.table('users', function(table) {
    table.string('referrer_id', 32).nullable().comment('推荐人用户ID');
    table.index('referrer_id', 'idx_users_referrer');
  })
  .then(() => {
    console.log('✓ users表扩展成功');
  });
};

exports.down = function(knex) {
  return knex.schema.table('users', function(table) {
    table.dropIndex('referrer_id', 'idx_users_referrer');
    table.dropColumn('referrer_id');
  });
};
```

---

## 数据字典

### distributors表（分销员表）

| 字段名 | 类型 | 约束 | 说明 | 示例值 |
|--------|------|------|------|--------|
| id | VARCHAR(32) | PK | 分销员ID | dist_abc123 |
| user_id | VARCHAR(32) | FK, UNIQUE | 关联用户ID | user_123 |
| real_name | VARCHAR(50) | NOT NULL | 真实姓名 | 张三 |
| id_card | VARCHAR(18) | NOT NULL | 身份证号 | 110101199001011234 |
| contact | VARCHAR(50) | NOT NULL | 联系方式 | 13800138000 |
| status | VARCHAR(20) | DEFAULT 'pending' | 状态 | active |
| invite_code | VARCHAR(10) | UNIQUE | 专属邀请码 | ABC123 |
| total_commission | DECIMAL(10,2) | DEFAULT 0 | 累计佣金 | 1280.50 |
| available_commission | DECIMAL(10,2) | DEFAULT 0 | 可提现佣金 | 450.00 |
| withdrawn_commission | DECIMAL(10,2) | DEFAULT 0 | 已提现佣金 | 830.50 |

### referral_relationships表（推荐关系表）

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(32) | PK | 关系ID |
| referrer_user_id | VARCHAR(32) | FK | 推荐人用户ID |
| referred_user_id | VARCHAR(32) | FK, UNIQUE | 被推荐人用户ID |
| referrer_distributor_id | VARCHAR(32) | FK | 推荐人分销员ID |

### commissions表（佣金记录表）

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(32) | PK | 佣金记录ID |
| distributor_id | VARCHAR(32) | FK | 分销员ID |
| order_id | VARCHAR(32) | FK, UNIQUE | 订单ID |
| commission_amount | DECIMAL(10,2) | NOT NULL | 佣金金额 |
| status | VARCHAR(20) | DEFAULT 'frozen' | 状态 |
| freeze_until | DATETIME | NOT NULL | 冻结截止时间 |

### withdrawals表（提现记录表）

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| id | VARCHAR(32) | PK | 提现记录ID |
| distributor_id | VARCHAR(32) | FK | 分销员ID |
| amount | DECIMAL(10,2) | NOT NULL | 提现金额 |
| method | VARCHAR(20) | NOT NULL | 提现方式 |
| status | VARCHAR(20) | DEFAULT 'pending' | 状态 |

---

## 禁止事项

❌ **严格禁止**：
1. 不允许修改users、orders表的现有字段
2. 不允许删除现有外键约束
3. 不允许在迁移中插入业务数据

---

## 验证清单

### 迁移执行
```bash
npm run db:migrate:latest
mysql -u root -p -e "SHOW TABLES LIKE 'distributors';"
mysql -u root -p -e "DESCRIBE commissions;"
```

### 验证点
- [ ] distributors表已创建
- [ ] referral_relationships表已创建
- [ ] commissions表已创建
- [ ] withdrawals表已创建
- [ ] users表已扩展
- [ ] 所有索引已创建
- [ ] 唯一约束生效

---

**预计工作量**：0.5天
