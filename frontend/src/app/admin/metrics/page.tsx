/**
 * 业务埋点看板页面
 * 艹，这个看板必须实时展示所有关键业务指标！
 *
 * @author 老王
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Table,
  Tag,
  Alert,
  Spin,
  Select,
  DatePicker,
  Space,
  Typography,
  Divider,
  List,
  Tooltip,
  Button,
  message
} from 'antd';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  ReloadOutlined,
  RiseOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  CloudUploadOutlined,
  CameraOutlined,
  ToolOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// 业务指标类型
interface BusinessMetrics {
  chatMetrics: {
    totalRequests: number;
    successRate: number;
    averageResponseTime: number;
    averageTokens: {
      input: number;
      output: number;
    };
  };
  uploadMetrics: {
    totalUploads: number;
    successRate: number;
    averageFileSize: number;
    kbUploadSuccessRate: number;
  };
  commerceMetrics: {
    totalTasks: number;
    averageProcessingTime: number;
    successRate: number;
    toolUsageStats: Record<string, number>;
  };
  toolFailureMetrics: {
    totalOperations: number;
    failureRate: number;
    toolFailureStats: Record<string, {
      failures: number;
      total: number;
      rate: number;
    }>;
  };
  systemMetrics: {
    sessionCount: number;
    activeUsers: number;
    errorRate: number;
    averageSessionDuration: number;
  };
}

interface DashboardData extends BusinessMetrics {
  timeSeriesData: any[];
  popularTools: Array<[string, number]>;
  errorTrends: Array<{ error: string; count: number }>;
  insights: Array<{
    type: 'warning' | 'error' | 'info';
    title: string;
    description: string;
  }>;
}

export default function MetricsDashboard() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardData | null>(null);
  const [timeRange, setTimeRange] = useState('24h');
  const [refreshKey, setRefreshKey] = useState(0);

  // 获取业务指标数据
  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/metrics/business?type=dashboard&timeRange=${timeRange}`);
      const data = await response.json();

      if (data.data) {
        setMetrics(data.data);
      } else {
        message.error('获取业务指标数据失败');
      }
    } catch (error) {
      console.error('获取业务指标失败:', error);
      message.error('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [timeRange, refreshKey]);

  // 手动刷新
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (loading && !metrics) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>加载业务指标中...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2} style={{ margin: 0 }}>
          <RiseOutlined style={{ marginRight: 8, color: '#1890ff' }} />
          业务指标看板
        </Title>

        <Space>
          <Select
            value={timeRange}
            onChange={setTimeRange}
            style={{ width: 120 }}
          >
            <Select.Option value="1h">最近1小时</Select.Option>
            <Select.Option value="24h">最近24小时</Select.Option>
            <Select.Option value="7d">最近7天</Select.Option>
          </Select>

          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={loading}
          >
            刷新
          </Button>
        </Space>
      </div>

      {metrics?.insights && metrics.insights.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          {metrics.insights.map((insight, index) => (
            <Alert
              key={index}
              type={insight.type}
              showIcon
              style={{ marginBottom: 8 }}
              message={insight.title}
              description={insight.description}
            />
          ))}
        </div>
      )}

      {/* 核心指标卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="聊天成功率"
              value={metrics?.chatMetrics.successRate || 0}
              precision={1}
              suffix="%"
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">
                总请求数: {metrics?.chatMetrics.totalRequests || 0}
              </Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="平均响应时间"
              value={metrics?.chatMetrics.averageResponseTime || 0}
              precision={0}
              suffix="ms"
              prefix={<ClockCircleOutlined style={{ color: '#1890ff' }} />}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">
                输入Token: {(metrics?.chatMetrics.averageTokens.input || 0).toFixed(0)}
              </Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="上传成功率"
              value={metrics?.uploadMetrics.successRate || 0}
              precision={1}
              suffix="%"
              prefix={<CloudUploadOutlined style={{ color: '#722ed1' }} />}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">
                KB上传: {(metrics?.uploadMetrics.kbUploadSuccessRate || 0).toFixed(1)}%
              </Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="商拍成功率"
              value={metrics?.commerceMetrics.successRate || 0}
              precision={1}
              suffix="%"
              prefix={<CameraOutlined style={{ color: '#eb2f96' }} />}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">
                平均耗时: {(metrics?.commerceMetrics.averageProcessingTime || 0).toFixed(1)}s
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 图表区域 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        {/* 时间序列图 */}
        <Col xs={24} lg={16}>
          <Card title="活动趋势" extra={<Text type="secondary">按小时统计</Text>}>
            {metrics?.timeSeriesData && (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={metrics.timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="chat"
                    stackId="1"
                    stroke="#1890ff"
                    fill="#1890ff"
                    name="聊天"
                  />
                  <Area
                    type="monotone"
                    dataKey="upload"
                    stackId="1"
                    stroke="#722ed1"
                    fill="#722ed1"
                    name="上传"
                  />
                  <Area
                    type="monotone"
                    dataKey="commerce"
                    stackId="1"
                    stroke="#eb2f96"
                    fill="#eb2f96"
                    name="商拍"
                  />
                  <Area
                    type="monotone"
                    dataKey="tool"
                    stackId="1"
                    stroke="#52c41a"
                    fill="#52c41a"
                    name="工具"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        {/* 工具使用统计 */}
        <Col xs={24} lg={8}>
          <Card title="工具使用统计" extra={<Text type="secondary">TOP 5</Text>}>
            {metrics?.popularTools && (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={metrics.popularTools.map(([name, value]) => ({ name, value }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${name ?? ''} ${(((percent ?? 0) * 100).toFixed(0))}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {metrics.popularTools.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={['#1890ff', '#722ed1', '#eb2f96', '#52c41a', '#faad14'][index % 5]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>

      {/* 详细指标表格 */}
      <Row gutter={[16, 16]}>
        {/* 工具失败率统计 */}
        <Col xs={24} lg={12}>
          <Card title="工具失败率统计" extra={<ToolOutlined style={{ color: '#ff4d4f' }} />}>
            {metrics?.toolFailureMetrics.toolFailureStats && (
              <Table
                dataSource={Object.entries(metrics.toolFailureMetrics.toolFailureStats).map(([tool, stats]) => ({
                  key: tool,
                  tool,
                  total: stats.total,
                  failures: stats.failures,
                  rate: stats.rate
                }))}
                columns={[
                  {
                    title: '工具名称',
                    dataIndex: 'tool',
                    key: 'tool',
                  },
                  {
                    title: '总操作数',
                    dataIndex: 'total',
                    key: 'total',
                    sorter: (a: any, b: any) => a.total - b.total,
                  },
                  {
                    title: '失败数',
                    dataIndex: 'failures',
                    key: 'failures',
                    sorter: (a: any, b: any) => a.failures - b.failures,
                  },
                  {
                    title: '失败率',
                    dataIndex: 'rate',
                    key: 'rate',
                    render: (rate: number) => (
                      <Progress
                        percent={rate}
                        size="small"
                        status={rate > 10 ? 'exception' : rate > 5 ? 'active' : 'success'}
                        format={() => `${rate.toFixed(1)}%`}
                      />
                    ),
                    sorter: (a: any, b: any) => a.rate - b.rate,
                  }
                ]}
                pagination={false}
                size="small"
              />
            )}
          </Card>
        </Col>

        {/* 系统指标 */}
        <Col xs={24} lg={12}>
          <Card title="系统指标" extra={<UserOutlined />}>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="活跃会话"
                  value={metrics?.systemMetrics.sessionCount || 0}
                  prefix={<UserOutlined />}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="活跃用户"
                  value={metrics?.systemMetrics.activeUsers || 0}
                  prefix={<UserOutlined />}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="错误率"
                  value={metrics?.systemMetrics.errorRate || 0}
                  precision={2}
                  suffix="%"
                  prefix={<ExclamationCircleOutlined />}
                  valueStyle={{ color: (metrics?.systemMetrics.errorRate || 0) > 5 ? '#ff4d4f' : '#52c41a' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="平均会话时长"
                  value={(metrics?.systemMetrics.averageSessionDuration || 0) / 1000 / 60}
                  precision={1}
                  suffix="分钟"
                  prefix={<ClockCircleOutlined />}
                />
              </Col>
            </Row>

            <Divider />

            <Title level={5}>错误趋势</Title>
            {metrics?.errorTrends && metrics.errorTrends.length > 0 ? (
              <List
                dataSource={metrics.errorTrends.slice(0, 5)}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
                      title={<Text style={{ fontSize: 12 }}>{item.error}</Text>}
                      description={<Text type="secondary">发生 {item.count} 次</Text>}
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Text type="secondary">暂无错误记录</Text>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
