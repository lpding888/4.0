# TASK-FE-004：通用数据表格与分页系统

## 📋 任务元信息

| 属性 | 值 |
|------|-----|
| **任务ID** | TASK-FE-004 |
| **任务类型** | Frontend Refactoring |
| **优先级** | P1 - 重要 |
| **预计工时** | 3-4天 |
| **依赖任务** | TASK-FE-001（架构搭建） |
| **负责Skill** | frontend-dev |
| **关联文档** | `docs/GPT5问题-前端架构设计.md` - 问题4 |

---

## 🎯 任务目标

消除管理后台大量表格页面的代码重复（重复率>80%），实现通用的表格数据加载、分页、筛选、刷新系统：

### 当前问题
```tsx
// 每个表格页面都重复这些代码（SB代码！）
const [data, setData] = useState([]);
const [loading, setLoading] = useState(false);
const [page, setPage] = useState(1);
const [pageSize, setPageSize] = useState(10);
const [total, setTotal] = useState(0);

useEffect(() => {
  const fetchData = async () => {
    setLoading(true);
    const res = await api.getUsers({ page, pageSize });
    setData(res.items);
    setTotal(res.total);
    setLoading(false);
  };
  fetchData();
}, [page, pageSize]);
```

### 改造后
```tsx
// 一行代码搞定所有表格逻辑
const { data, isLoading, pagination } = useTableData('/api/users');
```

---

## 📦 核心交付物

### 1. usePagination Hook

**`shared/hooks/usePagination.ts`**
```typescript
import { useState, useCallback } from 'react';

export interface PaginationState {
  current: number;
  pageSize: number;
  total: number;
}

export interface PaginationActions {
  setCurrent: (page: number) => void;
  setPageSize: (size: number) => void;
  setTotal: (total: number) => void;
  reset: () => void;
}

export const usePagination = (initialPageSize = 10) => {
  const [state, setState] = useState<PaginationState>({
    current: 1,
    pageSize: initialPageSize,
    total: 0,
  });

  const setCurrent = useCallback((current: number) => {
    setState((prev) => ({ ...prev, current }));
  }, []);

  const setPageSize = useCallback((pageSize: number) => {
    setState((prev) => ({ ...prev, pageSize, current: 1 })); // 修改每页数量时重置到第1页
  }, []);

  const setTotal = useCallback((total: number) => {
    setState((prev) => ({ ...prev, total }));
  }, []);

  const reset = useCallback(() => {
    setState({ current: 1, pageSize: initialPageSize, total: 0 });
  }, [initialPageSize]);

  // 转换为Ant Design Table的pagination格式
  const antdPagination = {
    current: state.current,
    pageSize: state.pageSize,
    total: state.total,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total: number) => `共 ${total} 条`,
    onChange: setCurrent,
    onShowSizeChange: (_, size: number) => setPageSize(size),
  };

  return {
    ...state,
    setCurrent,
    setPageSize,
    setTotal,
    reset,
    antdPagination, // 直接传给Ant Design Table
  };
};
```

### 2. useTableData Hook

**`shared/hooks/useTableData.ts`**
```typescript
import { useEffect, useState } from 'react';
import { usePagination } from './usePagination';
import { apiClient } from '@/shared/api/client';

export interface TableDataOptions<T = any> {
  url: string;
  params?: Record<string, any>;         // 额外的查询参数
  autoRefresh?: number;                 // 自动刷新间隔（毫秒）
  transform?: (data: any) => T[];       // 数据转换函数
}

export const useTableData = <T = any>(options: TableDataOptions<T>) => {
  const { url, params, autoRefresh, transform } = options;
  const pagination = usePagination();
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.get<App.ApiResponse<App.PaginatedResponse<T>>>(url, {
        params: {
          page: pagination.current,
          page_size: pagination.pageSize,
          ...params,
        },
      });

      const result = response.data.data;
      const items = transform ? transform(result.items) : result.items;

      setData(items);
      pagination.setTotal(result.total);
    } catch (err) {
      setError(err as Error);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 当分页或参数变化时重新加载
  useEffect(() => {
    fetchData();
  }, [pagination.current, pagination.pageSize, JSON.stringify(params)]);

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh) return;

    const timer = setInterval(fetchData, autoRefresh);
    return () => clearInterval(timer);
  }, [autoRefresh, pagination.current, pagination.pageSize, JSON.stringify(params)]);

  return {
    data,
    isLoading,
    error,
    pagination,
    refresh: fetchData, // 手动刷新
  };
};
```

### 3. useTableFilter Hook

**`shared/hooks/useTableFilter.ts`**
```typescript
import { useState, useCallback } from 'react';

export interface FilterState {
  [key: string]: any;
}

export const useTableFilter = <T extends FilterState>(initialFilters?: T) => {
  const [filters, setFilters] = useState<T>(initialFilters || ({} as T));

  const updateFilter = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateFilters = useCallback((newFilters: Partial<T>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(initialFilters || ({} as T));
  }, [initialFilters]);

  return {
    filters,
    updateFilter,
    updateFilters,
    resetFilters,
  };
};
```

### 4. DataTable 通用组件

**`shared/ui/DataTable/index.tsx`**
```typescript
import React from 'react';
import { Table, Card, Space, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { PaginationState } from '@/shared/hooks/usePagination';

interface DataTableProps<T = any> {
  data: T[];
  columns: ColumnsType<T>;
  loading?: boolean;
  pagination?: PaginationState & { antdPagination: any };
  onRefresh?: () => void;
  title?: string;
  toolbar?: React.ReactNode;  // 自定义工具栏
  rowKey?: string | ((record: T) => string);
}

export const DataTable = <T extends Record<string, any>>({
  data,
  columns,
  loading,
  pagination,
  onRefresh,
  title,
  toolbar,
  rowKey = 'id',
}: DataTableProps<T>) => {
  return (
    <Card
      title={title}
      extra={
        <Space>
          {toolbar}
          {onRefresh && (
            <Button icon={<ReloadOutlined />} onClick={onRefresh}>
              刷新
            </Button>
          )}
        </Space>
      }
    >
      <Table
        dataSource={data}
        columns={columns}
        loading={loading}
        pagination={pagination?.antdPagination || false}
        rowKey={rowKey}
        scroll={{ x: 'max-content' }}
      />
    </Card>
  );
};
```

### 5. FilterBar 通用组件

**`shared/ui/FilterBar/index.tsx`**
```typescript
import React from 'react';
import { Form, Row, Col, Button, Space } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';

export interface FilterBarProps {
  onSearch: (values: any) => void;
  onReset: () => void;
  children: React.ReactNode;  // 筛选字段组件
}

export const FilterBar: React.FC<FilterBarProps> = ({ onSearch, onReset, children }) => {
  const [form] = Form.useForm();

  const handleFinish = (values: any) => {
    onSearch(values);
  };

  const handleReset = () => {
    form.resetFields();
    onReset();
  };

  return (
    <Form form={form} onFinish={handleFinish} style={{ marginBottom: 16 }}>
      <Row gutter={16}>
        {children}
        <Col>
          <Space>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
              查询
            </Button>
            <Button onClick={handleReset} icon={<ReloadOutlined />}>
              重置
            </Button>
          </Space>
        </Col>
      </Row>
    </Form>
  );
};
```

### 6. 完整的表格页面示例

**`features/admin/ui/UserManagementPage.tsx`** - 用户管理页面
```typescript
import React from 'react';
import { Form, Input, Select, Tag, Button, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTableData } from '@/shared/hooks/useTableData';
import { useTableFilter } from '@/shared/hooks/useTableFilter';
import { DataTable } from '@/shared/ui/DataTable';
import { FilterBar } from '@/shared/ui/FilterBar';

interface User {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'distributor' | 'admin';
  quota_balance: number;
  created_at: string;
}

export const UserManagementPage: React.FC = () => {
  // 筛选状态
  const { filters, updateFilters, resetFilters } = useTableFilter<{
    role?: string;
    search?: string;
  }>({});

  // 表格数据
  const { data, isLoading, pagination, refresh } = useTableData<User>({
    url: '/api/admin/users',
    params: filters,
    autoRefresh: 30000, // 30秒自动刷新
  });

  // 表格列定义
  const columns: ColumnsType<User> = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '用户名', dataIndex: 'username', width: 150 },
    { title: '邮箱', dataIndex: 'email', width: 200 },
    {
      title: '角色',
      dataIndex: 'role',
      width: 120,
      render: (role: string) => {
        const colorMap = { user: 'blue', distributor: 'green', admin: 'red' };
        return <Tag color={colorMap[role as keyof typeof colorMap]}>{role}</Tag>;
      },
    },
    { title: '配额余额', dataIndex: 'quota_balance', width: 120 },
    { title: '注册时间', dataIndex: 'created_at', width: 180 },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small">
            编辑
          </Button>
          <Button type="link" size="small" danger>
            禁用
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <FilterBar onSearch={updateFilters} onReset={resetFilters}>
        <Form.Item name="search" style={{ marginBottom: 0 }}>
          <Input placeholder="搜索用户名/邮箱" style={{ width: 200 }} />
        </Form.Item>
        <Form.Item name="role" style={{ marginBottom: 0 }}>
          <Select
            placeholder="选择角色"
            style={{ width: 150 }}
            options={[
              { label: '全部', value: undefined },
              { label: '普通用户', value: 'user' },
              { label: '分销代理', value: 'distributor' },
              { label: '管理员', value: 'admin' },
            ]}
          />
        </Form.Item>
      </FilterBar>

      <DataTable
        data={data}
        columns={columns}
        loading={isLoading}
        pagination={pagination}
        onRefresh={refresh}
        title="用户管理"
        toolbar={
          <Button type="primary" onClick={() => console.log('新增用户')}>
            新增用户
          </Button>
        }
      />
    </div>
  );
};
```

---

## ✅ 验收标准

### 功能验收
- [ ] 表格数据正确加载并显示
- [ ] 分页切换正常工作（页码、每页数量）
- [ ] 筛选功能正常工作，筛选后重置到第1页
- [ ] 刷新按钮正常工作，保持当前页码和筛选条件
- [ ] 自动刷新功能正常工作（30秒间隔）

### 代码复用验收
- [ ] 用户管理、订单管理、任务监控等页面都使用`useTableData` Hook
- [ ] 所有表格页面的代码量减少>70%

### 性能验收
- [ ] 表格数据加载时显示Loading状态
- [ ] 筛选防抖（避免频繁请求）
- [ ] 自动刷新时不影响用户操作

---

## 🔧 技术要求

### API接口要求

**GET /api/admin/users**
```json
{
  "success": true,
  "data": {
    "items": [{ "id": 1, "username": "test" }],
    "total": 100,
    "page": 1,
    "page_size": 10
  }
}
```

### 性能优化
- 使用`useMemo`缓存表格列定义
- 使用`useCallback`缓存事件处理函数
- 自动刷新时使用`SWR`策略（不显示Loading）

---

## 📚 参考资料

1. **Ant Design Table**：https://ant.design/components/table-cn
2. **React Query分页**：https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries

---

## 🚨 注意事项

1. **分页参数约定**：
   - 后端使用`page`（从1开始）和`page_size`
   - 不使用`offset`和`limit`

2. **自动刷新优化**：
   - 只刷新数据，不重置筛选条件和分页状态
   - 用户正在编辑时暂停自动刷新

3. **渐进式迁移**：
   - 先迁移最简单的用户管理页面
   - 验证通过后再迁移其他表格页面

---

**艹！这个通用表格系统搞定后，管理后台10+个表格页面的代码能砍掉一半！** 🔥
