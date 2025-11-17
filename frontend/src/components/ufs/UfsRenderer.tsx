'use client';

/**
 * UFS表单渲染器
 * 艹，这个tm用react-hook-form + AntD渲染UFS Schema！
 * 支持所有字段类型、校验规则、条件联动！
 */

import React, { useEffect } from 'react';
import { useForm, Controller, UseFormReturn } from 'react-hook-form';
import {
  ConfigProvider,
  Form,
  Input,
  InputNumber,
  Select,
  Radio,
  Checkbox,
  Switch,
  DatePicker,
  Upload,
  Button,
  Space,
  message,
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { UFSSchema, UFSField, UFSFieldType } from '@/lib/types/ufs';
import dayjs from 'dayjs';

/**
 * UFS渲染器Props
 */
export interface UfsRendererProps {
  schema: UFSSchema;
  defaultValues?: Record<string, any>;
  onSubmit?: (data: Record<string, any>) => void;
  onChange?: (data: Record<string, any>) => void;
  readOnly?: boolean;
  showSubmitButton?: boolean;
  submitButtonText?: string;
}

/**
 * UFS渲染器组件
 * 艹，这是核心渲染逻辑！
 */
export default function UfsRenderer({
  schema,
  defaultValues = {},
  onSubmit,
  onChange,
  readOnly = false,
  showSubmitButton = true,
  submitButtonText = '提交',
}: UfsRendererProps) {
  // react-hook-form初始化
  const form = useForm({
    defaultValues: buildDefaultValues(schema, defaultValues),
    mode: 'onChange', // 实时校验
  });

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = form;

  // 监听表单值变化
  const watchedValues = watch();

  useEffect(() => {
    if (onChange) {
      onChange(watchedValues);
    }
  }, [watchedValues, onChange]);

  /**
   * 表单提交处理
   */
  const onFormSubmit = (data: Record<string, any>) => {
    console.log('[UFS渲染器] 表单提交:', data);
    if (onSubmit) {
      onSubmit(data);
    } else {
      message.success('表单提交成功！');
    }
  };

  /**
   * 表单提交错误处理
   */
  const onFormError = (errors: any) => {
    console.error('[UFS渲染器] 表单校验失败:', errors);
    message.error('表单填写有误，请检查！');
  };

  return (
    <ConfigProvider autoInsertSpaceInButton={false}>
      <Form layout="vertical" onFinish={handleSubmit(onFormSubmit, onFormError)}>
      {schema.fields.map((field) => {
        // 检查字段是否应该显示
        if (!shouldFieldBeVisible(field, watchedValues)) {
          return null;
        }

        const labelId = `${field.key}-label`;

        return (
          <Controller
            key={field.key}
            name={field.key}
            control={control}
            rules={buildValidationRules(field)}
            render={({ field: controllerField, fieldState }) => (
              <Form.Item
                label={<span id={labelId}>{field.label}</span>}
                validateStatus={fieldState.error ? 'error' : ''}
                help={fieldState.error?.message || field.description}
                required={field.validation?.required}
                htmlFor={field.key}
              >
            {renderField(field, controllerField, readOnly, form, labelId)}
          </Form.Item>
        )}
      />
    );
  })}

      {/* 提交按钮 */}
      {showSubmitButton && !readOnly && (
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" autoInsertSpaceInButton={false}>
              {submitButtonText}
            </Button>
            <Button onClick={() => form.reset()} autoInsertSpaceInButton={false}>
              重置
            </Button>
          </Space>
        </Form.Item>
      )}
      </Form>
    </ConfigProvider>
  );
}

/**
 * 构建默认值
 * 艹，合并schema的defaultValue和外部传入的defaultValues！
 */
function buildDefaultValues(
  schema: UFSSchema,
  externalDefaults: Record<string, any>
): Record<string, any> {
  const defaults: Record<string, any> = {};

  schema.fields.forEach((field) => {
    if (externalDefaults[field.key] !== undefined) {
      defaults[field.key] = externalDefaults[field.key];
    } else if (field.defaultValue !== undefined) {
      defaults[field.key] = field.defaultValue;
    }
  });

  return defaults;
}

/**
 * 构建react-hook-form的校验规则
 * 艹，把UFS的validation转换为RHF的rules！
 */
function buildValidationRules(field: UFSField): any {
  const rules: any = {};

  if (!field.validation) {
    return rules;
  }

  const v = field.validation;

  // 必填校验
  if (v.required) {
    rules.required = `${field.label}是必填项`;
  }

  // 最小值/最大值
  if (v.min !== undefined) {
    rules.min = {
      value: v.min,
      message: `${field.label}不能小于${v.min}`,
    };
  }
  if (v.max !== undefined) {
    rules.max = {
      value: v.max,
      message: `${field.label}不能大于${v.max}`,
    };
  }

  // 最小长度/最大长度
  if (v.minLength !== undefined) {
    rules.minLength = {
      value: v.minLength,
      message: `${field.label}长度不能少于${v.minLength}个字符`,
    };
  }
  if (v.maxLength !== undefined) {
    rules.maxLength = {
      value: v.maxLength,
      message: `${field.label}长度不能超过${v.maxLength}个字符`,
    };
  }

  // 正则校验
  if (v.pattern) {
    rules.pattern = {
      value: new RegExp(v.pattern),
      message: `${field.label}格式不正确`,
    };
  }

  // Email校验
  if (v.email) {
    rules.pattern = {
      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
      message: `${field.label}必须是有效的邮箱地址`,
    };
  }

  // URL校验
  if (v.url) {
    rules.pattern = {
      value: /^https?:\/\/.+/i,
      message: `${field.label}必须是有效的URL`,
    };
  }

  // 自定义校验（TODO: 需要eval，暂时跳过）
  if (v.custom) {
    console.warn('[UFS渲染器] 自定义校验暂不支持:', v.custom);
  }

  return rules;
}

/**
 * 检查字段是否应该显示（visibleWhen逻辑）
 * 艹，这个tm处理字段联动显示！
 */
function shouldFieldBeVisible(
  field: UFSField,
  formValues: Record<string, any>
): boolean {
  if (!field.visibleWhen) {
    return true; // 没有条件，始终显示
  }

  const { field: dependentField, operator, value } = field.visibleWhen;
  const dependentValue = formValues[dependentField];

  switch (operator) {
    case 'eq':
      return dependentValue === value;
    case 'ne':
      return dependentValue !== value;
    case 'gt':
      return dependentValue > value;
    case 'lt':
      return dependentValue < value;
    case 'gte':
      return dependentValue >= value;
    case 'lte':
      return dependentValue <= value;
    case 'in':
      return Array.isArray(value) && value.includes(dependentValue);
    case 'notIn':
      return Array.isArray(value) && !value.includes(dependentValue);
    default:
      console.warn('[UFS渲染器] 不支持的operator:', operator);
      return true;
  }
}

/**
 * 渲染具体的字段组件
 * 艹，这个tm是核心渲染逻辑，根据字段类型渲染不同的AntD组件！
 */
function renderField(
  field: UFSField,
  controllerField: any,
  readOnly: boolean,
  form: UseFormReturn,
  labelId?: string
): React.ReactNode {
  const commonProps = {
    disabled: readOnly || field.disabled,
    placeholder: field.placeholder,
    id: field.key,
  };

  switch (field.type) {
    // ========== INPUT 文本输入 ==========
    case UFSFieldType.INPUT:
      return (
        <Input
          {...controllerField}
          {...commonProps}
          maxLength={field.validation?.maxLength}
        />
      );

    // ========== TEXTAREA 多行文本 ==========
    case UFSFieldType.TEXTAREA:
      return (
        <Input.TextArea
          {...controllerField}
          {...commonProps}
          rows={field.rows || 4}
          maxLength={field.validation?.maxLength}
          showCount
        />
      );

    // ========== NUMBER 数字 ==========
    case UFSFieldType.NUMBER:
      return (
        <InputNumber
          {...controllerField}
          {...commonProps}
          min={field.min}
          max={field.max}
          step={field.step || 1}
          style={{ width: '100%' }}
        />
      );

    // ========== SELECT 下拉选择 ==========
    case UFSFieldType.SELECT:
      return (
        <Select
          {...controllerField}
          {...commonProps}
          mode={field.multiple ? 'multiple' : undefined}
          options={field.options || []}
          allowClear
        />
      );

    // ========== RADIO 单选 ==========
    case UFSFieldType.RADIO:
      return (
        <Radio.Group {...controllerField} disabled={commonProps.disabled}>
          <Space direction="vertical">
            {(field.options || []).map((opt) => (
              <Radio key={opt.value} value={opt.value}>
                {opt.label}
              </Radio>
            ))}
          </Space>
        </Radio.Group>
      );

    // ========== CHECKBOX 复选框组 ==========
    case UFSFieldType.CHECKBOX:
      return (
        <Checkbox.Group
          {...controllerField}
          disabled={commonProps.disabled}
          options={field.options}
        />
      );

    // ========== SWITCH 开关 ==========
    case UFSFieldType.SWITCH:
      return (
        <Switch
          checked={controllerField.value}
          onChange={controllerField.onChange}
          disabled={commonProps.disabled}
          aria-labelledby={labelId}
        />
      );

    // ========== DATE 日期 ==========
    case UFSFieldType.DATE:
      return (
        <DatePicker
          {...controllerField}
          value={controllerField.value ? dayjs(controllerField.value) : null}
          onChange={(date) => {
            controllerField.onChange(date ? date.toISOString() : null);
          }}
          disabled={commonProps.disabled}
          style={{ width: '100%' }}
          showTime
        />
      );

    // ========== IMAGE 图片上传 ==========
    case UFSFieldType.IMAGE:
      return (
        <Upload
          {...controllerField}
          listType="picture-card"
          maxCount={field.multiple ? undefined : 1}
          accept={field.accept || 'image/*'}
          disabled={commonProps.disabled}
          beforeUpload={() => false} // 阻止自动上传，由外部处理
          onChange={(info) => {
            const fileList = info.fileList;
            controllerField.onChange(fileList);
          }}
        >
          <div>
            <UploadOutlined />
            <div style={{ marginTop: 8 }}>上传图片</div>
          </div>
        </Upload>
      );

    // ========== COLOR 颜色选择器 ==========
    case UFSFieldType.COLOR:
      return (
        <Input
          {...controllerField}
          type="color"
          disabled={commonProps.disabled}
          style={{ width: '100px', height: '40px' }}
        />
      );

    // ========== 默认 ==========
    default:
      console.warn('[UFS渲染器] 不支持的字段类型:', field.type);
      return (
        <Input
          {...controllerField}
          {...commonProps}
          placeholder={`不支持的类型: ${field.type}`}
          disabled
        />
      );
  }
}
