/**
 * COSBatchUploader 组件使用示例
 * 艹，这个示例必须展示所有上传功能，让用户知道怎么用！
 *
 * @author 老王
 */

'use client';

import React, { useState } from 'react';
import { Typography, Divider, Row, Col, Card, Space, Alert, Button } from 'antd';
import COSBatchUploader, {
  UploadConfig,
  COSConfig,
  UploadFileItem,
  UploadStatus
} from '@/components/base/COSBatchUploader';
import {
  CloudUploadOutlined,
  SettingOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  FileTextOutlined
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

export default function COSUploaderExample() {
  const [uploadStats, setUploadStats] = useState({
    totalFiles: 0,
    completedFiles: 0,
    totalSize: 0,
    uploadedSize: 0
  });

  // COS配置 (示例配置，实际使用时从后端获取)
  const cosConfig: COSConfig = {
    secretId: 'your-secret-id',
    secretKey: 'your-secret-key',
    bucket: 'your-bucket-name',
    region: 'ap-guangzhou',
    domain: 'https://your-bucket-name.cos.ap-guangzhou.myqcloud.com',
    pathPrefix: 'uploads/'
  };

  // 基础上传配置
  const basicConfig: Partial<UploadConfig> = {
    maxFileSize: 50,           // 50MB
    maxTotalSize: 500,         // 500MB
    maxFileCount: 50,
    concurrentUploads: 2,
    autoStart: true,
    previewEnabled: true
  };

  // 高级上传配置
  const advancedConfig: Partial<UploadConfig> = {
    maxFileSize: 200,          // 200MB
    maxTotalSize: 2048,        // 2GB
    maxFileCount: 200,
    concurrentUploads: 5,
    chunkSize: 2,              // 2MB分片
    retryAttempts: 5,
    autoStart: false,
    compressionEnabled: true,
    previewEnabled: true
  };

  // 图片上传配置
  const imageConfig: Partial<UploadConfig> = {
    maxFileSize: 20,           // 20MB
    maxTotalSize: 100,         // 100MB
    maxFileCount: 100,
    concurrentUploads: 3,
    autoStart: true,
    previewEnabled: true
  };

  const handleFileSelect = (files: UploadFileItem[]) => {
    console.log('文件选择:', files);

    const totalFiles = files.length;
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    setUploadStats(prev => ({
      ...prev,
      totalFiles: prev.totalFiles + totalFiles,
      totalSize: prev.totalSize + totalSize
    }));
  };

  const handleUploadStart = (file: UploadFileItem) => {
    console.log('开始上传:', file.name);
  };

  const handleUploadProgress = (file: UploadFileItem, progress: number) => {
    console.log(`上传进度 ${file.name}: ${progress}%`);
  };

  const handleUploadSuccess = (file: UploadFileItem, url: string) => {
    console.log('上传成功:', file.name, url);

    setUploadStats(prev => ({
      ...prev,
      completedFiles: prev.completedFiles + 1,
      uploadedSize: prev.uploadedSize + file.size
    }));
  };

  const handleUploadError = (file: UploadFileItem, error: string) => {
    console.error('上传失败:', file.name, error);
  };

  const handleUploadComplete = (files: UploadFileItem[]) => {
    console.log('全部上传完成:', files);
  };

  const handleBeforeUpload = async (file: UploadFileItem): Promise<boolean> => {
    // 可以在这里进行文件验证、预处理等
    console.log('上传前检查:', file.name);

    // 示例：检查文件名是否包含特殊字符
    if (file.name.includes('test')) {
      alert('文件名不能包含 "test"');
      return false;
    }

    return true;
  };

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <Title level={2}>COSBatchUploader 批量上传组件示例</Title>
        <Paragraph>
          COSBatchUploader 是一个功能强大的批量文件上传组件，支持腾讯云COS直传、
          断点续传、进度跟踪、文件预览等功能。
        </Paragraph>

        {/* 统计信息 */}
        <Alert
          message="上传统计"
          description={
            <Space size="large">
              <span>
                <Text strong>已选择:</Text> {uploadStats.totalFiles} 个文件
              </span>
              <span>
                <Text strong>已完成:</Text> {uploadStats.completedFiles} 个文件
              </span>
              <span>
                <Text strong>总大小:</Text> {(uploadStats.totalSize / 1024 / 1024).toFixed(2)} MB
              </span>
              <span>
                <Text strong>已上传:</Text> {(uploadStats.uploadedSize / 1024 / 1024).toFixed(2)} MB
              </span>
            </Space>
          }
          type="info"
          style={{ marginBottom: 24 }}
        />

        <Divider orientation="left">基础用法</Divider>

        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card
              title={
              <Space>
                <CloudUploadOutlined />
                <span>基础文件上传</span>
              </Space>
            }
          >
              <COSBatchUploader
                config={basicConfig}
                cosConfig={cosConfig}
                onFileSelect={handleFileSelect}
                onUploadStart={handleUploadStart}
                onUploadProgress={handleUploadProgress}
                onUploadSuccess={handleUploadSuccess}
                onUploadError={handleUploadError}
                onUploadComplete={handleUploadComplete}
                onBeforeUpload={handleBeforeUpload}
                showConfig={true}
                showStatistics={true}
                showPreview={true}
              />
            </Card>
          </Col>
        </Row>

        <Divider orientation="left">不同场景配置</Divider>

        <Row gutter={[16, 16]}>
          {/* 高级配置上传 */}
          <Col span={12}>
            <Card
              title={
              <Space>
                <SettingOutlined />
                <span>高级配置上传</span>
              </Space>
            }
          >
              <COSBatchUploader
                config={advancedConfig}
                cosConfig={cosConfig}
                onFileSelect={(files) => console.log('高级模式选择文件:', files)}
                onUploadSuccess={(file, url) => console.log('高级模式上传成功:', file.name)}
                showConfig={true}
                showStatistics={true}
                showPreview={true}
              />
            </Card>
          </Col>

          {/* 图片专用上传 */}
          <Col span={12}>
            <Card
              title={
              <Space>
                <PictureOutlined />
                <span>图片批量上传</span>
              </Space>
            }
          >
              <COSBatchUploader
                config={imageConfig}
                cosConfig={cosConfig}
                onFileSelect={(files) => console.log('图片选择:', files)}
                onUploadSuccess={(file, url) => console.log('图片上传成功:', file.name)}
                showConfig={true}
                showStatistics={true}
                showPreview={true}
                listType="picture"
              />
            </Card>
          </Col>
        </Row>

        <Divider orientation="left">功能特性</Divider>

        <Row gutter={[16, 16]}>
          {/* 基础功能 */}
          <Col span={8}>
            <Card title="基础功能" size="small">
              <ul>
                <li>批量文件选择和拖拽上传</li>
                <li>支持多种文件类型</li>
                <li>实时上传进度显示</li>
                <li>文件大小和数量限制</li>
                <li>文件预览功能</li>
                <li>错误处理和重试机制</li>
              </ul>
            </Card>
          </Col>

          {/* 高级功能 */}
          <Col span={8}>
            <Card title="高级功能" size="small">
              <ul>
                <li>腾讯云COS直传</li>
                <li>分片上传和断点续传</li>
                <li>并发上传控制</li>
                <li>上传队列管理</li>
                <li>自定义上传配置</li>
                <li>上传前文件验证</li>
              </ul>
            </Card>
          </Col>

          {/* 用户体验 */}
          <Col span={8}>
            <Card title="用户体验" size="small">
              <ul>
                <li>直观的拖拽上传界面</li>
                <li>详细的进度信息显示</li>
                <li>文件预览和管理</li>
                <li>批量操作支持</li>
                <li>响应式设计</li>
                <li>可配置的上传参数</li>
              </ul>
            </Card>
          </Col>
        </Row>

        <Divider orientation="left">使用说明</Divider>

        <Card>
          <Title level={4}>基础配置</Title>
          <Paragraph>
            <pre>
{`import COSBatchUploader from '@/components/base/COSBatchUploader';

const cosConfig = {
  secretId: 'your-secret-id',
  secretKey: 'your-secret-key',
  bucket: 'your-bucket-name',
  region: 'ap-guangzhou'
};

<COSBatchUploader
  config={{
    maxFileSize: 100,      // 单文件最大100MB
    maxTotalSize: 1024,    // 总大小1GB
    concurrentUploads: 3   // 3个并发上传
  }}
  cosConfig={cosConfig}
  onUploadSuccess={(file, url) => {
    console.log('上传成功:', file.name, url);
  }}
/>`}
            </pre>
          </Paragraph>

          <Title level={4}>事件回调</Title>
          <ul>
            <li><Text code>onFileSelect</Text> - 文件选择时触发</li>
            <li><Text code>onUploadStart</Text> - 开始上传时触发</li>
            <li><Text code>onUploadProgress</Text> - 上传进度更新时触发</li>
            <li><Text code>onUploadSuccess</Text> - 上传成功时触发</li>
            <li><Text code>onUploadError</Text> - 上传失败时触发</li>
            <li><Text code>onUploadComplete</Text> - 全部上传完成时触发</li>
            <li><Text code>onBeforeUpload</Text> - 上传前验证，可阻止上传</li>
          </ul>

          <Title level={4}>文件类型支持</Title>
          <ul>
            <li><Text code>图片</Text> - jpg, png, gif, webp, svg 等 (最大20MB)</li>
            <li><Text code>视频</Text> - mp4, avi, mov, mkv 等 (最大500MB)</li>
            <li><Text code>音频</Text> - mp3, wav, flac, aac 等 (最大50MB)</li>
            <li><Text code>文档</Text> - pdf, doc, xls, ppt 等 (最大50MB)</li>
            <li><Text code>压缩包</Text> - zip, rar, 7z, tar 等 (最大200MB)</li>
            <li><Text code>其他</Text> - 任意文件类型 (最大100MB)</li>
          </ul>

          <Title level={4}>性能优化</Title>
          <ul>
            <li>大文件自动分片上传，支持断点续传</li>
            <li>并发上传控制，避免浏览器性能问题</li>
            <li>智能重试机制，提高上传成功率</li>
            <li>文件预览优化，减少内存占用</li>
            <li>上传进度实时计算，提供准确的时间预估</li>
          </ul>
        </Card>

        {/* 操作提示 */}
        <Alert
          message="操作提示"
          description={
            <ol>
              <li>点击上传区域或拖拽文件到上传区域进行文件选择</li>
              <li>支持批量选择多个文件，文件会在队列中依次上传</li>
              <li>可以暂停、继续、重试单个文件的上传</li>
              <li>点击配置按钮可以自定义上传参数</li>
              <li>上传成功的文件支持预览和下载</li>
              <li>统计信息会实时更新，显示上传进度和速度</li>
            </ol>
          }
          type="success"
          style={{ marginTop: 24 }}
        />
      </div>
    </div>
  );
}
