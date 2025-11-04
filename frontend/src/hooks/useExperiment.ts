/**
 * A/B实验 Hook
 * 艹！这个Hook让组件方便地使用A/B实验！
 *
 * 使用示例：
 * ```tsx
 * function TemplatePage() {
 *   const { variant, trackConversion } = useExperiment('template_sort_experiment');
 *
 *   const sortMethod = variant?.config?.sort_method || 'default';
 *
 *   const handleTemplateClick = () => {
 *     trackConversion('template_click');
 *   };
 *
 *   return <div>...</div>;
 * }
 * ```
 *
 * @author 老王
 */

import { useState, useEffect } from 'react';
import {
  experimentManager,
  type ExperimentConfig,
  type ExperimentVariant,
} from '@/lib/experiments/featureFlag';

/**
 * useExperiment Hook
 *
 * @param experimentId 实验ID
 * @returns 实验数据和方法
 */
export function useExperiment(experimentId: string) {
  const [variantId, setVariantId] = useState<string | null>(null);
  const [variant, setVariant] = useState<ExperimentVariant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 获取分配的变体
    const assignedVariantId = experimentManager.getVariant(experimentId);
    setVariantId(assignedVariantId);

    // TODO: 从experimentManager获取variant详情
    // 当前简化实现，只返回variantId
    setVariant(null);

    setLoading(false);
  }, [experimentId]);

  /**
   * 记录转化事件
   */
  const trackConversion = (eventName: string, eventValue?: number) => {
    experimentManager.trackConversion(experimentId, eventName, eventValue);
  };

  /**
   * 获取配置值
   */
  const getConfig = <T = any>(configKey: string, defaultValue: T): T => {
    return experimentManager.getConfig(experimentId, configKey, defaultValue);
  };

  return {
    variantId,
    variant,
    loading,
    trackConversion,
    getConfig,
    isControl: variantId === 'control',
    isVariant: variantId !== null && variantId !== 'control',
  };
}

/**
 * useFeatureFlag Hook
 *
 * @param flagKey Feature Flag Key
 * @returns 是否开启
 */
export function useFeatureFlag(flagKey: string): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(experimentManager.isFeatureEnabled(flagKey));
  }, [flagKey]);

  return enabled;
}
