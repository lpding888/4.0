'use client';

import { useState } from 'react';
import { Upload, message, Image } from 'antd';
import { PlusOutlined, DeleteOutlined, LoadingOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import COS from 'cos-js-sdk-v5';
import { api } from '@/lib/api';
import { FormField } from '@/types';

interface MultiImageUploadFieldProps {
  field: FormField;
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
}

/**
 * MultiImageUploadField - 多图上传字段组件
 * 艹，支持上传多张图片，使用 COS 直传
 */
export default function MultiImageUploadField({
  field,
  value,
  onChange,
  error
}: MultiImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

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

  // 上传前验证
  const beforeUpload = (file: File) => {
    const isValidType = acceptTypes.includes(file.type);
    if (!isValidType) {
      message.error('只支持JPG/PNG格式的图片!');
      return false;
    }

    const isValidSize = file.size / 1024 / 1024 < maxSize;
    if (!isValidSize) {
      message.error(`图片大小不能超过${maxSize}MB!`);
      return false;
    }

    return true;
  };

  // 自定义上传逻辑 - 使用COS SDK上传
  const customUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;

    try {
      setUploading(true);

      // 1. 获取STS临时密钥
      const tempTaskId = `temp_${Date.now()}`;
      const stsResponse: any = await api.media.getSTS(tempTaskId);

      if (!stsResponse.success) {
        throw new Error('获取上传凭证失败');
      }

      const { credentials, bucket, region, allowPrefix } = stsResponse.data;

      // 2. 初始化COS实例
      const cos = new COS({
        getAuthorization: (options, callback) => {
          callback({
            TmpSecretId: credentials.tmpSecretId,
            TmpSecretKey: credentials.tmpSecretKey,
            SecurityToken: credentials.sessionToken,
            StartTime: Date.now(),
            ExpiredTime: credentials.expiredTime
          });
        }
      });

      // 3. 生成文件名
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name}`;
      const key = `${allowPrefix}${fileName}`;

      // 4. 上传到COS
      cos.putObject(
        {
          Bucket: bucket,
          Region: region,
          Key: key,
          Body: file
        },
        (err, data) => {
          setUploading(false);

          if (err) {
            message.error('上传失败');
            onError(err);
          } else {
            // 生成访问URL
            const url = `https://${bucket}.cos.${region}.myqcloud.com/${key}`;
            message.success('上传成功');
            onSuccess({ url });

            // 添加到值数组
            onChange([...value, url]);
          }
        }
      );
    } catch (error: any) {
      setUploading(false);
      message.error(error.message || '上传失败');
      onError(error);
    }
  };

  // 删除图片
  const handleRemove = (url: string) => {
    onChange(value.filter((item) => item !== url));
  };

  const uploadButton = (
    <div>
      {uploading ? <LoadingOutlined /> : <PlusOutlined />}
      <div style={{ marginTop: 8 }}>上传图片</div>
    </div>
  );

  return (
    <div className="mb-4">
      <label className="block text-white text-sm font-light mb-2">
        {field.label}
        {field.required && <span className="text-rose-400 ml-1">*</span>}
      </label>

      <div className="flex flex-wrap gap-4">
        {/* 已上传的图片 */}
        {value.map((url, index) => (
          <div key={index} className="relative inline-block">
            <Image
              src={url}
              alt={`${field.label}-${index}`}
              width={100}
              height={100}
              className="rounded-lg"
              style={{ objectFit: 'cover' }}
            />
            <button
              onClick={() => handleRemove(url)}
              className="absolute top-1 right-1
                bg-rose-500/80 hover:bg-rose-500
                text-white rounded-full p-1
                transition-all duration-300"
            >
              <DeleteOutlined className="text-xs" />
            </button>
          </div>
        ))}

        {/* 上传按钮 */}
        <Upload
          listType="picture-card"
          showUploadList={false}
          beforeUpload={beforeUpload}
          customRequest={customUpload}
          accept={acceptTypes.join(',')}
          disabled={uploading}
        >
          {uploadButton}
        </Upload>
      </div>

      {field.helpText && !error && (
        <p className="text-white/60 text-xs mt-1">{field.helpText}</p>
      )}

      {error && (
        <p className="text-rose-300 text-xs mt-1">{error}</p>
      )}
    </div>
  );
}
