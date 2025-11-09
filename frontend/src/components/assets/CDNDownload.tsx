'use client';

/**
 * CDN下载组件
 * 艹！这个组件支持重试、进度显示、CDN命中追踪！
 *
 * @author 老王
 */

import React, { useState } from 'react';
import { Button, Progress, Space, Typography, message, Tooltip } from 'antd';
import {
  DownloadOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { cdnUtil } from '@/lib/assets/url';

const { Text } = Typography;

/**
 * 下载状态
 */
type DownloadStatus = 'idle' | 'downloading' | 'success' | 'error';

/**
 * CDN下载Props
 */
interface CDNDownloadProps {
  url: string; // COS URL
  filename?: string; // 下载文件名
  signed?: boolean; // 是否使用签名URL
  maxRetries?: number; // 最大重试次数，默认3
  onSuccess?: (blob: Blob) => void;
  onError?: (error: Error) => void;
  showProgress?: boolean; // 是否显示进度，默认true
  buttonProps?: any; // 按钮属性
}

/**
 * CDN下载组件
 */
export const CDNDownload: React.FC<CDNDownloadProps> = ({
  url,
  filename,
  signed = false,
  maxRetries = 3,
  onSuccess,
  onError,
  showProgress = true,
  buttonProps,
}) => {
  const [status, setStatus] = useState<DownloadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [cdnHit, setCdnHit] = useState<boolean | null>(null);

  /**
   * 下载文件
   */
  const handleDownload = async (retryAttempt = 0) => {
    setStatus('downloading');
    setProgress(0);
    setRetryCount(retryAttempt);

    try {
      // 转换为CDN URL
      const cdnUrl = cdnUtil.toCDN(url, { signed });

      console.log('[CDNDownload] 开始下载:', cdnUrl);

      // 发送下载请求
      const response = await fetch(cdnUrl);

      if (!response.ok) {
        throw new Error(`下载失败: ${response.status} ${response.statusText}`);
      }

      // 检查CDN命中
      const isCdnHit = response.headers.get('x-cache-status') === 'HIT';
      setCdnHit(isCdnHit);
      cdnUtil.trackHit(cdnUrl, isCdnHit);

      // 获取总大小
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      // 读取响应流
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应流');
      }

      const chunks: BlobPart[] = [];
      let loaded = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        if (!value) {
          continue;
        }

        chunks.push(value.buffer.slice(0));
        loaded += value.length;

        if (total > 0) {
          setProgress(Math.round((loaded / total) * 100));
        }
      }

      // 合并数据
      const blob = new Blob(chunks);

      // 触发下载
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename || url.split('/').pop() || 'download';
      a.click();
      URL.revokeObjectURL(downloadUrl);

      setStatus('success');
      setProgress(100);
      message.success('下载完成');

      if (onSuccess) {
        onSuccess(blob);
      }
    } catch (error: any) {
      console.error('[CDNDownload] 下载失败:', error);

      // 重试逻辑
      if (retryAttempt < maxRetries) {
        message.warning(`下载失败，正在重试 (${retryAttempt + 1}/${maxRetries})...`);
        setTimeout(() => {
          handleDownload(retryAttempt + 1);
        }, 1000 * (retryAttempt + 1)); // 指数退避
      } else {
        setStatus('error');
        message.error(`下载失败: ${error.message}`);

        if (onError) {
          onError(error);
        }
      }
    }
  };

  /**
   * 重试下载
   */
  const handleRetry = () => {
    handleDownload(0);
  };

  /**
   * 状态图标
   */
  const getStatusIcon = () => {
    switch (status) {
      case 'downloading':
        return <DownloadOutlined spin />;
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'error':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return <DownloadOutlined />;
    }
  };

  /**
   * 按钮文本
   */
  const getButtonText = () => {
    switch (status) {
      case 'downloading':
        return `下载中... ${progress}%`;
      case 'success':
        return '下载完成';
      case 'error':
        return '下载失败';
      default:
        return '下载';
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Space>
        <Button
          type="primary"
          icon={getStatusIcon()}
          onClick={handleDownload}
          loading={status === 'downloading'}
          disabled={status === 'downloading'}
          {...buttonProps}
        >
          {getButtonText()}
        </Button>

        {status === 'error' && (
          <Button icon={<ReloadOutlined />} onClick={handleRetry}>
            重试
          </Button>
        )}

        {cdnHit !== null && (
          <Tooltip title={cdnHit ? 'CDN缓存命中' : 'CDN缓存未命中'}>
            <ThunderboltOutlined style={{ color: cdnHit ? '#52c41a' : '#faad14', fontSize: 16 }} />
          </Tooltip>
        )}
      </Space>

      {showProgress && status === 'downloading' && (
        <div>
          <Progress percent={progress} status="active" />
          {retryCount > 0 && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              重试次数: {retryCount}/{maxRetries}
            </Text>
          )}
        </div>
      )}

      {status === 'success' && cdnHit !== null && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {cdnHit ? '✓ CDN加速下载' : '⚠ 回源下载'}
        </Text>
      )}
    </Space>
  );
};

/**
 * 批量下载组件Props
 */
interface BatchCDNDownloadProps {
  urls: string[]; // COS URL列表
  signed?: boolean;
  onAllComplete?: () => void;
}

/**
 * 批量下载组件
 */
export const BatchCDNDownload: React.FC<BatchCDNDownloadProps> = ({
  urls,
  signed = false,
  onAllComplete,
}) => {
  const [downloadStatus, setDownloadStatus] = useState<Record<string, DownloadStatus>>({});
  const [downloading, setDownloading] = useState(false);

  /**
   * 批量下载
   */
  const handleBatchDownload = async () => {
    setDownloading(true);

    const results: Record<string, DownloadStatus> = {};

    for (const url of urls) {
      try {
        const cdnUrl = cdnUtil.toCDN(url, { signed });
        const response = await fetch(cdnUrl);

        if (!response.ok) {
          throw new Error(`下载失败: ${response.status}`);
        }

        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = url.split('/').pop() || 'download';
        a.click();
        URL.revokeObjectURL(downloadUrl);

        results[url] = 'success';
        setDownloadStatus({ ...results });

        // 追踪CDN命中
        const isCdnHit = response.headers.get('x-cache-status') === 'HIT';
        cdnUtil.trackHit(cdnUrl, isCdnHit);

        // 延迟避免浏览器拦截
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error('[BatchCDNDownload] 下载失败:', url, error);
        results[url] = 'error';
        setDownloadStatus({ ...results });
      }
    }

    setDownloading(false);

    const successCount = Object.values(results).filter((s) => s === 'success').length;
    message.success(`批量下载完成: ${successCount}/${urls.length} 成功`);

    if (onAllComplete) {
      onAllComplete();
    }
  };

  const successCount = Object.values(downloadStatus).filter((s) => s === 'success').length;
  const errorCount = Object.values(downloadStatus).filter((s) => s === 'error').length;

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Button
        type="primary"
        icon={<DownloadOutlined />}
        onClick={handleBatchDownload}
        loading={downloading}
        disabled={downloading}
      >
        批量下载 ({urls.length} 个文件)
      </Button>

      {(successCount > 0 || errorCount > 0) && (
        <div>
          <Text>
            成功: <Text type="success">{successCount}</Text> / 失败:{' '}
            <Text type="danger">{errorCount}</Text> / 总数: {urls.length}
          </Text>
        </div>
      )}
    </Space>
  );
};
