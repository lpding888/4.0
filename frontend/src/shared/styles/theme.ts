/**
 * UI-P2-TOKEN-205: Ant Design主题配置(增强版)
 * 艹!整合Design Tokens系统,支持light/dark/brand三种主题!
 *
 * @author 老王
 */

import type { ThemeConfig } from 'antd';
import { theme as antdTheme } from 'antd';

/**
 * 艹!主题模式类型
 */
export type ThemeMode = 'light' | 'dark' | 'brand';

/**
 * 艹!亮色主题配置(保留原紫色品牌色)
 */
export const lightTheme: ThemeConfig = {
  token: {
    // 艹!主色调(GPT5推荐的紫色 - 保留品牌色)
    colorPrimary: '#5B61ED',
    colorPrimaryHover: '#7B7FF5',
    colorPrimaryActive: '#3B41CD',

    // 艹!辅助色
    colorSuccess: '#12B8A5',
    colorWarning: '#FF6B4A',
    colorError: '#F5222D',
    colorInfo: '#1890FF',

    // 艹!文字颜色
    colorText: 'rgba(0, 0, 0, 0.85)',
    colorTextSecondary: 'rgba(0, 0, 0, 0.65)',
    colorTextTertiary: 'rgba(0, 0, 0, 0.45)',
    colorTextQuaternary: 'rgba(0, 0, 0, 0.25)',

    // 艹!背景色
    colorBgBase: '#FFFFFF',
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',
    colorBgLayout: '#F5F5F5',
    colorBgSpotlight: '#FAFAFA',

    // 艹!边框颜色
    colorBorder: '#D9D9D9',
    colorBorderSecondary: '#F0F0F0',

    // 艹!链接颜色
    colorLink: '#5B61ED',
    colorLinkHover: '#7B7FF5',
    colorLinkActive: '#3B41CD',

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
    // 艹!按钮样式
    Button: {
      controlHeight: 32,
      controlHeightLG: 40,
      controlHeightSM: 24,
      paddingContentHorizontal: 15,
      borderRadius: 6,
    },

    // 艹!卡片样式
    Card: {
      borderRadiusLG: 12,
      paddingLG: 24,
      boxShadowCard: '0 1px 3px 0 rgba(0, 0, 0, 0.08)',
    },

    // 艹!输入框样式
    Input: {
      controlHeight: 32,
      controlHeightLG: 40,
      controlHeightSM: 24,
      paddingBlock: 4,
      paddingInline: 11,
      borderRadius: 6,
    },

    // 艹!表格样式
    Table: {
      borderRadius: 6,
      headerBg: '#FAFAFA',
    },

    // 艹!菜单样式
    Menu: {
      itemBorderRadius: 6,
      itemMarginBlock: 4,
    },

    // 艹!布局样式
    Layout: {
      headerBg: '#FFFFFF',
      siderBg: '#001529',
      bodyBg: '#F5F5F5',
    },

    // 艹!模态框样式
    Modal: {
      borderRadiusLG: 12,
    },
  },
};

/**
 * 艹!暗色主题配置
 */
export const darkTheme: ThemeConfig = {
  token: {
    // 艹!暗色主色调(稍微调亮)
    colorPrimary: '#6B71F5',
    colorPrimaryHover: '#8B8FF7',
    colorPrimaryActive: '#4B51D5',

    // 艹!辅助色
    colorSuccess: '#1AC7B6',
    colorWarning: '#FF7A5C',
    colorError: '#FF4D4F',
    colorInfo: '#40A9FF',

    // 艹!暗色文本
    colorText: 'rgba(255, 255, 255, 0.85)',
    colorTextSecondary: 'rgba(255, 255, 255, 0.65)',
    colorTextTertiary: 'rgba(255, 255, 255, 0.45)',
    colorTextQuaternary: 'rgba(255, 255, 255, 0.25)',

    // 艹!暗色背景
    colorBgBase: '#141414',
    colorBgContainer: '#1F1F1F',
    colorBgElevated: '#2A2A2A',
    colorBgLayout: '#000000',
    colorBgSpotlight: '#1A1A1A',

    // 艹!暗色边框
    colorBorder: '#434343',
    colorBorderSecondary: '#303030',

    // 艹!暗色链接
    colorLink: '#6B71F5',
    colorLinkHover: '#8B8FF7',
    colorLinkActive: '#4B51D5',

    // 艹!字体系统(与亮色一致)
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

    // 艹!暗色阴影
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.32), 0 2px 4px -2px rgba(0, 0, 0, 0.32)',
    boxShadowSecondary: '0 1px 3px 0 rgba(0, 0, 0, 0.32), 0 1px 2px -1px rgba(0, 0, 0, 0.32)',

    // 艹!层级系统
    zIndexBase: 0,
    zIndexPopupBase: 1000,
  },

  components: {
    // 艹!按钮样式
    Button: {
      controlHeight: 32,
      controlHeightLG: 40,
      controlHeightSM: 24,
      paddingContentHorizontal: 15,
      borderRadius: 6,
    },

    // 艹!卡片样式
    Card: {
      borderRadiusLG: 12,
      paddingLG: 24,
    },

    // 艹!输入框样式
    Input: {
      controlHeight: 32,
      controlHeightLG: 40,
      controlHeightSM: 24,
      paddingBlock: 4,
      paddingInline: 11,
      borderRadius: 6,
    },

    // 艹!表格样式
    Table: {
      borderRadius: 6,
      headerBg: '#2A2A2A',
    },

    // 艹!菜单样式
    Menu: {
      itemBorderRadius: 6,
      itemMarginBlock: 4,
    },

    // 艹!布局样式
    Layout: {
      headerBg: '#1F1F1F',
      siderBg: '#0A0A0A',
      bodyBg: '#141414',
    },

    // 艹!模态框样式
    Modal: {
      borderRadiusLG: 12,
    },
  },

  // 艹!使用Ant Design的暗色算法
  algorithm: antdTheme.darkAlgorithm,
};

/**
 * 艹!品牌主题配置(蓝色系)
 */
export const brandTheme: ThemeConfig = {
  ...lightTheme,
  token: {
    ...lightTheme.token,
    // 艹!品牌蓝色
    colorPrimary: '#1890ff',
    colorPrimaryHover: '#40a9ff',
    colorPrimaryActive: '#096dd9',

    colorLink: '#1890ff',
    colorLinkHover: '#40a9ff',
    colorLinkActive: '#096dd9',
  },
};

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

    // 艹!暗色主题时添加dark类
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  /**
   * 艹!切换主题(light <-> dark)
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
    this.setTheme(theme);
  }
}
