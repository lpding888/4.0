/**
 * Workbench Zustand Slice
 * 艹，这个tm管理工作台的所有功能配置！
 */

import type { StateCreator } from 'zustand';
import type { WorkbenchSlice, WorkbenchConfig, FeatureCard, FeatureCategory } from './types';
import { DEFAULT_FEATURES } from './defaultFeatures';

/**
 * 默认工作台配置
 */
const DEFAULT_CONFIG: WorkbenchConfig = {
  features: DEFAULT_FEATURES,
  showDisabled: false,
  columns: 3,
  lastUpdated: new Date().toISOString(),
};

/**
 * 创建Workbench Slice
 * 艹，这个函数返回一个Zustand slice！
 */
export const createWorkbenchSlice: StateCreator<WorkbenchSlice> = (set, get) => ({
  // 初始状态
  config: DEFAULT_CONFIG,

  /**
   * 设置功能卡片列表
   */
  setFeatures: (features) => {
    set((state) => ({
      config: {
        ...state.config,
        features,
        lastUpdated: new Date().toISOString(),
      },
    }));
  },

  /**
   * 更新单个功能卡片
   */
  updateFeature: (id, updates) => {
    set((state) => ({
      config: {
        ...state.config,
        features: state.config.features.map((f) =>
          f.id === id ? { ...f, ...updates } : f
        ),
        lastUpdated: new Date().toISOString(),
      },
    }));
  },

  /**
   * 启用/禁用功能
   */
  toggleFeature: (id) => {
    set((state) => ({
      config: {
        ...state.config,
        features: state.config.features.map((f) =>
          f.id === id ? { ...f, enabled: !f.enabled } : f
        ),
        lastUpdated: new Date().toISOString(),
      },
    }));
  },

  /**
   * 调整功能顺序（拖拽排序）
   * 艹，这个用于拖拽调整卡片顺序！
   */
  reorderFeatures: (fromIndex, toIndex) => {
    set((state) => {
      const features = [...state.config.features];
      const [removed] = features.splice(fromIndex, 1);
      if (!removed) {
        return state;
      }
      features.splice(toIndex, 0, removed);

      // 重新计算order
      const reorderedFeatures = features.map((f, index) => ({
        ...f,
        order: index + 1,
      }));

      return {
        config: {
          ...state.config,
          features: reorderedFeatures,
          lastUpdated: new Date().toISOString(),
        },
      };
    });
  },

  /**
   * 重置为默认配置
   */
  resetToDefault: () => {
    set({
      config: {
        ...DEFAULT_CONFIG,
        lastUpdated: new Date().toISOString(),
      },
    });
  },

  /**
   * 设置是否显示禁用功能
   */
  setShowDisabled: (show) => {
    set((state) => ({
      config: {
        ...state.config,
        showDisabled: show,
      },
    }));
  },

  /**
   * 设置布局列数
   */
  setColumns: (columns) => {
    set((state) => ({
      config: {
        ...state.config,
        columns: Math.max(1, Math.min(4, columns)), // 限制在1-4列
      },
    }));
  },

  /**
   * 获取启用的功能列表（过滤+排序）
   * 艹，这个方法返回处理后的功能列表！
   */
  getEnabledFeatures: () => {
    const { features, showDisabled } = get().config;

    return features
      .filter((f) => showDisabled || f.enabled)
      .sort((a, b) => a.order - b.order);
  },

  /**
   * 根据分类获取功能列表
   */
  getFeaturesByCategory: (category) => {
    const { features, showDisabled } = get().config;

    return features
      .filter((f) => f.category === category && (showDisabled || f.enabled))
      .sort((a, b) => a.order - b.order);
  },

  /**
   * 根据ID获取功能
   */
  getFeatureById: (id) => {
    return get().config.features.find((f) => f.id === id);
  },
});
