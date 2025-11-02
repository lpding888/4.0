'use client';

import { useState } from 'react';
import { FormField } from '@/types';
import ImageUploader from '../ImageUploader';
import { Image } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

interface ImageUploadFieldProps {
  field: FormField;
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
}

/**
 * ImageUploadField - 单图上传字段组件
 * 艹，复用现有的 ImageUploader 组件，支持 COS 直传
 */
export default function ImageUploadField({
  field,
  value,
  onChange,
  error
}: ImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false);

  const handleUploadSuccess = (url: string) => {
    onChange(url);
    setUploading(false);
  };

  const handleUploadError = (error: any) => {
    setUploading(false);
  };

  const handleRemove = () => {
    onChange(null);
  };

  // 解析文件大小限制（MB）
  const maxSize = field.validation?.maxSize
    ? field.validation.maxSize / (1024 * 1024)
    : 10;

  // 解析允许的文件类型
  const acceptTypes = field.validation?.allowedTypes || [
    'image/jpeg',
    'image/jpg',
    'image/png'
  ];

  return (
    <div className="mb-4">
      <label className="block text-white text-sm font-light mb-2">
        {field.label}
        {field.required && <span className="text-rose-400 ml-1">*</span>}
      </label>

      {value ? (
        <div className="relative inline-block">
          <Image
            src={value}
            alt={field.label}
            width={200}
            height={200}
            className="rounded-lg"
            style={{ objectFit: 'cover' }}
          />
          <button
            onClick={handleRemove}
            className="absolute top-2 right-2
              bg-rose-500/80 hover:bg-rose-500
              text-white rounded-full p-2
              transition-all duration-300"
          >
            <DeleteOutlined />
          </button>
        </div>
      ) : (
        <ImageUploader
          onUploadSuccess={handleUploadSuccess}
          onUploadError={handleUploadError}
          maxSize={maxSize}
          accept={acceptTypes}
        />
      )}

      {field.helpText && !error && (
        <p className="text-white/60 text-xs mt-1">{field.helpText}</p>
      )}

      {error && (
        <p className="text-rose-300 text-xs mt-1">{error}</p>
      )}
    </div>
  );
}
