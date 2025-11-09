'use client';

import { Feature } from '@/types';
import { useRouter } from 'next/navigation';
import {
  ThunderboltOutlined,
  CrownOutlined,
  VideoCameraOutlined,
  AppstoreOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';

interface FeatureCardProps {
  feature: Feature;
  disabled?: boolean;
  onUpgrade?: () => void;
}

/**
 * FeatureCard - 功能卡片组件
 *
 * 遵循青蓝玻璃拟态主题的高奢时装AI控制台风格
 * 艹，这个组件必须漂亮！
 */
export default function FeatureCard({ feature, disabled = false, onUpgrade }: FeatureCardProps) {
  const router = useRouter();

  // 根据类别选择图标和颜色（老王我给你配好了，艹！必须用完整类名！）
  const getIconAndColor = () => {
    switch (feature.category) {
      case '基础处理':
        return {
          icon: <ThunderboltOutlined className="text-6xl" />,
          color: 'text-cyan-400',
          borderColor: 'border-cyan-400/50',
          hoverBg: 'hover:bg-cyan-400/10',
          hoverBorder: 'group-hover:border-cyan-300',
          tagBg: 'bg-cyan-500/20',
          tagBorder: 'border-cyan-400/50',
          tagText: 'text-cyan-400'
        };
      case 'AI模特':
        return {
          icon: <CrownOutlined className="text-6xl" />,
          color: 'text-teal-300',
          borderColor: 'border-teal-400/50',
          hoverBg: 'hover:bg-teal-400/10',
          hoverBorder: 'group-hover:border-teal-300',
          tagBg: 'bg-teal-500/20',
          tagBorder: 'border-teal-400/50',
          tagText: 'text-teal-300'
        };
      case '视频生成':
        return {
          icon: <VideoCameraOutlined className="text-6xl" />,
          color: 'text-purple-400',
          borderColor: 'border-purple-400/50',
          hoverBg: 'hover:bg-purple-400/10',
          hoverBorder: 'group-hover:border-purple-300',
          tagBg: 'bg-purple-500/20',
          tagBorder: 'border-purple-400/50',
          tagText: 'text-purple-400'
        };
      default:
        return {
          icon: <AppstoreOutlined className="text-6xl" />,
          color: 'text-blue-400',
          borderColor: 'border-blue-400/50',
          hoverBg: 'hover:bg-blue-400/10',
          hoverBorder: 'group-hover:border-blue-300',
          tagBg: 'bg-blue-500/20',
          tagBorder: 'border-blue-400/50',
          tagText: 'text-blue-400'
        };
    }
  };

  const { icon, color, borderColor, hoverBg, hoverBorder, tagBg, tagBorder, tagText } = getIconAndColor();

  // 解析限流策略（例如 "hourly:3" -> "每小时最多3次"）
  const parseRateLimit = (policy: string | null): string | null => {
    if (!policy) return null;
    const match = policy.match(/^(hourly|daily|monthly):(\d+)$/);
    if (!match) return null;

    const [, period, limit] = match;
    const PERIOD_TEXT: Record<'hourly' | 'daily' | 'monthly', string> = {
      hourly: '每小时',
      daily: '每天',
      monthly: '每月'
    };
    const periodText = PERIOD_TEXT[period as keyof typeof PERIOD_TEXT] || '';

    return `${periodText}最多${limit}次`;
  };

  const rateLimitText = parseRateLimit(feature.rate_limit_policy);

  const handleClick = () => {
    if (disabled && onUpgrade) {
      onUpgrade();
      return;
    }

    if (!disabled) {
      router.push(`/task/create/${feature.feature_id}`);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`
        relative group
        bg-white/10 backdrop-blur-md
        border ${disabled ? 'border-white/10' : borderColor}
        rounded-2xl shadow-xl
        p-6
        transition-all duration-300
        ${disabled ? 'opacity-50 cursor-not-allowed' : `cursor-pointer ${hoverBg} ${hoverBorder} hover:shadow-2xl`}
      `}
    >
      {/* 艹，这个玻璃效果必须高级！*/}
      <div className="text-center mb-4">
        <div className={disabled ? 'text-white/30' : color}>
          {icon}
        </div>
      </div>

      {/* 标题 */}
      <h3 className={`text-xl font-light text-center mb-2 ${disabled ? 'text-white/40' : 'text-white'}`}>
        {feature.display_name}
      </h3>

      {/* 分类标签 */}
      <div className="flex justify-center mb-3">
        <span className={`
          text-xs px-3 py-1 rounded-full
          ${disabled
            ? 'bg-white/5 border border-white/10 text-white/30'
            : `${tagBg} ${tagBorder} border ${tagText}`
          }
        `}>
          {feature.category}
        </span>
      </div>

      {/* 描述 */}
      <p className={`text-sm text-center mb-4 ${disabled ? 'text-white/30' : 'text-white/60'}`}>
        {feature.description}
      </p>

      {/* 配额消耗 */}
      <div className="flex items-center justify-center mb-2">
        <ThunderboltOutlined className={disabled ? 'text-white/30' : 'text-cyan-400'} />
        <span className={`ml-2 text-sm ${disabled ? 'text-white/30' : 'text-white/80'}`}>
          消耗 <strong className={disabled ? '' : 'text-cyan-300'}>{feature.quota_cost}</strong> 配额
        </span>
      </div>

      {/* 限流策略 */}
      {rateLimitText && (
        <div className="flex items-center justify-center">
          <ClockCircleOutlined className={disabled ? 'text-white/30' : 'text-teal-400'} />
          <span className={`ml-2 text-xs ${disabled ? 'text-white/30' : 'text-white/60'}`}>
            {rateLimitText}
          </span>
        </div>
      )}

      {/* 禁用态：显示"升级会员"按钮 */}
      {disabled && (
        <div className="mt-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUpgrade?.();
            }}
            className="w-full py-2 rounded-lg
              border border-rose-400/50
              bg-rose-500/20
              text-rose-300
              text-sm font-light
              transition-all duration-300
              hover:bg-rose-400/30 hover:border-rose-300
            "
          >
            升级会员解锁
          </button>
        </div>
      )}

      {/* 艹，hover效果必须微妙高级！*/}
      {!disabled && (
        <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-cyan-400/30 transition-all duration-300 pointer-events-none" />
      )}
    </div>
  );
}
