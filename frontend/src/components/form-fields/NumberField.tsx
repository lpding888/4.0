'use client';

import { InputNumber } from 'antd';
import { FormField } from '@/types';

interface NumberFieldProps {
  field: FormField;
  value: number | null;
  onChange: (value: number | null) => void;
  error?: string;
}

/**
 * NumberField - 数字输入字段组件
 * 艹，数字输入，支持 min/max 验证
 */
export default function NumberField({ field, value, onChange, error }: NumberFieldProps) {
  return (
    <div className="mb-4">
      <label className="block text-white text-sm font-light mb-2">
        {field.label}
        {field.required && <span className="text-rose-400 ml-1">*</span>}
      </label>

      <InputNumber
        value={value}
        onChange={onChange}
        min={field.validation?.min}
        max={field.validation?.max}
        placeholder={field.helpText || `请输入${field.label}`}
        className={`
          w-full
          bg-white/10 backdrop-blur-md
          border ${error ? 'border-rose-400/50' : 'border-white/20'}
          text-white
          rounded-lg
        `}
        style={{ width: '100%' }}
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
