/**
 * 认证状态Slice
 * 艹，这个tm管理用户登录状态！
 *
 * @author 老王
 */

import { StateCreator } from 'zustand';
import type { UserInfo } from '@/shared/api';

/**
 * 认证状态接口
 */
export interface AuthSlice {
  // 艹，用户信息
  user: UserInfo | null;

  // 艹，是否已认证
  isAuthenticated: boolean;

  // 艹，是否正在加载用户信息
  isLoadingUser: boolean;

  // Actions

  /**
   * 设置用户信息
   * 艹，登录成功后调用！
   */
  setUser: (user: UserInfo) => void;

  /**
   * 清除用户信息
   * 艹，登出时调用！
   */
  clearUser: () => void;

  /**
   * 设置加载状态
   */
  setLoadingUser: (loading: boolean) => void;

  /**
   * 检查是否有指定角色
   * 艹，权限判断用的！
   */
  hasRole: (role: string) => boolean;

  /**
   * 检查是否有任意一个角色
   */
  hasAnyRole: (roles: string[]) => boolean;

  /**
   * 检查是否有所有角色
   */
  hasAllRoles: (roles: string[]) => boolean;

  /**
   * 检查会员是否有效
   * 艹，判断会员是否过期！
   */
  isMembershipValid: () => boolean;

  /**
   * 获取剩余配额
   */
  getQuotaBalance: () => number;
}

/**
 * 创建认证状态Slice
 * 艹，这个tm是slice工厂函数！
 */
export const createAuthSlice: StateCreator<AuthSlice> = (set, get) => ({
  // 艹，初始状态
  user: null,
  isAuthenticated: false,
  isLoadingUser: false,

  // 艹，Actions实现
  setUser: (user) =>
    set({
      user,
      isAuthenticated: true,
      isLoadingUser: false,
    }),

  clearUser: () =>
    set({
      user: null,
      isAuthenticated: false,
      isLoadingUser: false,
    }),

  setLoadingUser: (loading) =>
    set({
      isLoadingUser: loading,
    }),

  hasRole: (role) => {
    const { user } = get();
    return user?.roles?.includes(role) || false;
  },

  hasAnyRole: (roles) => {
    const { user } = get();
    if (!user?.roles) return false;
    return roles.some((role) => user.roles.includes(role));
  },

  hasAllRoles: (roles) => {
    const { user } = get();
    if (!user?.roles) return false;
    return roles.every((role) => user.roles.includes(role));
  },

  isMembershipValid: () => {
    const { user } = get();
    if (!user?.membership_expires_at) return false;

    const expiresAt = new Date(user.membership_expires_at);
    return expiresAt > new Date();
  },

  getQuotaBalance: () => {
    const { user } = get();
    return user?.quota_balance || 0;
  },
});
