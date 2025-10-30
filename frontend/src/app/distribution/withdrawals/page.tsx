'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spin, message, Empty } from 'antd';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { WithdrawalsResponse } from '@/types';
import WithdrawalCard from '@/components/distribution/WithdrawalCard';

/**
 * 提现记录页面
 *
 * 艹！展示所有提现申请历史！
 */
export default function WithdrawalsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<WithdrawalsResponse | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    fetchWithdrawals();
  }, [user, router]);

  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      const response: any = await api.distribution.getWithdrawals({ limit: 100 });

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
          提现记录
        </h1>

        {/* 提现记录列表 */}
        {loading ? (
          <div className="text-center py-20">
            <Spin size="large" tip="加载中..." />
          </div>
        ) : data && data.withdrawals.length > 0 ? (
          <div className="space-y-4">
            {data.withdrawals.map((withdrawal) => (
              <WithdrawalCard key={withdrawal.id} withdrawal={withdrawal} />
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
                <span className="text-white/60">暂无提现记录</span>
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
