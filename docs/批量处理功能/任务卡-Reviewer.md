# 任务卡:代码审查 - 批量处理功能

> **负责技能**:reviewer_skill
> **功能模块**:批量处理功能
> **任务类型**:代码质量审查
> **优先级**:P0

---

## 任务目标

对批量处理功能的所有代码变更进行全面审查,确保代码质量、安全性、性能、可维护性符合项目标准,防止技术债务累积。

---

## 审查范围

### ✅ 必须审查
- 数据库迁移脚本
- 后端API和服务层代码
- 前端组件和页面
- 配额扣减/返还逻辑
- 并发控制和错误处理
- 类型定义和接口设计
- 代码复用和重复代码

### ❌ 不在审查范围
- UI设计美观性
- 产品需求合理性(PM负责)
- 测试用例编写(QA负责)

---

## 核心审查标准

### 1. KISS原则审查(简单至上)

**✅ 合格标准**:
- 函数职责单一,易于理解
- 避免过度抽象和复杂设计
- 代码逻辑直观,减少嵌套层级
- 命名清晰,见名知意

**❌ 不合格场景**:
```javascript
// ❌ 错误示例:过度复杂的嵌套逻辑
async function processBatchTask(taskId, featureId, inputImages, inputData) {
  try {
    if (inputImages && inputImages.length > 0) {
      for (let i = 0; i < inputImages.length; i++) {
        if (inputImages[i]) {
          try {
            const result = await processItem(inputImages[i]);
            if (result) {
              if (result.success) {
                // 5层嵌套,憨批代码
              }
            }
          } catch (e) {
            // ...
          }
        }
      }
    }
  } catch (error) {
    // ...
  }
}

// ✅ 正确示例:简洁清晰
async function processBatchTask(taskId, featureId, inputImages, inputData) {
  if (!inputImages || inputImages.length === 0) {
    throw new Error('批量任务没有输入图片');
  }

  const limiter = pLimit(5);
  const tasks = inputImages.map((image, index) =>
    limiter(() => processItem(taskId, image, index))
  );

  const results = await Promise.allSettled(tasks);
  return results;
}
```

### 2. DRY原则审查(杜绝重复)

**✅ 合格标准**:
- 复用现有的工具函数和服务
- 相似逻辑提取为公共方法
- 避免复制粘贴代码

**❌ 不合格场景**:
```javascript
// ❌ 错误示例:重复的配额扣减逻辑
// task.service.js - create方法
const quotaCost = feature.quota_cost;
const userQuota = await db('users').where({ id: userId }).first();
if (userQuota.quota_remaining < quotaCost) {
  throw new Error('配额不足');
}
await db('users').where({ id: userId }).decrement('quota_remaining', quotaCost);

// task.service.js - createBatchTask方法
const batchQuotaCost = inputImages.length * feature.quota_cost;
const userQuota = await db('users').where({ id: userId }).first();
if (userQuota.quota_remaining < batchQuotaCost) {
  throw new Error('配额不足');
}
await db('users').where({ id: userId }).decrement('quota_remaining', batchQuotaCost);

// ✅ 正确示例:复用quota.service.js
const quotaCost = feature.quota_cost;
await quotaService.deduct(userId, quotaCost, trx);

const batchQuotaCost = inputImages.length * feature.quota_cost;
await quotaService.deduct(userId, batchQuotaCost, trx);
```

### 3. YAGNI原则审查(精益求精)

**✅ 合格标准**:
- 只实现当前需要的功能
- 避免预留未来可能的扩展点
- 删除未使用的代码和依赖

**❌ 不合格场景**:
```javascript
// ❌ 错误示例:预留未来功能
interface BatchTask {
  id: string;
  is_batch: boolean;
  batch_total: number;
  batch_success: number;
  batch_failed: number;
  batch_items: BatchItem[];

  // ❌ 这些字段现在用不到,想太多了
  future_pricing_model?: 'per_image' | 'per_batch' | 'subscription';
  future_concurrency_limit?: number;
  future_priority_queue?: 'high' | 'normal' | 'low';
}

// ✅ 正确示例:只定义当前需要的
interface BatchTask {
  id: string;
  is_batch: boolean;
  batch_total: number;
  batch_success: number;
  batch_failed: number;
  batch_items: BatchItem[];
}
```

### 4. SOLID原则审查

#### S - 单一职责原则

**✅ 合格**:每个函数/类只负责一件事

```javascript
// ✅ 正确示例:职责单一
// batchProcessor.service.js
async function processBatchTask(taskId, featureId, inputImages, inputData) {
  await updateTaskStatus(taskId, 'processing');
  const results = await processAllItems(taskId, featureId, inputImages, inputData);
  await updateBatchResults(taskId, results);
  await refundFailedItems(taskId, results);
}

// 每个函数职责明确
async function processAllItems(taskId, featureId, inputImages, inputData) { /* ... */ }
async function updateBatchResults(taskId, results) { /* ... */ }
async function refundFailedItems(taskId, results) { /* ... */ }
```

**❌ 不合格**:一个函数干了太多事

```javascript
// ❌ 错误示例:违反单一职责
async function processBatchTask(taskId, featureId, inputImages, inputData) {
  // 1. 更新状态
  await db('tasks').where({ id: taskId }).update({ status: 'processing' });

  // 2. 获取功能定义
  const feature = await db('feature_definitions').where({ feature_id: featureId }).first();

  // 3. 处理所有图片
  for (let i = 0; i < inputImages.length; i++) {
    const result = await pipeline.execute(feature.pipeline_schema, { input_url: inputImages[i] });
    await db('tasks').where({ id: taskId }).update({ batch_items: JSON.stringify(items) });
  }

  // 4. 计算成功失败
  const success = items.filter(i => i.status === 'success').length;
  await db('tasks').where({ id: taskId }).update({ batch_success: success });

  // 5. 返还配额
  const quotaToRefund = (items.length - success) * feature.quota_cost;
  await db('users').where({ id: userId }).increment('quota_remaining', quotaToRefund);

  // 艹,这个SB函数干了5件事,太乱了!
}
```

#### O - 开闭原则

**✅ 合格**:通过扩展pipeline_schema支持新功能,不修改核心代码

```javascript
// ✅ 正确示例:pipeline扩展
// pipelineEngine.service.js
async function executeForBatchItem(pipelineSchema, inputData, itemIndex) {
  // 只增加了itemIndex参数,不修改核心execute逻辑
  return await execute(pipelineSchema, { ...inputData, itemIndex });
}
```

#### L - 里氏替换原则

**✅ 合格**:批量任务完全兼容单张任务接口

```javascript
// ✅ 正确示例:批量任务可以替换单张任务
// task.service.js
async function getById(taskId, userId) {
  const task = await db('tasks').where({ id: taskId, userId }).first();

  // 单张和批量任务返回相同结构,只是字段值不同
  if (task.is_batch) {
    return { ...task, batch_items: JSON.parse(task.batch_items) };
  } else {
    return task;
  }
}
```

#### I - 接口隔离原则

**✅ 合格**:批量上传组件接口专一,不臃肿

```typescript
// ✅ 正确示例:接口专一
interface BatchImageUploaderProps {
  value: string[];
  onChange: (urls: string[]) => void;
  maxCount?: number;
  quotaCostPerImage?: number;
}

// ❌ 错误示例:胖接口(包含了太多不相关的属性)
interface BatchImageUploaderProps {
  value: string[];
  onChange: (urls: string[]) => void;
  maxCount?: number;
  quotaCostPerImage?: number;
  enableZipDownload?: boolean;  // ❌ 下载不是上传组件的职责
  showRetryButton?: boolean;    // ❌ 重试不是上传组件的职责
  autoRefundOnFail?: boolean;   // ❌ 配额管理不是上传组件的职责
}
```

#### D - 依赖倒置原则

**✅ 合格**:依赖抽象的service,不依赖具体实现

```javascript
// ✅ 正确示例:依赖quotaService抽象
const quotaService = require('./quota.service');
await quotaService.deduct(userId, quotaCost, trx);

// ❌ 错误示例:直接操作数据库(依赖具体实现)
await db('users').where({ id: userId }).decrement('quota_remaining', quotaCost);
```

---

## 安全审查清单

### P0级别(阻塞上线)

- [ ] **P0-1:配额并发安全**
  - 配额扣减使用`FOR UPDATE`行锁
  - 配额扣减和任务创建在同一事务中
  - 配额返还检查`refunded`字段,防止重复返还

```javascript
// ✅ 正确示例
await db.transaction(async (trx) => {
  const user = await trx('users')
    .where({ id: userId })
    .forUpdate()  // 行锁,防止并发问题
    .first();

  if (user.quota_remaining < quotaCost) {
    throw new Error('配额不足');
  }

  await trx('users')
    .where({ id: userId })
    .decrement('quota_remaining', quotaCost);

  await trx('tasks').insert({
    userId,
    featureId,
    is_batch: true,
    batch_total: inputImages.length
  });
});
```

- [ ] **P0-2:权限校验**
  - 所有批量任务API检查`userId`匹配
  - 防止用户A访问用户B的批量任务

```javascript
// ✅ 正确示例
async function getBatchTaskById(taskId, userId) {
  const task = await db('tasks')
    .where({ id: taskId, userId })  // 必须同时匹配userId
    .first();

  if (!task) {
    throw new ForbiddenError('无权访问该任务');
  }

  return task;
}
```

- [ ] **P0-3:输入验证**
  - 批量图片数量限制(≤50张)
  - 文件类型验证(JPG/PNG)
  - 文件大小验证(≤10MB)

```javascript
// ✅ 正确示例
async function createBatchTask(userId, featureId, inputImages, inputData) {
  // 验证图片数量
  if (!inputImages || inputImages.length === 0) {
    throw new BadRequestError('批量任务至少需要1张图片');
  }
  if (inputImages.length > 50) {
    throw new BadRequestError('批量任务最多支持50张图片');
  }

  // 验证图片URL格式
  for (const url of inputImages) {
    if (!url.startsWith('https://')) {
      throw new BadRequestError('图片URL必须为HTTPS');
    }
  }

  // ...
}
```

### P1级别(建议修复)

- [ ] **P1-1:敏感信息泄露**
  - API响应不返回内部字段(vendorTaskId等)
  - 错误信息不暴露技术细节

```javascript
// ✅ 正确示例
async function getBatchTaskById(taskId, userId) {
  const task = await db('tasks')
    .select('id', 'status', 'batch_total', 'batch_success', 'batch_failed', 'batch_items')
    .where({ id: taskId, userId })
    .first();

  return task;  // 不返回vendorTaskId, internal_notes等内部字段
}
```

- [ ] **P1-2:日志安全**
  - 不记录用户上传的图片URL
  - 不记录敏感的inputData

---

## 性能审查清单

- [ ] **并发控制**
  - 使用p-limit限制并发数(5个)
  - 避免并发过高导致服务器崩溃

```javascript
// ✅ 正确示例
const pLimit = require('p-limit');
const limiter = pLimit(5);

const tasks = inputImages.map((image, index) =>
  limiter(() => processItem(taskId, image, index))
);

const results = await Promise.allSettled(tasks);
```

- [ ] **数据库查询优化**
  - 批量更新使用单次事务
  - 避免N+1查询

```javascript
// ❌ 错误示例:N次更新(性能差)
for (const item of batchItems) {
  await db('tasks').where({ id: taskId }).update({
    batch_items: JSON.stringify(batchItems)
  });
}

// ✅ 正确示例:1次更新
await db('tasks').where({ id: taskId }).update({
  batch_success,
  batch_failed,
  batch_items: JSON.stringify(batchItems)
});
```

- [ ] **JSON字段大小控制**
  - batch_items最多50项,单项<1KB
  - 总JSON字段<50KB

---

## 代码质量审查清单

### 错误处理

- [ ] 所有异步函数使用try-catch
- [ ] 错误信息对用户友好
- [ ] 错误日志包含足够上下文

```javascript
// ✅ 正确示例
async function processBatchTask(taskId, featureId, inputImages, inputData) {
  try {
    await updateTaskStatus(taskId, 'processing');
    const results = await processAllItems(taskId, featureId, inputImages, inputData);
    await updateBatchResults(taskId, results);
  } catch (error) {
    logger.error('批量任务处理失败', {
      taskId,
      featureId,
      imageCount: inputImages.length,
      error: error.message,
      stack: error.stack
    });

    await updateTaskStatus(taskId, 'failed');
    throw new InternalServerError('批量任务处理失败,请稍后重试');
  }
}
```

### 类型定义

- [ ] 所有TypeScript接口定义完整
- [ ] 避免使用`any`类型
- [ ] 复杂类型提取为单独文件

```typescript
// ✅ 正确示例
// types/task.ts
export interface BatchItem {
  index: number;
  input_url: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  output_url: string | null;
  error_message: string | null;
}

export interface BatchTask {
  id: string;
  userId: string;
  featureId: string;
  is_batch: boolean;
  batch_total: number;
  batch_success: number;
  batch_failed: number;
  batch_items: BatchItem[];
}
```

### 命名规范

- [ ] 函数名动词开头(createBatchTask, processBatchTask)
- [ ] 变量名见名知意(quotaCost不是qc)
- [ ] 常量全大写(MAX_BATCH_SIZE)

### 注释规范

- [ ] 复杂逻辑添加注释
- [ ] 公共函数添加JSDoc

```javascript
/**
 * 处理批量任务
 * @param {string} taskId - 批量任务ID
 * @param {string} featureId - 功能ID
 * @param {string[]} inputImages - 输入图片URL数组
 * @param {object} inputData - 通用输入参数
 * @returns {Promise<void>}
 */
async function processBatchTask(taskId, featureId, inputImages, inputData) {
  // ...
}
```

---

## 架构合规性审查

- [ ] **不破坏现有架构**
  - 批量功能基于现有feature_definitions
  - 复用现有pipeline_schema
  - 不修改单张任务逻辑

- [ ] **数据库迁移可逆**
  - 迁移脚本提供rollback方法
  - 新增字段有默认值

```javascript
// ✅ 正确示例
exports.up = function(knex) {
  return knex.schema.table('tasks', (table) => {
    table.boolean('is_batch').defaultTo(false).notNullable();
    table.integer('batch_total').defaultTo(1).notNullable();
  });
};

exports.down = function(knex) {
  return knex.schema.table('tasks', (table) => {
    table.dropColumn('is_batch');
    table.dropColumn('batch_total');
  });
};
```

- [ ] **前端组件复用**
  - 批量上传组件基于现有ImageUploader
  - 批量详情页复用TaskDetailCard

---

## 代码审查流程

### 审查步骤

1. **数据库迁移审查**(30分钟)
   - 阅读迁移脚本
   - 检查字段类型和默认值
   - 验证索引设计
   - 确认rollback方法

2. **后端代码审查**(2小时)
   - 阅读所有新增的service方法
   - 检查配额扣减/返还逻辑
   - 验证并发控制
   - 审查错误处理
   - 检查权限校验

3. **前端代码审查**(1.5小时)
   - 阅读新增组件
   - 检查类型定义
   - 验证表单验证逻辑
   - 审查API调用

4. **SOLID原则检查**(1小时)
   - 检查是否违反单一职责
   - 查找重复代码
   - 验证依赖注入

5. **安全审查**(1小时)
   - 配额并发安全测试
   - 权限校验测试
   - 输入验证测试

### 审查输出

```markdown
## 批量处理功能 - 代码审查报告

### 审查日期
2025-10-XX

### 审查结论
[ ] ✅ 通过 - 无问题
[ ] ⚠️ 通过(有建议) - 有改进建议但不影响上线
[ ] ❌ 不通过 - 有严重问题必须修复

### 发现问题

#### P0(阻塞上线)
- [ ] P0-1: 配额扣减未使用FOR UPDATE行锁
  - 文件: backend/src/services/task.service.js:123
  - 问题: 并发场景下可能超扣配额
  - 修复建议: 在事务中使用.forUpdate()

#### P1(建议修复)
- [ ] P1-1: processBatchTask函数过长(150行)
  - 文件: backend/src/services/batchProcessor.service.js:45
  - 问题: 违反单一职责原则
  - 修复建议: 拆分为processAllItems、updateResults、refundQuota三个函数

#### P2(可选优化)
- [ ] P2-1: 批量下载ZIP可以使用流式传输
  - 文件: backend/src/controllers/task.controller.js:234
  - 问题: 大文件会占用内存
  - 修复建议: 使用archiver的pipe方法直接流式传输

### 代码质量评分
- 安全性: 85/100
- 性能: 90/100
- 可维护性: 80/100
- 代码规范: 95/100

### Reviewer签字
Reviewer: [签名]
日期: 2025-10-XX
```

---

## 禁止事项

### ❌ 严格禁止
1. 跳过配额并发安全审查
2. 跳过权限校验审查
3. 允许重复代码通过审查
4. 允许违反SOLID原则的代码通过审查
5. 允许无错误处理的异步代码
6. 允许使用`any`类型的TypeScript代码

---

## 预计工作量

**预计时间**:1天

**细分**:
- 数据库迁移审查:0.5小时
- 后端代码审查:2小时
- 前端代码审查:1.5小时
- SOLID原则检查:1小时
- 安全审查:1小时
- 编写审查报告:2小时

---

**任务卡结束**
