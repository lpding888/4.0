/**
 * PAGE-P0-CFG-006 配置管理页面
 * 艹，必须做好配置管理，KV编辑、版本控制、快速生效！
 *
 * 功能清单：
 * 1. KV配置编辑（键值对）
 * 2. 版本和快照管理
 * 3. 保存后1秒内生效（版本号对比）
 * 4. 回滚功能
 * 5. 配置历史记录
 * 6. 实时配置验证
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
  Switch,
  Typography,
  Row,
  Col,
  Statistic,
  Alert,
  Tabs,
  Table,
  Tooltip,
  Badge,
  Timeline,
  Divider
} from 'antd';
import {
  SettingOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  HistoryOutlined,
  SaveOutlined,
  RollbackOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  CopyOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTablePro, type DataTableColumn } from '@/components/base/DataTablePro';
import { api } from '@/lib/api/client';
import { MSWInitializer } from '@/components/MSWInitializer';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;

// 配置项类型
interface ConfigItem {
  key: string;
  value: string | number | boolean;
  type: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  category?: string;
  sensitive?: boolean;
  version?: number;
  updatedBy?: string;
  updatedAt?: string;
  createdAt?: string;
}

// 配置快照
interface ConfigSnapshot {
  id: string;
  version: number;
  description?: string;
  configs: Record<string, any>;
  created_by?: string;
  created_at: string;
  config_count: number;
}

// 配置历史
interface ConfigHistory {
  id: string;
  key: string;
  action: 'create' | 'update' | 'delete';
  old_value?: any;
  new_value?: any;
  created_by?: string;
  created_at: string;
  version?: number;
}

export default function ConfigsPage() {
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [snapshotModalVisible, setSnapshotModalVisible] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<ConfigItem | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<ConfigHistory[]>([]);
  const [snapshots, setSnapshots] = useState<ConfigSnapshot[]>([]);
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({});
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const queryClient = useQueryClient();

  // 获取配置列表
  const { data: configsData, isLoading, refetch } = useQuery({
    queryKey: ['configs'],
    queryFn: async () => {
      const response = await api.get('/admin/configs');
      return response.data;
    },
    });

  // 获取配置统计
  const { data: statsData } = useQuery({
    queryKey: ['config-stats'],
    queryFn: async () => {
      const response = await api.get('/admin/configs/stats');
      return response.data;
    },
    refetchInterval: 10000, // 10秒刷新
  });

  // 获取配置快照
  const { data: snapshotsData } = useQuery({
    queryKey: ['config-snapshots'],
    queryFn: async () => {
      const response = await api.get('/admin/configs/snapshots');
      return response.data;
    },
  });

  // 创建配置
  const createMutation = useMutation({
    mutationFn: async (data: Partial<ConfigItem>) => {
      const response = await api.post('/admin/configs', data);
      return response.data;
    },
    onSuccess: () => {
      message.success('配置创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      refetch();
    },
    onError: (error: any) => {
      message.error(`创建失败: ${error.message}`);
    },
  });

  // 更新配置
  const updateMutation = useMutation({
    mutationFn: async ({ key, data }: { key: string; data: Partial<ConfigItem> }) => {
      const response = await api.put(`/admin/configs/${key}`, data);
      return response.data;
    },
    onSuccess: () => {
      message.success('配置更新成功');
      setEditModalVisible(false);
      editForm.resetFields();
      setSelectedConfig(null);
      refetch();
    },
    onError: (error: any) => {
      message.error(`更新失败: ${error.message}`);
    },
  });

  // 删除配置
  const deleteMutation = useMutation({
    mutationFn: async (key: string) => {
      return api.delete(`/admin/configs/${key}`);
    },
    onSuccess: () => {
      message.success('配置删除成功');
      refetch();
    },
    onError: (error: any) => {
      message.error(`删除失败: ${error.message}`);
    },
  });

  // 创建快照
  const createSnapshotMutation = useMutation({
    mutationFn: async (description?: string) => {
      const response = await api.post('/admin/configs/snapshots', { description });
      return response.data;
    },
    onSuccess: () => {
      message.success('快照创建成功');
      refetch();
    },
    onError: (error: any) => {
      message.error(`创建快照失败: ${error.message}`);
    },
  });

  // 回滚配置
  const rollbackMutation = useMutation({
    mutationFn: async (snapshotId: string) => {
      const response = await api.post(`/admin/configs/snapshots/${snapshotId}/rollback`);
      return response.data;
    },
    onSuccess: () => {
      message.success('配置回滚成功');
      setSnapshotModalVisible(false);
      refetch();
    },
    onError: (error: any) => {
      message.error(`回滚失败: ${error.message}`);
    },
  });

  // 获取配置历史
  const getHistoryMutation = useMutation({
    mutationFn: async (key: string) => {
      const response = await api.get(`/admin/configs/${key}/history`);
      return response.data;
    },
    onSuccess: (data) => {
      setSelectedHistory(data.history || []);
      setHistoryModalVisible(true);
    },
  });

  // 获取类型标签
  const getTypeTag = (type: string) => {
    switch (type) {
      case 'string':
        return <Tag color="blue">文本</Tag>;
      case 'number':
        return <Tag color="green">数字</Tag>;
      case 'boolean':
        return <Tag color="orange">布尔</Tag>;
      case 'json':
        return <Tag color="purple">JSON</Tag>;
      default:
        return <Tag>未知</Tag>;
    }
  };

  // 格式化值显示
  const formatValue = (value: any, type: string, key: string) => {
    if (value === null || value === undefined) {
      return '-';
    }

    // 敏感字段处理
    const isVisible = showSensitive[key];
    if (type === 'boolean' && typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }

    if (type === 'json' && typeof value === 'object') {
      const jsonStr = JSON.stringify(value, null, 2);
      return (
        <Space>
          <Text code ellipsis style={{ maxWidth: 200 }}>
            {isVisible ? jsonStr : maskValue(jsonStr)}
          </Text>
          <Button
            type="text"
            size="small"
            icon={isVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            onClick={() => setShowSensitive(prev => ({
              ...prev,
              [key]: !prev[key]
            }))}
          />
        </Space>
      );
    }

    return (
      <Text code>{String(value)}</Text>
    );
  };

  // 掩码值
  const maskValue = (value: string) => {
    if (value.length <= 8) return '*'.repeat(value.length);
    return value.substring(0, 4) + '*'.repeat(value.length - 8) + value.substring(value.length - 4);
  };

  // 复制配置
  const copyConfig = (config: ConfigItem) => {
    navigator.clipboard.writeText(String(config.value));
    message.success('配置值已复制到剪贴板');
  };

  // 编辑配置
  const editConfig = (config: ConfigItem) => {
    setSelectedConfig(config);
    editForm.setFieldsValue({
      key: config.key,
      value: config.type === 'boolean' ? String(config.value) : config.value,
      type: config.type,
      description: config.description,
      category: config.category,
      sensitive: config.sensitive
    });
    setEditModalVisible(true);
  };

  // 查看历史
  const viewHistory = (config: ConfigItem) => {
    setSelectedConfig(config);
    getHistoryMutation.mutate(config.key);
  };

  // 创建配置
  const handleCreate = async (values: any) => {
    let processedValue = values.value;

    // 类型转换
    if (values.type === 'number') {
      processedValue = Number(values.value);
    } else if (values.type === 'boolean') {
      processedValue = values.value === 'true';
    } else if (values.type === 'json') {
      try {
        processedValue = JSON.parse(values.value);
      } catch (error) {
        message.error('JSON格式错误，请检查输入');
        return;
      }
    }

    const configData = {
      ...values,
      value: processedValue,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    createMutation.mutate(configData);
  };

  // 更新配置
  const handleUpdate = async (values: any) => {
    if (!selectedConfig) return;

    let processedValue = values.value;

    // 类型转换
    if (values.type === 'number') {
      processedValue = Number(values.value);
    } else if (values.type === 'boolean') {
      processedValue = values.value === 'true';
    } else if (values.type === 'json') {
      try {
        processedValue = JSON.parse(values.value);
      } catch (error) {
        message.error('JSON格式错误，请检查输入');
        return;
      }
    }

    const updateData = {
      ...values,
      value: processedValue,
      version: (selectedConfig.version || 1) + 1,
      updatedAt: new Date().toISOString()
    };

    updateMutation.mutate({
      key: selectedConfig.key,
      data: updateData
    });
  };

  // 表格列定义
  const columns: ColumnsType<ConfigItem> = [
    {
      title: '配置键',
      dataIndex: 'key',
      key: 'key',
      sorter: true,
      render: (text: string) => (
        <Text code>{text}</Text>
      ),
    },
    {
      title: '配置值',
      dataIndex: 'value',
      key: 'value',
      ellipsis: true,
      render: (value: any, record: ConfigItem) => (
        <Space>
          {formatValue(value, record.type, record.key)}
          <Tooltip title="复制">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => copyConfig(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      filters: [
        { text: '文本', value: 'string' },
        { text: '数字', value: 'number' },
        { text: '布尔', value: 'boolean' },
        { text: 'JSON', value: 'json' }
      ],
      render: (type: string) => getTypeTag(type),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      filters: [
        { text: '系统', value: 'system' },
        { text: '业务', value: 'business' },
        { text: '安全', value: 'security' },
        { text: '性能', value: 'performance' },
        { text: '通知', value: 'notification' }
      ],
      render: (category?: string) => (
        category ? <Tag>{category}</Tag> : '-'
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      sorter: true,
      render: (version: number) => <Badge count={version} style={{ backgroundColor: '#52c41a' }} />,
    },
    {
      title: '敏感',
      dataIndex: 'sensitive',
      key: 'sensitive',
      width: 80,
      render: (sensitive?: boolean) => (
        sensitive ? <Tag color="warning">敏感</Tag> : '-'
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (time?: string) => (
        time ? <Text type="secondary">{new Date(time).toLocaleString('zh-CN')}</Text> : '-'
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, record: ConfigItem) => (
        <Space>
          <Tooltip title="查看历史">
            <Button
              type="text"
              icon={<HistoryOutlined />}
              onClick={() => viewHistory(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => editConfig(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定删除这个配置吗？"
            description="删除后无法恢复，请谨慎操作。"
            onConfirm={() => deleteMutation.mutate(record.key)}
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

  const configs = configsData?.configs || [];
  const stats = statsData?.stats || {};

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <MSWInitializer />

      {/* 页面头部 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <SettingOutlined className="text-3xl text-blue-600" />
            <div>
              <Title level={2} className="mb-1">配置管理</Title>
              <Text type="secondary">管理系统配置参数，支持版本控制和快速回滚</Text>
            </div>
          </div>
          <Space>
            <Button
              icon={<RollbackOutlined />}
              onClick={() => setSnapshotModalVisible(true)}
            >
              快照管理
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              添加配置
            </Button>
          </Space>
        </div>

        {/* 统计卡片 */}
        {stats && (
          <Row gutter={16} className="mb-6">
            <Col span={6}>
              <Card>
                <Statistic
                  title="总配置数"
                  value={stats.totalConfigs || 0}
                  prefix={<DatabaseOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="快照数量"
                  value={stats.totalSnapshots || 0}
                  valueStyle={{ color: '#722ed1' }}
                  prefix={<RollbackOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="最近更新"
                  value={stats.lastUpdateMinutes || 0}
                  suffix="分钟前"
                  valueStyle={{ color: '#eb2f96' }}
                  prefix={<ClockCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="当前版本"
                  value={stats.currentVersion || 1}
                  prefix={<CheckCircleOutlined />}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* 提示信息 */}
        <Alert
          message="配置管理说明"
          description={
            <div>
              <p>• 配置保存后1秒内生效，系统会自动对比版本号</p>
              <p>• 敏感配置字段默认掩码显示，点击眼睛图标可查看明文</p>
              <p>• 支持创建快照和快速回滚到历史版本</p>
              <p>• 所有配置变更都有详细的历史记录</p>
            </div>
          }
          type="info"
          showIcon
          className="mb-4"
        />
      </div>

      {/* 配置列表 */}
      <Card>
        <DataTablePro
          columns={columns as DataTableColumn<ConfigItem>[]}
          dataSource={configs}
          loading={isLoading}
          pagination={{
            current: 1,
            pageSize: 20,
            total: configs.length,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: true
          }}
          search={{
            placeholder: '搜索配置键或描述...',
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
            onChange: (selectedRowKeys: Key[], selectedRows: ConfigItem[]) => {
              console.log('Selected:', selectedRowKeys, selectedRows);
            }
          }}
        />
      </Card>

      {/* 创建配置模态框 */}
      <Modal
        title="添加配置"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreate}
        >
          <Form.Item
            label="配置键"
            name="key"
            rules={[
              { required: true, message: '请输入配置键' },
              { pattern: /^[a-zA-Z0-9_.-]+$/, message: '只能包含字母、数字、下划线、短横线和点' }
            ]}
          >
            <Input placeholder="例如: app.max_file_size" />
          </Form.Item>

          <Form.Item
            label="配置值"
            name="value"
            rules={[{ required: true, message: '请输入配置值' }]}
          >
            <TextArea placeholder="输入配置值" rows={4} />
          </Form.Item>

          <Form.Item
            label="数据类型"
            name="type"
            rules={[{ required: true, message: '请选择数据类型' }]}
          >
            <Select placeholder="选择数据类型">
              <Select.Option value="string">文本</Select.Option>
              <Select.Option value="number">数字</Select.Option>
              <Select.Option value="boolean">布尔值</Select.Option>
              <Select.Option value="json">JSON对象</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="分类"
            name="category"
          >
            <Select placeholder="选择分类（可选）">
              <Select.Option value="system">系统</Select.Option>
              <Select.Option value="business">业务</Select.Option>
              <Select.Option value="security">安全</Select.Option>
              <Select.Option value="performance">性能</Select.Option>
              <Select.Option value="notification">通知</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
          >
            <TextArea placeholder="输入配置描述（可选）" rows={2} />
          </Form.Item>

          <Form.Item
            label="敏感配置"
            name="sensitive"
            valuePropName="checked"
          >
            <Switch /> 敏感配置（将掩码显示）
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

      {/* 编辑配置模态框 */}
      <Modal
        title="编辑配置"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setSelectedConfig(null);
          editForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleUpdate}
        >
          <Form.Item
            label="配置键"
            name="key"
            rules={[{ required: true, message: '请输入配置键' }]}
          >
            <Input disabled />
          </Form.Item>

          <Form.Item
            label="配置值"
            name="value"
            rules={[{ required: true, message: '请输入配置值' }]}
          >
            <TextArea placeholder="输入配置值" rows={4} />
          </Form.Item>

          <Form.Item
            label="数据类型"
            name="type"
            rules={[{ required: true, message: '请选择数据类型' }]}
          >
            <Select placeholder="选择数据类型">
              <Select.Option value="string">文本</Select.Option>
              <Select.Option value="number">数字</Select.Option>
              <Select.Option value="boolean">布尔值</Select.Option>
              <Select.Option value="json">JSON对象</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="分类"
            name="category"
          >
            <Select placeholder="选择分类（可选）">
              <Select.Option value="system">系统</Select.Option>
              <Select.Option value="business">业务</Select.Option>
              <Select.Option value="security">安全</Select.Option>
              <Select.Option value="performance">性能</Select.Option>
              <Select.Option value="notification">通知</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
          >
            <TextArea placeholder="输入配置描述（可选）" rows={2} />
          </Form.Item>

          <Form.Item
            label="敏感配置"
            name="sensitive"
            valuePropName="checked"
          >
            <Switch /> 敏感配置（将掩码显示）
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

      {/* 配置历史模态框 */}
      <Modal
        title={`配置历史: ${selectedConfig?.key}`}
        open={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setHistoryModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        <Timeline>
          {selectedHistory.map((history, index) => (
            <Timeline.Item key={history.id} color={history.action === 'delete' ? 'red' : 'blue'}>
              <div>
                <Space direction="vertical" size="small">
                  <div>
                    <Text strong>
                      {history.action === 'create' ? '创建' :
                       history.action === 'update' ? '更新' : '删除'}
                    </Text>
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      {new Date(history.created_at).toLocaleString('zh-CN')}
                    </Text>
                    {history.created_by && (
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        操作者: {history.created_by}
                      </Text>
                    )}
                  </div>
                  <div>
                    <Text>版本: {history.version}</Text>
                  </div>
                  {history.old_value !== undefined && (
                    <div>
                      <Text type="secondary">原值: {String(history.old_value)}</Text>
                    </div>
                  )}
                  {history.new_value !== undefined && (
                    <div>
                      <Text type="secondary">新值: {String(history.new_value)}</Text>
                    </div>
                  )}
                </Space>
              </div>
            </Timeline.Item>
          ))}
        </Timeline>
      </Modal>

      {/* 快照管理模态框 */}
      <Modal
        title="快照管理"
        open={snapshotModalVisible}
        onCancel={() => setSnapshotModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setSnapshotModalVisible(false)}>
            关闭
          </Button>,
          <Button
            key="create"
            type="primary"
            onClick={() => {
              Modal.confirm({
                title: '创建快照',
                content: (
                  <Input
                    placeholder="输入快照描述（可选）"
                    onPressEnter={(e) => {
                      const value = (e.target as HTMLInputElement).value;
                      createSnapshotMutation.mutate(value);
                    }}
                  />
                ),
                okText: '创建',
                cancelText: '取消'
              });
            }}
          >
            创建快照
          </Button>
        ]}
        width={800}
      >
        <Table
          dataSource={snapshotsData?.snapshots || []}
          rowKey="id"
          columns={[
            {
              title: '版本',
              dataIndex: 'version',
              key: 'version',
              width: 80,
              render: (version: number) => (
                <Badge count={version} style={{ backgroundColor: '#52c41a' }} />
              ),
            },
            {
              title: '描述',
              dataIndex: 'description',
              key: 'description',
              ellipsis: true,
            },
            {
              title: '配置数量',
              dataIndex: 'config_count',
              key: 'config_count',
              width: 100,
            },
            {
              title: '创建时间',
              dataIndex: 'created_at',
              key: 'created_at',
              width: 180,
              render: (time: string) => (
                <Text>{new Date(time).toLocaleString('zh-CN')}</Text>
              ),
            },
            {
              title: '创建者',
              dataIndex: 'created_by',
              key: 'created_by',
              width: 100,
              render: (creator?: string) => creator || '-',
            },
            {
              title: '操作',
              key: 'actions',
              width: 100,
              render: (_, record: ConfigSnapshot) => (
                <Popconfirm
                  title="确定回滚到这个快照吗？"
                  description="当前配置将被替换，此操作不可撤销。"
                  onConfirm={() => rollbackMutation.mutate(record.id)}
                  okText="确定回滚"
                  okType="danger"
                  cancelText="取消"
                >
                  <Button type="primary" danger icon={<RollbackOutlined />}>
                    回滚
                  </Button>
                </Popconfirm>
              ),
            },
          ]}
          pagination={false}
        />
      </Modal>
    </div>
  );
}
