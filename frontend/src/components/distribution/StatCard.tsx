'use client';

import { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  color?: 'blue' | 'green' | 'cyan' | 'purple' | 'orange' | 'red';
  trend?: string; // 例如 "+12"
  count?: number; // 次要数值（例如待审核数量）
}

/**
 * StatCard - 数据统计卡片组件
 *
 * 艹！这个组件用于展示分销数据统计，必须遵循青蓝玻璃拟态主题！
 */
export default function StatCard({
  label,
  value,
  icon,
  color = 'cyan',
  trend,
  count
}: StatCardProps) {
  // 根据颜色返回样式
  const getColorClass = () => {
    const colors = {
      blue: {
        text: 'text-blue-400',
        bg: 'bg-blue-500/20',
        border: 'border-blue-400/50'
      },
      green: {
        text: 'text-green-400',
        bg: 'bg-green-500/20',
        border: 'border-green-400/50'
      },
      cyan: {
        text: 'text-cyan-400',
        bg: 'bg-cyan-500/20',
        border: 'border-cyan-400/50'
      },
      purple: {
        text: 'text-purple-400',
        bg: 'bg-purple-500/20',
        border: 'border-purple-400/50'
      },
      orange: {
        text: 'text-orange-400',
        bg: 'bg-orange-500/20',
        border: 'border-orange-400/50'
      },
      red: {
        text: 'text-rose-400',
        bg: 'bg-rose-500/20',
        border: 'border-rose-400/50'
      }
    };
    return colors[color] || colors.cyan;
  };

  const colorClass = getColorClass();

  return (
    <div
      className={`
        bg-white/10 backdrop-blur-md
        border ${colorClass.border}
        rounded-2xl shadow-xl
        p-6
        transition-all duration-300
        hover:shadow-2xl
      `}
    >
      {/* 图标（如果有）*/}
      {icon && (
        <div className={`mb-4 ${colorClass.text}`}>
          {icon}
        </div>
      )}

      {/* 标签 */}
      <div className="text-sm text-white/60 mb-2">{label}</div>

      {/* 主要数值 */}
      <div className={`text-3xl font-bold ${colorClass.text} mb-2`}>
        {value}
      </div>

      {/* 趋势或次要数值 */}
      {(trend || count !== undefined) && (
        <div className="flex items-center gap-2 text-xs">
          {trend && (
            <span className={`${colorClass.text} font-medium`}>
              {trend}
            </span>
          )}
          {count !== undefined && (
            <span className="text-white/60">
              ({count}笔)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
