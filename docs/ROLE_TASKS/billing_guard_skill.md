# Billing Guard Skill - 任务卡清单

## 任务1:配额预扣服务 - 事务+行锁

**产出物**:
- `backend/src/services/quota.service.js` (改造)

**执行内容**:

### 1.1 deductQuota 方法
```javascript
/**
 * 预扣配额(任务创建时调用)
 * @param {number} userId - 用户ID
 * @param {number} quotaCost - 需扣减的配额点数
 * @returns {Promise<boolean>} - 成功返回 true,余额不足抛出异常
 */
async function deductQuota(userId, quotaCost) {
  return await db.transaction(async (trx) => {
    // 1. 行锁查询用户配额
    const user = await trx('users')
      .where({ id: userId })
      .forUpdate()
      .first();
    
    if (!user) {
      throw new Error('用户不存在');
    }
    
    // 2. 检查余额
    if (user.quota_remaining < quotaCost) {
      throw new QuotaInsufficientError(
        `配额不足,当前余额:${user.quota_remaining},需要:${quotaCost}`
      );
    }
    
    // 3. 扣减配额
    await trx('users')
      .where({ id: userId })
      .update({
        quota_remaining: user.quota_remaining - quotaCost,
        updated_at: new Date()
      });
    
    // 4. 记录扣费日志
    await trx('quota_logs').insert({
      user_id: userId,
      amount: -quotaCost,
      type: 'deduct',
      reason: 'task_creation',
      balance_after: user.quota_remaining - quotaCost,
      created_at: new Date()
    });
    
    return true;
  });
}
```

**验收标准**:
- 使用 `FOR UPDATE` 行锁,防止并发超扣
- 余额不足时抛出 QuotaInsufficientError (HTTP 402)
- 扣费和日志记录在同一事务中
- 并发100个请求同时扣费,配额总数不会出错

**禁止事项**:
- 禁止不使用行锁(会导致并发超扣)
- 禁止在事务外修改 quota_remaining
- 禁止跳过配额检查

**依赖项**:
- users 表有 quota_remaining 字段
- quota_logs 表已创建

---

## 任务2:配额返还服务 - 失败自动退款

**产出物**:
- `backend/src/services/quota.service.js` (改造)

**执行内容**:

### 2.1 refundQuota 方法
```javascript
/**
 * 返还配额(任务失败时调用)
 * @param {string} taskId - 任务ID
 * @returns {Promise<boolean>} - 成功返回 true,不符合条件抛出异常
 */
async function refundQuota(taskId) {
  return await db.transaction(async (trx) => {
    // 1. 行锁查询任务
    const task = await trx('tasks')
      .where({ id: taskId })
      .forUpdate()
      .first();
    
    if (!task) {
      throw new Error('任务不存在');
    }
    
    // 2. 检查是否符合返还条件
    if (!task.eligible_for_refund) {
      throw new Error('任务不符合返还条件');
    }
    
    if (task.refunded) {
      throw new Error('配额已返还,不能重复操作');
    }
    
    // 3. 返还配额
    await trx('users')
      .where({ id: task.user_id })
      .increment('quota_remaining', task.quota_cost);
    
    // 4. 标记任务已返还
    await trx('tasks')
      .where({ id: taskId })
      .update({
        refunded: true,
        refunded_at: new Date()
      });
    
    // 5. 记录返还日志
    await trx('quota_logs').insert({
      user_id: task.user_id,
      amount: task.quota_cost,
      type: 'refund',
      reason: 'task_failed',
      task_id: taskId,
      created_at: new Date()
    });
    
    return true;
  });
}
```

### 2.2 返还触发时机
**在 PipelineEngine 中调用**:
- 任何 step 失败时:
  1. 更新 tasks.status='failed'
  2. 设置 tasks.eligible_for_refund=true
  3. 调用 quota.service.refundQuota(taskId)

**返还条件**:
- eligible_for_refund=true (技术失败)
- refunded=false (未返还过)

**不返还的情况**:
- 任务成功但用户不满意(主观评价)
- 任务被用户手动取消(非技术失败)

**验收标准**:
- 使用行锁防止重复返还
- refunded 字段防止同一任务多次返还
- 返还后 quota_remaining 正确增加
- quota_logs 正确记录返还原因

**禁止事项**:
- 禁止基于"生成质量不好"返还配额
- 禁止允许用户手动申请退款(只能自动触发)
- 禁止重复返还

**依赖项**:
- tasks 表有 eligible_for_refund、refunded、refunded_at 字段
- quota_logs 表已创建

---

## 任务3:限流策略 - Redis计数器

**产出物**:
- `backend/src/services/quota.service.js` (改造)
- `backend/src/utils/redis.js` (Redis 工具)

**执行内容**:

### 3.1 checkRateLimit 方法
```javascript
/**
 * 检查限流策略
 * @param {number} userId - 用户ID
 * @param {string} featureId - 功能ID
 * @param {string} policy - 限流策略,格式: "hourly:3" 或 "daily:10"
 * @returns {Promise<boolean>} - 未超限返回 true,超限抛出异常
 */
async function checkRateLimit(userId, featureId, policy) {
  if (!policy) {
    return true; // 无限流策略
  }
  
  // 1. 解析策略
  const [window, limit] = policy.split(':');
  const windowSeconds = {
    'hourly': 3600,
    'daily': 86400,
    'weekly': 604800
  }[window];
  
  if (!windowSeconds) {
    throw new Error(`无效的限流策略:${policy}`);
  }
  
  // 2. Redis key
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const key = `rate_limit:${userId}:${featureId}:${windowStart}`;
  
  // 3. 自增计数器
  const redis = getRedisClient();
  const count = await redis.incr(key);
  
  // 4. 设置过期时间(首次创建时)
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }
  
  // 5. 检查是否超限
  if (count > parseInt(limit)) {
    const resetTime = windowStart + windowSeconds;
    const waitMinutes = Math.ceil((resetTime - now) / 60);
    
    throw new RateLimitError(
      `操作过于频繁,请${waitMinutes}分钟后再试`,
      { resetTime: resetTime }
    );
  }
  
  return true;
}
```

### 3.2 Redis 连接工具
```javascript
// backend/src/utils/redis.js
const Redis = require('ioredis');

let redisClient = null;

function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: 0,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });
  }
  return redisClient;
}

module.exports = { getRedisClient };
```

**验收标准**:
- 限流策略正确解析(hourly:3、daily:10 等)
- Redis 计数器正确递增
- 超限时返回 429 错误,并提示还需等待多久
- 时间窗口滚动正确(每小时重置)

**禁止事项**:
- 禁止使用数据库实现限流(性能差)
- 禁止不设置 key 过期时间(会导致 Redis 内存泄漏)
- 禁止在限流失败后仍扣配额

**依赖项**:
- Redis 服务已部署
- ioredis 库已安装
- 环境变量 REDIS_HOST、REDIS_PASSWORD 已配置

---

## 任务4:套餐权限验证

**产出物**:
- `backend/src/services/quota.service.js` (改造)

**执行内容**:

### 4.1 checkPlanPermission 方法
```javascript
/**
 * 检查套餐权限
 * @param {number} userId - 用户ID
 * @param {string} featureId - 功能ID
 * @returns {Promise<boolean>} - 有权限返回 true,无权限抛出异常
 */
async function checkPlanPermission(userId, featureId) {
  // 1. 查询功能定义
  const feature = await db('feature_definitions')
    .where({ feature_id: featureId, is_enabled: true })
    .first();
  
  if (!feature) {
    throw new Error('功能不存在或未开放');
  }
  
  // 2. 查询用户信息
  const user = await db('users')
    .where({ id: userId })
    .first();
  
  if (!user) {
    throw new Error('用户不存在');
  }
  
  // 3. 根据 access_scope 判断
  if (feature.access_scope === 'plan') {
    // 按套餐判断
    const planLevels = {
      '基础': 1,
      'PRO': 2,
      '企业': 3
    };
    
    const requiredLevel = planLevels[feature.plan_required];
    const userLevel = planLevels[user.membership_level] || 0;
    
    if (userLevel < requiredLevel) {
      throw new PlanInsufficientError(
        `该功能需要${feature.plan_required}会员,请升级会员`,
        { required: feature.plan_required }
      );
    }
  } else if (feature.access_scope === 'whitelist') {
    // 按白名单判断
    const allowedAccounts = JSON.parse(feature.allowed_accounts || '[]');
    
    if (!allowedAccounts.includes(user.id.toString())) {
      throw new Error('您暂无权限使用此功能');
    }
  }
  
  return true;
}
```

**验收标准**:
- 基础会员无法使用 PRO 功能
- PRO 会员可以使用基础功能
- 白名单功能只对指定账号开放
- 权限不足时返回 403 错误

**禁止事项**:
- 禁止在前端判断权限(必须在后端校验)
- 禁止跳过权限检查

**依赖项**:
- users 表有 membership_level 字段
- feature_definitions 表有 access_scope、allowed_accounts 字段

---

## 任务5:配额日志表和查询接口

**产出物**:
- `backend/src/db/migrations/20251029000009_create_quota_logs_table.js`
- `backend/src/controllers/quota.controller.js`
- `backend/src/routes/quota.routes.js`

**执行内容**:

### 5.1 quota_logs 表
```sql
CREATE TABLE quota_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount INT NOT NULL,
  type VARCHAR(20) NOT NULL,
  reason VARCHAR(100),
  task_id VARCHAR(100),
  balance_after INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_created (user_id, created_at DESC)
);
```

### 5.2 GET /api/quota/logs
**功能**: 查询当前用户的配额变动历史

**响应**:
```json
{
  "logs": [
    {
      "id": 123,
      "amount": -2,
      "type": "deduct",
      "reason": "task_creation",
      "task_id": "t_abc123",
      "balance_after": 8,
      "created_at": "2025-10-29T10:00:00Z"
    },
    {
      "id": 124,
      "amount": 2,
      "type": "refund",
      "reason": "task_failed",
      "task_id": "t_abc123",
      "balance_after": 10,
      "created_at": "2025-10-29T10:05:00Z"
    },
    {
      "id": 125,
      "amount": 100,
      "type": "purchase",
      "reason": "order_12345",
      "balance_after": 110,
      "created_at": "2025-10-29T11:00:00Z"
    }
  ],
  "current_balance": 110
}
```

**验收标准**:
- 用户只能查询自己的配额日志
- 日志按时间倒序排列
- 显示每次操作后的余额

**禁止事项**:
- 禁止用户查询他人的配额日志
- 禁止允许用户修改或删除配额日志

**依赖项**:
- quota_logs 表已创建

---

## 任务6:配额充值接口(订单完成后增加配额)

**产出物**:
- `backend/src/services/quota.service.js` (改造)

**执行内容**:

### 6.1 addQuota 方法
```javascript
/**
 * 增加配额(订单支付成功后调用)
 * @param {number} userId - 用户ID
 * @param {number} amount - 增加的配额点数
 * @param {string} orderId - 订单ID
 * @returns {Promise<boolean>}
 */
async function addQuota(userId, amount, orderId) {
  return await db.transaction(async (trx) => {
    // 1. 检查订单是否已处理
    const existingLog = await trx('quota_logs')
      .where({ user_id: userId, reason: `order_${orderId}` })
      .first();
    
    if (existingLog) {
      throw new Error('订单已处理,不能重复充值');
    }
    
    // 2. 增加配额
    await trx('users')
      .where({ id: userId })
      .increment('quota_remaining', amount);
    
    // 3. 记录日志
    const user = await trx('users').where({ id: userId }).first();
    await trx('quota_logs').insert({
      user_id: userId,
      amount: amount,
      type: 'purchase',
      reason: `order_${orderId}`,
      balance_after: user.quota_remaining,
      created_at: new Date()
    });
    
    return true;
  });
}
```

**验收标准**:
- 同一订单不能重复充值
- 充值后 quota_remaining 正确增加
- quota_logs 正确记录充值原因

**禁止事项**:
- 禁止允许重复充值
- 禁止不记录日志

**依赖项**:
- orders 表已存在
- 订单支付回调已实现

---

## 任务7:配额监控和告警

**产出物**:
- `backend/src/jobs/quotaMonitor.job.js`

**执行内容**:

### 7.1 低配额告警
```javascript
const cron = require('node-cron');

// 每天检查一次配额不足的用户
cron.schedule('0 9 * * *', async () => {
  // 查询配额低于10的付费用户
  const lowQuotaUsers = await db('users')
    .where('quota_remaining', '<', 10)
    .where('membership_level', '!=', '基础')
    .select('id', 'email', 'quota_remaining');
  
  for (const user of lowQuotaUsers) {
    // 发送邮件或站内信提醒
    await sendLowQuotaNotification(user);
  }
});
```

### 7.2 异常扣费监控
```javascript
// 每小时检查一次异常扣费
cron.schedule('0 * * * *', async () => {
  const oneHourAgo = new Date(Date.now() - 60*60*1000);
  
  // 查询 1 小时内扣费超过 100 次的用户
  const suspiciousUsers = await db('quota_logs')
    .where('type', 'deduct')
    .where('created_at', '>', oneHourAgo)
    .groupBy('user_id')
    .havingRaw('COUNT(*) > 100')
    .select('user_id', db.raw('COUNT(*) as deduct_count'));
  
  if (suspiciousUsers.length > 0) {
    // 发送告警通知
    await sendAnomalyAlert(suspiciousUsers);
  }
});
```

**验收标准**:
- 低配额用户收到邮件提醒
- 异常扣费触发告警通知
- 定时任务稳定运行

**禁止事项**:
- 禁止在监控中修改用户配额
- 禁止发送过于频繁的告警

**依赖项**:
- 邮件服务已配置
- 定时任务框架已配置

---

## 依赖规范

### 计费时机
1. **预扣配额**: 任务创建时(`POST /api/tasks/create`)立即扣减
2. **返还配额**: 任务失败时(`PipelineEngine.handleTaskFailure`)自动返还
3. **充值配额**: 订单支付成功后(`membership.service`)增加配额

### 返还条件
1. **技术失败**: pipeline 任何 step 执行失败(超时/报错/供应商失败)
2. **不返还**: 任务成功但用户主观评价不满意

### 限流策略格式
- `hourly:3` - 每小时最多 3 次
- `daily:10` - 每天最多 10 次
- `weekly:20` - 每周最多 20 次

### 套餐权限级别
- 基础 < PRO < 企业
- 高级别会员可以使用低级别功能
- 白名单功能独立于套餐级别

### 事务要求
1. **预扣配额**: 必须使用 `FOR UPDATE` 行锁
2. **返还配额**: 必须使用 `FOR UPDATE` 行锁
3. **充值配额**: 必须检查订单是否已处理

### Redis 规范
1. **key 格式**: `rate_limit:{user_id}:{feature_id}:{window_start}`
2. **过期时间**: 必须设置,等于时间窗口长度
3. **连接池**: 使用单例模式,不重复创建连接

### 错误码规范
- **402**: 配额不足
- **403**: 套餐权限不足
- **429**: 限流超限

### 日志记录
所有配额变动必须记录到 quota_logs:
- type: deduct / refund / purchase / grant
- reason: 必填,说明变动原因
- task_id: 如果与任务相关,必须记录

### 交付标准
- 单元测试覆盖率 > 90%
- 并发测试:100 个并发请求同时扣费,配额总数正确
- 限流测试:验证 hourly:3 策略正确拦截
- 返还测试:任务失败后配额正确返还
