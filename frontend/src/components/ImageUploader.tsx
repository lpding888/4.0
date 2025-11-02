'use client';

import { useState } from 'react';
import { Upload, message, Progress } from 'antd';
import { InboxOutlined, LoadingOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import COS from 'cos-js-sdk-v5';
import { api } from '@/lib/api';

const { Dragger } = Upload;

interface ImageUploaderProps {
  taskId?: string;
  onUploadSuccess?: (url: string) => void;
  onUploadError?: (error: any) => void;
  maxSize?: number; // MB
  accept?: string[];
}

export default function ImageUploader({
  taskId,
  onUploadSuccess,
  onUploadError,
  maxSize = 10,
  accept = ['image/jpeg', 'image/jpg', 'image/png']
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileList, setFileList] = useState<any[]>([]);

  /**
   * 上传前的验证
   */
  const beforeUpload = (file: File) => {
    // 验证文件类型
    const isValidType = accept.includes(file.type);
    if (!isValidType) {
      message.error('只支持JPG/PNG格式的图片!');
      return false;
    }

    // 验证文件大小
    const isValidSize = file.size / 1024 / 1024 < maxSize;
    if (!isValidSize) {
      message.error(`图片大小不能超过${maxSize}MB!`);
      return false;
    }

    return true;
  };

  /**
   * 自定义上传逻辑 - 使用COS SDK上传
   */
  const customUpload = async (options: any) => {
    const { file } = options;

    try {
      setUploading(true);
      setProgress(0);

      // 1. 获取STS临时密钥 (如果没有taskId，先创建一个临时任务ID)
      const tempTaskId = taskId || `temp_${Date.now()}`;
      const stsResponse: any = await api.media.getSTS(tempTaskId);
      
      if (!stsResponse.success) {
        throw new Error('获取上传凭证失败');
      }

      const {
        credentials,
        bucket,
        region,
        allowPrefix,
        taskId: actualTaskId
      } = stsResponse.data;

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

      // 3. 生成文件名(使用时间戳+原文件名)
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name}`;
      const key = `${allowPrefix}${fileName}`;

      // 4. 上传到COS
      return new Promise((resolve, reject) => {
        cos.putObject(
          {
            Bucket: bucket,
            Region: region,
            Key: key,
            Body: file,
            onProgress: (progressData: any) => {
              const percent = Math.round(progressData.percent * 100);
              setProgress(percent);
            }
          },
          (err, data) => {
            if (err) {
              reject(err);
            } else {
              // 生成访问URL
              const url = `https://${bucket}.cos.${region}.myqcloud.com/${key}`;
              resolve({ url, taskId: actualTaskId, fileName: key });
            }
          }
        );
      });

    } catch (error: any) {
      console.error('上传失败:', error);
      message.error(error.message || '上传失败');
      setUploading(false);
      setProgress(0);
      onUploadError?.(error);
      throw error;
    }
  };

  /**
   * 上传状态变化
   */
  const handleChange: UploadProps['onChange'] = async (info) => {
    const { status } = info.file;
    
    if (status === 'uploading') {
      setFileList([info.file]);
    } else if (status === 'done') {
      message.success(`${info.file.name} 上传成功`);
      setUploading(false);
      setProgress(0);
      setFileList([]);
      
      // 回调上传成功
      const response = info.file.response;
      if (response?.url) {
        onUploadSuccess?.(response.url);
      }
    } else if (status === 'error') {
      message.error(`${info.file.name} 上传失败`);
      setUploading(false);
      setProgress(0);
      setFileList([]);
    }
  };

  return (
    <div>
      <Dragger
        name="file"
        fileList={fileList}
        beforeUpload={beforeUpload}
        customRequest={customUpload}
        onChange={handleChange}
        maxCount={1}
        accept={accept.join(',')}
        disabled={uploading}
      >
        <p className="ant-upload-drag-icon">
          {uploading ? (
            <LoadingOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
          ) : (
            <InboxOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
          )}
        </p>
        <p className="ant-upload-text">
          {uploading ? '上传中...' : '点击或拖拽文件到此区域上传'}
        </p>
        <p className="ant-upload-hint">
          支持JPG/PNG格式,单个文件不超过{maxSize}MB
        </p>
      </Dragger>

      {uploading && progress > 0 && (
        <div style={{ marginTop: '16px' }}>
          <Progress
            percent={progress}
            status="active"
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068'
            }}
          />
        </div>
      )}
    </div>
  );
}
