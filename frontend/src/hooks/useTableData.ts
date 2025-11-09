/**
 * useTableData Hook
 * 艹！提供统一的表格数据管理逻辑！
 */

'use client';

import { useState, useCallback, useEffect } from 'react';

export interface UseTableDataOptions<T = any> {
  fetchData?: (params: any) => Promise<{ data: T[]; total: number }>;
  fetcher?: (params: any) => Promise<{ data: T[]; total: number }>;
  initialPageSize?: number;
  autoLoad?: boolean;
  dependencies?: any[];
}

export interface UseTableDataResult<T = any> {
  data: T[];
  loading: boolean;
  total: number;
  currentPage: number;
  pageSize: number;
  refresh: () => void;
  onPageChange: (page: number, pageSize?: number) => void;
  filters: any;
  setFilters: (filters: any) => void;
}

/**
 * useTableData Hook
 * 艹！管理表格的分页、筛选、刷新等状态！
 */
export function useTableData<T = any>({
  fetchData,
  fetcher,
  initialPageSize = 10,
  autoLoad = true,
  dependencies = [],
}: UseTableDataOptions<T>): UseTableDataResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [filters, setFilters] = useState<any>({});

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const executor = fetchData || fetcher;
      if (!executor) {
        throw new Error('useTableData需要提供fetchData或fetcher');
      }

      const result = await executor({
        page: currentPage,
        pageSize,
        ...filters,
      });
      setData(result.data);
      setTotal(result.total);
    } catch (error) {
      console.error('加载数据失败:', error);
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [fetchData, currentPage, pageSize, filters]);

  const refresh = useCallback(() => {
    loadData();
  }, [loadData]);

  const onPageChange = useCallback((page: number, newPageSize?: number) => {
    setCurrentPage(page);
    if (newPageSize && newPageSize !== pageSize) {
      setPageSize(newPageSize);
    }
  }, [pageSize]);

  useEffect(() => {
    if (autoLoad) {
      loadData();
    }
  }, [autoLoad, loadData, ...dependencies]);

  return {
    data,
    loading,
    total,
    currentPage,
    pageSize,
    refresh,
    onPageChange,
    filters,
    setFilters,
  };
}
