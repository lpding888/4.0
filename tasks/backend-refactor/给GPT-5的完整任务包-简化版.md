# 后端架构重构完整任务包（18个任务）

> **使用说明**: 将下面每个任务的"AI提示词"部分复制给GPT-5，GPT-5会自动完成任务
> **任务总数**: 18个（9个P0 + 9个P1）
> **预估总工时**: 约140-160小时

---

## P0-001: Saga模式配额管理

**优先级**: P0（最高）
**预估工时**: 10小时
**依赖**: 无

**任务描述**:
使用Saga模式重构配额管理系统，实现Reserve → Confirm | Cancel三阶段事务补偿机制。

**交付物**:
1. `backend/src/db/migrations/20250102000001_create_quota_transactions.ts` - 数据库迁移
2. `backend/src/services/quota.service.ts` - QuotaService重构版
3. `backend/src/services/task.service.ts` - 集成Saga模式
4. `backend/src/services/pipelineEngine.service.ts` - 集成cancel触发
5. `backend/tests/services/quota.service.spec.ts` - 完整测试

**AI提示词**（复制给GPT-5）:

```
你是Backend Dev，精通Node.js + TypeScript + Knex.js + MySQL，擅长Saga模式实现。

任务：实现Saga模式配额管理，解决Pipeline执行失败时配额无法回滚的问题。

具体要求：

1. 创建quota_transactions表：
   - id: VARCHAR(32) PRIMARY KEY
   - task_id: VARCHAR(32) UNIQUE NOT NULL
   - user_id: VARCHAR(32) NOT NULL
   - amount: INT NOT NULL
   - phase: ENUM('reserved', 'confirmed', 'cancelled')
   - idempotent_done: BOOLEAN DEFAULT TRUE
   - created_at/updated_at: TIMESTAMP

2. 实现QuotaService三个方法：
   - reserve(userId, taskId, amount): 预留配额，使用forUpdate锁定用户行
   - confirm(taskId): 确认扣减，幂等性检查
   - cancel(taskId): 退还配额，幂等性检查

3. 集成到TaskService：创建任务时调用reserve()
4. 集成到PipelineEngine：成功调用confirm()，失败调用cancel()
5. 单元测试覆盖率 ≥ 85%

参考GPT-5后端解决方案中的完整代码实现。
```

---

## P0-002: 双Token JWT系统

**优先级**: P0
**预估工时**: 8小时
**依赖**: 无

**任务描述**:
实现双Token JWT认证：Access Token(15分钟) + Refresh Token(7天)，支持Refresh Token Rotation。

**交付物**:
1. `backend/src/utils/jwt.ts` - Token生成工具
2. `backend/src/controllers/auth.controller.ts` - 新增refresh和logout接口
3. `backend/src/routes/auth.routes.ts` - 新增路由
4. `backend/tests/utils/jwt.spec.ts` - JWT测试
5. `backend/tests/controllers/auth.controller.spec.ts` - 接口测试

**AI提示词**（复制给GPT-5）:

```
你是Backend Dev，精通JWT认证和Token安全最佳实践。

任务：实现双Token JWT系统，解决JWT无刷新机制和无法撤销的问题。

具体要求：

1. TokenPayload接口：包含userId、phone、role三个字段
2. signAccess()：生成15分钟有效期的Access Token
3. signRefresh()：生成7天有效期的Refresh Token，包含唯一jti
4. Refresh Token的jti存储在Redis（key: refresh:{userId}）
5. 实现/auth/refresh接口，支持Refresh Token Rotation
6. 实现/auth/logout接口，删除Redis中的jti实现登出
7. 修改登录接口返回双Token
8. 单元测试覆盖率 ≥ 80%

参考GPT-5后端解决方案中的完整代码实现。
```

---

## P0-003: Knex连接池优化

**优先级**: P0
**预估工时**: 4小时
**依赖**: 无

**任务描述**:
优化Knex连接池配置（min=10, max=100），添加健康检查和监控。

**交付物**:
1. `backend/knexfile.ts` - 更新pool配置
2. `backend/src/db/index.ts` - 添加监控
3. `backend/tests/db/connection-pool.spec.ts` - 连接池测试
4. `docs/database-connection-pool-config.md` - 配置说明

**AI提示词**（复制给GPT-5）:

```
你是Backend Dev，精通MySQL连接池优化。

任务：优化Knex连接池配置，解决连接池耗尽和僵尸连接问题。

具体要求：

1. 修改knexfile.ts的pool配置：
   - min: 10（避免冷启动）
   - max: 100（支持高并发）
   - idleTimeoutMillis: 30000（30秒空闲回收）
   - acquireConnectionTimeout: 10000（10秒获取超时）
   - afterCreate: 健康检查（SELECT 1）

2. 添加连接池监控：每30秒输出pool.used/free/pending指标
3. 添加错误处理：连接失败记录详细日志
4. 连接池测试：100并发请求不耗尽
5. 编写配置说明文档

参考GPT-5后端解决方案中的完整代码实现。
```

---

## P0-004: Pipeline Engine并发控制

**优先级**: P0
**预估工时**: 6小时
**依赖**: P0-001

**AI提示词**（复制给GPT-5）:

```
你是Backend Dev，精通并发控制和异步编程。

任务：为Pipeline Engine添加并发控制，防止FORK/JOIN触发AI服务限流。

具体要求：

1. 安装p-limit依赖：npm install p-limit
2. 修改pipelineEngine.service.ts：
   - 创建limit = pLimit(5)（最多5个并发）
   - FORK/JOIN执行时使用limit包裹每个子任务
   - 保持Promise.allSettled错误处理
3. 配置化：MAX_CONCURRENCY从环境变量读取
4. 单元测试：验证并发数不超过5
5. 集成测试：10个子任务并发执行，不触发限流

参考GPT-5后端解决方案中的完整代码实现。
```

---

## P0-005: COS成本控制

**优先级**: P0
**预估工时**: 6小时
**依赖**: 无

**AI提示词**（复制给GPT-5）:

```
你是Backend Dev，精通腾讯云COS和成本优化。

任务：实现COS成本控制，防止存储成本失控。

具体要求：

1. 配置COS生命周期策略：自动删除30天前的文件
2. 实现COSService.batchDelete()：批量删除文件
3. 实现cleanupOrphanedFiles()：清理孤儿文件（失败任务的临时文件）
4. 定时任务：每天凌晨3点清理孤儿文件
5. 监控：记录每天删除的文件数量和节省的成本
6. 单元测试覆盖率 ≥ 70%

参考GPT-5后端解决方案中的完整代码实现。
```

---

## P0-006: 微信登录集成

**优先级**: P0
**预估工时**: 8小时
**依赖**: P0-002

**AI提示词**（复制给GPT-5）:

```
你是Backend Dev，精通微信小程序登录流程。

任务：集成微信登录，支持code2Session获取openid和自动注册。

具体要求：

1. 实现/auth/wechat-login接口：
   - 接收前端传递的code
   - 调用微信API code2Session获取openid和unionid
   - 查找或创建用户（首次登录自动注册）
   - 返回双Token（Access + Refresh）
2. users表新增字段：wechat_openid, wechat_unionid
3. 数据库迁移脚本
4. 错误处理：微信API调用失败的处理
5. 单元测试覆盖率 ≥ 80%

参考GPT-5后端解决方案中的完整代码实现。
```

---

## P0-007: 密码登录重构

**优先级**: P0
**预估工时**: 6小时
**依赖**: P0-002

**AI提示词**（复制给GPT-5）:

```
你是Backend Dev，精通用户认证和密码安全。

任务：重构密码登录，统一验证码登录和密码登录逻辑。

具体要求：

1. /auth/login接口支持两种登录方式：
   - 验证码登录：phone + code
   - 密码登录：phone + password
2. /auth/register接口：phone + password + referrer_id（可选）
3. 密码使用bcrypt加密（盐轮数 ≥ 10）
4. users表新增字段：password（可为NULL）
5. 验证逻辑：优先密码，无密码则验证码
6. 数据库迁移脚本
7. 单元测试覆盖率 ≥ 80%

参考GPT-5后端解决方案中的完整代码实现。
```

---

## P0-008: 真实支付SDK集成

**优先级**: P0
**预估工时**: 12小时
**依赖**: 无

**AI提示词**（复制给GPT-5）:

```
你是Backend Dev，精通微信支付和支付宝支付集成。

任务：集成真实支付SDK，替换MOCK代码。

具体要求：

1. 安装依赖：
   - wechatpay-node-v3（微信支付）
   - alipay-sdk（支付宝支付）
2. 实现PaymentService：
   - createWechatOrder()：微信Native支付
   - createAlipayOrder()：支付宝预创建
   - handleWechatNotify()：微信支付回调（验签+幂等性）
   - handleAlipayNotify()：支付宝支付回调（验签+幂等性）
3. 支付回调逻辑：
   - 更新订单状态
   - 开通会员
   - 增加配额
4. 错误处理：签名验证失败、重复回调等
5. 单元测试（使用Mock SDK）覆盖率 ≥ 75%

参考GPT-5后端解决方案中的完整代码实现。
```

---

## P0-009: 统一认证中间件

**优先级**: P0
**预估工时**: 6小时
**依赖**: P0-002

**AI提示词**（复制给GPT-5）:

```
你是Backend Dev，精通Express中间件和认证架构。

任务：统一认证中间件，删除旧middleware，迁移所有路由到新版。

具体要求：

1. 删除旧文件：
   - backend/src/middlewares/auth.middleware.js
   - backend/src/middlewares/adminAuth.middleware.js
2. 使用新middleware：backend/src/middleware/auth.middleware.ts
3. TokenPayload统一包含role字段
4. 实现authenticate()：验证Access Token
5. 实现requireAdmin()：验证管理员权限（从JWT读取role，不查数据库）
6. 迁移所有路由文件（9个）到新middleware
7. 单元测试覆盖率 ≥ 85%

参考GPT-5后端解决方案中的完整代码实现。
```

---

## P1-010: Redis缓存服务

**优先级**: P1
**预估工时**: 6小时
**依赖**: 无

**AI提示词**（复制给GPT-5）:

```
你是Backend Dev，精通Redis缓存策略。

任务：实现Redis缓存服务，使用Cache-Aside模式缓存高频查询。

具体要求：

1. 实现CacheService：
   - getOrSet()：Cache-Aside模式
   - invalidate()：缓存失效
   - invalidatePattern()：批量失效
2. 缓存用户信息（TTL=1小时）
3. 缓存配置数据（TTL=24小时）
4. 缓存失效策略：用户更新时删除缓存
5. 单元测试覆盖率 ≥ 75%

参考GPT-5后端解决方案中的完整代码实现。
```

---

## P1-011: WebSocket任务推送

**优先级**: P1
**预估工时**: 8小时
**依赖**: 无

**AI提示词**（复制给GPT-5）:

```
你是Backend Dev，精通Socket.IO和实时通信。

任务：实现WebSocket任务状态推送，替换前端轮询。

具体要求：

1. 安装socket.io依赖
2. 实现WebSocketService：
   - init()：初始化Socket.IO服务器
   - 用户专属房间：user:{userId}
   - notifyTaskUpdate()：推送任务状态更新
3. 集成到PipelineEngine：任务状态变化时推送
4. 前端连接鉴权：使用Access Token
5. 错误处理：断线重连、消息确认
6. 单元测试覆盖率 ≥ 70%

参考GPT-5后端解决方案中的完整代码实现。
```

---

## P1-012到P1-018任务（简化版）

### P1-012: 错误码枚举（4h）
实现统一的ErrorCode枚举和AppError类，替换字符串错误码。

### P1-013: Swagger API文档（6h）
为所有API添加OpenAPI 3.0注释，集成Swagger UI。

### P1-014: Prometheus监控（8h）
集成Prometheus指标采集和Grafana仪表盘。

### P1-015: 邀请码优化（4h）
使用nanoid替换Math.random()，实现预生成池机制。

### P1-016: 用户资料字段（4h）
users表新增nickname、avatar、gender字段。

### P1-017: 推荐人验证（4h）
注册时验证referrer_id有效性，防止无效推荐。

### P1-018: KMS加密服务（6h）
集成腾讯云KMS，加密敏感数据（如支付密钥）。

---

## 使用建议

### 方式1：一次性交付（不推荐）
将所有18个任务的AI提示词一次性发给GPT-5，要求一次性完成。

**优点**: 快速
**缺点**: 可能遗漏细节、难以调试

### 方式2：分批交付（推荐）
按照Week 1-4的顺序，每周交付一批任务。

**优点**: 可控、可测试、可调整
**缺点**: 需要4周时间

### 方式3：关键路径优先（推荐）
优先完成P0-001、P0-002、P0-003、P0-004、P0-008这5个关键任务。

**优点**: 快速解决最致命的问题
**缺点**: 部分功能仍然不完善

---

**生成人**: 老王（暴躁但专业的产品经理）
**生成时间**: 2025-11-02
**祝你成功！** 艹！这些任务卡都是老王我精心设计的，直接用就行！
