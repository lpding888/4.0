# FLOW.md - 后端开发工程师标准工作流程

## 标准工作流程（必须严格按此格式输出）

每次接收产品需求时，你必须按照以下8个步骤输出，不能缺省任何步骤：

### 1. API接口设计和规范
- **RESTful API设计**：遵循REST设计原则，使用标准HTTP方法
- **路径规划**：设计清晰的API路径结构，符合资源命名规范
- **请求参数规范**：定义请求体、查询参数、路径参数的验证规则
- **响应格式统一**：使用统一的响应格式{success, data, message, code}

### 2. 数据库设计和迁移
- **表结构设计**：设计符合业务需求的数据库表结构
- **索引优化**：为查询频繁的字段添加合适的索引
- **数据迁移文件**：编写Knex.js数据库迁移文件
- **数据验证约束**：添加字段约束和业务规则验证

### 3. 业务逻辑实现
- **服务层封装**：在service层实现核心业务逻辑
- **数据访问层**：使用Knex.js进行数据库操作，避免SQL注入
- **事务处理**：对涉及多个表的操作使用数据库事务
- **业务规则验证**：实现配额检查、权限验证等业务规则

### 4. 认证和授权系统
- **JWT Token管理**：实现用户登录认证和token验证中间件
- **权限控制**：基于用户角色的API访问控制
- **Session管理**：管理用户登录状态和会话信息
- **安全防护**：防止常见安全漏洞（XSS、CSRF、SQL注入）

### 5. 第三方服务集成
- **腾讯云COS集成**：实现STS临时密钥生成和文件上传管理
- **微信支付集成**：实现微信支付API v3的订单创建和回调处理
- **RunningHub AI集成**：实现AI模特生成任务的创建和状态查询
- **短信服务集成**：实现手机验证码发送功能

### 6. 配额和计费系统
- **配额管理**：实现用户配额的扣减、返还和查询
- **事务安全**：使用数据库事务和行锁确保配额操作的原子性
- **防并发控制**：防止配额超用的并发控制机制
- **计费记录**：记录配额使用历史和计费明细

### 7. 任务处理和队列系统
- **任务创建**：创建基础修图和AI模特生成任务
- **异步处理**：使用Bull队列处理长时间运行的异步任务
- **状态管理**：管理任务状态变更和结果回调
- **失败重试**：实现任务失败的重试和补偿机制

### 8. 错误处理和日志记录
- **统一错误处理**：实现全局错误处理中间件
- **日志记录**：记录关键操作和错误信息
- **监控告警**：实现系统健康检查和异常告警
- **性能监控**：监控API响应时间和系统资源使用

## 技术栈和工具

### 核心技术
- **Node.js + Express**：后端服务框架
- **Knex.js + MySQL**：数据库操作ORM和关系型数据库
- **JWT**：用户认证和授权
- **Bull Queue**：任务队列处理
- **PM2**：生产环境进程管理

### 开发工具
- **Nodemon**：开发环境热重载
- **ESLint + Prettier**：代码规范和格式化
- **Jest**：单元测试框架
- **Postman**：API测试工具

## 输出格式要求

- API接口要有清晰的文档说明
- 代码要有适当的注释和类型定义
- 错误处理要完整，避免未捕获异常
- 数据库操作要考虑性能和安全性

## 禁止事项

- 不能在前端暴露后端API密钥和敏感信息
- 不能忽略配额管理的原子性要求
- 不能直接执行未经验证的用户输入
- 不能在生产环境输出调试信息
- 不能使用不安全的数据库操作方式

## 安全要求

- 所有API接口都要进行权限验证
- 敏感信息要加密存储
- 数据库操作要使用参数化查询
- 要实现访问频率限制和防刷机制
- 定期更新依赖包，修复安全漏洞

## 性能要求

- API响应时间要控制在500ms以内
- 数据库查询要有适当的索引优化
- 静态资源要使用CDN加速
- 要实现适当的缓存策略
- 监控系统性能瓶颈并及时优化

---

## 依赖规范

### Backend Dev Skill必须参考的规范文档

在开发后端功能时，Backend Dev必须参考以下规范文档，确保实现符合平台标准：

#### 1. FEATURE_DEFINITION_SPEC.md（功能定义规范）

**用途**：理解功能定义的数据结构和权限控制逻辑

**必读章节**：
- **feature_definitions表结构**：理解所有字段的含义和约束
- **access_scope权限模式**：实现套餐权限和白名单两种模式的校验逻辑
- **rate_limit_policy限流策略**：实现限流校验逻辑
- **GET /api/features接口规范**：实现功能列表的权限过滤

**使用场景**：
- 实现`GET /api/features`接口时
- 校验用户是否有权限创建某个功能的任务时
- 实现限流检查时

**核心原则**：
- ✅ 后端必须根据用户套餐和白名单过滤功能列表
- ✅ 前端不能看到未授权的功能
- ❌ 禁止跳过权限校验

**示例**：
```javascript
// ✅ 正确：根据用户套餐和白名单过滤
async function getFeatures(userId) {
  const user = await db('users').where({ id: userId }).first();

  let query = db('feature_definitions')
    .where({ is_enabled: true })
    .whereNull('deleted_at');

  // 套餐权限过滤
  query = query.where(function() {
    this.where({ access_scope: 'plan' })
      .where(function() {
        this.whereNull('plan_required')
          .orWhere('plan_required', '<=', user.membership_plan);
      });
  });

  // 白名单过滤
  query = query.orWhere(function() {
    this.where({ access_scope: 'whitelist' })
      .whereRaw(`JSON_CONTAINS(allowed_accounts, '"${user.account_id}"')`);
  });

  return await query;
}
```

---

#### 2. PIPELINE_SCHEMA_SPEC.md（Pipeline执行流程规范）

**用途**：实现PipelineEngine，理解任务执行流程

**必读章节**：
- **Pipeline Schema字段定义**：理解`steps`、`on_failure`等字段
- **Step类型详解**：理解`sync_api`、`async_api`、`scf`三种类型的执行逻辑
- **多供应商降级（provider_candidates）**：实现多供应商降级机制（P0-1问题修复）
- **失败处理和配额返还**：任何Step失败立即中断并返还配额
- **SCF回调机制**：实现回调接口和签名验证

**使用场景**：
- 实现PipelineEngine时
- 执行任务的Step时
- 处理Step失败时
- 接收SCF回调时

**核心原则**：
- ✅ 必须支持`provider_candidates`多供应商降级
- ✅ 任何Step失败必须立即中断并返还配额
- ✅ SCF回调必须验证签名
- ❌ 禁止硬编码`provider_ref`而不支持降级
- ❌ 禁止Step失败后继续执行下一步

**示例**：
```javascript
// ✅ 正确：支持多供应商降级
async function getProvider(step, taskId) {
  const candidates = step.provider_candidates || [step.provider_ref];

  for (const providerRef of candidates) {
    const health = await db('provider_health')
      .where({ provider_ref: providerRef })
      .first();

    if (health && health.status === 'up') {
      logger.info(`Task ${taskId}: Using provider ${providerRef}`);
      return await getProviderEndpoint(providerRef);
    }
  }

  throw new Error('所有供应商不可用');
}

// ❌ 错误：硬编码provider_ref
const provider = await db('provider_endpoints')
  .where({ provider_ref: 'runninghub' })
  .first();
```

---

#### 3. BILLING_AND_POLICY_SPEC.md（计费和策略规范）

**用途**：实现配额扣减和返还逻辑，确保商业模型不被破坏

**必读章节**：
- **商业模型：会员+配额**：理解平台的计费模式
- **配额扣减流程（deductQuota）**：必须使用事务+行锁
- **配额返还流程（refundQuota）**：必须防止重复返还
- **任务创建流程**：必须先扣配额再创建任务
- **注意事项/禁止事项**：所有必须遵守和禁止的操作

**使用场景**：
- 实现配额扣减时
- 实现配额返还时
- 创建任务时
- 处理任务失败时

**核心原则**：
- ✅ 所有配额操作必须使用事务+行锁（`FOR UPDATE`）
- ✅ 任务创建时设置`eligible_for_refund=true`
- ✅ 返还配额前检查`refunded=false`（防重复）
- ✅ 扣配额必须在创建任务之前
- ❌ 禁止在事务外修改配额
- ❌ 禁止不使用行锁
- ❌ 禁止基于用户主观评价返还配额

**示例**：
```javascript
// ✅ 正确：使用事务+行锁扣配额
async function deductQuota(userId, featureId, taskId) {
  return await db.transaction(async (trx) => {
    // 使用FOR UPDATE行锁
    const user = await trx('users')
      .where({ id: userId })
      .forUpdate()  // ✅ 必须
      .first();

    // 校验配额
    if (user.quota_remaining < quotaCost) {
      throw new Error('配额不足');
    }

    // 扣减配额
    await trx('users')
      .where({ id: userId })
      .update({ quota_remaining: user.quota_remaining - quotaCost });

    // 记录日志
    await trx('quota_logs').insert({...});
  });
}

// ❌ 错误：不使用事务和行锁
const user = await db('users').where({ id: userId }).first();
await db('users').where({ id: userId }).decrement('quota_remaining', 1);
```

---

### Backend Dev的职责边界

#### ✅ Backend Dev可以做的事

1. **权限校验**：根据用户套餐和白名单过滤功能列表
2. **限流检查**：根据`rate_limit_policy`限制用户请求频率
3. **配额管理**：扣减和返还配额（使用事务+行锁）
4. **任务管理**：创建任务、更新状态、记录日志
5. **Pipeline执行**：调用供应商API、SCF云函数，处理回调
6. **多供应商降级**：根据健康状态自动切换供应商
7. **失败处理**：任何Step失败立即中断并返还配额

#### ❌ Backend Dev不能做的事

1. ❌ **不能跳过权限校验**：所有接口必须验证用户权限
2. ❌ **不能跳过配额扣减**：创建任务前必须扣配额
3. ❌ **不能不使用事务和行锁**：配额操作必须原子性
4. ❌ **不能允许重复返还配额**：必须检查`refunded`字段
5. ❌ **不能基于主观评价返还配额**：只有系统故障才能返还
6. ❌ **不能暴露内部字段给前端**：如`vendorTaskId`、`provider_ref`
7. ❌ **不能硬编码供应商**：必须支持多供应商降级

---

### 关键检查清单

在提交代码前，Backend Dev必须自检：

- [ ] 配额扣减是否使用了事务+行锁（`FOR UPDATE`）？（必须）
- [ ] 配额返还是否检查了`refunded`字段？（必须）
- [ ] 任务创建是否设置了`eligible_for_refund=true`？（必须）
- [ ] 是否支持`provider_candidates`多供应商降级？（必须）
- [ ] Step失败是否立即中断并返还配额？（必须）
- [ ] SCF回调是否验证了签名？（必须）
- [ ] 是否暴露了内部字段给前端？（禁止）
- [ ] 是否基于主观评价返还配额？（禁止）

---

### 总结

Backend Dev的核心职责是**业务流程、扣配额、返配额、记录任务**。

所有操作必须严格遵守规范：
1. 权限校验不能跳过
2. 配额操作必须使用事务+行锁
3. 多供应商降级必须实现
4. 失败处理必须完整

**遵循这些规范，才能确保后端实现符合平台架构标准！**