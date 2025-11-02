'use client';

import { Commission } from '@/types';
import { formatCurrency } from '@/utils/number';
import StatusBadge from './StatusBadge';

interface CommissionCardProps {
  commission: Commission;
}

/**
 * CommissionCard - 佣金记录卡片组件
 *
 * 艹！用于展示单条佣金记录的详细信息！
 */
export default function CommissionCard({ commission }: CommissionCardProps) {
  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  return (
    <div
      className="
        bg-white/10 backdrop-blur-md
        border border-white/10
        rounded-xl shadow-lg
        p-4
        transition-all duration-300
        hover:bg-white/15 hover:border-white/20
      "
    >
      <div className="flex justify-between items-start">
        {/* 订单信息 */}
        <div className="flex-1">
          <div className="text-white font-medium mb-1">
            订单 {commission.orderId}
          </div>
          {commission.referredUserPhone && (
            <div className="text-sm text-white/60 mb-1">
              用户 {commission.referredUserPhone}
            </div>
          )}
          <div className="text-sm text-white/60">
            订单金额 ¥{formatCurrency(commission.orderAmount)}
          </div>
        </div>

        {/* 佣金金额和状态 */}
        <div className="text-right">
          <div className="text-2xl font-bold text-green-400 mb-2">
            +¥{formatCurrency(commission.commissionAmount)}
          </div>
          <StatusBadge status={commission.status} type="commission" />
        </div>
      </div>

      {/* 时间信息 */}
      <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/50">
        {commission.status === 'frozen' && commission.freezeUntil ? (
          `冻结至 ${formatDate(commission.freezeUntil)}`
        ) : commission.status === 'settled' && commission.settledAt ? (
          `到账于 ${formatDate(commission.settledAt)}`
        ) : (
          `创建于 ${formatDate(commission.createdAt)}`
        )}
      </div>
    </div>
  );
}
