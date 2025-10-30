'use client';

import { useState } from 'react';
import { message } from 'antd';
import { CopyOutlined, QrcodeOutlined } from '@ant-design/icons';

interface DistributorCardProps {
  inviteCode: string;
  inviteLink: string;
}

/**
 * DistributorCard - 分销员身份卡片组件
 *
 * 艹！这个卡片必须超级酷炫，展示邀请码和推广链接！
 * 支持一键复制功能！
 */
export default function DistributorCard({
  inviteCode,
  inviteLink
}: DistributorCardProps) {
  const [copying, setCopying] = useState(false);

  // 复制到剪贴板
  const copyToClipboard = async (text: string, label: string) => {
    if (copying) return;

    try {
      setCopying(true);
      await navigator.clipboard.writeText(text);
      message.success(`${label}已复制到剪贴板`);
    } catch (error) {
      message.error('复制失败，请手动复制');
    } finally {
      setTimeout(() => setCopying(false), 1000);
    }
  };

  return (
    <div
      className="
        backdrop-blur-md
        bg-gradient-to-r from-cyan-500/20 to-blue-500/20
        border border-cyan-400/30
        rounded-2xl shadow-2xl
        p-8
        transition-all duration-300
        hover:shadow-cyan-400/20 hover:shadow-2xl
      "
    >
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        {/* 邀请码展示 */}
        <div className="flex-1 text-center md:text-left">
          <div className="text-sm text-white/60 mb-2">您的专属邀请码</div>
          <div
            className="
              text-5xl md:text-6xl
              font-bold
              text-cyan-400
              tracking-widest
              mb-4
              drop-shadow-[0_0_20px_rgba(6,182,212,0.5)]
            "
          >
            {inviteCode}
          </div>
          <div className="text-xs text-white/50 mb-4">
            分享您的邀请码，让好友使用您的推广链接注册即可获得佣金
          </div>

          {/* 操作按钮 */}
          <div className="flex flex-wrap gap-2 justify-center md:justify-start">
            <button
              onClick={() => copyToClipboard(inviteCode, '邀请码')}
              disabled={copying}
              className="
                flex items-center gap-2
                px-6 py-2
                rounded-lg
                border border-cyan-400/50
                bg-cyan-500/10
                text-cyan-300
                text-sm font-medium
                transition-all duration-300
                hover:bg-cyan-400/20 hover:border-cyan-300
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              <CopyOutlined />
              复制邀请码
            </button>

            <button
              onClick={() => copyToClipboard(inviteLink, '推广链接')}
              disabled={copying}
              className="
                flex items-center gap-2
                px-6 py-2
                rounded-lg
                bg-cyan-400/80
                text-slate-900
                text-sm font-bold
                transition-all duration-300
                hover:bg-cyan-300
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              <CopyOutlined />
              复制推广链接
            </button>
          </div>
        </div>

        {/* 二维码占位（可选功能）*/}
        <div className="shrink-0">
          <div
            className="
              w-32 h-32
              flex items-center justify-center
              bg-white/10 backdrop-blur-md
              border border-white/20
              rounded-xl
            "
          >
            <QrcodeOutlined className="text-6xl text-white/40" />
          </div>
          <div className="text-xs text-white/50 text-center mt-2">
            推广二维码
          </div>
        </div>
      </div>
    </div>
  );
}
