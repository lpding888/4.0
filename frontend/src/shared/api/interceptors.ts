/**
 * Axios拦截器
 * 艹，这个tm是工业级axios的核心！
 *
 * 功能：
 * 1. 请求拦截：缓存检查、请求去重
 * 2. 响应拦截：缓存写入、401自动刷新、错误重试
 *
 * @author 老王
 */

import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { message } from 'antd';
import {
  generateCacheKey,
  getRequestCache,
  setRequestCache,
  getInflight,
  setInflight,
  deleteInflight,
} from '../lib/cache';
import { apiClient } from './client';
import type { ApiResponse, RequestConfig } from './types';

/**
 * 是否正在刷新token
 * 艹，防止多个401同时刷新！
 */
let isRefreshing = false;

/**
 * 等待刷新完成的请求队列
 * 艹，刷新token期间的请求都放这里！
 */
let refreshSubscribers: Array<(token?: string) => void> = [];

/**
 * 添加到刷新队列
 */
function subscribeTokenRefresh(callback: (token?: string) => void) {
  refreshSubscribers.push(callback);
}

/**
 * 通知所有等待的请求
 */
function notifyRefreshSubscribers(token?: string) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

/**
 * 刷新Token
 * 艹，调用/auth/refresh接口！
 */
async function refreshToken(): Promise<boolean> {
  try {
    // 艹，刷新接口不能带拦截器，否则会死循环！
    const response = await axios.post('/auth/refresh', {}, {
      baseURL: apiClient.defaults.baseURL,
      withCredentials: true,
    });

    if (response.data?.success) {
      console.log('[Axios] 艹，Token刷新成功！');
      return true;
    }

    return false;
  } catch (error) {
    console.error('[Axios] 艹，Token刷新失败！', error);
    return false;
  }
}

/**
 * 请求拦截器
 * 艹，发送请求前的处理！
 */
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig & { _customConfig?: RequestConfig }) => {
    const customConfig = config._customConfig || {};
    const method = config.method?.toUpperCase() || 'GET';

    // 艹，只有GET请求才支持缓存！
    if (method === 'GET' && customConfig.useCache !== false) {
      const cacheKey = generateCacheKey(method, config.url || '', config.params);

      // 1. 检查缓存
      const cachedData = getRequestCache(cacheKey);
      if (cachedData) {
        console.log(`[Axios] 艹，命中缓存: ${cacheKey}`);
        // 艹，直接返回缓存数据，不发请求！
        return Promise.reject({
          __cached: true,
          data: cachedData,
          config,
        });
      }

      // 2. 检查是否有相同的请求正在进行（请求去重）
      if (!customConfig.skipDedup) {
        const inflightPromise = getInflight(cacheKey);
        if (inflightPromise) {
          console.log(`[Axios] 艹，请求去重: ${cacheKey}`);
          return Promise.reject({
            __deduped: true,
            promise: inflightPromise,
            config,
          });
        }
      }

      // 艹，标记缓存key，响应时用
      config.headers.set('X-Cache-Key', cacheKey);
    }

    return config;
  },
  (error) => {
    console.error('[Axios] 艹，请求拦截器错误！', error);
    return Promise.reject(error);
  }
);

/**
 * 响应拦截器
 * 艹，处理响应和错误！
 */
apiClient.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const config = response.config as InternalAxiosRequestConfig & { _customConfig?: RequestConfig };
    const customConfig = config._customConfig || {};
    const method = config.method?.toUpperCase() || 'GET';

    // 艹，GET请求成功后写入缓存
    if (method === 'GET' && customConfig.useCache !== false) {
      const cacheKey = config.headers.get('X-Cache-Key') as string;
      if (cacheKey) {
        const ttl = customConfig.cacheTTL;
        setRequestCache(cacheKey, response.data, ttl);
        deleteInflight(cacheKey); // 艹，清除inflight标记
      }
    }

    // 艹，检查业务层面的错误
    if (response.data && !response.data.success) {
      const error = new Error(response.data.message || '请求失败') as any;
      error.code = response.data.error_code;
      error.response = response;

      // 艹，显示错误提示
      if (customConfig.showErrorMessage !== false) {
        message.error(response.data.message || '操作失败');
      }

      return Promise.reject(error);
    }

    return response;
  },
  async (error: AxiosError<ApiResponse>) => {
    // 艹，处理缓存命中（这不是真正的错误）
    if ((error as any).__cached) {
      return Promise.resolve({
        data: (error as any).data,
        config: (error as any).config,
        status: 200,
        statusText: 'OK (Cached)',
        headers: {},
      } as AxiosResponse);
    }

    // 艹，处理请求去重（这也不是真正的错误）
    if ((error as any).__deduped) {
      try {
        const result = await (error as any).promise;
        return Promise.resolve(result);
      } catch (dedupError) {
        return Promise.reject(dedupError);
      }
    }

    const config = error.config as (InternalAxiosRequestConfig & { _customConfig?: RequestConfig; _retryCount?: number }) | undefined;
    const customConfig = config?._customConfig || {};

    // 艹，清除inflight标记
    if (config) {
      const method = config.method?.toUpperCase() || 'GET';
      const cacheKey = generateCacheKey(method, config.url || '', config.params);
      deleteInflight(cacheKey);
    }

    // 艹，处理401未授权（自动刷新token）
    if (error.response?.status === 401 && !customConfig.skipAutoRefresh && config) {
      if (!isRefreshing) {
        isRefreshing = true;

        try {
          const success = await refreshToken();

          if (success) {
            // 艹，刷新成功，通知所有等待的请求
            notifyRefreshSubscribers();
            isRefreshing = false;

            // 艹，重试原请求
            console.log('[Axios] 艹，重试原请求:', config.url);
            return apiClient.request(config);
          } else {
            // 艹，刷新失败，清空队列
            notifyRefreshSubscribers();
            isRefreshing = false;

            // 艹，跳转到登录页
            if (typeof window !== 'undefined') {
              window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
            }

            return Promise.reject(new Error('Token刷新失败，请重新登录'));
          }
        } catch (refreshError) {
          isRefreshing = false;
          notifyRefreshSubscribers();
          return Promise.reject(refreshError);
        }
      } else {
        // 艹，正在刷新，加入队列等待
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh(() => {
            // 艹，刷新完成，重试请求
            apiClient.request(config).then(resolve).catch(reject);
          });
        });
      }
    }

    // 艹，处理重试逻辑
    const retryCount = customConfig.retryCount || 0;
    const currentRetry = config?._retryCount || 0;

    if (retryCount > 0 && currentRetry < retryCount && config) {
      config._retryCount = currentRetry + 1;

      console.log(`[Axios] 艹，第${config._retryCount}次重试:`, config.url);

      // 艹，延迟后重试
      const retryDelay = customConfig.retryDelay || 1000;
      await new Promise((resolve) => setTimeout(resolve, retryDelay));

      return apiClient.request(config);
    }

    // 艹，显示错误提示
    if (customConfig.showErrorMessage !== false) {
      const errorMessage = error.response?.data?.message || error.message || '网络请求失败';
      message.error(errorMessage);
    }

    // 艹，调用自定义错误处理
    if (customConfig.onError) {
      customConfig.onError({
        message: error.message,
        code: error.code,
        status: error.response?.status,
        details: error.response?.data,
      });
    }

    return Promise.reject(error);
  }
);

/**
 * 导出配置好的apiClient
 */
export { apiClient };
