'use client';

import { Asset } from '@/types';
import { Image, Modal, message } from 'antd';
import {
  DownloadOutlined,
  DeleteOutlined,
  CopyOutlined,
  VideoCameraOutlined,
  FileZipOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import VideoPlayer from './VideoPlayer';

interface AssetCardProps {
  asset: Asset;
  onDelete: (assetId: string) => void;
}

/**
 * AssetCard - 素材卡片组件
 *
 * 艹，支持图片、视频、压缩包、文本四种类型！
 */
export default function AssetCard({ asset, onDelete }: AssetCardProps) {
  // 复制URL
  const handleCopyURL = () => {
    navigator.clipboard.writeText(asset.asset_url);
    message.success('已复制URL');
  };

  // 下载素材
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = asset.asset_url;
    link.download = `asset_${asset.id}`;
    link.click();
    message.success('开始下载');
  };

  // 删除素材
  const handleDelete = () => {
    Modal.confirm({
      title: '删除素材',
      content: (
        <div>
          <p>确定要删除此素材吗？</p>
          <p className="text-gray-500 text-sm mt-2">
            提示：建议仅删除数据库记录，保留云端文件
          </p>
        </div>
      ),
      okText: '仅删除记录',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => onDelete(asset.id)
    });
  };

  // 渲染素材预览
  const renderPreview = () => {
    switch (asset.asset_type) {
      case 'image':
        return (
          <Image
            src={asset.thumbnail_url || asset.asset_url}
            alt={asset.feature_display_name}
            className="w-full h-48 object-cover rounded-t-lg"
          />
        );

      case 'video':
        return (
          <div className="relative w-full h-48 bg-black/20 rounded-t-lg flex items-center justify-center">
            <VideoCameraOutlined className="text-6xl text-white/40" />
            {asset.thumbnail_url && (
              <img
                src={asset.thumbnail_url}
                alt="视频封面"
                className="absolute inset-0 w-full h-full object-cover rounded-t-lg"
              />
            )}
          </div>
        );

      case 'zip':
        return (
          <div className="w-full h-48 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-t-lg flex items-center justify-center">
            <FileZipOutlined className="text-6xl text-white/60" />
          </div>
        );

      case 'text':
        return (
          <div className="w-full h-48 bg-gradient-to-br from-green-500/20 to-teal-500/20 rounded-t-lg flex items-center justify-center">
            <FileTextOutlined className="text-6xl text-white/60" />
          </div>
        );

      default:
        return <div className="w-full h-48 bg-white/5 rounded-t-lg" />;
    }
  };

  return (
    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg shadow-xl overflow-hidden group">
      {/* 预览区域 */}
      {renderPreview()}

      {/* 信息区域 */}
      <div className="p-4">
        {/* 类型标签 */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`
            text-xs px-2 py-1 rounded-full
            ${asset.asset_type === 'image' ? 'bg-cyan-500/20 border border-cyan-400/50 text-cyan-300' :
              asset.asset_type === 'video' ? 'bg-purple-500/20 border border-purple-400/50 text-purple-300' :
              asset.asset_type === 'zip' ? 'bg-pink-500/20 border border-pink-400/50 text-pink-300' :
              'bg-green-500/20 border border-green-400/50 text-green-300'}
          `}>
            {asset.asset_type === 'image' ? '图片' :
             asset.asset_type === 'video' ? '视频' :
             asset.asset_type === 'zip' ? '压缩包' : '文本'}
          </span>
        </div>

        {/* 来源功能 */}
        <p className="text-white text-sm font-medium mb-1">{asset.feature_display_name}</p>

        {/* 创建时间 */}
        <p className="text-white/60 text-xs mb-3">
          {new Date(asset.created_at).toLocaleString('zh-CN')}
        </p>

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            className="flex-1 py-2 text-xs
              border border-cyan-400/50
              bg-cyan-500/20
              text-cyan-300
              rounded
              hover:bg-cyan-400/30
              transition-all duration-300"
          >
            <DownloadOutlined className="mr-1" />
            下载
          </button>
          <button
            onClick={handleCopyURL}
            className="flex-1 py-2 text-xs
              border border-teal-400/50
              bg-teal-500/20
              text-teal-300
              rounded
              hover:bg-teal-400/30
              transition-all duration-300"
          >
            <CopyOutlined className="mr-1" />
            复制
          </button>
          <button
            onClick={handleDelete}
            className="py-2 px-3 text-xs
              border border-rose-400/50
              bg-rose-500/20
              text-rose-300
              rounded
              hover:bg-rose-400/30
              transition-all duration-300"
          >
            <DeleteOutlined />
          </button>
        </div>
      </div>
    </div>
  );
}
