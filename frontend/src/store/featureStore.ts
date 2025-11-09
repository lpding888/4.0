import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Feature, FormSchema } from '@/types';
import { api } from '@/lib/api';

interface FeatureState {
  // 状态
  features: Feature[];
  selectedFeature: Feature | null;
  formSchema: FormSchema | null;
  loading: boolean;
  error: string | null;

  // 分页状态
  pagination: {
    total: number;
    page: number;
    pageSize: number;
  };

  // 过滤状态
  filters: {
    category?: string;
    enabled?: boolean;
    search?: string;
  };

  // 操作方法
  fetchFeatures: (params?: { enabled?: boolean; category?: string }) => Promise<void>;
  fetchFormSchema: (featureId: string) => Promise<void>;
  selectFeature: (feature: Feature) => void;
  clearSelection: () => void;
  setFilters: (filters: Partial<FeatureState['filters']>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetState: () => void;
}

const initialState = {
  features: [],
  selectedFeature: null,
  formSchema: null,
  loading: false,
  error: null,
  pagination: {
    total: 0,
    page: 1,
    pageSize: 20
  },
  filters: {
    category: undefined,
    enabled: undefined,
    search: undefined
  }
};

export const useFeatureStore = create<FeatureState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // 获取功能列表
      fetchFeatures: async (params = {}) => {
        const { filters, pagination } = get();

        try {
          set({ loading: true, error: null });

          const requestParams = {
            enabled: params.enabled ?? filters.enabled,
            category: params.category ?? filters.category,
            limit: pagination.pageSize,
            offset: (pagination.page - 1) * pagination.pageSize
          };

          const response = await api.features.getAll(requestParams);
          const payload = response.data;

          if (payload?.success && payload.data) {
            let features = payload.data.features || payload.data;

            // 客户端搜索过滤
            if (filters.search) {
              const searchTerm = filters.search.toLowerCase();
              features = features.filter((feature: Feature) =>
                feature.display_name.toLowerCase().includes(searchTerm) ||
                feature.description.toLowerCase().includes(searchTerm)
              );
            }

            set({
              features: Array.isArray(features) ? features : [],
              pagination: {
                ...pagination,
                total: payload.data.total || features.length
              },
              loading: false
            });
          } else {
            throw new Error(payload?.message || '获取功能列表失败');
          }
        } catch (error: any) {
          console.error('获取功能列表失败:', error);
          set({
            error: error.message || '获取功能列表失败',
            loading: false
          });
        }
      },

      // 获取表单Schema
      fetchFormSchema: async (featureId: string) => {
        try {
          set({ loading: true, error: null });

          const response = await api.features.getFormSchema(featureId);
          const payload = response.data;

          if (payload?.success && payload.data) {
            set({
              formSchema: payload.data,
              loading: false
            });
          } else {
            throw new Error(payload?.message || '获取表单配置失败');
          }
        } catch (error: any) {
          console.error('获取表单配置失败:', error);
          set({
            error: error.message || '获取表单配置失败',
            loading: false
          });
        }
      },

      // 选择功能
      selectFeature: (feature: Feature) => {
        set({
          selectedFeature: feature,
          formSchema: null // 清除之前的表单配置
        });
      },

      // 清除选择
      clearSelection: () => {
        set({
          selectedFeature: null,
          formSchema: null
        });
      },

      // 设置过滤条件
      setFilters: (newFilters) => {
        const currentFilters = get().filters;
        set({
          filters: { ...currentFilters, ...newFilters },
          pagination: { ...get().pagination, page: 1 } // 重置到第一页
        });
      },

      // 设置加载状态
      setLoading: (loading: boolean) => set({ loading }),

      // 设置错误状态
      setError: (error: string | null) => set({ error }),

      // 重置状态
      resetState: () => set(initialState)
    }),
    {
      name: 'feature-storage',
      partialize: (state) => ({
        filters: state.filters,
        pagination: state.pagination
      })
    }
  )
);
