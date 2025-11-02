'use client';

import { Input } from 'antd';
import { FormField } from '@/types';

interface TextFieldProps {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

/**
 * TextField - 文本输入字段组件
 * 艹，简单的文本输入，支持验证
 */
export default function TextField({ field, value, onChange, error }: TextFieldProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    // 客户端验证：pattern
    if (field.validation?.pattern) {
      const regex = new RegExp(field.validation.pattern);
      if (newValue && !regex.test(newValue)) {
        return; // 不符合pattern，不更新
      }
    }

    onChange(newValue);
  };

  return (
    <div className="mb-4">
      <label className="block text-white text-sm font-light mb-2">
        {field.label}
        {field.required && <span className="text-rose-400 ml-1">*</span>}
      </label>

      <Input
        value={value}
        onChange={handleChange}
        placeholder={field.helpText || `请输入${field.label}`}
        className={`
          bg-white/10 backdrop-blur-md
          border ${error ? 'border-rose-400/50' : 'border-white/20'}
          text-white placeholder-white/40
          rounded-lg
          focus:border-cyan-400/50
        `}
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
