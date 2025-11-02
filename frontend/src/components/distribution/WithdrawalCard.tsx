'use client';

import { Withdrawal } from '@/types';
import StatusBadge from './StatusBadge';
import { WalletOutlined, AlipayCircleOutlined } from '@ant-design/icons';

interface WithdrawalCardProps {
  withdrawal: Withdrawal;
}

/**
 * WithdrawalCard - 提现记录卡片组件
 *
 * 艹！用于展示提现申请的详细信息！
 */
export default function WithdrawalCard({ withdrawal }: WithdrawalCardProps) {
  // 格式化日期时间
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 根据提现方式返回图标
  const getMethodIcon = () => {
    if (withdrawal.method === 'wechat') {
      return <WalletOutlined className="text-green-400 text-xl" />;
    }
    return <AlipayCircleOutlined className="text-blue-400 text-xl" />;
  };

  // 根据提现方式返回文本
  const getMethodText = () => {
    if (withdrawal.method === 'wechat') {
      return '微信零钱';
    }
    return '支付宝';
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
        {/* 提现信息 */}
        <div className="flex-1">
          <div className="text-3xl font-bold text-white mb-3">
            ¥{withdrawal.amount.toFixed(2)}
          </div>

          <div className="flex items-center gap-2 text-sm text-white/60 mb-1">
            {getMethodIcon()}
            <span>{getMethodText()}</span>
          </div>

          <div className="text-xs text-white/50 mb-2">
            申请时间: {formatDateTime(withdrawal.createdAt)}
          </div>

          {/* 拒绝原因 */}
          {withdrawal.status === 'rejected' && withdrawal.rejectReason && (
            <div
              className="
                mt-3 p-2
                bg-rose-500/20 border border-rose-400/50
                rounded text-xs text-rose-300
              "
            >
              拒绝原因: {withdrawal.rejectReason}
            </div>
          )}
        </div>

        {/* 状态 */}
        <div className="text-right">
          <StatusBadge status={withdrawal.status} type="withdrawal" />

          {withdrawal.status === 'approved' && withdrawal.approvedAt && (
            <div className="text-xs text-white/50 mt-2">
              审核通过时间<br />
              {formatDateTime(withdrawal.approvedAt)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
