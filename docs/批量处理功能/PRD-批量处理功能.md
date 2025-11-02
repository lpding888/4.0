# PRD - 批量处理功能

> **产品经理**: 老王
> **创建日期**: 2025-10-30
> **优先级**: P1（高优先级）
> **预计工期**: 8-10个工作日

---

## 1️⃣ 需求背景/目标

### 业务背景

当前平台只支持"单张处理"模式，商家用户在批量处理服装图片时体验极差：
- ❌ 50张商品图需要重复操作50次（上传→配置→提交）
- ❌ 配额扣减50次，容易误操作
- ❌ 下载结果需要点击50次
- ❌ 任务列表显示50个任务卡片，找不到想要的

### 竞品对标

| 竞品 | 批量上传 | 批量下载 | 单次限制 |
|------|---------|---------|---------|
| 阿里云图片处理 | ✅ 支持 | ✅ ZIP打包 | 100张 |
| Canva | ✅ 支持 | ✅ 批量导出 | 50张 |
| 美图秀秀企业版 | ✅ 支持 | ✅ 打包下载 | 100张 |
| **咱们平台** | ❌ 不支持 | ❌ 不支持 | 1张 |

### 核心目标

**提升商家批量处理效率，减少重复操作，提升用户满意度。**

**量化指标**：
- 批量处理场景的操作步骤从"N×5步"降低到"5步"（N=图片数量）
- 批量任务完成时间缩短60%（并发处理）
- 用户NPS分数提升15分（目标从60→75）

**不做什么**（红线）：
- ❌ 不破坏现有单张处理功能
- ❌ 不改变计费规则（N张图=N配额）
- ❌ 不支持批量任务中途修改参数
- ❌ 不支持无限制批量（必须限流保护服务器）

---

## 2️⃣ 用户完整使用流程

### 主流程：批量处理服装清理增强

```
用户进入功能页面
    ↓
选择"批量模式"（Tab切换）
    ↓
批量上传图片（拖拽或选择，最多50张）
    ↓
显示上传列表（实时进度条）
    ↓
配置统一参数（所有图片使用相同参数）
    ↓
确认配额消耗弹窗（"本次将消耗50配额，确认吗？"）
    ↓
提交批量任务
    ↓
跳转到批量任务详情页
    ↓
实时显示进度（"已完成5/50，预计剩余2分钟"）
    ↓
处理完成后，显示成功/失败统计
    ↓
批量下载（打包ZIP）或单独下载
    ↓
保存到素材库（成功的图片）
```

### 异常流程

**流程1：上传失败处理**
```
用户上传图片
    ↓
前端验证失败（格式/大小不符）
    ↓
显示红色提示"file1.jpg格式不支持，已移除"
    ↓
继续上传其他图片
```

**流程2：配额不足**
```
用户点击"提交批量任务"
    ↓
后端检查配额（剩余30，需要50）
    ↓
返回错误"配额不足，还需20配额"
    ↓
前端显示续费按钮
```

**流程3：部分失败处理**
```
批量任务处理中
    ↓
50张图中，45张成功，5张失败
    ↓
只返还5配额给用户
    ↓
显示详细失败原因（每张图单独标记）
    ↓
支持"重新处理失败项"
```

**流程4：取消批量任务**
```
用户在处理中点击"取消任务"
    ↓
弹窗确认"已完成5/50，确认取消吗？"
    ↓
确认后停止处理
    ↓
返还未处理图片的配额（45配额）
    ↓
已完成的5张图正常保存
```

---

## 3️⃣ 页面级需求（frontend_dev_skill）

### 3.1 功能卡片改造

**位置**：`/workspace` 工作台页面

**改动**：
- 保留现有"服装清理增强"卡片
- 卡片上新增"批量"角标（Badge）
- 点击卡片跳转到功能页面（支持单张/批量模式切换）

### 3.2 动态表单扩展

**位置**：`/features/[featureId]/form` 动态表单页面

**新增组件**：
- **模式切换Tab**：`<Radio.Group>` 单张模式 / 批量模式
- **批量上传组件**：`<BatchImageUploader>`（复用`MultiImageUploadField`逻辑）
  - 支持拖拽上传
  - 显示上传进度（每张图片单独进度条）
  - 实时验证（格式/大小/数量限制）
  - 支持删除已上传图片

**UI设计**：
```
┌─────────────────────────────────────────┐
│ 服装清理增强                              │
│                                         │
│ [单张模式] [批量模式] ← Tab切换           │
│                                         │
│ ┌─────────────────────────────────┐    │
│ │  批量上传图片（最多50张）         │    │
│ │  ┌───┐ ┌───┐ ┌───┐ ┌───┐        │    │
│ │  │图1│ │图2│ │图3│ │+  │        │    │
│ │  └───┘ └───┘ └───┘ └───┘        │    │
│ │  [删除] [删除] [删除] [点击上传]  │    │
│ └─────────────────────────────────┘    │
│                                         │
│ 已选择: 3张图片 × 1配额 = 3配额           │
│                                         │
│ [生成（消耗3配额）]                      │
└─────────────────────────────────────────┘
```

### 3.3 批量任务详情页

**新增页面**：`/task/batch/[taskId]`

**页面结构**：
```
┌─────────────────────────────────────────┐
│ 批量任务详情                              │
│                                         │
│ 📊 处理进度: 45/50 (90%)                 │
│ ✅ 成功: 43张  ❌ 失败: 2张  ⏳ 处理中: 5张│
│                                         │
│ [全部下载ZIP] [只下载成功] [重试失败项]   │
│                                         │
│ ┌─────────────────────────────────┐    │
│ │ 图片1  ✅ 成功  [下载] [预览]     │    │
│ │ 图片2  ✅ 成功  [下载] [预览]     │    │
│ │ 图片3  ❌ 失败  原因: 格式不支持   │    │
│ │ 图片4  ⏳ 处理中...              │    │
│ │ ...                             │    │
│ └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

**实时更新**：
- 使用轮询（每3秒请求一次`GET /api/tasks/:taskId`）
- 或使用WebSocket推送（优先级P2，后续迭代）

### 3.4 任务列表页改造

**位置**：`/workspace` 或 `/tasks` 任务列表

**改动**：
- 批量任务卡片显示"批量"角标
- 显示总进度"45/50"
- 点击展开子任务列表（Collapse组件）

---

## 4️⃣ 后端接口需求（backend_dev_skill）

### 4.1 数据库迁移

**新建迁移文件**：`backend/src/db/migrations/YYYYMMDDHHMMSS_add_batch_support_to_tasks.js`

```sql
-- 扩展tasks表
ALTER TABLE tasks ADD COLUMN is_batch BOOLEAN DEFAULT FALSE COMMENT '是否为批量任务';
ALTER TABLE tasks ADD COLUMN batch_total INT DEFAULT 1 COMMENT '批量任务总数';
ALTER TABLE tasks ADD COLUMN batch_success INT DEFAULT 0 COMMENT '成功数量';
ALTER TABLE tasks ADD COLUMN batch_failed INT DEFAULT 0 COMMENT '失败数量';
ALTER TABLE tasks ADD COLUMN batch_items JSON DEFAULT NULL COMMENT '批量子任务列表';

-- 索引
CREATE INDEX idx_is_batch ON tasks(is_batch);
```

### 4.2 创建批量任务接口

**接口**：`POST /api/tasks/batch`

**请求体**：
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

**响应**：
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

**核心逻辑**（`backend/src/services/task.service.js`）：

```javascript
async createBatchTask(userId, featureId, inputImages, inputData) {
  // 1. 校验批量数量限制（最多50张）
  if (inputImages.length > 50) {
    throw { errorCode: 4001, message: '批量处理最多支持50张图片' };
  }

  // 2. 计算配额消耗
  const quotaCost = inputImages.length * feature.quota_cost;

  // 3. 在事务中扣配额并创建任务
  return await db.transaction(async (trx) => {
    // 扣减配额
    await quotaService.deduct(userId, quotaCost, trx);

    // 创建批量任务记录
    const taskId = nanoid();
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
      type: featureId,
      inputUrl: inputImages[0], // 兼容性字段
      params: null
    });

    return { taskId, quotaCost, batchTotal: inputImages.length };
  });

  // 4. 异步执行批量Pipeline
  this.processBatchTask(taskId, featureId, inputImages, inputData)
    .catch(err => logger.error(`批量任务异步处理失败: ${err.message}`, { taskId }));
}
```

### 4.3 批量任务处理逻辑

**新增服务**：`backend/src/services/batchProcessor.service.js`

```javascript
class BatchProcessorService {
  async processBatchTask(taskId, featureId, inputImages, inputData) {
    // 更新任务状态为processing
    await db('tasks').where('id', taskId).update({ status: 'processing' });

    // 并发处理所有图片（限制并发数为5）
    const results = await pLimit(inputImages.map((url, index) =>
      this.processItem(taskId, index, featureId, url, inputData)
    ), 5);

    // 统计成功/失败数量
    const success = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed').length;

    // 更新批量任务状态
    await this.updateBatchTaskStatus(taskId, success, failed);

    // 如果有失败，部分返还配额
    if (failed > 0) {
      await this.refundFailedItems(taskId, failed);
    }
  }

  async processItem(taskId, index, featureId, inputUrl, inputData) {
    try {
      // 执行Pipeline处理单张图片
      const result = await pipelineEngine.executeForBatchItem(
        taskId, index, featureId, inputUrl, inputData
      );

      // 更新batch_items中该项的状态
      await this.updateBatchItem(taskId, index, 'success', result.outputUrl);

      return { status: 'success', index, outputUrl: result.outputUrl };
    } catch (error) {
      // 更新batch_items中该项的状态为失败
      await this.updateBatchItem(taskId, index, 'failed', null, error.message);

      return { status: 'failed', index, error: error.message };
    }
  }
}
```

### 4.4 批量下载接口

**接口**：`GET /api/tasks/:taskId/download-zip`

**响应**：
```
Content-Type: application/zip
Content-Disposition: attachment; filename="batch_abc123.zip"

[二进制ZIP文件]
```

**核心逻辑**：
```javascript
async downloadBatchZip(taskId, userId) {
  // 1. 查询批量任务
  const task = await db('tasks').where('id', taskId).first();

  // 2. 权限检查
  if (task.userId !== userId) {
    throw { errorCode: 4003, message: '无权访问该任务' };
  }

  // 3. 获取成功的输出URL列表
  const batchItems = JSON.parse(task.batch_items);
  const successItems = batchItems.filter(item => item.status === 'success');

  // 4. 下载所有图片并打包成ZIP（使用archiver库）
  const zip = archiver('zip');
  for (const item of successItems) {
    const imageBuffer = await downloadImage(item.output_url);
    zip.append(imageBuffer, { name: `result_${item.index + 1}.jpg` });
  }

  return zip.finalize();
}
```

### 4.5 接口清单

| 接口 | 方法 | 路径 | 描述 |
|------|------|------|------|
| 创建批量任务 | POST | `/api/tasks/batch` | 创建批量处理任务 |
| 获取批量任务详情 | GET | `/api/tasks/:taskId` | 查询批量任务进度（复用现有接口） |
| 批量下载ZIP | GET | `/api/tasks/:taskId/download-zip` | 打包下载成功结果 |
| 重试失败项 | POST | `/api/tasks/:taskId/retry-failed` | 重新处理失败的子任务 |
| 取消批量任务 | POST | `/api/tasks/:taskId/cancel` | 取消正在处理的批量任务 |

---

## 5️⃣ 云函数/大文件处理需求（scf_worker_skill）

### 5.1 批量打包ZIP功能

**问题**：50张图片打包可能需要5-10秒，阻塞Node.js主线程。

**方案**：
- 前端请求`POST /api/tasks/:taskId/prepare-zip`
- 后端创建ZIP任务记录，返回`zip_task_id`
- 异步调用SCF云函数处理打包
- 云函数完成后回调后端，更新ZIP下载链接
- 前端轮询获取ZIP下载链接

**不实现**（理由：性能优先级不高）：
- ❌ 不在本次迭代实现SCF打包（可以在后端直接处理，50张图压缩时间可控）
- ❌ 不支持大于100张图的批量（限流保护）

---

## 6️⃣ 计费与配额策略（billing_guard_skill）

### 6.1 配额扣减规则

**核心原则**：批量任务按"实际图片数量"扣配额，不享受折扣。

| 场景 | 图片数量 | 单价 | 总配额 |
|------|---------|------|--------|
| 单张处理 | 1 | 1配额 | 1配额 |
| 批量处理 | 50 | 1配额/张 | 50配额 |

**扣减时机**：
- ✅ 在事务中，任务创建前扣减（防止并发超扣）
- ✅ 使用`FOR UPDATE`行锁（参考`quota.service.js`）

### 6.2 配额返还规则

**场景1：全部失败**
- 用户上传50张图，全部处理失败
- 返还50配额

**场景2：部分失败**
- 用户上传50张图，45张成功，5张失败
- 返还5配额（只返还失败的部分）

**场景3：用户取消任务**
- 用户上传50张图，处理了10张后点击"取消"
- 返还40配额（未处理的部分）
- 已完成的10张不返还

**实现逻辑**：
```javascript
async refundFailedBatchItems(taskId, failedCount) {
  const task = await db('tasks').where('id', taskId).first();
  const quotaToRefund = failedCount * task.quota_cost_per_item;

  return await quotaService.refund(
    taskId,
    task.userId,
    quotaToRefund,
    `批量任务部分失败返还:${failedCount}项`
  );
}
```

### 6.3 限流策略

**批量任务限流**：
```json
{
  "rate_limit_policy": {
    "max_per_hour": 5,        // 每小时最多5个批量任务
    "max_per_day": 20,        // 每天最多20个批量任务
    "max_images_per_batch": 50 // 单次批量最多50张
  }
}
```

**防滥用机制**：
- ✅ 单次批量最多50张（硬限制）
- ✅ 每小时最多5个批量任务（防止恶意刷量）
- ✅ 批量任务也计入总任务数限流

### 6.4 特别警告

⚠️ **批量任务的配额消耗可能很大（50配额），必须在前端明确提示用户！**

**前端确认弹窗**：
```
┌─────────────────────────────────┐
│ 确认批量处理                     │
│                                 │
│ 图片数量: 50张                   │
│ 配额单价: 1配额/张                │
│ 总消耗: 50配额                   │
│                                 │
│ 当前剩余: 100配额                │
│ 处理后剩余: 50配额               │
│                                 │
│ [取消] [确认生成]                │
└─────────────────────────────────┘
```

---

## 7️⃣ 验收标准（qa_acceptance_skill）

### 7.1 功能验收

| 测试用例 | 操作步骤 | 预期结果 | 优先级 |
|---------|---------|---------|--------|
| 批量上传 | 拖拽10张JPG图片 | 显示10张缩略图，允许删除 | P0 |
| 格式验证 | 上传1张GIF图 | 红色提示"不支持GIF格式"，自动移除 | P0 |
| 数量限制 | 上传51张图片 | 提示"最多支持50张"，自动保留前50张 | P0 |
| 配额扣减 | 提交10张图批量任务 | 配额从100→90，任务创建成功 | P0 |
| 配额不足 | 剩余5配额，提交10张图 | 提示"配额不足，还需5配额"，显示续费按钮 | P0 |
| 批量处理 | 提交10张图批量任务 | 任务状态更新为processing，显示进度"3/10" | P0 |
| 部分失败 | 10张图中5张格式错误 | 成功5张，失败5张，返还5配额 | P0 |
| 批量下载 | 点击"下载ZIP" | 下载batch_xxx.zip，包含5张成功图片 | P0 |
| 任务列表 | 查看任务列表 | 批量任务显示"批量"角标，显示"5/10"进度 | P1 |
| 重试失败 | 点击"重试失败项" | 重新处理5张失败图片，扣减5配额 | P1 |
| 取消任务 | 处理中点击"取消" | 停止处理，返还未处理项配额 | P2 |

### 7.2 性能验收

| 指标 | 目标值 | 测试方法 |
|------|--------|---------|
| 批量上传响应时间 | <5秒（50张图） | 实际上传50张图，记录总耗时 |
| 批量任务创建时间 | <2秒 | 提交批量任务到返回taskId的时间 |
| 单张图处理时间 | <10秒 | Pipeline执行时间（已有） |
| 批量任务完成时间 | <5分钟（50张图） | 50张图并发处理总耗时 |
| ZIP打包时间 | <10秒（50张图） | 点击下载到文件开始下载的时间 |

### 7.3 安全验收

| 验收项 | 检查方法 | 预期结果 |
|--------|---------|---------|
| 配额并发安全 | 10个请求同时提交批量任务 | 配额扣减准确，不会超扣 |
| 重复返还防护 | 手动调用2次refund接口 | 第二次返回"已返还过配额" |
| 权限校验 | 用户A查询用户B的批量任务 | 返回403错误"无权访问" |
| 文件大小限制 | 上传单张20MB图片 | 前端拦截"图片不能超过10MB" |

### 7.4 兼容性验收

| 验收项 | 检查方法 | 预期结果 |
|--------|---------|---------|
| 单张模式保持可用 | 切换到"单张模式"，上传1张图 | 正常提交，创建单张任务 |
| 旧任务列表兼容 | 查询历史单张任务 | 正常显示，不受批量功能影响 |
| 素材库保存 | 批量任务成功后 | 成功图片自动保存到素材库 |

---

## 8️⃣ 任务卡清单

### 【任务卡-批量处理-01】数据库迁移

**负责技能**: backend_dev_skill

**优先级**: P0（最高）

**工作量**: 0.5天

**描述**:
1. 创建迁移文件`YYYYMMDDHHMMSS_add_batch_support_to_tasks.js`
2. 扩展`tasks`表字段（`is_batch`, `batch_total`, `batch_success`, `batch_failed`, `batch_items`）
3. 添加索引`idx_is_batch`
4. 运行迁移并验证

**验收标准**:
- ✅ `npm run db:migrate:latest`成功执行
- ✅ `tasks`表包含5个新字段
- ✅ `batch_items`字段类型为JSON

---

### 【任务卡-批量处理-02】批量上传组件开发

**负责技能**: frontend_dev_skill

**优先级**: P0

**工作量**: 1.5天

**描述**:
1. 新建`<BatchImageUploader>`组件（位于`frontend/src/components/`）
2. 支持拖拽上传多张图片
3. 实时显示上传进度（每张图单独进度条）
4. 前端验证（格式/大小/数量限制）
5. 支持删除已上传图片
6. 显示配额消耗预览（"3张图 × 1配额 = 3配额"）

**验收标准**:
- ✅ 拖拽10张图片，显示10个进度条
- ✅ 上传GIF图片，显示红色提示并自动移除
- ✅ 上传51张图片，提示"最多50张"
- ✅ 配额消耗计算准确

---

### 【任务卡-批量处理-03】动态表单扩展（单张/批量模式切换）

**负责技能**: frontend_dev_skill

**优先级**: P0

**工作量**: 1天

**描述**:
1. 修改`<DynamicForm>`组件，支持单张/批量模式Tab切换
2. 批量模式时，显示`<BatchImageUploader>`
3. 单张模式时，显示原有`<ImageUploadField>`
4. 提交按钮显示不同文案（"生成（消耗1配额）" vs "生成（消耗10配额）"）
5. 确认弹窗显示详细配额消耗

**验收标准**:
- ✅ Tab切换流畅，UI切换正确
- ✅ 批量模式提交，调用`POST /api/tasks/batch`
- ✅ 单张模式提交，调用`POST /api/tasks`（现有接口）
- ✅ 确认弹窗显示"本次将消耗10配额，剩余90配额"

---

### 【任务卡-批量处理-04】批量任务创建接口

**负责技能**: backend_dev_skill

**优先级**: P0

**工作量**: 2天

**描述**:
1. 新增`POST /api/tasks/batch`接口
2. 实现`taskService.createBatchTask()`方法
3. 校验批量数量限制（最多50张）
4. 在事务中扣配额并创建批量任务记录
5. 初始化`batch_items` JSON字段
6. 异步调用批量处理逻辑

**验收标准**:
- ✅ 提交10张图批量任务，返回`task_id`
- ✅ `tasks`表记录`is_batch=true, batch_total=10`
- ✅ 配额从100扣减到90
- ✅ 提交51张图，返回400错误"最多支持50张"

---

### 【任务卡-批量处理-05】批量任务处理逻辑

**负责技能**: backend_dev_skill

**优先级**: P0

**工作量**: 3天

**描述**:
1. 新建`batchProcessor.service.js`
2. 实现`processBatchTask()`方法（并发处理多张图）
3. 使用`p-limit`库限制并发数为5
4. 实现`processItem()`方法（处理单张图）
5. 复用现有`pipelineEngine`执行Pipeline
6. 更新`batch_items`字段（每项的status/output_url）
7. 统计成功/失败数量，更新`batch_success/batch_failed`
8. 部分失败时，调用`quotaService.refund()`返还配额

**验收标准**:
- ✅ 提交10张图批量任务，全部处理成功，`batch_success=10`
- ✅ 提交10张图，5张格式错误，`batch_success=5, batch_failed=5`
- ✅ 5张失败图片返还5配额
- ✅ `batch_items` JSON正确记录每项状态

---

### 【任务卡-批量处理-06】批量任务详情页

**负责技能**: frontend_dev_skill

**优先级**: P0

**工作量**: 2天

**描述**:
1. 新建页面`/task/batch/[taskId]`
2. 显示批量任务进度（"45/50 (90%)"）
3. 显示成功/失败统计
4. 列表显示每张图片的处理状态（成功/失败/处理中）
5. 支持单独下载每张图片
6. 支持批量下载ZIP
7. 支持"重试失败项"按钮
8. 实时轮询更新进度（每3秒）

**验收标准**:
- ✅ 批量任务处理中，显示"5/10 (50%)"
- ✅ 成功图片显示绿色√，失败显示红色×
- ✅ 点击"下载"按钮，下载对应图片
- ✅ 点击"全部下载ZIP"，下载打包文件
- ✅ 轮询3秒更新一次进度

---

### 【任务卡-批量处理-07】批量下载ZIP接口

**负责技能**: backend_dev_skill

**优先级**: P1

**工作量**: 1.5天

**描述**:
1. 新增`GET /api/tasks/:taskId/download-zip`接口
2. 查询批量任务的`batch_items`字段
3. 筛选出成功的输出URL列表
4. 使用`archiver`库打包成ZIP
5. 流式返回ZIP文件

**验收标准**:
- ✅ 批量任务10张图成功，下载ZIP包含10张图
- ✅ 批量任务5张成功5张失败，ZIP只包含5张成功图
- ✅ ZIP文件名格式为`batch_任务ID.zip`

---

### 【任务卡-批量处理-08】任务列表页改造

**负责技能**: frontend_dev_skill

**优先级**: P1

**工作量**: 1天

**描述**:
1. 修改任务列表页（`/workspace` 或 `/tasks`）
2. 批量任务卡片显示"批量"角标（Badge）
3. 显示批量进度（"45/50"）
4. 点击展开/收起子任务列表（Collapse组件）

**验收标准**:
- ✅ 批量任务显示"批量"蓝色角标
- ✅ 显示进度"45/50 (90%)"
- ✅ 点击展开，显示50张图片的子项列表

---

### 【任务卡-批量处理-09】重试失败项接口

**负责技能**: backend_dev_skill

**优先级**: P1

**工作量**: 1天

**描述**:
1. 新增`POST /api/tasks/:taskId/retry-failed`接口
2. 查询`batch_items`中状态为`failed`的子项
3. 重新调用Pipeline处理这些子项
4. 扣减对应的配额（失败项数量 × 单价）
5. 更新`batch_items`字段

**验收标准**:
- ✅ 批量任务5张失败，点击"重试失败项"
- ✅ 扣减5配额，重新处理5张图
- ✅ 重试成功后，`batch_success`从5更新到10

---

### 【任务卡-批量处理-10】取消批量任务接口

**负责技能**: backend_dev_skill

**优先级**: P2（低优先级）

**工作量**: 1天

**描述**:
1. 新增`POST /api/tasks/:taskId/cancel`接口
2. 停止正在处理的子任务
3. 统计未处理的子项数量
4. 返还未处理子项的配额
5. 已完成的子项正常保存

**验收标准**:
- ✅ 批量任务处理到5/50时点击取消
- ✅ 返还45配额
- ✅ 已完成的5张图保存到素材库
- ✅ 任务状态更新为`cancelled`

---

### 【任务卡-批量处理-11】限流策略配置

**负责技能**: backend_dev_skill + billing_guard_skill

**优先级**: P0

**工作量**: 0.5天

**描述**:
1. 修改`feature_definitions`表，更新批量功能的`rate_limit_policy`
2. 设置`max_per_hour=5, max_per_day=20, max_images_per_batch=50`
3. 在`checkFeatureRateLimit`中间件中验证批量限流

**验收标准**:
- ✅ 1小时内提交6个批量任务，第6个返回429错误
- ✅ 提交51张图批量任务，返回400错误

---

### 【任务卡-批量处理-12】QA测试和修复

**负责技能**: qa_acceptance_skill

**优先级**: P0

**工作量**: 2天

**描述**:
1. 按照第7节"验收标准"执行所有测试用例
2. 记录Bug清单
3. 协助开发团队修复Bug
4. 回归测试验证修复

**验收标准**:
- ✅ 所有P0测试用例通过
- ✅ 至少90% P1测试用例通过
- ✅ 性能指标达标

---

## 9️⃣ 总结给老板

### 核心价值

老板你好，老王我给你规划了一个批量处理功能，解决商家"重复操作50次"的痛点。

**用户价值**：
- ⏱️ 操作时间从"10分钟"降低到"2分钟"（效率提升80%）
- 😊 用户满意度预计提升15分（NPS从60→75）
- 💰 批量处理场景下，用户更愿意多消耗配额（营收机会）

**技术方案**：
- 采用"批量任务模式"（1个任务记录对应N张图）
- 复用现有Pipeline架构，无需重构
- 并发处理5张图，提升处理速度
- 支持部分失败返还配额（风险可控）

**资源投入**：
- 开发工期：8-10个工作日
- 技术风险：低（复用现有架构）
- 投入成本：约2个后端+1个前端+1个QA的工作量

**商业模式**：
- 不破坏现有计费规则（N张图=N配额）
- 限流保护服务器（单次最多50张）
- 未来可以推出"批量VIP会员"（单次100张，优先处理）

**竞品对比**：
| 功能 | 咱们平台 | 阿里云 | Canva |
|------|---------|--------|-------|
| 批量上传 | ✅ 50张 | ✅ 100张 | ✅ 50张 |
| 批量下载 | ✅ ZIP | ✅ ZIP | ✅ 批量导出 |
| 失败重试 | ✅ 支持 | ❌ 不支持 | ❌ 不支持 |
| 部分返还 | ✅ 支持 | ❌ 不支持 | ❌ 不支持 |

**上线建议**：
- 第1周：完成P0任务卡（核心功能）
- 第2周：完成P1任务卡（优化功能）+ QA测试
- 第3周：小流量灰度测试（10%用户）
- 第4周：全量上线

**风险提示**：
- ⚠️ 批量任务可能导致服务器负载增加（需监控CPU/内存）
- ⚠️ ZIP打包可能影响响应时间（建议后续迁移到SCF云函数）
- ⚠️ 配额大量消耗可能导致用户投诉（需做好前端提示）

---

**Product Planner**: 老王
**最后更新**: 2025-10-30
**文档版本**: v1.0.0
