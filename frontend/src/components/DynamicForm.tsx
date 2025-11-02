'use client';

import { useState } from 'react';
import { Button, Modal, message } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { FormSchema, FormField } from '@/types';
import TextField from './form-fields/TextField';
import NumberField from './form-fields/NumberField';
import DateField from './form-fields/DateField';
import EnumField from './form-fields/EnumField';
import ImageUploadField from './form-fields/ImageUploadField';
import MultiImageUploadField from './form-fields/MultiImageUploadField';

interface DynamicFormProps {
  schema: FormSchema;
  onSubmit: (formData: Record<string, any>) => Promise<void>;
  loading?: boolean;
}

/**
 * DynamicForm - 动态表单组件
 *
 * 艹，根据 form_schema 动态渲染表单字段，支持客户端验证
 * 绝不允许硬编码表单字段！
 */
export default function DynamicForm({ schema, onSubmit, loading = false }: DynamicFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // 更新字段值
  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [fieldName]: value
    }));

    // 清除该字段的错误
    if (errors[fieldName]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  // 客户端验证
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    schema.fields.forEach((field) => {
      const value = formData[field.name];

      // Required 验证
      if (field.required) {
        if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
          newErrors[field.name] = `${field.label}为必填项`;
        }
      }

      // 数字范围验证
      if (field.type === 'number' && value !== null && value !== undefined) {
        if (field.validation?.min !== undefined && value < field.validation.min) {
          newErrors[field.name] = `${field.label}不能小于${field.validation.min}`;
        }
        if (field.validation?.max !== undefined && value > field.validation.max) {
          newErrors[field.name] = `${field.label}不能大于${field.validation.max}`;
        }
      }

      // 文件大小验证（已在字段组件内处理）
      // 文件类型验证（已在字段组件内处理）
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 提交表单
  const handleSubmit = async () => {
    // 客户端验证
    if (!validate()) {
      message.error('请检查表单填写');
      return;
    }

    // 二次确认对话框（艹，必须显示消耗的配额数！）
    Modal.confirm({
      title: '确认生成',
      content: (
        <div>
          <p>本次操作将消耗 <strong>{schema.quota_cost}</strong> 配额</p>
          <p>确定要继续吗？</p>
        </div>
      ),
      okText: '确认生成',
      cancelText: '取消',
      onOk: async () => {
        try {
          setSubmitting(true);
          await onSubmit(formData);
        } catch (error: any) {
          message.error(error.message || '提交失败');
        } finally {
          setSubmitting(false);
        }
      }
    });
  };

  // 根据字段类型渲染对应组件
  const renderField = (field: FormField) => {
    const value = formData[field.name];
    const error = errors[field.name];

    switch (field.type) {
      case 'text':
        return (
          <TextField
            key={field.name}
            field={field}
            value={value || ''}
            onChange={(val) => handleFieldChange(field.name, val)}
            error={error}
          />
        );

      case 'number':
        return (
          <NumberField
            key={field.name}
            field={field}
            value={value || null}
            onChange={(val) => handleFieldChange(field.name, val)}
            error={error}
          />
        );

      case 'date':
        return (
          <DateField
            key={field.name}
            field={field}
            value={value || null}
            onChange={(val) => handleFieldChange(field.name, val)}
            error={error}
          />
        );

      case 'enum':
        return (
          <EnumField
            key={field.name}
            field={field}
            value={value || null}
            onChange={(val) => handleFieldChange(field.name, val)}
            error={error}
          />
        );

      case 'imageUpload':
        return (
          <ImageUploadField
            key={field.name}
            field={field}
            value={value || null}
            onChange={(val) => handleFieldChange(field.name, val)}
            error={error}
          />
        );

      case 'multiImageUpload':
        return (
          <MultiImageUploadField
            key={field.name}
            field={field}
            value={value || []}
            onChange={(val) => handleFieldChange(field.name, val)}
            error={error}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* 表单标题和描述 */}
      <div className="mb-6">
        <h2 className="text-2xl font-light text-white mb-2">{schema.display_name}</h2>
        <p className="text-white/60">{schema.description}</p>
      </div>

      {/* 动态渲染表单字段（艹，绝不硬编码！）*/}
      {schema.fields.map((field) => renderField(field))}

      {/* 提交按钮 */}
      <div className="mt-8">
        <Button
          type="primary"
          size="large"
          block
          loading={submitting || loading}
          onClick={handleSubmit}
          icon={<ThunderboltOutlined />}
          className="
            border border-cyan-400/50
            bg-cyan-500/20
            text-cyan-300
            hover:bg-cyan-400/30 hover:border-cyan-300
            transition-all duration-300
          "
          style={{ height: '48px', fontSize: '16px' }}
        >
          {submitting ? '提交中...' : `生成（消耗 ${schema.quota_cost} 配额）`}
        </Button>
      </div>
    </div>
  );
}
