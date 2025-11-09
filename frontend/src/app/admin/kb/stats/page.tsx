/**
 * PAGE-P0-KB-002 知识库管理 - 统计页面
 * 艹，必须做好队列统计、检索测试和性能监控！
 *
 * 功能清单：
 * 1. 队列处理统计（实时更新）
 * 2. 检索测试功能（topK可调）
 * 3. 处理性能监控
 * 4. 错误统计和分析
 * 5. 系统健康状态
 * 6. 知识库使用情况统计
 *
 * @author 老王
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Table,
  Button,
  Input,
  Space,
  Tag,
  Alert,
  Typography,
  Tabs,
  List,
  Avatar,
  Timeline,
  Empty,
  Spin,
  message,
  Form,
  InputNumber,
  Select,
  Badge
} from 'antd';
import {
  BarChartOutlined,
  SearchOutlined,
  DatabaseOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FireOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
  ApiOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { MSWInitializer } from '@/components/MSWInitializer';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { TextArea } = Input;

// 队列统计数据
interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  avgProcessingTime: number;
  throughput: number;
}

// 系统统计
interface SystemStats {
  totalDocuments: number;
  totalChunks: number;
  totalSize: number;
  avgChunksPerDoc: number;
  processingRate: number;
  successRate: number;
}

// 处理记录
interface ProcessingRecord {
  id: string;
  documentName: string;
  status: 'processing' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  duration?: number;
  chunks: number;
  error?: string;
}

// 检索测试结果
interface SearchResult {
  content: string;
  score: number;
  documentName: string;
  chunkIndex: number;
  metadata?: any;
}

export default function KBStatsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState('overview');

  const queryClient = useQueryClient();

  // 获取队列统计
  const { data: queueStats, isLoading: queueLoading } = useQuery({
    queryKey: ['queue-stats'],
    queryFn: async () => {
      const response = await api.get('/admin/kb/queue-stats');
      return response.data;
    },
    refetchInterval: 5000, // 5秒刷新一次
  });

  // 获取系统统计
  const { data: systemStats, isLoading: systemLoading } = useQuery({
    queryKey: ['system-stats'],
    queryFn: async () => {
      const response = await api.get('/admin/kb/system-stats');
      return response.data;
    },
    refetchInterval: 10000, // 10秒刷新一次
  });

  // 获取处理记录
  const { data: processingRecords, isLoading: recordsLoading } = useQuery({
    queryKey: ['processing-records'],
    queryFn: async () => {
      const response = await api.get('/admin/kb/processing-records');
      return response.data;
    },
    refetchInterval: 3000, // 3秒刷新一次
  });

  // 检索测试
  const searchMutation = useMutation({
    mutationFn: async (params: { query: string; topK: number; threshold: number }) => {
      const response = await api.post('/admin/kb/search', params);
      return response.data;
    },
    onSuccess: (data) => {
      setSearchResults(data.results || []);
      message.success(`找到 ${data.results?.length || 0} 条相关内容`);
    },
    onError: (error: any) => {
      message.error(`检索失败: ${error.message}`);
      setSearchResults([]);
    },
  });

  // 执行检索测试
  const handleSearch = () => {
    const values = searchForm.getFieldsValue();
    if (!values.query?.trim()) {
      message.warning('请输入检索内容');
      return;
    }

    searchMutation.mutate({
      query: values.query.trim(),
      topK: values.topK || 5,
      threshold: values.threshold || 0.7
    });
  };

  // 格式化时间
  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleString('zh-CN');
  };

  // 格式化持续时间
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    switch (status) {
      case 'completed':
        return <Tag color="success" icon={<CheckCircleOutlined />}>已完成</Tag>;
      case 'processing':
        return <Tag color="processing" icon={<ClockCircleOutlined />}>处理中</Tag>;
      case 'failed':
        return <Tag color="error" icon={<ExclamationCircleOutlined />}>失败</Tag>;
      default:
        return <Tag>未知</Tag>;
    }
  };

  // 处理记录表格列
  const recordColumns: ColumnsType<ProcessingRecord> = [
    {
      title: '文档名称',
      dataIndex: 'documentName',
      key: 'documentName',
      ellipsis: true,
      render: (text: string) => (
        <Space>
          <FileTextOutlined />
          <Text>{text}</Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 180,
      render: (time: string) => (
        <Text type="secondary">{formatTime(time)}</Text>
      ),
    },
    {
      title: '处理时长',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: (duration?: number) => (
        duration ? <Text>{formatDuration(duration)}</Text> : '-'
      ),
    },
    {
      title: '分块数',
      dataIndex: 'chunks',
      key: 'chunks',
      width: 80,
      render: (chunks: number) => (
        <Badge count={chunks} style={{ backgroundColor: '#52c41a' }} />
      ),
    },
    {
      title: '错误信息',
      dataIndex: 'error',
      key: 'error',
      ellipsis: true,
      render: (error?: string) => (
        error ? <Text type="danger">{error}</Text> : '-'
      ),
    },
  ];

  const queueData = queueStats?.data || {};
  const systemData = systemStats?.data || {};
  const records = processingRecords?.data || [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <MSWInitializer />

      {/* 页面头部 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <BarChartOutlined className="text-3xl text-blue-600" />
            <div>
              <Title level={2} className="mb-1">知识库统计</Title>
              <Text type="secondary">监控知识库处理状态和检索性能</Text>
            </div>
          </div>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => queryClient.invalidateQueries()}
            >
              刷新数据
            </Button>
            <Button
              onClick={() => window.location.href = '/admin/kb'}
            >
              返回列表
            </Button>
          </Space>
        </div>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        {/* 概览标签页 */}
        <TabPane tab="系统概览" key="overview">
          {/* 队列统计 */}
          <Card title="队列处理状态" className="mb-6">
            <Row gutter={16}>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="等待处理"
                    value={queueData.pending || 0}
                    valueStyle={{ color: '#1890ff' }}
                    prefix={<ClockCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="处理中"
                    value={queueData.processing || 0}
                    valueStyle={{ color: '#faad14' }}
                    prefix={<ThunderboltOutlined />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="已完成"
                    value={queueData.completed || 0}
                    valueStyle={{ color: '#52c41a' }}
                    prefix={<CheckCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="处理失败"
                    value={queueData.failed || 0}
                    valueStyle={{ color: '#f5222d' }}
                    prefix={<ExclamationCircleOutlined />}
                  />
                </Card>
              </Col>
            </Row>

            <Row gutter={16} className="mt-4">
              <Col span={8}>
                <Card>
                  <Statistic
                    title="平均处理时间"
                    value={queueData.avgProcessingTime || 0}
                    suffix="秒"
                    precision={1}
                    valueStyle={{ color: '#722ed1' }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="处理吞吐量"
                    value={queueData.throughput || 0}
                    suffix="文档/小时"
                    precision={1}
                    valueStyle={{ color: '#eb2f96' }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <div className="text-center">
                    <div className="text-gray-500 mb-2">成功率</div>
                    <Progress
                      type="circle"
                      percent={systemData.successRate || 0}
                      size={80}
                      format={percent => `${percent}%`}
                    />
                  </div>
                </Card>
              </Col>
            </Row>
          </Card>

          {/* 系统统计 */}
          <Card title="知识库统计">
            <Row gutter={16}>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="总文档数"
                    value={systemData.totalDocuments || 0}
                    prefix={<FileTextOutlined />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="总知识块"
                    value={systemData.totalChunks || 0}
                    prefix={<DatabaseOutlined />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="总存储大小"
                    value={systemData.totalSize || 0}
                    formatter={(value) => formatFileSize(Number(value))}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="平均分块数"
                    value={systemData.avgChunksPerDoc || 0}
                    precision={1}
                  />
                </Card>
              </Col>
            </Row>

            {queueData.processing > 0 && (
              <Alert
                message="系统繁忙"
                description={`当前有 ${queueData.processing} 个文档正在处理中，请耐心等待。`}
                type="info"
                showIcon
                className="mt-4"
              />
            )}
          </Card>
        </TabPane>

        {/* 处理记录标签页 */}
        <TabPane tab="处理记录" key="records">
          <Card title="最近处理记录">
            <Table
              columns={recordColumns}
              dataSource={records}
              rowKey="id"
              loading={recordsLoading}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showQuickJumper: true,
              }}
              scroll={{ x: 800 }}
            />
          </Card>
        </TabPane>

        {/* 检索测试标签页 */}
        <TabPane tab="检索测试" key="search">
          <Card title="知识库检索测试" className="mb-6">
            <Form form={searchForm} layout="inline">
              <Form.Item
                name="query"
                rules={[{ required: true, message: '请输入检索内容' }]}
              >
                <TextArea
                  placeholder="输入要检索的内容，系统将在知识库中查找相关信息..."
                  style={{ width: 400 }}
                  rows={3}
                />
              </Form.Item>
              <Form.Item name="topK" label="返回数量" initialValue={5}>
                <InputNumber min={1} max={20} />
              </Form.Item>
              <Form.Item name="threshold" label="相似度阈值" initialValue={0.7}>
                <InputNumber min={0.1} max={1} step={0.1} />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  icon={<SearchOutlined />}
                  onClick={handleSearch}
                  loading={searchMutation.isPending}
                >
                  开始检索
                </Button>
              </Form.Item>
            </Form>
          </Card>

          {/* 检索结果 */}
          {searchResults.length > 0 && (
            <Card title={`检索结果 (${searchResults.length} 条)`}>
              <List
                dataSource={searchResults}
                renderItem={(item, index) => (
                  <List.Item key={index}>
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          style={{
                            backgroundColor: '#1890ff',
                            verticalAlign: 'middle'
                          }}
                          size="large"
                        >
                          {index + 1}
                        </Avatar>
                      }
                      title={
                        <Space>
                          <Text strong>相似度: {(item.score * 100).toFixed(1)}%</Text>
                          <Tag color="blue">{item.documentName}</Tag>
                          <Tag color="default">分块 {item.chunkIndex + 1}</Tag>
                        </Space>
                      }
                      description={
                        <div>
                          <Paragraph ellipsis={{ rows: 3, expandable: true }}>
                            {item.content}
                          </Paragraph>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          )}

          {searchResults.length === 0 && searchMutation.isPending && (
            <Card>
              <div className="text-center py-8">
                <Spin size="large" />
                <div className="mt-4">
                  <Text>正在检索中...</Text>
                </div>
              </div>
            </Card>
          )}

          {searchResults.length === 0 && !searchMutation.isPending && searchMutation.data && (
            <Card>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="未找到相关内容"
              >
                <Button type="primary" onClick={() => setSearchQuery('')}>
                  重新检索
                </Button>
              </Empty>
            </Card>
          )}
        </TabPane>
      </Tabs>
    </div>
  );
}
