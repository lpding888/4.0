/**
 * ADMIN-P1-OPS-110 队列监控
 * 艹，这个队列监控必须实时显示队列状态，支持重试和清理操作！
 *
 * @author 老王
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Tag,
  Typography,
  Row,
  Col,
  Divider,
  Popconfirm,
  message,
  Tabs,
  Progress,
  Statistic,
  Alert,
  Tooltip,
  Badge,
  Drawer,
  Form,
  Input,
  Select,
  InputNumber,
  Timeline,
  List,
  Avatar
} from 'antd';
import {
  ReloadOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  DeleteOutlined,
  RedoOutlined,
  ClearOutlined,
  EyeOutlined,
  SettingOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  FilterOutlined,
  SearchOutlined,
  ExportOutlined,
  DashboardOutlined,
  BarChartOutlined,
  LineChartOutlined
} from '@ant-design/icons';
import { ColumnsType } from 'antd/es/table';
import { useSSE } from '@/hooks/useSSE';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { TextArea } = Input;

// 队列状态接口
interface QueueStatus {
  id: string;
  name: string;
  type: 'processing' | 'waiting' | 'completed' | 'failed' | 'delayed';
  count: number;
  isActive: boolean;
  concurrency: number;
  processed: number;
  failed: number;
  avgProcessingTime: number;
  lastActivity: string;
}

// 任务详情接口
interface TaskDetail {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'completed' | 'failed' | 'delayed' | 'waiting';
  progress: number;
  data: any;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  processedAt?: string;
  completedAt?: string;
  failedAt?: string;
  errorMessage?: string;
  processingTime?: number;
  priority: number;
  delay?: number;
}

// 队列统计接口
interface QueueStats {
  totalQueues: number;
  activeQueues: number;
  totalTasks: number;
  processingTasks: number;
  waitingTasks: number;
  completedTasks: number;
  failedTasks: number;
  successRate: number;
  avgProcessingTime: number;
  throughput: number;
}

// 模拟数据
const mockQueueStatus: QueueStatus[] = [
  {
    id: 'queue_001',
    name: 'ai-generation',
    type: 'processing',
    count: 15,
    isActive: true,
    concurrency: 5,
    processed: 1250,
    failed: 23,
    avgProcessingTime: 8.5,
    lastActivity: '2025-11-03T10:30:00Z'
  },
  {
    id: 'queue_002',
    name: 'image-processing',
    type: 'waiting',
    count: 32,
    isActive: true,
    concurrency: 3,
    processed: 890,
    failed: 12,
    avgProcessingTime: 12.3,
    lastActivity: '2025-11-03T10:28:00Z'
  },
  {
    id: 'queue_003',
    name: 'batch-upload',
    type: 'completed',
    count: 0,
    isActive: false,
    concurrency: 2,
    processed: 456,
    failed: 5,
    avgProcessingTime: 6.7,
    lastActivity: '2025-11-03T09:45:00Z'
  },
  {
    id: 'queue_004',
    name: 'notification',
    type: 'failed',
    count: 8,
    isActive: true,
    concurrency: 10,
    processed: 2340,
    failed: 156,
    avgProcessingTime: 2.1,
    lastActivity: '2025-11-03T10:32:00Z'
  }
];

const mockTasks: TaskDetail[] = [
  {
    id: 'task_001',
    name: 'AI商品图生成',
    type: 'ai-generation',
    status: 'active',
    progress: 65,
    data: { tool: 'product-shoot', parameters: { count: 4, style: 'natural' } },
    attempts: 1,
    maxAttempts: 3,
    createdAt: '2025-11-03T10:25:00Z',
    processedAt: '2025-11-03T10:26:00Z',
    priority: 1,
    processingTime: 45000
  },
  {
    id: 'task_002',
    name: '服装换色处理',
    type: 'image-processing',
    status: 'failed',
    progress: 100,
    data: { tool: 'recolor', color: '#FF0000' },
    attempts: 3,
    maxAttempts: 3,
    createdAt: '2025-11-03T10:20:00Z',
    processedAt: '2025-11-03T10:22:00Z',
    failedAt: '2025-11-03T10:32:00Z',
    errorMessage: 'Color transformation failed: Invalid color format',
    processingTime: 72000,
    priority: 2
  },
  {
    id: 'task_003',
    name: '批量图片上传',
    type: 'batch-upload',
    status: 'completed',
    progress: 100,
    data: { files: 25, target: 'cos-bucket' },
    attempts: 1,
    maxAttempts: 3,
    createdAt: '2025-11-03T09:40:00Z',
    processedAt: '2025-11-03T09:41:00Z',
    completedAt: '2025-11-03T09:45:00Z',
    processingTime: 240000,
    priority: 3
  },
  {
    id: 'task_004',
    name: '邮件通知发送',
    type: 'notification',
    status: 'waiting',
    progress: 0,
    data: { recipients: 150, template: 'task-completed' },
    attempts: 0,
    maxAttempts: 5,
    createdAt: '2025-11-03T10:33:00Z',
    priority: 1,
    delay: 5000
  }
];

export default function QueuesMonitorPage() {
  // 状态管理
  const [queues, setQueues] = useState<QueueStatus[]>(mockQueueStatus);
  const [tasks, setTasks] = useState<TaskDetail[]>(mockTasks);
  const [selectedQueue, setSelectedQueue] = useState<QueueStatus | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [taskDrawerVisible, setTaskDrawerVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // SSE连接
  const { connect, disconnect, isConnected } = useSSE();

  // 自动刷新
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchQueueData();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // 获取队列数据
  const fetchQueueData = async () => {
    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 500));

      // 这里应该调用真实API
      console.log('Fetching queue data...');
    } catch (error) {
      console.error('Failed to fetch queue data:', error);
    }
  };

  // 计算统计数据
  const calculateStats = (): QueueStats => {
    const totalTasks = tasks.length;
    const processingTasks = tasks.filter(t => t.status === 'active').length;
    const waitingTasks = tasks.filter(t => t.status === 'waiting').length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const failedTasks = tasks.filter(t => t.status === 'failed').length;

    const successRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    const avgProcessingTime = tasks.reduce((sum, task) =>
      sum + (task.processingTime || 0), 0) / Math.max(completedTasks, 1);

    return {
      totalQueues: queues.length,
      activeQueues: queues.filter(q => q.isActive).length,
      totalTasks,
      processingTasks,
      waitingTasks,
      completedTasks,
      failedTasks,
      successRate,
      avgProcessingTime: avgProcessingTime / 1000, // 转换为秒
      throughput: completedTasks / 60 // 每分钟处理量
    };
  };

  const stats = calculateStats();

  // 队列表格配置
  const queueColumns: ColumnsType<QueueStatus> = [
    {
      title: '队列名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>ID: {record.id}</Text>
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'type',
      key: 'type',
      render: (type, record) => (
        <div>
          <Badge
            status={record.isActive ? 'success' : 'default'}
            text={record.isActive ? '运行中' : '已停止'}
          />
          <br />
          <Tag color={getQueueTypeColor(type)} style={{ marginTop: 4 }}>
            {getQueueTypeName(type)}
          </Tag>
        </div>
      )
    },
    {
      title: '任务数量',
      dataIndex: 'count',
      key: 'count',
      render: (count) => (
        <Statistic value={count} valueStyle={{ fontSize: 16 }} />
      )
    },
    {
      title: '并发数',
      dataIndex: 'concurrency',
      key: 'concurrency',
      render: (concurrency) => <Text>{concurrency}</Text>
    },
    {
      title: '已处理/失败',
      key: 'processed',
      render: (_, record) => (
        <div>
          <Text type="success">{record.processed}</Text>
          <Text> / </Text>
          <Text type="danger">{record.failed}</Text>
        </div>
      )
    },
    {
      title: '平均耗时',
      dataIndex: 'avgProcessingTime',
      key: 'avgProcessingTime',
      render: (time) => <Text>{time}s</Text>
    },
    {
      title: '最后活动',
      dataIndex: 'lastActivity',
      key: 'lastActivity',
      render: (date) => (
        <Tooltip title={new Date(date).toLocaleString()}>
          <Text>{getRelativeTime(date)}</Text>
        </Tooltip>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              size="small"
              onClick={() => handleViewQueueDetails(record)}
            />
          </Tooltip>
          <Tooltip title={record.isActive ? '暂停' : '启动'}>
            <Button
              type="text"
              icon={record.isActive ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              size="small"
              onClick={() => handleToggleQueue(record)}
            />
          </Tooltip>
          <Tooltip title="清理队列">
            <Popconfirm
              title="确定清理这个队列吗？这将移除所有等待中的任务。"
              onConfirm={() => handleClearQueue(record.id)}
            >
              <Button type="text" icon={<ClearOutlined />} size="small" />
            </Popconfirm>
          </Tooltip>
        </Space>
      )
    }
  ];

  // 任务表格配置
  const taskColumns: ColumnsType<TaskDetail> = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            类型: {record.type} | 优先级: {record.priority}
          </Text>
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => (
        <div>
          <Badge
            status={getStatusBadgeType(status)}
            text={getStatusName(status)}
          />
          {record.progress > 0 && status === 'active' && (
            <Progress
              percent={record.progress}
              size="small"
              style={{ marginTop: 4 }}
            />
          )}
        </div>
      )
    },
    {
      title: '重试次数',
      key: 'attempts',
      render: (_, record) => (
        <Text>
          {record.attempts} / {record.maxAttempts}
        </Text>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => (
        <Tooltip title={new Date(date).toLocaleString()}>
          <Text>{getRelativeTime(date)}</Text>
        </Tooltip>
      )
    },
    {
      title: '处理时间',
      dataIndex: 'processingTime',
      key: 'processingTime',
      render: (time) => time ? <Text>{(time / 1000).toFixed(1)}s</Text> : '-'
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              size="small"
              onClick={() => handleViewTaskDetails(record)}
            />
          </Tooltip>
          {record.status === 'failed' && (
            <Tooltip title="重试">
              <Button
                type="text"
                icon={<RedoOutlined />}
                size="small"
                onClick={() => handleRetryTask(record.id)}
              />
            </Tooltip>
          )}
          <Tooltip title="删除">
            <Popconfirm
              title="确定删除这个任务吗？"
              onConfirm={() => handleDeleteTask(record.id)}
            >
              <Button type="text" danger icon={<DeleteOutlined />} size="small" />
            </Popconfirm>
          </Tooltip>
        </Space>
      )
    }
  ];

  // 辅助函数
  const getQueueTypeColor = (type: string) => {
    const colorMap: Record<string, string> = {
      processing: 'blue',
      waiting: 'orange',
      completed: 'green',
      failed: 'red',
      delayed: 'purple'
    };
    return colorMap[type] || 'default';
  };

  const getQueueTypeName = (type: string) => {
    const nameMap: Record<string, string> = {
      processing: '处理中',
      waiting: '等待中',
      completed: '已完成',
      failed: '失败',
      delayed: '延迟'
    };
    return nameMap[type] || type;
  };

  const getStatusBadgeType = (status: string) => {
    const typeMap: Record<string, 'success' | 'processing' | 'error' | 'warning' | 'default'> = {
      active: 'processing',
      completed: 'success',
      failed: 'error',
      waiting: 'warning',
      delayed: 'default'
    };
    return typeMap[status] || 'default';
  };

  const getStatusName = (status: string) => {
    const nameMap: Record<string, string> = {
      active: '处理中',
      completed: '已完成',
      failed: '失败',
      waiting: '等待中',
      delayed: '延迟'
    };
    return nameMap[status] || status;
  };

  const getRelativeTime = (date: string) => {
    const now = new Date();
    const past = new Date(date);
    const diffInMinutes = Math.floor((now.getTime() - past.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return '刚刚';
    if (diffInMinutes < 60) return `${diffInMinutes}分钟前`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}小时前`;
    return `${Math.floor(diffInMinutes / 1440)}天前`;
  };

  // 事件处理函数
  const handleViewQueueDetails = (queue: QueueStatus) => {
    setSelectedQueue(queue);
    // 筛选该队列的任务
    const queueTasks = tasks.filter(task => task.type === queue.name);
    setTasks(queueTasks);
  };

  const handleToggleQueue = async (queue: QueueStatus) => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      setQueues(prev => prev.map(q =>
        q.id === queue.id ? { ...q, isActive: !q.isActive } : q
      ));

      message.success(`队列 ${queue.name} 已${queue.isActive ? '暂停' : '启动'}`);
    } catch (error) {
      message.error('操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClearQueue = async (queueId: string) => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      setTasks(prev => prev.filter(task => task.type !== queueId));
      message.success('队列已清理');
    } catch (error) {
      message.error('清理失败');
    } finally {
      setLoading(false);
    }
  };

  const handleViewTaskDetails = (task: TaskDetail) => {
    setSelectedTask(task);
    setTaskDrawerVisible(true);
  };

  const handleRetryTask = async (taskId: string) => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      setTasks(prev => prev.map(task =>
        task.id === taskId
          ? { ...task, status: 'waiting', attempts: 0, errorMessage: undefined }
          : task
      ));

      message.success('任务已重新加入队列');
    } catch (error) {
      message.error('重试失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));

      setTasks(prev => prev.filter(task => task.id !== taskId));
      message.success('任务已删除');
    } catch (error) {
      message.error('删除失败');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkRetry = async () => {
    const failedTasks = tasks.filter(task => task.status === 'failed');
    if (failedTasks.length === 0) {
      message.info('没有失败的任务需要重试');
      return;
    }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));

      setTasks(prev => prev.map(task =>
        task.status === 'failed'
          ? { ...task, status: 'waiting', attempts: 0, errorMessage: undefined }
          : task
      ));

      message.success(`已重试 ${failedTasks.length} 个失败任务`);
    } catch (error) {
      message.error('批量重试失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>队列监控</Title>
        <Text type="secondary">
          实时监控所有队列状态，支持任务重试、队列清理等运维操作
        </Text>
      </div>

      {/* 统计概览 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃队列"
              value={stats.activeQueues}
              suffix={`/ ${stats.totalQueues}`}
              prefix={<DashboardOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="处理中任务"
              value={stats.processingTasks}
              valueStyle={{ color: '#1890ff' }}
              prefix={<PlayCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="成功率"
              value={stats.successRate}
              precision={1}
              suffix="%"
              valueStyle={{ color: stats.successRate > 90 ? '#3f8600' : '#cf1322' }}
              prefix={<BarChartOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="吞吐量"
              value={stats.throughput}
              precision={1}
              suffix="/min"
              prefix={<LineChartOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={fetchQueueData}
            >
              刷新数据
            </Button>
            <Button
              type={autoRefresh ? 'primary' : 'default'}
              icon={<ClockCircleOutlined />}
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? '自动刷新: 开启' : '自动刷新: 关闭'}
            </Button>
            <Button
              icon={<RedoOutlined />}
              onClick={handleBulkRetry}
              loading={loading}
            >
              重试所有失败任务
            </Button>
            <Button icon={<SettingOutlined />} onClick={() => setSettingsModalVisible(true)}>
              设置
            </Button>
            <Button icon={<ExportOutlined />}>
              导出报告
            </Button>
          </Space>
        </div>

        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="队列概览" key="overview">
            <Table
              columns={queueColumns}
              dataSource={queues}
              rowKey="id"
              loading={loading}
              pagination={false}
            />
          </TabPane>
          <TabPane tab={`任务列表 (${tasks.length})`} key="tasks">
            <Table
              columns={taskColumns}
              dataSource={tasks}
              rowKey="id"
              loading={loading}
              pagination={{
                total: tasks.length,
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `显示 ${range[0]}-${range[1]} 条，共 ${total} 条任务`
              }}
            />
          </TabPane>
        </Tabs>
      </Card>

      {/* 任务详情抽屉 */}
      <Drawer
        title="任务详情"
        placement="right"
        size="large"
        onClose={() => setTaskDrawerVisible(false)}
        open={taskDrawerVisible}
      >
        {selectedTask && (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Text strong>任务ID:</Text>
                <br />
                <Text code>{selectedTask.id}</Text>
              </Col>
              <Col span={12}>
                <Text strong>状态:</Text>
                <br />
                <Badge
                  status={getStatusBadgeType(selectedTask.status)}
                  text={getStatusName(selectedTask.status)}
                />
              </Col>
            </Row>

            <Divider />

            <div style={{ marginBottom: 16 }}>
              <Text strong>任务数据:</Text>
              <pre style={{
                background: '#f5f5f5',
                padding: 12,
                borderRadius: 4,
                marginTop: 8,
                fontSize: 12,
                overflow: 'auto'
              }}>
                {JSON.stringify(selectedTask.data, null, 2)}
              </pre>
            </div>

            {selectedTask.errorMessage && (
              <Alert
                message="错误信息"
                description={selectedTask.errorMessage}
                type="error"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            <div>
              <Text strong>执行时间线:</Text>
              <Timeline style={{ marginTop: 16 }}>
                <Timeline.Item color="blue">
                  任务创建 - {new Date(selectedTask.createdAt).toLocaleString()}
                </Timeline.Item>
                {selectedTask.processedAt && (
                  <Timeline.Item color="green">
                    开始处理 - {new Date(selectedTask.processedAt).toLocaleString()}
                  </Timeline.Item>
                )}
                {selectedTask.completedAt && (
                  <Timeline.Item color="green">
                    完成处理 - {new Date(selectedTask.completedAt).toLocaleString()}
                  </Timeline.Item>
                )}
                {selectedTask.failedAt && (
                  <Timeline.Item color="red">
                    处理失败 - {new Date(selectedTask.failedAt).toLocaleString()}
                  </Timeline.Item>
                )}
              </Timeline>
            </div>
          </div>
        )}
      </Drawer>

      {/* 设置Modal */}
      <Modal
        title="队列设置"
        open={settingsModalVisible}
        onCancel={() => setSettingsModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setSettingsModalVisible(false)}>
            取消
          </Button>,
          <Button key="save" type="primary" onClick={() => setSettingsModalVisible(false)}>
            保存设置
          </Button>
        ]}
      >
        <Form layout="vertical">
          <Form.Item label="默认并发数">
            <InputNumber min={1} max={20} defaultValue={5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="最大重试次数">
            <InputNumber min={1} max={10} defaultValue={3} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="任务超时时间(秒)">
            <InputNumber min={30} max={3600} defaultValue={300} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="自动刷新间隔(秒)">
            <InputNumber min={1} max={60} defaultValue={5} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
