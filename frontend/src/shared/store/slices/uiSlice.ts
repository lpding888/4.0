/**
 * UI状态Slice
 * 艹，这个tm管理全局UI状态！
 *
 * @author 老王
 */

import { StateCreator } from 'zustand';

/**
 * 主题类型
 */
export type Theme = 'light' | 'dark';

/**
 * UI状态接口
 */
export interface UiSlice {
  // 艹，侧边栏是否折叠
  sidebarCollapsed: boolean;

  // 艹，当前主题
  theme: Theme;

  // 艹，全局加载状态
  globalLoading: boolean;

  // 艹，全局加载文本
  loadingText: string;

  // Actions

  /**
   * 切换侧边栏折叠状态
   * 艹，点击菜单折叠按钮时调用！
   */
  toggleSidebar: () => void;

  /**
   * 设置侧边栏折叠状态
   */
  setSidebarCollapsed: (collapsed: boolean) => void;

  /**
   * 设置主题
   * 艹，切换亮/暗主题！
   */
  setTheme: (theme: Theme) => void;

  /**
   * 切换主题
   */
  toggleTheme: () => void;

  /**
   * 设置全局加载状态
   * 艹，显示全屏loading用的！
   */
  setGlobalLoading: (loading: boolean, text?: string) => void;
}

/**
 * 创建UI状态Slice
 * 艹，这个tm是slice工厂函数！
 */
export const createUiSlice: StateCreator<UiSlice> = (set, get) => ({
  // 艹，初始状态
  sidebarCollapsed: false,
  theme: 'light',
  globalLoading: false,
  loadingText: '加载中...',

  // 艹，Actions实现
  toggleSidebar: () =>
    set((state) => ({
      sidebarCollapsed: !state.sidebarCollapsed,
    })),

  setSidebarCollapsed: (collapsed) =>
    set({
      sidebarCollapsed: collapsed,
    }),

  setTheme: (theme) =>
    set({
      theme,
    }),

  toggleTheme: () =>
    set((state) => ({
      theme: state.theme === 'light' ? 'dark' : 'light',
    })),

  setGlobalLoading: (loading, text = '加载中...') =>
    set({
      globalLoading: loading,
      loadingText: text,
    }),
});
