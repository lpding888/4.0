/**
 * API类型定义
 * 艹，这个tm定义所有API相关的类型！
 *
 * @author 老王
 */

/**
 * 统一API响应格式
 * 艹，后端必须返回这个格式！
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  error_code?: string;
}

/**
 * 分页响应
 * 艹，列表接口都返回这个！
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages?: number;
}

/**
 * API错误
 * 艹，统一错误格式！
 */
export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: any;
}

/**
 * 请求配置扩展
 * 艹，自定义请求行为！
 */
export interface RequestConfig {
  /** 是否使用缓存（仅GET请求） */
  useCache?: boolean;
  /** 缓存TTL（毫秒），默认30秒 */
  cacheTTL?: number;
  /** 是否跳过请求去重 */
  skipDedup?: boolean;
  /** 是否跳过401自动刷新 */
  skipAutoRefresh?: boolean;
  /** 重试次数，默认0 */
  retryCount?: number;
  /** 重试延迟（毫秒），默认1000 */
  retryDelay?: number;
  /** 是否显示错误提示（默认true） */
  showErrorMessage?: boolean;
  /** 是否显示加载提示 */
  showLoading?: boolean;
  /** 自定义错误处理 */
  onError?: (error: ApiError) => void;
}

/**
 * 登录响应
 * 艹，登录成功返回的数据！
 */
export interface LoginResponse {
  user: {
    id: number;
    username: string;
    email: string;
    roles: string[];
    quota_balance: number;
    membership_expires_at?: string;
  };
  // 艹，token在cookie里，不需要前端存储
}

/**
 * 刷新Token响应
 * 艹，刷新成功后返回新token（在cookie里）
 */
export interface RefreshTokenResponse {
  success: true;
}

/**
 * 用户信息
 * 艹，/me接口返回的数据！
 */
export interface UserInfo {
  id: number;
  username: string;
  email: string;
  roles: string[];
  quota_balance: number;
  membership_expires_at?: string;
  created_at: string;
}

/**
 * HTTP方法
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * 请求状态
 */
export enum RequestStatus {
  IDLE = 'idle',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error',
}
