/**
 * REL-P2-CACHE-212: 缓存相关React Hooks
 * 艹！在React组件中优雅地使用缓存！
 *
 * @author 老王
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchWithSWR,
  fetchConfigWithCache,
  globalCacheManager,
  CacheConfig,
} from '@/lib/cache';

/**
 * Hook状态
 */
export interface UseCacheState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook返回值
 */
export interface UseCacheResult<T> extends UseCacheState<T> {
  refetch: () => Promise<void>;
  invalidate: () => void;
  isValid: () => boolean;
}

/**
 * 使用缓存数据的Hook
 * 支持SWR策略
 */
export function useCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  config: Partial<CacheConfig> & {
    enabled?: boolean;
    refetchOnMount?: boolean;
    refetchInterval?: number;
  } = {}
): UseCacheResult<T> {
  const [state, setState] = useState<UseCacheState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const enabled = config.enabled !== false;

  // 获取数据
  const fetch = useCallback(async () => {
    if (!enabled) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const data = await fetchWithSWR(key, fetcherRef.current, {
        key,
        ttl: config.ttl || 5 * 60 * 1000,
        swr: config.swr !== false,
        version: config.version,
      });

      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error: error as Error });
    }
  }, [key, enabled, config.ttl, config.swr, config.version]);

  // 初始加载
  useEffect(() => {
    if (config.refetchOnMount !== false) {
      fetch();
    }
  }, [fetch, config.refetchOnMount]);

  // 定期刷新
  useEffect(() => {
    if (!config.refetchInterval || !enabled) return;

    const intervalId = setInterval(fetch, config.refetchInterval);
    return () => clearInterval(intervalId);
  }, [fetch, config.refetchInterval, enabled]);

  // 使缓存失效
  const invalidate = useCallback(() => {
    globalCacheManager.remove(key);
    fetch();
  }, [key, fetch]);

  // 检查缓存是否有效
  const isValid = useCallback(() => {
    return globalCacheManager.isValid(key);
  }, [key]);

  return {
    ...state,
    refetch: fetch,
    invalidate,
    isValid,
  };
}

/**
 * 使用配置数据的Hook
 * 专门用于配置类数据，支持版本号检查和自动刷新
 */
export function useConfig<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    ttl?: number;
    version?: string;
    enabled?: boolean;
    onVersionMismatch?: () => void;
  } = {}
): UseCacheResult<T> {
  const [state, setState] = useState<UseCacheState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const enabled = options.enabled !== false;

  const fetch = useCallback(async () => {
    if (!enabled) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const data = await fetchConfigWithCache(key, fetcherRef.current, {
        ttl: options.ttl,
        version: options.version,
        onVersionMismatch: options.onVersionMismatch,
      });

      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error: error as Error });
    }
  }, [key, enabled, options.ttl, options.version, options.onVersionMismatch]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const invalidate = useCallback(() => {
    globalCacheManager.remove(key);
    fetch();
  }, [key, fetch]);

  const isValid = useCallback(() => {
    return globalCacheManager.isValid(key);
  }, [key]);

  return {
    ...state,
    refetch: fetch,
    invalidate,
    isValid,
  };
}

/**
 * 使用多个缓存数据的Hook
 */
export function useCaches<T extends Record<string, any>>(
  configs: Record<keyof T, { key: string; fetcher: () => Promise<any>; config?: Partial<CacheConfig> }>
): {
  data: Partial<T>;
  loading: boolean;
  error: Error | null;
  refetchAll: () => Promise<void>;
  refetch: (name: keyof T) => Promise<void>;
} {
  const [state, setState] = useState<{
    data: Partial<T>;
    loading: boolean;
    error: Error | null;
  }>({
    data: {},
    loading: true,
    error: null,
  });

  const configsRef = useRef(configs);
  configsRef.current = configs;

  const fetchAll = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const results: Partial<T> = {};

      await Promise.all(
        Object.entries(configsRef.current).map(async ([name, { key, fetcher, config }]) => {
          try {
            const data = await fetchWithSWR(key, fetcher as () => Promise<any>, config);
            results[name as keyof T] = data;
          } catch (error) {
            console.error(`[useCaches] Failed to fetch ${name}:`, error);
          }
        })
      );

      setState({ data: results, loading: false, error: null });
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false, error: error as Error }));
    }
  }, []);

  const refetch = useCallback(async (name: keyof T) => {
    const { key, fetcher, config } = configsRef.current[name];

    try {
      const data = await fetchWithSWR(key, fetcher as () => Promise<any>, config);
      setState((prev) => ({
        ...prev,
        data: { ...prev.data, [name]: data },
      }));
    } catch (error) {
      console.error(`[useCaches] Failed to refetch ${String(name)}:`, error);
      throw error;
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    ...state,
    refetchAll: fetchAll,
    refetch,
  };
}

/**
 * 导出所有Hooks
 */
export default {
  useCache,
  useConfig,
  useCaches,
};
