'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Row, Col, Table, Spin, message } from 'antd';
import {
  UserAddOutlined,
  DollarOutlined,
  TeamOutlined,
  RiseOutlined
} from '@ant-design/icons';
import { api } from '@/lib/api';
import { formatCurrency } from '@/utils/number';
import { useAuthStore } from '@/store/authStore';

/**
 * 分销统计类型定义
 */
interface DistributionStats {
  totalDistributors: number;
  activeDistributors: number;
  pendingDistributors: number;
  disabledDistributors: number;
  totalReferrals: number;
  totalCommission: number;
  totalWithdrawn: number;
  pendingWithdrawals: number;
  topDistributors: Array<{
    id: string;
    phone: string;
    realName: string;
    totalReferrals: number;
    totalCommission: number;
  }>;
  recentTrends: {
    date: string;
    newReferrals: number;
    newCommission: number;
  }[];
}

/**
 * 管理端 - 分销统计页面
 *
 * 艹！展示整个分销系统的统计数据和趋势！
 */
export default function DistributionStatsPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DistributionStats | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      router.push('/workspace');
      return;
    }

    fetchStats();
  }, [user, router]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response: any = await api.adminDistribution.getStats();

      if (response.success && response.data) {
        setStats(response.data);
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

  if (!stats) {
    return (
      <div style={{ padding: '24px' }}>
        <p>加载失败</p>
      </div>
    );
  }

  // 顶级分销员表格列定义
  const topDistributorsColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_: any, __: any, index: number) => (
        <span
          className={`font-bold ${
            index === 0
              ? 'text-yellow-500'
              : index === 1
              ? 'text-gray-400'
              : index === 2
              ? 'text-orange-500'
              : ''
          }`}
        >
          {index + 1}
        </span>
      )
    },
    {
      title: '分销员',
      key: 'distributor',
      render: (record: any) => (
        <div>
          <div>{record.phone}</div>
          <div className="text-xs text-gray-500">{record.realName}</div>
        </div>
      )
    },
    {
      title: '推广人数',
      dataIndex: 'totalReferrals',
      key: 'totalReferrals',
      sorter: (a: any, b: any) => a.totalReferrals - b.totalReferrals
    },
    {
      title: '累计佣金',
      dataIndex: 'totalCommission',
      key: 'totalCommission',
      render: (amount: number) => (
        <span className="text-green-600 font-semibold">
          ¥{formatCurrency(amount)}
        </span>
      ),
      sorter: (a: any, b: any) => a.totalCommission - b.totalCommission
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>
        分销统计
      </h1>

      {/* 核心数据卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '24px'
                }}
              >
                <TeamOutlined />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                  分销员总数
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a' }}>
                  {stats.totalDistributors}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  激活 {stats.activeDistributors} / 待审核 {stats.pendingDistributors}
                </div>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: '#06b6d4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '24px'
                }}
              >
                <UserAddOutlined />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                  推广用户总数
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a' }}>
                  {stats.totalReferrals}
                </div>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '24px'
                }}
              >
                <DollarOutlined />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                  累计佣金支出
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a' }}>
                  ¥{formatCurrency(stats.totalCommission)}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  已提现 ¥{formatCurrency(stats.totalWithdrawn)}
                </div>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: '#f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '24px'
                }}
              >
                <RiseOutlined />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
                  待处理提现
                </div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a' }}>
                  {stats.pendingWithdrawals}
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 顶级分销员榜单 */}
      <Card
        title="顶级分销员榜单"
        style={{ marginBottom: '24px' }}
        extra={
          <span className="text-xs text-gray-500">
            按累计佣金排序（Top 10）
          </span>
        }
      >
        <Table
          columns={topDistributorsColumns}
          dataSource={stats.topDistributors}
          rowKey="id"
          pagination={false}
        />
      </Card>

      {/* 近期趋势 */}
      <Card title="近期趋势（最近7天）">
        <Row gutter={[16, 16]}>
          {stats.recentTrends.map((trend) => (
            <Col xs={24} md={12} lg={8} xl={6} key={trend.date}>
              <div
                style={{
                  padding: '16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  backgroundColor: '#f8fafc'
                }}
              >
                <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>
                  {new Date(trend.date).toLocaleDateString('zh-CN', {
                    month: 'numeric',
                    day: 'numeric'
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#475569' }}>新增推广</span>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#06b6d4' }}>
                    {trend.newReferrals}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: '#475569' }}>新增佣金</span>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#10b981' }}>
                    ¥{formatCurrency(trend.newCommission)}
                  </span>
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}
