# TASK-FE-003：JSON Schema驱动的动态表单系统

## 📋 任务元信息

| 属性 | 值 |
|------|-----|
| **任务ID** | TASK-FE-003 |
| **任务类型** | Frontend Feature |
| **优先级** | P1 - 重要 |
| **预计工时** | 4-5天 |
| **依赖任务** | TASK-FE-001（架构搭建） |
| **负责Skill** | frontend-dev |
| **关联文档** | `docs/GPT5问题-前端架构设计.md` - 问题3 |

---

## 🎯 任务目标

实现一个**通用的动态表单渲染系统**，支持后端通过JSON Schema配置表单字段，前端自动渲染：

### 业务场景
- 管理后台配置20+个AI功能的输入表单
- 每个功能的表单字段完全不同（图片上传、下拉选择、滑块、日期等）
- 后端在`form_schemas`表存储JSON Schema配置
- 前端根据Schema自动渲染表单、生成验证规则

### JSON Schema示例
```json
{
  "fields": [
    {
      "name": "image",
      "type": "image_upload",
      "label": "上传图片",
      "required": true,
      "max_size": 10485760,
      "accept": ["image/jpeg", "image/png"]
    },
    {
      "name": "style",
      "type": "enum",
      "label": "服装风格",
      "required": true,
      "options": ["商务", "休闲", "运动", "正式"]
    },
    {
      "name": "intensity",
      "type": "number",
      "label": "效果强度",
      "min": 0,
      "max": 100,
      "default": 50
    }
  ]
}
```

---

## 📦 核心交付物

### 1. TypeScript类型定义

**`shared/types/form-schema.d.ts`**
```typescript
// 字段类型枚举
export type FormFieldType =
  | 'text'           // 单行文本
  | 'textarea'       // 多行文本
  | 'number'         // 数字输入
  | 'enum'           // 下拉选择
  | 'multi_enum'     // 多选
  | 'boolean'        // 开关
  | 'image_upload'   // 图片上传
  | 'file_upload'    // 文件上传
  | 'date'           // 日期选择
  | 'datetime'       // 日期时间选择
  | 'slider'         // 滑块
  | 'color'          // 颜色选择器
  | 'json';          // JSON编辑器

// 字段基础定义
export interface FormFieldBase {
  name: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  default?: any;
  disabled?: boolean;
  help_text?: string;  // 帮助提示
}

// 文本字段
export interface TextField extends FormFieldBase {
  type: 'text' | 'textarea';
  min_length?: number;
  max_length?: number;
  pattern?: string;  // 正则表达式
}

// 数字字段
export interface NumberField extends FormFieldBase {
  type: 'number' | 'slider';
  min?: number;
  max?: number;
  step?: number;
}

// 枚举字段
export interface EnumField extends FormFieldBase {
  type: 'enum' | 'multi_enum';
  options: string[] | { label: string; value: string }[];
}

// 文件上传字段
export interface FileField extends FormFieldBase {
  type: 'image_upload' | 'file_upload';
  accept?: string[];  // MIME类型
  max_size?: number;  // 字节
  max_count?: number; // 最大文件数
}

// 日期字段
export interface DateField extends FormFieldBase {
  type: 'date' | 'datetime';
  min_date?: string;
  max_date?: string;
}

// 联合类型
export type FormField = TextField | NumberField | EnumField | FileField | DateField | FormFieldBase;

// 完整的Form Schema
export interface FormSchema {
  fields: FormField[];
  submit_text?: string;   // 提交按钮文字
  layout?: 'horizontal' | 'vertical';
}
```

### 2. 字段渲染器映射表

**`shared/ui/DynamicForm/FieldRenderers.tsx`**
```typescript
import React from 'react';
import { Input, InputNumber, Select, Switch, Upload, DatePicker, Slider, ColorPicker } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { FormField } from '@/shared/types/form-schema';

/**
 * 根据字段类型返回对应的Ant Design组件
 */
export const getFieldRenderer = (field: FormField) => {
  switch (field.type) {
    case 'text':
      return <Input placeholder={field.placeholder} />;

    case 'textarea':
      return <Input.TextArea rows={4} placeholder={field.placeholder} />;

    case 'number':
      const numField = field as NumberField;
      return (
        <InputNumber
          min={numField.min}
          max={numField.max}
          step={numField.step}
          placeholder={field.placeholder}
          style={{ width: '100%' }}
        />
      );

    case 'slider':
      const sliderField = field as NumberField;
      return <Slider min={sliderField.min} max={sliderField.max} step={sliderField.step} />;

    case 'enum':
      const enumField = field as EnumField;
      const options = enumField.options.map((opt) =>
        typeof opt === 'string' ? { label: opt, value: opt } : opt
      );
      return (
        <Select placeholder={field.placeholder} options={options} />
      );

    case 'multi_enum':
      const multiField = field as EnumField;
      const multiOptions = multiField.options.map((opt) =>
        typeof opt === 'string' ? { label: opt, value: opt } : opt
      );
      return (
        <Select mode="multiple" placeholder={field.placeholder} options={multiOptions} />
      );

    case 'boolean':
      return <Switch />;

    case 'image_upload':
      const imageField = field as FileField;
      return (
        <Upload
          listType="picture-card"
          accept={imageField.accept?.join(',')}
          maxCount={imageField.max_count || 1}
        >
          <div>
            <UploadOutlined />
            <div style={{ marginTop: 8 }}>上传</div>
          </div>
        </Upload>
      );

    case 'file_upload':
      const fileField = field as FileField;
      return (
        <Upload
          accept={fileField.accept?.join(',')}
          maxCount={fileField.max_count || 1}
        >
          <Button icon={<UploadOutlined />}>选择文件</Button>
        </Upload>
      );

    case 'date':
      return <DatePicker style={{ width: '100%' }} />;

    case 'datetime':
      return <DatePicker showTime style={{ width: '100%' }} />;

    case 'color':
      return <ColorPicker />;

    default:
      console.warn(`未知字段类型: ${field.type}`);
      return <Input placeholder={field.placeholder} />;
  }
};
```

### 3. 验证规则生成器

**`shared/ui/DynamicForm/ValidationRules.ts`**
```typescript
import type { Rule } from 'antd/es/form';
import type { FormField, TextField, NumberField, FileField } from '@/shared/types/form-schema';

/**
 * 根据JSON Schema自动生成Ant Design Form验证规则
 */
export const generateValidationRules = (field: FormField): Rule[] => {
  const rules: Rule[] = [];

  // 必填校验
  if (field.required) {
    rules.push({
      required: true,
      message: `请输入${field.label}`,
    });
  }

  // 根据类型添加特定规则
  switch (field.type) {
    case 'text':
    case 'textarea':
      const textField = field as TextField;
      if (textField.min_length) {
        rules.push({
          min: textField.min_length,
          message: `${field.label}至少${textField.min_length}个字符`,
        });
      }
      if (textField.max_length) {
        rules.push({
          max: textField.max_length,
          message: `${field.label}最多${textField.max_length}个字符`,
        });
      }
      if (textField.pattern) {
        rules.push({
          pattern: new RegExp(textField.pattern),
          message: `${field.label}格式不正确`,
        });
      }
      break;

    case 'number':
    case 'slider':
      const numField = field as NumberField;
      if (numField.min !== undefined) {
        rules.push({
          type: 'number',
          min: numField.min,
          message: `${field.label}不能小于${numField.min}`,
        });
      }
      if (numField.max !== undefined) {
        rules.push({
          type: 'number',
          max: numField.max,
          message: `${field.label}不能大于${numField.max}`,
        });
      }
      break;

    case 'image_upload':
    case 'file_upload':
      const fileField = field as FileField;
      if (fileField.max_size) {
        rules.push({
          validator: (_, value) => {
            if (!value || !value.fileList) return Promise.resolve();
            const oversized = value.fileList.some(
              (file: any) => file.size > fileField.max_size!
            );
            if (oversized) {
              return Promise.reject(
                `文件大小不能超过${(fileField.max_size / 1024 / 1024).toFixed(1)}MB`
              );
            }
            return Promise.resolve();
          },
        });
      }
      break;
  }

  return rules;
};
```

### 4. DynamicForm核心组件

**`shared/ui/DynamicForm/index.tsx`**
```typescript
import React from 'react';
import { Form, Button, Space } from 'antd';
import type { FormInstance } from 'antd';
import type { FormSchema } from '@/shared/types/form-schema';
import { getFieldRenderer } from './FieldRenderers';
import { generateValidationRules } from './ValidationRules';

interface DynamicFormProps {
  schema: FormSchema;
  initialValues?: Record<string, any>;
  onSubmit: (values: Record<string, any>) => void | Promise<void>;
  loading?: boolean;
  formInstance?: FormInstance;
}

export const DynamicForm: React.FC<DynamicFormProps> = ({
  schema,
  initialValues,
  onSubmit,
  loading,
  formInstance,
}) => {
  const [form] = Form.useForm(formInstance);

  const handleFinish = async (values: Record<string, any>) => {
    await onSubmit(values);
  };

  return (
    <Form
      form={form}
      layout={schema.layout || 'vertical'}
      initialValues={initialValues || schema.fields.reduce((acc, field) => {
        if (field.default !== undefined) {
          acc[field.name] = field.default;
        }
        return acc;
      }, {} as Record<string, any>)}
      onFinish={handleFinish}
    >
      {schema.fields.map((field) => (
        <Form.Item
          key={field.name}
          name={field.name}
          label={field.label}
          rules={generateValidationRules(field)}
          tooltip={field.help_text}
          valuePropName={field.type === 'boolean' ? 'checked' : undefined}
        >
          {getFieldRenderer(field)}
        </Form.Item>
      ))}

      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>
            {schema.submit_text || '提交'}
          </Button>
          <Button onClick={() => form.resetFields()}>重置</Button>
        </Space>
      </Form.Item>
    </Form>
  );
};
```

### 5. 使用示例

**`features/admin/ui/FeatureConfigPage.tsx`** - 管理后台功能配置页
```typescript
import React, { useState } from 'react';
import { Card, message } from 'antd';
import { useRequest } from '@/shared/hooks/useRequest';
import { DynamicForm } from '@/shared/ui/DynamicForm';
import { getFormSchema } from '../api/getFormSchema';
import { submitFeatureConfig } from '../api/submitFeatureConfig';

interface Props {
  featureId: string;
}

export const FeatureConfigPage: React.FC<Props> = ({ featureId }) => {
  const [submitting, setSubmitting] = useState(false);

  // 从后端加载Form Schema
  const { data: schema, isLoading } = useRequest(
    ['formSchema', featureId],
    () => getFormSchema(featureId)
  );

  const handleSubmit = async (values: Record<string, any>) => {
    try {
      setSubmitting(true);
      await submitFeatureConfig(featureId, values);
      message.success('配置已保存');
    } catch (error) {
      message.error('保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) return <div>加载中...</div>;
  if (!schema) return <div>无法加载表单配置</div>;

  return (
    <Card title={`配置功能: ${featureId}`}>
      <DynamicForm schema={schema} onSubmit={handleSubmit} loading={submitting} />
    </Card>
  );
};
```

---

## ✅ 验收标准

### 功能验收
- [ ] 支持12种字段类型（text/number/enum/image_upload等）
- [ ] 根据JSON Schema自动生成验证规则
- [ ] 必填、最小值、最大值、正则验证正常工作
- [ ] 图片上传支持大小限制、格式限制
- [ ] 表单提交时返回正确的数据格式

### 兼容性验收
- [ ] 后端修改`form_schemas`表数据，前端表单立即变化
- [ ] 支持表单初始值（编辑场景）
- [ ] 支持禁用字段、帮助提示

### 代码质量
- [ ] 所有字段类型都有TypeScript类型定义
- [ ] `DynamicForm`组件通过单元测试
- [ ] 验证规则生成器有测试覆盖

---

## 🔧 技术要求

### 后端API要求

**GET /api/admin/form-schemas/:featureId**
```json
{
  "success": true,
  "data": {
    "fields": [
      {
        "name": "image",
        "type": "image_upload",
        "label": "上传图片",
        "required": true,
        "max_size": 10485760
      }
    ],
    "submit_text": "开始处理",
    "layout": "vertical"
  }
}
```

---

## 📚 参考资料

1. **Ant Design Form**：https://ant.design/components/form-cn
2. **JSON Schema规范**：https://json-schema.org/

---

## 🚨 注意事项

1. **文件上传处理**：
   - Ant Design Upload组件的`value`是`{fileList: []}`结构
   - 提交时需要转换为实际文件URL或Base64

2. **默认值处理**：
   - 确保`initialValues`和`field.default`优先级正确
   - 编辑场景优先使用`initialValues`

3. **渐进式扩展**：
   - 先支持5个最常用字段类型
   - 逐步添加复杂类型（JSON编辑器、富文本等）

---

**艹！这个动态表单系统搞定后,20个AI功能的表单配置全部数据驱动,再也不用写重复代码了!** 🔥
