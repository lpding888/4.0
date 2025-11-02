# 任务卡:后端开发 - 批量处理功能

> **负责技能**:backend_dev_skill
> **功能模块**:批量处理功能
> **任务类型**:后端接口开发
> **优先级**:P0

---

## 任务目标

实现批量处理功能的后端接口,包括批量任务创建、批量任务处理逻辑、批量下载ZIP、重试失败项、取消任务等功能。

---

## 目录范围

### ✅ 可修改
- `backend/src/controllers/task.controller.js`(新增方法)
- `backend/src/services/task.service.js`(新增方法)
- `backend/src/services/batchProcessor.service.js`(新建)
- `backend/src/services/pipelineEngine.service.js`(新增方法)
- `backend/src/routes/task.routes.js`(新增路由)
- `backend/package.json`(新增依赖)

### ❌ 禁止修改
- `backend/src/services/quota.service.js`(配额逻辑,只调用不修改)
- `backend/src/services/cos.service.js`(COS服务)
- `backend/src/services/feature.service.js`(功能卡片逻辑)

---

## 产出物清单

### 1. 批量任务接口(用户端)
- `POST /api/tasks/batch` - 创建批量任务
- `GET /api/tasks/:taskId` - 查询批量任务详情(复用现有接口,扩展返回字段)
- `GET /api/tasks/:taskId/download-zip` - 批量下载ZIP
- `POST /api/tasks/:taskId/retry-failed` - 重试失败项
- `POST /api/tasks/:taskId/cancel` - 取消批量任务

### 2. Service层
- `batchProcessor.service.js`(新建) - 批量任务处理核心逻辑
- `task.service.js` - 新增`createBatchTask()`、`processBatchTask()`等方法
- `pipelineEngine.service.js` - 新增`executeForBatchItem()`方法

### 3. 依赖包
- `p-limit` - 控制并发数
- `archiver` - ZIP打包
- `axios` - 下载图片

---

## 核心技术要求

### 1. 创建批量任务接口

```javascript
// backend/src/controllers/task.controller.js

async createBatchTask(req, res, next) {
  try {
    const { feature_id, input_images, input_data } = req.body;
    const userId = req.user.id;

    // 1. 校验批量数量限制
    if (!input_images || !Array.isArray(input_images)) {
      return res.status(400).json({
        success: false,
        errorCode: 4001,
        message: 'input_images必须是数组'
      });
    }

    if (input_images.length === 0) {
      return res.status(400).json({
        success: false,
        errorCode: 4001,
        message: '至少需要上传1张图片'
      });
    }

    if (input_images.length > 50) {
      return res.status(400).json({
        success: false,
        errorCode: 4001,
        message: '批量处理最多支持50张图片'
      });
    }

    // 2. 调用Service创建批量任务
    const result = await taskService.createBatchTask(
      userId,
      feature_id,
      input_images,
      input_data || {}
    );

    res.json({
      success: true,
      data: {
        task_id: result.taskId,
        batch_total: result.batchTotal,
        quota_cost: result.quotaCost,
        created_at: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error(`[TaskController] 创建批量任务失败: ${error.message}`, { error });
    next(error);
  }
}
```

### 2. 批量任务创建逻辑(Service层)

```javascript
// backend/src/services/task.service.js

const { nanoid } = require('nanoid');
const quotaService = require('./quota.service');
const featureService = require('./feature.service');
const batchProcessor = require('./batchProcessor.service');

/**
 * 创建批量任务
 */
async createBatchTask(userId, featureId, inputImages, inputData) {
  let taskId;
  try {
    // 1. 获取功能定义
    const feature = await db('feature_definitions')
      .where('feature_id', featureId)
      .whereNull('deleted_at')
      .first();

    if (!feature) {
      throw { errorCode: 4004, message: '功能不存在' };
    }

    if (!feature.is_enabled) {
      throw { errorCode: 4003, message: '功能已禁用' };
    }

    // 2. 检查用户权限
    const hasAccess = await featureService.checkUserAccess(userId, feature);
    if (!hasAccess) {
      throw { errorCode: 4003, message: '无权使用该功能' };
    }

    // 3. 检查限流(复用现有中间件逻辑)
    const rateLimitResult = await checkFeatureRateLimit(
      featureId,
      feature.rate_limit_policy,
      userId
    );

    if (!rateLimitResult.allowed) {
      throw {
        errorCode: 4029,
        message: '请求过于频繁，请稍后再试',
        rateLimitInfo: {
          resetAt: rateLimitResult.resetAt,
          remaining: rateLimitResult.remaining
        }
      };
    }

    // 4. 计算配额消耗
    const quotaCost = inputImages.length * feature.quota_cost;

    // 5. 在事务中扣配额并创建任务
    const result = await db.transaction(async (trx) => {
      // 扣减配额
      await quotaService.deduct(userId, quotaCost, trx);

      // 创建批量任务记录
      taskId = nanoid();
      const batchItems = inputImages.map((url, index) => ({
        index,
        input_url: url,
        status: 'pending',
        output_url: null,
        error_message: null
      }));

      await trx('tasks').insert({
        id: taskId,
        userId,
        feature_id: featureId,
        status: 'pending',
        is_batch: true,
        batch_total: inputImages.length,
        batch_success: 0,
        batch_failed: 0,
        batch_items: JSON.stringify(batchItems),
        input_data: JSON.stringify(inputData),
        eligible_for_refund: true,
        refunded: false,
        created_at: new Date(),
        updated_at: new Date(),
        // 兼容性字段
        type: featureId,
        inputUrl: inputImages[0],
        params: null
      });

      return { taskId, quotaCost, batchTotal: inputImages.length };
    });

    logger.info(
      `[TaskService] 批量任务创建成功 taskId=${taskId} userId=${userId} ` +
      `featureId=${featureId} total=${inputImages.length} quotaCost=${quotaCost}`
    );

    // 6. 异步执行批量Pipeline(不阻塞响应)
    batchProcessor.processBatchTask(taskId, featureId, inputImages, inputData)
      .catch(err => {
        logger.error(
          `[TaskService] 批量任务异步处理失败 taskId=${taskId} error=${err.message}`,
          { taskId, error: err }
        );
      });

    return result;

  } catch (error) {
    logger.error(
      `[TaskService] 创建批量任务失败: ${error.message}`,
      { userId, featureId, error }
    );
    throw error;
  }
}
```

### 3. 批量任务处理核心逻辑

```javascript
// backend/src/services/batchProcessor.service.js

const pLimit = require('p-limit');
const db = require('../config/database');
const pipelineEngine = require('./pipelineEngine.service');
const quotaService = require('./quota.service');
const logger = require('../utils/logger');

class BatchProcessorService {
  /**
   * 处理批量任务
   */
  async processBatchTask(taskId, featureId, inputImages, inputData) {
    try {
      logger.info(`[BatchProcessor] 开始处理批量任务 taskId=${taskId} total=${inputImages.length}`);

      // 1. 更新任务状态为processing
      await db('tasks').where('id', taskId).update({
        status: 'processing',
        updated_at: new Date()
      });

      // 2. 并发处理所有图片(限制并发数为5)
      const limit = pLimit(5);
      const promises = inputImages.map((url, index) =>
        limit(() => this.processItem(taskId, index, featureId, url, inputData))
      );

      const results = await Promise.all(promises);

      // 3. 统计成功/失败数量
      const success = results.filter(r => r.status === 'success').length;
      const failed = results.filter(r => r.status === 'failed').length;

      logger.info(
        `[BatchProcessor] 批量任务处理完成 taskId=${taskId} ` +
        `success=${success} failed=${failed}`
      );

      // 4. 更新批量任务整体状态
      await this.updateBatchTaskStatus(taskId, success, failed);

      // 5. 如果有失败,部分返还配额
      if (failed > 0) {
        await this.refundFailedItems(taskId, failed);
      }

    } catch (error) {
      logger.error(
        `[BatchProcessor] 批量任务处理失败 taskId=${taskId} error=${error.message}`,
        { taskId, error }
      );
      // 更新任务状态为failed
      await db('tasks').where('id', taskId).update({
        status: 'failed',
        updated_at: new Date()
      });
    }
  }

  /**
   * 处理单张图片
   */
  async processItem(taskId, index, featureId, inputUrl, inputData) {
    try {
      logger.info(`[BatchProcessor] 处理子任务 taskId=${taskId} index=${index}`);

      // 调用Pipeline处理单张图片
      const result = await pipelineEngine.executeForBatchItem(
        taskId,
        index,
        featureId,
        inputUrl,
        inputData
      );

      // 更新batch_items中该项的状态为成功
      await this.updateBatchItem(taskId, index, 'success', result.outputUrl, null);

      return { status: 'success', index, outputUrl: result.outputUrl };

    } catch (error) {
      logger.error(
        `[BatchProcessor] 子任务处理失败 taskId=${taskId} index=${index} ` +
        `error=${error.message}`
      );

      // 更新batch_items中该项的状态为失败
      await this.updateBatchItem(taskId, index, 'failed', null, error.message);

      return { status: 'failed', index, error: error.message };
    }
  }

  /**
   * 更新batch_items中单个子项的状态
   */
  async updateBatchItem(taskId, index, status, outputUrl, errorMessage) {
    const task = await db('tasks').where('id', taskId).first();
    const batchItems = JSON.parse(task.batch_items);

    batchItems[index] = {
      ...batchItems[index],
      status,
      output_url: outputUrl,
      error_message: errorMessage
    };

    await db('tasks')
      .where('id', taskId)
      .update({
        batch_items: JSON.stringify(batchItems),
        updated_at: new Date()
      });
  }

  /**
   * 更新批量任务整体状态
   */
  async updateBatchTaskStatus(taskId, success, failed) {
    const total = success + failed;

    await db('tasks')
      .where('id', taskId)
      .update({
        status: failed === 0 ? 'success' : 'partial_success',
        batch_success: success,
        batch_failed: failed,
        completed_at: new Date(),
        updated_at: new Date()
      });

    logger.info(
      `[BatchProcessor] 批量任务状态更新 taskId=${taskId} ` +
      `status=${failed === 0 ? 'success' : 'partial_success'}`
    );
  }

  /**
   * 返还失败项配额
   */
  async refundFailedItems(taskId, failedCount) {
    const task = await db('tasks').where('id', taskId).first();
    const feature = await db('feature_definitions')
      .where('feature_id', task.feature_id)
      .first();

    const quotaToRefund = failedCount * feature.quota_cost;

    const result = await quotaService.refund(
      taskId,
      task.userId,
      quotaToRefund,
      `批量任务部分失败返还:${failedCount}项`
    );

    if (result.refunded) {
      logger.info(
        `[BatchProcessor] 失败项配额返还成功 taskId=${taskId} ` +
        `failedCount=${failedCount} refunded=${quotaToRefund}`
      );
    }
  }
}

module.exports = new BatchProcessorService();
```

### 4. Pipeline扩展(支持批量子项)

```javascript
// backend/src/services/pipelineEngine.service.js

/**
 * 执行Pipeline(批量子项专用)
 */
async executeForBatchItem(taskId, itemIndex, featureId, inputUrl, inputData) {
  // 1. 获取Pipeline Schema
  const feature = await db('feature_definitions')
    .where('feature_id', featureId)
    .first();

  const pipelineSchema = await db('pipeline_schemas')
    .where('pipeline_id', feature.pipeline_schema_ref)
    .first();

  // 2. 执行Pipeline步骤
  const steps = pipelineSchema.steps;
  let stepResults = {};

  for (const step of steps) {
    const result = await this.executeStep(
      taskId,
      itemIndex,
      step,
      inputUrl,
      inputData,
      stepResults
    );
    stepResults[step.name] = result;
  }

  // 3. 返回最终输出URL
  const finalStep = steps[steps.length - 1];
  return {
    outputUrl: stepResults[finalStep.name].outputUrl
  };
}

/**
 * 执行单个Pipeline步骤(批量子项专用)
 */
async executeStep(taskId, itemIndex, step, inputUrl, inputData, stepResults) {
  // 复用现有executeStep逻辑,但日志中加上itemIndex标识
  logger.info(
    `[PipelineEngine] 执行步骤 taskId=${taskId} itemIndex=${itemIndex} ` +
    `step=${step.name}`
  );

  // ... 现有executeStep逻辑 ...
}
```

### 5. 批量下载ZIP接口

```javascript
// backend/src/controllers/task.controller.js

const archiver = require('archiver');
const axios = require('axios');

async downloadBatchZip(req, res, next) {
  const { taskId } = req.params;
  const userId = req.user.id;
  const { successOnly = 'true' } = req.query;

  try {
    // 1. 查询批量任务
    const task = await db('tasks').where('id', taskId).first();

    // 2. 权限检查
    if (!task) {
      return res.status(404).json({
        success: false,
        errorCode: 4004,
        message: '任务不存在'
      });
    }

    if (task.userId !== userId) {
      return res.status(403).json({
        success: false,
        errorCode: 4003,
        message: '无权访问该任务'
      });
    }

    if (!task.is_batch) {
      return res.status(400).json({
        success: false,
        errorCode: 4001,
        message: '该任务不是批量任务'
      });
    }

    // 3. 获取输出URL列表
    const batchItems = JSON.parse(task.batch_items);
    const targetItems = successOnly === 'true'
      ? batchItems.filter(item => item.status === 'success')
      : batchItems.filter(item => item.output_url);

    if (targetItems.length === 0) {
      return res.status(400).json({
        success: false,
        errorCode: 4001,
        message: '没有可下载的文件'
      });
    }

    // 4. 设置响应头
    const zipFilename = `batch_${taskId}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

    // 5. 创建ZIP流
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    // 6. 下载所有图片并添加到ZIP
    for (const item of targetItems) {
      try {
        const response = await axios.get(item.output_url, {
          responseType: 'arraybuffer',
          timeout: 30000
        });
        const filename = `result_${item.index + 1}.jpg`;
        archive.append(Buffer.from(response.data), { name: filename });

        logger.info(`[TaskController] 添加到ZIP taskId=${taskId} index=${item.index}`);
      } catch (error) {
        logger.error(
          `[TaskController] 下载图片失败 url=${item.output_url} error=${error.message}`
        );
        // 跳过该图片,继续打包其他图片
      }
    }

    // 7. 完成打包
    await archive.finalize();

    logger.info(`[TaskController] 批量下载ZIP成功 taskId=${taskId} files=${targetItems.length}`);

  } catch (error) {
    logger.error(`[TaskController] 批量下载ZIP失败 taskId=${taskId} error=${error.message}`, { error });
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        errorCode: 5000,
        message: '下载失败'
      });
    }
  }
}
```

### 6. 重试失败项接口

```javascript
// backend/src/controllers/task.controller.js

async retryFailedItems(req, res, next) {
  const { taskId } = req.params;
  const userId = req.user.id;

  try {
    // 1. 查询批量任务
    const task = await db('tasks').where('id', taskId).first();

    // 2. 权限检查
    if (!task || task.userId !== userId) {
      return res.status(403).json({
        success: false,
        errorCode: 4003,
        message: '无权访问该任务'
      });
    }

    if (!task.is_batch) {
      return res.status(400).json({
        success: false,
        errorCode: 4001,
        message: '该任务不是批量任务'
      });
    }

    // 3. 获取失败的子项
    const batchItems = JSON.parse(task.batch_items);
    const failedItems = batchItems.filter(item => item.status === 'failed');

    if (failedItems.length === 0) {
      return res.status(400).json({
        success: false,
        errorCode: 4001,
        message: '没有失败的子任务需要重试'
      });
    }

    // 4. 计算需要扣减的配额
    const feature = await db('feature_definitions')
      .where('feature_id', task.feature_id)
      .first();
    const quotaCost = failedItems.length * feature.quota_cost;

    // 5. 检查配额是否足够
    const hasEnough = await quotaService.checkQuota(userId, quotaCost);
    if (!hasEnough) {
      return res.status(403).json({
        success: false,
        errorCode: 1003,
        message: '配额不足，请充值'
      });
    }

    // 6. 在事务中扣配额
    await db.transaction(async (trx) => {
      await quotaService.deduct(userId, quotaCost, trx);
    });

    // 7. 重新处理失败项(异步)
    taskService.retryFailedItemsAsync(taskId, failedItems, task.feature_id, task.input_data)
      .catch(err => logger.error(
        `[TaskController] 重试失败项异常 taskId=${taskId} error=${err.message}`
      ));

    res.json({
      success: true,
      message: `已重新提交${failedItems.length}个失败项`,
      quota_cost: quotaCost
    });

  } catch (error) {
    logger.error(`[TaskController] 重试失败项接口失败 taskId=${taskId} error=${error.message}`, { error });
    next(error);
  }
}
```

---

## 接口详细设计

### 1. POST /api/tasks/batch

**请求体**:
```json
{
  "feature_id": "basic_clean",
  "input_images": [
    "https://cos.../input1.jpg",
    "https://cos.../input2.jpg",
    "https://cos.../input3.jpg"
  ],
  "input_data": {
    "brightness": 10,
    "contrast": 5
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "task_id": "batch_abc123",
    "batch_total": 3,
    "quota_cost": 3,
    "created_at": "2025-10-30T10:00:00Z"
  }
}
```

### 2. GET /api/tasks/:taskId

**响应示例(批量任务)**:
```json
{
  "success": true,
  "data": {
    "id": "batch_abc123",
    "userId": "user_123",
    "feature_id": "basic_clean",
    "status": "processing",
    "is_batch": true,
    "batch_total": 10,
    "batch_success": 5,
    "batch_failed": 2,
    "batch_items": [
      {
        "index": 0,
        "input_url": "https://cos.../input1.jpg",
        "status": "success",
        "output_url": "https://cos.../output1.jpg",
        "error_message": null
      },
      {
        "index": 1,
        "input_url": "https://cos.../input2.jpg",
        "status": "failed",
        "output_url": null,
        "error_message": "图片格式不支持"
      }
    ],
    "createdAt": "2025-10-30T10:00:00Z",
    "updatedAt": "2025-10-30T10:05:00Z"
  }
}
```

### 3. GET /api/tasks/:taskId/download-zip

**Query参数**:
- `successOnly`: boolean (默认true,只下载成功的)

**响应**:
```
Content-Type: application/zip
Content-Disposition: attachment; filename="batch_abc123.zip"

[二进制ZIP文件]
```

### 4. POST /api/tasks/:taskId/retry-failed

**响应示例**:
```json
{
  "success": true,
  "message": "已重新提交5个失败项",
  "quota_cost": 5
}
```

### 5. POST /api/tasks/:taskId/cancel

**响应示例**:
```json
{
  "success": true,
  "message": "任务已取消，返还45配额",
  "refund_amount": 45
}
```

---

## 依赖包安装

```bash
cd backend
npm install p-limit archiver axios
```

**package.json新增依赖**:
```json
{
  "dependencies": {
    "p-limit": "^4.0.0",
    "archiver": "^6.0.0",
    "axios": "^1.6.0"
  }
}
```

---

## 路由配置

```javascript
// backend/src/routes/task.routes.js

const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// 批量任务路由
router.post('/batch', authenticate, taskController.createBatchTask);
router.get('/:taskId/download-zip', authenticate, taskController.downloadBatchZip);
router.post('/:taskId/retry-failed', authenticate, taskController.retryFailedItems);
router.post('/:taskId/cancel', authenticate, taskController.cancelBatchTask);

module.exports = router;
```

---

## 禁止事项

### ❌ 严格禁止
1. 不允许前端传入`batch_items`字段(必须后端生成)
2. 不允许批量任务绕过限流检查
3. 不允许在非事务环境中扣配额
4. 不允许批量任务跳过权限校验
5. 不允许重复返还配额(必须检查`refunded`字段)
6. 不允许批量任务影响单张任务的现有逻辑

---

## 验证清单

### 功能测试
- [ ] 提交10张图批量任务,返回task_id
- [ ] tasks表记录is_batch=true,batch_total=10
- [ ] 配额从100扣减到90
- [ ] 批量任务处理中,batch_items字段实时更新
- [ ] 10张图全部成功,batch_success=10,status=success
- [ ] 10张图5张失败,batch_success=5,batch_failed=5,status=partial_success
- [ ] 5张失败返还5配额
- [ ] 批量下载ZIP包含所有成功图片
- [ ] 重试失败项,扣减对应配额并重新处理

### 边界测试
- [ ] 提交0张图,返回400错误"至少需要上传1张图片"
- [ ] 提交51张图,返回400错误"最多支持50张"
- [ ] 配额不足时,返回403错误"配额不足"
- [ ] 重试失败项时配额不足,返回403错误
- [ ] 下载ZIP时没有成功文件,返回400错误

### 并发安全测试
- [ ] 10个请求同时提交批量任务,配额扣减准确
- [ ] 批量任务处理中同时调用多次重试失败项,只扣一次配额
- [ ] 批量任务处理中同时调用取消,配额返还准确

### 性能测试
- [ ] 批量任务创建时间<2秒
- [ ] 50张图批量处理总耗时<5分钟
- [ ] ZIP打包50张图耗时<10秒
- [ ] 并发5个批量任务不影响服务器响应

---

## 交付方式

```bash
cd backend
git add src/controllers/task.controller.js
git add src/services/task.service.js
git add src/services/batchProcessor.service.js
git add src/services/pipelineEngine.service.js
git add src/routes/task.routes.js
git add package.json
git commit -m "feat(backend): implement batch task processing APIs"
git push origin develop
```

---

## 预计工作量

**预计时间**:5天

**细分**:
- 批量任务创建接口:0.5天
- 批量任务处理逻辑:2天
- 批量下载ZIP接口:1天
- 重试失败项接口:0.5天
- 取消任务接口:0.5天
- 测试和Bug修复:0.5天

---

**任务卡结束**
