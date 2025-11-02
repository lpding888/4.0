import type { Metadata } from 'next';
import Navigation from '@/components/Navigation';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AppThemeProvider } from '@/shared/providers';
import './fonts.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI照 - 服装AI处理平台',
  description: '专业的服装图片AI处理服务,提供基础修图和AI模特上身功能',
};

/**
 * RootLayout - 根布局
 *
 * 艹！使用GPT5工业级架构，支持主题切换和完整的状态管理！
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <ErrorBoundary>
          <AppThemeProvider>
            <Navigation />
            {children}
          </AppThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
