'use client';

/**
 * A/B实验管理页面
 * 艹！这个页面让管理员管理所有A/B实验！
 *
 * @author 老王
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  message,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Typography,
  Divider,
  Alert,
  Spin,
} from 'antd';
import {
  ExperimentOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import type { ColumnType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

/**
 * 实验状态
 */
export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed';

/**
 * 实验变体
 */
export interface ExperimentVariant {
  id: string;
  name: string;
  description?: string;
  weight: number; // 权重（用于流量分配）
  config?: Record<string, any>; // 变体配置
}

/**
 * A/B实验配置
 */
export interface Experiment {
  id: string;
  name: string;
  description: string;
  status: ExperimentStatus;
  traffic_allocation: number; // 流量分配比例 (0-100)
  variants: ExperimentVariant[];
  created_at: string;
  updated_at: string;
  start_date?: string;
  end_date?: string;
  creator?: string;
  metrics?: {
    exposure_count: number; // 曝光数
    conversion_count: number; // 转化数
    conversion_rate: number; // 转化率
  };
}

/**
 * 实验状态配置
 */
const STATUS_CONFIG: Record<
  ExperimentStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  draft: {
    label: '草稿',
    color: 'default',
    icon: <EditOutlined />,
  },
  running: {
    label: '进行中',
    color: 'green',
    icon: <PlayCircleOutlined />,
  },
  paused: {
    label: '已暂停',
    color: 'orange',
    icon: <PauseCircleOutlined />,
  },
  completed: {
    label: '已完成',
    color: 'blue',
    icon: <CheckCircleOutlined />,
  },
};

/**
 * A/B实验管理页面
 */
export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(false);

  // 创建/编辑Modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingExperiment, setEditingExperiment] = useState<Experiment | null>(null);
  const [form] = Form.useForm();

  /**
   * 加载实验列表
   */
  const loadExperiments = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/admin/experiments', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`获取实验列表失败: ${response.status}`);
      }

      const data = await response.json();
      setExperiments(data.experiments || []);
    } catch (error: any) {
      console.error('[A/B实验管理] 获取实验列表失败:', error);
      message.error(error.message || '获取实验列表失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 创建实验
   */
  const handleCreate = () => {
    setEditingExperiment(null);
    form.resetFields();
    form.setFieldsValue({
      status: 'draft',
      traffic_allocation: 100,
      variants: [
        { id: 'control', name: '对照组', weight: 50, config: {} },
        { id: 'variant_a', name: '实验组A', weight: 50, config: {} },
      ],
    });
    setEditModalVisible(true);
  };

  /**
   * 编辑实验
   */
  const handleEdit = (experiment: Experiment) => {
    setEditingExperiment(experiment);
    form.setFieldsValue(experiment);
    setEditModalVisible(true);
  };

  /**
   * 保存实验
   */
  const handleSave = async (values: any) => {
    try {
      const url = editingExperiment
        ? `/api/admin/experiments/${editingExperiment.id}`
        : '/api/admin/experiments';

      const response = await fetch(url, {
        method: editingExperiment ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error(`保存实验失败: ${response.status}`);
      }

      message.success(editingExperiment ? '实验更新成功' : '实验创建成功');
      setEditModalVisible(false);
      loadExperiments();
    } catch (error: any) {
      console.error('[A/B实验管理] 保存实验失败:', error);
      message.error(error.message || '保存实验失败');
    }
  };

  /**
   * 删除实验
   */
  const handleDelete = (experiment: Experiment) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除实验 "${experiment.name}" 吗？此操作不可恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await fetch(`/api/admin/experiments/${experiment.id}`, {
            method: 'DELETE',
          });

          if (!response.ok) {
            throw new Error(`删除实验失败: ${response.status}`);
          }

          message.success('实验已删除');
          loadExperiments();
        } catch (error: any) {
          console.error('[A/B实验管理] 删除实验失败:', error);
          message.error(error.message || '删除实验失败');
        }
      },
    });
  };

  /**
   * 启动实验
   */
  const handleStart = async (experiment: Experiment) => {
    try {
      const response = await fetch(`/api/admin/experiments/${experiment.id}/start`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`启动实验失败: ${response.status}`);
      }

      message.success('实验已启动');
      loadExperiments();
    } catch (error: any) {
      console.error('[A/B实验管理] 启动实验失败:', error);
      message.error(error.message || '启动实验失败');
    }
  };

  /**
   * 暂停实验
   */
  const handlePause = async (experiment: Experiment) => {
    try {
      const response = await fetch(`/api/admin/experiments/${experiment.id}/pause`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`暂停实验失败: ${response.status}`);
      }

      message.success('实验已暂停');
      loadExperiments();
    } catch (error: any) {
      console.error('[A/B实验管理] 暂停实验失败:', error);
      message.error(error.message || '暂停实验失败');
    }
  };

  /**
   * 完成实验
   */
  const handleComplete = async (experiment: Experiment) => {
    Modal.confirm({
      title: '确认完成',
      content: `确定要完成实验 "${experiment.name}" 吗？完成后将不再收集数据。`,
      okText: '完成',
      cancelText: '取消',
      onOk: async () => {
        try {
          const response = await fetch(`/api/admin/experiments/${experiment.id}/complete`, {
            method: 'POST',
          });

          if (!response.ok) {
            throw new Error(`完成实验失败: ${response.status}`);
          }

          message.success('实验已完成');
          loadExperiments();
        } catch (error: any) {
          console.error('[A/B实验管理] 完成实验失败:', error);
          message.error(error.message || '完成实验失败');
        }
      },
    });
  };

  /**
   * 初始化
   */
  useEffect(() => {
    loadExperiments();
  }, []);

  /**
   * 实验表格列
   */
  const columns: ColumnType<Experiment>[] = [
    {
      title: '实验名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name: string, record: Experiment) => (
        <div>
          <Text strong>{name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.id}
          </Text>
        </div>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 250,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ExperimentStatus) => {
        const config = STATUS_CONFIG[status];
        return (
          <Tag icon={config.icon} color={config.color}>
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: '流量分配',
      dataIndex: 'traffic_allocation',
      key: 'traffic_allocation',
      width: 100,
      render: (allocation: number) => `${allocation}%`,
    },
    {
      title: '变体数',
      dataIndex: 'variants',
      key: 'variants',
      width: 80,
      render: (variants: ExperimentVariant[]) => variants.length,
    },
    {
      title: '曝光/转化',
      key: 'metrics',
      width: 120,
      render: (_, record: Experiment) => {
        if (!record.metrics) return '-';
        return (
          <div>
            <div>曝光: {record.metrics.exposure_count.toLocaleString()}</div>
            <div>转化: {record.metrics.conversion_count.toLocaleString()}</div>
            <div>
              <Text type="success">CVR: {(record.metrics.conversion_rate * 100).toFixed(2)}%</Text>
            </div>
          </div>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      fixed: 'right',
      render: (_, record: Experiment) => (
        <Space>
          {record.status === 'draft' && (
            <Button
              type="primary"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStart(record)}
            >
              启动
            </Button>
          )}

          {record.status === 'running' && (
            <>
              <Button
                size="small"
                icon={<PauseCircleOutlined />}
                onClick={() => handlePause(record)}
              >
                暂停
              </Button>
              <Button
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleComplete(record)}
              >
                完成
              </Button>
            </>
          )}

          {record.status === 'paused' && (
            <Button
              type="primary"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStart(record)}
            >
              继续
            </Button>
          )}

          <Button size="small" icon={<BarChartOutlined />}>
            数据
          </Button>

          {record.status !== 'running' && (
            <>
              <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
                编辑
              </Button>
              <Button
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record)}
              >
                删除
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between' }}>
        <Title level={3} style={{ margin: 0 }}>
          <ExperimentOutlined style={{ marginRight: 8 }} />
          A/B实验管理
        </Title>

        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          创建实验
        </Button>
      </div>

      {/* 实验列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={experiments}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={{
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个实验`,
            defaultPageSize: 10,
          }}
        />
      </Card>

      {/* 创建/编辑Modal */}
      <Modal
        title={
          <span>
            <ExperimentOutlined style={{ marginRight: 8 }} />
            {editingExperiment ? '编辑实验' : '创建实验'}
          </span>
        }
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={() => form.submit()}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          {/* 基本信息 */}
          <Title level={5}>基本信息</Title>

          <Form.Item
            label="实验名称"
            name="name"
            rules={[{ required: true, message: '请输入实验名称' }]}
          >
            <Input placeholder="例如：模板排序实验" />
          </Form.Item>

          <Form.Item
            label="实验描述"
            name="description"
            rules={[{ required: true, message: '请输入实验描述' }]}
          >
            <TextArea rows={3} placeholder="简要描述实验目的和预期效果" />
          </Form.Item>

          <Form.Item label="实验状态" name="status">
            <Select
              options={[
                { label: '草稿', value: 'draft' },
                { label: '进行中', value: 'running' },
                { label: '已暂停', value: 'paused' },
                { label: '已完成', value: 'completed' },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="流量分配比例"
            name="traffic_allocation"
            tooltip="参与实验的用户比例（0-100%）"
            rules={[{ required: true, message: '请输入流量分配比例' }]}
          >
            <InputNumber
              min={0}
              max={100}
              style={{ width: '100%' }}
              addonAfter="%"
              placeholder="例如：100表示全部用户参与"
            />
          </Form.Item>

          <Divider />

          {/* 变体配置 */}
          <Title level={5}>变体配置</Title>

          <Alert
            message="温馨提示"
            description="至少需要2个变体（对照组和实验组）。权重总和建议为100。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.List name="variants">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }, index) => (
                  <Card
                    key={key}
                    size="small"
                    title={`变体 ${index + 1}`}
                    extra={
                      fields.length > 2 && (
                        <Button
                          type="link"
                          danger
                          size="small"
                          onClick={() => remove(name)}
                          icon={<DeleteOutlined />}
                        >
                          删除
                        </Button>
                      )
                    }
                    style={{ marginBottom: 16 }}
                  >
                    <Form.Item
                      {...restField}
                      label="变体ID"
                      name={[name, 'id']}
                      rules={[{ required: true, message: '请输入变体ID' }]}
                    >
                      <Input placeholder="例如：control, variant_a" />
                    </Form.Item>

                    <Form.Item
                      {...restField}
                      label="变体名称"
                      name={[name, 'name']}
                      rules={[{ required: true, message: '请输入变体名称' }]}
                    >
                      <Input placeholder="例如：对照组、实验组A" />
                    </Form.Item>

                    <Form.Item {...restField} label="变体描述" name={[name, 'description']}>
                      <Input placeholder="简要描述变体特点" />
                    </Form.Item>

                    <Form.Item
                      {...restField}
                      label="权重"
                      name={[name, 'weight']}
                      rules={[{ required: true, message: '请输入权重' }]}
                    >
                      <InputNumber
                        min={0}
                        max={100}
                        style={{ width: '100%' }}
                        placeholder="权重（用于流量分配）"
                      />
                    </Form.Item>
                  </Card>
                ))}

                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  添加变体
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
}
