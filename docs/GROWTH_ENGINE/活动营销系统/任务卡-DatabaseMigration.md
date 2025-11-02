# 任务卡：数据库迁移 - 活动营销系统

> **负责技能**：backend_dev_skill
> **功能模块**：活动营销系统
> **任务类型**：数据库迁移
> **优先级**：P0（必须最先完成）

---

## 任务目标

创建活动营销系统所需的数据库表结构，包括活动表、用户优惠券表，以及扩展订单表以支持优惠券功能。

---

## 目录范围

### ✅ 可修改
- `backend/src/db/migrations/`

### ❌ 禁止修改
- 现有表结构（users, orders, tasks等）的主键和外键
- 现有表的已有字段

---

## 产出物

### 1. 活动表迁移文件
**文件名**：`backend/src/db/migrations/20251029100001_create_promotions_table.js`

**表结构**：
```javascript
exports.up = function(knex) {
  return knex.schema.createTable('promotions', function(table) {
    table.string('id', 32).primary().comment('活动ID');
    table.string('name', 100).notNullable().comment('活动名称');
    table.string('type', 20).notNullable().comment('活动类型: coupon=优惠券, discount_code=折扣码');
    table.string('discount_type', 20).notNullable().comment('折扣类型: fixed_amount=固定金额, percentage=百分比');
    table.decimal('discount_value', 10, 2).notNullable().comment('折扣值');
    table.datetime('start_at').notNullable().comment('开始时间');
    table.datetime('end_at').notNullable().comment('结束时间');
    table.string('release_rule', 20).notNullable().comment('发放规则: auto_new_user=新人自动发放, manual_claim=用户手动领取');
    table.decimal('min_order_amount', 10, 2).defaultTo(0).comment('最低订单金额');
    table.integer('total_quota').unsigned().notNullable().comment('总发放数量');
    table.integer('claimed_count').unsigned().defaultTo(0).comment('已领取数量');
    table.integer('max_per_user').unsigned().defaultTo(1).comment('每人限领数量');
    table.string('status', 20).defaultTo('active').comment('状态: active=进行中, ended=已结束, offline=已下线');
    table.timestamps(true, true);

    // 索引
    table.index('status', 'idx_promotions_status');
    table.index(['start_at', 'end_at'], 'idx_promotions_dates');
  })
  .then(() => {
    console.log('✓ promotions表创建成功');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('promotions');
};
```

### 2. 用户优惠券表迁移文件
**文件名**：`backend/src/db/migrations/20251029100002_create_user_coupons_table.js`

**表结构**：
```javascript
exports.up = function(knex) {
  return knex.schema.createTable('user_coupons', function(table) {
    table.string('id', 32).primary().comment('优惠券ID');
    table.string('user_id', 32).notNullable().comment('用户ID');
    table.string('promotion_id', 32).notNullable().comment('活动ID');
    table.string('status', 20).defaultTo('unused').comment('状态: unused=未使用, locked=锁定中, used=已使用, expired=已过期');
    table.string('order_id', 32).nullable().comment('关联订单ID');
    table.datetime('claimed_at').defaultTo(knex.fn.now()).comment('领取时间');
    table.datetime('used_at').nullable().comment('使用时间');
    table.datetime('expire_at').notNullable().comment('过期时间');
    table.timestamps(true, true);

    // 外键
    table.foreign('user_id').references('users.id').onDelete('CASCADE');
    table.foreign('promotion_id').references('promotions.id').onDelete('CASCADE');

    // 索引
    table.index(['user_id', 'status'], 'idx_user_coupons_user_status');
    table.index('promotion_id', 'idx_user_coupons_promotion');
    table.index('expire_at', 'idx_user_coupons_expire');

    // 唯一约束：防止用户重复领取同一活动的券
    table.unique(['user_id', 'promotion_id'], 'uk_user_promotion');
  })
  .then(() => {
    console.log('✓ user_coupons表创建成功');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('user_coupons');
};
```

### 3. 订单表扩展迁移文件
**文件名**：`backend/src/db/migrations/20251029100003_extend_orders_for_coupons.js`

**扩展字段**：
```javascript
exports.up = function(knex) {
  return knex.schema.table('orders', function(table) {
    table.string('coupon_id', 32).nullable().comment('使用的优惠券ID');
    table.decimal('original_amount', 10, 2).nullable().comment('原价');
    table.decimal('discount_amount', 10, 2).defaultTo(0).comment('优惠金额');
    table.decimal('final_amount', 10, 2).nullable().comment('实付金额');

    // 索引
    table.index('coupon_id', 'idx_orders_coupon');
  })
  .then(() => {
    console.log('✓ orders表扩展成功');
  });
};

exports.down = function(knex) {
  return knex.schema.table('orders', function(table) {
    table.dropIndex('coupon_id', 'idx_orders_coupon');
    table.dropColumn('coupon_id');
    table.dropColumn('original_amount');
    table.dropColumn('discount_amount');
    table.dropColumn('final_amount');
  });
};
```

---

## 技术要求

### 1. 字段约束
- 所有ID字段使用VARCHAR(32)，便于存储shortid或uuid
- 所有金额字段使用DECIMAL(10,2)，保证精度
- 所有时间字段使用DATETIME类型
- 所有状态字段使用VARCHAR(20)，使用英文枚举值

### 2. 索引设计
- **单列索引**：高频查询字段（status, expire_at）
- **复合索引**：组合查询字段（user_id + status, start_at + end_at）
- **唯一索引**：防止重复数据（user_id + promotion_id）

### 3. 外键约束
- 设置外键约束确保数据完整性
- 使用CASCADE删除确保数据清理

### 4. 注释规范
- 所有表、字段必须有中文注释
- 枚举值在注释中列出所有可能值

### 5. 回滚能力
- 所有迁移文件必须提供down方法
- down方法必须能完全回滚up方法的操作

---

## 数据字典

### promotions 表（活动表）

| 字段名 | 类型 | 约束 | 说明 | 示例值 |
|--------|------|------|------|--------|
| id | VARCHAR(32) | PK | 活动ID | promo_abc123 |
| name | VARCHAR(100) | NOT NULL | 活动名称 | 双十一特惠 |
| type | VARCHAR(20) | NOT NULL | 活动类型 | coupon |
| discount_type | VARCHAR(20) | NOT NULL | 折扣类型 | fixed_amount |
| discount_value | DECIMAL(10,2) | NOT NULL | 折扣值 | 20.00 |
| start_at | DATETIME | NOT NULL | 开始时间 | 2025-11-01 00:00:00 |
| end_at | DATETIME | NOT NULL | 结束时间 | 2025-11-11 23:59:59 |
| release_rule | VARCHAR(20) | NOT NULL | 发放规则 | manual_claim |
| min_order_amount | DECIMAL(10,2) | DEFAULT 0 | 最低订单金额 | 99.00 |
| total_quota | INT UNSIGNED | NOT NULL | 总发放数量 | 1000 |
| claimed_count | INT UNSIGNED | DEFAULT 0 | 已领取数量 | 856 |
| max_per_user | INT UNSIGNED | DEFAULT 1 | 每人限领数量 | 1 |
| status | VARCHAR(20) | DEFAULT 'active' | 状态 | active |
| created_at | DATETIME | AUTO | 创建时间 | |
| updated_at | DATETIME | AUTO | 更新时间 | |

### user_coupons 表（用户优惠券表）

| 字段名 | 类型 | 约束 | 说明 | 示例值 |
|--------|------|------|------|--------|
| id | VARCHAR(32) | PK | 优惠券ID | coupon_xyz789 |
| user_id | VARCHAR(32) | FK, NOT NULL | 用户ID | user_123 |
| promotion_id | VARCHAR(32) | FK, NOT NULL | 活动ID | promo_abc123 |
| status | VARCHAR(20) | DEFAULT 'unused' | 状态 | unused |
| order_id | VARCHAR(32) | NULL | 关联订单ID | order_456 |
| claimed_at | DATETIME | DEFAULT NOW | 领取时间 | 2025-11-01 10:00:00 |
| used_at | DATETIME | NULL | 使用时间 | 2025-11-02 15:30:00 |
| expire_at | DATETIME | NOT NULL | 过期时间 | 2025-11-11 23:59:59 |
| created_at | DATETIME | AUTO | 创建时间 | |
| updated_at | DATETIME | AUTO | 更新时间 | |

### orders 表扩展字段

| 字段名 | 类型 | 约束 | 说明 | 示例值 |
|--------|------|------|------|--------|
| coupon_id | VARCHAR(32) | NULL | 使用的优惠券ID | coupon_xyz789 |
| original_amount | DECIMAL(10,2) | NULL | 原价 | 99.00 |
| discount_amount | DECIMAL(10,2) | DEFAULT 0 | 优惠金额 | 20.00 |
| final_amount | DECIMAL(10,2) | NULL | 实付金额 | 79.00 |

---

## 禁止事项

### ❌ 严格禁止
1. **不允许修改现有表的主键**
   - 不能更改users.id、orders.id等主键类型
2. **不允许删除现有字段**
   - 不能删除orders表的amount、status等现有字段
3. **不允许修改现有外键约束**
   - 不能更改现有的外键关系
4. **不允许在迁移中插入数据**
   - 迁移文件只负责表结构，不插入业务数据
5. **不允许使用硬编码的表名前缀**
   - 统一使用knex配置的表名

---

## 验证清单

### 迁移前检查
- [ ] 已阅读现有数据库表结构
- [ ] 确认不与现有表名冲突
- [ ] 确认外键引用的表已存在

### 迁移执行
```bash
# 执行迁移
npm run db:migrate:latest

# 验证表是否创建成功
mysql -u root -p -e "SHOW TABLES LIKE 'promotions';"
mysql -u root -p -e "DESCRIBE promotions;"
mysql -u root -p -e "DESCRIBE user_coupons;"
mysql -u root -p -e "DESCRIBE orders;"

# 验证索引是否创建成功
mysql -u root -p -e "SHOW INDEX FROM promotions;"
mysql -u root -p -e "SHOW INDEX FROM user_coupons;"
```

### 迁移后验证
- [ ] promotions表已创建，包含所有字段
- [ ] user_coupons表已创建，包含所有字段和外键
- [ ] orders表已扩展，包含优惠券相关字段
- [ ] 所有索引已创建
- [ ] 外键约束已生效

### 回滚测试
```bash
# 测试回滚
npm run db:migrate:rollback

# 验证表是否已删除
mysql -u root -p -e "SHOW TABLES LIKE 'promotions';"

# 重新迁移
npm run db:migrate:latest
```

- [ ] 回滚成功，表已删除
- [ ] 重新迁移成功，表已恢复

---

## 交付方式

### 1. 代码提交
```bash
git add backend/src/db/migrations/20251029100001_create_promotions_table.js
git add backend/src/db/migrations/20251029100002_create_user_coupons_table.js
git add backend/src/db/migrations/20251029100003_extend_orders_for_coupons.js
git commit -m "feat(db): add promotion and coupon tables for marketing system"
git push origin develop
```

### 2. 验证记录
在 PR 描述中提供：
- [ ] 迁移执行成功的截图
- [ ] 表结构查询结果
- [ ] 回滚测试结果

### 3. 文档更新
无需更新文档，数据库schema由代码自解释。

---

## 预计工作量

**预计时间**：0.5天

- 编写迁移文件：2小时
- 本地测试执行：1小时
- 回滚测试：0.5小时
- 代码审查修改：0.5小时

---

## 依赖关系

### 前置任务
- 无（可立即开始）

### 后置任务
- 任务卡-Backend-活动营销.md（依赖本任务）

---

**任务卡结束**
