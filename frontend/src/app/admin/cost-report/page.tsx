'use client';

/**
 * Provider成本报表页面
 * 艹！实时统计Provider调用成本，支持CSV导出！
 *
 * @author 老王
 */

import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Button, DatePicker, Space, Divider, message } from 'antd';
import {
  DollarOutlined,
  ThunderboltOutlined,
  ApiOutlined,
  DownloadOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { ColumnType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';

import { providerRouter, CostReport } from '@/lib/services/providerRouter';
import { QualityTier } from '@/lib/services/adminProviders';

const { RangePicker } = DatePicker;

/**
 * Provider成本明细行
 */
interface ProviderCostRow {
  key: string;
  provider_ref: string;
  provider_name: string;
  quality_tier: QualityTier;
  cost: number;
  tokens: number;
  call_count: number;
  success_rate: number;
}

/**
 * 档位成本明细行
 */
interface TierCostRow {
  key: string;
  tier: QualityTier;
  cost: number;
  tokens: number;
  call_count: number;
}

export default function CostReportPage() {
  // 日期范围（默认最近7天）
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(7, 'days'),
    dayjs(),
  ]);

  // 成本报表数据
  const [report, setReport] = useState<CostReport | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * 加载成本报表
   */
  const loadCostReport = () => {
    setLoading(true);
    try {
      const startDate = dateRange[0].toISOString();
      const endDate = dateRange[1].toISOString();

      const reportData = providerRouter.generateCostReport(startDate, endDate);
      setReport(reportData);
    } catch (error: any) {
      message.error(`加载报表失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 导出CSV
   */
  const handleExportCSV = () => {
    if (!report) {
      message.warning('没有可导出的数据');
      return;
    }

    try {
      const csv = providerRouter.exportCostReportCSV(report);

      // 创建Blob并下载
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cost-report-${dayjs().format('YYYYMMDD-HHmmss')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      message.success('成本报表已导出');
    } catch (error: any) {
      message.error(`导出失败: ${error.message}`);
    }
  };

  // 初始加载
  useEffect(() => {
    loadCostReport();
  }, []);

  // Provider明细表格列
  const providerColumns: ColumnType<ProviderCostRow>[] = [
    {
      title: 'Provider引用ID',
      dataIndex: 'provider_ref',
      key: 'provider_ref',
      width: 200,
      render: (text: string) => <code style={{ color: '#1890ff' }}>{text}</code>,
    },
    {
      title: 'Provider名称',
      dataIndex: 'provider_name',
      key: 'provider_name',
      width: 200,
    },
    {
      title: '质量档位',
      dataIndex: 'quality_tier',
      key: 'quality_tier',
      width: 120,
      render: (tier: QualityTier) => {
        const tierMap = {
          low: { label: '低画质', color: '#666' },
          medium: { label: '中画质', color: '#1890ff' },
          high: { label: '高画质', color: '#faad14' },
        };
        const config = tierMap[tier];
        return <span style={{ color: config.color }}>{config.label}</span>;
      },
    },
    {
      title: '成本（美元）',
      dataIndex: 'cost',
      key: 'cost',
      width: 150,
      sorter: (a, b) => a.cost - b.cost,
      render: (cost: number) => <span style={{ fontWeight: 600 }}>${cost.toFixed(4)}</span>,
    },
    {
      title: 'Token数',
      dataIndex: 'tokens',
      key: 'tokens',
      width: 150,
      sorter: (a, b) => a.tokens - b.tokens,
      render: (tokens: number) => tokens.toLocaleString(),
    },
    {
      title: '调用次数',
      dataIndex: 'call_count',
      key: 'call_count',
      width: 120,
      sorter: (a, b) => a.call_count - b.call_count,
    },
    {
      title: '成功率',
      dataIndex: 'success_rate',
      key: 'success_rate',
      width: 120,
      sorter: (a, b) => a.success_rate - b.success_rate,
      render: (rate: number) => {
        const percentage = (rate * 100).toFixed(2);
        const color = rate >= 0.95 ? '#52c41a' : rate >= 0.8 ? '#faad14' : '#ff4d4f';
        return <span style={{ color, fontWeight: 600 }}>{percentage}%</span>;
      },
    },
  ];

  // 档位汇总表格列
  const tierColumns: ColumnType<TierCostRow>[] = [
    {
      title: '质量档位',
      dataIndex: 'tier',
      key: 'tier',
      width: 150,
      render: (tier: QualityTier) => {
        const tierMap = {
          low: { label: '低画质', color: '#666' },
          medium: { label: '中画质', color: '#1890ff' },
          high: { label: '高画质', color: '#faad14' },
        };
        const config = tierMap[tier];
        return <span style={{ color: config.color, fontWeight: 600 }}>{config.label}</span>;
      },
    },
    {
      title: '成本（美元）',
      dataIndex: 'cost',
      key: 'cost',
      width: 200,
      sorter: (a, b) => a.cost - b.cost,
      render: (cost: number) => <span style={{ fontWeight: 600, fontSize: 16 }}>${cost.toFixed(4)}</span>,
    },
    {
      title: 'Token数',
      dataIndex: 'tokens',
      key: 'tokens',
      width: 200,
      sorter: (a, b) => a.tokens - b.tokens,
      render: (tokens: number) => <span style={{ fontWeight: 600 }}>{tokens.toLocaleString()}</span>,
    },
    {
      title: '调用次数',
      dataIndex: 'call_count',
      key: 'call_count',
      width: 150,
      sorter: (a, b) => a.call_count - b.call_count,
      render: (count: number) => <span style={{ fontWeight: 600 }}>{count}</span>,
    },
  ];

  // Provider明细数据
  const providerData: ProviderCostRow[] = report
    ? report.provider_breakdown.map((p, index) => ({
        key: `${p.provider_ref}_${p.quality_tier}_${index}`,
        ...p,
      }))
    : [];

  // 档位汇总数据
  const tierData: TierCostRow[] = report
    ? report.tier_breakdown.map((t, index) => ({
        key: `${t.tier}_${index}`,
        ...t,
      }))
    : [];

  return (
    <div style={{ padding: '24px' }}>
      {/* 标题和操作栏 */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Provider成本报表</h2>
        <Space>
          <RangePicker
            value={dateRange}
            onChange={(dates) => dates && setDateRange(dates as [Dayjs, Dayjs])}
            format="YYYY-MM-DD"
            allowClear={false}
          />
          <Button icon={<ReloadOutlined />} onClick={loadCostReport} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExportCSV}
            disabled={!report}
          >
            导出CSV
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="总成本"
              value={report?.total_cost || 0}
              prefix={<DollarOutlined />}
              suffix="美元"
              precision={4}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="总Token数"
              value={report?.total_tokens || 0}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="调用次数"
              value={
                report
                  ? report.provider_breakdown.reduce((sum, p) => sum + p.call_count, 0)
                  : 0
              }
              prefix={<ApiOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 档位汇总 */}
      <Card
        title="按档位汇总"
        style={{ marginBottom: 24 }}
        extra={
          <span style={{ fontSize: 12, color: '#666' }}>
            时间范围: {report?.time_range.start ? dayjs(report.time_range.start).format('YYYY-MM-DD') : '-'} ~{' '}
            {report?.time_range.end ? dayjs(report.time_range.end).format('YYYY-MM-DD') : '-'}
          </span>
        }
      >
        <Table
          columns={tierColumns}
          dataSource={tierData}
          pagination={false}
          loading={loading}
          size="middle"
        />
      </Card>

      {/* Provider明细 */}
      <Card title="Provider调用明细" style={{ marginBottom: 24 }}>
        <Table
          columns={providerColumns}
          dataSource={providerData}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
          loading={loading}
          size="middle"
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 艹！数据说明 */}
      <Card title="数据说明" size="small">
        <div style={{ fontSize: 13, color: '#666', lineHeight: 1.8 }}>
          <p>1. <strong>成本计算</strong>：基于Provider的 cost_per_1k_tokens 配置和实际Token使用量计算。</p>
          <p>2. <strong>时间范围</strong>：默认显示最近7天数据，可自定义时间范围。</p>
          <p>3. <strong>数据来源</strong>：前端内存中的使用记录（最多保留1万条），生产环境建议后端持久化。</p>
          <p>4. <strong>导出格式</strong>：CSV格式，可用Excel或其他工具打开分析。</p>
          <p>5. <strong>成功率</strong>：Provider调用成功次数 / 总调用次数，用于评估Provider稳定性。</p>
        </div>
      </Card>
    </div>
  );
}
