'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spin, message, Empty, Tabs } from 'antd';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { ReferralsResponse } from '@/types';
import ReferralCard from '@/components/distribution/ReferralCard';

/**
 * 我的推广页面
 *
 * 艹！展示所有推广用户列表，支持筛选！
 */
export default function ReferralsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [data, setData] = useState<ReferralsResponse | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    fetchReferrals();
  }, [user, activeTab, router]);

  const fetchReferrals = async () => {
    try {
      setLoading(true);
      const statusParam = activeTab === 'all' ? undefined : activeTab;
      const response: any = await api.distribution.getReferrals({
        status: statusParam,
        limit: 100
      });

      if (response.success && response.data) {
        setData(response.data);
      }
    } catch (error: any) {
      message.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="
        min-h-screen
        bg-gradient-to-br from-slate-900 via-blue-950 to-emerald-950
        py-12 px-4
      "
    >
      <div className="container mx-auto max-w-4xl">
        <h1 className="text-4xl font-light text-white mb-8">
          我的推广
        </h1>

        {/* Tab切换 */}
        <div className="mb-6">
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as any)}
            items={[
              {
                key: 'all',
                label: (
                  <span className="text-white">
                    全部 ({data?.total || 0})
                  </span>
                )
              },
              {
                key: 'paid',
                label: <span className="text-white">已购买</span>
              },
              {
                key: 'unpaid',
                label: <span className="text-white">未购买</span>
              }
            ]}
            className="custom-tabs"
          />
        </div>

        {/* 推广用户列表 */}
        {loading ? (
          <div className="text-center py-20">
            <Spin size="large" tip="加载中..." />
          </div>
        ) : data && data.referrals.length > 0 ? (
          <div className="space-y-4">
            {data.referrals.map((referral) => (
              <ReferralCard key={referral.userId} referral={referral} />
            ))}
          </div>
        ) : (
          <div
            className="
              backdrop-blur-md bg-white/5
              border border-white/10
              rounded-2xl
              p-12
              text-center
            "
          >
            <Empty
              description={
                <span className="text-white/60">
                  {activeTab === 'all' ? '暂无推广用户' : `暂无${activeTab === 'paid' ? '已购买' : '未购买'}用户`}
                </span>
              }
            />
          </div>
        )}

        {/* 返回按钮 */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/distribution/dashboard')}
            className="
              text-cyan-400 text-sm
              hover:text-cyan-300
              transition-colors duration-300
            "
          >
            ← 返回分销中心
          </button>
        </div>
      </div>
    </div>
  );
}
