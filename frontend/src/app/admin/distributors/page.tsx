'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Table, Input, Select, Button, message, Space, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { DistributorsResponse, DistributorListItem } from '@/types';
import StatusBadge from '@/components/distribution/StatusBadge';
import { formatCurrency } from '@/utils/number';

const { Search } = Input;

/**
 * 管理端 - 分销员管理列表
 *
 * 艹！管理员在这里审核和管理所有分销员！
 */
export default function AdminDistributorsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DistributorsResponse | null>(null);
  const [status, setStatus] = useState<string>('all');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      router.push('/workspace');
      return;
    }

    fetchDistributors();
  }, [user, status, keyword, page, pageSize, router]);

  const fetchDistributors = async () => {
    try {
      setLoading(true);
      const response: any = await api.adminDistribution.getDistributors({
        status: status === 'all' ? undefined : status,
        keyword: keyword || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize
      });

      if (response.success && response.data) {
        setData(response.data);
      }
    } catch (error: any) {
      message.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 审核通过
  const handleApprove = async (id: string) => {
    try {
      const response: any = await api.adminDistribution.approveDistributor(id);
      if (response.success) {
        message.success('审核通过');
        fetchDistributors();
      } else {
        message.error(response.error?.message || '操作失败');
      }
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  // 禁用分销员
  const handleDisable = async (id: string) => {
    if (!confirm('确定要禁用该分销员吗？')) return;

    try {
      const response: any = await api.adminDistribution.disableDistributor(id);
      if (response.success) {
        message.success('已禁用');
        fetchDistributors();
      } else {
        message.error(response.error?.message || '操作失败');
      }
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80
    },
    {
      title: '用户信息',
      key: 'user',
      render: (record: DistributorListItem) => (
        <div>
          <div>{record.phone}</div>
          <div className="text-xs text-gray-500">{record.realName}</div>
        </div>
      )
    },
    {
      title: '申请时间',
      dataIndex: 'appliedAt',
      key: 'appliedAt',
      render: (text: string) => new Date(text).toLocaleString('zh-CN')
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <StatusBadge status={status} type="distributor" />
    },
    {
      title: '推广人数',
      dataIndex: 'totalReferrals',
      key: 'totalReferrals'
    },
    {
      title: '累计佣金',
      dataIndex: 'totalCommission',
      key: 'totalCommission',
      render: (amount: number) => (
        <span className="text-green-600 font-semibold">
          ¥{formatCurrency(amount)}
        </span>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (record: DistributorListItem) => (
        <Space>
          {record.status === 'pending' && (
            <Button
              type="primary"
              size="small"
              onClick={() => handleApprove(record.id)}
            >
              通过
            </Button>
          )}
          {record.status === 'active' && (
            <Button
              danger
              size="small"
              onClick={() => handleDisable(record.id)}
            >
              禁用
            </Button>
          )}
          <Link href={`/admin/distributors/${record.id}`}>
            <Button size="small">详情</Button>
          </Link>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>
        分销员管理
      </h1>

      {/* 搜索和筛选 */}
      <div style={{ marginBottom: '16px', display: 'flex', gap: '16px' }}>
        <Search
          placeholder="搜索手机号或姓名"
          allowClear
          enterButton={<SearchOutlined />}
          style={{ width: 300 }}
          onSearch={setKeyword}
        />
        <Select
          value={status}
          onChange={setStatus}
          style={{ width: 150 }}
        >
          <Select.Option value="all">全部状态</Select.Option>
          <Select.Option value="pending">待审核</Select.Option>
          <Select.Option value="active">已激活</Select.Option>
          <Select.Option value="disabled">已禁用</Select.Option>
        </Select>
      </div>

      {/* 分销员表格 */}
      <Table
        columns={columns}
        dataSource={data?.distributors || []}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total: data?.total || 0,
          onChange: (newPage, newPageSize) => {
            setPage(newPage);
            if (newPageSize !== pageSize) {
              setPageSize(newPageSize);
              setPage(1);
            }
          },
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`
        }}
      />
    </div>
  );
}
