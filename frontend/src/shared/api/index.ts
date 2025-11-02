/**
 * API模块入口
 * 艹，统一导出所有API相关的东西！
 *
 * @author 老王
 */

// 艹，导入拦截器初始化（副作用）
import './interceptors';

// 艹，导出axios客户端
export { apiClient, BASE_URL } from './client';

// 艹，导出类型定义
export type {
  ApiResponse,
  PaginatedResponse,
  ApiError,
  RequestConfig,
  LoginResponse,
  RefreshTokenResponse,
  UserInfo,
  HttpMethod,
} from './types';

export { RequestStatus } from './types';

/**
 * API请求辅助函数
 * 艹，简化API调用！
 */
import { apiClient } from './client';
import type { RequestConfig, ApiResponse } from './types';

/**
 * GET请求
 * 艹，默认使用缓存！
 */
export async function get<T = any>(
  url: string,
  params?: Record<string, any>,
  config?: RequestConfig
) {
  const response = await apiClient.get<ApiResponse<T>>(url, {
    params,
    _customConfig: { useCache: true, ...config },
  } as any);
  return response.data;
}

/**
 * POST请求
 * 艹，不使用缓存！
 */
export async function post<T = any>(
  url: string,
  data?: any,
  config?: RequestConfig
) {
  const response = await apiClient.post<ApiResponse<T>>(url, data, {
    _customConfig: config,
  } as any);
  return response.data;
}

/**
 * PUT请求
 */
export async function put<T = any>(
  url: string,
  data?: any,
  config?: RequestConfig
) {
  const response = await apiClient.put<ApiResponse<T>>(url, data, {
    _customConfig: config,
  } as any);
  return response.data;
}

/**
 * DELETE请求
 */
export async function del<T = any>(
  url: string,
  config?: RequestConfig
) {
  const response = await apiClient.delete<ApiResponse<T>>(url, {
    _customConfig: config,
  } as any);
  return response.data;
}

/**
 * PATCH请求
 */
export async function patch<T = any>(
  url: string,
  data?: any,
  config?: RequestConfig
) {
  const response = await apiClient.patch<ApiResponse<T>>(url, data, {
    _customConfig: config,
  } as any);
  return response.data;
}
