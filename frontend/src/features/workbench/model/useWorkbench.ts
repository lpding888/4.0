/**
 * useWorkbench Hook
 * 艹，这个Hook方便使用workbench功能，集成权限过滤！
 */

'use client';

import { useMemo } from 'react';
import { useWorkbenchConfig, useWorkbenchActions } from '@/shared/store';
import { usePermission } from '@/features/permissions/model/usePermission';
import type { FeatureCard, FeatureCategory } from './types';

/**
 * useWorkbench Hook
 * 艹，这个Hook返回经过权限过滤的功能列表！
 */
export function useWorkbench() {
  const config = useWorkbenchConfig();
  const actions = useWorkbenchActions();
  const { hasPermission } = usePermission();

  /**
   * 过滤有权限的功能
   * 艹，没权限的功能自动过滤掉！
   */
  const filteredFeatures = useMemo(() => {
    return config.features.filter((feature) => {
      // 禁用的功能
      if (!config.showDisabled && !feature.enabled) {
        return false;
      }

      // 权限检查
      if (feature.permission) {
        return hasPermission(feature.permission);
      }

      return true;
    }).sort((a, b) => a.order - b.order);
  }, [config.features, config.showDisabled, hasPermission]);

  /**
   * 根据分类获取功能
   */
  const getFeaturesByCategory = (category: FeatureCategory): FeatureCard[] => {
    return filteredFeatures.filter((f) => f.category === category);
  };

  /**
   * 获取所有分类
   */
  const getAllCategories = (): FeatureCategory[] => {
    const categories = new Set<FeatureCategory>();
    filteredFeatures.forEach((f) => categories.add(f.category));
    return Array.from(categories);
  };

  return {
    // 配置
    config,

    // 过滤后的功能列表
    features: filteredFeatures,

    // 查询方法
    getFeaturesByCategory,
    getAllCategories,
    getFeatureById: actions.getFeatureById,

    // 操作方法
    ...actions,
  };
}
