# PIPELINE_SCHEMA_SPEC.md - 后端Pipeline执行流程规范

## 文档目的

本文档定义后端任务执行流程（Pipeline）的数据结构规范，供所有技能包Agent参考。

**适用场景**：
- Product Planner设计新功能时，定义任务执行步骤和供应商降级策略
- Backend Dev实现PipelineEngine时，理解step类型和执行逻辑
- SCF Worker实现云函数时，理解异步step的回调机制
- Billing Guard审查时，验证失败返配额逻辑是否完整
- Reviewer审查时，检查是否支持多供应商降级（P0-1问题）

**核心原则**：
✅ **支持多供应商降级**（`provider_candidates`）
✅ **任何step失败立即中断并返还配额**
✅ **SCF只能通过回调接口更新状态**（不直接操作数据库）

---

## 核心概念

### 什么是Pipeline？

Pipeline是一个**任务执行流程**，由多个Step组成。每个Step代表一个处理环节，可以是同步或异步执行。

**设计理念**：
- 一个Feature可以有单步Pipeline（如"服装清理增强"）或多步Pipeline（如"上新合辑短片"）
- 每个Step可以调用不同的供应商（provider）
- 支持多供应商降级：主供应商不可用时自动切换备用供应商
- 任何Step失败立即中断整个Pipeline，并返还配额

**示例场景**：
- **单步同步**："服装清理增强" → 调用腾讯数据万象抠图 → 3秒返回结果
- **单步异步**："AI模特12分镜" → 调用RunningHub生成 → 5分钟后回调返回结果
- **多步异步**："上新合辑短片" → Step1:抠图 → Step2:合成视频 → Step3:添加音乐 → 10分钟后完成

---

## 数据库表结构

### pipeline_schemas 表

```sql
CREATE TABLE pipeline_schemas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT 'Pipeline名称（可读）',
  version VARCHAR(20) DEFAULT '1.0.0' COMMENT 'Pipeline版本号',
  schema JSON NOT NULL COMMENT 'Pipeline Schema定义（JSON对象）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### task_steps 表（运行时状态）

```sql
CREATE TABLE task_steps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL COMMENT '关联的任务ID',
  step_index INT NOT NULL COMMENT 'Step在Pipeline中的索引（从0开始）',
  step_name VARCHAR(100) NOT NULL COMMENT 'Step名称',
  provider_ref VARCHAR(50) COMMENT '实际使用的供应商标识',
  status ENUM('pending', 'processing', 'success', 'failed') DEFAULT 'pending',
  input JSON COMMENT 'Step输入数据',
  output JSON COMMENT 'Step输出数据',
  error_message TEXT COMMENT '错误信息（status=failed时）',
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  INDEX idx_task_id (task_id),
  INDEX idx_status (status)
);
```

---

## Pipeline Schema 字段定义

### 顶层结构

| 字段名 | 类型 | 是否必填 | 含义 | 示例 |
|--------|------|----------|------|------|
| `steps` | Array | ✅ 必填 | Pipeline步骤列表 | `[{...}, {...}]` |
| `on_failure` | String | 可选 | 失败处理策略（`refund_quota`/`no_refund`） | `refund_quota`（默认） |
| `max_execution_time` | Int | 可选 | Pipeline最大执行时间（秒） | `600`（10分钟） |

---

## Step 字段定义

### 通用字段属性

| 属性名 | 类型 | 是否必填 | 含义 |
|--------|------|----------|------|
| `name` | String | ✅ 必填 | Step名称（可读） |
| `type` | String | ✅ 必填 | Step类型（`sync_api`/`async_api`/`scf`） |
| `provider_ref` | String | ⚠️ 条件必填 | 主供应商标识（`type=sync_api/async_api`时必填） |
| `provider_candidates` | Array | ✅ **强烈建议** | 供应商候选列表（支持降级） |
| `endpoint` | String | ⚠️ 条件必填 | API端点路径（`type=sync_api/async_api`时必填） |
| `scf_function` | String | ⚠️ 条件必填 | SCF函数名（`type=scf`时必填） |
| `input_mapping` | Object | ✅ 必填 | 输入数据映射规则 |
| `output_mapping` | Object | ✅ 必填 | 输出数据映射规则 |
| `timeout_seconds` | Int | 可选 | 单步超时时间（秒） |
| `retry` | Object | 可选 | 重试策略 |
| `polling` | Object | 可选 | 轮询配置（异步API） |

---

## Step类型详解

### 类型1：sync_api（同步API调用）

**适用场景**：几秒内返回结果的API（如腾讯数据万象抠图）

**执行流程**：
1. PipelineEngine调用供应商API
2. 等待响应（timeout内）
3. 解析响应，保存output
4. 立即进入下一步或完成任务

**示例**：
```json
{
  "name": "basic_clean",
  "type": "sync_api",
  "provider_ref": "tencent_cloud_infinite",  // 主供应商
  "provider_candidates": [
    "tencent_cloud_infinite",  // 主供应商
    "aliyun_image_ai"          // 备用供应商
  ],
  "endpoint": "/image/process",
  "input_mapping": {
    "image_url": "${input_data.input_image}"
  },
  "output_mapping": {
    "result_url": "$.data.output_url"
  },
  "timeout_seconds": 30,
  "retry": {
    "max_attempts": 3,
    "delay_seconds": 2
  }
}
```

---

### 类型2：async_api（异步API调用+轮询）

**适用场景**：需要几分钟才能返回结果的API（如RunningHub AI模特生成）

**执行流程**：
1. PipelineEngine调用供应商API创建任务
2. 供应商返回`vendor_task_id`
3. PipelineEngine定期轮询任务状态（根据`polling`配置）
4. 轮询到完成状态后，保存output
5. 进入下一步或完成任务

**示例**：
```json
{
  "name": "model_pose12",
  "type": "async_api",
  "provider_ref": "runninghub",
  "provider_candidates": [
    "runninghub",         // 主供应商
    "stable_diffusion_api" // 备用供应商
  ],
  "endpoint": "/workflow/execute",
  "input_mapping": {
    "image_url": "${input_data.input_image}",
    "workflow_id": "model_pose_12_v2"
  },
  "output_mapping": {
    "vendor_task_id": "$.task_id",
    "status": "$.status",
    "result_urls": "$.output_images"
  },
  "polling": {
    "status_endpoint": "/workflow/status/{vendor_task_id}",
    "interval_seconds": 10,
    "max_attempts": 60,
    "complete_statuses": ["success", "completed"],
    "failed_statuses": ["failed", "error", "timeout"]
  },
  "timeout_seconds": 600
}
```

---

### 类型3：scf（云函数异步执行+回调）

**适用场景**：复杂处理逻辑、大文件处理、多供应商编排（如视频合成）

**执行流程**：
1. PipelineEngine触发SCF云函数
2. SCF异步执行处理逻辑
3. SCF完成后调用后端回调接口`POST /api/internal/tasks/:taskId/steps/:stepIndex/callback`
4. 后端验证签名，更新task_steps状态
5. 进入下一步或完成任务

**示例**：
```json
{
  "name": "video_composite",
  "type": "scf",
  "scf_function": "video-compositor",
  "input_mapping": {
    "image_urls": "${steps[0].output.result_urls}",
    "audio_url": "${input_data.background_music}"
  },
  "output_mapping": {
    "video_url": "$.output.video_url"
  },
  "timeout_seconds": 600,
  "callback_config": {
    "url": "${backend_url}/api/internal/tasks/${task_id}/steps/${step_index}/callback",
    "signature_secret": "${env.INTERNAL_CALLBACK_SECRET}"
  }
}
```

---

## 多供应商降级（provider_candidates）

### 核心机制

当主供应商（`provider_ref`）不可用时，自动尝试备用供应商。

### provider_health 表（供应商健康状态）

```sql
CREATE TABLE provider_health (
  id INT AUTO_INCREMENT PRIMARY KEY,
  provider_ref VARCHAR(50) UNIQUE NOT NULL COMMENT '供应商标识',
  status ENUM('up', 'down', 'degraded') DEFAULT 'up',
  last_check_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  error_rate DECIMAL(5,2) DEFAULT 0.00 COMMENT '最近错误率（%）',
  avg_response_time INT DEFAULT 0 COMMENT '平均响应时间（ms）',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 降级逻辑

```javascript
// backend/src/services/pipelineEngine.service.js

async function getProvider(step, taskId) {
  const candidates = step.provider_candidates || [step.provider_ref];

  for (const providerRef of candidates) {
    // 1. 查询供应商健康状态
    const health = await db('provider_health')
      .where({ provider_ref: providerRef })
      .first();

    // 2. 如果健康，返回该供应商
    if (health && health.status === 'up') {
      logger.info(`Task ${taskId}: Using provider ${providerRef}`);
      return await getProviderEndpoint(providerRef);
    }

    logger.warn(`Task ${taskId}: Provider ${providerRef} is ${health?.status || 'unknown'}, trying next...`);
  }

  // 3. 所有供应商都不可用
  throw new Error('所有供应商不可用');
}
```

### 示例：多供应商配置

```json
{
  "steps": [
    {
      "name": "image_enhancement",
      "type": "sync_api",
      "provider_candidates": [
        "tencent_cloud_infinite",  // 主供应商
        "aliyun_image_ai",         // 备用1
        "huawei_image_service"     // 备用2
      ],
      "endpoint": "/image/enhance",
      ...
    }
  ]
}
```

---

## 输入输出映射（input_mapping / output_mapping）

### input_mapping 规则

**目的**：将任务输入数据（`input_data`）或上一步输出（`steps[i].output`）映射为当前Step的API参数

**支持的变量**：
- `${input_data.xxx}`：用户表单输入
- `${steps[i].output.xxx}`：前面Step的输出
- `${task_id}`：当前任务ID
- `${user_id}`：当前用户ID
- `${env.XXX}`：环境变量

**示例**：
```json
{
  "input_mapping": {
    "image_url": "${input_data.input_image}",  // 用户上传的图片
    "style": "${input_data.style}",            // 用户选择的风格
    "previous_result": "${steps[0].output.result_url}"  // 上一步的输出
  }
}
```

### output_mapping 规则

**目的**：从供应商API响应中提取关键数据，保存到`task_steps.output`

**支持的提取方式**：
- JSONPath：`$.data.output_url`
- 直接字段：`result_url`

**示例**：
```json
{
  "output_mapping": {
    "result_url": "$.data.output_url",
    "vendor_task_id": "$.task_id",
    "processing_time": "$.metadata.duration"
  }
}
```

**提取后的数据保存到`task_steps.output`**：
```json
{
  "result_url": "https://cos.../output/xxx.jpg",
  "vendor_task_id": "vh123456",
  "processing_time": 3.2
}
```

---

## 完整示例

### 示例1：单步同步Pipeline（服装清理增强）

```json
{
  "name": "basic_clean_pipeline",
  "version": "1.0.0",
  "schema": {
    "steps": [
      {
        "name": "image_processing",
        "type": "sync_api",
        "provider_ref": "tencent_cloud_infinite",
        "provider_candidates": [
          "tencent_cloud_infinite",
          "aliyun_image_ai"
        ],
        "endpoint": "/image/process",
        "input_mapping": {
          "image_url": "${input_data.input_image}",
          "operations": ["cutout", "white_background", "brightness_+20"]
        },
        "output_mapping": {
          "result_url": "$.data.output_url",
          "processing_time": "$.metadata.duration"
        },
        "timeout_seconds": 30,
        "retry": {
          "max_attempts": 3,
          "delay_seconds": 2
        }
      }
    ],
    "on_failure": "refund_quota",
    "max_execution_time": 60
  }
}
```

### 示例2：单步异步Pipeline（AI模特12分镜）

```json
{
  "name": "model_pose12_pipeline",
  "version": "1.0.0",
  "schema": {
    "steps": [
      {
        "name": "ai_model_generation",
        "type": "async_api",
        "provider_ref": "runninghub",
        "provider_candidates": [
          "runninghub",
          "stable_diffusion_api"
        ],
        "endpoint": "/workflow/execute",
        "input_mapping": {
          "image_url": "${input_data.input_image}",
          "workflow_id": "model_pose_12_v2",
          "model_type": "${input_data.model_type}",
          "style": "${input_data.style}"
        },
        "output_mapping": {
          "vendor_task_id": "$.task_id",
          "status": "$.status",
          "result_urls": "$.output_images"
        },
        "polling": {
          "status_endpoint": "/workflow/status/{vendor_task_id}",
          "interval_seconds": 10,
          "max_attempts": 60,
          "complete_statuses": ["success", "completed"],
          "failed_statuses": ["failed", "error", "timeout"]
        },
        "timeout_seconds": 600
      }
    ],
    "on_failure": "refund_quota",
    "max_execution_time": 600
  }
}
```

### 示例3：多步异步Pipeline（上新合辑短片）

```json
{
  "name": "collection_video_pipeline",
  "version": "1.0.0",
  "schema": {
    "steps": [
      {
        "name": "step1_cutout",
        "type": "sync_api",
        "provider_ref": "tencent_cloud_infinite",
        "provider_candidates": ["tencent_cloud_infinite", "aliyun_image_ai"],
        "endpoint": "/image/cutout",
        "input_mapping": {
          "image_urls": "${input_data.product_images}"
        },
        "output_mapping": {
          "cutout_urls": "$.data.results"
        },
        "timeout_seconds": 60
      },
      {
        "name": "step2_video_composite",
        "type": "scf",
        "scf_function": "video-compositor",
        "input_mapping": {
          "image_urls": "${steps[0].output.cutout_urls}",
          "template": "collection_showcase",
          "audio_url": "${input_data.background_music}"
        },
        "output_mapping": {
          "video_url": "$.output.video_url"
        },
        "timeout_seconds": 600,
        "callback_config": {
          "url": "${backend_url}/api/internal/tasks/${task_id}/steps/1/callback",
          "signature_secret": "${env.INTERNAL_CALLBACK_SECRET}"
        }
      },
      {
        "name": "step3_add_watermark",
        "type": "sync_api",
        "provider_ref": "tencent_cloud_vod",
        "provider_candidates": ["tencent_cloud_vod"],
        "endpoint": "/video/watermark",
        "input_mapping": {
          "video_url": "${steps[1].output.video_url}",
          "watermark_url": "${env.WATERMARK_URL}"
        },
        "output_mapping": {
          "final_video_url": "$.data.output_url"
        },
        "timeout_seconds": 120
      }
    ],
    "on_failure": "refund_quota",
    "max_execution_time": 900
  }
}
```

---

## 失败处理和配额返还

### 失败处理规则

1. **任何Step失败立即中断整个Pipeline**
2. **标记任务为`failed`**
3. **根据`on_failure`策略返还配额**
4. **记录错误信息到`task_steps.error_message`**

### 代码示例

```javascript
// backend/src/services/pipelineEngine.service.js

async function executeStep(taskId, step, stepIndex) {
  try {
    // 执行Step逻辑
    const result = await callProviderAPI(step);

    // 保存输出
    await db('task_steps').where({ task_id: taskId, step_index: stepIndex }).update({
      status: 'success',
      output: JSON.stringify(result),
      completed_at: db.fn.now()
    });

  } catch (error) {
    // Step失败处理
    await db('task_steps').where({ task_id: taskId, step_index: stepIndex }).update({
      status: 'failed',
      error_message: error.message,
      completed_at: db.fn.now()
    });

    // 立即中断Pipeline并返还配额
    await handlePipelineFailure(taskId, step.name, error.message);

    throw error;  // 中断执行
  }
}

async function handlePipelineFailure(taskId, stepName, errorMessage) {
  // 1. 标记任务失败
  await db('tasks').where({ id: taskId }).update({
    status: 'failed',
    error_reason: `Step "${stepName}" failed: ${errorMessage}`
  });

  // 2. 返还配额（如果eligible_for_refund=true且未返还）
  const task = await db('tasks').where({ id: taskId }).first();
  if (task.eligible_for_refund && !task.refunded) {
    await quotaService.refundQuota(task.user_id, task.feature_id, taskId);
  }
}
```

---

## SCF回调机制

### 回调接口

```http
POST /api/internal/tasks/:taskId/steps/:stepIndex/callback
Content-Type: application/json
X-Internal-Signature: <HMAC-SHA256签名>
X-Timestamp: <Unix时间戳>

{
  "status": "success",  // "success" | "failed"
  "output": {
    "video_url": "https://cos.../output/video.mp4"
  },
  "error_message": null  // status=failed时填写
}
```

### 签名验证

```javascript
// backend/src/middlewares/verifyInternalSignature.js

function verifyInternalSignature(req, res, next) {
  const signature = req.headers['x-internal-signature'];
  const timestamp = req.headers['x-timestamp'];
  const { taskId, stepIndex } = req.params;

  // 1. 防重放攻击：时间戳在5分钟内
  if (Math.abs(Date.now() - timestamp * 1000) > 5 * 60 * 1000) {
    return res.status(401).json({ error: '签名已过期' });
  }

  // 2. 验证签名
  const payload = `${taskId}${stepIndex}${timestamp}`;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.INTERNAL_CALLBACK_SECRET)
    .update(payload)
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(401).json({ error: '签名验证失败' });
  }

  next();
}
```

### SCF发送回调

```javascript
// scf/video-compositor/index.js

const crypto = require('crypto');
const axios = require('axios');

async function sendCallback(taskId, stepIndex, status, output) {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `${taskId}${stepIndex}${timestamp}`;
  const signature = crypto
    .createHmac('sha256', process.env.INTERNAL_CALLBACK_SECRET)
    .update(payload)
    .digest('hex');

  await axios.post(
    `${process.env.BACKEND_URL}/api/internal/tasks/${taskId}/steps/${stepIndex}/callback`,
    {
      status: status,
      output: output
    },
    {
      headers: {
        'X-Internal-Signature': signature,
        'X-Timestamp': timestamp
      }
    }
  );
}
```

---

## 注意事项 / 禁止事项

### ✅ 必须遵守

1. **必须支持`provider_candidates`多供应商降级**（P0-1问题）
2. **任何Step失败必须立即中断并返还配额**
3. **SCF只能通过回调接口更新状态**（不直接操作数据库）
4. **回调接口必须验证签名**（防止伪造）
5. **所有API调用必须设置超时**（防止无限等待）

### ❌ 禁止操作

1. ❌ **禁止硬编码`provider_ref`而不支持降级**：必须使用`provider_candidates`
2. ❌ **禁止Step失败后继续执行下一步**：必须立即中断
3. ❌ **禁止SCF直接操作数据库**：必须通过回调接口
4. ❌ **禁止跳过签名验证**：安全风险
5. ❌ **禁止修改已上线Pipeline的Step顺序**：会破坏运行中的任务

### ⚠️ 特别警告

- **多供应商降级是生产环境容灾的核心**：必须实现
- **回调签名是内部安全的基础**：必须验证
- **Step失败必须返还配额**：防止用户损失

---

## 数据库迁移示例

```javascript
// backend/src/db/migrations/YYYYMMDDHHMMSS_create_pipeline_schemas.js

exports.up = function(knex) {
  return knex.schema
    .createTable('pipeline_schemas', (table) => {
      table.increments('id').primary();
      table.string('name', 100).notNullable();
      table.string('version', 20).defaultTo('1.0.0');
      table.json('schema').notNullable();
      table.timestamps(true, true);
    })
    .createTable('task_steps', (table) => {
      table.increments('id').primary();
      table.integer('task_id').unsigned().notNullable();
      table.integer('step_index').notNullable();
      table.string('step_name', 100).notNullable();
      table.string('provider_ref', 50);
      table.enum('status', ['pending', 'processing', 'success', 'failed']).defaultTo('pending');
      table.json('input');
      table.json('output');
      table.text('error_message');
      table.timestamp('started_at').nullable();
      table.timestamp('completed_at').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.foreign('task_id').references('tasks.id').onDelete('CASCADE');
      table.index('task_id');
      table.index('status');
    })
    .createTable('provider_health', (table) => {
      table.increments('id').primary();
      table.string('provider_ref', 50).unique().notNullable();
      table.enum('status', ['up', 'down', 'degraded']).defaultTo('up');
      table.timestamp('last_check_at').defaultTo(knex.fn.now());
      table.decimal('error_rate', 5, 2).defaultTo(0.00);
      table.integer('avg_response_time').defaultTo(0);
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('provider_health')
    .dropTableIfExists('task_steps')
    .dropTableIfExists('pipeline_schemas');
};
```

---

## 总结

这个规范定义了后端Pipeline执行流程的完整数据结构，是**任务执行引擎的核心**。

**关键点**：
- ✅ 支持单步/多步、同步/异步Pipeline
- ✅ 支持多供应商降级（容灾）
- ✅ 任何Step失败立即中断并返还配额
- ✅ SCF回调机制安全可靠（签名验证）
- ✅ 完整的输入输出映射规则

**所有Agent在处理Pipeline相关需求时，必须参考本规范！**
