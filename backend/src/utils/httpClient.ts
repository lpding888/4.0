/**
 * 通用HTTP客户端封装 - 统一第三方API调用行为
 * 这个SB模块专门干这些事：
 * - 统一超时/重试策略
 * - 打日志
 * - 上Prometheus指标
 */

import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type AxiosError
} from 'axios';
import logger from './logger.js';
import metricsService from '../services/metrics.service.js';

export interface HttpClientOptions {
  serviceName: string; // 外部服务名字，用于日志和指标
  baseURL?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  retryOnStatus?: number[]; // 需要重试的HTTP状态码
}

export interface HttpRequestConfig extends AxiosRequestConfig {
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  retryOnStatus?: number[];
}

export interface HttpClient {
  request<T = unknown>(config: HttpRequestConfig): Promise<AxiosResponse<T>>;
  get<T = unknown>(url: string, config?: HttpRequestConfig): Promise<T>;
  post<T = unknown>(url: string, data?: unknown, config?: HttpRequestConfig): Promise<T>;
  put<T = unknown>(url: string, data?: unknown, config?: HttpRequestConfig): Promise<T>;
  delete<T = unknown>(url: string, config?: HttpRequestConfig): Promise<T>;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const isRetryableError = (error: AxiosError, retryOnStatus: number[]): boolean => {
  if (!error.response) {
    // 没有响应，多半是网络错误或超时，可以重试
    return true;
  }
  return retryOnStatus.includes(error.response.status);
};

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const {
    serviceName,
    baseURL,
    timeoutMs = Number.parseInt(process.env.HTTP_CLIENT_TIMEOUT_MS ?? '30000', 10),
    maxRetries = Number.parseInt(process.env.HTTP_CLIENT_MAX_RETRIES ?? '2', 10),
    retryDelayMs = Number.parseInt(process.env.HTTP_CLIENT_RETRY_DELAY_MS ?? '500', 10),
    retryOnStatus = [502, 503, 504]
  } = options;

  const instance: AxiosInstance = axios.create({
    baseURL,
    timeout: timeoutMs
  });

  const request = async <T = unknown>(config: HttpRequestConfig): Promise<AxiosResponse<T>> => {
    const finalTimeout = config.timeoutMs ?? timeoutMs;
    const finalMaxRetries = config.maxRetries ?? maxRetries;
    const finalRetryDelayMs = config.retryDelayMs ?? retryDelayMs;
    const finalRetryOnStatus = config.retryOnStatus ?? retryOnStatus;

    const method = (config.method ?? 'GET').toUpperCase();
    const url = config.url ?? '';
    const labelPath = `${serviceName}:${url}`;

    let attempt = 0;
    let lastError: AxiosError | null = null;

    // 简单重试循环，别搞花里胡哨的
    // 艹，注意：重试次数是 maxRetries，总尝试次数是 maxRetries+1
    while (attempt <= finalMaxRetries) {
      const start = Date.now();
      try {
        const response = await instance.request<T>({
          ...config,
          timeout: finalTimeout
        });

        const durationSeconds = (Date.now() - start) / 1000;
        const statusCode = response.status;

        // 复用HTTP指标，path里加上服务名方便区分
        metricsService.recordHttpRequest(method, labelPath, statusCode, durationSeconds);

        logger.info('[HTTP] 外部调用成功', {
          service: serviceName,
          method,
          url,
          statusCode,
          durationMs: Math.round(durationSeconds * 1000),
          attempt
        });

        return response;
      } catch (err) {
        const error = err as AxiosError;
        lastError = error;
        const durationSeconds = (Date.now() - start) / 1000;
        const statusCode = error.response?.status;

        metricsService.recordHttpRequest(method, labelPath, statusCode ?? 0, durationSeconds);

        const shouldRetry =
          attempt < finalMaxRetries && isRetryableError(error, finalRetryOnStatus);

        logger.warn('[HTTP] 外部调用失败', {
          service: serviceName,
          method,
          url,
          statusCode,
          durationMs: Math.round(durationSeconds * 1000),
          attempt,
          willRetry: shouldRetry,
          error: error.message
        });

        if (!shouldRetry) {
          throw error;
        }

        attempt += 1;
        await sleep(finalRetryDelayMs);
      }
    }

    // 理论上不会到这，保险起见
    throw lastError ?? new Error(`[HTTP] 调用 ${serviceName} 失败且没有可用错误信息`);
  };

  const extractData = async <T>(promise: Promise<AxiosResponse<T>>): Promise<T> => {
    const res = await promise;
    return res.data;
  };

  return {
    request,
    get: async <T>(url: string, config: HttpRequestConfig = {}): Promise<T> =>
      await extractData<T>(
        request<T>({
          ...config,
          method: 'GET',
          url
        })
      ),
    post: async <T>(url: string, data?: unknown, config: HttpRequestConfig = {}): Promise<T> =>
      await extractData<T>(
        request<T>({
          ...config,
          method: 'POST',
          url,
          data
        })
      ),
    put: async <T>(url: string, data?: unknown, config: HttpRequestConfig = {}): Promise<T> =>
      await extractData<T>(
        request<T>({
          ...config,
          method: 'PUT',
          url,
          data
        })
      ),
    delete: async <T>(url: string, config: HttpRequestConfig = {}): Promise<T> =>
      await extractData<T>(
        request<T>({
          ...config,
          method: 'DELETE',
          url
        })
      )
  };
}

// 默认客户端，给一些不那么关键的SB调用用
export const defaultHttpClient = createHttpClient({
  serviceName: 'default_external'
});
