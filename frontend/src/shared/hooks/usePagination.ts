/**
 * 分页Hook
 * 艹，这个tm管理分页状态！
 *
 * 用法：
 * ```tsx
 * const { page, pageSize, total, goToPage, nextPage, prevPage, setTotal } = usePagination();
 *
 * // 请求数据
 * useEffect(() => {
 *   fetchData(page, pageSize).then((res) => setTotal(res.total));
 * }, [page, pageSize]);
 *
 * // 在Table中使用
 * <Table
 *   pagination={{
 *     current: page,
 *     pageSize,
 *     total,
 *     onChange: goToPage,
 *   }}
 * />
 * ```
 *
 * @author 老王
 */

'use client';

import { useState, useMemo } from 'react';

/**
 * usePagination参数
 */
export interface UsePaginationOptions {
  /** 初始页码（默认1） */
  initialPage?: number;

  /** 初始每页条数（默认10） */
  initialPageSize?: number;

  /** 初始总数（默认0） */
  initialTotal?: number;
}

/**
 * usePagination返回值
 */
export interface UsePaginationReturn {
  /** 当前页码 */
  page: number;

  /** 每页条数 */
  pageSize: number;

  /** 总数 */
  total: number;

  /** 总页数 */
  totalPages: number;

  /** 是否有下一页 */
  hasNext: boolean;

  /** 是否有上一页 */
  hasPrev: boolean;

  /** 设置页码 */
  setPage: (page: number) => void;

  /** 设置每页条数 */
  setPageSize: (pageSize: number) => void;

  /** 设置总数 */
  setTotal: (total: number) => void;

  /** 跳转到指定页（支持Ant Design Table的onChange） */
  goToPage: (page: number, newPageSize?: number) => void;

  /** 下一页 */
  nextPage: () => void;

  /** 上一页 */
  prevPage: () => void;

  /** 重置到第一页 */
  reset: () => void;

  /** 获取当前分页的offset（用于数据库查询） */
  getOffset: () => number;
}

/**
 * usePagination Hook
 * 艹，封装分页逻辑！
 */
export function usePagination({
  initialPage = 1,
  initialPageSize = 10,
  initialTotal = 0,
}: UsePaginationOptions = {}): UsePaginationReturn {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [total, setTotal] = useState(initialTotal);

  // 艹，计算总页数
  const totalPages = useMemo(() => {
    return Math.ceil(total / pageSize);
  }, [total, pageSize]);

  // 艹，是否有下一页
  const hasNext = useMemo(() => {
    return page < totalPages;
  }, [page, totalPages]);

  // 艹，是否有上一页
  const hasPrev = useMemo(() => {
    return page > 1;
  }, [page]);

  /**
   * 跳转到指定页
   * 艹，兼容Ant Design Table的onChange(page, pageSize)！
   */
  const goToPage = (newPage: number, newPageSize?: number) => {
    // 艹，如果传了新的pageSize，更新它
    if (newPageSize && newPageSize !== pageSize) {
      setPageSize(newPageSize);
      setPage(1); // 艹，改变pageSize时重置到第一页
      return;
    }

    // 艹，限制page范围
    const validPage = Math.max(1, Math.min(newPage, totalPages || 1));
    setPage(validPage);
  };

  /**
   * 下一页
   */
  const nextPage = () => {
    if (hasNext) {
      setPage(page + 1);
    }
  };

  /**
   * 上一页
   */
  const prevPage = () => {
    if (hasPrev) {
      setPage(page - 1);
    }
  };

  /**
   * 重置到第一页
   */
  const reset = () => {
    setPage(initialPage);
  };

  /**
   * 获取offset（用于数据库查询）
   * 艹，方便后端分页查询！
   */
  const getOffset = () => {
    return (page - 1) * pageSize;
  };

  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNext,
    hasPrev,
    setPage,
    setPageSize,
    setTotal,
    goToPage,
    nextPage,
    prevPage,
    reset,
    getOffset,
  };
}
