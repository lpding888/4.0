import axios, { AxiosInstance, AxiosError } from 'axios';

interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: number;
    message: string;
  };
  message?: string;
}

class APIClient {
  public client: AxiosInstance; // 艹，改成public让外部服务层可以用！

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // 请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        // 从localStorage获取token
        if (typeof window !== 'undefined') {
          const token = localStorage.getItem('token');
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // 响应拦截器 - 艹！老王我优化了错误处理，让用户知道到底TM发生了什么！
    this.client.interceptors.response.use(
      (response) => response.data,
      (error: AxiosError<APIResponse>) => {
        let errorMessage = '网络错误,请重试';
        let errorCode = 9999;

        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          // 请求超时
          errorMessage = '请求超时,请检查网络连接后重试';
          errorCode = 9998;
        } else if (!error.response) {
          // 网络断开或服务器无响应
          errorMessage = '无法连接到服务器,请检查网络连接';
          errorCode = 9997;
        } else {
          // 有响应，根据状态码分类处理
          const status = error.response.status;
          const errorData = error.response.data;

          switch (status) {
            case 400:
              errorMessage = errorData?.error?.message || '请求参数错误';
              errorCode = errorData?.error?.code || 4000;
              break;

            case 401:
              // 未登录，清除token并跳转登录页
              if (typeof window !== 'undefined') {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
              }
              errorMessage = '登录已过期,请重新登录';
              errorCode = 4010;
              break;

            case 403:
              errorMessage = '没有权限访问该资源';
              errorCode = 4030;
              break;

            case 404:
              errorMessage = '请求的资源不存在';
              errorCode = 4040;
              break;

            case 429:
              errorMessage = errorData?.error?.message || '请求过于频繁,请稍后再试';
              errorCode = errorData?.error?.code || 4290;
              break;

            case 500:
              errorMessage = '服务器内部错误,请稍后再试';
              errorCode = 5000;
              break;

            case 502:
            case 503:
            case 504:
              errorMessage = '服务暂时不可用,请稍后再试';
              errorCode = 5030;
              break;

            default:
              // 使用后端返回的错误信息
              errorMessage = errorData?.error?.message || errorData?.message || '请求失败,请重试';
              errorCode = errorData?.error?.code || status;
          }
        }

        return Promise.reject({
          code: errorCode,
          message: errorMessage
        });
      }
    );
  }

  // 认证相关
  auth = {
    sendCode: (phone: string) =>
      this.client.post<APIResponse>('/auth/send-code', { phone }),

    login: (phone: string, code: string) =>
      this.client.post<APIResponse>('/auth/login', { phone, code }),

    me: () => this.client.get<APIResponse>('/auth/me')
  };

  // 会员相关
  membership = {
    purchase: (channel: string) =>
      this.client.post<APIResponse>('/membership/purchase', { channel }),

    status: () => this.client.get<APIResponse>('/membership/status')
  };

  // 任务相关
  task = {
    // 旧版创建任务接口（保留兼容性）
    create: (data: {
      type: string;
      inputImageUrl: string;
      params?: any;
    }) => this.client.post<APIResponse>('/task/create', data),

    // 新版：基于功能卡片创建任务
    createByFeature: (data: {
      featureId: string;
      inputData: Record<string, any>;
    }) => this.client.post<APIResponse>('/task/create-by-feature', data),

    get: (taskId: string) =>
      this.client.get<APIResponse>(`/task/${taskId}`),

    list: (params: { limit?: number; offset?: number; status?: string }) =>
      this.client.get<APIResponse>('/task/list', { params })
  };

  // 媒体相关
  media = {
    getSTS: (taskId: string) =>
      this.client.get<APIResponse>(`/media/sts?taskId=${taskId}`)
  };

  // 管理相关
  admin = {
    getUsers: (params: any) =>
      this.client.get<APIResponse>('/admin/users', { params }),

    getTasks: (params: any) =>
      this.client.get<APIResponse>('/admin/tasks', { params }),

    getFailedTasks: (params: any) =>
      this.client.get<APIResponse>('/admin/failed-tasks', { params }),

    // 功能卡片管理
    getFeatures: () =>
      this.client.get<APIResponse>('/admin/features'),

    createFeature: (data: any) =>
      this.client.post<APIResponse>('/admin/features', data),

    // Feature Wizard创建（CMS-208）- 艹！专用于向导页面！
    createFeatureFromWizard: (data: {
      feature_id: string;
      display_name: string;
      description: string;
      category?: string;
      icon?: string;
      plan_required?: string;
      access_scope?: string;
      quota_cost?: number;
      rate_limit_policy?: string;
      form_schema_id?: string;
      pipeline_schema_id: string;
      pipeline_schema_data: {
        nodes: any[];
        edges: any[];
      };
    }) => this.client.post<APIResponse>('/admin/features/wizard', data),

    updateFeature: (featureId: string, data: any) =>
      this.client.put<APIResponse>(`/admin/features/${featureId}`, data),

    toggleFeature: (featureId: string, data: { is_enabled: boolean }) =>
      this.client.patch<APIResponse>(`/admin/features/${featureId}`, data),

    deleteFeature: (featureId: string) =>
      this.client.delete<APIResponse>(`/admin/features/${featureId}`)
  };

  // 功能卡片相关
  features = {
    // 获取用户可用的功能卡片列表
    getAll: (params?: { enabled?: boolean }) =>
      this.client.get<APIResponse>('/features', { params }),

    // 获取指定功能的表单Schema
    getFormSchema: (featureId: string) =>
      this.client.get<APIResponse>(`/features/${featureId}/form-schema`)
  };

  // 素材库相关
  assets = {
    // 获取用户素材库
    getAll: (params?: { userId?: string; type?: string }) =>
      this.client.get<APIResponse>('/assets', { params }),

    // 删除素材
    delete: (assetId: string, params?: { delete_cos_file?: boolean }) =>
      this.client.delete<APIResponse>(`/assets/${assetId}`, { params })
  };

  // ============ 分销代理系统API ============

  // 用户端 - 分销相关
  distribution = {
    // 申请成为分销员
    apply: (data: {
      realName: string;
      idCard: string;
      contact: string;
      channel?: string;
    }) => this.client.post<APIResponse>('/distribution/apply', data),

    // 查询分销员状态
    getStatus: () =>
      this.client.get<APIResponse>('/distribution/status'),

    // 分销中心数据概览
    getDashboard: () =>
      this.client.get<APIResponse>('/distribution/dashboard'),

    // 推广用户列表
    getReferrals: (params?: { status?: string; limit?: number; offset?: number }) =>
      this.client.get<APIResponse>('/distribution/referrals', { params }),

    // 佣金明细
    getCommissions: (params?: { status?: string; limit?: number; offset?: number }) =>
      this.client.get<APIResponse>('/distribution/commissions', { params }),

    // 提现记录
    getWithdrawals: (params?: { limit?: number; offset?: number }) =>
      this.client.get<APIResponse>('/distribution/withdrawals', { params }),

    // 申请提现
    createWithdrawal: (data: {
      amount: number;
      method: 'wechat' | 'alipay';
      accountInfo: {
        account: string;
        name: string;
      };
    }) => this.client.post<APIResponse>('/distribution/withdraw', data)
  };

  // 管理端 - 分销管理（扩展admin对象）
  adminDistribution = {
    // 分销员列表
    getDistributors: (params?: {
      status?: string;
      keyword?: string;
      limit?: number;
      offset?: number;
    }) => this.client.get<APIResponse>('/admin/distributors', { params }),

    // 分销员详情
    getDistributor: (id: string) =>
      this.client.get<APIResponse>(`/admin/distributors/${id}`),

    // 分销员推广用户列表
    getDistributorReferrals: (id: string, params?: { limit?: number; offset?: number }) =>
      this.client.get<APIResponse>(`/admin/distributors/${id}/referrals`, { params }),

    // 分销员佣金记录
    getDistributorCommissions: (id: string, params?: { limit?: number; offset?: number }) =>
      this.client.get<APIResponse>(`/admin/distributors/${id}/commissions`, { params }),

    // 审核分销员申请
    approveDistributor: (id: string) =>
      this.client.patch<APIResponse>(`/admin/distributors/${id}/approve`),

    // 禁用分销员
    disableDistributor: (id: string) =>
      this.client.patch<APIResponse>(`/admin/distributors/${id}/disable`),

    // 提现申请列表
    getWithdrawals: (params?: {
      status?: string;
      limit?: number;
      offset?: number;
    }) => this.client.get<APIResponse>('/admin/withdrawals', { params }),

    // 审核通过提现
    approveWithdrawal: (id: string) =>
      this.client.patch<APIResponse>(`/admin/withdrawals/${id}/approve`),

    // 拒绝提现
    rejectWithdrawal: (id: string, data: { reason: string }) =>
      this.client.patch<APIResponse>(`/admin/withdrawals/${id}/reject`, data),

    // 分销数据统计
    getStats: () =>
      this.client.get<APIResponse>('/admin/distribution/stats'),

    // 获取佣金设置
    getSettings: () =>
      this.client.get<APIResponse>('/admin/distribution/settings'),

    // 更新佣金设置
    updateSettings: (data: {
      commissionRate: number;
      minWithdrawal: number;
      freezeDays: number;
      autoApprove: boolean;
    }) => this.client.put<APIResponse>('/admin/distribution/settings', data)
  };
}

export const api = new APIClient();
export default api;
