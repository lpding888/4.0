/**
 * 租户状态管理
 * 艹！这个Store管理多租户切换和资产隔离！
 *
 * @author 老王
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mutate } from 'swr';

/**
 * 租户信息
 */
export interface Tenant {
  id: string; // 租户ID
  name: string; // 租户名称
  type: 'personal' | 'team' | 'enterprise'; // 租户类型
  role: 'owner' | 'admin' | 'member' | 'viewer'; // 当前用户在该租户下的角色
  avatar?: string; // 租户头像
  member_count?: number; // 成员数量
  created_at: string;
}

/**
 * 租户状态
 */
interface TenantState {
  // 当前激活的租户
  activeTenant: Tenant | null;

  // 可用租户列表（缓存）
  tenants: Tenant[];

  // 加载状态
  isLoading: boolean;
  error: string | null;

  /**
   * 设置当前租户
   */
  setTenant: (tenant: Tenant) => void;

  /**
   * 加载可用租户列表
   */
  fetchTenants: () => Promise<void>;

  /**
   * 清理所有缓存（切换租户时调用）
   */
  clearAllCaches: () => void;

  /**
   * 重置状态
   */
  reset: () => void;
}

/**
 * 租户Store
 */
export const useTenantStore = create<TenantState>()(
  persist(
    (set, get) => ({
      activeTenant: null,
      tenants: [],
      isLoading: false,
      error: null,

      /**
       * 设置当前租户
       */
      setTenant: (tenant: Tenant) => {
        const prevTenant = get().activeTenant;

        // 如果切换到不同的租户，清理所有缓存
        if (prevTenant?.id !== tenant.id) {
          console.log('[Tenant] 切换租户:', prevTenant?.name, '->', tenant.name);

          // 清理所有缓存
          get().clearAllCaches();

          // 设置新租户
          set({ activeTenant: tenant, error: null });

          // 触发全局事件（其他组件可以监听）
          window.dispatchEvent(
            new CustomEvent('tenant-switched', {
              detail: { from: prevTenant, to: tenant },
            })
          );
        } else {
          // 相同租户，只更新状态
          set({ activeTenant: tenant });
        }
      },

      /**
       * 加载可用租户列表
       */
      fetchTenants: async () => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch('/api/tenants');
          if (!response.ok) {
            throw new Error('获取租户列表失败');
          }

          const data = await response.json();
          const tenants = data.tenants || [];

          set({
            tenants,
            isLoading: false,
          });

          // 如果当前没有激活租户，自动激活第一个
          if (!get().activeTenant && tenants.length > 0) {
            set({ activeTenant: tenants[0] });
          }
        } catch (error: any) {
          console.error('[Tenant] 获取租户列表失败:', error);
          set({
            error: error.message || '获取租户列表失败',
            isLoading: false,
          });
        }
      },

      /**
       * 清理所有缓存
       *
       * 切换租户时必须清理：
       * 1. SWR缓存（所有数据请求）
       * 2. localStorage中的其他业务缓存
       * 3. 浏览器缓存的资产数据
       */
      clearAllCaches: () => {
        console.log('[Tenant] 清理所有缓存...');

        // 1. 清理SWR缓存（清空所有已缓存的数据）
        mutate(() => true, undefined, { revalidate: false });

        // 2. 清理localStorage中的业务缓存（保留auth和tenant）
        const keysToKeep = ['auth-storage', 'tenant-storage'];
        const allKeys = Object.keys(localStorage);

        allKeys.forEach((key) => {
          if (!keysToKeep.includes(key)) {
            localStorage.removeItem(key);
          }
        });

        console.log('[Tenant] 缓存清理完成');
      },

      /**
       * 重置状态
       */
      reset: () => {
        set({
          activeTenant: null,
          tenants: [],
          isLoading: false,
          error: null,
        });
      },
    }),
    {
      name: 'tenant-storage', // localStorage key
      partialize: (state) => ({
        // 只持久化 activeTenant 和 tenants
        activeTenant: state.activeTenant,
        tenants: state.tenants,
      }),
    }
  )
);

/**
 * React Hook：获取租户信息
 */
export function useTenant() {
  const { activeTenant, tenants, isLoading, error, setTenant, fetchTenants, clearAllCaches, reset } =
    useTenantStore();

  return {
    // 状态
    activeTenant,
    tenants,
    isLoading,
    error,

    // 操作
    setTenant,
    fetchTenants,
    clearAllCaches,
    reset,

    // 便捷属性
    tenantId: activeTenant?.id,
    tenantName: activeTenant?.name,
    tenantType: activeTenant?.type,
    userRole: activeTenant?.role,
    isOwner: activeTenant?.role === 'owner',
    isAdmin: activeTenant?.role === 'owner' || activeTenant?.role === 'admin',
  };
}
