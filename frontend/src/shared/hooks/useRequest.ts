/**
 * 通用请求Hook
 * 艹，这个tm是通用API请求管理！
 *
 * 功能：
 * 1. 自动/手动请求
 * 2. 加载状态管理
 * 3. 错误处理
 * 4. 重试机制
 * 5. 请求取消
 * 6. 依赖刷新
 *
 * 用法：
 * ```tsx
 * // 自动请求
 * const { data, loading, error, run } = useRequest(
 *   () => api.get('/user/123')
 * );
 *
 * // 手动请求
 * const { data, loading, run } = useRequest(
 *   (id) => api.get(`/user/${id}`),
 *   { manual: true }
 * );
 *
 * // 重试
 * const { data, retry } = useRequest(
 *   () => api.get('/unstable'),
 *   { retryCount: 3 }
 * );
 * ```
 *
 * @author 老王
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useRequest参数
 */
export interface UseRequestOptions<T, P extends any[]> {
  /** 是否手动触发（默认false，自动执行） */
  manual?: boolean;

  /** 初始数据 */
  initialData?: T;

  /** 默认参数（自动请求时使用） */
  defaultParams?: P;

  /** 重试次数（默认0） */
  retryCount?: number;

  /** 重试延迟（毫秒，默认1000） */
  retryDelay?: number;

  /** 依赖项数组，变化时重新请求 */
  deps?: any[];

  /** 成功回调 */
  onSuccess?: (data: T, params: P) => void;

  /** 失败回调 */
  onError?: (error: Error, params: P) => void;

  /** 请求前回调 */
  onBefore?: (params: P) => void;

  /** 防抖延迟（毫秒） */
  debounceWait?: number;

  /** 节流延迟（毫秒） */
  throttleWait?: number;
}

/**
 * useRequest返回值
 */
export interface UseRequestReturn<T, P extends any[]> {
  /** 响应数据 */
  data: T | undefined;

  /** 加载状态 */
  loading: boolean;

  /** 错误信息 */
  error: Error | null;

  /** 手动执行请求（无返回值） */
  run: (...params: P) => void;

  /** 手动执行请求（返回Promise） */
  runAsync: (...params: P) => Promise<T>;

  /** 刷新（使用上次参数重新请求） */
  refresh: () => void;

  /** 重试（使用上次参数） */
  retry: () => void;

  /** 取消当前请求 */
  cancel: () => void;

  /** 重置状态 */
  reset: () => void;
}

/**
 * useRequest Hook
 * 艹，通用请求管理hook！
 */
export function useRequest<T = any, P extends any[] = any[]>(
  fetcher: (...params: P) => Promise<T>,
  options: UseRequestOptions<T, P> = {}
): UseRequestReturn<T, P> {
  const {
    manual = false,
    initialData,
    defaultParams = [] as unknown as P,
    retryCount = 0,
    retryDelay = 1000,
    deps = [],
    onSuccess,
    onError,
    onBefore,
  } = options;

  const [data, setData] = useState<T | undefined>(initialData);
  const [loading, setLoading] = useState(!manual);
  const [error, setError] = useState<Error | null>(null);

  // 艹，上次请求参数
  const lastParamsRef = useRef<P>(defaultParams);

  // 艹，取消控制器
  const abortControllerRef = useRef<AbortController | null>(null);

  // 艹，重试计数
  const retryCountRef = useRef(0);

  /**
   * 核心请求函数
   * 艹，这个tm是核心！
   */
  const request = useCallback(
    async (...params: P): Promise<T> => {
      // 艹，取消之前的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // 艹，创建新的取消控制器
      abortControllerRef.current = new AbortController();

      // 艹，保存参数
      lastParamsRef.current = params;

      // 艹，请求前回调
      if (onBefore) {
        onBefore(params);
      }

      setLoading(true);
      setError(null);

      try {
        // 艹，调用fetcher
        const result = await fetcher(...params);

        // 艹，检查是否被取消
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Request cancelled');
        }

        // 艹，更新数据
        setData(result);

        // 艹，重置重试计数
        retryCountRef.current = 0;

        // 艹，成功回调
        if (onSuccess) {
          onSuccess(result, params);
        }

        return result;
      } catch (err) {
        // 艹，检查是否被取消
        if (abortControllerRef.current?.signal.aborted) {
          throw err;
        }

        const error = err as Error;
        setError(error);

        // 艹，检查是否需要重试
        if (retryCountRef.current < retryCount) {
          retryCountRef.current++;
          console.log(
            `[useRequest] 艹，第${retryCountRef.current}次重试，共${retryCount}次`
          );

          // 艹，延迟后重试
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          return request(...params);
        }

        // 艹，失败回调
        if (onError) {
          onError(error, params);
        }

        throw error;
      } finally {
        setLoading(false);
        abortControllerRef.current = null;
      }
    },
    [fetcher, retryCount, retryDelay, onSuccess, onError, onBefore]
  );

  /**
   * 手动执行请求（无返回值）
   */
  const run = useCallback(
    (...params: P) => {
      request(...params).catch((err) => {
        console.error('[useRequest] 艹，请求失败！', err);
      });
    },
    [request]
  );

  /**
   * 手动执行请求（返回Promise）
   */
  const runAsync = useCallback(
    (...params: P): Promise<T> => {
      return request(...params);
    },
    [request]
  );

  /**
   * 刷新（使用上次参数）
   */
  const refresh = useCallback(() => {
    run(...lastParamsRef.current);
  }, [run]);

  /**
   * 重试（使用上次参数）
   */
  const retry = useCallback(() => {
    retryCountRef.current = 0; // 艹，重置重试计数
    run(...lastParamsRef.current);
  }, [run]);

  /**
   * 取消请求
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
      console.log('[useRequest] 艹，取消请求');
    }
  }, []);

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    setData(initialData);
    setError(null);
    setLoading(false);
    retryCountRef.current = 0;
  }, [initialData]);

  // 艹，自动请求
  useEffect(() => {
    if (!manual) {
      run(...defaultParams);
    }

    // 艹，组件卸载时取消请求
    return () => {
      cancel();
    };
  }, deps);

  return {
    data,
    loading,
    error,
    run,
    runAsync,
    refresh,
    retry,
    cancel,
    reset,
  };
}
