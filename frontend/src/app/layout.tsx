import type { Metadata } from 'next';
import Navigation from '@/components/Navigation';
import ErrorBoundary from '@/components/ErrorBoundary';
import { AppThemeProvider } from '@/shared/providers';
import { initWebVitals } from '@/lib/monitoring/web-vitals';
import { MSWInitializer } from '@/components/MSWInitializer';
import { generateMetadata } from '@/lib/seo';
import './fonts.css';
import '../styles/tokens.css'; // UI-P2-TOKEN-205: Design Tokens
import '../styles/accessibility.css'; // A11Y-P2-ACCESS-206: 可访问性样式
import './globals.css';

// SEO-P2-BASICS-207: 完整的SEO metadata
export const metadata: Metadata = generateMetadata({
  title: 'AI衣柜',
  description:
    '专业的服装图片AI处理服务，提供基础修图、AI模特上身、Lookbook生成、短视频制作、图片翻译等功能，助力服装电商提升效率',
  keywords: [
    'AI服装',
    '服装AI处理',
    'AI模特',
    '服装修图',
    'Lookbook生成',
    '短视频制作',
    '图片翻译',
    '服装电商',
    'AI商拍',
  ],
  path: '/',
});

/**
 * RootLayout - 根布局
 *
 * 艹！使用GPT5工业级架构，支持主题切换和完整的状态管理！
 * 还加了Web Vitals监控，性能必须管！
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 初始化Web Vitals监控
  initWebVitals();

  return (
    <html lang="zh-CN">
      <body>
        {/* A11Y-P2-ACCESS-206: 跳过导航链接 */}
        <a href="#main-content" className="sr-only-focusable">
          跳过导航，直达主内容
        </a>
        <ErrorBoundary>
          <AppThemeProvider>
            <MSWInitializer />
            <Navigation />
            <main id="main-content" tabIndex={-1}>
              {children}
            </main>
          </AppThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
