/**
 * Axios客户端实例
 * 艹，这个tm是所有API请求的基础！
 *
 * @author 老王
 */

import axios, { AxiosInstance } from 'axios';

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
 * 导出BASE_URL
 * 艹，有些地方需要用到！
 */
export { BASE_URL };
