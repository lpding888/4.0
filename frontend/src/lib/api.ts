import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: number;
    message: string;
  };
  message?: string;
}

type RefreshResp = {
  accessToken?: string;
  refreshToken?: string;
  user?: any;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_URL ||
  '/api';

let refreshingPromise: Promise<string | null> | null = null;
const refreshSubscribers: Array<(token: string | null) => void> = [];

const onAccessTokenFetched = (token: string | null) => {
  while (refreshSubscribers.length) {
    const subscriber = refreshSubscribers.shift();
    subscriber?.(token);
  }
};

const addRefreshSubscriber = (cb: (token: string | null) => void) => {
  refreshSubscribers.push(cb);
};

function safeCapture(error: any, extra?: Record<string, any>) {
  if (typeof window === 'undefined') return;
  import('@sentry/nextjs')
    .then((Sentry) => {
      if (Sentry?.captureException) {
        Sentry.captureException(error, { extra });
      }
    })
    .catch(() => {});
}

class APIClient {
  public client: AxiosInstance; // 艹，改成public让外部服务层可以用！

  constructor(baseURL: string = API_BASE) {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(
      (config) => {
        if (typeof window !== 'undefined') {
          const token = localStorage.getItem('token');
          if (token) {
            const headers = config.headers || {};
            (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
            config.headers = headers;
          }
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    this.client.interceptors.response.use(
      (response) => response.data ?? response,
      async (error: AxiosError<APIResponse>) => {
        const status = error.response?.status;
        const originalRequest = (error.config || {}) as AxiosRequestConfig & {
          _retry?: boolean;
        };

        if (status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          if (!refreshingPromise) {
            const refreshToken =
              typeof window !== 'undefined'
                ? localStorage.getItem('refresh_token')
                : null;

            if (!refreshToken) {
              this.logoutSideEffects();
              return Promise.reject(this.normalizeError(error));
            }

            refreshingPromise = this.refresh(refreshToken)
              .catch((refreshError) => {
                safeCapture(refreshError, { scope: 'refreshToken' });
                onAccessTokenFetched(null);
                this.logoutSideEffects();
                return null;
              })
              .finally(() => {
                refreshingPromise = null;
              });
          }

          return new Promise((resolve, reject) => {
            addRefreshSubscriber(async (newToken) => {
              if (!newToken) {
                reject(this.normalizeError(error));
                return;
              }

              originalRequest.headers = {
                ...(originalRequest.headers || {}),
                Authorization: `Bearer ${newToken}`,
              };

              try {
                const result = await this.client.request(originalRequest);
                resolve(result);
              } catch (requestError) {
                reject(requestError);
              }
            });
          });
        }

        const normalizedError = this.normalizeError(error);
        safeCapture(error, {
          status,
          url: originalRequest?.url,
          code: normalizedError.code,
        });
        return Promise.reject(normalizedError);
      },
    );
  }

  private async refresh(refreshToken: string): Promise<string> {
    try {
      const resp = await axios.post<RefreshResp>(
        `${API_BASE}/auth/refresh`,
        { refreshToken },
        { timeout: 20000 },
      );

      const data = resp.data ?? (resp as any);
      const accessToken = data?.accessToken;

      if (!accessToken) {
        throw new Error('Refresh response missing accessToken');
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('token', accessToken);
        if (data?.refreshToken) {
          localStorage.setItem('refresh_token', data.refreshToken);
        }
        if (data?.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        try {
          window.dispatchEvent(
            new StorageEvent('storage', { key: 'token', newValue: accessToken }),
          );
        } catch {
          // ignore dispatch errors
        }
      }

      onAccessTokenFetched(accessToken);
      return accessToken;
    } catch (err) {
      onAccessTokenFetched(null);
      throw err;
    }
  }

  private logoutSideEffects() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    try {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'token', newValue: null as any }),
      );
    } catch {
      // ignore dispatch errors
    }
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }

  private normalizeError(error: AxiosError<APIResponse>) {
    let errorMessage = '网络错误,请重试';
    let errorCode = 9999;

    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      errorMessage = '请求超时,请检查网络连接后重试';
      errorCode = 9998;
    } else if (!error.response) {
      errorMessage = '无法连接到服务器,请检查网络连接';
      errorCode = 9997;
    } else {
      const status = error.response.status;
      const errorData = error.response.data;

      switch (status) {
        case 400:
          errorMessage = errorData?.error?.message || '请求参数错误';
          errorCode = errorData?.error?.code || 4000;
          break;
        case 401:
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
          errorMessage =
            errorData?.error?.message || '请求过于频繁,请稍后再试';
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
          errorMessage =
            errorData?.error?.message ||
            errorData?.message ||
            '请求失败,请重试';
          errorCode = errorData?.error?.code || status;
      }
    }

    return {
      code: errorCode,
      message: errorMessage,
    };
  }

  // 认证相关
  auth = {
    sendCode: (phone: string) =>
      this.client.post<APIResponse>('/auth/send-code', { phone }),

    sendEmailCode: (email: string, scene?: string) =>
      this.client.post<APIResponse>('/auth/email/send-code', { email, scene }),

    loginWithCode: (phone: string, code: string) =>
      this.client.post<APIResponse>('/auth/login', { phone, code }),

    login: (phone: string, code: string) =>
      this.client.post<APIResponse>('/auth/login', { phone, code }),

    loginWithPassword: (phone: string, password: string) =>
      this.client.post<APIResponse>('/auth/login/password', { phone, password }),

    passwordLogin: (phone: string, password: string) =>
      this.client.post<APIResponse>('/auth/login/password', { phone, password }),

    loginWithEmailCode: (email: string, code: string, referrerId?: string | null) =>
      this.client.post<APIResponse>('/auth/email/login', {
        email,
        code,
        referrer_id: referrerId ?? null,
      }),

    registerWithEmail: (email: string, code: string, password: string, referrerId?: string | null) =>
      this.client.post<APIResponse>('/auth/email/register', {
        email,
        code,
        password,
        referrer_id: referrerId ?? null,
      }),

    wechatLogin: (code: string) =>
      this.client.post<APIResponse>('/auth/wechat-login', { code }),

    setPassword: (newPassword: string, oldPassword?: string) =>
      this.client.post<APIResponse>('/auth/set-password', {
        newPassword,
        oldPassword,
      }),

    resetPassword: (params: { phone?: string; email?: string; code: string; newPassword: string }) =>
      this.client.post<APIResponse>('/auth/reset-password', params),

    me: () => this.client.get<APIResponse>('/auth/me'),

    // 邮箱登录相关
    sendEmailCode: (email: string) =>
      this.client.post<APIResponse>('/auth/send-email-code', { email }),

    loginWithEmail: (email: string, code: string) =>
      this.client.post<APIResponse>('/auth/login/email', { email, code }),
  };

  // 会员相关
  membership = {
    purchase: (channel: string) =>
      this.client.post<APIResponse>('/membership/purchase', { channel }),

    status: () => this.client.get<APIResponse>('/membership/status'),
  };

  // 任务相关
  task = {
    create: (data: {
      type: string;
      inputImageUrl: string;
      params?: any;
    }) => this.client.post<APIResponse>('/task/create', data),

    createByFeature: (data: {
      featureId: string;
      inputData: Record<string, any>;
    }) => this.client.post<APIResponse>('/task/create-by-feature', data),

    get: (taskId: string) =>
      this.client.get<APIResponse>(`/task/${taskId}`),

    list: (params?: { status?: string; page?: number; pageSize?: number }) =>
      this.client.get<APIResponse>('/task/list', { params }),
  };

  media = {
    getSTS: (taskId: string) =>
      this.client.get<APIResponse>(`/media/sts?taskId=${taskId}`),
  };

  // 管理相关
  admin = {
    getUsers: (params: any) =>
      this.client.get<APIResponse>('/admin/users', { params }),

    getTasks: (params: any) =>
      this.client.get<APIResponse>('/admin/tasks', { params }),

    getFailedTasks: (params: any) =>
      this.client.get<APIResponse>('/admin/failed-tasks', { params }),

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

    toggleFeature: (id: string, data: { is_enabled: boolean }) =>
      this.client.patch<APIResponse>(`/admin/features/${id}`, data),

    deleteFeature: (id: string) =>
      this.client.delete<APIResponse>(`/admin/features/${id}`),

    getFeatureSchema: (featureId: string) =>
      this.client.get<APIResponse>(`/admin/features/${featureId}/schema`),

    updateFeatureSchema: (featureId: string, data: any) =>
      this.client.put<APIResponse>(`/admin/features/${featureId}/schema`, data),
  };

  // 功能相关
  features = {
    getAll: (params?: { enabled?: boolean }) =>
      this.client.get<APIResponse>('/features', { params }),

    getFormSchema: (featureId: string) =>
      this.client.get<APIResponse>(`/features/${featureId}/form-schema`),
  };

  // 素材库相关
  assets = {
    getAll: (params?: { userId?: string; type?: string }) =>
      this.client.get<APIResponse>('/assets', { params }),

    delete: (assetId: string, params?: { delete_cos_file?: boolean }) =>
      this.client.delete<APIResponse>(`/assets/${assetId}`, { params }),
  };

  // ============ 分销代理系统API ============
  distribution = {
    apply: (data: {
      realName: string;
      idCard: string;
      contact: string;
      channel?: string;
    }) => this.client.post<APIResponse>('/distribution/apply', data),

    getStatus: () =>
      this.client.get<APIResponse>('/distribution/status'),

    getDashboard: () =>
      this.client.get<APIResponse>('/distribution/dashboard'),

    getReferrals: (params?: {
      status?: string;
      limit?: number;
      offset?: number;
    }) => this.client.get<APIResponse>('/distribution/referrals', { params }),

    getCommissions: (params?: {
      status?: string;
      limit?: number;
      offset?: number;
    }) => this.client.get<APIResponse>('/distribution/commissions', { params }),

    getWithdrawals: (params?: { limit?: number; offset?: number }) =>
      this.client.get<APIResponse>('/distribution/withdrawals', { params }),

    createWithdrawal: (data: {
      amount: number;
      method: 'wechat' | 'alipay';
      accountInfo: {
        account: string;
        name: string;
      };
    }) => this.client.post<APIResponse>('/distribution/withdraw', data),
  };

  adminDistribution = {
    getDistributors: (params?: {
      status?: string;
      keyword?: string;
      limit?: number;
      offset?: number;
    }) => this.client.get<APIResponse>('/admin/distributors', { params }),

    getDistributor: (id: string) =>
      this.client.get<APIResponse>(`/admin/distributors/${id}`),

    getDistributorReferrals: (
      id: string,
      params?: { limit?: number; offset?: number },
    ) =>
      this.client.get<APIResponse>(
        `/admin/distributors/${id}/referrals`,
        { params },
      ),

    getDistributorCommissions: (
      id: string,
      params?: { limit?: number; offset?: number },
    ) =>
      this.client.get<APIResponse>(
        `/admin/distributors/${id}/commissions`,
        { params },
      ),

    approveDistributor: (id: string) =>
      this.client.patch<APIResponse>(`/admin/distributors/${id}/approve`),

    disableDistributor: (id: string) =>
      this.client.patch<APIResponse>(`/admin/distributors/${id}/disable`),

    getWithdrawals: (params?: {
      status?: string;
      limit?: number;
      offset?: number;
    }) => this.client.get<APIResponse>('/admin/withdrawals', { params }),

    approveWithdrawal: (id: string) =>
      this.client.patch<APIResponse>(`/admin/withdrawals/${id}/approve`),

    rejectWithdrawal: (id: string, data: { reason: string }) =>
      this.client.patch<APIResponse>(`/admin/withdrawals/${id}/reject`, data),

    getStats: () =>
      this.client.get<APIResponse>('/admin/distribution/stats'),

    getSettings: () =>
      this.client.get<APIResponse>('/admin/distribution/settings'),

    updateSettings: (data: {
      commissionRate: number;
      minWithdrawal: number;
      freezeDays: number;
      autoApprove: boolean;
    }) => this.client.put<APIResponse>('/admin/distribution/settings', data),
  };
}

export const api = new APIClient();
export default api;
