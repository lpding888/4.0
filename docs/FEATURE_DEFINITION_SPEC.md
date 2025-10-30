# FEATURE_DEFINITION_SPEC.md - 功能定义规范

## 文档目的

本文档定义功能卡片（Feature）的数据结构规范，供所有技能包Agent参考。

**适用场景**：
- Product Planner设计新功能时，定义feature_definitions表数据
- Backend Dev实现功能时，理解feature_definitions表结构
- Frontend Dev渲染工作台时，理解功能卡片数据源
- Billing Guard审查时，验证计费策略是否正确
- Reviewer审查时，检查功能定义是否完整合规

---

## 核心概念

### 什么是Feature？

Feature是平台上的一个**独立功能模块**，对应工作台上的一张功能卡片。例如：
- "服装清理增强"（主图抠图+白底+提亮）
- "AI模特12分镜"（生成12张不同角度的模特展示图）
- "促销海报生成"（商品图+促销文案→活动海报）

每个Feature有：
- **唯一标识**：`feature_id`（如`basic_clean`）
- **展示信息**：标题、描述、图标
- **权限控制**：谁能看到、谁能用
- **计费规则**：需要多少配额、限流策略
- **表单定义**：用户需要填什么参数
- **处理流程**：后端怎么执行（pipeline_schema）

---

## 数据库表结构

### feature_definitions 表

```sql
CREATE TABLE feature_definitions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  feature_id VARCHAR(50) UNIQUE NOT NULL COMMENT '功能唯一标识',

  -- 展示信息
  title VARCHAR(100) NOT NULL COMMENT '功能标题',
  description TEXT COMMENT '功能描述',
  icon_url VARCHAR(255) COMMENT '功能图标URL',
  category VARCHAR(50) COMMENT '功能分类（图像/视频/文案等）',

  -- 权限控制
  access_scope ENUM('plan', 'whitelist') DEFAULT 'plan' COMMENT '访问范围：plan=套餐权限，whitelist=白名单',
  plan_required VARCHAR(50) COMMENT '所需套餐（PRO/PREMIUM/null表示所有会员）',
  allowed_accounts TEXT COMMENT '白名单账号列表（JSON数组字符串，仅access_scope=whitelist时有效）',
  is_enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用',

  -- 计费规则
  quota_cost INT DEFAULT 1 COMMENT '消耗配额次数（0表示免费，需红色警告）',
  rate_limit_policy JSON COMMENT '限流策略（max_per_hour/max_per_day）',

  -- 关联配置
  form_schema_id INT COMMENT '关联的表单Schema ID',
  pipeline_schema_id INT COMMENT '关联的Pipeline Schema ID',

  -- 素材库
  save_to_asset_library BOOLEAN DEFAULT TRUE COMMENT '成功任务是否自动保存到素材库',

  -- 排序和状态
  display_order INT DEFAULT 0 COMMENT '显示顺序（越小越靠前）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL COMMENT '软删除时间戳',

  -- 外键约束
  FOREIGN KEY (form_schema_id) REFERENCES form_schemas(id),
  FOREIGN KEY (pipeline_schema_id) REFERENCES pipeline_schemas(id)
);

-- 索引
CREATE INDEX idx_access_scope ON feature_definitions(access_scope);
CREATE INDEX idx_is_enabled ON feature_definitions(is_enabled);
CREATE INDEX idx_deleted_at ON feature_definitions(deleted_at);
```

---

## 字段定义详解

| 字段名 | 类型 | 是否必填 | 含义 | 示例 |
|--------|------|----------|------|------|
| `feature_id` | VARCHAR(50) | ✅ 必填 | 功能唯一标识，蛇形命名法 | `basic_clean`、`model_pose12` |
| `title` | VARCHAR(100) | ✅ 必填 | 前端展示的功能标题 | "服装清理增强"、"AI模特12分镜" |
| `description` | TEXT | 可选 | 功能描述，前端卡片副标题 | "一键抠图+白底+提亮，直接用于电商主图" |
| `icon_url` | VARCHAR(255) | 可选 | 功能图标URL（COS路径） | `https://cos.../icons/basic_clean.svg` |
| `category` | VARCHAR(50) | 可选 | 功能分类（用于分组） | `image`、`video`、`text` |
| `access_scope` | ENUM | ✅ 必填 | 访问范围：`plan`=套餐权限，`whitelist`=白名单 | `plan`（默认） |
| `plan_required` | VARCHAR(50) | 可选 | 所需套餐等级（`null`表示所有会员） | `PRO`、`PREMIUM`、`null` |
| `allowed_accounts` | TEXT | 可选 | 白名单账号JSON数组（仅`access_scope=whitelist`时有效） | `["user123", "user456"]` |
| `is_enabled` | BOOLEAN | ✅ 必填 | 功能是否启用（前端根据此字段过滤） | `true`、`false` |
| `quota_cost` | INT | ✅ 必填 | 每次任务消耗配额次数（**0表示免费，需警告**） | `1`、`2`、`0`（危险） |
| `rate_limit_policy` | JSON | 可选 | 限流策略对象 | `{"max_per_hour": 10, "max_per_day": 100}` |
| `form_schema_id` | INT | ✅ 必填 | 关联的表单Schema ID | `1`、`2` |
| `pipeline_schema_id` | INT | ✅ 必填 | 关联的Pipeline Schema ID | `1`、`2` |
| `save_to_asset_library` | BOOLEAN | ✅ 必填 | 成功任务是否自动保存到素材库 | `true`、`false` |
| `display_order` | INT | ✅ 必填 | 前端显示顺序（越小越靠前） | `0`、`10`、`20` |
| `deleted_at` | TIMESTAMP | 可选 | 软删除时间戳（`null`表示未删除） | `null`、`2025-10-30 12:00:00` |

---

## access_scope 权限模式详解

### 模式1：plan（套餐权限）

**适用场景**：大部分功能，根据用户套餐等级控制访问

**规则**：
- `access_scope = 'plan'`
- `plan_required` 可以是：
  - `null`：所有付费会员可见
  - `PRO`：仅PRO及以上会员可见
  - `PREMIUM`：仅PREMIUM会员可见

**示例**：
```json
{
  "feature_id": "basic_clean",
  "access_scope": "plan",
  "plan_required": null,  // 所有会员可见
  "allowed_accounts": null
}
```

### 模式2：whitelist（白名单）

**适用场景**：灰度测试、内部测试、定制功能

**规则**：
- `access_scope = 'whitelist'`
- `allowed_accounts` 必须是JSON数组字符串
- 只有在白名单中的`user_id`或`account_id`能看到该功能
- `plan_required` 字段无效

**示例**：
```json
{
  "feature_id": "video_generation_beta",
  "access_scope": "whitelist",
  "plan_required": null,  // 无效
  "allowed_accounts": "[\"user_12345\", \"user_67890\"]"
}
```

---

## rate_limit_policy 限流策略

### JSON结构

```json
{
  "max_per_hour": 10,    // 每小时最多创建10个任务
  "max_per_day": 100,    // 每天最多创建100个任务
  "cooldown_seconds": 60 // 两次请求最小间隔60秒（可选）
}
```

### 字段说明

| 字段 | 类型 | 是否必填 | 含义 |
|------|------|----------|------|
| `max_per_hour` | INT | 可选 | 每小时最大任务数 |
| `max_per_day` | INT | 可选 | 每天最大任务数 |
| `cooldown_seconds` | INT | 可选 | 两次请求最小间隔（秒） |

### 示例

```json
// 高成本功能：严格限流
{
  "max_per_hour": 5,
  "max_per_day": 20,
  "cooldown_seconds": 300
}

// 普通功能：宽松限流
{
  "max_per_hour": 50,
  "max_per_day": 500
}

// 无限流
null
```

---

## 完整示例

### 示例1：服装清理增强（基础功能）

```json
{
  "feature_id": "basic_clean",
  "title": "服装清理增强",
  "description": "一键抠图+白底+提亮，3秒生成电商主图",
  "icon_url": "https://cos.example.com/icons/basic_clean.svg",
  "category": "image",

  "access_scope": "plan",
  "plan_required": null,  // 所有会员可用
  "allowed_accounts": null,
  "is_enabled": true,

  "quota_cost": 1,
  "rate_limit_policy": {
    "max_per_hour": 50,
    "max_per_day": 500
  },

  "form_schema_id": 1,
  "pipeline_schema_id": 1,
  "save_to_asset_library": true,
  "display_order": 0
}
```

### 示例2：AI模特12分镜（高级功能）

```json
{
  "feature_id": "model_pose12",
  "title": "AI模特12分镜",
  "description": "生成12张不同角度的模特展示图，5分钟交付",
  "icon_url": "https://cos.example.com/icons/model_pose12.svg",
  "category": "image",

  "access_scope": "plan",
  "plan_required": "PRO",  // 仅PRO及以上会员
  "allowed_accounts": null,
  "is_enabled": true,

  "quota_cost": 2,  // 消耗2次配额
  "rate_limit_policy": {
    "max_per_hour": 10,
    "max_per_day": 50,
    "cooldown_seconds": 300
  },

  "form_schema_id": 2,
  "pipeline_schema_id": 2,
  "save_to_asset_library": true,
  "display_order": 10
}
```

### 示例3：视频生成（Beta灰度测试）

```json
{
  "feature_id": "video_generation_beta",
  "title": "服装视频生成（测试中）",
  "description": "上传静态图，生成15秒动态展示视频",
  "icon_url": "https://cos.example.com/icons/video_gen.svg",
  "category": "video",

  "access_scope": "whitelist",  // 白名单模式
  "plan_required": null,  // 无效
  "allowed_accounts": "[\"user_12345\", \"user_67890\", \"user_test001\"]",
  "is_enabled": true,

  "quota_cost": 5,  // 消耗5次配额
  "rate_limit_policy": {
    "max_per_hour": 3,
    "max_per_day": 10
  },

  "form_schema_id": 10,
  "pipeline_schema_id": 10,
  "save_to_asset_library": true,
  "display_order": 100
}
```

---

## 使用场景

### Product Planner设计新功能

1. 确定功能定位（所有会员 / PRO会员 / 白名单测试）
2. 定义`feature_id`（蛇形命名）
3. 编写`title`和`description`（用户可见）
4. 设置`quota_cost`（根据成本评估）
5. 设计`rate_limit_policy`（防止滥用）
6. 关联`form_schema_id`和`pipeline_schema_id`

### Backend Dev实现功能

1. 读取`feature_definitions`表
2. 根据`access_scope`和`plan_required`校验权限
3. 根据`quota_cost`扣减配额
4. 根据`rate_limit_policy`检查限流
5. 调用对应的`pipeline_schema`执行任务

### Frontend Dev渲染工作台

1. 调用`GET /api/features?enabled=true`获取功能列表
2. 后端根据用户套餐和`access_scope`过滤
3. 前端根据`display_order`排序展示
4. 点击卡片跳转到动态表单（`form_schema`）

### Billing Guard审查

1. 检查`quota_cost`是否为0（需警告）
2. 检查`rate_limit_policy`是否合理
3. 检查`access_scope`是否符合商业模型
4. 检查白名单功能是否有明确的上线计划

---

## 注意事项 / 禁止事项

### ✅ 必须遵守

1. **`feature_id`必须全局唯一**：蛇形命名法，不允许重复
2. **`quota_cost`不能随意设为0**：免费功能需要Billing Guard特别审批
3. **`access_scope=whitelist`时必须填写`allowed_accounts`**：否则无人能访问
4. **软删除机制**：禁用功能时设置`deleted_at`，不删除记录
5. **`is_enabled=false`的功能不应返回给前端**：后端接口必须过滤

### ❌ 禁止操作

1. ❌ **禁止硬编码`feature_id`到前端代码**：必须动态读取
2. ❌ **禁止前端跳过权限校验**：前端只展示后端返回的功能列表
3. ❌ **禁止删除`feature_definitions`记录**：使用软删除（`deleted_at`）
4. ❌ **禁止修改已上线功能的`feature_id`**：会破坏历史任务关联
5. ❌ **禁止在`allowed_accounts`中使用非JSON格式**：必须是数组字符串

### ⚠️ 特别警告

- **`quota_cost = 0`必须红色警告**：免费功能容易被薅羊毛
- **白名单功能必须有上线计划**：不能永远停留在灰度
- **高成本功能必须严格限流**：防止恶意刷量

---

## 前后端协作规范

### 后端接口：GET /api/features

**请求**：
```http
GET /api/features?enabled=true
Authorization: Bearer <token>
```

**响应**（已过滤权限）：
```json
{
  "features": [
    {
      "feature_id": "basic_clean",
      "title": "服装清理增强",
      "description": "一键抠图+白底+提亮",
      "icon_url": "https://cos.../icons/basic_clean.svg",
      "category": "image",
      "quota_cost": 1,
      "display_order": 0
    }
  ]
}
```

**过滤规则**（后端必须实现）：
1. `is_enabled = true`
2. `deleted_at IS NULL`
3. 根据用户套餐过滤`plan_required`
4. 根据用户ID过滤`allowed_accounts`（白名单模式）

### 前端展示规则

1. **不允许本地判断权限**：只展示后端返回的功能
2. **按`display_order`排序**：越小越靠前
3. **根据`category`分组**：可选
4. **点击卡片跳转到动态表单**：`/features/${feature_id}/form`

---

## 数据库迁移示例

### 创建表

```javascript
// backend/src/db/migrations/YYYYMMDDHHMMSS_create_feature_definitions.js

exports.up = function(knex) {
  return knex.schema.createTable('feature_definitions', (table) => {
    table.increments('id').primary();
    table.string('feature_id', 50).unique().notNullable();

    // 展示信息
    table.string('title', 100).notNullable();
    table.text('description');
    table.string('icon_url', 255);
    table.string('category', 50);

    // 权限控制
    table.enum('access_scope', ['plan', 'whitelist']).defaultTo('plan');
    table.string('plan_required', 50);
    table.text('allowed_accounts');
    table.boolean('is_enabled').defaultTo(true);

    // 计费规则
    table.integer('quota_cost').defaultTo(1);
    table.json('rate_limit_policy');

    // 关联配置
    table.integer('form_schema_id').unsigned();
    table.integer('pipeline_schema_id').unsigned();

    // 素材库
    table.boolean('save_to_asset_library').defaultTo(true);

    // 排序和状态
    table.integer('display_order').defaultTo(0);
    table.timestamps(true, true);
    table.timestamp('deleted_at').nullable();

    // 外键
    table.foreign('form_schema_id').references('form_schemas.id');
    table.foreign('pipeline_schema_id').references('pipeline_schemas.id');

    // 索引
    table.index('access_scope');
    table.index('is_enabled');
    table.index('deleted_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('feature_definitions');
};
```

---

## 总结

这个规范定义了功能卡片的完整数据结构，是整个平台的**功能定义中枢**。

**关键点**：
- ✅ 统一功能定义标准
- ✅ 支持套餐权限和白名单模式
- ✅ 完整的计费和限流策略
- ✅ 软删除机制保护历史数据
- ✅ 前后端协作清晰

**所有Agent在处理功能相关需求时，必须参考本规范！**
