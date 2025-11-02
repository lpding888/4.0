'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Table, Tabs, Button, message, Space, Modal, Input } from 'antd';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { WithdrawalsResponse, Withdrawal, WithdrawalStatus } from '@/types';
import StatusBadge from '@/components/distribution/StatusBadge';
import { formatCurrency } from '@/utils/number';

const { TextArea } = Input;

/**
 * 管理端 - 提现审核页面
 *
 * 艹！管理员在这里审核所有提现申请！
 */
export default function AdminWithdrawalsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<WithdrawalsResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | WithdrawalStatus>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [currentWithdrawal, setCurrentWithdrawal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      router.push('/workspace');
      return;
    }

    fetchWithdrawals();
  }, [user, activeTab, page, pageSize, router]);

  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      const response: any = await api.adminDistribution.getWithdrawals({
        status: activeTab === 'all' ? undefined : activeTab,
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

  // 批准提现
  const handleApprove = async (id: string) => {
    if (!confirm('确定要批准该提现申请吗？')) return;

    try {
      setActionLoading(true);
      const response: any = await api.adminDistribution.approveWithdrawal(id);
      if (response.success) {
        message.success('已批准');
        fetchWithdrawals();
      } else {
        message.error(response.error?.message || '操作失败');
      }
    } catch (error: any) {
      message.error(error.message || '操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 打开拒绝弹窗
  const showRejectModal = (id: string) => {
    setCurrentWithdrawal(id);
    setRejectReason('');
    setRejectModalVisible(true);
  };

  // 提交拒绝
  const handleReject = async () => {
    if (!rejectReason.trim()) {
      message.error('请输入拒绝原因');
      return;
    }

    if (!currentWithdrawal) return;

    try {
      setActionLoading(true);
      const response: any = await api.adminDistribution.rejectWithdrawal(
        currentWithdrawal,
        { reason: rejectReason }
      );
      if (response.success) {
        message.success('已拒绝');
        setRejectModalVisible(false);
        setCurrentWithdrawal(null);
        setRejectReason('');
        fetchWithdrawals();
      } else {
        message.error(response.error?.message || '操作失败');
      }
    } catch (error: any) {
      message.error(error.message || '操作失败');
    } finally {
      setActionLoading(false);
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
      title: '分销员',
      key: 'distributor',
      render: (record: Withdrawal) => (
        <div>
          <div>{record.phone}</div>
          <div className="text-xs text-gray-500">{record.realName}</div>
        </div>
      )
    },
    {
      title: '提现金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number) => (
        <span className="text-green-600 font-semibold text-base">
          ¥{formatCurrency(amount)}
        </span>
      )
    },
    {
      title: '提现方式',
      dataIndex: 'method',
      key: 'method',
      render: (method: string) => (
        method === 'wechat' ? '微信零钱' : '支付宝'
      )
    },
    {
      title: '收款信息',
      key: 'account',
      render: (record: Withdrawal) => (
        <div>
          <div className="text-xs text-gray-500">
            {record.method === 'wechat' ? '微信' : '支付宝'}：
            {record.accountInfo.account}
          </div>
          <div className="text-xs text-gray-500">
            姓名：{record.accountInfo.name}
          </div>
        </div>
      )
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => new Date(text).toLocaleString('zh-CN')
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: WithdrawalStatus) => (
        <StatusBadge status={status} type="withdrawal" />
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (record: Withdrawal) => (
        <Space>
          {record.status === 'pending' && (
            <>
              <Button
                type="primary"
                size="small"
                onClick={() => handleApprove(record.id)}
                loading={actionLoading}
              >
                批准
              </Button>
              <Button
                danger
                size="small"
                onClick={() => showRejectModal(record.id)}
                loading={actionLoading}
              >
                拒绝
              </Button>
            </>
          )}
          {record.status === 'rejected' && record.rejectedReason && (
            <span className="text-xs text-red-500">
              {record.rejectedReason}
            </span>
          )}
          {record.status === 'approved' && record.approvedAt && (
            <span className="text-xs text-gray-500">
              {new Date(record.approvedAt).toLocaleString('zh-CN')}
            </span>
          )}
        </Space>
      )
    }
  ];

  // 计算各状态数量
  const pendingCount = data?.withdrawals.filter(w => w.status === 'pending').length || 0;
  const approvedCount = data?.withdrawals.filter(w => w.status === 'approved').length || 0;
  const rejectedCount = data?.withdrawals.filter(w => w.status === 'rejected').length || 0;

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>
        提现审核
      </h1>

      {/* 标签页切换 */}
      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key as typeof activeTab);
          setPage(1);
        }}
        items={[
          {
            key: 'all',
            label: `全部 (${data?.total || 0})`
          },
          {
            key: 'pending',
            label: `待审核 (${pendingCount})`
          },
          {
            key: 'approved',
            label: `已批准 (${approvedCount})`
          },
          {
            key: 'rejected',
            label: `已拒绝 (${rejectedCount})`
          }
        ]}
      />

      {/* 提现申请表格 */}
      <Table
        columns={columns}
        dataSource={data?.withdrawals || []}
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

      {/* 拒绝原因弹窗 */}
      <Modal
        title="拒绝提现申请"
        open={rejectModalVisible}
        onOk={handleReject}
        onCancel={() => {
          setRejectModalVisible(false);
          setCurrentWithdrawal(null);
          setRejectReason('');
        }}
        confirmLoading={actionLoading}
        okText="确认拒绝"
        cancelText="取消"
      >
        <TextArea
          rows={4}
          placeholder="请输入拒绝原因，将通知给分销员"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>
    </div>
  );
}
