'use client';

import { DistributorStatus, CommissionStatus, WithdrawalStatus } from '@/types';

interface StatusBadgeProps {
  status: DistributorStatus | CommissionStatus | WithdrawalStatus | string;
  type?: 'distributor' | 'commission' | 'withdrawal';
}

/**
 * StatusBadge - 状态标签组件
 *
 * 艹！这个组件必须遵循青蓝玻璃拟态主题的小胶囊设计！
 * 不同状态用不同霓虹色系！
 */
export default function StatusBadge({ status, type = 'distributor' }: StatusBadgeProps) {
  // 根据状态类型和值返回样式配置
  const getStatusStyle = () => {
    // 分销员状态
    if (type === 'distributor') {
      switch (status) {
        case 'pending':
          return {
            text: '待审核',
            className: 'bg-amber-500/20 border-amber-400/50 text-amber-300'
          };
        case 'active':
          return {
            text: '已激活',
            className: 'bg-teal-500/20 border-teal-400/50 text-teal-300'
          };
        case 'disabled':
          return {
            text: '已禁用',
            className: 'bg-rose-500/20 border-rose-400/50 text-rose-300'
          };
        case 'none':
          return {
            text: '未申请',
            className: 'bg-white/5 border-white/10 text-white/30'
          };
        default:
          return {
            text: status,
            className: 'bg-white/5 border-white/10 text-white/60'
          };
      }
    }

    // 佣金状态
    if (type === 'commission') {
      switch (status) {
        case 'frozen':
          return {
            text: '冻结中',
            className: 'bg-blue-500/20 border-blue-400/50 text-blue-300'
          };
        case 'settled':
          return {
            text: '已到账',
            className: 'bg-teal-500/20 border-teal-400/50 text-teal-300'
          };
        case 'withdrawn':
          return {
            text: '已提现',
            className: 'bg-purple-500/20 border-purple-400/50 text-purple-300'
          };
        default:
          return {
            text: status,
            className: 'bg-white/5 border-white/10 text-white/60'
          };
      }
    }

    // 提现状态
    if (type === 'withdrawal') {
      switch (status) {
        case 'pending':
          return {
            text: '待审核',
            className: 'bg-amber-500/20 border-amber-400/50 text-amber-300'
          };
        case 'approved':
          return {
            text: '已通过',
            className: 'bg-teal-500/20 border-teal-400/50 text-teal-300'
          };
        case 'rejected':
          return {
            text: '已拒绝',
            className: 'bg-rose-500/20 border-rose-400/50 text-rose-300'
          };
        default:
          return {
            text: status,
            className: 'bg-white/5 border-white/10 text-white/60'
          };
      }
    }

    return {
      text: status,
      className: 'bg-white/5 border-white/10 text-white/60'
    };
  };

  const { text, className } = getStatusStyle();

  return (
    <span
      className={`
        inline-flex items-center justify-center
        px-3 py-1
        rounded-full
        border
        text-xs font-medium
        ${className}
      `}
    >
      {text}
    </span>
  );
}
