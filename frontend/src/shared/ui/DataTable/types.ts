/**
 * DataTable 和 FilterBar 类型定义
 * 艹，这个tm定义了所有通用表格和筛选栏的类型！
 */

import type { TableProps, TableColumnType } from 'antd';
import type { FilterValue } from '@/shared/hooks/useTableFilter';

/**
 * 筛选器类型枚举
 */
export enum FilterType {
  /** 文本输入框 */
  INPUT = 'input',
  /** 搜索输入框 */
  SEARCH = 'search',
  /** 单选下拉 */
  SELECT = 'select',
  /** 多选下拉 */
  MULTI_SELECT = 'multiSelect',
  /** 日期选择 */
  DATE = 'date',
  /** 日期范围 */
  DATE_RANGE = 'dateRange',
  /** 数字输入 */
  NUMBER = 'number',
  /** 数字范围 */
  NUMBER_RANGE = 'numberRange',
  /** 单选按钮组 */
  RADIO = 'radio',
  /** 复选框组 */
  CHECKBOX = 'checkbox',
}

/**
 * 筛选器选项
 */
export interface FilterOption {
  label: string;
  value: string | number | boolean;
}

/**
 * 筛选器配置
 */
export interface FilterConfig {
  /** 筛选器唯一key */
  key: string;
  /** 筛选器类型 */
  type: FilterType;
  /** 筛选器标签 */
  label: string;
  /** 占位符 */
  placeholder?: string;
  /** 默认值 */
  defaultValue?: FilterValue;
  /** 选项（用于select/radio/checkbox） */
  options?: FilterOption[];
  /** 是否允许清空 */
  allowClear?: boolean;
  /** 自定义宽度 */
  width?: number | string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否显示 */
  visible?: boolean;
}

/**
 * 筛选栏Props
 */
export interface FilterBarProps {
  /** 筛选器配置数组 */
  filters: FilterConfig[];
  /** 筛选值变化回调 */
  onFilterChange?: (key: string, value: FilterValue) => void;
  /** 批量筛选值变化回调 */
  onFiltersChange?: (filters: Record<string, FilterValue>) => void;
  /** 重置回调 */
  onReset?: () => void;
  /** 是否显示重置按钮 */
  showReset?: boolean;
  /** 是否显示搜索按钮 */
  showSearch?: boolean;
  /** 搜索回调 */
  onSearch?: () => void;
  /** 自定义样式 */
  className?: string;
  /** 布局方式 */
  layout?: 'inline' | 'vertical';
  /** 栅格间距 */
  gutter?: number | [number, number];
}

/**
 * 表格列配置（扩展Ant Design的ColumnType）
 */
export interface DataTableColumn<T = any> extends Omit<TableColumnType<T>, 'dataIndex'> {
  /** 列唯一key */
  key: string;
  /** 数据字段（支持嵌套，如 'user.name'） */
  dataIndex?: string | string[];
  /** 列标题 */
  title: string;
  /** 列宽度 */
  width?: number | string;
  /** 是否固定列 */
  fixed?: 'left' | 'right';
  /** 是否可排序 */
  sorter?: boolean | ((a: T, b: T) => number);
  /** 自定义渲染 */
  render?: (value: any, record: T, index: number) => React.ReactNode;
  /** 是否隐藏 */
  hidden?: boolean;
}

/**
 * 批量操作配置
 */
export interface BatchAction<T = any> {
  /** 操作唯一key */
  key: string;
  /** 操作标签 */
  label: string;
  /** 操作图标 */
  icon?: React.ReactNode;
  /** 操作回调 */
  onClick: (selectedRows: T[], selectedRowKeys: React.Key[]) => void;
  /** 是否危险操作（红色样式） */
  danger?: boolean;
  /** 是否禁用 */
  disabled?: boolean | ((selectedRows: T[]) => boolean);
}

/**
 * DataTable Props
 */
export interface DataTableProps<T = any> extends Omit<TableProps<T>, 'columns' | 'dataSource'> {
  /** 表格列配置 */
  columns: DataTableColumn<T>[];
  /** 表格数据 */
  dataSource?: T[];
  /** 是否加载中 */
  loading?: boolean;
  /** 分页配置（传入usePagination返回值） */
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onChange: (page: number, pageSize: number) => void;
  };
  /** 是否可选择行 */
  rowSelection?: boolean;
  /** 选中行变化回调 */
  onRowSelectionChange?: (selectedRowKeys: React.Key[], selectedRows: T[]) => void;
  /** 批量操作配置 */
  batchActions?: BatchAction<T>[];
  /** 是否显示边框 */
  bordered?: boolean;
  /** 表格大小 */
  size?: 'small' | 'middle' | 'large';
  /** 是否显示表头 */
  showHeader?: boolean;
  /** 空数据时的文案 */
  emptyText?: string;
  /** 自定义空状态 */
  emptyRender?: React.ReactNode;
  /** 表格标题 */
  title?: string | React.ReactNode;
  /** 表格工具栏（右侧） */
  toolbar?: React.ReactNode;
}
