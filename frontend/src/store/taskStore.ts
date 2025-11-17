import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Task, Asset } from '@/types';
import { api } from '@/lib/api';

interface TaskState {
  // 状态
  tasks: Task[];
  currentTask: Task | null;
  assets: Asset[];
  loading: boolean;
  creatingTask: boolean;
  error: string | null;

  // 分页状态
  pagination: {
    total: number;
    page: number;
    pageSize: number;
  };

  // 过滤状态
  filters: {
    status?: string;
    featureId?: string;
    startDate?: string;
    endDate?: string;
  };

  // WebSocket状态
  isConnected: boolean;
  progressCallbacks: Map<string, (progress: number) => void>;

  // 操作方法
  fetchTasks: (params?: { limit?: number; offset?: number; status?: string }) => Promise<void>;
  createTask: (data: { featureId: string; inputData: Record<string, any> }) => Promise<Task | null>;
  getTask: (taskId: string) => Promise<void>;
  fetchAssets: (params?: { userId?: string; type?: string }) => Promise<void>;
  deleteAsset: (assetId: string, deleteCosFile?: boolean) => Promise<void>;
  setCurrentTask: (task: Task | null) => void;
  setFilters: (filters: Partial<TaskState['filters']>) => void;
  setLoading: (loading: boolean) => void;
  setCreatingTask: (creating: boolean) => void;
  setError: (error: string | null) => void;

  // WebSocket方法
  setConnected: (connected: boolean) => void;
  subscribeToProgress: (taskId: string, callback: (progress: number) => void) => void;
  unsubscribeFromProgress: (taskId: string) => void;

  // 重置状态
  resetState: () => void;
}

const initialState = {
  tasks: [],
  currentTask: null,
  assets: [],
  loading: false,
  creatingTask: false,
  error: null,
  pagination: {
    total: 0,
    page: 1,
    pageSize: 20
  },
  filters: {
    status: undefined,
    featureId: undefined,
    startDate: undefined,
    endDate: undefined
  },
  isConnected: false,
  progressCallbacks: new Map()
};

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // 获取任务列表
      fetchTasks: async (params = {}) => {
        const { filters, pagination } = get();

        try {
          set({ loading: true, error: null });

          const requestParams = {
            limit: params.limit || pagination.pageSize,
            offset: params.offset || (pagination.page - 1) * pagination.pageSize,
            status: params.status || filters.status
          };

          const response = await api.task.list(requestParams);

          if (response.data?.success && response.data.data) {
            set({
              tasks: response.data.data.tasks || response.data.data || [],
              pagination: {
                ...pagination,
                total: response.data.data.total || 0
              },
              loading: false
            });
          } else {
            throw new Error(response.data?.message || '获取任务列表失败');
          }
        } catch (error: any) {
          console.error('获取任务列表失败:', error);
          set({
            error: error.message || '获取任务列表失败',
            loading: false
          });
        }
      },

      // 创建任务
      createTask: async (data) => {
        try {
          set({ creatingTask: true, error: null });

          const response = await api.task.createByFeature(data);

          if (response.data?.success && response.data.data) {
            const newTask = response.data.data;

            // 添加到任务列表开头
            set((state) => ({
              tasks: [newTask, ...state.tasks],
              currentTask: newTask,
              creatingTask: false
            }));

            return newTask;
          } else {
            throw new Error(payload?.message || '创建任务失败');
          }
        } catch (error: any) {
          console.error('创建任务失败:', error);
          set({
            error: error.message || '创建任务失败',
            creatingTask: false
          });
          return null;
        }
      },

      // 获取单个任务
      getTask: async (taskId: string) => {
        try {
          set({ loading: true, error: null });

          const response = await api.task.get(taskId);

          if (response.data?.success && response.data.data) {
            const task = response.data.data;
            set({
              currentTask: task,
              loading: false
            });

            // 更新任务列表中的对应任务
            set((state) => ({
              tasks: state.tasks.map(t => t.id === taskId ? task : t)
            }));
          } else {
            throw new Error(payload?.message || '获取任务详情失败');
          }
        } catch (error: any) {
          console.error('获取任务详情失败:', error);
          set({
            error: error.message || '获取任务详情失败',
            loading: false
          });
        }
      },

      // 获取素材库
      fetchAssets: async (params = {}) => {
        try {
          set({ loading: true, error: null });

          const response = await api.assets.getAll(params);

          if (response.data?.success) {
            const assetsList = (response.data as { assets?: Asset[] }).assets ?? [];
            set({
              assets: assetsList,
              loading: false
            });
          } else {
            throw new Error(response.data?.message || '获取素材库失败');
          }
        } catch (error: any) {
          console.error('获取素材库失败:', error);
          set({
            error: error.message || '获取素材库失败',
            loading: false
          });
        }
      },

      // 删除素材
      deleteAsset: async (assetId: string, deleteCosFile = false) => {
        try {
          set({ loading: true, error: null });

          const response = await api.assets.delete(assetId, { delete_cos_file: deleteCosFile });

          if (response.data?.success) {
            // 从素材列表中移除
            set((state) => ({
              assets: state.assets.filter(asset => asset.id !== assetId),
              loading: false
            }));
          } else {
            throw new Error(response.data?.message || '删除素材失败');
          }
        } catch (error: any) {
          console.error('删除素材失败:', error);
          set({
            error: error.message || '删除素材失败',
            loading: false
          });
        }
      },

      // 设置当前任务
      setCurrentTask: (task: Task | null) => {
        set({ currentTask: task });
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

      // 设置创建任务状态
      setCreatingTask: (creating: boolean) => set({ creatingTask: creating }),

      // 设置错误状态
      setError: (error: string | null) => set({ error }),

      // WebSocket连接状态
      setConnected: (connected: boolean) => set({ isConnected: connected }),

      // 订阅任务进度
      subscribeToProgress: (taskId: string, callback: (progress: number) => void) => {
        set((state) => {
          const newCallbacks = new Map(state.progressCallbacks);
          newCallbacks.set(taskId, callback);
          return { progressCallbacks: newCallbacks };
        });
      },

      // 取消订阅任务进度
      unsubscribeFromProgress: (taskId: string) => {
        set((state) => {
          const newCallbacks = new Map(state.progressCallbacks);
          newCallbacks.delete(taskId);
          return { progressCallbacks: newCallbacks };
        });
      },

      // 重置状态
      resetState: () => set(initialState)
    }),
    {
      name: 'task-storage',
      partialize: (state) => ({
        filters: state.filters,
        pagination: state.pagination
      })
    }
  )
);
