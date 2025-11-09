/**
 * COMP-P0-002 DataTablePro 高级数据表格组件
 * 艹，必须做好这个表格组件，多个管理页面都要用！
 *
 * 功能清单：
 * 1. 服务端分页/排序/筛选
 * 2. 列选择/显示/隐藏
 * 3. 数据导出功能
 * 4. 搜索和高级筛选
 * 5. 批量操作支持
 * 6. 自定义列渲染
 * 7. 响应式设计
 *
 * @author 老王
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  Button,
  Space,
  Input,
  Select,
  Checkbox,
  Dropdown,
  Modal,
  Form,
  Row,
  Col,
  Tag,
  Typography,
  Tooltip,
  message,
  Popconfirm
} from 'antd';
import type { MenuProps } from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  ExportOutlined,
  SettingOutlined,
  DownOutlined,
  FilterOutlined,
  ColumnWidthOutlined
} from '@ant-design/icons';
import type {
  ColumnsType,
  TableProps,
  ColumnType
} from 'antd/es/table';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';

const { Text } = Typography;
type CheckboxValue = string | number | boolean;

// 表格列配置
export interface DataTableColumn<T = any> extends Omit<ColumnType<T>, 'title'> {
  key: string;
  title: React.ReactNode;
  dataIndex?: string;
  render?: (value: any, record: T, index: number) => React.ReactNode;
  sorter?: boolean;
  filterable?: boolean;
  filters?: { text: string; value: string }[];
  width?: number | string;
  fixed?: 'left' | 'right';
  hidden?: boolean;
}

// 分页配置
export interface DataTablePagination {
  current: number;
  pageSize: number;
  total: number;
  showSizeChanger?: boolean;
  showQuickJumper?: boolean;
  showTotal?: boolean;
  onChange?: (page: number, pageSize: number) => void;
}

// 搜索配置
export interface DataTableSearch {
  placeholder?: string;
  fields?: string[];
  allowClear?: boolean;
}

// 操作配置
export interface DataTableActions {
  search?: DataTableSearch;
  refresh?: boolean;
  export?: boolean;
  columnSetting?: boolean;
  customActions?: React.ReactNode[];
}

// 表格属性
export interface DataTableProProps<T = any> extends Omit<TableProps<T>, 'columns' | 'pagination'> {
  // 列配置
  columns: DataTableColumn<T>[];

  // 数据相关
  dataSource: T[];
  loading?: boolean;

  // 分页
  pagination?: DataTablePagination | false;

  // 搜索和筛选
  search?: DataTableSearch;
  filters?: Record<string, string[]>;

  // 操作按钮
  actions?: DataTableActions;

  // 回调函数
  onChange?: TableProps<T>['onChange'];
  onSearch?: (value: string, fields?: string[]) => void;
  onRefresh?: () => void;
  onExport?: () => void;

  // 选择功能
  rowSelection?: any;

  // 自定义样式
  className?: string;
  size?: 'small' | 'middle' | 'large';
}

export function DataTablePro<T extends Record<string, any>>({
  columns,
  dataSource,
  loading = false,
  pagination = { current: 1, pageSize: 20, total: 0 },
  search,
  filters = {},
  actions,
  onChange,
  onSearch,
  onRefresh,
  onExport,
  rowSelection,
  className,
  size = 'middle',
  ...tableProps
}: DataTableProProps<T>) {
  const [searchValue, setSearchValue] = useState('');
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [columnModalVisible, setColumnModalVisible] = useState(false);
  const [form] = Form.useForm();

  // 初始化可见列
  useEffect(() => {
    const visibleCols = columns
      .filter(col => !col.hidden)
      .map(col => col.key);
    setVisibleColumns(visibleCols);
  }, [columns]);

  // 处理列显示/隐藏
  const handleColumnChange = (checkedValues: CheckboxValue[]) => {
    setVisibleColumns(checkedValues as string[]);
  };

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchValue(value);
    onSearch?.(value, search?.fields);
  };

  // 处理刷新
  const handleRefresh = () => {
    onRefresh?.();
  };

  // 处理导出
  const handleExport = () => {
    if (onExport) {
      onExport();
    } else {
      // 默认导出逻辑
      const csvContent = generateCSV(dataSource, visibleColumns);
      downloadCSV(csvContent, 'export.csv');
      message.success('导出成功');
    }
  };

  // 生成CSV内容
  const generateCSV = (data: T[], visibleCols: string[]) => {
    if (!data.length) return '';

    const visibleColumnsData = columns.filter(col => visibleCols.includes(col.key));
    const headers = visibleColumnsData.map(col => col.title).join(',');
    const rows = data.map(record =>
      visibleColumnsData.map(col => {
        const value = col.dataIndex ? record[col.dataIndex] : '';
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',')
    );

    return [headers, ...rows].join('\n');
  };

  // 下载CSV文件
  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 过滤后的列
  const filteredColumns = useMemo(() => {
    return columns
      .filter(col => visibleColumns.includes(col.key))
      .map(col => {
        const column: ColumnType<T> = {
          ...col,
          title: col.title,
          dataIndex: col.dataIndex,
          key: col.key,
          width: col.width,
          fixed: col.fixed,
          sorter: col.sorter,
          filters: col.filterable ? col.filters : undefined,
          render: col.render
        };
        return column;
      });
  }, [columns, visibleColumns]);

  const activeFilterCount = useMemo(
    () => Object.keys(filters).filter((key) => (filters[key]?.length ?? 0) > 0).length,
    [filters]
  );
  const tablePagination = useMemo(() => {
    if (pagination === false) {
      return false;
    }
    const showTotal =
      typeof pagination.showTotal === 'function'
        ? pagination.showTotal
        : pagination.showTotal
          ? (total: number, range: [number, number]) => `共 ${total} 条`
          : undefined;
    return {
      ...pagination,
      showTotal
    };
  }, [pagination]);

  const columnMenuItems: MenuProps['items'] = [
    {
      key: 'setting',
      label: (
        <span>
          <SettingOutlined /> 列设置
        </span>
      )
    },
    { type: 'divider' },
    {
      key: 'reset',
      label: (
        <span>
          <ReloadOutlined /> 重置显示
        </span>
      )
    }
  ];

  const handleColumnMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'setting') {
      setColumnModalVisible(true);
      return;
    }
    if (key === 'reset') {
      const allCols = columns.map(col => col.key);
      setVisibleColumns(allCols);
      message.success('已重置列显示');
    }
  };

  // 操作栏
  const actionBar = (
    <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
      <Col flex="auto">
        <Space size="middle">
          {search && (
            <Input.Search
              placeholder={search.placeholder || '搜索...'}
              allowClear={search.allowClear !== false}
              style={{ width: 300 }}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onSearch={handleSearch}
            />
          )}
          {Object.keys(filters).length > 0 && (
            <Button icon={<FilterOutlined />}>
              筛选{' '}
              {activeFilterCount > 0 && (
                <Tag color="blue" style={{ marginLeft: 4 }}>
                  {activeFilterCount}
                </Tag>
              )}
            </Button>
          )}
        </Space>
      </Col>
      <Col flex="none">
        <Space size="middle">
          {actions?.customActions}
          {actions?.refresh !== false && (
            <Tooltip title="刷新">
              <Button
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={loading}
              />
            </Tooltip>
          )}
          {actions?.export !== false && (
            <Tooltip title="导出">
              <Button
                icon={<ExportOutlined />}
                onClick={handleExport}
                disabled={!dataSource.length}
              />
            </Tooltip>
          )}
          {actions?.columnSetting !== false && (
            <Dropdown
              menu={{ items: columnMenuItems, onClick: handleColumnMenuClick }}
              trigger={['click']}
            >
              <Button icon={<ColumnWidthOutlined />}>
                列 <DownOutlined />
              </Button>
            </Dropdown>
          )}
        </Space>
      </Col>
    </Row>
  );

  return (
    <div className={`data-table-pro ${className || ''}`}>
      {actionBar}

      <Table<T>
        {...tableProps}
        columns={filteredColumns}
        dataSource={dataSource}
        loading={loading}
        pagination={tablePagination}
        rowSelection={rowSelection}
        onChange={onChange}
        size={size}
        scroll={{ x: 'max-content', ...tableProps.scroll }}
      />

      {/* 列设置模态框 */}
      <Modal
        title="列设置"
        open={columnModalVisible}
        onCancel={() => setColumnModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setColumnModalVisible(false)}>
            取消
          </Button>,
          <Button key="reset" onClick={() => {
            const allCols = columns.map(col => col.key);
            setVisibleColumns(allCols);
          }}>
            重置
          </Button>,
          <Button key="confirm" type="primary" onClick={() => setColumnModalVisible(false)}>
            确定
          </Button>
        ]}
        width={500}
      >
        <Checkbox.Group
          style={{ width: '100%' }}
          value={visibleColumns}
          onChange={handleColumnChange}
        >
          <Row gutter={[16, 8]}>
            {columns.map(col => (
              <Col span={12} key={col.key}>
                <Checkbox value={col.key}>
                  {col.title as string}
                </Checkbox>
              </Col>
            ))}
          </Row>
        </Checkbox.Group>
      </Modal>
    </div>
  );
}

// 修复 Menu 导入问题
const Menu = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => {
  return (
    <div className="ant-dropdown-menu" onClick={onClick}>
      {children}
    </div>
  );
};

Menu.Item = ({ children, onClick, icon }: {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ReactNode;
}) => {
  return (
    <div className="ant-dropdown-menu-item" onClick={onClick}>
      {icon && <span style={{ marginRight: 8 }}>{icon}</span>}
      {children}
    </div>
  );
};

Menu.Divider = () => <div className="ant-dropdown-menu-divider" />;
