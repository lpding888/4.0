/**
 * 默认功能卡片配置
 * 艹，这个tm是工作台的默认功能列表！
 */

import { FeatureCard, FeatureCardSize, FeatureCategory } from './types';

/**
 * 默认功能卡片列表
 * 艹，这些是AI衣柜项目的核心功能！
 */
export const DEFAULT_FEATURES: FeatureCard[] = [
  // AI功能
  {
    id: 'ai-process',
    title: 'AI照片处理',
    description: '使用AI技术处理您的照片',
    icon: 'ThunderboltOutlined',
    path: '/ai/process',
    permission: 'feature:ai_process',
    enabled: true,
    order: 1,
    size: FeatureCardSize.LARGE,
    category: FeatureCategory.AI,
    isHot: true,
  },
  {
    id: 'ai-history',
    title: '处理历史',
    description: '查看您的AI处理记录',
    icon: 'HistoryOutlined',
    path: '/ai/history',
    permission: 'feature:ai_process',
    enabled: true,
    order: 2,
    size: FeatureCardSize.MEDIUM,
    category: FeatureCategory.AI,
  },

  // 用户功能
  {
    id: 'membership',
    title: '会员中心',
    description: '管理您的会员权益',
    icon: 'CrownOutlined',
    path: '/membership',
    enabled: true,
    order: 3,
    size: FeatureCardSize.MEDIUM,
    category: FeatureCategory.USER,
  },
  {
    id: 'distribution',
    title: '分销推广',
    description: '推广赚取佣金',
    icon: 'ShareAltOutlined',
    path: '/distribution',
    permission: 'feature:distribution',
    enabled: true,
    order: 4,
    size: FeatureCardSize.MEDIUM,
    category: FeatureCategory.USER,
  },
  {
    id: 'profile',
    title: '个人设置',
    description: '管理您的个人信息',
    icon: 'UserOutlined',
    path: '/profile',
    enabled: true,
    order: 5,
    size: FeatureCardSize.SMALL,
    category: FeatureCategory.USER,
  },

  // 管理功能（需要admin权限）
  {
    id: 'admin-dashboard',
    title: '管理后台',
    description: '系统管理控制台',
    icon: 'DashboardOutlined',
    path: '/admin',
    permission: 'page:admin',
    enabled: true,
    order: 10,
    size: FeatureCardSize.LARGE,
    category: FeatureCategory.ADMIN,
  },
  {
    id: 'admin-users',
    title: '用户管理',
    description: '管理所有用户',
    icon: 'TeamOutlined',
    path: '/admin/users',
    permission: 'page:admin',
    enabled: true,
    order: 11,
    size: FeatureCardSize.MEDIUM,
    category: FeatureCategory.ADMIN,
  },
  {
    id: 'admin-distributors',
    title: '分销员管理',
    description: '管理分销员账号',
    icon: 'UsergroupAddOutlined',
    path: '/admin/distributors',
    permission: 'page:admin',
    enabled: true,
    order: 12,
    size: FeatureCardSize.MEDIUM,
    category: FeatureCategory.ADMIN,
  },
  {
    id: 'admin-forms',
    title: '表单设计器',
    description: '可视化设计表单',
    icon: 'FormOutlined',
    path: '/admin/forms/builder',
    permission: 'page:admin',
    enabled: true,
    order: 13,
    size: FeatureCardSize.SMALL,
    category: FeatureCategory.ADMIN,
    isNew: true,
  },
  {
    id: 'admin-pipelines',
    title: 'Pipeline编辑器',
    description: '配置AI处理流程',
    icon: 'ApiOutlined',
    path: '/admin/pipelines/editor',
    permission: 'page:admin',
    enabled: true,
    order: 14,
    size: FeatureCardSize.SMALL,
    category: FeatureCategory.ADMIN,
  },

  // 数据统计
  {
    id: 'analytics',
    title: '数据统计',
    description: '查看系统数据报表',
    icon: 'BarChartOutlined',
    path: '/analytics',
    permission: 'page:admin',
    enabled: true,
    order: 20,
    size: FeatureCardSize.MEDIUM,
    category: FeatureCategory.ANALYTICS,
  },

  // 系统功能
  {
    id: 'notifications',
    title: '通知中心',
    description: '查看系统通知',
    icon: 'BellOutlined',
    path: '/notifications',
    enabled: true,
    order: 30,
    size: FeatureCardSize.SMALL,
    category: FeatureCategory.SYSTEM,
  },
  {
    id: 'help',
    title: '帮助中心',
    description: '使用帮助和常见问题',
    icon: 'QuestionCircleOutlined',
    path: '/help',
    enabled: true,
    order: 31,
    size: FeatureCardSize.SMALL,
    category: FeatureCategory.SYSTEM,
  },
];

/**
 * 根据用户角色获取推荐的功能配置
 * 艹，根据不同角色返回不同的默认配置！
 */
export function getRecommendedFeaturesByRole(role?: string): FeatureCard[] {
  // 艹，克隆一份默认配置，避免修改原数组
  const features = [...DEFAULT_FEATURES];

  if (!role) {
    return features;
  }

  // 管理员：全部功能都启用
  if (role === 'admin' || role === 'super_admin') {
    return features;
  }

  // 分销员：突出分销功能
  if (role === 'distributor') {
    return features.map((f) => {
      if (f.id === 'distribution') {
        return { ...f, order: 1, size: FeatureCardSize.LARGE };
      }
      return f;
    });
  }

  // 普通用户：隐藏管理功能
  return features.map((f) => {
    if (f.category === FeatureCategory.ADMIN) {
      return { ...f, enabled: false };
    }
    return f;
  });
}
