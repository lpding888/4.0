'use client';

import { Referral } from '@/types';
import { UserOutlined, CheckCircleOutlined } from '@ant-design/icons';

interface ReferralCardProps {
  referral: Referral;
}

/**
 * ReferralCard - 推广用户卡片组件
 *
 * 艹！用于展示推广的用户信息和佣金状态！
 */
export default function ReferralCard({ referral }: ReferralCardProps) {
  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div
      className="
        bg-white/10 backdrop-blur-md
        border border-white/10
        rounded-xl shadow-lg
        p-4
        flex items-center justify-between
        transition-all duration-300
        hover:bg-white/15 hover:border-white/20
      "
    >
      {/* 用户信息 */}
      <div className="flex items-center gap-4">
        {/* 头像 */}
        <div
          className="
            w-12 h-12
            flex items-center justify-center
            bg-gradient-to-br from-cyan-500/30 to-blue-500/30
            border border-cyan-400/50
            rounded-full
          "
        >
          {referral.avatar ? (
            <img
              src={referral.avatar}
              alt="avatar"
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <UserOutlined className="text-2xl text-cyan-300" />
          )}
        </div>

        {/* 用户详情 */}
        <div>
          <div className="text-white font-medium mb-1">
            {referral.phone}
          </div>
          <div className="text-sm text-white/60">
            注册于 {formatDate(referral.registeredAt)}
          </div>
        </div>
      </div>

      {/* 佣金状态 */}
      <div className="text-right">
        {referral.hasPaid ? (
          <>
            <div className="text-2xl font-bold text-green-400 mb-1">
              +¥{referral.commissionAmount?.toFixed(2) || '0.00'}
            </div>
            <div className="flex items-center gap-1 text-xs text-green-300">
              <CheckCircleOutlined />
              <span>已购买</span>
            </div>
          </>
        ) : (
          <div className="text-sm text-white/40">
            未购买
          </div>
        )}
      </div>
    </div>
  );
}
