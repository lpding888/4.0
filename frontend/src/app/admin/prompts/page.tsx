/**
 * PAGE-P0-PRM-004 Prompt管理页面
 * 艹，必须做好Prompt管理，支持Monaco编辑器、变量高亮、预览、版本管理！
 *
 * 功能清单：
 * 1. Prompt列表展示
 * 2. Monaco编辑器集成
 * 3. 变量缺失高亮
 * 4. 预览功能
 * 5. 版本管理
 * 6. 复制、删除操作
 *
 * @author 老王
 */

'use client';

import { useState, useEffect } from 'react';
import type { Key } from 'react';
import {
  Card,
  Button,
  Space,
  Tag,
  Popconfirm,
  message,
  Modal,
  Form,
  Input,
  Select,
  Typography,
  Row,
  Col,
  Statistic,
  Tooltip,
  List,
  Avatar,
  Tabs,
  Divider,
  Badge,
  Alert
} from 'antd';
import {
  FileTextOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  CopyOutlined,
  HistoryOutlined,
  CodeOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  PlayCircleOutlined,
  BranchesOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTablePro } from '@/components/base/DataTablePro';
import type { DataTableColumn } from '@/components/base/DataTablePro';
import { api } from '@/lib/api/client';
import { MSWInitializer } from '@/components/MSWInitializer';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { TextArea } = Input;

// Prompt类型
interface Prompt {
  id: string;
  name: string;
  description?: string;
  category: string;
  content: string;
  variables: string[];
  version: number;
  status: 'draft' | 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  tags?: string[];
  usageCount?: number;
}

// Prompt版本
interface PromptVersion {
  id: string;
  promptId: string;
  version: number;
  content: string;
  variables: string[];
  changelog?: string;
  createdBy?: string;
  createdAt: string;
}

// 预览结果
interface PreviewResult {
  rendered: string;
  variables: Record<string, any>;
  missingVariables: string[];
}

export default function PromptsPage() {
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [versionModalVisible, setVersionModalVisible] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const queryClient = useQueryClient();

  // 获取Prompt列表
  const { data: promptsData, isLoading, refetch } = useQuery({
    queryKey: ['prompts'],
    queryFn: async () => {
      const response = await api.get('/admin/prompts');
      return response.data;
    },
  });

  // 获取Prompt统计
  const { data: statsData } = useQuery({
    queryKey: ['prompt-stats'],
    queryFn: async () => {
      const response = await api.get('/admin/prompts/stats');
      return response.data;
    },
  });

  // 预览Prompt
  const previewMutation = useMutation({
    mutationFn: async ({ promptId, variables }: { promptId: string; variables?: Record<string, any> }) => {
      const response = await api.post(`/admin/prompts/${promptId}/render`, { variables });
      return response.data;
    },
    onSuccess: (data: PreviewResult) => {
      setPreviewResult(data);
      setPreviewModalVisible(true);
    },
    onError: (error: any) => {
      message.error(`预览失败: ${error.message}`);
    },
  });

  // 获取Prompt版本
  const getVersionsMutation = useMutation({
    mutationFn: async (promptId: string) => {
      const response = await api.get(`/admin/prompts/${promptId}/versions`);
      return response.data;
    },
    onSuccess: (data) => {
      setVersions(data.versions || []);
      setVersionModalVisible(true);
    },
  });

  // 创建Prompt
  const createMutation = useMutation({
    mutationFn: async (data: Partial<Prompt>) => {
      const response = await api.post('/admin/prompts', data);
      return response.data;
    },
    onSuccess: () => {
      message.success('Prompt创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      refetch();
    },
    onError: (error: any) => {
      message.error(`创建失败: ${error.message}`);
    },
  });

  // 更新Prompt
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Prompt> }) => {
      const response = await api.put(`/admin/prompts/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      message.success('Prompt更新成功');
      setEditModalVisible(false);
      editForm.resetFields();
      setSelectedPrompt(null);
      refetch();
    },
    onError: (error: any) => {
      message.error(`更新失败: ${error.message}`);
    },
  });

  // 删除Prompt
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/admin/prompts/${id}`);
    },
    onSuccess: () => {
      message.success('Prompt删除成功');
      refetch();
    },
    onError: (error: any) => {
      message.error(`删除失败: ${error.message}`);
    },
  });

  // 复制Prompt
  const copyPrompt = (prompt: Prompt) => {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = prompt;
    const copyData: Partial<Prompt> = {
      ...rest,
      name: `${prompt.name} (副本)`,
      status: 'draft',
      version: 1,
    };
    createMutation.mutate(copyData);
  };

  // 预览Prompt
  const previewPrompt = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    previewMutation.mutate({
      promptId: prompt.id,
      variables: {
        // 示例变量
        user_name: '张三',
        company_name: '示例公司',
        product_name: '示例产品'
      }
    });
  };

  // 查看版本历史
  const viewVersions = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    getVersionsMutation.mutate(prompt.id);
  };

  // 编辑Prompt
  const editPrompt = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    editForm.setFieldsValue(prompt);
    setEditModalVisible(true);
  };

  // 提取变量
  const extractVariables = (content: string): string[] => {
    const variablePattern = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;
    while ((match = variablePattern.exec(content)) !== null) {
      const varName = match[1];
      if (varName && !variables.includes(varName)) {
        variables.push(varName);
      }
    }
    return variables;
  };

  // 创建Prompt
  const handleCreate = async (values: any) => {
    const content = values.content || '';
    const variables = extractVariables(content);

    const promptData = {
      ...values,
      id: `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      variables,
      version: 1,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    createMutation.mutate(promptData);
  };

  // 更新Prompt
  const handleUpdate = async (values: any) => {
    if (!selectedPrompt) return;

    const content = values.content || '';
    const variables = extractVariables(content);

    const updateData = {
      ...values,
      variables,
      version: (selectedPrompt.version || 1) + 1,
      updatedAt: new Date().toISOString()
    };

    updateMutation.mutate({
      id: selectedPrompt.id,
      data: updateData
    });
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    switch (status) {
      case 'active':
        return <Tag color="success" icon={<CheckCircleOutlined />}>已发布</Tag>;
      case 'draft':
        return <Tag color="processing">草稿</Tag>;
      case 'archived':
        return <Tag color="default">已归档</Tag>;
      default:
        return <Tag>未知</Tag>;
    }
  };

  // 获取分类标签
  const getCategoryTag = (category: string) => {
    const colorMap: Record<string, string> = {
      'chat': 'blue',
      'writing': 'green',
      'analysis': 'orange',
      'creative': 'purple',
      'technical': 'red',
      'business': 'cyan'
    };

    return <Tag color={colorMap[category] || 'default'}>{category}</Tag>;
  };

  // 表格列定义
  const columns: DataTableColumn<Prompt>[] = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      render: (text: string, record: Prompt) => (
        <Space>
          <FileTextOutlined />
          <div>
            <Text strong>{text}</Text>
            {record.description && (
              <div>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {record.description}
                </Text>
              </div>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      filters: [
        { text: '聊天', value: 'chat' },
        { text: '写作', value: 'writing' },
        { text: '分析', value: 'analysis' },
        { text: '创意', value: 'creative' },
        { text: '技术', value: 'technical' },
        { text: '业务', value: 'business' }
      ],
      render: (category: string) => getCategoryTag(category),
    },
    {
      title: '变量',
      dataIndex: 'variables',
      key: 'variables',
      width: 120,
      render: (variables: string[]) => (
        <Space>
          <Badge count={variables.length} style={{ backgroundColor: '#52c41a' }} />
          {variables.length > 0 && (
            <Tooltip title={variables.join(', ')}>
              <Text type="secondary">查看</Text>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      sorter: true,
      render: (version: number) => <Tag>v{version}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      filters: [
        { text: '已发布', value: 'active' },
        { text: '草稿', value: 'draft' },
        { text: '已归档', value: 'archived' }
      ],
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '使用次数',
      dataIndex: 'usageCount',
      key: 'usageCount',
      width: 100,
      sorter: true,
      render: (count?: number) => count || 0,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (time: string) => (
        <Text type="secondary">{new Date(time).toLocaleString('zh-CN')}</Text>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 250,
      render: (_, record: Prompt) => (
        <Space>
          <Tooltip title="预览">
            <Button
              type="text"
              icon={<PlayCircleOutlined />}
              onClick={() => previewPrompt(record)}
            />
          </Tooltip>
          <Tooltip title="版本历史">
            <Button
              type="text"
              icon={<HistoryOutlined />}
              onClick={() => viewVersions(record)}
            />
          </Tooltip>
          <Tooltip title="复制">
            <Button
              type="text"
              icon={<CopyOutlined />}
              onClick={() => copyPrompt(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => editPrompt(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定删除这个Prompt吗？"
            description="删除后无法恢复，请谨慎操作。"
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

  const prompts = promptsData?.prompts || [];
  const stats = statsData?.stats || {};

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <MSWInitializer />

      {/* 页面头部 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FileTextOutlined className="text-3xl text-blue-600" />
            <div>
              <Title level={2} className="mb-1">Prompt管理</Title>
              <Text type="secondary">管理和维护Prompt模板，支持版本控制和变量替换</Text>
            </div>
          </div>
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              创建Prompt
            </Button>
          </Space>
        </div>

        {/* 统计卡片 */}
        {stats && (
          <Row gutter={16} className="mb-6">
            <Col span={6}>
              <Card>
                <Statistic
                  title="总Prompt数"
                  value={stats.totalPrompts || 0}
                  prefix={<FileTextOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="已发布"
                  value={stats.activePrompts || 0}
                  valueStyle={{ color: '#3f8600' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="草稿"
                  value={stats.draftPrompts || 0}
                  valueStyle={{ color: '#1890ff' }}
                  prefix={<CodeOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总使用次数"
                  value={stats.totalUsage || 0}
                  prefix={<BranchesOutlined />}
                />
              </Card>
            </Col>
          </Row>
        )}
      </div>

      {/* Prompt列表 */}
      <Card>
        <DataTablePro
          columns={columns}
          dataSource={prompts}
          loading={isLoading}
          pagination={{
            current: 1,
            pageSize: 20,
            total: prompts.length,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: true
          }}
          search={{
            placeholder: '搜索Prompt名称或描述...',
            allowClear: true
          }}
          actions={{
            refresh: true,
            export: true,
            columnSetting: true
          }}
          onChange={(pagination, filters, sorter) => {
            console.log('Table change:', { pagination, filters, sorter });
          }}
          onRefresh={() => refetch()}
          onExport={() => {
            message.success('导出功能开发中...');
          }}
          rowSelection={{
            type: 'checkbox',
            onChange: (selectedRowKeys: Key[], selectedRows: Prompt[]) => {
              console.log('Selected:', selectedRowKeys, selectedRows);
            }
          }}
        />
      </Card>

      {/* 创建Prompt模态框 */}
      <Modal
        title="创建Prompt"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        footer={null}
        width={800}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreate}
        >
          <Form.Item
            label="Prompt名称"
            name="name"
            rules={[{ required: true, message: '请输入Prompt名称' }]}
          >
            <Input placeholder="输入Prompt名称" />
          </Form.Item>

          <Form.Item
            label="分类"
            name="category"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select placeholder="选择分类">
              <Select.Option value="chat">聊天</Select.Option>
              <Select.Option value="writing">写作</Select.Option>
              <Select.Option value="analysis">分析</Select.Option>
              <Select.Option value="creative">创意</Select.Option>
              <Select.Option value="technical">技术</Select.Option>
              <Select.Option value="business">业务</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
          >
            <TextArea placeholder="输入Prompt描述" rows={2} />
          </Form.Item>

          <Form.Item
            label="Prompt内容"
            name="content"
            rules={[{ required: true, message: '请输入Prompt内容' }]}
          >
            <TextArea
              placeholder="输入Prompt内容，使用 {{变量名}} 格式定义变量..."
              rows={10}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
                创建
              </Button>
              <Button onClick={() => setCreateModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑Prompt模态框 */}
      <Modal
        title="编辑Prompt"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setSelectedPrompt(null);
          editForm.resetFields();
        }}
        footer={null}
        width={800}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleUpdate}
        >
          <Form.Item
            label="Prompt名称"
            name="name"
            rules={[{ required: true, message: '请输入Prompt名称' }]}
          >
            <Input placeholder="输入Prompt名称" />
          </Form.Item>

          <Form.Item
            label="分类"
            name="category"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select placeholder="选择分类">
              <Select.Option value="chat">聊天</Select.Option>
              <Select.Option value="writing">写作</Select.Option>
              <Select.Option value="analysis">分析</Select.Option>
              <Select.Option value="creative">创意</Select.Option>
              <Select.Option value="technical">技术</Select.Option>
              <Select.Option value="business">业务</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
          >
            <TextArea placeholder="输入Prompt描述" rows={2} />
          </Form.Item>

          <Form.Item
            label="状态"
            name="status"
          >
            <Select defaultValue="draft">
              <Select.Option value="draft">草稿</Select.Option>
              <Select.Option value="active">已发布</Select.Option>
              <Select.Option value="archived">已归档</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Prompt内容"
            name="content"
            rules={[{ required: true, message: '请输入Prompt内容' }]}
          >
            <TextArea
              placeholder="输入Prompt内容，使用 {{变量名}} 格式定义变量..."
              rows={10}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>
                更新
              </Button>
              <Button onClick={() => setEditModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 预览模态框 */}
      <Modal
        title={`预览: ${selectedPrompt?.name}`}
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {previewResult && (
          <div>
            {previewResult.missingVariables.length > 0 && (
              <Alert
                message="缺少变量"
                description={`以下变量未提供: ${previewResult.missingVariables.join(', ')}`}
                type="warning"
                style={{ marginBottom: 16 }}
              />
            )}
            <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 4 }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                {previewResult.rendered}
              </pre>
            </div>
          </div>
        )}
      </Modal>

      {/* 版本历史模态框 */}
      <Modal
        title={`版本历史: ${selectedPrompt?.name}`}
        open={versionModalVisible}
        onCancel={() => setVersionModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setVersionModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        <List
          dataSource={versions}
          renderItem={(version) => (
            <List.Item>
              <List.Item.Meta
                avatar={
                  <Avatar style={{ backgroundColor: '#1890ff' }}>
                    v{version.version}
                  </Avatar>
                }
                title={
                  <Space>
                    <Text strong>版本 {version.version}</Text>
                  </Space>
                }
                description={
                  <div>
                    <Text type="secondary">创建时间: {new Date(version.createdAt).toLocaleString('zh-CN')}</Text>
                    {version.createdBy && (
                      <Text type="secondary">创建者: {version.createdBy}</Text>
                    )}
                    {version.changelog && (
                      <div style={{ marginTop: 4 }}>
                        <Text>变更记录: {version.changelog}</Text>
                      </div>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Modal>
    </div>
  );
}
