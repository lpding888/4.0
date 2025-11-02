/**
 * DataTable通用表格组件
 * 艹！简单封装Ant Design Table，提供统一的表格样式！
 */

'use client';

import { Table, TableProps } from 'antd';

export interface DataTableProps<T = any> extends TableProps<T> {
  // 继承所有Ant Design Table的props
}

/**
 * DataTable组件
 * 艹！直接使用Ant Design Table！
 */
export function DataTable<T extends object = any>(props: DataTableProps<T>) {
  return (
    <Table
      {...props}
      pagination={{
        showSizeChanger: true,
        showTotal: (total) => `共 ${total} 条`,
        ...props.pagination,
      }}
    />
  );
}
