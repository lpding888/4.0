/**
 * UFS (Unified Form Schema) 统一表单Schema定义
 * 艹，这个tm是我们自己定义的标准表单格式！
 */

/**
 * UFS字段类型枚举
 */
export enum UFSFieldType {
  INPUT = 'input',           // 文本输入
  TEXTAREA = 'textarea',     // 多行文本
  NUMBER = 'number',         // 数字
  SELECT = 'select',         // 下拉选择
  RADIO = 'radio',           // 单选
  CHECKBOX = 'checkbox',     // 复选框
  SWITCH = 'switch',         // 开关
  DATE = 'date',             // 日期
  IMAGE = 'image',           // 图片上传
  COLOR = 'color',           // 颜色选择器
}

/**
 * 选项配置（用于select/radio等）
 */
export interface UFSOption {
  label: string;
  value: any;
}

/**
 * 校验规则
 */
export interface UFSValidation {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  email?: boolean;
  url?: boolean;
  custom?: string; // 自定义校验表达式
}

/**
 * 条件显示规则（visibleWhen）
 */
export interface UFSVisibleWhen {
  field: string;      // 依赖字段key
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'notIn';
  value: any;         // 比较值
}

/**
 * UFS字段定义
 */
export interface UFSField {
  key: string;                    // 字段唯一标识
  type: UFSFieldType;             // 字段类型
  label: string;                  // 显示标签
  placeholder?: string;           // 占位符
  defaultValue?: any;             // 默认值
  description?: string;           // 字段描述/帮助文本
  validation?: UFSValidation;     // 校验规则
  options?: UFSOption[];          // 选项（用于select/radio/checkbox）
  visibleWhen?: UFSVisibleWhen;   // 条件显示
  disabled?: boolean;             // 是否禁用
  multiple?: boolean;             // 是否多选（用于select）
  rows?: number;                  // 行数（用于textarea）
  accept?: string;                // 接受的文件类型（用于image）
  max?: number;                   // 最大值（用于number）
  min?: number;                   // 最小值（用于number）
  step?: number;                  // 步进值（用于number）
}

/**
 * 跨字段校验规则
 */
export interface UFSCrossRule {
  type: 'compare' | 'sum' | 'custom';
  fields: string[];
  operator?: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte';
  value?: any;
  message: string;
}

/**
 * UFS完整Schema
 */
export interface UFSSchema {
  version: string;                // Schema版本
  fields: UFSField[];             // 字段列表
  crossRules?: UFSCrossRule[];    // 跨字段校验规则
  metadata?: {                    // 元数据
    title?: string;
    description?: string;
    createdAt?: string;
    updatedAt?: string;
  };
}
