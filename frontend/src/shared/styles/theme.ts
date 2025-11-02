/**
 * Ant Design主题配置
 * 艹，这个tm定义亮色和暗色主题！
 *
 * @author 老王
 */

import type { ThemeConfig } from 'antd';

/**
 * 亮色主题配置
 * 艹，这是默认主题！
 */
export const lightTheme: ThemeConfig = {
  token: {
    // 艹，主色调（GPT5推荐的紫色）
    colorPrimary: '#5B61ED',

    // 艹，辅助色
    colorSuccess: '#12B8A5',
    colorWarning: '#FF6B4A',
    colorError: '#F5222D',
    colorInfo: '#1890FF',

    // 艹，圆角
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,

    // 艹，字体
    fontSize: 14,
    fontSizeLG: 16,
    fontSizeSM: 12,

    // 艹，间距
    marginXS: 8,
    marginSM: 12,
    margin: 16,
    marginLG: 24,
    marginXL: 32,

    // 艹，背景色
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',
    colorBgLayout: '#F5F5F5',

    // 艹，文字颜色
    colorText: '#1A1A1A',
    colorTextSecondary: '#666666',
    colorTextTertiary: '#999999',
  },

  components: {
    // 艹，按钮样式
    Button: {
      borderRadius: 6,
      controlHeight: 36,
      controlHeightLG: 44,
      controlHeightSM: 28,
    },

    // 艹，卡片样式
    Card: {
      borderRadiusLG: 12,
      paddingLG: 24,
    },

    // 艹，输入框样式
    Input: {
      borderRadius: 6,
      controlHeight: 36,
      controlHeightLG: 44,
      controlHeightSM: 28,
    },

    // 艹，表格样式
    Table: {
      borderRadius: 8,
      headerBg: '#FAFAFA',
    },

    // 艹，菜单样式
    Menu: {
      itemBorderRadius: 6,
      itemMarginBlock: 4,
    },

    // 艹，布局样式
    Layout: {
      headerBg: '#FFFFFF',
      siderBg: '#001529',
      bodyBg: '#F5F5F5',
    },
  },
};

/**
 * 暗色主题配置
 * 艹，夜间模式用的！
 */
export const darkTheme: ThemeConfig = {
  token: {
    // 艹，主色调（暗色模式下稍微调亮一点）
    colorPrimary: '#6B71F5',

    // 艹，辅助色
    colorSuccess: '#1AC7B6',
    colorWarning: '#FF7A5C',
    colorError: '#FF4D4F',
    colorInfo: '#40A9FF',

    // 艹，圆角（与亮色主题一致）
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,

    // 艹，字体（与亮色主题一致）
    fontSize: 14,
    fontSizeLG: 16,
    fontSizeSM: 12,

    // 艹，间距（与亮色主题一致）
    marginXS: 8,
    marginSM: 12,
    margin: 16,
    marginLG: 24,
    marginXL: 32,

    // 艹，背景色（暗色）
    colorBgContainer: '#1F1F1F',
    colorBgElevated: '#2A2A2A',
    colorBgLayout: '#141414',

    // 艹，文字颜色（暗色）
    colorText: '#E8E8E8',
    colorTextSecondary: '#A8A8A8',
    colorTextTertiary: '#707070',

    // 艹，边框颜色
    colorBorder: '#3A3A3A',
    colorBorderSecondary: '#2A2A2A',
  },

  components: {
    // 艹，按钮样式（与亮色主题一致）
    Button: {
      borderRadius: 6,
      controlHeight: 36,
      controlHeightLG: 44,
      controlHeightSM: 28,
    },

    // 艹，卡片样式
    Card: {
      borderRadiusLG: 12,
      paddingLG: 24,
    },

    // 艹，输入框样式
    Input: {
      borderRadius: 6,
      controlHeight: 36,
      controlHeightLG: 44,
      controlHeightSM: 28,
    },

    // 艹，表格样式
    Table: {
      borderRadius: 8,
      headerBg: '#2A2A2A',
    },

    // 艹，菜单样式
    Menu: {
      itemBorderRadius: 6,
      itemMarginBlock: 4,
    },

    // 艹，布局样式
    Layout: {
      headerBg: '#1F1F1F',
      siderBg: '#0A0A0A',
      bodyBg: '#141414',
    },
  },

  // 艹，暗色算法
  algorithm: 'dark' as any,
};

/**
 * 获取主题配置
 * 艹，根据theme类型返回对应配置！
 */
export function getThemeConfig(theme: 'light' | 'dark'): ThemeConfig {
  return theme === 'dark' ? darkTheme : lightTheme;
}
