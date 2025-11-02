# 任务卡：代码审查 - 活动营销系统

> **负责技能**：reviewer_skill
> **优先级**：P0（阻塞性）
> **预计工期**：1天

---

## 任务目标

对活动营销系统的全部代码进行审查，确保代码质量、安全性、性能符合标准，可以安全合并到主分支。

---

## 审查范围

### ✅ 必须审查
1. 代码质量（可读性、可维护性）
2. 安全性（SQL注入、XSS等）
3. 性能（查询优化、索引使用）
4. 接口合同兼容性
5. 品牌视觉一致性（前端）

---

## 审查清单

### 1. 代码质量

#### 后端代码
- [ ] 是否符合项目编码规范
- [ ] 是否有足够的注释（复杂逻辑必须注释）
- [ ] 是否有重复代码需要重构
- [ ] 错误处理是否完善（try-catch覆盖）
- [ ] 日志记录是否合理

**审查要点**：
```javascript
// ✅ 好的代码：有注释、错误处理完善
/**
 * 领取优惠券
 * @param {string} userId - 用户ID
 * @param {string} promotionId - 活动ID
 * @returns {Promise<string>} 优惠券ID
 */
async function claimCoupon(userId, promotionId) {
  try {
    // 使用事务+行锁防止并发超发
    return await db.transaction(async (trx) => {
      const promotion = await trx('promotions')
        .where({ id: promotionId })
        .forUpdate()
        .first();

      // 校验逻辑...
    });
  } catch (error) {
    logger.error(`[claimCoupon] 领券失败: ${error.message}`, { userId, promotionId });
    throw error;
  }
}

// ❌ 不好的代码：没注释、错误处理不完善
async function claimCoupon(userId, promotionId) {
  const promotion = await db('promotions').where({ id: promotionId }).first();
  // ... 直接操作，没有错误处理
}
```

#### 前端代码
- [ ] 组件拆分是否合理
- [ ] 是否有大段重复代码
- [ ] TypeScript类型定义是否完整
- [ ] 错误处理是否友好
- [ ] Loading状态是否处理

**审查要点**：
```typescript
// ✅ 好的代码：类型完整、错误处理
interface CouponCardProps {
  coupon: Coupon;
  onUse?: (couponId: string) => void;
}

export function CouponCard({ coupon, onUse }: CouponCardProps) {
  const [loading, setLoading] = useState(false);

  const handleUse = async () => {
    try {
      setLoading(true);
      await onUse?.(coupon.id);
      toast.success('优惠券已使用');
    } catch (error) {
      toast.error(error.message || '使用失败');
    } finally {
      setLoading(false);
    }
  };

  return (...);
}

// ❌ 不好的代码：类型缺失、没有错误处理
export function CouponCard({ coupon, onUse }: any) {
  const handleUse = () => {
    onUse(coupon.id);
  };
  return (...);
}
```

---

### 2. 安全性

#### SQL注入防护
- [ ] 是否使用参数化查询
- [ ] 是否有拼接SQL的情况

```javascript
// ✅ 正确：使用参数化查询
await db('users').where({ id: userId }).first();

// ❌ 错误：SQL拼接
await db.raw(`SELECT * FROM users WHERE id = '${userId}'`);
```

#### XSS防护
- [ ] 用户输入是否做了转义
- [ ] 是否使用`dangerouslySetInnerHTML`

```typescript
// ✅ 正确：React自动转义
<div>{promotionName}</div>

// ❌ 错误：直接插入HTML
<div dangerouslySetInnerHTML={{ __html: promotionName }} />
```

#### 敏感信息保护
- [ ] 是否暴露了内部ID或密钥
- [ ] 日志是否包含敏感信息
- [ ] API响应是否包含不该暴露的字段

---

### 3. 性能

#### 数据库性能
- [ ] 是否有N+1查询问题
- [ ] 是否使用了索引
- [ ] 是否有不必要的多次查询

```javascript
// ✅ 好的：一次查询获取关联数据
const promotions = await db('promotions')
  .leftJoin('user_coupons', function() {
    this.on('promotions.id', '=', 'user_coupons.promotion_id')
      .andOn('user_coupons.user_id', '=', db.raw('?', [userId]));
  })
  .select('promotions.*', 'user_coupons.status as user_claimed_status');

// ❌ 不好的：N+1查询
const promotions = await db('promotions').select('*');
for (const p of promotions) {
  const coupon = await db('user_coupons')
    .where({ promotion_id: p.id, user_id: userId })
    .first();
}
```

#### 前端性能
- [ ] 是否有不必要的重渲染
- [ ] 是否使用了React.memo或useMemo
- [ ] 列表是否使用了key
- [ ] 是否有大量的inline function

---

### 4. 接口兼容性

- [ ] 是否破坏了现有接口合同
- [ ] 新增字段是否向后兼容
- [ ] 是否修改了现有字段的含义

```javascript
// ✅ 正确：新增字段，不破坏兼容性
{
  "orderId": "order_123",
  "amount": 99,
  "couponId": "coupon_abc",     // 新增
  "discountAmount": 20,         // 新增
  "finalAmount": 79             // 新增
}

// ❌ 错误：修改字段含义
{
  "amount": 79  // 原本是原价，现在变成实付价，破坏兼容性
}
```

---

### 5. 品牌视觉一致性（前端）

- [ ] 是否使用了品牌色彩系统
- [ ] 是否符合高奢风格（深色渐变+玻璃卡片）
- [ ] 按钮样式是否一致
- [ ] 字体大小和层级是否合理

---

## 审查产出物

```markdown
# 活动营销系统代码审查报告

## 审查时间
2025-10-XX

## 审查人
reviewer_skill

## 审查结果总览
- 🔴 必须修复：X 个
- 🟡 建议修复：X 个
- 🟢 可选修复：X 个

## 详细审查结果

### 代码质量
- [x] 代码规范 ✅
- [x] 注释完整 ✅
- [x] 无重复代码 ✅
- [x] 错误处理完善 ✅

### 安全性
- [x] 无SQL注入风险 ✅
- [x] 无XSS风险 ✅
- [x] 敏感信息保护 ✅

### 性能
- [x] 无N+1查询 ✅
- [x] 索引使用正确 ✅
- [x] 前端性能优化 ✅

### 接口兼容性
- [x] 未破坏现有接口 ✅
- [x] 向后兼容 ✅

### 视觉一致性
- [x] 符合品牌风格 ✅

## 发现的问题

### 🔴 必须修复
无

### 🟡 建议修复
无

### 🟢 可选修复
无

## 最终判定
☑️ **审查通过**，可以合并到main分支

签字：____________
日期：____________
```

---

**预计工作量**：1天
