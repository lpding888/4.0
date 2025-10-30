# 任务卡:代码审查 - 分销代理系统

> **负责技能**:reviewer_skill
> **优先级**:P0(阻塞性)
> **预计工期**:1天

---

## 任务目标

对分销代理系统的全部代码进行审查,确保代码质量、安全性、性能符合标准,可以安全合并到主分支。

---

## 审查范围

### ✅ 必须审查
1. 代码质量(可读性、可维护性)
2. 安全性(SQL注入、XSS等)
3. 性能(查询优化、索引使用)
4. 接口合同兼容性
5. 品牌视觉一致性(前端)
6. 财务逻辑正确性(重点)

---

## 审查清单

### 1. 代码质量

#### 后端代码
- [ ] 是否符合项目编码规范
- [ ] 是否有足够的注释(复杂逻辑必须注释)
- [ ] 是否有重复代码需要重构
- [ ] 错误处理是否完善(try-catch覆盖)
- [ ] 日志记录是否合理

**审查要点**:
```javascript
// ✅ 好的代码:有注释、错误处理完善
/**
 * 计算并创建佣金记录(仅首单计佣)
 * @param {Object} trx - 数据库事务对象
 * @param {string} userId - 被推荐用户ID
 * @param {string} orderId - 订单ID
 * @param {number} orderAmount - 订单实付金额
 * @returns {Promise<string|null>} 佣金记录ID或null
 */
async function calculateAndCreateCommission(trx, userId, orderId, orderAmount) {
  try {
    // 1. 检查是否是首单
    const orderCount = await trx('orders')
      .where({ user_id: userId, status: 'paid' })
      .count('id as count')
      .first();

    if (orderCount.count > 1) {
      logger.info(`[Commission] 用户${userId}非首单,不计佣`);
      return null;
    }

    // 2. 查询推荐关系...
  } catch (error) {
    logger.error(`[Commission] 佣金计算失败: ${error.message}`, { userId, orderId });
    throw error;
  }
}

// ❌ 不好的代码:没注释、错误处理不完善
async function calculateCommission(userId, orderId, amount) {
  const relation = await db('referral_relationships').where({ referred_user_id: userId }).first();
  const commission = amount * 0.15;
  await db('commissions').insert({...});
}
```

#### 前端代码
- [ ] 组件拆分是否合理
- [ ] 是否有大段重复代码
- [ ] TypeScript类型定义是否完整
- [ ] 错误处理是否友好
- [ ] Loading状态是否处理

**审查要点**:
```typescript
// ✅ 好的代码:类型完整、错误处理
interface WithdrawalFormData {
  amount: number;
  method: 'wechat' | 'alipay';
  accountInfo: {
    account: string;
    name: string;
  };
}

export function WithdrawalForm({ onSubmit }: Props) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<WithdrawalFormData>();

  const onFormSubmit = async (data: WithdrawalFormData) => {
    try {
      setLoading(true);
      await onSubmit(data);
      toast.success('提现申请已提交');
      router.push('/distribution/withdrawals');
    } catch (error) {
      toast.error(error.message || '提交失败,请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)}>
      {/* 表单内容 */}
    </form>
  );
}

// ❌ 不好的代码:类型缺失、没有错误处理
export function WithdrawalForm({ onSubmit }: any) {
  const onFormSubmit = (data) => {
    onSubmit(data);
  };
  return <form onSubmit={onFormSubmit}>...</form>;
}
```

---

### 2. 安全性

#### SQL注入防护
- [ ] 是否使用参数化查询
- [ ] 是否有拼接SQL的情况

```javascript
// ✅ 正确:使用参数化查询
await db('distributors')
  .where({ user_id: userId, status: 'active' })
  .first();

// ❌ 错误:SQL拼接
await db.raw(`SELECT * FROM distributors WHERE user_id = '${userId}'`);
```

#### XSS防护
- [ ] 用户输入是否做了转义
- [ ] 是否使用`dangerouslySetInnerHTML`

```typescript
// ✅ 正确:React自动转义
<div>{distributorName}</div>

// ❌ 错误:直接插入HTML
<div dangerouslySetInnerHTML={{ __html: distributorName }} />
```

#### 敏感信息保护
- [ ] 是否暴露了内部ID或密钥
- [ ] 日志是否包含身份证号、账户信息等敏感信息
- [ ] API响应是否包含不该暴露的字段

```javascript
// ✅ 正确:脱敏处理
{
  "phone": "138****8888",
  "idCard": "110101********1234"
}

// ❌ 错误:暴露完整信息
{
  "phone": "13800138000",
  "idCard": "110101199001011234"
}
```

---

### 3. 性能

#### 数据库性能
- [ ] 是否有N+1查询问题
- [ ] 是否使用了索引
- [ ] 是否有不必要的多次查询

```javascript
// ✅ 好的:一次查询获取关联数据
const distributors = await db('distributors')
  .leftJoin('users', 'distributors.user_id', 'users.id')
  .select(
    'distributors.*',
    'users.phone',
    db.raw('(SELECT COUNT(*) FROM referral_relationships WHERE referrer_distributor_id = distributors.id) as total_referrals')
  );

// ❌ 不好的:N+1查询
const distributors = await db('distributors').select('*');
for (const d of distributors) {
  const user = await db('users').where({ id: d.user_id }).first();
  const referralCount = await db('referral_relationships')
    .where({ referrer_distributor_id: d.id })
    .count();
}
```

#### 索引使用检查
```sql
-- 检查查询是否使用索引
EXPLAIN SELECT * FROM commissions WHERE distributor_id = 'dist_123';

-- 应该使用索引:idx_commissions_distributor
```

#### 前端性能
- [ ] 是否有不必要的重渲染
- [ ] 是否使用了React.memo或useMemo
- [ ] 列表是否使用了key
- [ ] 是否有大量的inline function

```typescript
// ✅ 好的:使用React.memo优化
export const CommissionCard = React.memo(({ commission }: Props) => {
  return <div>...</div>;
});

// ✅ 好的:使用useMemo缓存计算结果
const totalCommission = useMemo(() => {
  return commissions.reduce((sum, c) => sum + c.commission_amount, 0);
}, [commissions]);

// ❌ 不好的:每次渲染都重新计算
const totalCommission = commissions.reduce((sum, c) => sum + c.commission_amount, 0);
```

---

### 4. 接口兼容性

- [ ] 是否破坏了现有接口合同
- [ ] 新增字段是否向后兼容
- [ ] 是否修改了现有字段的含义

```javascript
// ✅ 正确:新增字段,不破坏兼容性
// users表新增字段
{
  "id": "user_123",
  "phone": "13800138000",
  "referrer_id": "user_456"  // 新增字段
}

// ❌ 错误:修改字段含义
// orders表修改字段
{
  "amount": 79  // 原本是原价,现在变成实付价,破坏兼容性
}
```

---

### 5. 品牌视觉一致性(前端)

- [ ] 是否使用了品牌色彩系统
- [ ] 是否符合高奢风格(深色渐变+玻璃卡片)
- [ ] 按钮样式是否一致
- [ ] 字体大小和层级是否合理

```css
/* ✅ 正确:使用品牌风格 */
.distributor-card {
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(59, 130, 246, 0.2));
  border: 1px solid rgba(6, 182, 212, 0.3);
  backdrop-filter: blur(10px);
}

/* ❌ 错误:不符合品牌风格 */
.distributor-card {
  background: white;
  border: 1px solid #ccc;
}
```

---

### 6. 财务逻辑正确性(重点)

- [ ] 佣金计算是否仅在首单时触发
- [ ] 佣金计算是否基于订单实付金额
- [ ] 是否有唯一索引防止重复计佣
- [ ] 提现金额校验是否严格
- [ ] 提现时是否使用行锁
- [ ] 提现拒绝是否正确退还余额
- [ ] 推荐关系是否永久绑定不可更改

**关键代码审查**:
```javascript
// ✅ 正确:首单检查
const orderCount = await trx('orders')
  .where({ user_id: userId, status: 'paid' })
  .count('id as count')
  .first();

if (orderCount.count > 1) {
  return null; // 不是首单,不计佣
}

// ✅ 正确:基于实付金额
const commissionAmount = order.final_amount * rate / 100;

// ✅ 正确:防止重复计佣
try {
  await trx('commissions').insert({...});
} catch (error) {
  if (error.code === 'ER_DUP_ENTRY') {
    return null; // 已计佣过
  }
}

// ✅ 正确:提现时使用行锁
const distributor = await trx('distributors')
  .where({ user_id: userId })
  .forUpdate()
  .first();
```

---

## 审查产出物

```markdown
# 分销代理系统代码审查报告

## 审查时间
2025-10-XX

## 审查人
reviewer_skill

## 审查结果总览
- 🔴 必须修复:X 个
- 🟡 建议修复:X 个
- 🟢 可选修复:X 个

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

### 财务逻辑(重点)
- [x] 仅首单计佣 ✅
- [x] 基于实付金额 ✅
- [x] 防止重复计佣 ✅
- [x] 提现金额校验严格 ✅
- [x] 提现使用行锁 ✅
- [x] 推荐关系永久绑定 ✅

## 发现的问题

### 🔴 必须修复
无

### 🟡 建议修复
无

### 🟢 可选修复
无

## 最终判定
☑️ **审查通过**,可以合并到main分支

签字:____________
日期:____________
```

---

**预计工作量**:1天
