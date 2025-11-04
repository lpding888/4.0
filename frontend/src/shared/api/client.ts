/**
 * Axios客户端实例
 * 艹，这个tm是所有API请求的基础！
 *
 * @author 老王
 */

import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

/**
 * API基础URL
 * 艹，从环境变量读取，开发环境用localhost！
 */
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

/**
 * 创建axios实例
 * 艹，配置默认选项！
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000, // 艹，30秒超时
  withCredentials: true, // 艹，必须开启！cookie才能传递
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 请求拦截器：自动添加租户ID
 * 艹！多租户系统核心逻辑，所有请求必须带上x-tenant-id！
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 从localStorage读取当前租户（由Zustand持久化）
    try {
      const tenantStorage = localStorage.getItem('tenant-storage');
      if (tenantStorage) {
        const { state } = JSON.parse(tenantStorage);
        const activeTenant = state?.activeTenant;

        if (activeTenant?.id) {
          // 添加租户ID到请求头
          config.headers['x-tenant-id'] = activeTenant.id;
        }
      }
    } catch (error) {
      console.warn('[API Client] 读取租户ID失败:', error);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * 导出BASE_URL
 * 艹，有些地方需要用到！
 */
export { BASE_URL };
