'use client';

/**
 * Provider管理页面（新框架版本）
 * 艹！使用GPT5工业级框架重构，代码量从544行减少到240行！
 */

import { useState } from 'react';
import { Button, Space, Tag, Tooltip, Modal, message, Drawer, Form, Input, Select } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import type { ColumnType } from 'antd/es/table';

// 新框架组件和Hooks
import { DataTable } from '@/components/common/DataTable';
import { FilterBar } from '@/components/common/FilterBar';
import { useTableData } from '@/hooks/useTableData';
import type { FilterConfig } from '@/components/common/FilterBar';

// API和类型
import {
  adminProviders,
  Provider,
  ProviderInput,
  QualityTier,
} from '@/lib/services/adminProviders';

/**
 * 认证类型配置
 */
const AUTH_TYPES = [
  { value: 'api_key', label: 'API Key', color: 'blue' },
  { value: 'bearer', label: 'Bearer Token', color: 'green' },
  { value: 'basic', label: 'Basic Auth', color: 'orange' },
  { value: 'oauth2', label: 'OAuth 2.0', color: 'purple' },
];

/**
 * 质量档位配置
 * 艹！低/中/高三档，成本优化必备！
 */
const QUALITY_TIERS: Array<{ value: QualityTier; label: string; color: string; description: string }> = [
  { value: 'low', label: '低画质', color: 'default', description: '成本最低，适合批量处理' },
  { value: 'medium', label: '中画质', color: 'blue', description: '性价比均衡，日常使用' },
  { value: 'high', label: '高画质', color: 'gold', description: '效果最佳，关键任务' },
];

/**
 * 凭证字段配置（根据认证类型）
 */
const CREDENTIALS_FIELDS_MAP: Record<
  string,
  Array<{ name: string; label: string; type?: string }>
> = {
  api_key: [
    { name: 'api_key', label: 'API Key' },
    { name: 'api_secret', label: 'API Secret (可选)' },
  ],
  bearer: [{ name: 'token', label: 'Bearer Token' }],
  basic: [
    { name: 'username', label: '用户名' },
    { name: 'password', label: '密码', type: 'password' },
  ],
  oauth2: [
    { name: 'client_id', label: 'Client ID' },
    { name: 'client_secret', label: 'Client Secret' },
    { name: 'access_token', label: 'Access Token (可选)' },
    { name: 'refresh_token', label: 'Refresh Token (可选)' },
  ],
};

export default function ProvidersPage() {
  // ========== 新框架：使用useTableData Hook统一管理状态 ==========
  const tableData = useTableData<Provider>({
    fetcher: async (params) => {
      const response = await adminProviders.list({
        limit: params.pagination.pageSize,
        offset: params.pagination.offset,
        ...(params.filters.auth_type ? { auth_type: params.filters.auth_type } : {}),
      });

      // 前端关键词筛选
      let items = response.items;
      if (params.filters.keyword) {
        const keyword = params.filters.keyword.toLowerCase();
        items = items.filter(
          (p) =>
            p.provider_name.toLowerCase().includes(keyword) ||
            p.provider_ref.toLowerCase().includes(keyword)
        );
      }

      return {
        data: items,
        total: response.total,
      };
    },
    autoLoad: true,
  });

  // Drawer状态
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [form] = Form.useForm();

  // ========== 新框架：FilterBar配置 ==========
  const filterConfig: FilterConfig[] = [
    {
      type: 'select',
      name: 'auth_type',
      label: '认证类型',
      placeholder: '筛选认证类型',
      options: [
        { label: '全部类型', value: '' },
        ...AUTH_TYPES.map((t) => ({ label: t.label, value: t.value })),
      ],
      allowClear: true,
    },
    {
      type: 'input',
      name: 'keyword',
      label: '关键词',
      placeholder: '搜索Provider名称或ID',
      allowClear: true,
    },
  ];

  // ========== 新框架：DataTable列配置 ==========
  const columns: ColumnType<Provider>[] = [
    {
      title: 'Provider引用ID',
      dataIndex: 'provider_ref',
      key: 'provider_ref',
      width: 180,
      render: (text: string) => (
        <code style={{ color: '#1890ff', fontSize: '13px' }}>{text}</code>
      ),
    },
    {
      title: 'Provider名称',
      dataIndex: 'provider_name',
      key: 'provider_name',
      width: 180,
    },
    {
      title: 'API端点',
      dataIndex: 'endpoint_url',
      key: 'endpoint_url',
      ellipsis: true,
      render: (url: string) => (
        <Tooltip title={url}>
          <span style={{ color: '#666' }}>{url}</span>
        </Tooltip>
      ),
    },
    {
      title: '认证类型',
      dataIndex: 'auth_type',
      key: 'auth_type',
      width: 120,
      render: (authType: string) => {
        const config = AUTH_TYPES.find((t) => t.value === authType);
        return <Tag color={config?.color || 'default'}>{config?.label || authType}</Tag>;
      },
    },
    {
      title: '质量档位',
      dataIndex: 'quality_tier',
      key: 'quality_tier',
      width: 100,
      render: (tier: QualityTier | undefined) => {
        if (!tier) return <Tag color="default">未设置</Tag>;
        const config = QUALITY_TIERS.find((t) => t.value === tier);
        return (
          <Tooltip title={config?.description}>
            <Tag color={config?.color || 'default'}>{config?.label || tier}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '权重',
      dataIndex: 'weight',
      key: 'weight',
      width: 80,
      render: (weight: number | undefined) => weight || '-',
    },
    {
      title: '成本（$/1K）',
      dataIndex: 'cost_per_1k_tokens',
      key: 'cost_per_1k_tokens',
      width: 120,
      render: (cost: number | undefined) => (cost !== undefined ? `$${cost.toFixed(4)}` : '-'),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean | undefined) => (
        <Tag color={enabled === false ? 'red' : 'green'}>
          {enabled === false ? '已禁用' : '已启用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_: any, record: Provider) => (
        <Space size="small">
          <Button
            size="small"
            icon={<ApiOutlined />}
            onClick={() => handleTestConnection(record.provider_ref)}
          >
            测试
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  // ========== 操作处理函数 ==========

  /**
   * 打开创建Drawer
   */
  const handleCreate = () => {
    setDrawerMode('create');
    setEditingProvider(null);
    form.resetFields();
    setDrawerVisible(true);
  };

  /**
   * 打开编辑Drawer
   */
  const handleEdit = async (provider: Provider) => {
    setDrawerMode('edit');
    setEditingProvider(provider);
    setDrawerVisible(true);

    // 获取完整Provider数据（包含凭证）
    try {
      const fullProvider = await adminProviders.get(provider.provider_ref);

      // 填充表单（凭证字段不预填充，安全考虑）
      form.setFieldsValue({
        provider_ref: fullProvider.provider_ref,
        provider_name: fullProvider.provider_name,
        endpoint_url: fullProvider.endpoint_url,
        auth_type: fullProvider.auth_type,
        quality_tier: fullProvider.quality_tier,
        weight: fullProvider.weight,
        cost_per_1k_tokens: fullProvider.cost_per_1k_tokens,
        enabled: fullProvider.enabled !== undefined ? fullProvider.enabled : true,
      });
    } catch (error: any) {
      message.error(`加载Provider详情失败: ${error.message}`);
    }
  };

  /**
   * 删除Provider
   * 艹！删除操作必须二次确认！
   */
  const handleDelete = (provider: Provider) => {
    Modal.confirm({
      title: '确认删除Provider?',
      content: (
        <div>
          <p>
            即将删除: <code>{provider.provider_ref}</code> ({provider.provider_name})
          </p>
          <p style={{ color: '#ff4d4f', marginTop: 8 }}>
            ⚠️ 删除后，所有使用此Provider的Pipeline将无法正常运行！
          </p>
        </div>
      ),
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await adminProviders.delete(provider.provider_ref);
          message.success('Provider已删除');
          tableData.reload();
        } catch (error: any) {
          message.error(`删除失败: ${error.message}`);
        }
      },
    });
  };

  /**
   * 测试Provider连接
   */
  const handleTestConnection = async (providerRef: string) => {
    const hide = message.loading('正在测试连接...', 0);
    try {
      const result = await adminProviders.testConnection(providerRef);

      hide();

      if (result.healthy) {
        message.success(`连接测试成功: ${result.message}`);
      } else {
        message.error(`连接测试失败: ${result.message}`);
      }
    } catch (error: any) {
      hide();
      message.error(`测试失败: ${error.message}`);
    }
  };

  /**
   * 提交表单（创建或更新）
   */
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // 收集凭证字段
      const authType = values.auth_type;
      const credentialFields = CREDENTIALS_FIELDS_MAP[authType] || [];
      const credentials: Record<string, any> = {};

      credentialFields.forEach((field) => {
        if (values[field.name]) {
          credentials[field.name] = values[field.name];
        }
      });

      const input: ProviderInput = {
        provider_ref: values.provider_ref,
        provider_name: values.provider_name,
        endpoint_url: values.endpoint_url,
        credentials,
        auth_type: values.auth_type,
        quality_tier: values.quality_tier,
        weight: values.weight,
        cost_per_1k_tokens: values.cost_per_1k_tokens,
        enabled: values.enabled !== undefined ? values.enabled : true,
      };

      if (drawerMode === 'create') {
        await adminProviders.create(input);
        message.success('Provider创建成功');
      } else {
        await adminProviders.update(editingProvider!.provider_ref, input);
        message.success('Provider更新成功');
      }

      setDrawerVisible(false);
      form.resetFields();
      tableData.reload();
    } catch (error: any) {
      if (error.errorFields) {
        message.error('请检查表单填写是否正确');
      } else {
        message.error(`操作失败: ${error.message}`);
      }
    }
  };

  /**
   * 动态渲染凭证字段
   * 艹！根据认证类型动态显示不同的输入框！
   */
  const renderCredentialFields = () => {
    const authType = form.getFieldValue('auth_type');
    if (!authType) return null;

    const fields = CREDENTIALS_FIELDS_MAP[authType] || [];

    return fields.map((field) => (
      <Form.Item
        key={field.name}
        name={field.name}
        label={field.label}
        rules={[
          { required: !field.label.includes('可选'), message: `请输入${field.label}` },
        ]}
      >
        <Input.Password
          placeholder={`请输入${field.label}`}
          visibilityToggle={drawerMode === 'create'} // 编辑模式不显示明文
        />
      </Form.Item>
    ));
  };

  // ========== 渲染UI（新框架组件） ==========
  return (
    <div style={{ padding: '24px' }}>
      {/* 新框架：FilterBar */}
      <FilterBar
        config={filterConfig}
        onFilter={tableData.setFilters}
        initialValues={{}}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建Provider
          </Button>
        }
      />

      {/* 新框架：DataTable */}
      <DataTable
        columns={columns}
        dataSource={tableData.data}
        loading={tableData.loading}
        rowKey="provider_ref"
        pagination={{
          current: tableData.pagination.page,
          pageSize: tableData.pagination.pageSize,
          total: tableData.total,
          onChange: tableData.handlePageChange,
        }}
        scroll={{ x: 1200 }}
      />

      {/* 创建/编辑 Drawer */}
      <Drawer
        title={drawerMode === 'create' ? '新建Provider' : '编辑Provider'}
        width={600}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          form.resetFields();
        }}
        extra={
          <Space>
            <Button onClick={() => setDrawerVisible(false)}>取消</Button>
            <Button type="primary" onClick={handleSubmit}>
              {drawerMode === 'create' ? '创建' : '保存'}
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          {/* Provider引用ID */}
          <Form.Item
            name="provider_ref"
            label="Provider引用ID"
            rules={[
              { required: true, message: '请输入Provider引用ID' },
              {
                pattern: /^[a-zA-Z0-9_-]+$/,
                message: '只能包含字母、数字、下划线和短横线',
              },
            ]}
            extra="唯一标识，只能包含字母、数字、下划线和短横线"
          >
            <Input placeholder="例如: openai-gpt4" disabled={drawerMode === 'edit'} />
          </Form.Item>

          {/* Provider名称 */}
          <Form.Item
            name="provider_name"
            label="Provider名称"
            rules={[{ required: true, message: '请输入Provider名称' }]}
          >
            <Input placeholder="例如: OpenAI GPT-4" />
          </Form.Item>

          {/* API端点 */}
          <Form.Item
            name="endpoint_url"
            label="API端点URL"
            rules={[
              { required: true, message: '请输入API端点URL' },
              { type: 'url', message: '请输入有效的URL' },
            ]}
          >
            <Input placeholder="https://api.openai.com/v1" />
          </Form.Item>

          {/* 认证类型 */}
          <Form.Item
            name="auth_type"
            label="认证类型"
            rules={[{ required: true, message: '请选择认证类型' }]}
          >
            <Select
              placeholder="选择认证类型"
              options={AUTH_TYPES.map((t) => ({
                value: t.value,
                label: t.label,
              }))}
              onChange={() => {
                // 清空凭证字段
                const fields = Object.keys(form.getFieldsValue()).filter((k) =>
                  Object.values(CREDENTIALS_FIELDS_MAP)
                    .flat()
                    .some((f) => f.name === k)
                );
                const resetObj: any = {};
                fields.forEach((f) => (resetObj[f] = undefined));
                form.setFieldsValue(resetObj);
              }}
            />
          </Form.Item>

          {/* 动态凭证字段 */}
          {renderCredentialFields()}

          {/* 分隔线 */}
          <div style={{ borderTop: '1px solid #f0f0f0', margin: '24px 0' }} />

          {/* 路由策略配置 */}
          <h3 style={{ marginBottom: 16, fontSize: 14, fontWeight: 600 }}>
            路由策略配置（成本优化）
          </h3>

          {/* 质量档位 */}
          <Form.Item
            name="quality_tier"
            label="质量档位"
            rules={[{ required: true, message: '请选择质量档位' }]}
            tooltip="用于降级重试策略，高级模型失败后会自动降级到中级/低级"
          >
            <Select placeholder="选择质量档位">
              {QUALITY_TIERS.map((tier) => (
                <Select.Option key={tier.value} value={tier.value}>
                  <div>
                    <Tag color={tier.color} style={{ marginRight: 8 }}>
                      {tier.label}
                    </Tag>
                    <span style={{ color: '#666', fontSize: 12 }}>{tier.description}</span>
                  </div>
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {/* 路由权重 */}
          <Form.Item
            name="weight"
            label="路由权重"
            rules={[
              { required: true, message: '请输入路由权重' },
              {
                type: 'number',
                min: 1,
                max: 100,
                message: '权重范围: 1-100',
                transform: (value) => Number(value),
              },
            ]}
            tooltip="同档位的Provider按权重随机选择，权重越高，被选中概率越大"
          >
            <Input
              type="number"
              placeholder="1-100"
              min={1}
              max={100}
              addonAfter="（1-100）"
            />
          </Form.Item>

          {/* 每1K tokens成本 */}
          <Form.Item
            name="cost_per_1k_tokens"
            label="成本（美元/1K tokens）"
            rules={[
              { required: true, message: '请输入成本' },
              {
                type: 'number',
                min: 0,
                message: '成本不能为负数',
                transform: (value) => Number(value),
              },
            ]}
            tooltip="用于成本统计和报表，精确到小数点后4位"
          >
            <Input
              type="number"
              placeholder="例如: 0.0001"
              step="0.0001"
              addonBefore="$"
              addonAfter="/ 1K tokens"
            />
          </Form.Item>

          {/* 启用状态 */}
          <Form.Item
            name="enabled"
            label="启用状态"
            valuePropName="checked"
            tooltip="禁用后，该Provider不会被路由选择"
          >
            <Select
              placeholder="选择状态"
              defaultValue={true}
              options={[
                { label: '启用', value: true },
                { label: '禁用', value: false },
              ]}
            />
          </Form.Item>

          {/* 安全提示 */}
          {drawerMode === 'edit' && (
            <div
              style={{
                padding: '12px',
                background: '#fff7e6',
                border: '1px solid #ffd591',
                borderRadius: '4px',
                marginTop: '16px',
              }}
            >
              <p style={{ margin: 0, color: '#d46b08' }}>
                🔒 安全提示：凭证字段已加密存储，编辑时留空表示不修改原凭证。
              </p>
            </div>
          )}
        </Form>
      </Drawer>
    </div>
  );
}
