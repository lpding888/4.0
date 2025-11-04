/**
 * UI-P2-TOKEN-205: 应用主题Provider(增强版)
 * 艹!这个tm负责应用Ant Design主题!
 *
 * 功能:
 * 1. 从Zustand读取theme状态
 * 2. 动态应用light/dark/brand三种主题
 * 3. 支持Next.js SSR
 * 4. 集成Design Tokens系统
 *
 * @author 老王
 */

'use client';

import React, { useEffect } from 'react';
import { ConfigProvider, App as AntdApp } from 'antd';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import zhCN from 'antd/locale/zh_CN';
import { useTheme } from '@/shared/store';
import { getThemeConfig, ThemeManager } from '@/shared/styles/theme';

/**
 * AppThemeProvider Props
 */
interface AppThemeProviderProps {
  children: React.ReactNode;
}

/**
 * UI-P2-TOKEN-205: AppThemeProvider组件(增强版)
 * 艹!包裹整个应用的主题提供者!
 */
export function AppThemeProvider({ children }: AppThemeProviderProps) {
  const theme = useTheme();

  // 艹!初始化主题(页面加载时)
  useEffect(() => {
    ThemeManager.initTheme();
  }, []);

  // 艹!应用主题到document元素(用于全局CSS变量)
  useEffect(() => {
    if (typeof document !== 'undefined') {
      // 艹!使用ThemeManager统一管理主题
      ThemeManager.setTheme(theme);
    }
  }, [theme]);

  // 艹!获取对应的主题配置
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
