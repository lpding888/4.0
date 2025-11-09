/**
 * PAGE-P0-KB-002 知识库管理 - 列表页面
 * 艹，必须做好知识库文档管理，支持分页、删除、搜索等功能！
 *
 * 功能清单：
 * 1. 知识库文档列表展示（表格形式）
 * 2. 分页功能（后端分页）
 * 3. 搜索功能（文档名称、内容搜索）
 * 4. 删除功能（单个删除、批量删除）
 * 5. 状态显示（处理中、已完成、失败）
 * 6. 操作记录（上传时间、处理状态）
 *
 * @author 老王
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Input,
  Space,
  Tag,
  Popconfirm,
  message,
  Tooltip,
  Badge,
  Modal,
  Drawer,
  Descriptions,
  Typography,
  Row,
  Col,
  Statistic,
  Progress
} from 'antd';
import {
  SearchOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  CloudUploadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  DatabaseOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { MSWInitializer } from '@/components/MSWInitializer';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;
const { Search } = Input;

// 知识库文档类型
interface KBDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  status: 'processing' | 'completed' | 'failed';
  progress?: number;
  chunks: number;
  uploadedAt: string;
  processedAt?: string;
  errorMessage?: string;
  metadata?: {
    pageCount?: number;
    wordCount?: number;
    language?: string;
  };
}

// 分页参数
interface PaginationParams {
  page: number;
  pageSize: number;
  total: number;
}

// 查询参数
interface QueryParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
}

export default function KnowledgeBasePage() {
  const [queryParams, setQueryParams] = useState<QueryParams>({
    page: 1,
    pageSize: 20
  });
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<KBDocument | null>(null);

  const queryClient = useQueryClient();

  // 获取知识库文档列表
  const { data: documentsData, isLoading, refetch } = useQuery({
    queryKey: ['kb-documents', queryParams],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', queryParams.page.toString());
      params.append('pageSize', queryParams.pageSize.toString());
      if (queryParams.search) params.append('search', queryParams.search);
      if (queryParams.status) params.append('status', queryParams.status);

      const response = await api.get(`/admin/kb/documents?${params.toString()}`);
      return response.data;
    },
  });

  // 获取知识库统计
  const { data: statsData } = useQuery({
    queryKey: ['kb-stats'],
    queryFn: async () => {
      const response = await api.get('/admin/kb/stats');
      return response.data;
    },
    refetchInterval: 30000, // 30秒刷新一次
  });

  // 删除单个文档
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/admin/kb/documents/${id}`);
    },
    onSuccess: () => {
      message.success('文档删除成功');
      refetch();
      setSelectedRowKeys([]);
    },
    onError: (error: any) => {
      message.error(`删除失败: ${error.message}`);
    },
  });

  // 批量删除文档
  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return api.post('/admin/kb/documents/batch-delete', { ids });
    },
    onSuccess: (data) => {
      const { deleted } = data.data;
      message.success(`成功删除 ${deleted} 个文档`);
      refetch();
      setSelectedRowKeys([]);
    },
    onError: (error: any) => {
      message.error(`批量删除失败: ${error.message}`);
    },
  });

  // 获取状态标签
  const getStatusTag = (status: string, progress?: number) => {
    switch (status) {
      case 'completed':
        return <Tag color="success" icon={<CheckCircleOutlined />}>已完成</Tag>;
      case 'processing':
        return (
          <Space>
            <Tag color="processing" icon={<ClockCircleOutlined />}>处理中</Tag>
            {progress !== undefined && (
              <Progress percent={progress} size="small" style={{ width: 60 }} />
            )}
          </Space>
        );
      case 'failed':
        return <Tag color="error" icon={<ExclamationCircleOutlined />}>失败</Tag>;
      default:
        return <Tag>未知</Tag>;
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 格式化时间
  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleString('zh-CN');
  };

  // 查看文档详情
  const viewDocumentDetail = (document: KBDocument) => {
    setSelectedDocument(document);
    setDetailDrawerVisible(true);
  };

  // 表格列定义
  const columns: ColumnsType<KBDocument> = [
    {
      title: '文档名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (text: string, record: KBDocument) => (
        <Space>
          <FileTextOutlined />
          <Tooltip title={text}>
            <Text strong>{text}</Text>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type: string) => (
        <Tag color="blue">{type.toUpperCase()}</Tag>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 100,
      render: (size: number) => (
        <Text>{formatFileSize(size)}</Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status: string, record: KBDocument) => (
        getStatusTag(status, record.progress)
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
      title: '上传时间',
      dataIndex: 'uploadedAt',
      key: 'uploadedAt',
      width: 180,
      render: (time: string) => (
        <Text type="secondary">{formatTime(time)}</Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, record: KBDocument) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => viewDocumentDetail(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定删除这个文档吗？"
            description="删除后无法恢复，相关索引也会被清除。"
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                loading={deleteMutation.isPending}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 表格选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys as string[]);
    },
  };

  // 处理搜索
  const handleSearch = (value: string) => {
    setQueryParams(prev => ({
      ...prev,
      search: value.trim() || undefined,
      page: 1
    }));
  };

  // 处理状态筛选
  const handleStatusFilter = (status: string) => {
    setQueryParams(prev => ({
      ...prev,
      status: status === 'all' ? undefined : status,
      page: 1
    }));
  };

  // 处理分页变化
  const handleTableChange = (pagination: any) => {
    setQueryParams(prev => ({
      ...prev,
      page: pagination.current,
      pageSize: pagination.pageSize
    }));
  };

  const documents = documentsData?.documents || [];
  const pagination = documentsData?.pagination || { page: 1, pageSize: 20, total: 0 };
  const stats = statsData?.stats || {};

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <MSWInitializer />

      {/* 页面头部 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <DatabaseOutlined className="text-3xl text-blue-600" />
            <div>
              <Title level={2} className="mb-1">知识库管理</Title>
              <Text type="secondary">管理和维护知识库文档，支持向量化检索</Text>
            </div>
          </div>
          <Space>
            <Button
              type="primary"
              icon={<CloudUploadOutlined />}
              onClick={() => window.location.href = '/admin/kb/upload'}
            >
              上传文档
            </Button>
            <Button
              icon={<BarChartOutlined />}
              onClick={() => window.location.href = '/admin/kb/stats'}
            >
              处理统计
            </Button>
          </Space>
        </div>

        {/* 统计卡片 */}
        {stats && (
          <Row gutter={16} className="mb-6">
            <Col span={6}>
              <Card>
                <Statistic
                  title="总文档数"
                  value={stats.totalDocuments || 0}
                  prefix={<FileTextOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="已完成"
                  value={stats.completedDocuments || 0}
                  valueStyle={{ color: '#3f8600' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="处理中"
                  value={stats.processingDocuments || 0}
                  valueStyle={{ color: '#1890ff' }}
                  prefix={<ClockCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总知识块"
                  value={stats.totalChunks || 0}
                  prefix={<DatabaseOutlined />}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* 操作栏 */}
        <Card className="mb-4">
          <Row justify="space-between" align="middle">
            <Col>
              <Space size="middle">
                <Search
                  placeholder="搜索文档名称或内容"
                  allowClear
                  enterButton={<SearchOutlined />}
                  style={{ width: 300 }}
                  onSearch={handleSearch}
                />
                <Space>
                  <Text>状态:</Text>
                  <Button
                    size="small"
                    type={!queryParams.status ? 'primary' : 'default'}
                    onClick={() => handleStatusFilter('all')}
                  >
                    全部
                  </Button>
                  <Button
                    size="small"
                    type={queryParams.status === 'completed' ? 'primary' : 'default'}
                    onClick={() => handleStatusFilter('completed')}
                  >
                    已完成
                  </Button>
                  <Button
                    size="small"
                    type={queryParams.status === 'processing' ? 'primary' : 'default'}
                    onClick={() => handleStatusFilter('processing')}
                  >
                    处理中
                  </Button>
                  <Button
                    size="small"
                    type={queryParams.status === 'failed' ? 'primary' : 'default'}
                    onClick={() => handleStatusFilter('failed')}
                  >
                    失败
                  </Button>
                </Space>
              </Space>
            </Col>
            <Col>
              <Space>
                {selectedRowKeys.length > 0 && (
                  <Popconfirm
                    title={`确定删除选中的 ${selectedRowKeys.length} 个文档吗？`}
                    description="删除后无法恢复，相关索引也会被清除。"
                    onConfirm={() => batchDeleteMutation.mutate(selectedRowKeys)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      loading={batchDeleteMutation.isPending}
                    >
                      批量删除 ({selectedRowKeys.length})
                    </Button>
                  </Popconfirm>
                )}
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => refetch()}
                  loading={isLoading}
                >
                  刷新
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>
      </div>

      {/* 文档列表表格 */}
      <Card>
        <Table
          columns={columns}
          dataSource={documents}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
          rowSelection={rowSelection}
          onChange={handleTableChange}
          scroll={{ x: 800 }}
        />
      </Card>

      {/* 详情抽屉 */}
      <Drawer
        title="文档详情"
        width={600}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
      >
        {selectedDocument && (
          <div>
            <Descriptions column={1} bordered>
              <Descriptions.Item label="文档名称">
                {selectedDocument.name}
              </Descriptions.Item>
              <Descriptions.Item label="文件类型">
                <Tag color="blue">{selectedDocument.type.toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="文件大小">
                {formatFileSize(selectedDocument.size)}
              </Descriptions.Item>
              <Descriptions.Item label="处理状态">
                {getStatusTag(selectedDocument.status, selectedDocument.progress)}
              </Descriptions.Item>
              <Descriptions.Item label="知识块数量">
                <Badge count={selectedDocument.chunks} style={{ backgroundColor: '#52c41a' }} />
              </Descriptions.Item>
              <Descriptions.Item label="上传时间">
                {formatTime(selectedDocument.uploadedAt)}
              </Descriptions.Item>
              {selectedDocument.processedAt && (
                <Descriptions.Item label="处理完成时间">
                  {formatTime(selectedDocument.processedAt)}
                </Descriptions.Item>
              )}
              {selectedDocument.errorMessage && (
                <Descriptions.Item label="错误信息">
                  <Text type="danger">{selectedDocument.errorMessage}</Text>
                </Descriptions.Item>
              )}
              {selectedDocument.metadata && (
                <>
                  {selectedDocument.metadata.pageCount && (
                    <Descriptions.Item label="页数">
                      {selectedDocument.metadata.pageCount}
                    </Descriptions.Item>
                  )}
                  {selectedDocument.metadata.wordCount && (
                    <Descriptions.Item label="字数">
                      {selectedDocument.metadata.wordCount.toLocaleString()}
                    </Descriptions.Item>
                  )}
                  {selectedDocument.metadata.language && (
                    <Descriptions.Item label="语言">
                      {selectedDocument.metadata.language}
                    </Descriptions.Item>
                  )}
                </>
              )}
            </Descriptions>
          </div>
        )}
      </Drawer>
    </div>
  );
}
