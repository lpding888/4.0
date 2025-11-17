/**
 * Formio → UFS 适配器
 * 艹，这个tm负责把Formio的components转换为我们的UFS格式！
 */

import {
  UFSSchema,
  UFSField,
  UFSFieldType,
  UFSOption,
  UFSValidation,
} from '../types/ufs';
import { validateUFSSchema } from '../validators';

// 重新导出验证函数供测试使用
export { validateUFSSchema };

/**
 * Formio组件类型到UFS字段类型的映射表
 * 艹，这个映射表是核心！
 */
const FIELD_TYPE_MAP: Record<string, UFSFieldType> = {
  textfield: UFSFieldType.INPUT,
  email: UFSFieldType.INPUT,
  phoneNumber: UFSFieldType.INPUT,
  url: UFSFieldType.INPUT,
  textarea: UFSFieldType.TEXTAREA,
  number: UFSFieldType.NUMBER,
  currency: UFSFieldType.NUMBER,
  select: UFSFieldType.SELECT,
  selectboxes: UFSFieldType.CHECKBOX,
  radio: UFSFieldType.RADIO,
  checkbox: UFSFieldType.SWITCH,
  day: UFSFieldType.DATE,
  datetime: UFSFieldType.DATE,
  time: UFSFieldType.DATE,
  file: UFSFieldType.IMAGE,
  signature: UFSFieldType.IMAGE,
};

/**
 * 支持的Formio组件类型列表
 */
export const SUPPORTED_FORMIO_TYPES = Object.keys(FIELD_TYPE_MAP);

/**
 * Formio Component接口（简化版）
 */
export interface FormioComponent {
  type: string;
  key: string;
  label?: string;
  placeholder?: string;
  defaultValue?: any;
  description?: string;
  validate?: {
    required?: boolean;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    email?: boolean;
    url?: boolean;
    custom?: string;
  };
  data?: {
    values?: Array<{ label: string; value: any }>;
  };
  values?: Array<{ label: string; value: any }>;
  conditional?: {
    show?: boolean;
    when?: string;
    eq?: any;
  };
  disabled?: boolean;
  multiple?: boolean;
  rows?: number;
  image?: boolean;
  storage?: string;
  [key: string]: any; // 其他未定义的属性
}

/**
 * Formio Schema接口
 */
export interface FormioSchema {
  components: FormioComponent[];
  [key: string]: any;
}

/**
 * 适配器错误
 */
export class AdapterError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

/**
 * 转换单个Formio组件为UFS字段
 * 艹，这个函数是核心转换逻辑！
 */
function convertFormioComponentToUFSField(component: FormioComponent): UFSField | null {
  // 检查是否支持该类型
  const ufsType = FIELD_TYPE_MAP[component.type];
  if (!ufsType) {
    console.warn(`[Adapter] 不支持的Formio组件类型: ${component.type}`);
    return null;
  }

  // 基础字段
  const field: UFSField = {
    key: component.key,
    type: ufsType,
    label: component.label || component.key,
  };

  // 占位符
  if (component.placeholder) {
    field.placeholder = component.placeholder;
  }

  // 默认值
  if (component.defaultValue !== undefined) {
    field.defaultValue = component.defaultValue;
  }

  // 描述/帮助文本
  if (component.description) {
    field.description = component.description;
  }

  // 禁用状态
  if (component.disabled) {
    field.disabled = true;
  }

  // 校验规则
  if (component.validate) {
    const validation: UFSValidation = {};

    if (component.validate.required !== undefined) {
      validation.required = component.validate.required;
    }
    if (component.validate.min !== undefined) {
      validation.min = component.validate.min;
    }
    if (component.validate.max !== undefined) {
      validation.max = component.validate.max;
    }
    if (component.validate.minLength !== undefined) {
      validation.minLength = component.validate.minLength;
    }
    if (component.validate.maxLength !== undefined) {
      validation.maxLength = component.validate.maxLength;
    }
    if (component.validate.pattern) {
      validation.pattern = component.validate.pattern;
    }
    if (component.validate.email) {
      validation.email = true;
    }
    if (component.validate.url) {
      validation.url = true;
    }
    if (component.validate.custom) {
      validation.custom = component.validate.custom;
    }

    if (Object.keys(validation).length > 0) {
      field.validation = validation;
    }
  }

  // 选项（select/radio/checkbox）
  if (component.data?.values || component.values) {
    const values = component.data?.values || component.values;
    field.options = values!.map((v) => ({
      label: v.label,
      value: v.value,
    }));
  }

  // 条件显示
  if (component.conditional?.show !== undefined && component.conditional.when) {
    field.visibleWhen = {
      field: component.conditional.when,
      operator: 'eq',
      value: component.conditional.eq,
    };
  }

  // 特定类型的额外属性
  switch (ufsType) {
    case UFSFieldType.SELECT:
      if (component.multiple) {
        field.multiple = true;
      }
      break;

    case UFSFieldType.TEXTAREA:
      if (component.rows) {
        field.rows = component.rows;
      }
      break;

    case UFSFieldType.NUMBER:
      if (component.validate?.min !== undefined) {
        field.min = component.validate.min;
      }
      if (component.validate?.max !== undefined) {
        field.max = component.validate.max;
      }
      if (component.step) {
        field.step = component.step;
      }
      break;

    case UFSFieldType.IMAGE:
      // 文件类型限制
      if (component.image) {
        field.accept = 'image/*';
      } else if (component.filePattern) {
        field.accept = component.filePattern;
      }
      break;
  }

  return field;
}

/**
 * 转换Formio Schema为UFS Schema
 * 艹，这是主要的导出函数！
 */
export function convertFormioToUFS(formioSchema: FormioSchema): UFSSchema {
  // 校验输入
  if (!formioSchema || !Array.isArray(formioSchema.components)) {
    throw new AdapterError(
      'Invalid Formio Schema: components must be an array',
      'INVALID_SCHEMA'
    );
  }

  // 没有任何组件直接视为无可转换内容
  if (formioSchema.components.length === 0) {
    throw new AdapterError(
      'No components provided in Formio Schema',
      'NO_SUPPORTED_COMPONENTS'
    );
  }

  // 转换所有组件
  const fields: UFSField[] = [];
  const unsupportedTypes = new Set<string>();

  for (const component of formioSchema.components) {
    // 跳过布局组件（columns, panel, fieldset等）
    if (isLayoutComponent(component.type)) {
      console.warn(`[Adapter] 跳过布局组件: ${component.type}`);
      continue;
    }

    // 跳过按钮
    if (component.type === 'button') {
      console.warn(`[Adapter] 跳过按钮组件: ${component.key}`);
      continue;
    }

    const field = convertFormioComponentToUFSField(component);

    if (field) {
      // 检查key唯一性
      if (fields.some((f) => f.key === field.key)) {
        throw new AdapterError(
          `Duplicate field key: ${field.key}`,
          'DUPLICATE_KEY',
          { key: field.key }
        );
      }
      fields.push(field);
    } else {
      unsupportedTypes.add(component.type);
    }
  }

  // 如果所有组件都不支持，抛出错误
  if (fields.length === 0) {
    throw new AdapterError(
      'No supported components found in Formio Schema',
      'NO_SUPPORTED_COMPONENTS',
      { unsupportedTypes: Array.from(unsupportedTypes) }
    );
  }

  // 构建UFS Schema
  const ufsSchema: UFSSchema = {
    version: '1.0',
    fields,
    metadata: {
      title: formioSchema.title,
      description: formioSchema.description,
      createdAt: new Date().toISOString(),
    },
  };

  // 艹，用Zod校验转换后的UFS Schema！
  const validation = validateUFSSchema(ufsSchema);
  if (!validation.success) {
    console.error('[UFS转换后校验失败]', validation.errors);
    throw new AdapterError(
      `UFS Schema校验失败: ${validation.errors?.join(', ')}`,
      'VALIDATION_FAILED',
      { errors: validation.errors }
    );
  }

  return ufsSchema;
}

/**
 * 判断是否为布局组件
 */
function isLayoutComponent(type: string): boolean {
  const layoutTypes = [
    'columns',
    'panel',
    'fieldset',
    'well',
    'tabs',
    'table',
    'container',
    'htmlelement',
    'content',
  ];
  return layoutTypes.includes(type);
}

