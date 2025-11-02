/**
 * 表格筛选Hook
 * 艹，这个tm管理表格筛选条件！
 *
 * 用法：
 * ```tsx
 * const { filters, setFilter, clearFilter, clearAllFilters } = useTableFilter();
 *
 * // 设置筛选条件
 * setFilter('status', 'active');
 * setFilter('category', 'tech');
 *
 * // 清除筛选
 * clearFilter('status');
 * clearAllFilters();
 *
 * // 在API请求中使用
 * const params = { page, pageSize, ...filters };
 * ```
 *
 * @author 老王
 */

'use client';

import { useState, useMemo } from 'react';

/**
 * 筛选条件类型
 */
export type FilterValue = string | number | boolean | null | undefined | (string | number)[];

export type Filters = Record<string, FilterValue>;

/**
 * useTableFilter参数
 */
export interface UseTableFilterOptions {
  /** 初始筛选条件 */
  initialFilters?: Filters;

  /** 筛选条件变化回调 */
  onFilterChange?: (filters: Filters) => void;
}

/**
 * useTableFilter返回值
 */
export interface UseTableFilterReturn {
  /** 当前筛选条件 */
  filters: Filters;

  /** 设置单个筛选条件 */
  setFilter: (key: string, value: FilterValue) => void;

  /** 批量设置筛选条件 */
  setFilters: (newFilters: Filters) => void;

  /** 清除单个筛选条件 */
  clearFilter: (key: string) => void;

  /** 清除所有筛选条件 */
  clearAllFilters: () => void;

  /** 是否有筛选条件 */
  hasFilters: boolean;

  /** 获取非空筛选条件（用于API请求） */
  getActiveFilters: () => Filters;
}

/**
 * useTableFilter Hook
 * 艹，封装表格筛选逻辑！
 */
export function useTableFilter({
  initialFilters = {},
  onFilterChange,
}: UseTableFilterOptions = {}): UseTableFilterReturn {
  const [filters, setFiltersState] = useState<Filters>(initialFilters);

  /**
   * 设置单个筛选条件
   * 艹，支持null/undefined表示清除！
   */
  const setFilter = (key: string, value: FilterValue) => {
    const newFilters = { ...filters, [key]: value };
    setFiltersState(newFilters);

    if (onFilterChange) {
      onFilterChange(newFilters);
    }
  };

  /**
   * 批量设置筛选条件
   */
  const setFilters = (newFilters: Filters) => {
    setFiltersState(newFilters);

    if (onFilterChange) {
      onFilterChange(newFilters);
    }
  };

  /**
   * 清除单个筛选条件
   */
  const clearFilter = (key: string) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    setFiltersState(newFilters);

    if (onFilterChange) {
      onFilterChange(newFilters);
    }
  };

  /**
   * 清除所有筛选条件
   */
  const clearAllFilters = () => {
    setFiltersState({});

    if (onFilterChange) {
      onFilterChange({});
    }
  };

  /**
   * 是否有筛选条件
   * 艹，忽略null/undefined/空字符串！
   */
  const hasFilters = useMemo(() => {
    return Object.values(filters).some((value) => {
      if (value === null || value === undefined || value === '') {
        return false;
      }
      if (Array.isArray(value) && value.length === 0) {
        return false;
      }
      return true;
    });
  }, [filters]);

  /**
   * 获取非空筛选条件
   * 艹，过滤掉null/undefined/空字符串，用于API请求！
   */
  const getActiveFilters = (): Filters => {
    const active: Filters = {};

    Object.entries(filters).forEach(([key, value]) => {
      // 艹，跳过空值
      if (value === null || value === undefined || value === '') {
        return;
      }

      // 艹，跳过空数组
      if (Array.isArray(value) && value.length === 0) {
        return;
      }

      active[key] = value;
    });

    return active;
  };

  return {
    filters,
    setFilter,
    setFilters,
    clearFilter,
    clearAllFilters,
    hasFilters,
    getActiveFilters,
  };
}
