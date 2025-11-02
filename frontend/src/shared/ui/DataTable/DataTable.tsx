/**
 * DataTable 通用表格组件
 * 艹，这个组件集成了分页、选择、批量操作，开箱即用！
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Table, Space, Button, Card, Alert, Empty } from 'antd';
import type { TableProps as AntTableProps } from 'antd';
import type { DataTableProps, DataTableColumn, BatchAction } from './types';

/**
 * DataTable 组件
 */
export function DataTable<T extends Record<string, any> = any>({
  columns,
  dataSource = [],
  loading = false,
  pagination,
  rowSelection: enableRowSelection = false,
  onRowSelectionChange,
  batchActions = [],
  bordered = true,
  size = 'middle',
  showHeader = true,
  emptyText = '暂无数据',
  emptyRender,
  title,
  toolbar,
  rowKey = 'id',
  ...restProps
}: DataTableProps<T>) {
  // 选中的行
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedRows, setSelectedRows] = useState<T[]>([]);

  /**
   * 过滤掉隐藏的列
   */
  const visibleColumns = useMemo(() => {
    return columns
      .filter((col) => !col.hidden)
      .map((col) => ({
        ...col,
        dataIndex: col.dataIndex || col.key,
      })) as any[];
  }, [columns]);

  /**
   * 处理行选择变化
   */
  const handleRowSelectionChange = (keys: React.Key[], rows: T[]) => {
    setSelectedRowKeys(keys);
    setSelectedRows(rows);
    onRowSelectionChange?.(keys, rows);
  };

  /**
   * 清空选择
   */
  const clearSelection = () => {
    setSelectedRowKeys([]);
    setSelectedRows([]);
    onRowSelectionChange?.([], []);
  };

  /**
   * 行选择配置
   */
  const rowSelectionConfig = enableRowSelection
    ? {
        selectedRowKeys,
        onChange: handleRowSelectionChange,
        preserveSelectedRowKeys: true,
      }
    : undefined;

  /**
   * 分页配置
   */
  const paginationConfig = pagination
    ? {
        current: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (total: number) => `共 ${total} 条`,
        onChange: (page: number, pageSize: number) => {
          pagination.onChange(page, pageSize);
          clearSelection(); // 艹，换页时清空选择
        },
      }
    : false;

  /**
   * 渲染批量操作栏
   */
  const renderBatchActions = () => {
    if (!enableRowSelection || batchActions.length === 0) {
      return null;
    }

    if (selectedRowKeys.length === 0) {
      return null;
    }

    return (
      <Alert
        message={
          <Space>
            <span>
              已选择 <strong>{selectedRowKeys.length}</strong> 项
            </span>
            <Button type="link" size="small" onClick={clearSelection}>
              清空
            </Button>
            {batchActions.map((action) => {
              const isDisabled =
                action.disabled === true ||
                (typeof action.disabled === 'function' &&
                  action.disabled(selectedRows));

              return (
                <Button
                  key={action.key}
                  type={action.danger ? 'primary' : 'default'}
                  danger={action.danger}
                  size="small"
                  icon={action.icon}
                  disabled={isDisabled}
                  onClick={() => {
                    action.onClick(selectedRows, selectedRowKeys);
                  }}
                >
                  {action.label}
                </Button>
              );
            })}
          </Space>
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
    );
  };

  /**
   * 渲染表格标题栏
   */
  const renderTitle = () => {
    if (!title && !toolbar) {
      return undefined;
    }

    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
        <div>{toolbar}</div>
      </div>
    );
  };

  /**
   * 自定义空状态
   */
  const locale = {
    emptyText: emptyRender || (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={emptyText}
      />
    ),
  };

  return (
    <div>
      {/* 批量操作栏 */}
      {renderBatchActions()}

      {/* 表格 */}
      <Table<T>
        columns={visibleColumns}
        dataSource={dataSource}
        loading={loading}
        rowKey={rowKey}
        rowSelection={rowSelectionConfig}
        pagination={paginationConfig}
        bordered={bordered}
        size={size}
        showHeader={showHeader}
        locale={locale}
        title={renderTitle()}
        scroll={{ x: 'max-content' }}
        {...restProps}
      />
    </div>
  );
}

export default DataTable;
