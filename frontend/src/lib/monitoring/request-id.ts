/**
 * RequestID 全链路追踪
 * 艹！每个请求都要有ID，前后端全链路追踪！
 *
 * @author 老王
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * 生成RequestID
 */
export function generateRequestId(): string {
  return `req_${uuidv4().substring(0, 8)}_${Date.now()}`;
}

/**
 * RequestID 管理器
 */
class RequestIdManager {
  private static instance: RequestIdManager;
  private currentRequestId: string | null = null;

  private constructor() {}

  static getInstance(): RequestIdManager {
    if (!RequestIdManager.instance) {
      RequestIdManager.instance = new RequestIdManager();
    }
    return RequestIdManager.instance;
  }

  /**
   * 设置当前RequestID
   */
  setRequestId(requestId?: string): string {
    const id = requestId || generateRequestId();
    this.currentRequestId = id;
    return id;
  }

  /**
   * 获取当前RequestID
   */
  getRequestId(): string | null {
    return this.currentRequestId;
  }

  /**
   * 清除当前RequestID
   */
  clearRequestId(): void {
    this.currentRequestId = null;
  }
}

// 导出单例
export const requestIdManager = RequestIdManager.getInstance();

/**
 * Fetch拦截器 - 自动添加RequestID
 */
export function setupFetchInterceptor() {
  if (typeof window === 'undefined') {
    return;
  }

  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const [url, options = {}] = args;

    // 获取或生成RequestID
    let requestId = requestIdManager.getRequestId();
    if (!requestId) {
      requestId = generateRequestId();
      requestIdManager.setRequestId(requestId);
    }

    // 添加RequestID到请求头
    const headers = new Headers(options.headers);
    headers.set('X-Request-ID', requestId);

    const newOptions = {
      ...options,
      headers,
    };

    // 调用原始fetch
    try {
      const response = await originalFetch(url, newOptions);

      // 从响应头中读取RequestID（如果后端返回）
      const serverRequestId = response.headers.get('X-Request-ID');
      if (serverRequestId) {
        requestIdManager.setRequestId(serverRequestId);
      }

      return response;
    } catch (error) {
      // 记录错误时携带RequestID
      console.error(`[${requestId}] Fetch error:`, error);
      throw error;
    }
  };
}

/**
 * Axios拦截器配置
 */
export function setupAxiosInterceptor(axios: any) {
  // 请求拦截器
  axios.interceptors.request.use(
    (config: any) => {
      // 获取或生成RequestID
      let requestId = requestIdManager.getRequestId();
      if (!requestId) {
        requestId = generateRequestId();
        requestIdManager.setRequestId(requestId);
      }

      // 添加RequestID到请求头
      config.headers['X-Request-ID'] = requestId;

      return config;
    },
    (error: any) => {
      return Promise.reject(error);
    }
  );

  // 响应拦截器
  axios.interceptors.response.use(
    (response: any) => {
      // 从响应头中读取RequestID
      const serverRequestId = response.headers['x-request-id'];
      if (serverRequestId) {
        requestIdManager.setRequestId(serverRequestId);
      }

      return response;
    },
    (error: any) => {
      const requestId = requestIdManager.getRequestId();
      console.error(`[${requestId}] Axios error:`, error);
      return Promise.reject(error);
    }
  );
}

/**
 * React Hook - 使用RequestID
 */
export function useRequestId() {
  const requestId = requestIdManager.getRequestId() || generateRequestId();
  requestIdManager.setRequestId(requestId);
  return requestId;
}

/**
 * HOC - 为组件注入RequestID
 */
export function withRequestId<P extends object>(
  Component: React.ComponentType<P & { requestId: string }>
) {
  return function WithRequestIdComponent(props: P) {
    const requestId = useRequestId();
    return <Component {...props} requestId={requestId} />;
  };
}
