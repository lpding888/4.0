/**
 * REL-E-04: 灾备回滚管理页面
 * 艹!5分钟内恢复到上个稳定版本,这是生产环境的救命稻草!
 *
 * 功能清单:
 * 1. 版本历史查看
 * 2. 创建回滚点
 * 3. 一键回滚 (配置/模板/样式/全量)
 * 4. 回滚模拟(Dry Run)
 * 5. 回滚历史记录
 * 6. 版本对比
 *
 * @author 老王
 */

'use client';

import { useState } from 'react';
import {
  Card,
  Button,
  Space,
  Tag,
  Timeline,
  Modal,
  Form,
  Input,
  Select,
  Alert,
  Row,
  Col,
  Statistic,
  Steps,
  Typography,
  Divider,
  Badge,
  Tooltip,
  Progress,
  Descriptions,
  message,
  Table,
} from 'antd';
import {
  RollbackOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  SaveOutlined,
  PlayCircleOutlined,
  HistoryOutlined,
  BranchesOutlined,
  CodeOutlined,
  DatabaseOutlined,
  ThunderboltOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { ColumnsType } from 'antd/es/table';
import {
  type VersionInfo,
  type RollbackPoint,
  type RollbackHistory,
  getVersionInfo,
  compareVersion,
  formatVersionInfo,
  generateRollbackPlan,
  estimateRollbackImpact,
  canRollback,
  validateRollbackPoint,
} from '@/lib/rollback/version-manager';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Step } = Steps;

export default function RollbackManagementPage() {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // 状态
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [rollbackModalVisible, setRollbackModalVisible] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<RollbackPoint | null>(null);
  const [rollbackType, setRollbackType] = useState<'full' | 'config' | 'template' | 'style'>('full');
  const [dryRunMode, setDryRunMode] = useState(false);

  // 获取当前版本
  const currentVersion = getVersionInfo();

  // 获取回滚点列表
  const { data: pointsData, isLoading: pointsLoading } = useQuery({
    queryKey: ['rollbackPoints'],
    queryFn: async () => {
      // Mock数据 - 实际应该调用API
      return {
        points: [
          {
            id: '1',
            version: {
              version: '1.2.0',
              build: '100',
              commitHash: 'abc123',
              commitMessage: 'Release 1.2.0',
              buildTime: '2025-10-01T10:00:00Z',
              branch: 'main',
              environment: 'production' as const,
            },
            description: 'P2阶段完成版本 - 稳定',
            created_at: '2025-10-01T10:00:00Z',
            created_by: 'admin',
            snapshot: {
              configs: {},
              templates: {},
              styles: {},
            },
            status: 'active' as const,
          },
          {
            id: '2',
            version: {
              version: '1.1.5',
              build: '95',
              commitHash: 'def456',
              commitMessage: 'Hotfix: Fix critical bug',
              buildTime: '2025-09-25T15:30:00Z',
              branch: 'main',
              environment: 'production' as const,
            },
            description: '紧急修复版本',
            created_at: '2025-09-25T15:30:00Z',
            created_by: 'admin',
            snapshot: {
              configs: {},
            },
            status: 'active' as const,
          },
        ] as RollbackPoint[],
      };
    },
  });

  // 获取回滚历史
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['rollbackHistory'],
    queryFn: async () => {
      // Mock数据
      return {
        history: [
          {
            id: '1',
            from_version: '1.2.1',
            to_version: '1.2.0',
            rollback_type: 'config' as const,
            performed_at: '2025-11-01T08:00:00Z',
            performed_by: 'admin',
            reason: '配置错误导致服务异常',
            success: true,
            duration_ms: 45000,
            details: '成功回滚到稳定版本',
          },
          {
            id: '2',
            from_version: '1.2.0',
            to_version: '1.1.5',
            rollback_type: 'full' as const,
            performed_at: '2025-10-15T14:30:00Z',
            performed_by: 'admin',
            reason: '新版本性能问题',
            success: true,
            duration_ms: 280000,
            details: '全量回滚完成,服务恢复正常',
          },
        ] as RollbackHistory[],
      };
    },
  });

  // 创建回滚点
  const createPointMutation = useMutation({
    mutationFn: async (values: any) => {
      // Mock - 实际应该调用API
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { success: true };
    },
    onSuccess: () => {
      message.success('回滚点创建成功');
      setCreateModalVisible(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['rollbackPoints'] });
    },
  });

  // 执行回滚
  const rollbackMutation = useMutation({
    mutationFn: async (params: {
      pointId: string;
      type: string;
      dryRun: boolean;
      reason: string;
    }) => {
      // Mock - 实际应该调用API
      await new Promise(resolve => setTimeout(resolve, dryRun ? 500 : 3000));
      return {
        success: true,
        duration_ms: dryRun ? 500 : 3000,
        message: dryRun ? '模拟回滚成功,实际不会执行操作' : '回滚成功',
      };
    },
    onSuccess: (data, variables) => {
      if (variables.dryRun) {
        message.info(data.message);
      } else {
        message.success(data.message);
        queryClient.invalidateQueries({ queryKey: ['rollbackHistory'] });
      }
      setRollbackModalVisible(false);
      setSelectedPoint(null);
    },
  });

  // 处理创建回滚点
  const handleCreatePoint = async (values: any) => {
    createPointMutation.mutate(values);
  };

  // 处理回滚
  const handleRollback = async (values: any) => {
    if (!selectedPoint) return;

    rollbackMutation.mutate({
      pointId: selectedPoint.id,
      type: rollbackType,
      dryRun: dryRunMode,
      reason: values.reason,
    });
  };

  // 打开回滚模态框
  const openRollbackModal = (point: RollbackPoint) => {
    setSelectedPoint(point);
    setRollbackModalVisible(true);
  };

  // 回滚点列表列定义
  const pointColumns: ColumnsType<RollbackPoint> = [
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      render: (version: VersionInfo) => (
        <Space direction="vertical" size="small">
          <Text strong>{version.version}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Build: {version.build}
          </Text>
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Commit',
      dataIndex: 'version',
      key: 'commit',
      render: (version: VersionInfo) => (
        <Space direction="vertical" size="small">
          <Tooltip title={version.commitMessage}>
            <Text code style={{ fontSize: 12 }}>
              {version.commitHash.substring(0, 7)}
            </Text>
          </Tooltip>
          <Tag color="blue">{version.branch}</Tag>
        </Space>
      ),
    },
    {
      title: '环境',
      dataIndex: 'version',
      key: 'environment',
      render: (version: VersionInfo) => {
        const colorMap = {
          production: 'green',
          staging: 'orange',
          development: 'blue',
        };
        return <Tag color={colorMap[version.environment]}>{version.environment}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time: string) => new Date(time).toLocaleString('zh-CN'),
    },
    {
      title: '创建者',
      dataIndex: 'created_by',
      key: 'created_by',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        status === 'active' ? <Badge status="success" text="可用" /> : <Badge status="default" text="已归档" />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<RollbackOutlined />}
            onClick={() => openRollbackModal(record)}
            disabled={record.status !== 'active'}
          >
            回滚
          </Button>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              Modal.info({
                title: '回滚点详情',
                width: 800,
                content: (
                  <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label="版本">{record.version.version}</Descriptions.Item>
                    <Descriptions.Item label="构建号">{record.version.build}</Descriptions.Item>
                    <Descriptions.Item label="Commit">{record.version.commitHash}</Descriptions.Item>
                    <Descriptions.Item label="Commit消息">{record.version.commitMessage}</Descriptions.Item>
                    <Descriptions.Item label="分支">{record.version.branch}</Descriptions.Item>
                    <Descriptions.Item label="构建时间">
                      {new Date(record.version.buildTime).toLocaleString('zh-CN')}
                    </Descriptions.Item>
                    <Descriptions.Item label="环境">{record.version.environment}</Descriptions.Item>
                  </Descriptions>
                ),
              });
            }}
          >
            详情
          </Button>
        </Space>
      ),
    },
  ];

  // 回滚历史列定义
  const historyColumns: ColumnsType<RollbackHistory> = [
    {
      title: '执行时间',
      dataIndex: 'performed_at',
      key: 'performed_at',
      render: (time: string) => new Date(time).toLocaleString('zh-CN'),
    },
    {
      title: '源版本',
      dataIndex: 'from_version',
      key: 'from_version',
      render: (v: string) => <Tag color="orange">{v}</Tag>,
    },
    {
      title: '目标版本',
      dataIndex: 'to_version',
      key: 'to_version',
      render: (v: string) => <Tag color="green">{v}</Tag>,
    },
    {
      title: '回滚类型',
      dataIndex: 'rollback_type',
      key: 'rollback_type',
      render: (type: string) => {
        const typeMap: Record<string, { text: string; color: string }> = {
          full: { text: '全量回滚', color: 'red' },
          config: { text: '配置回滚', color: 'blue' },
          template: { text: '模板回滚', color: 'purple' },
          style: { text: '样式回滚', color: 'cyan' },
        };
        const info = typeMap[type] || { text: type, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: '耗时',
      dataIndex: 'duration_ms',
      key: 'duration_ms',
      render: (ms: number) => `${(ms / 1000).toFixed(1)}秒`,
    },
    {
      title: '执行者',
      dataIndex: 'performed_by',
      key: 'performed_by',
    },
    {
      title: '状态',
      dataIndex: 'success',
      key: 'success',
      render: (success: boolean) => (
        success ? <Badge status="success" text="成功" /> : <Badge status="error" text="失败" />
      ),
    },
  ];

  const points = pointsData?.points || [];
  const history = historyData?.history || [];

  // 生成回滚计划
  const rollbackPlan = selectedPoint
    ? generateRollbackPlan(currentVersion.version, selectedPoint.version.version, rollbackType)
    : null;

  // 评估回滚影响
  const rollbackImpact = selectedPoint
    ? estimateRollbackImpact(currentVersion.version, selectedPoint.version.version)
    : null;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 页面头部 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <RollbackOutlined className="text-3xl text-red-600" />
            <div>
              <Title level={2} className="mb-1">灾备回滚</Title>
              <Text type="secondary">版本管理与快速回滚,5分钟内恢复到稳定版本</Text>
            </div>
          </div>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            创建回滚点
          </Button>
        </div>

        {/* 当前版本信息 */}
        <Alert
          message="当前运行版本"
          description={
            <Descriptions column={4} size="small">
              <Descriptions.Item label="版本号">{currentVersion.version}</Descriptions.Item>
              <Descriptions.Item label="构建号">{currentVersion.build}</Descriptions.Item>
              <Descriptions.Item label="环境">
                <Tag color="green">{currentVersion.environment}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="构建时间">
                {new Date(currentVersion.buildTime).toLocaleString('zh-CN')}
              </Descriptions.Item>
            </Descriptions>
          }
          type="info"
          showIcon
          icon={<CodeOutlined />}
          className="mb-4"
        />

        {/* 统计卡片 */}
        <Row gutter={16} className="mb-6">
          <Col span={6}>
            <Card>
              <Statistic
                title="可用回滚点"
                value={points.filter(p => p.status === 'active').length}
                prefix={<DatabaseOutlined />}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="回滚次数"
                value={history.length}
                prefix={<HistoryOutlined />}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="成功率"
                value={history.length > 0 ? (history.filter(h => h.success).length / history.length * 100).toFixed(1) : 100}
                suffix="%"
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="平均耗时"
                value={
                  history.length > 0
                    ? (history.reduce((sum, h) => sum + h.duration_ms, 0) / history.length / 1000).toFixed(1)
                    : 0
                }
                suffix="秒"
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>
      </div>

      {/* 回滚点列表 */}
      <Card title="回滚点" className="mb-6">
        <Table
          columns={pointColumns}
          dataSource={points}
          rowKey="id"
          loading={pointsLoading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 回滚历史 */}
      <Card title="回滚历史">
        <Table
          columns={historyColumns}
          dataSource={history}
          rowKey="id"
          loading={historyLoading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 创建回滚点模态框 */}
      <Modal
        title="创建回滚点"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Alert
          message="提示"
          description="创建回滚点将保存当前版本的完整快照,包括配置、模板和样式。建议在每次发布后创建回滚点。"
          type="info"
          showIcon
          className="mb-4"
        />
        <Form form={form} layout="vertical" onFinish={handleCreatePoint}>
          <Form.Item
            label="描述"
            name="description"
            rules={[{ required: true, message: '请输入回滚点描述' }]}
          >
            <TextArea
              placeholder="例如: P3阶段完成版本 - 新增XX功能"
              rows={3}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={createPointMutation.isLoading}>
                创建
              </Button>
              <Button onClick={() => setCreateModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 回滚模态框 */}
      <Modal
        title="执行回滚"
        open={rollbackModalVisible}
        onCancel={() => {
          setRollbackModalVisible(false);
          setSelectedPoint(null);
          setDryRunMode(false);
        }}
        footer={null}
        width={800}
      >
        {selectedPoint && (
          <>
            {/* 回滚信息 */}
            <Alert
              message="回滚警告"
              description="回滚操作可能会影响正在使用的用户,请确保已做好充分准备。建议先使用模拟模式验证。"
              type="warning"
              showIcon
              className="mb-4"
            />

            <Descriptions column={2} bordered size="small" className="mb-4">
              <Descriptions.Item label="当前版本">{currentVersion.version}</Descriptions.Item>
              <Descriptions.Item label="目标版本">{selectedPoint.version.version}</Descriptions.Item>
              <Descriptions.Item label="回滚类型">
                <Select
                  value={rollbackType}
                  onChange={(val) => setRollbackType(val)}
                  style={{ width: 200 }}
                >
                  <Select.Option value="full">全量回滚</Select.Option>
                  <Select.Option value="config">仅配置</Select.Option>
                  <Select.Option value="template">仅模板</Select.Option>
                  <Select.Option value="style">仅样式</Select.Option>
                </Select>
              </Descriptions.Item>
              <Descriptions.Item label="预计耗时">
                {rollbackPlan && `${rollbackPlan.estimatedTime}秒`}
              </Descriptions.Item>
            </Descriptions>

            {/* 回滚影响评估 */}
            {rollbackImpact && (
              <Card title="影响评估" size="small" className="mb-4">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text strong>影响级别: </Text>
                    <Tag color={
                      rollbackImpact.impactLevel === 'high' ? 'red' :
                      rollbackImpact.impactLevel === 'medium' ? 'orange' : 'green'
                    }>
                      {rollbackImpact.impactLevel === 'high' ? '高' :
                       rollbackImpact.impactLevel === 'medium' ? '中' : '低'}
                    </Tag>
                  </div>
                  {rollbackImpact.warnings.length > 0 && (
                    <Alert
                      message="注意事项"
                      description={
                        <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                          {rollbackImpact.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      }
                      type="warning"
                      showIcon
                    />
                  )}
                </Space>
              </Card>
            )}

            {/* 回滚步骤 */}
            {rollbackPlan && (
              <Card title="回滚步骤" size="small" className="mb-4">
                <Steps
                  direction="vertical"
                  size="small"
                  items={rollbackPlan.steps.map((step, index) => ({
                    title: step,
                    status: 'wait',
                  }))}
                />
                {rollbackPlan.risks.length > 0 && (
                  <Alert
                    message="风险提示"
                    description={
                      <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                        {rollbackPlan.risks.map((risk, i) => (
                          <li key={i}>{risk}</li>
                        ))}
                      </ul>
                    }
                    type="error"
                    showIcon
                    className="mt-4"
                  />
                )}
              </Card>
            )}

            {/* 回滚表单 */}
            <Form layout="vertical" onFinish={handleRollback}>
              <Form.Item
                label="回滚原因"
                name="reason"
                rules={[{ required: true, message: '请输入回滚原因' }]}
              >
                <TextArea
                  placeholder="请详细说明回滚原因,例如: 配置错误导致服务异常"
                  rows={3}
                />
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    danger={!dryRunMode}
                    htmlType="submit"
                    loading={rollbackMutation.isLoading}
                    icon={dryRunMode ? <PlayCircleOutlined /> : <ThunderboltOutlined />}
                  >
                    {dryRunMode ? '模拟回滚' : '立即回滚'}
                  </Button>
                  <Button onClick={() => setDryRunMode(!dryRunMode)}>
                    {dryRunMode ? '切换到真实模式' : '切换到模拟模式'}
                  </Button>
                  <Button onClick={() => setRollbackModalVisible(false)}>
                    取消
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  );
}
