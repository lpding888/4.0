# Backend Dev Skill - 任务卡清单

## 任务1:数据库迁移 - 核心表结构

**产出物**:
- `backend/src/db/migrations/20251029000001_create_feature_definitions_table.js`
- `backend/src/db/migrations/20251029000002_create_form_schemas_table.js`
- `backend/src/db/migrations/20251029000003_create_pipeline_schemas_table.js`
- `backend/src/db/migrations/20251029000004_extend_tasks_table.js`
- `backend/src/db/migrations/20251029000005_create_task_steps_table.js`
- `backend/src/db/migrations/20251029000006_create_provider_endpoints_table.js`
- `backend/src/db/migrations/20251029000007_create_provider_health_table.js`
- `backend/src/db/migrations/20251029000008_create_assets_table.js`

**执行内容**:

### 1.1 feature_definitions 表
```sql
CREATE TABLE feature_definitions (
  feature_id VARCHAR(100) PRIMARY KEY,
  display_name VARCHAR(200) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT FALSE,
  plan_required VARCHAR(50) NOT NULL,
  access_scope VARCHAR(20) DEFAULT 'plan',
  allowed_accounts TEXT,
  quota_cost INT NOT NULL,
  rate_limit_policy VARCHAR(100),
  output_type VARCHAR(50) NOT NULL,
  save_to_asset_library BOOLEAN DEFAULT FALSE,
  form_schema_ref VARCHAR(100) NOT NULL,
  pipeline_schema_ref VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);
```

### 1.2 form_schemas 表
```sql
CREATE TABLE form_schemas (
  schema_id VARCHAR(100) PRIMARY KEY,
  fields JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 1.3 pipeline_schemas 表
```sql
CREATE TABLE pipeline_schemas (
  pipeline_id VARCHAR(100) PRIMARY KEY,
  steps JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 1.4 tasks 表扩展
```sql
ALTER TABLE tasks 
ADD COLUMN feature_id VARCHAR(100),
ADD COLUMN input_data JSON,
ADD COLUMN artifacts JSON,
ADD COLUMN eligible_for_refund BOOLEAN DEFAULT FALSE,
ADD COLUMN refunded BOOLEAN DEFAULT FALSE,
ADD COLUMN error_message TEXT;
```

### 1.5 task_steps 表(新建)
```sql
CREATE TABLE task_steps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id VARCHAR(100) NOT NULL,
  step_index INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  provider_ref VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  input JSON,
  output JSON,
  error_message TEXT,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  UNIQUE KEY unique_task_step (task_id, step_index)
);
```

### 1.6 provider_endpoints 表
```sql
CREATE TABLE provider_endpoints (
  provider_ref VARCHAR(100) PRIMARY KEY,
  provider_name VARCHAR(200) NOT NULL,
  endpoint_url VARCHAR(500) NOT NULL,
  credentials_encrypted TEXT NOT NULL,
  auth_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 1.7 provider_health 表
```sql
CREATE TABLE provider_health (
  provider_ref VARCHAR(100) PRIMARY KEY,
  status VARCHAR(20) NOT NULL,
  avg_latency_ms INT,
  success_rate_24h DECIMAL(5,2),
  last_check_at TIMESTAMP NOT NULL,
  last_error TEXT,
  FOREIGN KEY (provider_ref) REFERENCES provider_endpoints(provider_ref) ON DELETE CASCADE
);
```

### 1.8 assets 表
```sql
CREATE TABLE assets (
  asset_id VARCHAR(100) PRIMARY KEY,
  user_id INT NOT NULL,
  task_id VARCHAR(100) NOT NULL,
  feature_id VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500),
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
  INDEX idx_user_created (user_id, created_at DESC),
  INDEX idx_feature (feature_id)
);
```

**验收标准**:
- 所有迁移文件可成功执行 `npm run migrate`
- 所有外键约束正确设置
- allowed_accounts 字段使用 TEXT 类型存储 JSON 数组字符串
- credentials_encrypted 字段必须加密存储,不得明文

**禁止事项**:
- 禁止在迁移文件中硬编码任何密钥或真实域名
- 禁止在 provider_endpoints 中明文存储 credentials

**依赖项**:
- 现有 users、tasks、orders 表已存在

---

## 任务2:Feature Service 和 API - 前端公开接口

**产出物**:
- `backend/src/services/feature.service.js`
- `backend/src/controllers/feature.controller.js`
- `backend/src/routes/feature.routes.js`

**执行内容**:

### 2.1 GET /api/features
**功能**: 获取当前用户可用的功能卡片列表

**过滤逻辑**:
1. **只返回启用且未删除的卡片**:
   ```sql
   WHERE is_enabled = true AND deleted_at IS NULL
   ```

2. 根据 `access_scope` 过滤:
   - 如果 `access_scope='plan'`: 检查 `users.membership_level` 是否满足 `plan_required`
   - 如果 `access_scope='whitelist'`: 检查当前 `user_id` 是否在 `allowed_accounts` 数组中
   
3. **allowed_accounts 字段统一返回为 JSON 数组**:
   ```javascript
   // 查询后,将 allowed_accounts 反序列化为数组(前端编辑时需要)
   features.forEach(f => {
     if (f.allowed_accounts) {
       f.allowed_accounts = JSON.parse(f.allowed_accounts);
     }
   });
   ```

4. 返回字段: feature_id, display_name, category, description, plan_required, quota_cost, rate_limit_policy, output_type, save_to_asset_library

**响应示例**:
```json
{
  "features": [
    {
      "feature_id": "basic_clean",
      "display_name": "主图清洁增强",
      "category": "视觉图像",
      "description": "一键去除杂物,输出干净白底主图",
      "plan_required": "基础",
      "quota_cost": 1,
      "rate_limit_policy": "hourly:30",
      "output_type": "singleImage",
      "save_to_asset_library": true
    }
  ]
}
```

### 2.2 GET /api/features/:featureId/form-schema
**功能**: 获取功能的表单schema

**执行逻辑**:
1. 根据 `feature_id` 查询 `feature_definitions.form_schema_ref`
2. 根据 `form_schema_ref` 查询 `form_schemas` 表
3. 返回完整 schema

**响应示例**:
```json
{
  "schema_id": "basic_clean_form",
  "fields": [
    {
      "fieldKey": "productImage",
      "label": "商品主图",
      "type": "imageUpload",
      "required": true,
      "validation": {
        "maxSize": 5242880,
        "allowedTypes": ["image/jpeg", "image/png"]
      },
      "helpText": "支持JPG/PNG,最大5MB",
      "map_to_pipeline": [
        { "step_index": 0, "param_key": "input_image" }
      ]
    }
  ]
}
```

**验收标准**:
- 白名单功能只对 allowed_accounts 中的用户可见
- 套餐权限正确过滤(基础会员看不到 PRO 功能)
- 响应中不包含内部字段(pipeline_schema_ref、form_schema_ref)

**禁止事项**:
- 禁止返回 is_enabled=false 的功能
- 禁止在前端返回 pipeline_schema (前端不需要知道执行流程)
- 禁止返回 allowed_accounts 字段给前端

**依赖项**:
- auth.middleware.js 中间件已实现(解析 JWT 获取 user_id)
- users 表有 membership_level 字段

---

## 任务3:Task Creation API - 预扣配额和创建任务

**产出物**:
- `backend/src/services/task.service.js` (改造)
- `backend/src/controllers/task.controller.js` (改造)

**执行内容**:

### 3.1 POST /api/tasks/create
**请求体**:
```json
{
  "feature_id": "basic_clean",
  "input_data": {
    "productImage": "https://cos.../upload.jpg",
    "backgroundColor": "white"
  }
}
```

**执行流程**:
1. **验证功能卡片**:
   - 查询 feature_definitions,检查 is_enabled=true
   - 检查 access_scope 和权限(plan/whitelist)
   
2. **限流检查** (调用 quota.service.checkRateLimit):
   - 解析 rate_limit_policy (格式: "hourly:3")
   - 查询 Redis key: `rate_limit:{user_id}:{feature_id}:{time_window}`
   - 如果超过限制,返回 429 错误

3. **预扣配额** (调用 quota.service.deductQuota):
   ```sql
   BEGIN TRANSACTION;
   SELECT quota_remaining FROM users WHERE id=? FOR UPDATE;
   -- 检查 quota_remaining >= quota_cost
   UPDATE users SET quota_remaining = quota_remaining - ? WHERE id=?;
   -- 如果余额不足,ROLLBACK 并返回 402 错误
   COMMIT;
   ```

4. **创建任务记录**:
   ```sql
   INSERT INTO tasks (
     id, user_id, feature_id, input_data, status, 
     quota_cost, eligible_for_refund, created_at
   ) VALUES (?, ?, ?, ?, 'processing', ?, false, NOW());
   ```

5. **创建 task_steps 记录**:
   - 读取 feature_definitions.pipeline_schema_ref
   - 读取 pipeline_schemas.steps[]
   - 为每个 step 创建一条 task_steps 记录(status='pending')

6. **触发 PipelineEngine**:
   - 调用 `pipelineEngine.execute(taskId)` (异步执行,不阻塞响应)

7. **返回响应**:
   ```json
   {
     "task_id": "t_abc123",
     "status": "processing",
     "quota_cost": 1
   }
   ```

**验收标准**:
- 配额扣减和任务创建在同一事务中,保证原子性
- 余额不足时返回 402,错误信息为"配额不足,请充值或升级会员"
- 限流触发时返回 429,错误信息为"操作过于频繁,请X分钟后再试"
- Redis rate_limit 计数器正确递增并设置过期时间

**禁止事项**:
- 禁止先创建任务再扣配额(必须先扣配额)
- 禁止跳过限流检查
- 禁止在响应中返回 pipeline_schema 或 provider_ref

**依赖项**:
- quota.service.js 已实现 deductQuota 和 checkRateLimit
- pipelineEngine.service.js 已实现 execute 方法
- Redis 连接已配置

---

## 任务4:PipelineEngine - 编排执行 pipeline_schema

**产出物**:
- `backend/src/services/pipelineEngine.service.js`
- `backend/src/services/providers/syncImageProcess.provider.js`
- `backend/src/services/providers/runninghubWorkflow.provider.js`
- `backend/src/services/providers/scfPostProcess.provider.js`

**执行内容**:

### 4.1 PipelineEngine 核心逻辑
```javascript
async function execute(taskId) {
  // 1. 读取任务和 pipeline_schema
  const task = await db('tasks').where({ id: taskId }).first();
  const feature = await db('feature_definitions').where({ feature_id: task.feature_id }).first();
  const pipeline = await db('pipeline_schemas').where({ pipeline_id: feature.pipeline_schema_ref }).first();
  
  // 2. 顺序执行每个 step
  for (let i = 0; i < pipeline.steps.length; i++) {
    const step = pipeline.steps[i];
    const taskStep = await db('task_steps').where({ task_id: taskId, step_index: i }).first();
    
    try {
      // 更新 step 状态为 running
      await db('task_steps').where({ id: taskStep.id }).update({ 
        status: 'running', 
        started_at: new Date() 
      });
      
      // 根据 step.type 调用对应 provider
      let output;
      if (step.type === 'SYNC_IMAGE_PROCESS') {
        output = await executeSyncImageProcess(step, task.input_data, taskId, i);
      } else if (step.type === 'RUNNINGHUB_WORKFLOW') {
        output = await executeRunninghubWorkflow(step, task.input_data, taskId, i);
      } else if (step.type === 'SCF_POST_PROCESS') {
        // 获取上一个 step 的输出
        const prevStep = await db('task_steps').where({ task_id: taskId, step_index: i-1 }).first();
        output = await executeScfPostProcess(step, prevStep.output, task.input_data, taskId, i);
      }
      
      // 更新 step 状态为 success
      await db('task_steps').where({ id: taskStep.id }).update({ 
        status: 'success', 
        output: JSON.stringify(output),
        completed_at: new Date() 
      });
      
    } catch (error) {
      // 任何 step 失败,标记任务失败并返还配额
      await handleTaskFailure(taskId, taskStep.id, error.message);
      return;
    }
  }
  
  // 3. 所有 steps 成功,标记任务完成
  await handleTaskSuccess(taskId);
}
```

### 4.2 executeSyncImageProcess (同步图像处理)
```javascript
async function executeSyncImageProcess(step, inputData, taskId, stepIndex) {
  // 1. 读取 provider_endpoints
  const provider = await getProviderWithHealth(step.provider_ref, step.provider_candidates);
  
  // 2. 映射输入参数
  const params = mapInputParams(step.input_mapping, inputData, null);
  
  // 3. 调用供应商 API (同步)
  const response = await callProviderAPI(provider, params, step.timeout_seconds);
  
  // 4. 返回结果 URL
  return {
    type: step.expected_output,
    file_urls: [response.output_url]
  };
}
```

### 4.3 executeRunninghubWorkflow (异步轮询)
```javascript
async function executeRunninghubWorkflow(step, inputData, taskId, stepIndex) {
  // 1. 选择健康的 provider
  const provider = await getProviderWithHealth(step.provider_ref, step.provider_candidates);
  
  // 2. 映射输入参数
  const params = mapInputParams(step.input_mapping, inputData, null);
  
  // 3. 创建远程任务
  const createResp = await callProviderAPI(provider, params, step.timeout_seconds);
  const vendorTaskId = createResp.task_id;
  
  // 4. 轮询拿结果
  if (step.polling && step.polling.enabled) {
    const result = await pollVendorTask(
      provider, 
      vendorTaskId, 
      step.polling.interval_seconds, 
      step.polling.max_attempts
    );
    
    return {
      type: step.expected_output,
      file_urls: result.file_urls
    };
  }
}
```

### 4.4 executeScfPostProcess (云函数后处理)
```javascript
async function executeScfPostProcess(step, prevStepOutput, inputData, taskId, stepIndex) {
  // 1. 读取 provider_endpoints (SCF 云函数地址)
  const provider = await db('provider_endpoints').where({ provider_ref: step.provider_ref }).first();
  
  // 2. 映射输入参数 (包含上一步的输出)
  const params = mapInputParams(step.input_mapping, inputData, prevStepOutput);
  
  // 3. 调用云函数 (异步回调模式)
  const response = await callSCF(provider, {
    task_id: taskId,
    step_index: stepIndex,
    input_files: prevStepOutput.file_urls,
    params: params
  });
  
  // 4. 等待回调 (通过数据库轮询 task_steps.output)
  const result = await waitForCallback(taskId, stepIndex, step.timeout_seconds);
  
  return result;
}
```

### 4.5 多供应商降级逻辑 (getProviderWithHealth)
```javascript
async function getProviderWithHealth(primaryProviderRef, providerCandidates) {
  // 1. 如果没有 candidates,直接返回主 provider
  if (!providerCandidates || providerCandidates.length === 0) {
    return await db('provider_endpoints').where({ provider_ref: primaryProviderRef }).first();
  }
  
  // 2. 按优先级尝试每个 candidate
  for (const candidateRef of providerCandidates) {
    const health = await db('provider_health').where({ provider_ref: candidateRef }).first();
    
    // 如果健康状态为 up,使用该 provider
    if (health && health.status === 'up') {
      return await db('provider_endpoints').where({ provider_ref: candidateRef }).first();
    }
  }
  
  // 3. 所有 candidates 都不健康,抛出异常
  throw new Error('所有供应商不可用');
}
```

### 4.6 handleTaskFailure (任务失败处理)
```javascript
async function handleTaskFailure(taskId, stepId, errorMessage) {
  await db.transaction(async (trx) => {
    // 1. 更新 task_steps
    await trx('task_steps').where({ id: stepId }).update({ 
      status: 'failed', 
      error_message: errorMessage,
      completed_at: new Date() 
    });
    
    // 2. 更新 tasks
    await trx('tasks').where({ id: taskId }).update({ 
      status: 'failed',
      eligible_for_refund: true,
      error_message: errorMessage
    });
    
    // 3. 返还配额
    const task = await trx('tasks').where({ id: taskId }).first();
    await trx('users')
      .where({ id: task.user_id })
      .increment('quota_remaining', task.quota_cost);
  });
}
```

### 4.7 handleTaskSuccess (任务成功处理)
```javascript
async function handleTaskSuccess(taskId) {
  await db.transaction(async (trx) => {
    // 1. 获取最后一个 step 的输出
    const lastStep = await trx('task_steps')
      .where({ task_id: taskId })
      .orderBy('step_index', 'desc')
      .first();
    
    // 2. 更新 tasks
    await trx('tasks').where({ id: taskId }).update({ 
      status: 'success',
      artifacts: lastStep.output,
      completed_at: new Date()
    });
    
    // 3. 如果需要保存到素材库
    const task = await trx('tasks').where({ id: taskId }).first();
    const feature = await trx('feature_definitions').where({ feature_id: task.feature_id }).first();
    
    if (feature.save_to_asset_library) {
      const artifacts = JSON.parse(lastStep.output);
      for (const fileUrl of artifacts.file_urls) {
        await trx('assets').insert({
          asset_id: `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          user_id: task.user_id,
          task_id: taskId,
          feature_id: task.feature_id,
          type: artifacts.type,
          url: fileUrl,
          created_at: new Date()
        });
      }
    }
  });
}
```

**验收标准**:
- 三种 step 类型都能正确执行
- 多供应商降级逻辑生效(主 provider down 时自动切换)
- 任何 step 失败时,整个任务标记为 failed 并返还配额
- 成功任务的 artifacts 字段正确写入最后一步的输出
- save_to_asset_library=true 时,自动写入 assets 表

**禁止事项**:
- 禁止跳过任何 step
- 禁止在 step 失败后继续执行下一个 step
- 禁止硬编码 provider_ref,必须从 pipeline_schema 读取
- 禁止在代码中写死供应商域名或密钥

**依赖项**:
- provider_endpoints 和 provider_health 表已创建
- Redis 已配置(用于轮询状态缓存)

---

## 任务5:Provider Health 健康检查定时任务

**产出物**:
- `backend/src/services/providerHealth.service.js`
- `backend/src/jobs/providerHealthCheck.job.js`

**执行内容**:

### 5.1 健康检查逻辑
```javascript
async function checkProviderHealth(providerRef) {
  const provider = await db('provider_endpoints').where({ provider_ref: providerRef }).first();
  
  try {
    const startTime = Date.now();
    
    // 调用 provider 的健康检查接口 (或 ping 接口)
    const response = await axios.get(`${provider.endpoint_url}/health`, {
      timeout: 5000
    });
    
    const latency = Date.now() - startTime;
    
    // 更新 provider_health
    await db('provider_health').insert({
      provider_ref: providerRef,
      status: 'up',
      avg_latency_ms: latency,
      last_check_at: new Date()
    }).onConflict('provider_ref').merge();
    
  } catch (error) {
    // 标记为 down
    await db('provider_health').insert({
      provider_ref: providerRef,
      status: 'down',
      last_check_at: new Date(),
      last_error: error.message
    }).onConflict('provider_ref').merge();
  }
}
```

### 5.2 定时任务 (每分钟执行一次)
```javascript
const cron = require('node-cron');

// 每分钟检查所有 provider
cron.schedule('* * * * *', async () => {
  const providers = await db('provider_endpoints').select('provider_ref');
  
  for (const provider of providers) {
    await checkProviderHealth(provider.provider_ref);
  }
});
```

### 5.3 计算 24 小时成功率 (可选,每小时执行一次)
```javascript
async function calculateSuccessRate24h(providerRef) {
  // 查询过去 24 小时内该 provider 的所有任务
  const tasks = await db('task_steps')
    .where({ provider_ref: providerRef })
    .where('created_at', '>', new Date(Date.now() - 24*60*60*1000));
  
  const total = tasks.length;
  const success = tasks.filter(t => t.status === 'success').length;
  
  const successRate = total > 0 ? (success / total * 100).toFixed(2) : 0;
  
  await db('provider_health').where({ provider_ref: providerRef }).update({
    success_rate_24h: successRate
  });
}
```

**验收标准**:
- 定时任务正常运行,每分钟检查所有 provider
- provider_health 表实时更新 status 和 last_check_at
- PipelineEngine 能正确读取 provider_health 进行降级

**禁止事项**:
- 禁止健康检查失败时抛出异常导致定时任务中断
- 禁止在健康检查中使用真实的生成接口(必须使用 /health 接口)

**依赖项**:
- provider_endpoints 表已有数据
- 定时任务框架(node-cron 或 bull)已安装

---

## 任务6:SCF 回调接口 - 内部签名验证

**产出物**:
- `backend/src/controllers/internal.controller.js`
- `backend/src/routes/internal.routes.js`
- `backend/src/middlewares/internalAuth.middleware.js`

**执行内容**:

### 6.1 POST /api/internal/tasks/:taskId/steps/:stepIndex/callback
**请求头**:
```
X-Internal-Signature: HMAC-SHA256(task_id + step_index + timestamp + secret)
X-Timestamp: 1698765432
```

**请求体**:
```json
{
  "status": "success",
  "output_url": "https://cos.../final_video.mp4"
}
```

**执行逻辑**:
1. **签名验证** (在 internalAuth.middleware.js 中):
   ```javascript
   const crypto = require('crypto');
   
   function verifyInternalSignature(req, res, next) {
     const signature = req.headers['x-internal-signature'];
     const timestamp = req.headers['x-timestamp'];
     const { taskId, stepIndex } = req.params;
     
     // 防重放攻击:检查时间戳在 5 分钟内
     if (Math.abs(Date.now() - timestamp * 1000) > 5 * 60 * 1000) {
       return res.status(401).json({ error: '签名已过期' });
     }
     
     // 计算签名
     const secret = process.env.INTERNAL_CALLBACK_SECRET;
     const payload = `${taskId}${stepIndex}${timestamp}`;
     const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
     
     if (signature !== expectedSignature) {
       return res.status(401).json({ error: '签名验证失败' });
     }
     
     next();
   }
   ```

2. **更新 task_steps**:
   ```javascript
   async function handleCallback(req, res) {
     const { taskId, stepIndex } = req.params;
     const { status, output_url } = req.body;
     
     await db('task_steps')
       .where({ task_id: taskId, step_index: stepIndex })
       .update({
         status: status,
         output: JSON.stringify({ file_urls: [output_url] }),
         completed_at: new Date()
       });
     
     res.json({ success: true });
   }
   ```

**验收标准**:
- 所有内部回调路由均前置 verifyInternalSignature 中间件
- 签名验证失败时返回 401
- 时间戳超过 5 分钟时拒绝请求
- 回调成功后 task_steps.output 正确更新
- PipelineEngine 能读取更新后的 output 继续执行
- SCF 回调中间件的签名规则已文档化并同步给 SCF 团队

**禁止事项**:
- 禁止允许未签名的回调请求
- 禁止在回调接口中直接修改 tasks 表(只能修改 task_steps)
- 禁止在响应中返回敏感信息
- 禁止 SCF 直接操作数据库(必须通过回调接口)

**依赖项**:
- 环境变量 INTERNAL_CALLBACK_SECRET 已配置
- SCF 云函数知道如何计算签名

---

## 任务7:Admin API - 功能卡片 CRUD

**产出物**:
- `backend/src/controllers/admin.controller.js` (改造)
- `backend/src/routes/admin.routes.js` (改造)
- `backend/src/middlewares/adminAuth.middleware.js`

**执行内容**:

### 7.1 GET /api/admin/features
**权限**: 需 admin 角色  
**响应**: 返回所有 feature_definitions(包括 is_enabled=false,但不包括软删除的)

**执行逻辑**:
```sql
SELECT * FROM feature_definitions WHERE deleted_at IS NULL;
```

**返回格式**:
```javascript
// allowed_accounts 反序列化为数组供前端展示
features.forEach(f => {
  if (f.allowed_accounts) {
    f.allowed_accounts = JSON.parse(f.allowed_accounts);
  }
});
```

### 7.2 POST /api/admin/features
**权限**: 需 admin 角色  
**请求体**:
```json
{
  "feature_definition": {
    "feature_id": "new_feature",
    "display_name": "新功能",
    "category": "视觉图像",
    "description": "...",
    "is_enabled": false,
    "plan_required": "PRO",
    "access_scope": "plan",
    "allowed_accounts": null,
    "quota_cost": 2,
    "rate_limit_policy": "hourly:5",
    "output_type": "multiImage",
    "save_to_asset_library": true
  },
  "form_schema": {
    "schema_id": "new_feature_form",
    "fields": [...]
  },
  "pipeline_schema": {
    "pipeline_id": "new_feature_pipeline",
    "steps": [...]
  }
}
```

**执行逻辑**:
1. **校验 JSON 结构**(使用 Ajv):
   ```javascript
   const Ajv = require('ajv');
   const ajv = new Ajv();
   
   // 校验 form_schema
   const formSchemaValidator = ajv.compile(formSchemaSpec);
   if (!formSchemaValidator(req.body.form_schema)) {
     return res.status(400).json({ 
       error: '表单Schema格式错误', 
       details: formSchemaValidator.errors 
     });
   }
   
   // 校验 pipeline_schema
   const pipelineSchemaValidator = ajv.compile(pipelineSchemaSpec);
   if (!pipelineSchemaValidator(req.body.pipeline_schema)) {
     return res.status(400).json({ 
       error: 'Pipeline Schema格式错误', 
       details: pipelineSchemaValidator.errors 
     });
   }
   ```

2. **规范化 allowed_accounts 字段**:
   ```javascript
   // 如果前端传入多行文本(例如 "123\n456\n789")
   let allowedAccounts = req.body.feature_definition.allowed_accounts;
   
   if (allowedAccounts && typeof allowedAccounts === 'string') {
     // 转换为数组
     const accountArray = allowedAccounts
       .split('\n')
       .map(line => line.trim())
       .filter(line => line.length > 0)
       // 去重
       .filter((value, index, self) => self.indexOf(value) === index);
     
     // 转换为 JSON 字符串存储
     allowedAccounts = JSON.stringify(accountArray);
   } else if (Array.isArray(allowedAccounts)) {
     // 如果前端已传入数组,直接序列化
     allowedAccounts = JSON.stringify(allowedAccounts);
   }
   ```

3. 事务插入:
   ```sql
   BEGIN TRANSACTION;
   INSERT INTO form_schemas (schema_id, fields) VALUES (...);
   INSERT INTO pipeline_schemas (pipeline_id, steps) VALUES (...);
   INSERT INTO feature_definitions (..., allowed_accounts) VALUES (..., ?);
   COMMIT;
   ```

### 7.3 PUT /api/admin/features/:featureId
**权限**: 需 admin 角色  
**请求体**: 同 POST,支持部分更新

**执行逻辑**:
1. 同样使用 Ajv 校验 JSON 结构
2. 同样规范化 allowed_accounts 字段(多行文本 → JSON 数组)

### 7.4 PATCH /api/admin/features/:featureId
**权限**: 需 admin 角色  
**用途**: 快速切换 is_enabled 开关  
**请求体**:
```json
{
  "is_enabled": true
}
```

**风险提示**:
```javascript
// 如果 quota_cost=0 且 is_enabled=true,返回警告
const feature = await db('feature_definitions').where({ feature_id: featureId }).first();

if (req.body.is_enabled && feature.quota_cost === 0) {
  return res.status(400).json({ 
    error: '配额为0的功能不建议上线', 
    warning: '该功能不扣费,可能导致滥用和成本失控'
  });
}
```

### 7.5 DELETE /api/admin/features/:featureId
**权限**: 需 admin 角色  
**执行逻辑**: 软删除(设置 deleted_at 而不是物理删除)

**验收标准**:
- 所有 admin 接口需校验 user.role=admin
- 非 admin 访问返回 403
- 创建/更新时校验 JSON 结构,无效时返回 400 并说明错误原因
- 软删除后的功能不在 GET /api/features 中显示

**禁止事项**:
- 禁止允许非 admin 访问
- 禁止物理删除 feature_definitions (必须软删除)
- 禁止在响应中返回 credentials_encrypted

**依赖项**:
- users 表有 role 字段
- adminAuth.middleware.js 已实现

---

## 任务8:Assets API - 素材库接口

**产出物**:
- `backend/src/controllers/asset.controller.js`
- `backend/src/routes/asset.routes.js`
- `backend/src/services/asset.service.js`

**执行内容**:

### 8.1 GET /api/assets
**查询参数**:
- userId: "me" (当前用户) 或具体用户ID (仅 admin 可查询他人)
- type: 可选,按素材类型筛选 (image/video/zip/textBundle)
- featureId: 可选,按功能筛选
- startDate / endDate: 可选,按时间范围筛选
- page / limit: 分页参数

**响应**:
```json
{
  "assets": [
    {
      "asset_id": "asset_abc123",
      "task_id": "t_xyz789",
      "feature_id": "model_pose12",
      "feature_name": "AI模特12分镜",
      "type": "multiImage",
      "url": "https://cos.../result.jpg",
      "thumbnail_url": "https://cos.../thumb.jpg",
      "created_at": "2025-10-29T10:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

### 8.2 DELETE /api/assets/:assetId
**权限**: 只能删除自己的素材  
**执行逻辑**: 物理删除 assets 记录(COS 文件可选择是否删除)

**验收标准**:
- 用户只能查询和删除自己的素材
- admin 可以查询所有用户的素材
- 分页正确,按创建时间倒序

**禁止事项**:
- 禁止用户查询他人素材
- 禁止允许前端直接上传到 assets 表(只能由系统自动写入)

**依赖项**:
- assets 表已创建
- handleTaskSuccess 中已实现自动写入逻辑

---

## 依赖规范

### 数据库事务要求
1. **配额扣减必须使用行锁**: `SELECT ... FOR UPDATE`
2. **任务创建和配额扣减在同一事务中**
3. **任务失败返还配额也必须使用行锁**

### 安全要求
1. **密钥加密存储**: provider_endpoints.credentials_encrypted 必须加密,使用 KMS 或环境变量解密
2. **内部回调签名验证**: SCF 回调必须验证 HMAC 签名
3. **admin 接口权限校验**: 所有 /api/admin/* 接口必须校验 user.role=admin

### 性能要求
1. **Redis 限流**: rate_limit_policy 使用 Redis 实现,不能用数据库
2. **provider_health 缓存**: 健康状态查询优先从 Redis 读(“写 DB + 缓 Redis”策略),降低数据库压力:
   ```javascript
   // 写入时同步写 DB 和 Redis
   await db('provider_health').insert(data).onConflict('provider_ref').merge();
   await redis.setex(`provider_health:${providerRef}`, 60, JSON.stringify(data));
   
   // 读取时优先 Redis
   const cached = await redis.get(`provider_health:${providerRef}`);
   if (cached) return JSON.parse(cached);
   return await db('provider_health').where({ provider_ref: providerRef }).first();
   ```
3. **异步任务执行**: PipelineEngine 使用消息队列(Bull)或后台 worker,不阻塞 API 响应

### 多供应商降级规范
1. **pipeline_schema.steps[].provider_candidates**: 数组,按优先级排列
2. **降级逻辑**: 按顺序尝试,status=up 的 provider 才使用
3. **健康检查**: 定时任务每分钟更新 provider_health
4. **超时重试**: `step_timeout_seconds` 和 `retry_limit` 字段支持(可选),PipelineEngine 尊重该配置:
   ```javascript
   // 单 step 超时处理
   const timeout = step.timeout_seconds || 300; // 默认 300秒
   const retryLimit = step.retry_limit || 0; // 默认不重试
   
   for (let attempt = 0; attempt <= retryLimit; attempt++) {
     try {
       const result = await executeStepWithTimeout(step, timeout);
       return result;
     } catch (error) {
       if (attempt === retryLimit) throw error;
       // 超时即视为失败,尝试下一个 provider
       continue;
     }
   }
   ```

### SCF 回调规范
1. **签名格式**: HMAC-SHA256(task_id + step_index + timestamp + secret)
2. **时间戳验证**: 防重放攻击,5分钟内有效
3. **职责边界**: SCF 只能调回调接口,不能直接操作数据库

### 交付标准
- 所有迁移文件通过 `npm run migrate`
- 所有接口通过 Postman 测试
- 单元测试覆盖率 > 80% (quota.service, pipelineEngine.service)
- 集成测试覆盖 3 个完整流程(主图清洁增强/AI模特12分镜/上新合辑短片)
