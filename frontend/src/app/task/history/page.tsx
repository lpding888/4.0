'use client';

import { useState, useEffect } from 'react';
import { Table, Tag, Select, Button, Image as AntImage, Space, message } from 'antd';
import { ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

const { Option } = Select;

export default function TaskHistoryPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchTasks();
  }, [currentPage, typeFilter, statusFilter]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params: any = {
        page: currentPage,
        pageSize,
      };
      
      if (typeFilter !== 'all') {
        params.type = typeFilter;
      }
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      const response = await api.task.list(params);
      setTasks((response.data as any)?.tasks || []);
      setTotal((response.data as any)?.total || 0);
    } catch (error) {
      message.error('获取任务列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 任务类型标签
  const getTypeTag = (type: string) => {
    const typeMap: Record<string, { color: string; text: string }> = {
      basic_clean: { color: 'blue', text: '基础修图' },
      model_pose12: { color: 'purple', text: 'AI模特12分镜' },
    };
    const config = typeMap[type] || { color: 'default', text: type };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 任务状态标签
  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      pending: { color: 'default', text: '等待中' },
      processing: { color: 'processing', text: '处理中' },
      completed: { color: 'success', text: '已完成' },
      failed: { color: 'error', text: '失败' },
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 表格列定义
  const columns = [
    {
      title: '任务ID',
      dataIndex: 'id',
      key: 'id',
      width: 180,
      render: (id: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {id.substring(0, 8)}...
        </span>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 150,
      render: getTypeTag,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: getStatusTag,
    },
    {
      title: '原图',
      dataIndex: 'inputImageUrl',
      key: 'inputImageUrl',
      width: 100,
      render: (url: string) => (
        <AntImage
          src={url}
          alt="input"
          width={60}
          height={60}
          style={{ objectFit: 'cover', borderRadius: 4 }}
        />
      ),
    },
    {
      title: '结果数',
      dataIndex: 'resultUrls',
      key: 'resultUrls',
      width: 100,
      render: (urls: string[]) => {
        const count = urls?.length || 0;
        return <span>{count}张</span>;
      },
    },
    {
      title: '配额消耗',
      dataIndex: 'quotaUsed',
      key: 'quotaUsed',
      width: 100,
      render: (quota: number) => <span>{quota}次</span>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (time: string) => new Date(time).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => router.push(`/task/${record.id}`)}
          >
            查看
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '40px auto', padding: '0 20px' }}>
      <h1 style={{ marginBottom: 30 }}>任务历史记录</h1>

      {/* 筛选器 */}
      <div style={{ 
        marginBottom: 20, 
        padding: 20, 
        background: '#fafafa', 
        borderRadius: 8,
        display: 'flex',
        gap: 16,
        alignItems: 'center'
      }}>
        <div>
          <span style={{ marginRight: 8 }}>任务类型:</span>
          <Select
            value={typeFilter}
            onChange={(value) => {
              setTypeFilter(value);
              setCurrentPage(1);
            }}
            style={{ width: 160 }}
          >
            <Option value="all">全部类型</Option>
            <Option value="basic_clean">基础修图</Option>
            <Option value="model_pose12">AI模特12分镜</Option>
          </Select>
        </div>

        <div>
          <span style={{ marginRight: 8 }}>任务状态:</span>
          <Select
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              setCurrentPage(1);
            }}
            style={{ width: 160 }}
          >
            <Option value="all">全部状态</Option>
            <Option value="pending">等待中</Option>
            <Option value="processing">处理中</Option>
            <Option value="completed">已完成</Option>
            <Option value="failed">失败</Option>
          </Select>
        </div>

        <Button
          icon={<ReloadOutlined />}
          onClick={fetchTasks}
          style={{ marginLeft: 'auto' }}
        >
          刷新
        </Button>
      </div>

      {/* 任务列表表格 */}
      <Table
        columns={columns}
        dataSource={tasks}
        loading={loading}
        rowKey="id"
        pagination={{
          current: currentPage,
          pageSize,
          total,
          onChange: (page) => setCurrentPage(page),
          showTotal: (total) => `共 ${total} 个任务`,
          showSizeChanger: false,
        }}
        scroll={{ x: 1200 }}
      />

      {/* 统计信息 */}
      <div style={{ 
        marginTop: 20, 
        padding: 20, 
        background: '#fafafa', 
        borderRadius: 8,
        textAlign: 'center'
      }}>
        <Space size="large">
          <div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
              {total}
            </div>
            <div style={{ color: '#8c8c8c' }}>总任务数</div>
          </div>
          <div style={{ borderLeft: '1px solid #d9d9d9', height: 40 }} />
          <div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
              {tasks.filter((t: any) => t.status === 'completed').length}
            </div>
            <div style={{ color: '#8c8c8c' }}>已完成</div>
          </div>
          <div style={{ borderLeft: '1px solid #d9d9d9', height: 40 }} />
          <div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#faad14' }}>
              {tasks.filter((t: any) => t.status === 'processing').length}
            </div>
            <div style={{ color: '#8c8c8c' }}>处理中</div>
          </div>
          <div style={{ borderLeft: '1px solid #d9d9d9', height: 40 }} />
          <div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#f5222d' }}>
              {tasks.filter((t: any) => t.status === 'failed').length}
            </div>
            <div style={{ color: '#8c8c8c' }}>失败</div>
          </div>
        </Space>
      </div>
    </div>
  );
}
