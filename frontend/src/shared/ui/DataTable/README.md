# DataTable & FilterBar 通用表格系统

艹，这个组件系统让你3行代码就能搞定一个完整的数据表格页面！

## 核心功能

### DataTable（数据表格）
- ✅ **开箱即用**: 集成分页、加载、空状态
- ✅ **行选择**: 支持单选、多选、批量操作
- ✅ **批量操作**: 内置批量操作栏，自动管理选中状态
- ✅ **响应式**: 自动适配移动端
- ✅ **类型安全**: 完整的TypeScript泛型支持
- ✅ **高度可定制**: 支持Ant Design Table的所有配置

### FilterBar（筛选栏）
- ✅ **多种筛选器**: 输入框、选择器、日期范围、数字范围等
- ✅ **自动布局**: 响应式栅格布局
- ✅ **集成Hooks**: 完美配合 useTableFilter
- ✅ **灵活配置**: 支持自定义宽度、默认值、禁用状态

## 快速开始

### 最简单的用法（3行代码）

```tsx
import { DataTable } from '@/shared/ui/DataTable';
import { useTableData } from '@/shared/hooks/useTableData';

function UserList() {
  // 艹，一个Hook搞定所有逻辑！
  const { data, loading, pagination } = useTableData({
    fetcher: async ({ page, pageSize }) => {
      const res = await api.users.getList({ page, pageSize });
      return { items: res.data.users, total: res.data.total };
    },
  });

  const columns = [
    { key: 'id', title: 'ID', width: 80 },
    { key: 'name', title: '姓名' },
    { key: 'email', title: '邮箱' },
  ];

  return (
    <DataTable
      columns={columns}
      dataSource={data}
      loading={loading}
      pagination={pagination}
    />
  );
}
```

### 带筛选栏的完整示例

```tsx
import { DataTable, FilterBar, FilterType } from '@/shared/ui/DataTable';
import { useTableData } from '@/shared/hooks/useTableData';

function UserListWithFilter() {
  const { data, loading, pagination, filters, refresh } = useTableData({
    fetcher: async ({ page, pageSize, filters }) => {
      const res = await api.users.getList({
        page,
        pageSize,
        ...filters, // 艹，筛选参数自动传过来！
      });
      return { items: res.data.users, total: res.data.total };
    },
  });

  // 筛选器配置
  const filterConfigs = [
    {
      key: 'keyword',
      type: FilterType.SEARCH,
      label: '关键词',
      placeholder: '搜索用户名或邮箱',
    },
    {
      key: 'status',
      type: FilterType.SELECT,
      label: '状态',
      options: [
        { label: '全部', value: '' },
        { label: '激活', value: 'active' },
        { label: '禁用', value: 'disabled' },
      ],
    },
    {
      key: 'dateRange',
      type: FilterType.DATE_RANGE,
      label: '注册时间',
    },
  ];

  const columns = [
    { key: 'id', title: 'ID', width: 80 },
    { key: 'name', title: '姓名' },
    { key: 'email', title: '邮箱' },
    { key: 'status', title: '状态', render: (status) => <Tag>{status}</Tag> },
    {
      key: 'actions',
      title: '操作',
      render: (_, record) => (
        <Space>
          <Button size="small">编辑</Button>
          <Button size="small" danger>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 筛选栏 */}
      <FilterBar
        filters={filterConfigs}
        onFilterChange={filters.setFilter}
        onReset={filters.reset}
        onSearch={refresh}
        showSearch
        showReset
      />

      {/* 数据表格 */}
      <DataTable
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={pagination}
      />
    </div>
  );
}
```

### 带批量操作的示例

```tsx
import { DataTable } from '@/shared/ui/DataTable';
import { DeleteOutlined, CheckOutlined } from '@ant-design/icons';

function UserListWithBatch() {
  const { data, loading, pagination } = useTableData({
    fetcher: fetchUsers,
  });

  const columns = [
    { key: 'id', title: 'ID', width: 80 },
    { key: 'name', title: '姓名' },
    { key: 'email', title: '邮箱' },
  ];

  // 批量操作配置
  const batchActions = [
    {
      key: 'approve',
      label: '批量激活',
      icon: <CheckOutlined />,
      onClick: (selectedRows, selectedKeys) => {
        console.log('批量激活:', selectedKeys);
        // 调用API批量激活
      },
    },
    {
      key: 'delete',
      label: '批量删除',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: (selectedRows, selectedKeys) => {
        console.log('批量删除:', selectedKeys);
        // 调用API批量删除
      },
      // 艹，当只选中1个时禁用批量删除（示例）
      disabled: (rows) => rows.length < 2,
    },
  ];

  return (
    <DataTable
      columns={columns}
      dataSource={data}
      loading={loading}
      pagination={pagination}
      rowSelection // 开启行选择
      batchActions={batchActions}
    />
  );
}
```

## DataTable API

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `columns` | `DataTableColumn[]` | - | 表格列配置（必需） |
| `dataSource` | `T[]` | `[]` | 表格数据 |
| `loading` | `boolean` | `false` | 是否加载中 |
| `pagination` | `PaginationConfig` | - | 分页配置（传入usePagination返回值） |
| `rowSelection` | `boolean` | `false` | 是否可选择行 |
| `onRowSelectionChange` | `(keys, rows) => void` | - | 选中行变化回调 |
| `batchActions` | `BatchAction[]` | `[]` | 批量操作配置 |
| `bordered` | `boolean` | `true` | 是否显示边框 |
| `size` | `'small' \| 'middle' \| 'large'` | `'middle'` | 表格大小 |
| `emptyText` | `string` | `'暂无数据'` | 空数据文案 |
| `title` | `string \| ReactNode` | - | 表格标题 |
| `toolbar` | `ReactNode` | - | 工具栏（右侧） |
| `rowKey` | `string \| function` | `'id'` | 行唯一key |

### DataTableColumn

| 属性 | 类型 | 说明 |
|------|------|------|
| `key` | `string` | 列唯一key（必需） |
| `title` | `string` | 列标题（必需） |
| `dataIndex` | `string \| string[]` | 数据字段，支持嵌套如 `'user.name'` |
| `width` | `number \| string` | 列宽度 |
| `fixed` | `'left' \| 'right'` | 固定列 |
| `sorter` | `boolean \| function` | 排序配置 |
| `render` | `(value, record, index) => ReactNode` | 自定义渲染 |
| `hidden` | `boolean` | 是否隐藏列 |

### BatchAction

| 属性 | 类型 | 说明 |
|------|------|------|
| `key` | `string` | 操作唯一key（必需） |
| `label` | `string` | 操作标签（必需） |
| `onClick` | `(rows, keys) => void` | 操作回调（必需） |
| `icon` | `ReactNode` | 操作图标 |
| `danger` | `boolean` | 是否危险操作（红色） |
| `disabled` | `boolean \| (rows) => boolean` | 是否禁用 |

## FilterBar API

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `filters` | `FilterConfig[]` | - | 筛选器配置数组（必需） |
| `onFilterChange` | `(key, value) => void` | - | 单个筛选值变化回调 |
| `onReset` | `() => void` | - | 重置回调 |
| `onSearch` | `() => void` | - | 搜索回调 |
| `showReset` | `boolean` | `true` | 是否显示重置按钮 |
| `showSearch` | `boolean` | `false` | 是否显示搜索按钮 |
| `layout` | `'inline' \| 'vertical'` | `'inline'` | 布局方式 |
| `gutter` | `number \| [number, number]` | `16` | 栅格间距 |

### FilterConfig

| 属性 | 类型 | 说明 |
|------|------|------|
| `key` | `string` | 筛选器唯一key（必需） |
| `type` | `FilterType` | 筛选器类型（必需） |
| `label` | `string` | 筛选器标签（必需） |
| `placeholder` | `string` | 占位符 |
| `defaultValue` | `any` | 默认值 |
| `options` | `FilterOption[]` | 选项（用于select/radio/checkbox） |
| `allowClear` | `boolean` | 是否允许清空 |
| `width` | `number \| string` | 自定义宽度 |
| `disabled` | `boolean` | 是否禁用 |
| `visible` | `boolean` | 是否显示 |

### FilterType（筛选器类型）

```tsx
enum FilterType {
  INPUT = 'input',           // 文本输入框
  SEARCH = 'search',         // 搜索输入框
  SELECT = 'select',         // 单选下拉
  MULTI_SELECT = 'multiSelect', // 多选下拉
  DATE = 'date',             // 日期选择
  DATE_RANGE = 'dateRange',  // 日期范围
  NUMBER = 'number',         // 数字输入
  NUMBER_RANGE = 'numberRange', // 数字范围
  RADIO = 'radio',           // 单选按钮组
  CHECKBOX = 'checkbox',     // 复选框组
}
```

## 高级用法

### 1. 自定义列渲染

```tsx
const columns = [
  {
    key: 'avatar',
    title: '头像',
    render: (_, record) => <Avatar src={record.avatarUrl} />,
  },
  {
    key: 'status',
    title: '状态',
    render: (status) => {
      const colorMap = { active: 'green', disabled: 'red' };
      return <Tag color={colorMap[status]}>{status}</Tag>;
    },
  },
  {
    key: 'createdAt',
    title: '创建时间',
    render: (date) => new Date(date).toLocaleString('zh-CN'),
  },
];
```

### 2. 嵌套字段访问

```tsx
const columns = [
  {
    key: 'userName',
    title: '用户名',
    dataIndex: ['user', 'name'], // 访问 record.user.name
  },
  {
    key: 'companyName',
    title: '公司',
    dataIndex: ['user', 'company', 'name'], // 访问 record.user.company.name
  },
];
```

### 3. 固定列

```tsx
const columns = [
  { key: 'id', title: 'ID', width: 80, fixed: 'left' },
  { key: 'name', title: '姓名', width: 150 },
  { key: 'email', title: '邮箱', width: 200 },
  { key: 'phone', title: '电话', width: 150 },
  {
    key: 'actions',
    title: '操作',
    width: 150,
    fixed: 'right',
    render: () => <Button>编辑</Button>,
  },
];
```

### 4. 带标题和工具栏的表格

```tsx
<DataTable
  title="用户列表"
  toolbar={
    <Space>
      <Button type="primary" icon={<PlusOutlined />}>
        新增用户
      </Button>
      <Button icon={<ExportOutlined />}>
        导出
      </Button>
    </Space>
  }
  columns={columns}
  dataSource={data}
/>
```

### 5. 垂直布局的筛选栏

```tsx
<FilterBar
  filters={filterConfigs}
  layout="vertical" // 艹，竖着排列，适合筛选项多的场景！
  onFilterChange={filters.setFilter}
/>
```

### 6. 完整的CRUD页面示例

```tsx
function UserManagementPage() {
  const [showAddModal, setShowAddModal] = useState(false);

  const { data, loading, pagination, filters, refresh } = useTableData({
    fetcher: async ({ page, pageSize, filters }) => {
      const res = await api.users.getList({ page, pageSize, ...filters });
      return { items: res.data.users, total: res.data.total };
    },
  });

  const filterConfigs = [
    { key: 'keyword', type: FilterType.SEARCH, label: '关键词' },
    {
      key: 'role',
      type: FilterType.SELECT,
      label: '角色',
      options: [
        { label: '全部', value: '' },
        { label: '管理员', value: 'admin' },
        { label: '用户', value: 'user' },
      ],
    },
  ];

  const columns = [
    { key: 'id', title: 'ID', width: 80 },
    { key: 'name', title: '姓名', width: 150 },
    { key: 'email', title: '邮箱', width: 200 },
    { key: 'role', title: '角色', width: 100 },
    {
      key: 'actions',
      title: '操作',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button
            size="small"
            danger
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const batchActions = [
    {
      key: 'delete',
      label: '批量删除',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: async (rows, keys) => {
        await api.users.batchDelete(keys);
        message.success('删除成功');
        refresh();
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        {/* 筛选栏 */}
        <FilterBar
          filters={filterConfigs}
          onFilterChange={filters.setFilter}
          onReset={filters.reset}
          onSearch={refresh}
          showSearch
          showReset
        />

        {/* 数据表格 */}
        <DataTable
          title="用户列表"
          toolbar={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setShowAddModal(true)}
            >
              新增用户
            </Button>
          }
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={pagination}
          rowSelection
          batchActions={batchActions}
        />
      </Card>

      {/* 新增用户弹窗 */}
      <AddUserModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={refresh}
      />
    </div>
  );
}
```

## 与Hooks集成

这套组件完美配合之前实现的Hooks：

```tsx
import { useTableData } from '@/shared/hooks/useTableData';
import { DataTable, FilterBar } from '@/shared/ui/DataTable';

function MyPage() {
  // 艹，一个Hook搞定一切！
  const tableHook = useTableData({
    fetcher: async ({ page, pageSize, filters }) => {
      // 自动传入分页和筛选参数
      return api.getData({ page, pageSize, ...filters });
    },
  });

  return (
    <>
      <FilterBar
        filters={filterConfigs}
        onFilterChange={tableHook.filters.setFilter}
        onReset={tableHook.filters.reset}
        onSearch={tableHook.refresh}
      />
      <DataTable
        columns={columns}
        dataSource={tableHook.data}
        loading={tableHook.loading}
        pagination={tableHook.pagination}
      />
    </>
  );
}
```

## 性能优化建议

1. **使用useMemo缓存columns配置**:
```tsx
const columns = useMemo(() => [
  { key: 'id', title: 'ID' },
  // ...
], []);
```

2. **大数据量使用虚拟滚动**（自己实现或使用rc-virtual-list）

3. **避免在render函数中创建新对象**:
```tsx
// ❌ 不好
render: () => <Button style={{ color: 'red' }}>删除</Button>

// ✅ 好
const buttonStyle = { color: 'red' };
render: () => <Button style={buttonStyle}>删除</Button>
```

---

**艹，这套组件系统就是这么强大！有问题随时吼老王！**
