import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MembershipStatus } from '@/types';
import { api } from '@/lib/api';

interface MembershipState {
  // 状态
  membershipStatus: MembershipStatus | null;
  loading: boolean;
  purchasing: boolean;
  error: string | null;

  // 操作方法
  fetchMembershipStatus: () => Promise<void>;
  purchaseMembership: (channel: string) => Promise<boolean>;
  setMembershipStatus: (status: MembershipStatus | null) => void;
  setLoading: (loading: boolean) => void;
  setPurchasing: (purchasing: boolean) => void;
  setError: (error: string | null) => void;
  resetState: () => void;

  // 计算属性
  isMember: () => boolean;
  getRemainingQuota: () => number;
  getExpireDays: () => number;
  isExpired: () => boolean;
  needsRenewal: () => boolean;
}

const initialState = {
  membershipStatus: null,
  loading: false,
  purchasing: false,
  error: null
};

export const useMembershipStore = create<MembershipState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // 获取会员状态
      fetchMembershipStatus: async () => {
        try {
          set({ loading: true, error: null });

          const response = await api.membership.status();
          const payload = response.data;

          if (payload?.success && payload.data) {
            set({
              membershipStatus: payload.data,
              loading: false
            });
          } else {
            throw new Error(payload?.message || '获取会员状态失败');
          }
        } catch (error: any) {
          console.error('获取会员状态失败:', error);
          set({
            error: error.message || '获取会员状态失败',
            loading: false
          });
        }
      },

      // 购买会员
      purchaseMembership: async (channel: string) => {
        try {
          set({ purchasing: true, error: null });

          const response = await api.membership.purchase(channel);
          const payload = response.data;

          if (payload?.success) {
            // 重新获取会员状态
            await get().fetchMembershipStatus();
            set({ purchasing: false });
            return true;
          } else {
            throw new Error(payload?.message || '购买会员失败');
          }
        } catch (error: any) {
          console.error('购买会员失败:', error);
          set({
            error: error.message || '购买会员失败',
            purchasing: false
          });
          return false;
        }
      },

      // 设置会员状态
      setMembershipStatus: (status: MembershipStatus | null) => {
        set({ membershipStatus: status });
      },

      // 设置加载状态
      setLoading: (loading: boolean) => set({ loading }),

      // 设置购买状态
      setPurchasing: (purchasing: boolean) => set({ purchasing }),

      // 设置错误状态
      setError: (error: string | null) => set({ error }),

      // 重置状态
      resetState: () => set(initialState),

      // 计算属性方法
      isMember: () => {
        const { membershipStatus } = get();
        return membershipStatus?.isMember || false;
      },

      getRemainingQuota: () => {
        const { membershipStatus } = get();
        return membershipStatus?.quota_remaining || membershipStatus?.quotaRemaining || 0;
      },

      getExpireDays: () => {
        const { membershipStatus } = get();
        return membershipStatus?.expireDays || 0;
      },

      isExpired: () => {
        const { membershipStatus } = get();
        if (!membershipStatus?.quota_expireAt) return true;

        const expireDate = new Date(membershipStatus.quota_expireAt);
        const now = new Date();
        return expireDate < now;
      },

      needsRenewal: () => {
        const { membershipStatus } = get();
        if (!membershipStatus?.isMember) return true;

        const remainingDays = get().getExpireDays();
        const remainingQuota = get().getRemainingQuota();

        // 剩余少于7天或配额少于10次需要续费
        return remainingDays < 7 || remainingQuota < 10;
      }
    }),
    {
      name: 'membership-storage'
    }
  )
);
