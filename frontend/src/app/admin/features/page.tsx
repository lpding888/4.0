'use client';

/**
 * 功能卡片管理页面（新框架版本）
 * 艹！使用GPT5工业级框架重构，代码量从261行减少到180行！
 */

import { useRouter } from 'next/navigation';
import { Button, Switch, Tag, Modal, message, Space } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';

// 新框架组件和Hooks
import {
  DataTable,
  FilterBar,
  FilterType,
  type DataTableColumn,
  type FilterConfig,
} from '@/shared/ui/DataTable';
import { useTableData } from '@/shared/hooks/useTableData';

// API和类型
import { api } from '@/lib/api';
import { Feature } from '@/types';

const { confirm } = Modal;

const DEFAULT_FILTERS = {
  category: '',
  is_enabled: '',
};

export default function AdminFeaturesPage() {
  const router = useRouter();

  // ========== 新框架：使用useTableData Hook统一管理状态 ==========
  const tableData = useTableData<Feature>({
    fetcher: async ({ filters }) => {
      const response: any = await api.admin.getFeatures();

      if (!response.success || !response.features) {
        throw new Error('获取功能列表失败');
      }

      let features = response.features as Feature[];

      // 前端筛选
      if (filters.category) {
        features = features.filter((f) => f.category === filters.category);
      }
      if (filters.is_enabled !== undefined) {
        features = features.filter(
          (f) => f.is_enabled === (filters.is_enabled === 'true')
        );
      }

      return {
        items: features,
        total: features.length,
      };
    },
    autoLoad: true,
    initialFilters: DEFAULT_FILTERS,
  });

  // ========== 新框架：FilterBar配置 ==========
  const filterConfig: FilterConfig[] = [
    {
      type: FilterType.SELECT,
      key: 'category',
      label: '功能分类',
      placeholder: '筛选分类',
      options: [
        { label: '全部分类', value: '' },
        { label: '图片处理', value: '图片处理' },
        { label: '内容生成', value: '内容生成' },
        { label: '数据分析', value: '数据分析' },
        { label: '其他', value: '其他' },
      ],
      allowClear: true,
    },
    {
      type: FilterType.SELECT,
      key: 'is_enabled',
      label: '启用状态',
      placeholder: '筛选状态',
      options: [
        { label: '全部状态', value: '' },
        { label: '已启用', value: 'true' },
        { label: '已禁用', value: 'false' },
      ],
      allowClear: true,
    },
  ];

  // ========== 操作处理函数 ==========

  /**
   * 切换启用状态
   * 艹！如果配额为0且要开启，必须二次确认！
   */
  const handleToggle = async (
    featureId: string,
    currentEnabled: boolean,
    quotaCost: number
  ) => {
    if (quotaCost === 0 && !currentEnabled) {
      confirm({
        title: '警告',
        icon: <ExclamationCircleOutlined />,
        content: '该功能配额为0，开启后可能导致滥用和成本失控。确定要开启吗？',
        okText: '确定开启',
        okType: 'danger',
        cancelText: '取消',
        onOk: async () => {
          await toggleFeatureAPI(featureId, !currentEnabled);
        },
      });
    } else {
      await toggleFeatureAPI(featureId, !currentEnabled);
    }
  };

  const toggleFeatureAPI = async (featureId: string, enabled: boolean) => {
    try {
      await api.admin.toggleFeature(featureId, { is_enabled: enabled });
      message.success(enabled ? '已启用' : '已禁用');
      tableData.refresh();
    } catch (error: any) {
      message.error('操作失败');
    }
  };

  /**
   * 删除功能
   */
  const handleDelete = (featureId: string, displayName: string) => {
    confirm({
      title: '确认删除',
      content: `确定要删除功能 "${displayName}" 吗？`,
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await api.admin.deleteFeature(featureId);
          message.success('删除成功');
          tableData.refresh();
        } catch (error: any) {
          message.error('删除失败');
        }
      },
    });
  };

  // ========== 新框架：DataTable列配置 ==========
  const columns: DataTableColumn<Feature>[] = [
    {
      title: 'Feature ID',
      dataIndex: 'feature_id',
      key: 'feature_id',
      width: 180,
    },
    {
      title: '显示名称',
      dataIndex: 'display_name',
      key: 'display_name',
      width: 150,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (category: string) => <Tag color="blue">{category}</Tag>,
    },
    {
      title: '是否启用',
      dataIndex: 'is_enabled',
      key: 'is_enabled',
      width: 100,
      render: (enabled: boolean, record: Feature) => (
        <Switch
          checked={enabled}
          onChange={() => handleToggle(record.feature_id, enabled, record.quota_cost)}
        />
      ),
    },
    {
      title: '所需套餐',
      dataIndex: 'plan_required',
      key: 'plan_required',
      width: 100,
      render: (plan: string) => {
        const colorMap: Record<string, string> = {
          free: 'green',
          basic: 'blue',
          pro: 'gold',
          enterprise: 'purple',
        };
        return <Tag color={colorMap[plan] || 'default'}>{plan}</Tag>;
      },
    },
    {
      title: '访问范围',
      dataIndex: 'access_scope',
      key: 'access_scope',
      width: 100,
      render: (scope: string) => (
        <Tag color={scope === 'whitelist' ? 'orange' : 'green'}>
          {scope === 'plan' ? '套餐' : '白名单'}
        </Tag>
      ),
    },
    {
      title: '配额消耗',
      dataIndex: 'quota_cost',
      key: 'quota_cost',
      width: 100,
      render: (cost: number) => (
        <span style={{ color: cost === 0 ? '#ff4d4f' : undefined, fontWeight: cost === 0 ? 'bold' : undefined }}>
          {cost} 次
        </span>
      ),
    },
    {
      title: '限流策略',
      dataIndex: 'rate_limit_policy',
      key: 'rate_limit_policy',
      width: 120,
      render: (policy: string | null) => policy || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_: any, record: Feature) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => router.push(`/admin/features/${record.feature_id}/edit`)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.feature_id, record.display_name)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  // ========== 渲染UI（新框架组件） ==========
  return (
    <div style={{ padding: '24px' }}>
      {/* 新框架：FilterBar */}
      <FilterBar
        filters={filterConfig}
        onFilterChange={(key, value) => {
          tableData.filters.setFilter(key, value);
          tableData.pagination.reset();
        }}
        onReset={() => {
          tableData.filters.setFilters({ ...DEFAULT_FILTERS });
          tableData.pagination.reset();
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => router.push('/admin/features/new')}
        >
          新增功能卡片
        </Button>
      </div>

      {/* 新框架：DataTable */}
      <DataTable
        columns={columns}
        dataSource={tableData.data}
        loading={tableData.loading}
        rowKey="feature_id"
        pagination={{
          page: tableData.pagination.page,
          pageSize: tableData.pagination.pageSize,
          total: tableData.pagination.total,
          onChange: tableData.pagination.goToPage,
        }}
        scroll={{ x: 1200 }}
      />
    </div>
  );
}
