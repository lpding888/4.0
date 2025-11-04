/**
 * UI-P2-TOKEN-205: Ant Design主题配置
 * 艹!桥接Design Tokens到AntD组件,实现主题切换!
 *
 * @author 老王
 */

import type { ThemeConfig } from 'antd';

/**
 * 艹!浅色主题配置
 */
export const lightTheme: ThemeConfig = {
  token: {
    // 艹!颜色系统
    colorPrimary: '#1890ff',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    colorInfo: '#1890ff',

    colorText: 'rgba(0, 0, 0, 0.85)',
    colorTextSecondary: 'rgba(0, 0, 0, 0.65)',
    colorTextTertiary: 'rgba(0, 0, 0, 0.45)',
    colorTextQuaternary: 'rgba(0, 0, 0, 0.25)',

    colorBgBase: '#ffffff',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBgLayout: '#f5f5f5',
    colorBgSpotlight: '#fafafa',

    colorBorder: '#d9d9d9',
    colorBorderSecondary: '#f0f0f0',

    colorLink: '#1890ff',
    colorLinkHover: '#40a9ff',
    colorLinkActive: '#096dd9',

    // 艹!字体系统
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: 14,
    fontSizeHeading1: 38,
    fontSizeHeading2: 30,
    fontSizeHeading3: 24,
    fontSizeHeading4: 20,
    fontSizeHeading5: 16,

    lineHeight: 1.5715,
    lineHeightHeading1: 1.2,
    lineHeightHeading2: 1.3,
    lineHeightHeading3: 1.35,
    lineHeightHeading4: 1.4,
    lineHeightHeading5: 1.5,

    // 艹!圆角系统
    borderRadius: 6,
    borderRadiusLG: 12,
    borderRadiusSM: 4,
    borderRadiusXS: 2,

    // 艹!间距系统
    padding: 16,
    paddingLG: 24,
    paddingSM: 12,
    paddingXS: 8,
    paddingXXS: 4,

    margin: 16,
    marginLG: 24,
    marginSM: 12,
    marginXS: 8,
    marginXXS: 4,

    // 艹!尺寸系统
    controlHeight: 32,
    controlHeightLG: 40,
    controlHeightSM: 24,

    // 艹!动画系统
    motionDurationFast: '0.15s',
    motionDurationMid: '0.2s',
    motionDurationSlow: '0.3s',

    // 艹!阴影系统
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -2px rgba(0, 0, 0, 0.08)',
    boxShadowSecondary: '0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.08)',

    // 艹!层级系统
    zIndexBase: 0,
    zIndexPopupBase: 1000,
  },
  components: {
    // 艹!按钮组件定制
    Button: {
      controlHeight: 32,
      controlHeightLG: 40,
      controlHeightSM: 24,
      paddingContentHorizontal: 15,
    },
    // 艹!卡片组件定制
    Card: {
      borderRadiusLG: 12,
      boxShadowCard: '0 1px 3px 0 rgba(0, 0, 0, 0.08)',
    },
    // 艹!输入框组件定制
    Input: {
      controlHeight: 32,
      controlHeightLG: 40,
      controlHeightSM: 24,
      paddingBlock: 4,
      paddingInline: 11,
    },
    // 艹!表格组件定制
    Table: {
      borderRadius: 6,
      headerBg: '#fafafa',
    },
    // 艹!模态框组件定制
    Modal: {
      borderRadiusLG: 12,
    },
  },
};

/**
 * 艹!暗色主题配置
 */
export const darkTheme: ThemeConfig = {
  ...lightTheme,
  token: {
    ...lightTheme.token,

    // 艹!暗色主色调整
    colorPrimary: '#177ddc',

    // 艹!暗色文本
    colorText: 'rgba(255, 255, 255, 0.85)',
    colorTextSecondary: 'rgba(255, 255, 255, 0.65)',
    colorTextTertiary: 'rgba(255, 255, 255, 0.45)',
    colorTextQuaternary: 'rgba(255, 255, 255, 0.25)',

    // 艹!暗色背景
    colorBgBase: '#141414',
    colorBgContainer: '#1f1f1f',
    colorBgElevated: '#2a2a2a',
    colorBgLayout: '#000000',
    colorBgSpotlight: '#1a1a1a',

    // 艹!暗色边框
    colorBorder: '#434343',
    colorBorderSecondary: '#303030',

    // 艹!暗色链接
    colorLink: '#177ddc',
    colorLinkHover: '#1765ad',
    colorLinkActive: '#3c9ae8',

    // 艹!暗色阴影
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.32), 0 2px 4px -2px rgba(0, 0, 0, 0.32)',
    boxShadowSecondary: '0 1px 3px 0 rgba(0, 0, 0, 0.32), 0 1px 2px -1px rgba(0, 0, 0, 0.32)',
  },
  components: {
    ...lightTheme.components,
    Table: {
      ...lightTheme.components?.Table,
      headerBg: '#1a1a1a',
    },
  },
  algorithm: undefined, // 艹!暗色主题需要使用Ant Design的暗色算法
};

/**
 * 艹!品牌主题配置
 */
export const brandTheme: ThemeConfig = {
  ...lightTheme,
  token: {
    ...lightTheme.token,
    colorPrimary: '#722ed1',
    colorLink: '#722ed1',
    colorLinkHover: '#9254de',
    colorLinkActive: '#531dab',
  },
};

/**
 * 艹!主题类型定义
 */
export type ThemeMode = 'light' | 'dark' | 'brand';

/**
 * 艹!根据主题模式获取主题配置
 */
export function getThemeConfig(mode: ThemeMode): ThemeConfig {
  switch (mode) {
    case 'dark':
      return darkTheme;
    case 'brand':
      return brandTheme;
    case 'light':
    default:
      return lightTheme;
  }
}

/**
 * 艹!主题切换工具类
 */
export class ThemeManager {
  private static readonly THEME_KEY = 'app-theme-mode';

  /**
   * 艹!获取当前主题模式
   */
  static getTheme(): ThemeMode {
    if (typeof window === 'undefined') return 'light';

    const stored = localStorage.getItem(this.THEME_KEY);
    return (stored as ThemeMode) || 'light';
  }

  /**
   * 艹!设置主题模式
   */
  static setTheme(mode: ThemeMode): void {
    if (typeof window === 'undefined') return;

    localStorage.setItem(this.THEME_KEY, mode);
    document.documentElement.setAttribute('data-theme', mode);
  }

  /**
   * 艹!切换主题
   */
  static toggleTheme(): ThemeMode {
    const current = this.getTheme();
    const next: ThemeMode = current === 'light' ? 'dark' : 'light';
    this.setTheme(next);
    return next;
  }

  /**
   * 艹!初始化主题(页面加载时调用)
   */
  static initTheme(): void {
    const theme = this.getTheme();
    document.documentElement.setAttribute('data-theme', theme);
  }
}
