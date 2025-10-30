'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Spin, message, Empty } from 'antd';
import {
  UserOutlined,
  DollarOutlined,
  WalletOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { DistributorStatusInfo, DistributionDashboard } from '@/types';
import DistributorCard from '@/components/distribution/DistributorCard';
import StatCard from '@/components/distribution/StatCard';

/**
 * 分销中心首页
 *
 * 艹！这是分销员的控制台，展示数据概览、邀请码、快捷操作！
 */
export default function DistributionDashboardPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<DistributorStatusInfo | null>(null);
  const [dashboard, setDashboard] = useState<DistributionDashboard | null>(null);

  // 检查登录
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    fetchData();
  }, [user, router]);

  // 获取数据
  const fetchData = async () => {
    try {
      setLoading(true);

      // 并行获取状态和数据
      const [statusRes, dashboardRes]: any[] = await Promise.all([
        api.distribution.getStatus(),
        api.distribution.getDashboard()
      ]);

      if (statusRes.success && statusRes.data) {
        setStatus(statusRes.data);

        // 如果是pending状态，跳转到待审核页面
        if (statusRes.data.status === 'pending') {
          // 可以在这里显示待审核状态
        }
      }

      if (dashboardRes.success && dashboardRes.data) {
        setDashboard(dashboardRes.data);
      }
    } catch (error: any) {
      message.error(error.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载中
  if (loading) {
    return (
      <div
        className="
          min-h-screen
          bg-gradient-to-br from-slate-900 via-blue-950 to-emerald-950
          flex items-center justify-center
        "
      >
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  // 待审核状态
  if (status?.status === 'pending') {
    return (
      <div
        className="
          min-h-screen
          bg-gradient-to-br from-slate-900 via-blue-950 to-emerald-950
          py-12 px-4
        "
      >
        <div className="container mx-auto max-w-2xl text-center">
          <div
            className="
              backdrop-blur-md bg-white/5
              border border-white/10
              rounded-2xl shadow-2xl
              p-12
            "
          >
            <div className="text-6xl mb-6">⏳</div>
            <h2 className="text-3xl font-light text-white mb-4">
              申请审核中
            </h2>
            <p className="text-white/60 mb-8">
              您的分销员申请正在审核中，我们将在1-3个工作日内完成审核。
              <br />
              审核通过后，您将收到通知并获得专属邀请码。
            </p>
            <button
              onClick={() => router.push('/workspace')}
              className="
                px-6 py-3
                rounded-lg
                border border-cyan-400/50
                bg-cyan-500/10
                text-cyan-300
                font-medium
                transition-all duration-300
                hover:bg-cyan-400/20 hover:border-cyan-300
              "
            >
              返回工作台
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 未激活或禁用状态
  if (status?.status !== 'active') {
    return (
      <div
        className="
          min-h-screen
          bg-gradient-to-br from-slate-900 via-blue-950 to-emerald-950
          py-12 px-4
        "
      >
        <div className="container mx-auto max-w-2xl text-center">
          <div
            className="
              backdrop-blur-md bg-white/5
              border border-white/10
              rounded-2xl shadow-2xl
              p-12
            "
          >
            <div className="text-6xl mb-6">🚫</div>
            <h2 className="text-3xl font-light text-white mb-4">
              分销员未激活
            </h2>
            <p className="text-white/60 mb-8">
              您的分销员账号未激活或已被禁用。
              <br />
              如有疑问，请联系客服。
            </p>
            <button
              onClick={() => router.push('/workspace')}
              className="
                px-6 py-3
                rounded-lg
                border border-cyan-400/50
                bg-cyan-500/10
                text-cyan-300
                font-medium
                transition-all duration-300
                hover:bg-cyan-400/20 hover:border-cyan-300
              "
            >
              返回工作台
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="
        min-h-screen
        bg-gradient-to-br from-slate-900 via-blue-950 to-emerald-950
        py-12 px-4
      "
    >
      <div className="container mx-auto max-w-7xl">
        {/* 标题 */}
        <h1 className="text-4xl font-light text-white mb-8">
          分销中心
        </h1>

        {/* 分销员身份卡片 */}
        {status?.inviteCode && status?.inviteLink && (
          <div className="mb-8">
            <DistributorCard
              inviteCode={status.inviteCode}
              inviteLink={status.inviteLink}
            />
          </div>
        )}

        {/* 数据概览 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="推广人数"
            value={dashboard?.totalReferrals || 0}
            icon={<UserOutlined className="text-4xl" />}
            color="blue"
          />
          <StatCard
            label="累计佣金"
            value={`¥${(dashboard?.totalCommission || 0).toFixed(2)}`}
            icon={<DollarOutlined className="text-4xl" />}
            color="green"
          />
          <StatCard
            label="可提现"
            value={`¥${(dashboard?.availableCommission || 0).toFixed(2)}`}
            icon={<WalletOutlined className="text-4xl" />}
            color="cyan"
          />
          <StatCard
            label="已提现"
            value={`¥${(dashboard?.withdrawnCommission || 0).toFixed(2)}`}
            icon={<CheckCircleOutlined className="text-4xl" />}
            color="purple"
          />
        </div>

        {/* 快捷操作 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 我的推广 */}
          <Link href="/distribution/referrals">
            <div
              className="
                bg-white/10 backdrop-blur-md
                border border-white/10
                rounded-2xl shadow-xl
                p-6
                text-center
                transition-all duration-300
                hover:bg-white/15 hover:border-cyan-400/50
                hover:shadow-2xl
                cursor-pointer
              "
            >
              <UserOutlined className="text-5xl text-blue-400 mb-3" />
              <h3 className="text-xl font-light text-white mb-2">
                我的推广
              </h3>
              <p className="text-sm text-white/60">
                查看推广用户列表
              </p>
            </div>
          </Link>

          {/* 佣金明细 */}
          <Link href="/distribution/commissions">
            <div
              className="
                bg-white/10 backdrop-blur-md
                border border-white/10
                rounded-2xl shadow-xl
                p-6
                text-center
                transition-all duration-300
                hover:bg-white/15 hover:border-green-400/50
                hover:shadow-2xl
                cursor-pointer
              "
            >
              <DollarOutlined className="text-5xl text-green-400 mb-3" />
              <h3 className="text-xl font-light text-white mb-2">
                佣金明细
              </h3>
              <p className="text-sm text-white/60">
                查看佣金收入记录
              </p>
            </div>
          </Link>

          {/* 申请提现 */}
          <Link href="/distribution/withdraw/new">
            <div
              className={`
                bg-white/10 backdrop-blur-md
                border border-white/10
                rounded-2xl shadow-xl
                p-6
                text-center
                transition-all duration-300
                cursor-pointer
                ${
                  (dashboard?.availableCommission || 0) >= 100
                    ? 'hover:bg-white/15 hover:border-cyan-400/50 hover:shadow-2xl'
                    : 'opacity-50 cursor-not-allowed'
                }
              `}
            >
              <WalletOutlined className="text-5xl text-cyan-400 mb-3" />
              <h3 className="text-xl font-light text-white mb-2">
                申请提现
              </h3>
              <p className="text-sm text-white/60">
                {(dashboard?.availableCommission || 0) >= 100
                  ? '立即提现佣金'
                  : '最低提现¥100'}
              </p>
            </div>
          </Link>
        </div>

        {/* 返回按钮 */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/workspace')}
            className="
              text-cyan-400 text-sm
              hover:text-cyan-300
              transition-colors duration-300
            "
          >
            ← 返回工作台
          </button>
        </div>
      </div>
    </div>
  );
}
