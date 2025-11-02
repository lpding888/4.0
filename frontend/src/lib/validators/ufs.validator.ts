/**
 * UFS Schema Zod校验器
 * 艹，这个tm负责UFS数据结构的严格校验！前后端复用！
 */

import { z } from 'zod';
import { UFSFieldType } from '../types/ufs';

/**
 * UFS选项校验
 */
export const UFSOptionSchema = z.object({
  label: z.string().min(1, '选项标签不能为空'),
  value: z.union([z.string(), z.number(), z.boolean()]),
  disabled: z.boolean().optional(),
});

/**
 * UFS校验规则Schema
 */
export const UFSValidationSchema = z.object({
  required: z.boolean().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  minLength: z.number().min(0, '最小长度不能为负数').optional(),
  maxLength: z.number().min(1, '最大长度必须大于0').optional(),
  pattern: z.string().optional(),
  email: z.boolean().optional(),
  url: z.boolean().optional(),
  custom: z.string().optional(),
}).refine(
  (data) => {
    // 艹，确保min <= max
    if (data.min !== undefined && data.max !== undefined) {
      return data.min <= data.max;
    }
    return true;
  },
  { message: '最小值不能大于最大值' }
).refine(
  (data) => {
    // 艹，确保minLength <= maxLength
    if (data.minLength !== undefined && data.maxLength !== undefined) {
      return data.minLength <= data.maxLength;
    }
    return true;
  },
  { message: '最小长度不能大于最大长度' }
);

/**
 * UFS条件显示Schema
 */
export const UFSVisibleWhenSchema = z.object({
  field: z.string().min(1, '依赖字段不能为空'),
  operator: z.enum(['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'in', 'notIn']),
  value: z.any(),
});

/**
 * UFS交叉规则Schema
 */
export const UFSCrossRuleSchema = z.object({
  fields: z.array(z.string().min(1)).min(2, '交叉规则至少需要2个字段'),
  operator: z.enum(['and', 'or', 'xor']),
  message: z.string().min(1, '错误消息不能为空'),
});

/**
 * UFS字段基础Schema
 */
const UFSFieldBaseSchema = z.object({
  key: z.string()
    .min(1, '字段key不能为空')
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, '字段key必须是有效的变量名'),
  type: z.nativeEnum(UFSFieldType, { errorMap: () => ({ message: '无效的字段类型' }) }),
  label: z.string().min(1, '字段标签不能为空'),
  placeholder: z.string().optional(),
  defaultValue: z.any().optional(),
  description: z.string().optional(),
  validation: UFSValidationSchema.optional(),
  options: z.array(UFSOptionSchema).optional(),
  visibleWhen: UFSVisibleWhenSchema.optional(),
  disabled: z.boolean().optional(),
  multiple: z.boolean().optional(),
  rows: z.number().min(1).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().positive('步长必须为正数').optional(),
  accept: z.string().optional(),
  maxSize: z.number().positive('最大尺寸必须为正数').optional(),
});

/**
 * UFS字段校验（带类型特定验证）
 * 艹，根据不同字段类型做额外校验！
 */
export const UFSFieldSchema = UFSFieldBaseSchema.superRefine((field, ctx) => {
  // SELECT/RADIO/CHECKBOX 必须有options
  if (['select', 'radio', 'checkbox'].includes(field.type)) {
    if (!field.options || field.options.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${field.type}类型字段必须有options`,
        path: ['options'],
      });
    }
  }

  // NUMBER类型，min不能大于max
  if (field.type === 'number') {
    if (field.min !== undefined && field.max !== undefined && field.min > field.max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'min不能大于max',
        path: ['min'],
      });
    }
  }

  // IMAGE类型应该有accept
  if (field.type === 'image' && !field.accept) {
    // 警告但不报错
    console.warn(`[UFS校验] 字段 ${field.key} 是image类型但未指定accept`);
  }
});

/**
 * UFS Schema完整校验
 */
export const UFSSchemaValidator = z.object({
  version: z.string().min(1, 'version不能为空'),
  fields: z.array(UFSFieldSchema).min(1, '至少需要一个字段'),
  crossRules: z.array(UFSCrossRuleSchema).optional(),
  metadata: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  }).optional(),
}).superRefine((schema, ctx) => {
  // 艹，检查字段key唯一性
  const keys = schema.fields.map((f) => f.key);
  const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);

  if (duplicates.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `字段key重复: ${duplicates.join(', ')}`,
      path: ['fields'],
    });
  }

  // 艹，检查visibleWhen引用的字段是否存在
  schema.fields.forEach((field, index) => {
    if (field.visibleWhen) {
      const dependentField = field.visibleWhen.field;
      if (!keys.includes(dependentField)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `字段 ${field.key} 的visibleWhen引用了不存在的字段: ${dependentField}`,
          path: ['fields', index, 'visibleWhen', 'field'],
        });
      }
    }
  });

  // 艹，检查crossRules引用的字段是否存在
  if (schema.crossRules) {
    schema.crossRules.forEach((rule, ruleIndex) => {
      rule.fields.forEach((fieldKey) => {
        if (!keys.includes(fieldKey)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `交叉规则引用了不存在的字段: ${fieldKey}`,
            path: ['crossRules', ruleIndex, 'fields'],
          });
        }
      });
    });
  }
});

/**
 * 校验UFS Schema
 * 艹，这个tm函数是主要导出的校验入口！
 */
export function validateUFSSchema(schema: unknown): {
  success: boolean;
  data?: any;
  errors?: string[];
} {
  try {
    const result = UFSSchemaValidator.safeParse(schema);

    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    } else {
      return {
        success: false,
        errors: result.error.errors.map((err) => {
          const path = err.path.join('.');
          return `${path ? `${path}: ` : ''}${err.message}`;
        }),
      };
    }
  } catch (error: any) {
    return {
      success: false,
      errors: [error.message || '未知错误'],
    };
  }
}

/**
 * 校验单个UFS字段
 * 艹，用于实时校验表单设计器中的字段！
 */
export function validateUFSField(field: unknown): {
  success: boolean;
  data?: any;
  errors?: string[];
} {
  try {
    const result = UFSFieldSchema.safeParse(field);

    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    } else {
      return {
        success: false,
        errors: result.error.errors.map((err) => err.message),
      };
    }
  } catch (error: any) {
    return {
      success: false,
      errors: [error.message || '未知错误'],
    };
  }
}
