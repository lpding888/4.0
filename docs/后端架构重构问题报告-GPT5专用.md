# 🔥 AI衣柜后端架构重构问题报告（GPT-5专用）

> **生成时间：** 2025-11-01
> **审计人员：** AI老王（架构审计专家）
> **目标读者：** GPT-5 Pro（架构工程师）
> **文档目的：** 提供完整的架构问题分析，要求GPT-5给出系统性重构方案

---

## 📋 目录

1. [项目前置条件](#项目前置条件)
2. [当前架构现状](#当前架构现状)
3. [P0级致命问题（9个）](#p0级致命问题)
4. [P1级严重问题（9个）](#p1级严重问题)
5. [期望交付产出](#期望交付产出)

---

## 项目前置条件

### 1. 项目基本信息

**项目名称：** AI衣柜后端服务（AI-Photo-SaaS Backend）
**项目定位：** AI图片/视频处理平台后端，支持B2B商业版 + C端个人衣橱
**技术栈：**
- **后端框架：** Node.js 18+ + Express 4.x
- **数据库：** MySQL 8.0（Knex.js ORM）
- **缓存：** Redis 7.x
- **对象存储：** 腾讯云COS
- **AI服务：** RunningHub（第三方AI提供商）
- **部署环境：** Docker + PM2

**代码规模：**
- 后端代码：约15,000行
- 数据库表：20+张表
- API接口：50+个

**团队规模：** 1-2名后端开发 + AI助手

---

### 2. 核心业务流程

#### 用户使用流程：
```
1. 手机验证码登录 → 自动创建用户
2. 购买会员 → 获得配额（如100次）
3. 创建AI任务（上传图片 + 选择功能）
4. Pipeline引擎执行任务
   - Step 1: 图片预处理
   - Step 2: 调用AI Provider（RunningHub）
   - Step 3: 后处理
   - Step 4: 上传结果到COS
5. 返回结果图片/视频
6. 配额扣减（1次）
```

#### Pipeline引擎（核心组件）：
```javascript
// 支持两种格式：
// 格式1：顺序执行（旧格式）
{
  "steps": [
    {"type": "provider", "provider_ref": "runninghub_provider"},
    {"type": "provider", "provider_ref": "image_postprocess"}
  ]
}

// 格式2：并行执行（新格式，支持FORK/JOIN）
{
  "nodes": [
    {"id": "start", "type": "start"},
    {"id": "fork1", "type": "fork"},
    {"id": "ai1", "type": "provider", "data": {"provider_ref": "runninghub_provider"}},
    {"id": "ai2", "type": "provider", "data": {"provider_ref": "another_ai"}},
    {"id": "join1", "type": "join", "data": {"strategy": "ALL"}},
    {"id": "end", "type": "end"}
  ],
  "edges": [
    {"source": "start", "target": "fork1"},
    {"source": "fork1", "target": "ai1"},
    {"source": "fork1", "target": "ai2"},
    {"source": "ai1", "target": "join1"},
    {"source": "ai2", "target": "join1"},
    {"source": "join1", "target": "end"}
  ]
}
```

---

### 3. 关键文件位置

**核心服务：**
- Pipeline引擎：`backend/src/services/pipelineEngine.service.js`
- 配额管理：`backend/src/services/quota.service.js`
- 认证服务：`backend/src/services/auth.service.js`
- 任务管理：`backend/src/services/task.service.js`

**数据库迁移：**
- 用户表：`backend/src/db/migrations/20251028000001_create_users_table.js`
- 任务表：`backend/src/db/migrations/20251028000003_create_tasks_table.js`
- Pipeline Schema表：`backend/src/db/migrations/20251029000003_create_pipeline_schemas_table.js`

**配置文件：**
- 环境变量：`backend/.env`
- 数据库配置：`backend/src/config/database.js`
- Redis配置：`backend/src/config/redis.js`

---

## 当前架构现状

### 架构图（简化版）

```
┌─────────────┐
│   用户      │
└──────┬──────┘
       │ HTTP请求
       ↓
┌─────────────────────────────────────┐
│   Express后端服务（Port 3001）      │
│   ┌─────────────────────────────┐   │
│   │  Routes → Controllers       │   │
│   │         ↓                   │   │
│   │  Services（核心业务逻辑）   │   │
│   │  - pipelineEngine.service   │   │  ← ❌ 缺乏事务支持
│   │  - quota.service            │   │  ← ✅ 已有行锁保护
│   │  - auth.service             │   │  ← ❌ JWT无刷新机制
│   │         ↓                   │   │
│   │  Providers（AI服务调用）    │   │  ← ❌ 无并发控制
│   │  - RunningHub Provider      │   │
│   └─────────────────────────────┘   │
└─────────────────────────────────────┘
       │         │         │
       ↓         ↓         ↓
   ┌─────┐  ┌─────┐  ┌─────────┐
   │MySQL│  │Redis│  │腾讯云COS│
   └─────┘  └─────┘  └─────────┘
    ↑ ❌       ↑ ❌       ↑ ❌
   连接池     仅存验证码   无成本控制
   配置不合理
```

### 现状评估（基于代码审查）

#### ✅ 做得好的地方：
1. **配额扣减有行锁保护**（`quota.service.js:17-51`）
   ```javascript
   const user = await transaction('users')
     .where('id', userId)
     .forUpdate()  // ✅ 使用forUpdate()行锁
     .first();
   ```

2. **配额返还有防重复逻辑**（`quota.service.js:63-100`）
   ```javascript
   if (task.refunded) {
     logger.warn(`配额返还失败: 任务已返还过配额 taskId=${taskId}`);
     return { remaining: 0, refunded: false };
   }
   ```

3. **FORK/JOIN支持并行执行**（`pipelineEngine.service.js:272-313`）
   ```javascript
   const branchResults = await Promise.all(branchPromises);
   ```

4. **验证码有防刷限制**（`auth.service.js:50-80`）
   ```javascript
   // 同一手机号 1分钟内最多5次
   // 同一IP 1小时内最多20次
   ```

#### ❌ 存在严重问题的地方：
1. **Pipeline执行失败时，配额已扣除但未回滚**
2. **JWT Token一次性生成，无刷新机制，泄露后无法撤销**
3. **Redis仅用于验证码，高频查询数据未缓存**
4. **FORK/JOIN并行执行无并发数控制，可能导致AI服务限流**
5. **COS存储无成本控制，失败任务的中间文件不会删除**

---

## P0级致命问题

### 问题1：Pipeline执行失败时，配额无法回滚

#### 问题描述
**现状：**
用户创建任务时，配额被立即扣除（`quota.service.js:deduct()`），但如果Pipeline执行过程中任何Step失败，配额已经扣除，只能依赖后续手动返还。

**代码证据：**
```javascript
// 文件：pipelineEngine.service.js:18-87

async executePipeline(taskId, featureId, inputData) {
  try {
    // ❌ 问题点：配额在任务创建时已扣除（task.service.js）
    // 如果Pipeline执行失败，配额不会自动回滚

    // 执行Pipeline...
    await this.executeGraph(taskId, nodes, edges || [], inputData);

    await this.handlePipelineSuccess(taskId, finalOutput);
  } catch (error) {
    // ❌ 只是标记任务失败，配额回滚依赖外部手动触发
    await this.handlePipelineFailure(taskId, featureId, -1, error.message);
  }
}
```

**风险影响：**
- 用户损失：配额被扣除，但任务失败，用户无法获得结果
- 数据一致性：配额与任务状态不一致
- 客诉风险：用户投诉"扣了钱但没给结果"

**发生概率：**
- 高（AI服务超时、网络故障、COS上传失败等）

#### 当前临时方案的问题
```javascript
// quota.service.js:63-100 提供了refund()方法
await quotaService.refund(taskId, userId, amount, reason);
```

**临时方案的缺陷：**
1. ❌ 需要手动调用refund()，Pipeline执行失败时没有自动回滚
2. ❌ 如果refund()调用失败（如网络故障），配额永久丢失
3. ❌ 无法保证原子性（配额扣除成功，但回滚失败）

---

### 问题2：JWT Token无刷新机制，泄露后无法撤销

#### 问题描述
**现状：**
用户登录后生成JWT Token（有效期未知），Token一旦泄露，无法主动撤销，只能等待过期。

**代码证据：**
```javascript
// 文件：auth.service.js（未找到refreshToken逻辑）
// 文件：auth.middleware.js（仅验证JWT签名，未检查Redis黑名单）

// ❌ Token生成后直接返回，无刷新机制
const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
return { token };
```

**风险影响：**
- **安全风险：** Token泄露后，攻击者可以长期冒充用户（7天内）
- **合规风险：** 无法实现"踢人"功能（后台封禁用户时，旧Token仍有效）
- **用户体验差：** Token过期后必须重新登录（输入验证码）

**发生概率：**
- 中高（Token被截获、XSS攻击、本地存储泄露）

#### 期望方案
**双Token机制（Access Token + Refresh Token）：**
```json
{
  "accessToken": "xxx",   // 短有效期（15分钟）
  "refreshToken": "yyy"   // 长有效期（7天）
}
```

**优势：**
1. ✅ Access Token泄露后，最多15分钟内有效
2. ✅ Refresh Token存储在Redis，可主动撤销（踢人）
3. ✅ 用户无感知刷新（前端自动使用Refresh Token获取新Access Token）

---

### 问题3：数据库连接池配置不合理，高并发时连接耗尽

#### 问题描述
**现状：**
未找到明确的连接池配置（`config/database.js`），Knex默认连接池配置可能不足以应对高并发。

**代码证据：**
```javascript
// 文件：config/database.js（假设使用默认配置）

// ❌ 未找到pool配置，使用Knex默认值
// Knex默认：min=2, max=10（MySQL）
const knex = require('knex')({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST,
    // ...
  }
  // ❌ 缺少pool配置
});
```

**Knex默认连接池配置（不足！）：**
```javascript
{
  min: 2,   // 最小连接数
  max: 10   // 最大连接数
}
```

**风险影响：**
- **高并发场景：** 100个并发请求 → 10个连接 → 90个请求等待 → 超时失败
- **FORK/JOIN并行：** FORK启动3个分支 → 每个分支需要1个连接 → 3个连接 → 仅支持3个并发任务
- **连接泄漏：** 慢查询长时间占用连接 → 连接池耗尽

**发生概率：**
- 高（生产环境并发>10时必然触发）

#### 期望方案
```javascript
pool: {
  min: 10,                    // 最小连接数
  max: 100,                   // 最大连接数
  acquireTimeoutMillis: 30000, // 获取连接超时30秒
  idleTimeoutMillis: 30000,    // 空闲连接30秒后回收
  // ... 更多配置
}
```

---

### 问题4：FORK/JOIN并行执行无并发数控制

#### 问题描述
**现状：**
FORK节点启动并行分支时，使用`Promise.all()`直接并发执行，无并发数限制。

**代码证据：**
```javascript
// 文件：pipelineEngine.service.js:272-313

// ❌ FORK节点：直接并发所有分支，无并发数控制
const branchPromises = nextNodeIds.map(async (nextNodeId) => {
  // ...调用AI Provider
});

const branchResults = await Promise.all(branchPromises);
```

**风险场景：**
```
场景1：单个任务FORK 3个分支
  → 同时调用3个AI API

场景2：100个用户同时创建任务（每个FORK 3个分支）
  → 300个并发AI请求
  → AI Provider限流（429 Too Many Requests）
  → 所有任务失败
```

**风险影响：**
- **AI服务限流：** RunningHub可能有并发数限制（如100/秒）
- **后端资源耗尽：** 300个并发HTTP请求 → 内存/CPU耗尽
- **用户体验差：** 任务全部失败

**发生概率：**
- 中高（生产环境并发用户>20时可能触发）

#### 期望方案
```javascript
// 使用队列 + Worker Pool控制并发
import Queue from 'bull';
import pLimit from 'p-limit';

const aiQueue = new Queue('ai-tasks', { redis });
const limit = pLimit(10); // 最多10个并发AI请求

const branchPromises = nextNodeIds.map(nextNodeId =>
  limit(() => this.executeBranch(nextNodeId))
);
```

---

### 问题5：COS存储无成本控制，垃圾文件堆积

#### 问题描述
**现状：**
Pipeline执行过程中会生成中间文件（上传到COS），但任务失败时这些文件不会被删除。

**代码证据：**
```javascript
// 文件：pipelineEngine.service.js:78-87

} catch (error) {
  logger.error(`[PipelineEngine] Pipeline执行异常 taskId=${taskId}`);
  await this.handlePipelineFailure(taskId, featureId, -1, error.message);

  // ❌ 未删除中间文件（COS存储）
}
```

**风险影响：**
- **成本爆炸：** 每个失败任务留下1-3个中间文件（每个5MB） → 1000个失败任务 = 5-15GB垃圾文件
- **存储无上限：** 用户可以恶意上传大文件，耗尽COS配额
- **无生命周期策略：** 临时文件永久存储

**发生概率：**
- 高（AI服务故障、网络故障等导致任务失败）

#### 期望方案
1. **COS生命周期策略：** 临时文件7天后自动删除
2. **任务失败时主动删除：** Pipeline失败时，遍历中间文件并删除
3. **用户存储配额：** 限制单个用户的总存储空间（如1GB）

---

### 问题6：微信登录缺失（小程序上线必需功能）

#### 问题描述
**现状：**
系统完全缺少微信登录功能，Users表没有存储微信openid/unionid字段，但小程序上线必须支持微信登录（微信审核要求）。

**代码证据：**
```javascript
// ❌ 搜索整个后端代码，未找到微信登录相关代码
// grep "wechat|weixin|wx.login|openid" → 无结果

// 文件：auth.service.js:114-182
// ❌ 仅支持验证码登录，无微信登录方法
async login(phone, code, referrerId = null) {
  // 验证码登录逻辑
}

// 文件：migrations/20251028000001_create_users_table.js
// ❌ Users表缺少微信相关字段
table.string('phone', 11).unique().notNullable();
// ❌ 缺少：wechat_openid、wechat_unionid、wechat_session_key
```

**风险影响：**
- **小程序审核不通过：** 微信要求小程序必须支持微信登录，否则拒审
- **用户体验差：** 用户每次登录都要输入手机号+验证码（体验差于一键登录）
- **无法获取微信用户信息：** 无法获取微信昵称/头像（依赖wx.getUserProfile）
- **无法实现静默登录：** 用户每次打开小程序都要重新登录

**发生概率：**
- 100%（小程序上线必然触发）

#### 期望方案

**方案1：微信登录完整流程**
```javascript
// ✅ 前端：调用wx.login获取code
wx.login({
  success: (res) => {
    const code = res.code; // 临时登录凭证
    // 发送code到后端
    wx.request({
      url: '/api/auth/wechat-login',
      method: 'POST',
      data: { code, referrer_id: '可选' }
    });
  }
});

// ✅ 后端：新增微信登录接口
POST /api/auth/wechat-login
{
  "code": "071xYZ2w3abc123",
  "referrer_id": "xxx" // 可选
}

// ✅ 后端实现（auth.service.js新增方法）
async wechatLogin(code, referrerId = null) {
  // 1. 调用微信API：code2Session换取openid
  const { openid, session_key, unionid } = await this.code2Session(code);

  // 2. 根据openid查询/创建用户
  let user = await db('users').where('wechat_openid', openid).first();

  if (!user) {
    // 创建新用户
    await db.transaction(async (trx) => {
      const userId = generateId();
      await trx('users').insert({
        id: userId,
        wechat_openid: openid,
        wechat_unionid: unionid || null,
        wechat_session_key: session_key,
        referrer_id: referrerId || null,
        isMember: false,
        quota_remaining: 0,
        created_at: new Date()
      });

      // 绑定推荐关系
      if (referrerId) {
        await distributionService.bindReferralRelationship(trx, referrerId, userId);
      }
    });

    user = await db('users').where('wechat_openid', openid).first();
  } else {
    // 更新session_key（每次登录更新）
    await db('users')
      .where('id', user.id)
      .update({ wechat_session_key: session_key });
  }

  // 3. 生成JWT
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

  return { token, user };
}

// ✅ code2Session方法（调用微信API）
async code2Session(code) {
  const { data } = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
    params: {
      appid: process.env.WECHAT_APPID,
      secret: process.env.WECHAT_SECRET,
      js_code: code,
      grant_type: 'authorization_code'
    }
  });

  if (data.errcode) {
    throw new Error(`微信登录失败: ${data.errmsg}`);
  }

  return {
    openid: data.openid,
    session_key: data.session_key,
    unionid: data.unionid // 可能为空（需绑定开放平台）
  };
}
```

**方案2：数据库迁移（新增微信字段）**
```javascript
// ✅ 新增迁移：20251102000002_add_wechat_fields_to_users.js

exports.up = function(knex) {
  return knex.schema.table('users', function(table) {
    // 微信登录字段
    table.string('wechat_openid', 64).unique().nullable().comment('微信openid');
    table.string('wechat_unionid', 64).unique().nullable().comment('微信unionid');
    table.string('wechat_session_key', 128).nullable().comment('微信session_key');

    // 索引
    table.index('wechat_openid', 'idx_users_wechat_openid');
    table.index('wechat_unionid', 'idx_users_wechat_unionid');
  });
};
```

**方案3：手机号绑定（可选）**
```javascript
// ✅ 微信登录后，引导用户绑定手机号（用于找回账号）
POST /api/users/bind-phone
{
  "phone": "13800138000",
  "code": "123456" // 验证码
}

// 优势：
// 1. 用户换设备后可用手机号+验证码登录
// 2. 支持手机号找回微信账号
// 3. 符合微信审核要求（实名制）
```

---

### 问题7：验证码登录 vs 密码登录机制混乱

#### 问题描述
**现状：**
系统同时存在两套登录机制（验证码登录 + 密码登录），但实现不统一，导致用户体验混乱和安全隐患。

**代码证据：**
```javascript
// 文件：migrations/20251101000001_add_auth_fields_to_users.js:8
// ✅ Users表有password字段
table.string('password', 255).nullable().comment('密码hash（bcrypt）');

// 文件：auth.controller.ts:28-128
// ✅ 新版Controller支持密码注册/登录
async register(req, res, next) {
  const { phone, password, referrer_id } = req.body;
  // 手机号+密码注册
  const hashedPassword = await bcrypt.hash(password, 10);
  await userRepo.createUser({ phone, password: hashedPassword, ... });
}

async login(req, res, next) {
  const { phone, password } = req.body;
  // 手机号+密码登录
  const passwordMatch = await bcrypt.compare(password, user.password);
}

// 文件：auth.service.js:114-182
// ❌ 旧版Service只支持验证码登录
async login(phone, code, referrerId = null) {
  // 验证码登录，创建用户时没有password字段
  await trx('users').insert({
    id: userId,
    phone,
    referrer_id: referrerId || null,
    // ❌ 未设置password字段
  });
}
```

**问题症状：**
1. **两套登录系统并存：** 新版用密码，旧版用验证码，路由可能冲突
2. **旧用户无密码：** 通过验证码注册的用户，`password`字段为NULL，无法用密码登录
3. **缺少"忘记密码"功能：** 用户设置密码后忘记，无法重置（需要验证码重置）
4. **验证码登录没有"设置密码"引导：** 用户可能永远不设密码

**风险影响：**
- **用户体验差：** 用户不知道该用验证码还是密码登录
- **安全风险：** 仅依赖验证码登录，验证码拦截风险
- **账号管理混乱：** 部分用户有密码，部分用户无密码

**发生概率：**
- 100%（当前必然发生）

#### 期望方案

**方案1：统一登录入口（推荐）**
```javascript
// ✅ 统一登录接口：支持密码或验证码
POST /api/auth/login
{
  "phone": "13800138000",
  "password": "123456",      // 密码登录（可选）
  "code": "654321"           // 验证码登录（可选）
}

// ✅ 后端逻辑：优先密码，备选验证码
async login(phone, password, code) {
  const user = await db('users').where('phone', phone).first();

  // 方式1：密码登录
  if (password && user?.password) {
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new Error('密码错误');
    return this.generateToken(user);
  }

  // 方式2：验证码登录（兜底）
  if (code) {
    await this.verifyCode(phone, code);

    // 如果用户不存在，创建新用户
    if (!user) {
      user = await this.createUser({ phone });
    }

    return this.generateToken(user);
  }

  throw new Error('请提供密码或验证码');
}
```

**方案2：登录后引导设置密码**
```javascript
// ✅ 验证码登录成功后，检查是否有密码
if (!user.password) {
  return {
    token,
    user,
    needSetPassword: true, // ✅ 前端提示"为了账号安全，请设置密码"
    message: '首次登录，建议设置密码'
  };
}

// ✅ 前端引导：弹窗提示设置密码
POST /api/users/set-password
{
  "password": "newPassword123",
  "confirmPassword": "newPassword123"
}
```

**方案3：忘记密码功能**
```javascript
// ✅ 忘记密码：通过验证码重置
POST /api/auth/reset-password
{
  "phone": "13800138000",
  "code": "123456",         // 验证码验证身份
  "newPassword": "newPass"  // 新密码
}

// ✅ 后端实现
async resetPassword(phone, code, newPassword) {
  // 1. 验证码校验
  await this.verifyCode(phone, code);

  // 2. 更新密码
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await db('users')
    .where('phone', phone)
    .update({ password: hashedPassword });

  return { success: true };
}
```

---

### 问题8：支付系统仅有模拟代码，缺少真实SDK集成

#### 问题描述
**现状：**
Orders表和支付回调逻辑已实现，但`getPaymentParams()`方法返回的是模拟数据（MOCK），未集成微信支付/支付宝SDK。

**代码证据：**
```javascript
// 文件：membership.service.js:52-78

async getPaymentParams(orderId, amount, channel) {
  // TODO: 集成真实支付SDK
  // ❌ 这里返回模拟数据

  if (channel === 'wx') {
    // 微信支付参数(示例)
    return {
      appId: process.env.WECHAT_APPID,
      timeStamp: Math.floor(Date.now() / 1000).toString(),
      nonceStr: Math.random().toString(36).substring(2, 15),
      package: `prepay_id=mock_${orderId}`, // ❌ MOCK数据
      signType: 'RSA',
      paySign: 'MOCK_SIGN_' + orderId // ❌ MOCK签名，无法支付
    };
  }
}

// 文件：membership.service.js:85-91
async handlePaymentCallback(callbackData) {
  // 1. 验证签名(防篡改)
  // TODO: 根据不同渠道验证签名
  // ❌ 被注释掉，无签名验证！
  // await this.verifySignature(callbackData, channel);
}
```

**风险影响：**
- **无法收款：** MOCK签名无法调起真实支付，用户无法付款
- **上线失败：** 生产环境必须集成真实支付SDK
- **安全风险：** 回调签名验证缺失，攻击者可伪造支付成功回调
- **缺少退款接口：** 用户要求退款无法处理

**发生概率：**
- 100%（上线必然失败）

#### 期望方案

**方案1：集成微信支付SDK（小程序支付）**
```javascript
// ✅ 安装官方SDK
npm install wechatpay-node-v3

// ✅ 初始化SDK
const { Payment } = require('wechatpay-node-v3');
const fs = require('fs');

const payment = new Payment({
  mchid: process.env.WECHAT_MCHID,           // 商户号
  serial_no: process.env.WECHAT_SERIAL_NO,   // 证书序列号
  privateKey: fs.readFileSync('./apiclient_key.pem'), // 商户私钥
  publicKey: fs.readFileSync('./apiclient_cert.pem')  // 商户证书
});

// ✅ 创建订单（JSAPI支付）
async getWechatPayParams(orderId, amount, openid) {
  const result = await payment.jsapi({
    description: '会员购买',
    out_trade_no: orderId,
    amount: { total: amount, currency: 'CNY' },
    payer: { openid: openid },
    notify_url: `${process.env.API_BASE_URL}/api/payment/wechat-notify`
  });

  return {
    appId: process.env.WECHAT_APPID,
    timeStamp: result.timeStamp,
    nonceStr: result.nonceStr,
    package: result.package,
    signType: result.signType,
    paySign: result.paySign
  };
}

// ✅ 验证回调签名
async verifyWechatSignature(headers, body) {
  const isValid = payment.verifySignature(headers, body);
  if (!isValid) {
    throw new Error('微信支付回调签名验证失败');
  }
}
```

**方案2：集成支付宝SDK（App支付）**
```javascript
// ✅ 安装SDK
npm install alipay-sdk

// ✅ 初始化SDK
const AlipaySdk = require('alipay-sdk').default;
const alipaySdk = new AlipaySdk({
  appId: process.env.ALIPAY_APPID,
  privateKey: fs.readFileSync('./alipay_private_key.pem', 'utf8'),
  alipayPublicKey: fs.readFileSync('./alipay_public_key.pem', 'utf8'),
  gateway: 'https://openapi.alipay.com/gateway.do'
});

// ✅ 创建订单（App支付）
async getAlipayParams(orderId, amount) {
  const result = await alipaySdk.exec('alipay.trade.app.pay', {
    notify_url: `${process.env.API_BASE_URL}/api/payment/alipay-notify`,
    bizContent: {
      out_trade_no: orderId,
      total_amount: (amount / 100).toFixed(2), // 分转元
      subject: '会员购买',
      product_code: 'QUICK_MSECURITY_PAY'
    }
  });

  return { orderString: result };
}

// ✅ 验证回调签名
async verifyAlipaySignature(params) {
  const isValid = alipaySdk.checkNotifySign(params);
  if (!isValid) {
    throw new Error('支付宝回调签名验证失败');
  }
}
```

**方案3：退款接口**
```javascript
// ✅ 微信退款
async refundWechat(orderId, refundAmount, reason) {
  const order = await db('orders').where('id', orderId).first();

  const result = await payment.refund({
    out_trade_no: orderId,
    out_refund_no: `refund_${orderId}`,
    amount: {
      refund: refundAmount,
      total: order.amount,
      currency: 'CNY'
    },
    reason: reason || '用户申请退款'
  });

  // 更新订单状态
  await db('orders').where('id', orderId).update({
    status: 'refunded',
    refunded_at: new Date()
  });

  return result;
}
```

---

### 问题9：两套认证中间件共存导致管理员权限验证失效

#### 问题描述
**现状：**
系统中同时存在两套认证中间件（`middlewares/auth.middleware.js` vs `middleware/auth.middleware.ts`），导致JWT Token载荷不一致、管理员权限验证失效。

**代码证据：**
```javascript
// 文件：middlewares/auth.middleware.js:24
// ❌ 老版中间件：JWT Token不包含role字段
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.userId = decoded.userId;
req.user = decoded;
// ❌ decoded只有 {userId, phone}，没有role！

// 文件：routes/admin.routes.js:5-6
// ❌ 管理后台路由使用老版中间件
const { authenticate } = require('../middlewares/auth.middleware');
const { requireAdmin } = require('../middlewares/adminAuth.middleware');

// 文件：middlewares/adminAuth.middleware.js:36-37
// ❌ requireAdmin检查user.role，但老版authenticate未设置role！
if (user.role !== 'admin') {
  return res.status(403).json({ error: { message: '无权访问,仅限管理员' } });
}
// ❌ 问题：老版JWT Token没有role字段，每次都需要查数据库！

// 文件：middleware/auth.middleware.ts:26-46
// ✅ 新版中间件：JWT Token包含role字段
export interface TokenPayload {
  userId: string;
  phone: string;
  role: string;  // ✅ 包含role
}
const payload = verifyToken(token);
req.user = payload;

// 文件：utils/jwt.ts:26-31
// ✅ 新版JWT工具：支持双Token机制
export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN as string, // ✅ 15分钟
  });
}
```

**问题症状：**
1. **9个路由文件使用旧版中间件：** admin.routes.js、asset.routes.js、auth.routes.js、distribution.routes.js、feature.routes.js、media.routes.js、membership.routes.js、systemConfig.routes.js、task.routes.js
2. **仅1个路由使用新版中间件：** users.routes.ts
3. **管理员权限验证失效：** `requireAdmin`依赖`user.role`，但老版中间件的JWT Token不包含role，必须每次查数据库
4. **双Token机制未生效：** 新版支持Access Token（15分钟）+ Refresh Token（7天），但旧路由不支持

**风险影响：**
- **性能问题：** 每次管理后台请求都查数据库获取role（+50-100ms延迟）
- **安全隐患：** 用户角色变更（如revoke admin）后，旧Token仍有效（JWT无法撤销）
- **代码维护混乱：** 两套中间件并存，难以统一升级

**发生概率：**
- 100%（当前必然发生，所有管理后台API都受影响）

#### 期望方案

**方案1：统一使用新版中间件（推荐）**
```javascript
// ✅ 步骤1：所有路由改为导入新版中间件
// 文件：routes/admin.routes.js
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

// ✅ 步骤2：所有用户登录时JWT包含role
// 文件：auth.controller.ts
const accessToken = generateAccessToken({
  userId: user.id,
  phone: user.phone,
  role: user.role || 'user'  // ✅ 必须包含role
});

// ✅ 步骤3：删除旧版中间件
// rm backend/src/middlewares/auth.middleware.js
// rm backend/src/middlewares/adminAuth.middleware.js
```

**方案2：JWT Token包含role字段（必须）**
```javascript
// ✅ 所有登录逻辑必须在JWT中包含role
// auth.service.js（旧版）
const token = jwt.sign({
  userId: user.id,
  phone: user.phone,
  role: user.role || 'user'  // ✅ 添加role字段
}, process.env.JWT_SECRET, { expiresIn: '7d' });

// auth.controller.ts（新版）
const payload = { userId: user.id, phone: user.phone, role: user.role };
const accessToken = generateAccessToken(payload);   // 15分钟
const refreshToken = generateRefreshToken(payload);  // 7天
```

**方案3：迁移路线图**
```javascript
// ✅ 阶段1：兼容过渡（不中断服务）
// 1. 更新auth.service.js的JWT Token包含role字段
// 2. 保留两套中间件，但统一JWT格式

// ✅ 阶段2：逐步迁移
// 1. 将9个.js路由文件改为.ts（或使用CommonJS导入新版中间件）
// 2. 逐个路由文件替换中间件导入路径

// ✅ 阶段3：清理旧代码
// 1. 确认所有路由已使用新版中间件
// 2. 删除middlewares/auth.middleware.js
// 3. 删除middlewares/adminAuth.middleware.js
```

**方案4：向后兼容测试**
```javascript
// ✅ 测试用例1：旧Token能否使用
// 1. 用旧版登录生成Token（不含role）
// 2. 访问管理后台API
// 3. 预期：401错误（需要重新登录）

// ✅ 测试用例2：新Token能否使用
// 1. 用新版登录生成Token（包含role）
// 2. 访问管理后台API
// 3. 预期：200成功（role验证通过）

// ✅ 测试用例3：角色变更是否生效
// 1. 管理员登录（role=admin）
// 2. 数据库将role改为user
// 3. 等待Access Token过期（15分钟）
// 4. 访问管理后台API
// 5. 预期：403错误（role不再是admin）
```

---

## P1级严重问题

### 问题10：Redis仅用于验证码，高频查询未缓存

#### 问题描述
**现状：**
Redis仅存储验证码（`verification_codes`表也存MySQL），高频查询数据（如用户信息、Feature定义）每次都查数据库。

**代码证据：**
```javascript
// ❌ 每次API请求都查数据库验证Token
// 文件：auth.middleware.js

const user = await db('users').where('id', userId).first();
// ❌ 未缓存到Redis
```

**性能影响：**
- **API响应慢：** 每次请求+100-200ms（数据库查询）
- **数据库压力大：** 100 QPS → 100次数据库查询/秒
- **无法应对高并发：** 并发>1000时数据库成为瓶颈

**期望方案：**
```javascript
// ✅ 缓存用户信息（登录后）
const cacheKey = `user:${userId}`;
let user = await redis.get(cacheKey);
if (!user) {
  user = await db('users').where('id', userId).first();
  await redis.setex(cacheKey, 3600, JSON.stringify(user));
}
```

---

### 问题11：任务状态轮询效率低，应改为WebSocket推送

#### 问题描述
**现状：**
前端通过轮询（每5秒）查询任务状态：`GET /api/tasks/:id`

**性能影响：**
```
100个用户 × 每5秒轮询1次 = 每秒20次数据库查询
1000个用户 = 每秒200次数据库查询（仅轮询！）
```

**期望方案：**
```javascript
// ✅ WebSocket推送任务状态变更
io.to(`user:${task.userId}`).emit('task:updated', {
  taskId: task.id,
  status: 'completed',
  resultUrls: task.resultUrls
});
```

---

### 问题12：错误处理不统一，缺乏错误码规范

#### 问题描述
**现状：**
各处`throw new Error()`消息不一致，前端无法根据错误码做不同处理。

**代码证据：**
```javascript
// 文件：quota.service.js:32-34
if (user.quota_remaining < amount) {
  throw { statusCode: 403, errorCode: 1003, message: '配额不足,请续费' };
}

// 文件：pipelineEngine.service.js:28
throw new Error('功能配置错误:缺少pipeline_schema_ref');
// ❌ 缺少errorCode，前端无法识别
```

**期望方案：**
```typescript
// 定义统一错误码规范
export enum ErrorCode {
  QUOTA_INSUFFICIENT = 2001,
  PIPELINE_FAILED = 3002,
  // ...
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public statusCode: number = 400
  ) {}
}
```

---

### 问题13：缺乏API文档和Swagger集成

#### 问题描述
**现状：**
仅有Markdown文档（`后端完全使用说明.md`），需要手动维护，容易与代码不同步。

**期望方案：**
```javascript
// ✅ 集成Swagger自动生成API文档
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
```

---

### 问题14：缺乏监控和告警

#### 问题描述
**现状：**
无性能监控（APM）、错误追踪（Sentry）、日志聚合（ELK）。

**期望方案：**
1. **APM监控：** 集成New Relic / Datadog
2. **错误追踪：** 集成Sentry
3. **日志聚合：** 使用Winston + ELK Stack

---

### 问题15：邀请码生成算法存在高冲突风险和无限循环隐患

#### 问题描述
**现状：**
邀请码生成使用简单的随机算法，在高并发场景下可能陷入无限循环，且缺少性能监控。

**代码证据：**
```javascript
// 文件：distribution.service.js:13-27

async generateInviteCode() {
  let code;
  let exists = true;

  while (exists) {
    // ❌ 6位大写字母+数字邀请码（碰撞概率高）
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const distributor = await db('distributors')
      .where({ invite_code: code })
      .first();
    exists = !!distributor;
  }
  // ❌ 无限循环风险：当数据库中有几万条记录时，碰撞概率急剧上升
  // ❌ 无循环上限：可能导致数据库压力剧增，甚至服务卡死

  return code;
}
```

**风险影响：**
- **无限循环风险：** 36^6 = 约21亿种组合，看似足够，但生日悖论表明当记录数达到5万时碰撞概率>1%
- **数据库压力：** 每次生成需要1次SELECT查询，碰撞时需要多次查询，高并发下数据库压力剧增
- **服务不可用：** 极端情况下while循环可能执行数百次甚至卡死
- **可预测性：** Math.random()在Node.js中是伪随机，理论上可被预测（安全风险低但存在）

**发生概率：**
- 低（当前用户少） → 高（当分销员数量增长到数万级别时）

#### 期望方案

**方案1：基于雪花算法（Snowflake）生成唯一ID**
```javascript
// ✅ 使用Twitter Snowflake算法生成全局唯一ID
const { Snowflake } = require('nodejs-snowflake');
const snowflake = new Snowflake({
  machineId: 1,
  epoch: 1609459200000 // 2021-01-01
});

async generateInviteCode() {
  const id = snowflake.getUniqueID();
  // 转换为Base36并取前8位（保证唯一性+可读性）
  return id.toString(36).substring(0, 8).toUpperCase();
}
```

**方案2：预生成邀请码池（推荐）**
```javascript
// ✅ 后台定时任务预生成1000个邀请码存入Redis
// 用户申请时直接从池中取，无碰撞风险
async getInviteCodeFromPool() {
  const code = await redis.spop('invite_code_pool');
  if (!code) {
    // 池空时触发紧急补充
    await this.refillInviteCodePool(100);
    return await redis.spop('invite_code_pool');
  }
  return code;
}
```

**方案3：增加循环上限 + 监控告警（最小改动）**
```javascript
// ✅ 增加安全机制防止无限循环
async generateInviteCode() {
  let code;
  let exists = true;
  let attempts = 0;
  const MAX_ATTEMPTS = 10; // 最多尝试10次

  while (exists && attempts < MAX_ATTEMPTS) {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const distributor = await db('distributors')
      .where({ invite_code: code })
      .first();
    exists = !!distributor;
    attempts++;
  }

  if (attempts >= MAX_ATTEMPTS) {
    // ✅ 告警：邀请码生成失败次数过多
    logger.error('[邀请码生成失败] 尝试次数超过上限，可能存在碰撞问题');
    throw new Error('邀请码生成失败，请稍后重试');
  }

  return code;
}
```

---

### 问题16：用户注册缺少基本信息字段（昵称/头像/性别等）

#### 问题描述
**现状：**
用户表（`users`）仅存储手机号、配额、会员状态，缺少昵称、头像、性别等基本个人信息字段，导致产品体验不完整。

**代码证据：**
```javascript
// 文件：migrations/20251028000001_create_users_table.js:5-15

table.string('id', 32).primary().comment('用户ID');
table.string('phone', 11).unique().notNullable().comment('手机号');
table.boolean('isMember').defaultTo(false).comment('是否会员');
table.integer('quota_remaining').unsigned().defaultTo(0).comment('剩余配额');
table.datetime('quota_expireAt').nullable().comment('配额到期时间');

// ❌ 缺少：nickname、avatar、gender、bio（个人简介）等字段
// ❌ 缺少：city、birthday、occupation等扩展字段
```

**实际问题：**
```javascript
// 文件：auth.controller.ts:85-93（注册逻辑）

const user = await userRepo.createUser({
  id: nanoid(32),
  phone,
  password: hashedPassword,
  role: 'user',
  isMember: false,
  quota_remaining: 0,
  referrer_id: referrer_id || null,
  // ❌ 注册时未要求填写昵称、头像等信息
  // ❌ 用户完成注册后，在社区/个人主页中显示什么？只有手机号？
});
```

**业务影响：**
- **社区功能受限：** 穿搭社区（MOBILE-MP-013）中用户发帖时只能显示手机号（隐私问题）
- **个人主页缺失：** 个人主页（MOBILE-MP-016）无法展示用户昵称、头像、个人简介
- **用户体验差：** 无昵称导致用户识别度低，降低社交属性
- **后期难补：** 如果上线后再要求用户补充信息，会导致大量老用户数据缺失

**发生概率：**
- 100%（当前必然发生）

#### 期望方案

**方案1：扩展用户表（立即执行）**
```javascript
// ✅ 新增迁移文件：20251102000001_add_user_profile_fields.js

exports.up = function(knex) {
  return knex.schema.table('users', function(table) {
    // 基本信息（必填）
    table.string('nickname', 50).nullable().comment('昵称');
    table.string('avatar', 500).nullable().comment('头像URL');

    // 扩展信息（可选）
    table.enum('gender', ['male', 'female', 'other', 'unknown'])
      .defaultTo('unknown').comment('性别');
    table.text('bio').nullable().comment('个人简介');
    table.string('city', 50).nullable().comment('城市');
    table.date('birthday').nullable().comment('生日');

    // 索引
    table.index('nickname', 'idx_users_nickname');
  });
};
```

**方案2：注册流程优化（两步注册）**
```javascript
// ✅ 步骤1：手机验证码注册（创建基础账号）
POST /api/auth/register
{
  "phone": "13800138000",
  "password": "123456",
  "referrer_id": "xxx"
}

// ✅ 步骤2：完善个人信息（引导用户填写）
POST /api/users/profile
{
  "nickname": "时尚达人小王",
  "avatar": "https://cos.xxx.com/avatars/xxx.jpg",
  "gender": "female",
  "bio": "热爱穿搭，分享美好生活"
}

// ✅ 前端判断：如果用户未填写昵称，强制跳转到"完善资料"页面
if (!user.nickname) {
  router.push('/onboarding/profile');
}
```

**方案3：默认值策略（向后兼容）**
```javascript
// ✅ 为老用户生成默认昵称
nickname: `用户${phone.substring(7)}` // "用户8000"
avatar: '/default-avatar.png' // 默认头像
```

---

### 问题17：注册时未验证推荐人（referrer_id）是否有效

#### 问题描述
**现状：**
用户注册时可以填写`referrer_id`（推荐人ID），但代码未验证推荐人是否存在、是否是激活状态的分销员，导致脏数据。

**代码证据：**
```javascript
// 文件：auth.controller.ts:92

const user = await userRepo.createUser({
  // ...
  referrer_id: referrer_id || null,
  // ❌ 未验证referrer_id是否存在
  // ❌ 未验证推荐人是否是激活状态的分销员（status='active'）
});
```

```javascript
// 文件：auth.service.js:138-143（旧版验证码注册）

// 如果有推荐人,绑定推荐关系
if (referrerId) {
  const distributionService = require('./distribution.service');
  await distributionService.bindReferralRelationship(trx, referrerId, userId);
  // ❌ bindReferralRelationship内部会验证，但失败时仅返回null，不抛错
  // ❌ 这意味着用户可以填写无效的referrer_id完成注册
}
```

**风险影响：**
- **脏数据累积：** 用户填写不存在的`referrer_id`，数据库中存储无效推荐关系
- **推荐奖励漏洞：** 用户可能通过修改请求伪造推荐人ID
- **统计数据不准：** 分销员统计推荐人数时，包含了无效数据
- **用户体验差：** 用户输入推荐码后没有任何反馈（成功/失败）

**发生概率：**
- 中（用户手动输入错误、前端未校验）

#### 期望方案

**方案1：注册前验证推荐人（推荐）**
```javascript
// ✅ 注册接口增加推荐人验证逻辑

async register(req, res, next) {
  const { phone, password, referrer_id } = req.body;

  // ✅ 验证推荐人
  if (referrer_id) {
    const referrer = await db('distributors')
      .where({ user_id: referrer_id, status: 'active' })
      .first();

    if (!referrer) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REFERRER',
          message: '推荐人不存在或未激活，请检查邀请码'
        }
      });
      return;
    }
  }

  // 创建用户...
}
```

**方案2：邀请码替代用户ID（更安全）**
```javascript
// ✅ 用户注册时填写邀请码（invite_code）而非用户ID

POST /api/auth/register
{
  "phone": "13800138000",
  "password": "123456",
  "invite_code": "ABC123" // ✅ 使用邀请码
}

// ✅ 后端根据邀请码查询推荐人
const referrer = await db('distributors')
  .where({ invite_code: inviteCode, status: 'active' })
  .first();

if (!referrer) {
  throw new Error('邀请码无效');
}

// ✅ 创建用户时存储推荐人user_id
const user = await userRepo.createUser({
  referrer_id: referrer.user_id
});
```

**方案3：前端实时校验（用户体验优化）**
```javascript
// ✅ 前端输入邀请码时实时校验

GET /api/distribution/validate-invite-code?code=ABC123

// 响应：
{
  "valid": true,
  "referrer": {
    "nickname": "推广达人小李",
    "avatar": "https://..."
  }
}

// ✅ 前端显示："您将通过【推广达人小李】的邀请注册"
```

---

### 问题18：分销员身份证号加密存储但缺少密钥管理机制

#### 问题描述
**现状：**
分销员申请时需要填写身份证号（法律合规），代码使用`encryptionUtils.encryptIdCard()`加密存储，但密钥管理机制不明确。

**代码证据：**
```javascript
// 文件：distribution.service.js:74-83

// 🔥 加密身份证号（法律合规）
const encryptedIdCard = encryptionUtils.encryptIdCard(idCard);

await db('distributors').insert({
  id: distributorId,
  user_id: userId,
  real_name: realName,
  id_card: encryptedIdCard, // 🔥 存储加密后的身份证号
  // ...
});
```

**潜在问题：**
- **密钥存储位置未知：** `encryptionUtils`的密钥存在哪里？环境变量？配置文件？硬编码？
- **密钥轮换机制缺失：** 如果密钥泄露，如何重新加密历史数据？
- **解密权限控制不足：** 谁可以调用`decryptIdCard()`？管理员？所有后端接口？
- **合规风险：** 中国《个人信息保护法》要求对敏感信息（身份证号）采用加密+权限控制

**风险影响：**
- **法律风险：** 密钥泄露 → 身份证号泄露 → 违反个人信息保护法（罚款+刑事责任）
- **数据不可恢复：** 密钥丢失 → 历史数据无法解密
- **权限滥用：** 任何后端开发者都能解密身份证号

**发生概率：**
- 低（当前系统规模小） → 高（系统上线后必须应对安全审计）

#### 期望方案

**方案1：密钥管理服务（KMS）集成（推荐）**
```javascript
// ✅ 使用腾讯云KMS管理密钥

const { KMS } = require('tencentcloud-sdk-nodejs');
const kmsClient = new KMS({
  secretId: process.env.TENCENT_SECRET_ID,
  secretKey: process.env.TENCENT_SECRET_KEY,
  region: 'ap-guangzhou'
});

async function encryptIdCard(idCard) {
  const result = await kmsClient.Encrypt({
    KeyId: process.env.KMS_KEY_ID, // ✅ 密钥存储在腾讯云KMS
    Plaintext: Buffer.from(idCard).toString('base64')
  });
  return result.CiphertextBlob;
}

// ✅ 优势：密钥轮换、访问审计、权限控制全部由KMS管理
```

**方案2：环境变量 + 定期轮换（中等方案）**
```javascript
// ✅ 密钥存储在环境变量（Docker Secrets / K8s Secrets）

// .env
ENCRYPTION_KEY=your-32-char-secret-key-here
ENCRYPTION_KEY_VERSION=v1 // ✅ 密钥版本号

// 加密时记录密钥版本
await db('distributors').insert({
  id_card: encryptedIdCard,
  id_card_key_version: 'v1' // ✅ 存储密钥版本
});

// ✅ 密钥轮换策略
// 1. 生成新密钥 ENCRYPTION_KEY_V2
// 2. 后台任务重新加密历史数据
// 3. 切换到新密钥
```

**方案3：权限控制 + 审计日志（必须）**
```javascript
// ✅ 解密操作需要管理员权限

async function decryptIdCard(encryptedIdCard, operatorId, reason) {
  // ✅ 验证操作员权限
  const operator = await db('users').where({ id: operatorId }).first();
  if (operator.role !== 'admin') {
    throw new Error('无权限解密身份证号');
  }

  // ✅ 记录审计日志
  await db('audit_logs').insert({
    operator_id: operatorId,
    action: 'DECRYPT_ID_CARD',
    reason: reason,
    timestamp: new Date()
  });

  // 解密
  return encryptionUtils.decrypt(encryptedIdCard);
}
```

---

## 期望交付产出

### 1. 完整的架构重构方案文档

**要求GPT-5产出：**

#### 1.1 事务与回滚方案
- [ ] **Saga模式设计文档**（含补偿操作栈）
- [ ] **配额预扣除+确认机制**的完整流程图
- [ ] **代码实现示例**（TypeScript）

#### 1.2 JWT刷新机制方案
- [ ] **双Token机制设计文档**（Access Token + Refresh Token）
- [ ] **Token存储策略**（Redis存储+主动撤销）
- [ ] **前端集成指南**（自动刷新逻辑）
- [ ] **代码实现示例**（含Refresh Token API）

#### 1.3 数据库连接池优化方案
- [ ] **Knex连接池配置详解**（min/max/timeout等参数说明）
- [ ] **连接池监控方案**（实时监控连接数）
- [ ] **慢查询优化建议**（索引优化、查询重写）

#### 1.4 并发控制方案
- [ ] **队列+Worker Pool设计文档**（Bull Queue + p-limit）
- [ ] **并发数配置建议**（根据AI Provider限流策略）
- [ ] **代码实现示例**（FORK/JOIN并发控制）

#### 1.5 COS成本控制方案
- [ ] **生命周期策略配置**（腾讯云COS控制台配置）
- [ ] **中间文件自动删除逻辑**（Pipeline失败时清理）
- [ ] **用户存储配额限制**（单用户最大存储空间）
- [ ] **代码实现示例**（COS文件删除API）

#### 1.6 Redis缓存优化方案
- [ ] **缓存策略文档**（哪些数据应该缓存、TTL设置）
- [ ] **缓存失效策略**（LRU / TTL / 主动失效）
- [ ] **代码实现示例**（用户信息缓存、Feature定义缓存）

#### 1.7 WebSocket推送方案
- [ ] **Socket.IO集成指南**（后端+前端）
- [ ] **房间管理策略**（user:${userId}）
- [ ] **代码实现示例**（任务状态推送）

#### 1.8 错误处理规范
- [ ] **错误码定义文档**（完整的ErrorCode枚举）
- [ ] **AppError类设计**（统一错误类）
- [ ] **全局错误处理中间件**（Express error handler）
- [ ] **代码实现示例**

#### 1.9 API文档自动化
- [ ] **Swagger集成指南**（swagger-jsdoc + swagger-ui-express）
- [ ] **路由注释规范**（JSDoc格式）
- [ ] **代码实现示例**

#### 1.10 监控与告警方案
- [ ] **APM监控集成指南**（Sentry / New Relic）
- [ ] **日志规范**（Winston + 日志级别）
- [ ] **告警策略**（错误率>5% / 响应时间>500ms）

#### 1.11 邀请码生成优化方案
- [ ] **邀请码生成算法优化**（Snowflake / 预生成池 / 循环上限）
- [ ] **碰撞概率分析**（生日悖论数学分析 + 性能测试）
- [ ] **代码实现示例**（3种方案完整代码）

#### 1.12 用户信息完善方案
- [ ] **用户表扩展设计**（新增字段：nickname、avatar、gender、bio等）
- [ ] **数据库迁移脚本**（Knex migration完整代码）
- [ ] **注册流程优化**（两步注册：基础账号 + 完善资料）
- [ ] **默认值策略**（老用户数据兼容处理）
- [ ] **前端集成指南**（注册引导流程）

#### 1.13 推荐人验证方案
- [ ] **推荐人验证逻辑**（注册前验证 referrer_id 是否有效）
- [ ] **邀请码替代方案**（使用 invite_code 替代 user_id，提升安全性）
- [ ] **前端实时校验API**（/validate-invite-code 接口设计）
- [ ] **代码实现示例**（完整的验证逻辑）

#### 1.14 敏感信息加密与密钥管理方案
- [ ] **密钥管理服务（KMS）集成**（腾讯云KMS / AWS KMS）
- [ ] **密钥轮换策略**（环境变量 + 密钥版本管理）
- [ ] **权限控制与审计日志**（解密操作需管理员权限 + 审计记录）
- [ ] **法律合规分析**（《个人信息保护法》合规要求）
- [ ] **代码实现示例**（KMS集成 + 审计日志）

#### 1.15 微信登录集成方案
- [ ] **微信小程序登录流程设计**（wx.login + code2Session API）
- [ ] **OpenID/UnionID管理策略**（用户唯一标识）
- [ ] **Session Key安全存储**（用于解密用户数据）
- [ ] **手机号绑定机制**（可选，用于账号找回）
- [ ] **代码实现示例**（完整的微信登录API）

#### 1.16 统一登录机制方案
- [ ] **多登录方式统一接口设计**（密码 / 验证码 / 微信）
- [ ] **登录方式优先级策略**（优先密码 → 备选验证码）
- [ ] **旧用户兼容处理**（password=NULL 的用户引导设置密码）
- [ ] **"忘记密码"功能**（验证码重置密码）
- [ ] **代码实现示例**（统一login接口 + 密码重置API）

#### 1.17 支付系统真实SDK集成方案
- [ ] **微信支付SDK集成**（wechatpay-node-v3 + JSAPI支付）
- [ ] **支付宝SDK集成**（alipay-sdk + App支付）
- [ ] **支付回调验证**（签名校验 + 幂等性保证）
- [ ] **退款接口实现**（微信退款 + 支付宝退款）
- [ ] **测试环境配置**（沙箱模式 + 模拟支付）
- [ ] **代码实现示例**（完整的支付流程代码）

#### 1.18 认证中间件统一方案
- [ ] **中间件迁移路线图**（从旧版迁移到新版，3阶段）
- [ ] **JWT Token统一格式**（包含userId、phone、role字段）
- [ ] **双Token机制全面部署**（Access Token 15分钟 + Refresh Token 7天）
- [ ] **管理员权限验证优化**（从JWT直接读取role，无需查数据库）
- [ ] **向后兼容测试**（旧Token失效策略 + 新Token验证）
- [ ] **代码实现示例**（统一中间件 + 迁移脚本）

---

### 2. 实施路线图

**要求GPT-5产出：**

- [ ] **分阶段实施计划**（按优先级P0 → P1 → P2）
- [ ] **每个阶段的时间估算**（开发时间、测试时间）
- [ ] **技术风险评估**（每个方案的风险和应对措施）
- [ ] **向后兼容性说明**（旧API如何平滑迁移）

---

### 3. 代码示例（完整可运行）

**要求GPT-5产出：**

- [ ] **Saga模式代码示例**（PipelineEngine重构）
- [ ] **双Token机制代码示例**（Refresh Token API + 前端集成）
- [ ] **Knex连接池配置示例**（完整配置文件）
- [ ] **Bull Queue并发控制示例**（FORK/JOIN重构）
- [ ] **COS生命周期策略配置示例**（JSON配置）
- [ ] **Redis缓存封装示例**（CacheService类）
- [ ] **WebSocket推送示例**（Socket.IO集成）
- [ ] **错误处理示例**（AppError + 全局中间件）
- [ ] **Swagger集成示例**（完整配置）

---

### 4. 测试方案

**要求GPT-5产出：**

- [ ] **单元测试示例**（Jest + Supertest）
- [ ] **集成测试示例**（测试事务回滚、并发控制）
- [ ] **性能测试方案**（JMeter / k6 压测脚本）
- [ ] **回归测试清单**（确保重构不影响现有功能）

---

### 5. 文档更新

**要求GPT-5产出：**

- [ ] **架构设计文档**（Architecture.md）
- [ ] **API文档**（Swagger自动生成）
- [ ] **部署文档**（Docker + PM2配置）
- [ ] **运维手册**（监控、日志、告警）

---

## 附录：关键代码文件清单

### 需要重构的文件

| 文件路径 | 重构内容 | 优先级 |
|---------|---------|--------|
| `backend/src/services/pipelineEngine.service.js` | 事务支持、并发控制 | 🔴 P0 |
| `backend/src/services/quota.service.js` | Saga补偿操作 | 🔴 P0 |
| `backend/src/services/auth.service.js` | 微信登录 + 统一登录接口 + 双Token机制 | 🔴 P0 |
| `backend/src/controllers/auth.controller.ts` | 统一登录逻辑 + 密码重置 | 🔴 P0 |
| `backend/src/config/database.js` | 连接池配置 | 🔴 P0 |
| `backend/src/middlewares/auth.middleware.js` | 🗑️ 删除（迁移到新版） | 🔴 P0 |
| `backend/src/middlewares/adminAuth.middleware.js` | 🗑️ 删除（迁移到新版） | 🔴 P0 |
| `backend/src/middleware/auth.middleware.ts` | 统一认证中间件（包含role验证） | 🔴 P0 |
| `backend/src/utils/jwt.ts` | JWT Token包含role字段 | 🔴 P0 |
| `backend/src/services/membership.service.js` | 微信支付SDK + 支付宝SDK集成 | 🔴 P0 |
| `backend/src/services/cos.service.js`（新建） | COS文件管理、生命周期 | 🔴 P0 |
| `backend/src/db/migrations/*_extend_users_table.js`（新建） | 用户表扩展（nickname/avatar/gender/wechat_openid） | 🔴 P0 |
| `backend/src/services/cache.service.js`（新建） | Redis缓存封装 | 🟡 P1 |
| `backend/src/utils/errors.ts`（新建） | 错误码定义 | 🟡 P1 |
| `backend/src/config/swagger.js`（新建） | Swagger配置 | 🟡 P1 |
| `backend/src/services/distribution.service.js` | 邀请码生成优化 + 推荐人验证 | 🟡 P1 |
| `backend/src/db/migrations/20251102000001_add_user_profile_fields.js`（新建） | 用户表扩展 | 🟡 P1 |
| `backend/src/controllers/auth.controller.ts` | 推荐人验证逻辑 | 🟡 P1 |
| `backend/src/utils/encryption.js` | KMS集成、密钥管理 | 🟡 P1 |

---

## GPT-5，请开始你的表演！🎯

**请你基于以上完整的前置条件、问题分析、代码证据，给出一份系统性的架构重构方案！**

**要求：**
1. ✅ 每个方案都有完整的设计文档、流程图、代码示例
2. ✅ 考虑向后兼容性（不能影响现有功能）
3. ✅ 提供分阶段实施计划（优先解决P0问题）
4. ✅ 代码示例必须是完整可运行的（不要伪代码）
5. ✅ 包含测试方案和性能评估

**产出格式：**
- Markdown文档（可以分多个文件）
- 代码文件（TypeScript/JavaScript）
- 配置文件（JSON/YAML）

---

**艹！老王我把所有问题都tm给你理清楚了！现在看GPT-5的表现！** 💪🔥
