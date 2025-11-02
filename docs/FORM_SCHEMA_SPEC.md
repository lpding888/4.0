# FORM_SCHEMA_SPEC.md - 前端表单规范

## 文档目的

本文档定义前端动态表单的数据结构规范，供所有技能包Agent参考。

**适用场景**：
- Product Planner设计新功能时，定义表单字段和校验规则
- Frontend Dev实现动态表单组件时，理解form_schema结构
- Backend Dev接收表单数据时，理解input_data字段映射
- QA Acceptance测试时，验证表单是否符合规范
- Reviewer审查时，检查是否为每个功能写死页面（禁止）

**核心原则**：
✅ **一个form_schema，动态渲染所有功能表单**
❌ **禁止为每个功能写死单独页面**（如`pages/task/basic-clean.tsx`）

---

## 核心概念

### 什么是Form Schema？

Form Schema是一个**JSON配置对象**，描述用户创建任务时需要填写的表单字段。

**设计理念**：
- 前端只需要一个通用的`<DynamicForm>`组件
- 根据`form_schema`动态渲染不同功能的表单
- 所有表单逻辑（字段类型、校验规则、依赖关系）都在Schema中定义

**示例场景**：
- "服装清理增强"：上传1张图 → 提交
- "AI模特12分镜"：上传1张图 + 选择风格 → 提交
- "促销海报生成"：上传1张图 + 输入价格 + 输入文案 → 提交

这三个功能的表单**不应该**写成三个页面，而是由**同一个动态表单组件**根据不同的`form_schema`渲染。

---

## 数据库表结构

### form_schemas 表

```sql
CREATE TABLE form_schemas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT 'Schema名称（可读）',
  version VARCHAR(20) DEFAULT '1.0.0' COMMENT 'Schema版本号',
  schema JSON NOT NULL COMMENT '表单Schema定义（JSON对象）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### schema 字段（JSON结构）

```json
{
  "fields": [
    {
      "key": "input_image",
      "type": "image",
      "label": "上传商品图",
      "required": true,
      "validation": {
        "maxSize": 10485760,
        "allowedFormats": ["jpg", "png", "webp"]
      },
      "uploadConfig": {
        "cosPath": "input/${userId}/${taskId}/",
        "stsEndpoint": "/api/media/sts"
      }
    }
  ],
  "submitButton": {
    "text": "开始生成",
    "loadingText": "生成中..."
  },
  "successRedirect": "/task/${taskId}"
}
```

---

## Form Schema 字段定义

### 顶层结构

| 字段名 | 类型 | 是否必填 | 含义 | 示例 |
|--------|------|----------|------|------|
| `fields` | Array | ✅ 必填 | 表单字段列表 | `[{...}, {...}]` |
| `submitButton` | Object | 可选 | 提交按钮配置 | `{"text": "开始生成"}` |
| `successRedirect` | String | 可选 | 提交成功后跳转路径（支持模板变量`${taskId}`） | `/task/${taskId}` |
| `layout` | String | 可选 | 表单布局（`vertical`/`horizontal`） | `vertical`（默认） |

---

## Field 字段类型

### 通用字段属性

| 属性名 | 类型 | 是否必填 | 含义 |
|--------|------|----------|------|
| `key` | String | ✅ 必填 | 字段唯一标识（提交到后端的字段名） |
| `type` | String | ✅ 必填 | 字段类型（见下表） |
| `label` | String | ✅ 必填 | 字段标签（用户可见） |
| `placeholder` | String | 可选 | 输入提示 |
| `required` | Boolean | 可选 | 是否必填（默认`false`） |
| `defaultValue` | Any | 可选 | 默认值 |
| `validation` | Object | 可选 | 校验规则 |
| `dependencies` | Array | 可选 | 依赖其他字段（条件显示） |
| `helpText` | String | 可选 | 帮助文本 |

---

### 支持的字段类型

| type | 说明 | 用途 | validation字段 |
|------|------|------|----------------|
| `image` | 图片上传 | 上传商品图、模特图等 | `maxSize`、`allowedFormats`、`minWidth`、`minHeight` |
| `video` | 视频上传 | 上传视频素材 | `maxSize`、`allowedFormats`、`maxDuration` |
| `text` | 单行文本 | 输入促销文案、标题等 | `minLength`、`maxLength`、`pattern` |
| `textarea` | 多行文本 | 输入详细描述 | `minLength`、`maxLength` |
| `number` | 数字输入 | 输入价格、数量等 | `min`、`max`、`step` |
| `select` | 下拉选择 | 选择风格、主题等 | `options`（必填） |
| `radio` | 单选框 | 选择性别、场景等 | `options`（必填） |
| `checkbox` | 复选框 | 多选标签、特性等 | `options`（必填） |
| `slider` | 滑动条 | 调节参数（亮度、对比度等） | `min`、`max`、`step` |
| `color` | 颜色选择器 | 选择背景色、文字色等 | - |

---

## 详细字段定义

### 1. image 类型（图片上传）

```json
{
  "key": "input_image",
  "type": "image",
  "label": "上传商品图",
  "placeholder": "点击上传或拖拽图片",
  "required": true,
  "validation": {
    "maxSize": 10485760,          // 最大10MB
    "allowedFormats": ["jpg", "png", "webp"],
    "minWidth": 800,              // 最小宽度800px
    "minHeight": 800              // 最小高度800px
  },
  "uploadConfig": {
    "cosPath": "input/${userId}/${taskId}/",
    "stsEndpoint": "/api/media/sts"
  },
  "helpText": "支持JPG/PNG/WEBP格式，建议尺寸1200x1200以上"
}
```

### 2. text 类型（单行文本）

```json
{
  "key": "slogan",
  "type": "text",
  "label": "促销文案",
  "placeholder": "例如：全场5折起",
  "required": false,
  "validation": {
    "maxLength": 50,
    "pattern": "^[\\u4e00-\\u9fa50-9a-zA-Z\\s!?。！？]+$"  // 中英文+数字+标点
  },
  "helpText": "最多50字，支持中英文和标点"
}
```

### 3. number 类型（数字输入）

```json
{
  "key": "price",
  "type": "number",
  "label": "促销价",
  "placeholder": "例如：99",
  "required": true,
  "validation": {
    "min": 0.01,
    "max": 999999,
    "step": 0.01
  },
  "helpText": "输入商品促销后的价格"
}
```

### 4. select 类型（下拉选择）

```json
{
  "key": "theme",
  "type": "select",
  "label": "海报主题",
  "required": true,
  "validation": {
    "options": [
      {"value": "clearance", "label": "清仓甩卖"},
      {"value": "new_arrival", "label": "新品上市"},
      {"value": "flash_sale", "label": "限时抢购"}
    ]
  },
  "defaultValue": "clearance"
}
```

### 5. slider 类型（滑动条）

```json
{
  "key": "brightness",
  "type": "slider",
  "label": "亮度调节",
  "required": false,
  "validation": {
    "min": -100,
    "max": 100,
    "step": 1
  },
  "defaultValue": 0,
  "helpText": "负数降低亮度，正数提高亮度"
}
```

### 6. dependencies 条件显示

```json
{
  "key": "custom_slogan",
  "type": "text",
  "label": "自定义文案",
  "dependencies": [
    {
      "field": "theme",
      "operator": "equals",
      "value": "custom"
    }
  ],
  "helpText": "仅当选择"自定义主题"时显示"
}
```

**依赖规则**：
- `field`：依赖的字段key
- `operator`：操作符（`equals`、`notEquals`、`in`、`notIn`、`greaterThan`、`lessThan`）
- `value`：比较值

---

## 完整示例

### 示例1：服装清理增强（简单表单）

```json
{
  "name": "basic_clean_form",
  "version": "1.0.0",
  "schema": {
    "fields": [
      {
        "key": "input_image",
        "type": "image",
        "label": "上传商品图",
        "placeholder": "点击上传或拖拽图片",
        "required": true,
        "validation": {
          "maxSize": 10485760,
          "allowedFormats": ["jpg", "png", "webp"],
          "minWidth": 500,
          "minHeight": 500
        },
        "uploadConfig": {
          "cosPath": "input/${userId}/${taskId}/",
          "stsEndpoint": "/api/media/sts"
        },
        "helpText": "支持JPG/PNG/WEBP，建议800x800以上"
      }
    ],
    "submitButton": {
      "text": "开始清理增强",
      "loadingText": "处理中，请稍候..."
    },
    "successRedirect": "/task/${taskId}"
  }
}
```

### 示例2：AI模特12分镜（多字段表单）

```json
{
  "name": "model_pose12_form",
  "version": "1.0.0",
  "schema": {
    "fields": [
      {
        "key": "input_image",
        "type": "image",
        "label": "上传服装图",
        "required": true,
        "validation": {
          "maxSize": 10485760,
          "allowedFormats": ["jpg", "png", "webp"]
        },
        "uploadConfig": {
          "cosPath": "input/${userId}/${taskId}/",
          "stsEndpoint": "/api/media/sts"
        }
      },
      {
        "key": "model_type",
        "type": "select",
        "label": "模特类型",
        "required": true,
        "validation": {
          "options": [
            {"value": "asian_female", "label": "亚洲女模"},
            {"value": "asian_male", "label": "亚洲男模"},
            {"value": "western_female", "label": "欧美女模"},
            {"value": "western_male", "label": "欧美男模"}
          ]
        },
        "defaultValue": "asian_female"
      },
      {
        "key": "style",
        "type": "select",
        "label": "展示风格",
        "required": true,
        "validation": {
          "options": [
            {"value": "studio", "label": "摄影棚"},
            {"value": "outdoor", "label": "户外街拍"},
            {"value": "lifestyle", "label": "生活场景"}
          ]
        },
        "defaultValue": "studio"
      }
    ],
    "submitButton": {
      "text": "生成12分镜",
      "loadingText": "AI生成中，约需5分钟..."
    },
    "successRedirect": "/task/${taskId}",
    "layout": "vertical"
  }
}
```

### 示例3：促销海报生成（复杂表单）

```json
{
  "name": "promo_poster_form",
  "version": "1.0.0",
  "schema": {
    "fields": [
      {
        "key": "input_image",
        "type": "image",
        "label": "上传商品图",
        "required": true,
        "validation": {
          "maxSize": 10485760,
          "allowedFormats": ["jpg", "png", "webp"]
        },
        "uploadConfig": {
          "cosPath": "input/${userId}/${taskId}/",
          "stsEndpoint": "/api/media/sts"
        }
      },
      {
        "key": "price",
        "type": "number",
        "label": "促销价",
        "placeholder": "例如：99",
        "required": true,
        "validation": {
          "min": 0.01,
          "max": 999999,
          "step": 0.01
        }
      },
      {
        "key": "theme",
        "type": "select",
        "label": "海报主题",
        "required": true,
        "validation": {
          "options": [
            {"value": "clearance", "label": "清仓甩卖"},
            {"value": "new_arrival", "label": "新品上市"},
            {"value": "flash_sale", "label": "限时抢购"},
            {"value": "custom", "label": "自定义主题"}
          ]
        },
        "defaultValue": "clearance"
      },
      {
        "key": "slogan",
        "type": "text",
        "label": "促销文案",
        "placeholder": "例如：全场5折起",
        "required": false,
        "validation": {
          "maxLength": 50
        },
        "dependencies": [
          {
            "field": "theme",
            "operator": "equals",
            "value": "custom"
          }
        ],
        "helpText": "仅自定义主题时需要填写"
      },
      {
        "key": "background_color",
        "type": "color",
        "label": "背景颜色",
        "required": false,
        "defaultValue": "#FF0000"
      }
    ],
    "submitButton": {
      "text": "生成海报",
      "loadingText": "生成中..."
    },
    "successRedirect": "/task/${taskId}"
  }
}
```

---

## 前后端协作规范

### Frontend实现规范

#### 1. 动态表单组件

前端必须实现一个通用的`<DynamicForm>`组件：

```typescript
// frontend/src/components/DynamicForm.tsx

interface DynamicFormProps {
  schema: FormSchema;
  featureId: string;
  onSubmit: (data: FormData) => Promise<void>;
}

export function DynamicForm({ schema, featureId, onSubmit }: DynamicFormProps) {
  // 根据 schema.fields 动态渲染表单字段
  // 根据 field.type 渲染不同的输入组件
  // 根据 field.validation 进行前端校验
  // 根据 field.dependencies 控制字段显示/隐藏
  // 点击提交按钮时调用 onSubmit
}
```

#### 2. 页面路由

```typescript
// frontend/src/app/features/[featureId]/form/page.tsx

export default async function FeaturePage({ params }: { params: { featureId: string } }) {
  // 1. 调用后端接口获取 form_schema
  const schema = await fetch(`/api/features/${params.featureId}/form-schema`);

  // 2. 渲染动态表单
  return (
    <DynamicForm
      schema={schema}
      featureId={params.featureId}
      onSubmit={handleSubmit}
    />
  );
}
```

#### 3. 提交处理

```typescript
async function handleSubmit(formData: FormData) {
  // 1. 收集所有字段值
  const input_data = {
    input_image: formData.get('input_image'),
    price: formData.get('price'),
    theme: formData.get('theme'),
    ...
  };

  // 2. 调用后端 POST /api/tasks
  const response = await fetch('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({
      feature_id: featureId,
      input_data: input_data  // 所有表单字段打包成JSON
    })
  });

  // 3. 跳转到任务详情页
  if (response.ok) {
    const { task_id } = await response.json();
    router.push(`/task/${task_id}`);
  }
}
```

### Backend接口规范

#### 1. GET /api/features/:featureId/form-schema

```javascript
// backend/src/controllers/feature.controller.js

async getFormSchema(req, res) {
  const { featureId } = req.params;

  // 1. 查询 feature_definitions
  const feature = await db('feature_definitions')
    .where({ feature_id: featureId })
    .first();

  // 2. 查询关联的 form_schema
  const formSchema = await db('form_schemas')
    .where({ id: feature.form_schema_id })
    .first();

  // 3. 返回 schema JSON
  res.json(formSchema.schema);
}
```

#### 2. POST /api/tasks（接收表单数据）

```javascript
// backend/src/controllers/task.controller.js

async create(req, res) {
  const { feature_id, input_data } = req.body;
  const userId = req.user.id;

  // 1. 校验权限和配额
  await checkPermission(userId, feature_id);
  await deductQuota(userId, feature_id);

  // 2. 创建任务记录
  const task = await db('tasks').insert({
    user_id: userId,
    feature_id: feature_id,
    input_data: JSON.stringify(input_data),  // 存储表单数据
    status: 'pending'
  });

  // 3. 执行 pipeline
  await executePipeline(task.id);

  // 4. 返回任务ID
  res.json({ task_id: task.id });
}
```

---

## 使用场景

### Product Planner设计新功能表单

1. 列出用户需要输入的所有字段
2. 确定每个字段的类型（`image`/`text`/`select`等）
3. 设置必填项和校验规则
4. 设计字段依赖关系（条件显示）
5. 编写form_schema JSON
6. 插入到`form_schemas`表

### Frontend Dev实现动态表单

1. **禁止为每个功能写死页面**（如`pages/task/basic-clean.tsx`）
2. 只实现一个通用的`<DynamicForm>`组件
3. 根据`field.type`渲染不同的输入组件
4. 根据`field.validation`进行前端校验
5. 根据`field.dependencies`控制字段显示/隐藏

### Backend Dev接收表单数据

1. 接收`input_data`对象（JSON）
2. 根据`feature_id`查询对应的`form_schema`
3. 校验`input_data`是否符合`form_schema`定义
4. 将`input_data`存储到`tasks.input_data`字段（JSON）
5. 执行对应的`pipeline_schema`

---

## 注意事项 / 禁止事项

### ✅ 必须遵守

1. **前端必须动态渲染表单**：不允许为每个功能写死页面
2. **所有字段值必须打包到`input_data`**：后端统一处理
3. **图片/视频上传必须先调用STS接口**：直传COS
4. **前端必须进行基础校验**：`required`、`maxLength`、`pattern`等
5. **后端必须再次校验**：前端校验不可信

### ❌ 禁止操作

1. ❌ **禁止为每个功能写死单独页面**：必须动态渲染
2. ❌ **禁止前端跳过必填校验**：必须根据`required`字段判断
3. ❌ **禁止后端不校验input_data**：前端校验可被绕过
4. ❌ **禁止修改已上线form_schema的字段key**：会破坏历史数据
5. ❌ **禁止在form_schema中暴露敏感信息**：如API Key、内部配置

### ⚠️ 特别警告

- **图片上传必须限制大小**：防止恶意上传大文件
- **文本输入必须限制长度**：防止数据库溢出
- **下拉选择必须定义所有options**：前端根据options渲染
- **依赖字段必须存在**：`dependencies`引用的字段必须在同一form_schema中

---

## 数据库迁移示例

```javascript
// backend/src/db/migrations/YYYYMMDDHHMMSS_create_form_schemas.js

exports.up = function(knex) {
  return knex.schema.createTable('form_schemas', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable();
    table.string('version', 20).defaultTo('1.0.0');
    table.json('schema').notNullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('form_schemas');
};
```

---

## 总结

这个规范定义了前端动态表单的完整数据结构，是**前端动态渲染的核心**。

**关键点**：
- ✅ 一个动态表单组件，渲染所有功能
- ✅ 禁止为每个功能写死页面
- ✅ 支持丰富的字段类型和校验规则
- ✅ 支持字段依赖关系（条件显示）
- ✅ 前后端协作清晰

**所有Agent在处理表单相关需求时，必须参考本规范！**
