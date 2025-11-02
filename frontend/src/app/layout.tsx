import type { Metadata } from 'next';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Navigation from '@/components/Navigation';
import ErrorBoundary from '@/components/ErrorBoundary';
import TokenSyncProvider from '@/components/TokenSyncProvider';
import './globals.css';
import '../../sentry.client.config';

export const metadata: Metadata = {
  title: 'AI照 - 服装AI处理平台',
  description: '专业的服装图片AI处理服务,提供基础修图和AI模特上身功能',
};

/**
 * RootLayout - 根布局
 *
 * 艹，包含导航栏，支持青蓝玻璃拟态主题！
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-gradient-to-br from-slate-900 via-blue-950 to-emerald-950 min-h-screen">
        <ErrorBoundary>
          <TokenSyncProvider />
          <ConfigProvider locale={zhCN}>
            <Navigation />
            {children}
          </ConfigProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
