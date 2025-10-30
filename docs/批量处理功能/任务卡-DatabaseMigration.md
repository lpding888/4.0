# 任务卡:数据库迁移 - 批量处理功能

> **负责技能**:backend_dev_skill
> **功能模块**:批量处理功能
> **任务类型**:数据库表结构扩展
> **优先级**:P0

---

## 任务目标

扩展`tasks`表以支持批量任务功能,新增字段用于记录批量任务的元信息和子任务列表。

---

## 目录范围

### ✅ 可修改
- `backend/src/db/migrations/YYYYMMDDHHMMSS_add_batch_support_to_tasks.js`(新建)

### ❌ 禁止修改
- 已有的迁移文件(不允许修改历史迁移)
- `tasks`表现有字段(只能新增,不能修改)

---

## 产出物清单

### 1. 迁移文件
- `YYYYMMDDHHMMSS_add_batch_support_to_tasks.js` - 扩展tasks表

---

## 核心技术要求

### 迁移脚本

```javascript
// backend/src/db/migrations/YYYYMMDDHHMMSS_add_batch_support_to_tasks.js

exports.up = function(knex) {
  return knex.schema.table('tasks', (table) => {
    // 批量任务标识
    table.boolean('is_batch')
      .defaultTo(false)
      .notNullable()
      .comment('是否为批量任务');

    // 批量任务统计
    table.integer('batch_total')
      .defaultTo(1)
      .notNullable()
      .comment('批量任务总数');

    table.integer('batch_success')
      .defaultTo(0)
      .notNullable()
      .comment('成功数量');

    table.integer('batch_failed')
      .defaultTo(0)
      .notNullable()
      .comment('失败数量');

    // 批量子任务列表(JSON)
    table.json('batch_items')
      .nullable()
      .comment('批量子任务列表,每项包含input_url/status/output_url/error_message');

    // 索引
    table.index('is_batch', 'idx_is_batch');
  });
};

exports.down = function(knex) {
  return knex.schema.table('tasks', (table) => {
    table.dropIndex('is_batch', 'idx_is_batch');
    table.dropColumn('is_batch');
    table.dropColumn('batch_total');
    table.dropColumn('batch_success');
    table.dropColumn('batch_failed');
    table.dropColumn('batch_items');
  });
};
```

---

## batch_items字段结构

### JSON Schema

```json
[
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
  },
  {
    "index": 2,
    "input_url": "https://cos.../input3.jpg",
    "status": "pending",
    "output_url": null,
    "error_message": null
  }
]
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `index` | INT | 子任务序号(从0开始) |
| `input_url` | STRING | 输入图片URL |
| `status` | ENUM | 状态:`pending`/`processing`/`success`/`failed` |
| `output_url` | STRING | 输出图片URL(成功时有值) |
| `error_message` | STRING | 错误信息(失败时有值) |

---

## 扩展后的tasks表结构

```sql
CREATE TABLE tasks (
  id VARCHAR(50) PRIMARY KEY,
  userId VARCHAR(50) NOT NULL,
  feature_id VARCHAR(50) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status ENUM('pending','processing','success','failed','cancelled') NOT NULL,

  -- 单张任务字段
  inputUrl VARCHAR(255),
  params JSON,
  resultUrls JSON,
  errorMessage TEXT,
  errorReason VARCHAR(255),

  -- 批量任务字段(新增)
  is_batch BOOLEAN DEFAULT FALSE NOT NULL COMMENT '是否为批量任务',
  batch_total INT DEFAULT 1 NOT NULL COMMENT '批量任务总数',
  batch_success INT DEFAULT 0 NOT NULL COMMENT '成功数量',
  batch_failed INT DEFAULT 0 NOT NULL COMMENT '失败数量',
  batch_items JSON COMMENT '批量子任务列表',

  -- 配额返还字段
  eligible_for_refund BOOLEAN DEFAULT TRUE,
  refunded BOOLEAN DEFAULT FALSE,
  refunded_at TIMESTAMP NULL,

  -- 时间戳
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,

  -- 索引
  INDEX idx_userId (userId),
  INDEX idx_status (status),
  INDEX idx_is_batch (is_batch),
  FOREIGN KEY (userId) REFERENCES users(id)
);
```

---

## 向后兼容性保证

### 单张任务兼容性

所有新增字段都有默认值,确保现有单张任务逻辑不受影响:

```javascript
// 单张任务插入示例(无需修改现有代码)
await db('tasks').insert({
  id: taskId,
  userId,
  feature_id: featureId,
  status: 'pending',
  inputUrl: imageUrl,
  params: JSON.stringify(params)
  // is_batch自动设为false
  // batch_total自动设为1
  // batch_success/batch_failed自动设为0
});
```

### 批量任务示例

```javascript
// 批量任务插入示例
await db('tasks').insert({
  id: taskId,
  userId,
  feature_id: featureId,
  status: 'pending',
  is_batch: true,
  batch_total: 10,
  batch_success: 0,
  batch_failed: 0,
  batch_items: JSON.stringify([
    { index: 0, input_url: 'url1', status: 'pending', output_url: null, error_message: null },
    { index: 1, input_url: 'url2', status: 'pending', output_url: null, error_message: null },
    // ...
  ])
});
```

---

## 数据库约束

### 必须满足的约束

1. **is_batch=false时**:
   - `batch_total = 1`
   - `batch_items IS NULL`

2. **is_batch=true时**:
   - `batch_total > 1`
   - `batch_items IS NOT NULL`
   - `batch_success + batch_failed <= batch_total`

### 数据一致性检查SQL

```sql
-- 检查1:批量任务的batch_items不能为空
SELECT * FROM tasks
WHERE is_batch = true AND batch_items IS NULL;
-- 预期结果:0行

-- 检查2:批量任务的batch_total必须>1
SELECT * FROM tasks
WHERE is_batch = true AND batch_total <= 1;
-- 预期结果:0行

-- 检查3:成功+失败不能超过总数
SELECT * FROM tasks
WHERE is_batch = true AND (batch_success + batch_failed) > batch_total;
-- 预期结果:0行
```

---

## 验证清单

### 迁移执行验证
- [ ] `npm run db:migrate:latest`成功执行,无报错
- [ ] `tasks`表包含5个新字段
- [ ] `batch_items`字段类型为JSON
- [ ] 索引`idx_is_batch`创建成功

### 向后兼容性验证
- [ ] 插入单张任务,`is_batch`自动设为`false`
- [ ] 查询历史单张任务,新字段都有默认值
- [ ] 单张任务的现有逻辑不受影响

### 批量任务验证
- [ ] 插入批量任务,`is_batch=true`
- [ ] `batch_items` JSON格式正确
- [ ] 数据一致性检查SQL全部通过

---

## 回滚方案

如果迁移出现问题,执行回滚:

```bash
npm run db:migrate:down
```

回滚后`tasks`表恢复到原有结构,批量任务相关字段被删除。

**⚠️ 警告**:回滚会丢失所有批量任务数据,请谨慎操作！

---

## 交付方式

```bash
cd backend
npm run db:migrate:latest
git add src/db/migrations/YYYYMMDDHHMMSS_add_batch_support_to_tasks.js
git commit -m "feat(db): add batch support to tasks table"
git push origin develop
```

---

## 预计工作量

**预计时间**:0.5天

**细分**:
- 编写迁移脚本:1小时
- 本地测试验证:1小时
- 开发环境部署:0.5小时
- 数据一致性检查:0.5小时

---

**任务卡结束**
