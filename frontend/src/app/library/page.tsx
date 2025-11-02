'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Select,
  Input,
  DatePicker,
  Empty,
  Spin,
  message,
  Button
} from 'antd';
import { SearchOutlined, DownloadOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Asset } from '@/types';
import AssetCard from '@/components/AssetCard';

const { RangePicker } = DatePicker;

/**
 * 素材库页面
 *
 * 艹，展示用户所有自动保存的任务结果！
 */
export default function LibraryPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([]);

  // 筛选条件
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');

  // 获取素材库
  const fetchAssets = async () => {
    try {
      setLoading(true);
      const response: any = await api.assets.getAll({ userId: 'me' });

      if (response.success && response.assets) {
        setAssets(response.assets);
        setFilteredAssets(response.assets);
      }
    } catch (error: any) {
      message.error('获取素材库失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    fetchAssets();
  }, [user, router]);

  // 应用筛选
  useEffect(() => {
    let filtered = [...assets];

    // 按类型筛选
    if (typeFilter !== 'all') {
      filtered = filtered.filter((asset) => asset.asset_type === typeFilter);
    }

    // 按搜索文本筛选
    if (searchText) {
      filtered = filtered.filter(
        (asset) =>
          asset.feature_display_name.toLowerCase().includes(searchText.toLowerCase()) ||
          asset.id.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    setFilteredAssets(filtered);
  }, [typeFilter, searchText, assets]);

  // 删除素材
  const handleDelete = async (assetId: string) => {
    try {
      await api.assets.delete(assetId, { delete_cos_file: false });
      message.success('素材已删除');
      fetchAssets(); // 刷新列表
    } catch (error: any) {
      message.error('删除失败');
    }
  };

  // 批量下载（TODO: 实现）
  const handleBatchDownload = () => {
    message.info('批量下载功能开发中');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gradient-to-br from-slate-900 via-blue-950 to-emerald-950">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-emerald-950 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* 标题栏 */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-light text-white">素材库</h1>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleBatchDownload}
            className="border-white/20 text-white hover:bg-white/10"
          >
            批量下载
          </Button>
        </div>

        {/* 筛选栏 */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-xl p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 类型筛选 */}
            <Select
              value={typeFilter}
              onChange={setTypeFilter}
              className="w-full"
              placeholder="按素材类型筛选"
            >
              <Select.Option value="all">全部类型</Select.Option>
              <Select.Option value="image">图片</Select.Option>
              <Select.Option value="video">视频</Select.Option>
              <Select.Option value="zip">压缩包</Select.Option>
              <Select.Option value="text">文本</Select.Option>
            </Select>

            {/* 搜索 */}
            <Input
              prefix={<SearchOutlined />}
              placeholder="搜索素材ID或功能名称"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="bg-white/10 border-white/20 text-white"
            />

            {/* 时间筛选（TODO: 实现）*/}
            <RangePicker
              className="w-full"
              placeholder={['开始时间', '结束时间']}
            />
          </div>

          {/* 统计信息 */}
          <div className="mt-4 text-white/60 text-sm">
            共 {filteredAssets.length} 个素材
            {typeFilter !== 'all' && ` · 已筛选: ${typeFilter === 'image' ? '图片' :
              typeFilter === 'video' ? '视频' :
              typeFilter === 'zip' ? '压缩包' : '文本'}`}
            {searchText && ` · 搜索: ${searchText}`}
          </div>
        </div>

        {/* 素材网格 */}
        {filteredAssets.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-xl p-12 text-center">
            <Empty
              description={
                <span className="text-white/60">
                  {assets.length === 0 ? '暂无素材' : '没有符合条件的素材'}
                </span>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAssets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
