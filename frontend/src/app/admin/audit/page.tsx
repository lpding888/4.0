'use client';

/**
 * 审计日志查询页面
 * 艹！这个页面让管理员查看所有操作记录！
 *
 * @author 老王
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  DatePicker,
  Select,
  Input,
  message,
  Typography,
  Row,
  Col,
  Statistic,
  Badge,
} from 'antd';
import {
  FileTextOutlined,
  DownloadOutlined,
  SearchOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { ColumnType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import type { AuditEvent, AuditEventType } from '@/lib/audit/tracker';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

/**
 * 事件类型配置
 */
const EVENT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  'user.login': { label: '用户登录', color: 'blue' },
  'user.logout': { label: '用户登出', color: 'default' },
  'user.create': { label: '创建用户', color: 'green' },
  'user.update': { label: '更新用户', color: 'orange' },
  'user.delete': { label: '删除用户', color: 'red' },
  'template.create': { label: '创建模板', color: 'green' },
  'template.update': { label: '更新模板', color: 'orange' },
  'template.delete': { label: '删除模板', color: 'red' },
  'template.export': { label: '导出模板', color: 'cyan' },
  'prompt.create': { label: '创建Prompt', color: 'green' },
  'prompt.update': { label: '更新Prompt', color: 'orange' },
  'prompt.delete': { label: '删除Prompt', color: 'red' },
  'model.create': { label: '创建模型', color: 'green' },
  'model.update': { label: '更新模型', color: 'orange' },
  'model.delete': { label: '删除模型', color: 'red' },
  'role.create': { label: '创建角色', color: 'green' },
  'role.update': { label: '更新角色', color: 'orange' },
  'role.delete': { label: '删除角色', color: 'red' },
  'billing.purchase': { label: '购买套餐', color: 'purple' },
  'billing.refund': { label: '退款', color: 'volcano' },
  'config.update': { label: '更新配置', color: 'gold' },
  'tenant.create': { label: '创建租户', color: 'green' },
  'tenant.update': { label: '更新租户', color: 'orange' },
  'tenant.delete': { label: '删除租户', color: 'red' },
  'tenant.switch': { label: '切换租户', color: 'cyan' },
  'permission.grant': { label: '授予权限', color: 'lime' },
  'permission.revoke': { label: '撤销权限', color: 'magenta' },
  'data.export': { label: '导出数据', color: 'geekblue' },
  'data.import': { label: '导入数据', color: 'purple' },
};

/**
 * 状态配置
 */
const STATUS_CONFIG: Record<AuditEvent['status'], { label: string; color: string; icon: any }> = {
  success: { label: '成功', color: 'success', icon: <CheckCircleOutlined /> },
  failure: { label: '失败', color: 'error', icon: <CloseCircleOutlined /> },
  pending: { label: '进行中', color: 'processing', icon: <ClockCircleOutlined /> },
};

/**
 * 审计日志查询页面
 */
export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  // 筛选条件
  const [eventType, setEventType] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [userEmail, setUserEmail] = useState<string>('');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(7, 'day'),
    dayjs(),
  ]);

  // 分页
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 统计数据
  const [stats, setStats] = useState({
    total: 0,
    success: 0,
    failure: 0,
    today: 0,
  });

  /**
   * 加载审计日志
   */
  const loadLogs = async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('page_size', pageSize.toString());
      params.append('start_date', dateRange[0].format('YYYY-MM-DD'));
      params.append('end_date', dateRange[1].format('YYYY-MM-DD'));

      if (eventType !== 'all') {
        params.append('event_type', eventType);
      }

      if (status !== 'all') {
        params.append('status', status);
      }

      if (userEmail) {
        params.append('user_email', userEmail);
      }

      const response = await fetch(`/api/admin/audit/logs?${params.toString()}`);
      if (!response.ok) throw new Error('获取审计日志失败');

      const data = await response.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setStats(data.stats || { total: 0, success: 0, failure: 0, today: 0 });
    } catch (error: any) {
      console.error('[审计日志] 获取失败:', error);
      message.error(error.message || '获取审计日志失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 导出CSV
   */
  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      params.append('start_date', dateRange[0].format('YYYY-MM-DD'));
      params.append('end_date', dateRange[1].format('YYYY-MM-DD'));

      if (eventType !== 'all') {
        params.append('event_type', eventType);
      }

      if (status !== 'all') {
        params.append('status', status);
      }

      if (userEmail) {
        params.append('user_email', userEmail);
      }

      const response = await fetch(`/api/admin/audit/export?${params.toString()}`);
      if (!response.ok) throw new Error('导出失败');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_logs_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      message.success('导出成功');
    } catch (error: any) {
      console.error('[审计日志] 导出失败:', error);
      message.error(error.message || '导出失败');
    }
  };

  /**
   * 初始化
   */
  useEffect(() => {
    loadLogs();
  }, [page, pageSize, eventType, status, dateRange]);

  /**
   * 表格列定义
   */
  const columns: ColumnType<AuditEvent>[] = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (timestamp: number) => dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '事件类型',
      dataIndex: 'event_type',
      key: 'event_type',
      width: 150,
      render: (type: AuditEventType) => {
        const config = EVENT_TYPE_CONFIG[type] || { label: type, color: 'default' };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '操作用户',
      dataIndex: 'user_email',
      key: 'user_email',
      width: 200,
      ellipsis: true,
    },
    {
      title: '租户',
      dataIndex: 'tenant_id',
      key: 'tenant_id',
      width: 150,
      ellipsis: true,
      render: (id: string) => (id ? <Text code>{id}</Text> : '-'),
    },
    {
      title: '资源',
      key: 'resource',
      width: 200,
      render: (_, record) => {
        if (!record.resource_type) return '-';
        return (
          <Space size={4}>
            <Text type="secondary">{record.resource_type}</Text>
            {record.resource_id && <Text code>{record.resource_id}</Text>}
          </Space>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: AuditEvent['status']) => {
        const config = STATUS_CONFIG[status];
        return (
          <Badge
            status={config.color as any}
            text={
              <Space size={4}>
                {config.icon}
                {config.label}
              </Space>
            }
          />
        );
      },
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 150,
      render: (ip: string) => (ip ? <Text code>{ip}</Text> : '-'),
    },
    {
      title: '详情',
      dataIndex: 'details',
      key: 'details',
      width: 200,
      ellipsis: true,
      render: (details: Record<string, any>) => {
        if (!details) return '-';
        return <Text type="secondary">{JSON.stringify(details)}</Text>;
      },
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <FileTextOutlined style={{ marginRight: 8 }} />
          审计日志
        </Title>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总事件数"
              value={stats.total}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="成功事件"
              value={stats.success}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="失败事件"
              value={stats.failure}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="今日事件"
              value={stats.today}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 审计日志列表 */}
      <Card
        title="操作记录"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadLogs}>
              刷新
            </Button>
            <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
              导出CSV
            </Button>
          </Space>
        }
      >
        {/* 筛选器 */}
        <Space style={{ marginBottom: 16 }} wrap>
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0], dates[1]]);
              }
            }}
            format="YYYY-MM-DD"
          />

          <Select
            value={eventType}
            onChange={setEventType}
            style={{ width: 180 }}
            placeholder="事件类型"
          >
            <Select.Option value="all">全部类型</Select.Option>
            {Object.entries(EVENT_TYPE_CONFIG).map(([key, config]) => (
              <Select.Option key={key} value={key}>
                {config.label}
              </Select.Option>
            ))}
          </Select>

          <Select
            value={status}
            onChange={setStatus}
            style={{ width: 120 }}
            placeholder="状态"
          >
            <Select.Option value="all">全部状态</Select.Option>
            <Select.Option value="success">成功</Select.Option>
            <Select.Option value="failure">失败</Select.Option>
            <Select.Option value="pending">进行中</Select.Option>
          </Select>

          <Input
            placeholder="用户邮箱"
            prefix={<SearchOutlined />}
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            onPressEnter={loadLogs}
            style={{ width: 200 }}
          />

          <Button type="primary" icon={<SearchOutlined />} onClick={loadLogs}>
            搜索
          </Button>
        </Space>

        {/* 表格 */}
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => {
              setPage(page);
              setPageSize(pageSize);
            },
          }}
        />
      </Card>
    </div>
  );
}
