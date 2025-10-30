# 任务卡 - 代码审查 (用户积分系统)

> **系统**: 用户积分系统
> **负责人**: Reviewer Skill
> **预计工期**: 1天
> **优先级**: P1
> **依赖**: 后端开发、前端开发完成

---

## 📋 任务概述

对用户积分系统的代码进行全面审查，确保代码质量、安全性、性能和可维护性达标。

---

## 🔍 审查清单

### 1. 代码规范

#### 1.1 命名规范

**检查项**：
- [ ] 文件名使用kebab-case（如`points.service.js`）
- [ ] 变量名使用camelCase（如`availablePoints`）
- [ ] 常量名使用UPPER_SNAKE_CASE（如`POINTS_PER_QUOTA`）
- [ ] 类名使用PascalCase（如`PointsService`）
- [ ] 函数名使用动词开头（如`grantPoints`、`consumePoints`）
- [ ] 布尔变量使用is/has/should开头（如`isExpired`、`hasCheckedIn`）

**错误示例**：
```javascript
// ❌ 错误
const Available_Points = 850;
function Points() { ... }
const is_expired = false;
```

**正确示例**：
```javascript
// ✅ 正确
const availablePoints = 850;
function grantPoints() { ... }
const isExpired = false;
```

---

#### 1.2 代码格式

**检查项**：
- [ ] 使用2空格缩进（不使用Tab）
- [ ] 行末无多余空格
- [ ] 文件末尾有空行
- [ ] 使用单引号（字符串）
- [ ] 对象最后一个属性后有逗号
- [ ] 箭头函数参数使用括号

**工具检查**：
```bash
# 使用ESLint检查
npx eslint backend/src/**/*.js

# 使用Prettier格式化
npx prettier --write backend/src/**/*.js
```

---

### 2. 代码质量

#### 2.1 函数复杂度

**检查项**：
- [ ] 单个函数不超过50行
- [ ] 函数圈复杂度不超过10
- [ ] 嵌套层级不超过3层
- [ ] 单个文件不超过500行

**重构建议**：
如果函数过长或复杂度过高，拆分为多个小函数。

**错误示例**：
```javascript
// ❌ 错误：函数过长，逻辑复杂
async function handlePointsOperation(userId, type, amount) {
  if (type === 'grant') {
    const account = await db('points_accounts').where({ user_id: userId }).first();
    if (!account) {
      await db('points_accounts').insert({ user_id: userId, ... });
    }
    await db('points_accounts').where({ user_id: userId }).increment('available_points', amount);
    await db('points_records').insert({ ... });
  } else if (type === 'consume') {
    const account = await db('points_accounts').where({ user_id: userId }).first();
    if (account.available_points < amount) {
      throw new Error('积分不足');
    }
    // ... 50多行逻辑
  }
}
```

**正确示例**：
```javascript
// ✅ 正确：拆分为多个小函数
async function grantPoints(trx, userId, amount, sourceType, description, relatedId) {
  const account = await ensureAccountExists(trx, userId);
  await updateAccountForGrant(trx, userId, amount);
  await createPointsRecord(trx, userId, 'earn', amount, sourceType, description, relatedId);
}

async function consumePoints(trx, userId, amount, sourceType, description, relatedId) {
  const account = await getAccountWithLock(trx, userId);
  validateSufficientPoints(account, amount);
  await deductPointsFIFO(trx, userId, amount);
  await createPointsRecord(trx, userId, 'consume', -amount, sourceType, description, relatedId);
}
```

---

#### 2.2 重复代码

**检查项**：
- [ ] 相同或相似的代码逻辑抽取为公共函数
- [ ] 避免复制粘贴代码
- [ ] 使用循环或映射替代重复逻辑

**错误示例**：
```javascript
// ❌ 错误：重复代码
async function grantCheckinPoints(userId, points) {
  await db('points_accounts').where({ user_id: userId }).increment('total_points', points);
  await db('points_accounts').where({ user_id: userId }).increment('available_points', points);
  await db('points_records').insert({ user_id: userId, change_type: 'earn', change_amount: points, ... });
}

async function grantTaskPoints(userId, points) {
  await db('points_accounts').where({ user_id: userId }).increment('total_points', points);
  await db('points_accounts').where({ user_id: userId }).increment('available_points', points);
  await db('points_records').insert({ user_id: userId, change_type: 'earn', change_amount: points, ... });
}
```

**正确示例**：
```javascript
// ✅ 正确：抽取公共函数
async function grantPoints(trx, userId, amount, sourceType, description, relatedId) {
  // 统一的积分发放逻辑
  await updateAccountForGrant(trx, userId, amount);
  await createPointsRecord(trx, userId, 'earn', amount, sourceType, description, relatedId);
}

// 签到和任务都调用grantPoints
await grantPoints(trx, userId, points, 'checkin', '签到奖励', null);
await grantPoints(trx, userId, points, 'task', '任务奖励', taskId);
```

---

#### 2.3 错误处理

**检查项**：
- [ ] 所有async函数都有try-catch包裹
- [ ] 错误信息友好且具体
- [ ] 关键操作记录错误日志
- [ ] 数据库操作失败时事务回滚

**错误示例**：
```javascript
// ❌ 错误：没有错误处理
async function checkin(userId) {
  const today = moment().format('YYYY-MM-DD');
  await db('checkin_records').insert({ user_id: userId, checkin_date: today, ... });
  await grantPoints(userId, 10, 'checkin', '签到奖励', null);
}
```

**正确示例**：
```javascript
// ✅ 正确：完善的错误处理
async function checkin(userId) {
  try {
    const today = moment().format('YYYY-MM-DD');

    await db.transaction(async (trx) => {
      try {
        await trx('checkin_records').insert({ user_id: userId, checkin_date: today, ... });
        await grantPoints(trx, userId, 10, 'checkin', '签到奖励', null);
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          throw new Error('今天已签到过了');
        }
        throw error;
      }
    });

    logger.info(`[Checkin] 用户${userId}签到成功`);
  } catch (error) {
    logger.error(`[Checkin] 用户${userId}签到失败: ${error.message}`, { error, userId });
    throw error;
  }
}
```

---

### 3. 安全性

#### 3.1 SQL注入防护

**检查项**：
- [ ] 所有数据库查询使用参数化查询（不拼接SQL）
- [ ] 使用Knex的查询构建器（不使用raw）
- [ ] 用户输入都经过校验和过滤

**错误示例**：
```javascript
// ❌ 错误：SQL注入风险
const userId = req.body.user_id;
const records = await db.raw(`SELECT * FROM points_records WHERE user_id = '${userId}'`);
```

**正确示例**：
```javascript
// ✅ 正确：参数化查询
const userId = req.body.user_id;
const records = await db('points_records').where({ user_id: userId }).select('*');
```

---

#### 3.2 权限校验

**检查项**：
- [ ] 所有接口都校验用户登录状态
- [ ] 管理员接口校验管理员权限
- [ ] 用户只能操作自己的数据
- [ ] 敏感操作记录操作日志

**错误示例**：
```javascript
// ❌ 错误：没有权限校验
router.post('/api/points/redeem/quota', async (req, res) => {
  const { user_id, quota_count } = req.body;
  await redeemQuota(user_id, quota_count);
  res.json({ code: 0, message: 'success' });
});
```

**正确示例**：
```javascript
// ✅ 正确：权限校验
router.post('/api/points/redeem/quota', authenticateUser, async (req, res) => {
  const userId = req.user.id; // 从token中获取
  const { quota_count } = req.body;

  // 用户只能兑换自己的积分
  await redeemQuota(userId, quota_count);

  logger.info(`[RedeemQuota] 用户${userId}兑换${quota_count}个配额`);
  res.json({ code: 0, message: 'success' });
});
```

---

#### 3.3 数据校验

**检查项**：
- [ ] 所有用户输入都经过校验
- [ ] 数值范围校验（如兑换数量1-50）
- [ ] 字符串长度校验
- [ ] 枚举值校验（如任务类型）

**错误示例**：
```javascript
// ❌ 错误：没有校验
async function redeemQuota(userId, quotaCount) {
  const pointsRequired = quotaCount * 100;
  await consumePoints(userId, pointsRequired, ...);
}
```

**正确示例**：
```javascript
// ✅ 正确：完善的校验
async function redeemQuota(userId, quotaCount) {
  // 校验数值类型
  if (typeof quotaCount !== 'number' || !Number.isInteger(quotaCount)) {
    throw new Error('兑换数量必须是整数');
  }

  // 校验数值范围
  if (quotaCount < 1 || quotaCount > 50) {
    throw new Error('兑换数量必须在1-50之间');
  }

  const pointsRequired = quotaCount * 100;
  await consumePoints(userId, pointsRequired, ...);
}
```

---

### 4. 性能优化

#### 4.1 数据库查询优化

**检查项**：
- [ ] 避免N+1查询
- [ ] 使用索引字段查询
- [ ] 避免SELECT *，只查询需要的字段
- [ ] 大数据量查询使用分页

**错误示例**：
```javascript
// ❌ 错误：N+1查询
const records = await db('points_records').where({ user_id: userId }).select('*');
for (const record of records) {
  const account = await db('points_accounts').where({ user_id: record.user_id }).first();
  // ...
}
```

**正确示例**：
```javascript
// ✅ 正确：一次性JOIN查询
const records = await db('points_records')
  .leftJoin('points_accounts', 'points_records.user_id', 'points_accounts.user_id')
  .where('points_records.user_id', userId)
  .select('points_records.*', 'points_accounts.available_points');
```

---

#### 4.2 缓存使用

**检查项**：
- [ ] 高频查询数据使用Redis缓存
- [ ] 缓存设置合理的TTL
- [ ] 数据变更时及时清除缓存
- [ ] 缓存失效时回源查询数据库

**正确示例**：
```javascript
// ✅ 正确：缓存使用
async function getPointsAccount(userId) {
  const cacheKey = `points:account:${userId}`;

  // 优先从缓存读取
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // 缓存未命中，查询数据库
  const account = await db('points_accounts').where({ user_id: userId }).first();

  // 写入缓存（TTL=5分钟）
  await redis.setex(cacheKey, 300, JSON.stringify(account));

  return account;
}

// 数据变更时清除缓存
async function updatePointsAccount(userId, amount) {
  await db('points_accounts').where({ user_id: userId }).increment('available_points', amount);

  // 清除缓存
  const cacheKey = `points:account:${userId}`;
  await redis.del(cacheKey);
}
```

---

#### 4.3 事务使用

**检查项**：
- [ ] 涉及多表操作使用事务
- [ ] 事务范围尽量小（避免大事务）
- [ ] 事务内避免外部API调用
- [ ] 使用行锁防止并发问题

**错误示例**：
```javascript
// ❌ 错误：没有使用事务
async function redeemQuota(userId, quotaCount) {
  await consumePoints(userId, quotaCount * 100, ...);
  await db('users').where({ id: userId }).increment('quota_balance', quotaCount);
  // 如果第二步失败，第一步已经扣除积分，数据不一致
}
```

**正确示例**：
```javascript
// ✅ 正确：使用事务保证原子性
async function redeemQuota(userId, quotaCount) {
  await db.transaction(async (trx) => {
    await consumePoints(trx, userId, quotaCount * 100, ...);
    await trx('users').where({ id: userId }).increment('quota_balance', quotaCount);
  });
}
```

---

### 5. 可维护性

#### 5.1 代码注释

**检查项**：
- [ ] 复杂逻辑有注释说明
- [ ] 公共函数有JSDoc注释
- [ ] 关键业务规则有注释
- [ ] 魔法数字有注释说明

**正确示例**：
```javascript
/**
 * 发放积分（公共函数）
 * @param {Object} trx - 数据库事务对象
 * @param {string} userId - 用户ID
 * @param {number} amount - 积分数量
 * @param {string} sourceType - 来源类型（register, checkin, task, purchase, etc.）
 * @param {string} description - 描述
 * @param {string|null} relatedId - 关联ID（可选）
 */
async function grantPoints(trx, userId, amount, sourceType, description, relatedId = null) {
  // 查询积分账户，如果不存在则创建
  let account = await trx('points_accounts').where({ user_id: userId }).first();

  if (!account) {
    await trx('points_accounts').insert({
      user_id: userId,
      total_points: 0,
      available_points: 0,
      frozen_points: 0,
      used_points: 0,
      expired_points: 0
    });
    account = { total_points: 0, available_points: 0 };
  }

  // 更新积分账户
  await trx('points_accounts')
    .where({ user_id: userId })
    .increment('total_points', amount)
    .increment('available_points', amount);

  // 创建积分记录，有效期365天
  const expireAt = moment().add(365, 'days').format('YYYY-MM-DD');
  await trx('points_records').insert({
    id: `points_rec_${uuidv4()}`,
    user_id: userId,
    change_type: 'earn',
    change_amount: amount,
    source_type: sourceType,
    source_description: description,
    related_id: relatedId,
    balance_before: account.available_points,
    balance_after: account.available_points + amount,
    expire_at: expireAt,
    is_expired: false
  });

  logger.info(`[PointsGrant] 用户${userId}获得${amount}积分，来源:${sourceType}`, {
    description,
    relatedId
  });
}
```

---

#### 5.2 日志记录

**检查项**：
- [ ] 关键操作记录日志（积分发放、消费、冻结等）
- [ ] 错误日志包含完整的错误信息和上下文
- [ ] 日志级别合理（info、warn、error）
- [ ] 敏感信息不记录到日志（密码、Token等）

**正确示例**：
```javascript
// ✅ 正确：完善的日志记录
async function freezePoints(userId, amount, reason) {
  try {
    await db.transaction(async (trx) => {
      // ...
    });

    logger.warn(`[PointsFreeze] 用户${userId}冻结${amount}积分，原因:${reason}`);
  } catch (error) {
    logger.error(`[PointsFreeze] 用户${userId}冻结积分失败: ${error.message}`, {
      error,
      userId,
      amount,
      reason,
      stack: error.stack
    });
    throw error;
  }
}
```

---

#### 5.3 配置管理

**检查项**：
- [ ] 配置项统一管理（不硬编码）
- [ ] 使用环境变量管理敏感配置
- [ ] 配置文件分环境（development、production）
- [ ] 配置项有默认值和校验

**正确示例**：
```javascript
// ✅ 正确：配置统一管理
// config/points.config.js
module.exports = {
  // 积分有效期（天）
  POINTS_VALIDITY_DAYS: parseInt(process.env.POINTS_VALIDITY_DAYS || '365', 10),

  // 购买会员积分比例（充值金额:积分）
  PURCHASE_POINTS_RATIO: parseInt(process.env.PURCHASE_POINTS_RATIO || '10', 10),

  // 积分兑换配额比例（积分:配额）
  QUOTA_REDEEM_RATIO: parseInt(process.env.QUOTA_REDEEM_RATIO || '100', 10),

  // 签到积分规则
  CHECKIN_POINTS: {
    1: 2,
    2: 4,
    3: 6,
    4: 8,
    5: 10
  },

  // 任务积分配置
  TASK_POINTS: {
    profile_complete: { points: 20, repeatable: false, description: '完善个人资料' },
    first_use: { points: 30, repeatable: false, description: '首次使用AI功能' },
    share: { points: 10, repeatable: true, dailyLimit: 3, description: '分享作品' },
    invite: { points: 50, repeatable: true, monthlyLimit: 5, description: '邀请好友注册' },
    purchase: { points: 100, repeatable: false, description: '首次购买会员' },
    review: { points: 5, repeatable: true, dailyLimit: 10, description: '评价AI生成结果' }
  }
};
```

---

## 📊 代码审查报告

审查完成后，输出审查报告，包括：

### 1. 代码质量评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 代码规范 | /100 | 命名、格式、注释等 |
| 代码质量 | /100 | 复杂度、重复代码、错误处理等 |
| 安全性 | /100 | SQL注入、权限校验、数据校验等 |
| 性能优化 | /100 | 查询优化、缓存、事务等 |
| 可维护性 | /100 | 注释、日志、配置管理等 |
| **综合评分** | **/100** | 加权平均 |

---

### 2. 问题列表

| 问题ID | 严重等级 | 分类 | 问题描述 | 文件位置 | 修复建议 |
|--------|---------|------|---------|---------|---------|
| 1 | P0 | 安全性 | 兑换接口未使用行锁 | points.service.js:120 | 添加.forUpdate() |
| 2 | P1 | 性能 | 积分明细查询使用SELECT * | points.controller.js:45 | 只查询需要的字段 |
| 3 | P2 | 代码质量 | consumePoints函数过长 | points-helper.js:80 | 拆分为多个小函数 |

---

### 3. 优秀实践

列出代码中的优秀实践，供团队学习。

---

### 4. 改进建议

提供整体的改进建议，如架构优化、重构方案等。

---

## ✅ 验收标准

- [ ] 代码规范检查通过（ESLint无错误）
- [ ] 代码质量评分≥80分
- [ ] 无P0级别问题
- [ ] P1级别问题≤3个
- [ ] 所有关键逻辑有单元测试
- [ ] 代码审查报告完整

---

**审查完成后，输出审查报告并通知开发团队修复问题！**
