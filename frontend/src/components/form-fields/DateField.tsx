'use client';

import { DatePicker } from 'antd';
import { FormField } from '@/types';
import dayjs, { Dayjs } from 'dayjs';

interface DateFieldProps {
  field: FormField;
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
}

/**
 * DateField - 日期选择字段组件
 * 艹，日期选择，返回 ISO 8601 格式字符串
 */
export default function DateField({ field, value, onChange, error }: DateFieldProps) {
  const handleChange = (date: Dayjs | null) => {
    onChange(date ? date.toISOString() : null);
  };

  return (
    <div className="mb-4">
      <label className="block text-white text-sm font-light mb-2">
        {field.label}
        {field.required && <span className="text-rose-400 ml-1">*</span>}
      </label>

      <DatePicker
        value={value ? dayjs(value) : null}
        onChange={handleChange}
        placeholder={field.helpText || `请选择${field.label}`}
        className={`
          w-full
          bg-white/10 backdrop-blur-md
          border ${error ? 'border-rose-400/50' : 'border-white/20'}
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
