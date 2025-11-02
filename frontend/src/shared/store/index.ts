/**
 * Zustand全局状态管理
 * 艹，这个tm是主store文件！
 *
 * 功能：
 * 1. 组合所有slice（auth, ui）
 * 2. persist中间件（持久化到localStorage）
 * 3. devtools中间件（Redux DevTools支持）
 *
 * @author 老王
 */

import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';
import { createAuthSlice, type AuthSlice } from './slices/authSlice';
import { createUiSlice, type UiSlice } from './slices/uiSlice';
import { createWorkbenchSlice, type WorkbenchSlice } from '@/features/workbench/model/workbenchSlice';

/**
 * 完整的Store类型
 * 艹，包含所有slice！
 */
export type AppStore = AuthSlice & UiSlice & WorkbenchSlice;

/**
 * 创建全局Store
 * 艹，这个tm是应用的状态中心！
 */
export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (...args) => ({
        ...createAuthSlice(...args),
        ...createUiSlice(...args),
        ...createWorkbenchSlice(...args),
      }),
      {
        name: 'ai-wardrobe-storage', // 艹，localStorage的key
        storage: createJSONStorage(() => localStorage),

        // 艹，部分持久化配置
        partialize: (state) => ({
          // Auth状态全部持久化
          user: state.user,
          isAuthenticated: state.isAuthenticated,

          // UI状态部分持久化
          theme: state.theme,
          sidebarCollapsed: state.sidebarCollapsed,

          // Workbench状态全部持久化
          config: state.config,

          // 艹，不持久化的状态：
          // - isLoadingUser（加载状态不持久化）
          // - globalLoading（加载状态不持久化）
          // - loadingText（加载文本不持久化）
        }),
      }
    ),
    {
      name: 'AI-Wardrobe-Store', // 艹，DevTools中显示的名称
      enabled: process.env.NODE_ENV === 'development', // 艹，只在开发环境启用
    }
  )
);

/**
 * 导出slice类型（方便其他地方使用）
 */
export type { AuthSlice, UiSlice, WorkbenchSlice };
export type { Theme } from './slices/uiSlice';
export type { FeatureCard, FeatureCategory, FeatureCardSize } from '@/features/workbench/model/types';

/**
 * 导出选择器hooks（性能优化）
 * 艹，避免不必要的重渲染！
 */

/**
 * 获取用户信息
 */
export const useUser = () => useAppStore((state) => state.user);

/**
 * 获取认证状态
 */
export const useIsAuthenticated = () => useAppStore((state) => state.isAuthenticated);

/**
 * 获取用户角色检查函数
 */
export const useHasRole = () => useAppStore((state) => state.hasRole);

/**
 * 获取侧边栏状态
 */
export const useSidebarCollapsed = () => useAppStore((state) => state.sidebarCollapsed);

/**
 * 获取主题
 */
export const useTheme = () => useAppStore((state) => state.theme);

/**
 * 获取全局加载状态
 */
export const useGlobalLoading = () => useAppStore((state) => state.globalLoading);

/**
 * 艹，常用Actions选择器
 */
export const useAuthActions = () =>
  useAppStore((state) => ({
    setUser: state.setUser,
    clearUser: state.clearUser,
    setLoadingUser: state.setLoadingUser,
  }));

export const useUiActions = () =>
  useAppStore((state) => ({
    toggleSidebar: state.toggleSidebar,
    setSidebarCollapsed: state.setSidebarCollapsed,
    setTheme: state.setTheme,
    toggleTheme: state.toggleTheme,
    setGlobalLoading: state.setGlobalLoading,
  }));

/**
 * 获取工作台配置
 */
export const useWorkbenchConfig = () => useAppStore((state) => state.config);

/**
 * 获取启用的功能列表
 */
export const useEnabledFeatures = () => useAppStore((state) => state.getEnabledFeatures());

/**
 * 艹，Workbench Actions选择器
 */
export const useWorkbenchActions = () =>
  useAppStore((state) => ({
    setFeatures: state.setFeatures,
    updateFeature: state.updateFeature,
    toggleFeature: state.toggleFeature,
    reorderFeatures: state.reorderFeatures,
    resetToDefault: state.resetToDefault,
    setShowDisabled: state.setShowDisabled,
    setColumns: state.setColumns,
    getFeaturesByCategory: state.getFeaturesByCategory,
    getFeatureById: state.getFeatureById,
  }));
