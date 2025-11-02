/**
 * 表格数据Hook
 * 艹，这个tm是表格数据管理的核心！
 *
 * 功能：
 * 1. 整合分页、筛选
 * 2. 自动加载数据
 * 3. 轮询支持
 * 4. 请求取消
 * 5. 错误处理
 *
 * 用法：
 * ```tsx
 * const { data, loading, error, pagination, filters, refresh } = useTableData({
 *   fetcher: (params) => api.get('/users', { params }),
 *   initialPageSize: 20,
 * });
 *
 * <Table
 *   dataSource={data}
 *   loading={loading}
 *   pagination={{
 *     current: pagination.page,
 *     pageSize: pagination.pageSize,
 *     total: pagination.total,
 *     onChange: pagination.goToPage,
 *   }}
 * />
 * ```
 *
 * @author 老王
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePagination, type UsePaginationOptions, type UsePaginationReturn } from './usePagination';
import { useTableFilter, type UseTableFilterOptions, type UseTableFilterReturn } from './useTableFilter';

/**
 * 请求参数
 */
export interface TableDataFetchParams {
  page: number;
  pageSize: number;
  offset: number;
  filters: Record<string, any>;
  [key: string]: any;
}

/**
 * useTableData参数
 */
export interface UseTableDataOptions<T> extends UsePaginationOptions, UseTableFilterOptions {
  /** 数据获取函数 */
  fetcher: (params: TableDataFetchParams) => Promise<{ items: T[]; total: number }>;

  /** 是否自动加载（默认true） */
  autoLoad?: boolean;

  /** 轮询间隔（毫秒），不设置则不轮询 */
  pollingInterval?: number;

  /** 依赖项数组，变化时重新加载 */
  deps?: any[];

  /** 加载成功回调 */
  onSuccess?: (data: T[], total: number) => void;

  /** 加载失败回调 */
  onError?: (error: Error) => void;
}

/**
 * useTableData返回值
 */
export interface UseTableDataReturn<T> {
  /** 表格数据 */
  data: T[];

  /** 加载状态 */
  loading: boolean;

  /** 错误信息 */
  error: Error | null;

  /** 分页对象 */
  pagination: UsePaginationReturn;

  /** 筛选对象 */
  filters: UseTableFilterReturn;

  /** 刷新数据 */
  refresh: () => Promise<void>;

  /** 手动加载数据 */
  load: () => Promise<void>;

  /** 开始轮询 */
  startPolling: (interval?: number) => void;

  /** 停止轮询 */
  stopPolling: () => void;

  /** 取消当前请求 */
  cancel: () => void;
}

/**
 * useTableData Hook
 * 艹，表格数据管理的终极武器！
 */
export function useTableData<T = any>({
  fetcher,
  autoLoad = true,
  pollingInterval,
  deps = [],
  onSuccess,
  onError,
  ...options
}: UseTableDataOptions<T>): UseTableDataReturn<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 艹，取消标记
  const abortControllerRef = useRef<AbortController | null>(null);

  // 艹，轮询定时器
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 艹，分页hook
  const pagination = usePagination(options);

  // 艹，筛选hook
  const filtersHook = useTableFilter(options);

  /**
   * 加载数据
   * 艹，核心数据加载逻辑！
   */
  const load = useCallback(async () => {
    // 艹，取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 艹，创建新的取消控制器
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      // 艹，构建请求参数
      const params: TableDataFetchParams = {
        page: pagination.page,
        pageSize: pagination.pageSize,
        offset: pagination.getOffset(),
        filters: filtersHook.getActiveFilters(),
      };

      // 艹，调用fetcher获取数据
      const result = await fetcher(params);

      // 艹，检查是否被取消
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      // 艹，更新数据和总数
      setData(result.items);
      pagination.setTotal(result.total);

      // 艹，成功回调
      if (onSuccess) {
        onSuccess(result.items, result.total);
      }
    } catch (err) {
      // 艹，检查是否被取消
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      const error = err as Error;
      setError(error);

      // 艹，失败回调
      if (onError) {
        onError(error);
      }

      console.error('[useTableData] 艹，加载数据失败！', error);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  }, [
    pagination.page,
    pagination.pageSize,
    filtersHook.filters,
    fetcher,
    ...deps, // 艹，外部依赖
  ]);

  /**
   * 刷新数据（重置到第一页）
   */
  const refresh = useCallback(async () => {
    pagination.reset();
    await load();
  }, [load, pagination]);

  /**
   * 开始轮询
   */
  const startPolling = useCallback((interval = pollingInterval) => {
    if (!interval) {
      console.warn('[useTableData] 艹，未设置轮询间隔！');
      return;
    }

    // 艹，清除之前的定时器
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
    }

    // 艹，开始轮询
    pollingTimerRef.current = setInterval(() => {
      load();
    }, interval);

    console.log(`[useTableData] 艹，开始轮询，间隔${interval}ms`);
  }, [load, pollingInterval]);

  /**
   * 停止轮询
   */
  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
      console.log('[useTableData] 艹，停止轮询');
    }
  }, []);

  /**
   * 取消当前请求
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      console.log('[useTableData] 艹，取消请求');
    }
  }, []);

  // 艹，自动加载
  useEffect(() => {
    if (autoLoad) {
      load();
    }

    // 艹，组件卸载时清理
    return () => {
      cancel();
      stopPolling();
    };
  }, [
    pagination.page,
    pagination.pageSize,
    filtersHook.filters,
    ...deps,
  ]);

  // 艹，自动轮询
  useEffect(() => {
    if (pollingInterval && autoLoad) {
      startPolling(pollingInterval);
    }

    return () => {
      stopPolling();
    };
  }, [pollingInterval, autoLoad]);

  return {
    data,
    loading,
    error,
    pagination,
    filters: filtersHook,
    refresh,
    load,
    startPolling,
    stopPolling,
    cancel,
  };
}
