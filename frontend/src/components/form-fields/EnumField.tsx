'use client';

import { Select, Radio } from 'antd';
import { FormField } from '@/types';

interface EnumFieldProps {
  field: FormField;
  value: string | null;
  onChange: (value: string) => void;
  error?: string;
  displayAs?: 'select' | 'radio'; // 显示为下拉框或单选按钮组
}

/**
 * EnumField - 枚举选择字段组件
 * 艹，支持下拉框和单选按钮两种展示方式
 */
export default function EnumField({
  field,
  value,
  onChange,
  error,
  displayAs = 'select'
}: EnumFieldProps) {
  const options = field.options || [];

  if (displayAs === 'radio') {
    return (
      <div className="mb-4">
        <label className="block text-white text-sm font-light mb-2">
          {field.label}
          {field.required && <span className="text-rose-400 ml-1">*</span>}
        </label>

        <Radio.Group
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full"
        >
          <div className="space-y-2">
            {options.map((option) => (
              <Radio
                key={option.value}
                value={option.value}
                className="text-white"
              >
                <span className="text-white/80">{option.label}</span>
              </Radio>
            ))}
          </div>
        </Radio.Group>

        {field.helpText && !error && (
          <p className="text-white/60 text-xs mt-1">{field.helpText}</p>
        )}

        {error && (
          <p className="text-rose-300 text-xs mt-1">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mb-4">
      <label className="block text-white text-sm font-light mb-2">
        {field.label}
        {field.required && <span className="text-rose-400 ml-1">*</span>}
      </label>

      <Select
        value={value}
        onChange={onChange}
        placeholder={field.helpText || `请选择${field.label}`}
        className={`
          w-full
        `}
        style={{ width: '100%' }}
        options={options}
      />

      {field.helpText && !error && (
        <p className="text-white/60 text-xs mt-1">{field.helpText}</p>
      )}

      {error && (
        <p className="text-rose-300 text-xs mt-1">{error}</p>
      )}
    </div>
  );
}
