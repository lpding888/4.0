/**
 * 应用主题Provider
 * 艹，这个tm负责应用Ant Design主题！
 *
 * 功能：
 * 1. 从Zustand读取theme状态
 * 2. 动态应用亮色/暗色主题
 * 3. 支持Next.js SSR
 *
 * @author 老王
 */

'use client';

import React, { useEffect } from 'react';
import { ConfigProvider, App as AntdApp } from 'antd';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import zhCN from 'antd/locale/zh_CN';
import { useTheme } from '@/shared/store';
import { getThemeConfig } from '@/shared/styles/theme';

/**
 * AppThemeProvider Props
 */
interface AppThemeProviderProps {
  children: React.ReactNode;
}

/**
 * AppThemeProvider组件
 * 艹，包裹整个应用的主题提供者！
 */
export function AppThemeProvider({ children }: AppThemeProviderProps) {
  const theme = useTheme();

  // 艹，应用主题到document元素（用于全局CSS变量）
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);

      // 艹，暗色主题时添加dark类
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [theme]);

  // 艹，获取对应的主题配置
  const themeConfig = getThemeConfig(theme);

  return (
    <AntdRegistry>
      <ConfigProvider
        theme={themeConfig}
        locale={zhCN}
      >
        <AntdApp>
          {children}
        </AntdApp>
      </ConfigProvider>
    </AntdRegistry>
  );
}
