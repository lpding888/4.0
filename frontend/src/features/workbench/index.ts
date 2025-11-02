/**
 * Workbench 功能配置模块导出
 * 艹，统一导出所有workbench相关内容！
 */

// Types
export type {
  FeatureCard,
  FeatureCategory,
  FeatureCardSize,
  WorkbenchConfig,
  WorkbenchSlice,
} from './model/types';

export { FeatureCategory, FeatureCardSize } from './model/types';

// Default Features
export { DEFAULT_FEATURES, getRecommendedFeaturesByRole } from './model/defaultFeatures';

// Hook
export { useWorkbench } from './model/useWorkbench';

// UI Components
export { FeatureCard, FeatureGrid } from './ui';
export type { FeatureCardProps, FeatureGridProps } from './ui';
