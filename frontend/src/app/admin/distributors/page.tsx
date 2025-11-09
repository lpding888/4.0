/**
 * 管理端 - 分销员管理列表
 * 艹！使用新的GPT5架构：DataTable + FilterBar + useTableData！
 */

'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, message, Space } from 'antd';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { DistributorListItem } from '@/types';
import StatusBadge from '@/components/distribution/StatusBadge';
import { DataTable, FilterBar } from '@/shared/ui/DataTable';
import { useTableData } from '@/shared/hooks/useTableData';
import type { DataTableColumn, FilterConfig } from '@/shared/ui/DataTable';
import { FilterType } from '@/shared/ui/DataTable';

const DEFAULT_FILTERS = {
  keyword: '',
  status: 'all',
};

/**
 * 管理端 - 分销员管理列表
 * 艹！管理员在这里审核和管理所有分销员！
 */
export default function AdminDistributorsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  // 权限检查
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      router.push('/workspace');
    }
  }, [user, router]);

  /**
   * 艹！使用新的 useTableData Hook 管理表格数据！
   * 自动处理分页、筛选、加载状态！
   */
  const tableData = useTableData({
    fetcher: async (params) => {
      const response: any = await api.adminDistribution.getDistributors({
        ...(params.filters.status !== 'all' && params.filters.status
          ? { status: params.filters.status }
          : {}),
        ...(params.filters.keyword ? { keyword: params.filters.keyword } : {}),
        limit: params.pageSize,
        offset: params.offset,
      });

      if (response.success && response.data) {
        return {
          items: response.data.distributors || [],
          total: response.data.total || 0,
        };
      }

      throw new Error(response.error?.message || '加载失败');
    },
    autoLoad: true,
    initialFilters: DEFAULT_FILTERS,
  });

  /**
   * 筛选配置
   * 艹！FilterBar会自动渲染这些筛选器！
   */
  const filterConfig: FilterConfig[] = useMemo(
    () => [
      {
        type: FilterType.SEARCH,
        key: 'keyword',
        label: '搜索',
        placeholder: '搜索手机号或姓名',
        width: 300,
      },
      {
        type: FilterType.SELECT,
        key: 'status',
        label: '状态',
        placeholder: '选择状态',
        options: [
          { label: '全部状态', value: 'all' },
          { label: '待审核', value: 'pending' },
          { label: '已激活', value: 'active' },
          { label: '已禁用', value: 'disabled' },
        ],
        width: 150,
        defaultValue: 'all',
      },
    ],
    []
  );

  /**
   * 审核通过
   */
  const handleApprove = async (id: string) => {
    try {
      const response: any = await api.adminDistribution.approveDistributor(id);
      if (response.success) {
        message.success('审核通过');
        tableData.refresh();
      } else {
        message.error(response.error?.message || '操作失败');
      }
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  /**
   * 禁用分销员
   */
  const handleDisable = async (id: string) => {
    if (!confirm('确定要禁用该分销员吗？')) return;

    try {
      const response: any = await api.adminDistribution.disableDistributor(id);
      if (response.success) {
        message.success('已禁用');
        tableData.refresh();
      } else {
        message.error(response.error?.message || '操作失败');
      }
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  /**
   * 表格列配置
   * 艹！DataTable会自动渲染这些列！
   */
  const columns: DataTableColumn<DistributorListItem>[] = useMemo(
    () => [
      {
        key: 'id',
        title: 'ID',
        dataIndex: 'id',
        width: 80,
      },
      {
        key: 'user',
        title: '用户信息',
        render: (record) => (
          <div>
            <div>{record.phone}</div>
            <div className="text-xs text-gray-500">{record.realName}</div>
          </div>
        ),
      },
      {
        key: 'appliedAt',
        title: '申请时间',
        dataIndex: 'appliedAt',
        render: (text) => new Date(text as string).toLocaleString('zh-CN'),
      },
      {
        key: 'status',
        title: '状态',
        dataIndex: 'status',
        render: (status) => <StatusBadge status={status as string} type="distributor" />,
      },
      {
        key: 'totalReferrals',
        title: '推广人数',
        dataIndex: 'totalReferrals',
      },
      {
        key: 'totalCommission',
        title: '累计佣金',
        dataIndex: 'totalCommission',
        render: (amount) => (
          <span className="text-green-600 font-semibold">
            ¥{(amount as number).toFixed(2)}
          </span>
        ),
      },
      {
        key: 'actions',
        title: '操作',
        width: 200,
        render: (record) => (
          <Space>
            {record.status === 'pending' && (
              <Button type="primary" size="small" onClick={() => handleApprove(record.id)}>
                通过
              </Button>
            )}
            {record.status === 'active' && (
              <Button danger size="small" onClick={() => handleDisable(record.id)}>
                禁用
              </Button>
            )}
            <Link href={`/admin/distributors/${record.id}`}>
              <Button size="small">详情</Button>
            </Link>
          </Space>
        ),
      },
    ],
    []
  );

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>
        分销员管理
      </h1>

      {/* 艹！使用新的 FilterBar 组件！ */}
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

      {/* 艹！使用新的 DataTable 组件！ */}
      <DataTable
        columns={columns}
        dataSource={tableData.data}
        loading={tableData.loading}
        rowKey="id"
        pagination={{
          page: tableData.pagination.page,
          pageSize: tableData.pagination.pageSize,
          total: tableData.pagination.total,
          onChange: tableData.pagination.goToPage,
        }}
      />
    </div>
  );
}
