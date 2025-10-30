'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spin, message, Empty } from 'antd';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { CommissionsResponse, CommissionStatus } from '@/types';
import CommissionCard from '@/components/distribution/CommissionCard';

/**
 * 佣金明细页面
 *
 * 艹！展示所有佣金记录，支持筛选！
 */
export default function CommissionsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<'all' | CommissionStatus>('all');
  const [data, setData] = useState<CommissionsResponse | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    fetchCommissions();
  }, [user, activeStatus, router]);

  const fetchCommissions = async () => {
    try {
      setLoading(true);
      const statusParam = activeStatus === 'all' ? undefined : activeStatus;
      const response: any = await api.distribution.getCommissions({
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
          佣金明细
        </h1>

        {/* 筛选按钮 */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveStatus('all')}
            className={`
              px-4 py-2 rounded-lg
              border
              text-sm font-medium
              transition-all duration-300
              ${activeStatus === 'all'
                ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300'
                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
              }
            `}
          >
            全部
          </button>
          <button
            onClick={() => setActiveStatus('frozen')}
            className={`
              px-4 py-2 rounded-lg
              border
              text-sm font-medium
              transition-all duration-300
              ${activeStatus === 'frozen'
                ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300'
                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
              }
            `}
          >
            冻结中
          </button>
          <button
            onClick={() => setActiveStatus('settled')}
            className={`
              px-4 py-2 rounded-lg
              border
              text-sm font-medium
              transition-all duration-300
              ${activeStatus === 'settled'
                ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300'
                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
              }
            `}
          >
            已到账
          </button>
        </div>

        {/* 佣金记录列表 */}
        {loading ? (
          <div className="text-center py-20">
            <Spin size="large" tip="加载中..." />
          </div>
        ) : data && data.commissions.length > 0 ? (
          <div className="space-y-4">
            {data.commissions.map((commission) => (
              <CommissionCard key={commission.id} commission={commission} />
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
                <span className="text-white/60">暂无佣金记录</span>
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
