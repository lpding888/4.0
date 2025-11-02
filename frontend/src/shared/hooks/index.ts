/**
 * Hooks入口文件
 * 艹，统一导出所有自定义hooks！
 *
 * @author 老王
 */

// 艹，分页hook
export { usePagination } from './usePagination';
export type { UsePaginationOptions, UsePaginationReturn } from './usePagination';

// 艹，表格筛选hook
export { useTableFilter } from './useTableFilter';
export type {
  UseTableFilterOptions,
  UseTableFilterReturn,
  FilterValue,
  Filters,
} from './useTableFilter';

// 艹，表格数据hook
export { useTableData } from './useTableData';
export type {
  UseTableDataOptions,
  UseTableDataReturn,
  TableDataFetchParams,
} from './useTableData';

// 艹，通用请求hook
export { useRequest } from './useRequest';
export type { UseRequestOptions, UseRequestReturn } from './useRequest';
