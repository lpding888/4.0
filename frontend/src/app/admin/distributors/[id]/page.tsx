'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Descriptions, Table, Spin, message, Tag } from 'antd';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { DistributorDetail, Referral, Commission } from '@/types';
import StatusBadge from '@/components/distribution/StatusBadge';
import StatCard from '@/components/distribution/StatCard';

/**
 * 管理端 - 分销员详情页
 *
 * 艹！查看单个分销员的完整信息和业绩数据！
 */
export default function AdminDistributorDetailPage({
  params
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [distributor, setDistributor] = useState<DistributorDetail | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      router.push('/workspace');
      return;
    }

    fetchData();
  }, [user, params.id, router]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // 并行获取数据
      const [detailRes, referralsRes, commissionsRes]: any[] = await Promise.all([
        api.adminDistribution.getDistributor(params.id),
        api.adminDistribution.getDistributorReferrals(params.id, { limit: 100 }),
        api.adminDistribution.getDistributorCommissions(params.id, { limit: 100 })
      ]);

      if (detailRes.success && detailRes.data) {
        setDistributor(detailRes.data);
      }

      if (referralsRes.success && referralsRes.data) {
        setReferrals(referralsRes.data.referrals || []);
      }

      if (commissionsRes.success && commissionsRes.data) {
        setCommissions(commissionsRes.data.commissions || []);
      }
    } catch (error: any) {
      message.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!distributor) {
    return (
      <div style={{ padding: '24px' }}>
        <p>分销员不存在</p>
      </div>
    );
  }

  // 推广用户列表列定义
  const referralColumns = [
    {
      title: '用户ID',
      dataIndex: 'userId',
      key: 'userId'
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone'
    },
    {
      title: '注册时间',
      dataIndex: 'registeredAt',
      key: 'registeredAt',
      render: (text: string) => new Date(text).toLocaleString('zh-CN')
    },
    {
      title: '是否购买',
      dataIndex: 'hasPaid',
      key: 'hasPaid',
      render: (hasPaid: boolean) =>
        hasPaid ? (
          <Tag color="green">已购买</Tag>
        ) : (
          <Tag color="default">未购买</Tag>
        )
    },
    {
      title: '佣金',
      dataIndex: 'commissionAmount',
      key: 'commissionAmount',
      render: (amount: number) =>
        amount ? (
          <span className="text-green-600 font-semibold">
            ¥{amount.toFixed(2)}
          </span>
        ) : (
          '-'
        )
    }
  ];

  // 佣金记录列定义
  const commissionColumns = [
    {
      title: '订单ID',
      dataIndex: 'orderId',
      key: 'orderId'
    },
    {
      title: '订单金额',
      dataIndex: 'orderAmount',
      key: 'orderAmount',
      render: (amount: number) => `¥${amount.toFixed(2)}`
    },
    {
      title: '佣金金额',
      dataIndex: 'commissionAmount',
      key: 'commissionAmount',
      render: (amount: number) => (
        <span className="text-green-600 font-semibold">
          ¥{amount.toFixed(2)}
        </span>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <StatusBadge status={status} type="commission" />
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => new Date(text).toLocaleString('zh-CN')
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>
        分销员详情
      </h1>

      {/* 基本信息卡片 */}
      <Card title="分销员信息" style={{ marginBottom: '24px' }}>
        <Descriptions column={2}>
          <Descriptions.Item label="真实姓名">
            {distributor.realName}
          </Descriptions.Item>
          <Descriptions.Item label="身份证号">
            {distributor.idCard}
          </Descriptions.Item>
          <Descriptions.Item label="联系方式">
            {distributor.contact}
          </Descriptions.Item>
          <Descriptions.Item label="手机号">
            {distributor.phone}
          </Descriptions.Item>
          <Descriptions.Item label="邀请码">
            <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
              {distributor.inviteCode}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <StatusBadge status={distributor.status} type="distributor" />
          </Descriptions.Item>
          <Descriptions.Item label="申请时间">
            {new Date(distributor.appliedAt).toLocaleString('zh-CN')}
          </Descriptions.Item>
          <Descriptions.Item label="审核时间">
            {distributor.approvedAt
              ? new Date(distributor.approvedAt).toLocaleString('zh-CN')
              : '-'}
          </Descriptions.Item>
          {distributor.channel && (
            <Descriptions.Item label="推广渠道" span={2}>
              {distributor.channel}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* 数据统计 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <Card>
          <StatCard
            label="推广人数"
            value={distributor.totalReferrals}
            color="blue"
          />
        </Card>
        <Card>
          <StatCard
            label="累计佣金"
            value={`¥${distributor.totalCommission.toFixed(2)}`}
            color="green"
          />
        </Card>
        <Card>
          <StatCard
            label="可提现"
            value={`¥${distributor.availableCommission.toFixed(2)}`}
            color="cyan"
          />
        </Card>
        <Card>
          <StatCard
            label="已提现"
            value={`¥${distributor.withdrawnCommission.toFixed(2)}`}
            color="purple"
          />
        </Card>
      </div>

      {/* 推广用户列表 */}
      <Card title="推广用户列表" style={{ marginBottom: '24px' }}>
        <Table
          columns={referralColumns}
          dataSource={referrals}
          rowKey="userId"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 佣金记录 */}
      <Card title="佣金记录">
        <Table
          columns={commissionColumns}
          dataSource={commissions}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}
