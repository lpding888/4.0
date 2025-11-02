/**
 * Workbench 工作台功能配置类型定义
 * 艹，这个tm定义了工作台所有功能卡片的类型！
 */

/**
 * 功能卡片大小
 */
export enum FeatureCardSize {
  SMALL = 'small',     // 1x1
  MEDIUM = 'medium',   // 2x1
  LARGE = 'large',     // 2x2
}

/**
 * 功能卡片分类
 */
export enum FeatureCategory {
  /** AI功能 */
  AI = 'ai',
  /** 管理功能 */
  ADMIN = 'admin',
  /** 数据统计 */
  ANALYTICS = 'analytics',
  /** 用户功能 */
  USER = 'user',
  /** 系统功能 */
  SYSTEM = 'system',
  /** 其他 */
  OTHER = 'other',
}

/**
 * 功能卡片配置
 */
export interface FeatureCard {
  /** 功能唯一ID */
  id: string;

  /** 功能标题 */
  title: string;

  /** 功能描述 */
  description: string;

  /** 图标名称（DynamicIcon） */
  icon: string;

  /** 路由路径 */
  path?: string;

  /** 权限标识（RBAC） */
  permission?: string;

  /** 是否启用 */
  enabled: boolean;

  /** 排序顺序（越小越靠前） */
  order: number;

  /** 卡片大小 */
  size: FeatureCardSize;

  /** 功能分类 */
  category: FeatureCategory;

  /** 徽标（数字或文本） */
  badge?: number | string;

  /** 徽标颜色 */
  badgeColor?: string;

  /** 是否为新功能 */
  isNew?: boolean;

  /** 是否为热门功能 */
  isHot?: boolean;

  /** 是否禁用 */
  disabled?: boolean;

  /** 自定义元数据 */
  meta?: Record<string, any>;
}

/**
 * Workbench配置
 */
export interface WorkbenchConfig {
  /** 功能卡片列表 */
  features: FeatureCard[];

  /** 是否显示禁用的功能 */
  showDisabled: boolean;

  /** 布局列数 */
  columns: number;

  /** 最后更新时间 */
  lastUpdated?: string;
}

/**
 * Workbench Slice State
 */
export interface WorkbenchSlice {
  /** 工作台配置 */
  config: WorkbenchConfig;

  /** 设置功能卡片列表 */
  setFeatures: (features: FeatureCard[]) => void;

  /** 更新单个功能卡片 */
  updateFeature: (id: string, updates: Partial<FeatureCard>) => void;

  /** 启用/禁用功能 */
  toggleFeature: (id: string) => void;

  /** 调整功能顺序 */
  reorderFeatures: (fromIndex: number, toIndex: number) => void;

  /** 重置为默认配置 */
  resetToDefault: () => void;

  /** 设置是否显示禁用功能 */
  setShowDisabled: (show: boolean) => void;

  /** 设置布局列数 */
  setColumns: (columns: number) => void;

  /** 获取启用的功能列表（过滤+排序） */
  getEnabledFeatures: () => FeatureCard[];

  /** 根据分类获取功能列表 */
  getFeaturesByCategory: (category: FeatureCategory) => FeatureCard[];

  /** 根据ID获取功能 */
  getFeatureById: (id: string) => FeatureCard | undefined;
}
