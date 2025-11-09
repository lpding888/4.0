'use client';

/**
 * 流水线编排页面
 * 艹！这个页面支持可视化步骤选择、流水线保存、执行进度追踪！
 *
 * @author 老王
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  Row,
  Col,
  Typography,
  Tabs,
  List,
  Tag,
  Modal,
  Form,
  Input,
  message,
  Tooltip,
  Progress,
  Divider,
  Empty,
  Badge,
  Dropdown,
  Checkbox,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  DeleteOutlined,
  EditOutlined,
  CopyOutlined,
  ExportOutlined,
  ImportOutlined,
  BranchesOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  CloudDownloadOutlined,
  CloudUploadOutlined,
  HistoryOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

const { Text, Title } = Typography;
const { TextArea } = Input;

/**
 * 步骤类型
 */
interface Step {
  id: string;
  name: string;
  description: string;
  category: 'generate' | 'enhance' | 'process' | 'export';
  icon: string;
  params: Record<string, any>;
  estimatedTime: number; // 估计时间（秒）
}

/**
 * 流水线步骤实例
 */
interface PipelineStep {
  id: string;
  stepId: string; // 引用步骤库
  name: string;
  params: Record<string, any>;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  progress?: number; // 0-100
  startTime?: number;
  endTime?: number;
  error?: string;
  output?: any;
}

/**
 * 流水线
 */
interface Pipeline {
  id: string;
  name: string;
  description?: string;
  steps: PipelineStep[];
  created_at: number;
  updated_at: number;
  last_run?: number;
  run_count?: number;
}

/**
 * 执行记录
 */
interface ExecutionRecord {
  id: string;
  pipelineId: string;
  pipelineName: string;
  status: 'running' | 'completed' | 'failed' | 'partial';
  steps: PipelineStep[];
  startTime: number;
  endTime?: number;
  totalSteps: number;
  completedSteps: number;
}

/**
 * 步骤库（预定义步骤）
 */
const STEP_LIBRARY: Step[] = [
  // 生成类
  {
    id: 'step-gen-text',
    name: '生成文案',
    description: '使用AI生成营销文案',
    category: 'generate',
    icon: '✍️',
    params: { prompt: '', model: 'gpt-4', max_tokens: 1000 },
    estimatedTime: 5,
  },
  {
    id: 'step-gen-image',
    name: '生成图片',
    description: '根据提示词生成AI图片',
    category: 'generate',
    icon: '🎨',
    params: { prompt: '', size: '1024x1024', quality: 'hd' },
    estimatedTime: 15,
  },
  {
    id: 'step-gen-scene',
    name: '生成商拍场景',
    description: '生成电商商品摄影场景',
    category: 'generate',
    icon: '📷',
    params: { product: '', scene: '', style: '' },
    estimatedTime: 20,
  },
  // 增强类
  {
    id: 'step-enh-upscale',
    name: '图片超分',
    description: '提升图片分辨率',
    category: 'enhance',
    icon: '⬆️',
    params: { scale: 2, model: 'real-esrgan' },
    estimatedTime: 10,
  },
  {
    id: 'step-enh-remove-bg',
    name: '去除背景',
    description: '智能去除图片背景',
    category: 'enhance',
    icon: '✂️',
    params: { model: 'u2net' },
    estimatedTime: 3,
  },
  {
    id: 'step-enh-relight',
    name: '重新打光',
    description: '调整图片光照效果',
    category: 'enhance',
    icon: '💡',
    params: { brightness: 1.0, contrast: 1.0, saturation: 1.0 },
    estimatedTime: 5,
  },
  // 处理类
  {
    id: 'step-proc-resize',
    name: '调整尺寸',
    description: '批量调整图片尺寸',
    category: 'process',
    icon: '📐',
    params: { width: 1024, height: 1024, mode: 'cover' },
    estimatedTime: 2,
  },
  {
    id: 'step-proc-watermark',
    name: '添加水印',
    description: '批量添加水印',
    category: 'process',
    icon: '©️',
    params: { text: '', position: 'bottom-right', opacity: 0.5 },
    estimatedTime: 2,
  },
  {
    id: 'step-proc-compress',
    name: '图片压缩',
    description: '优化图片大小',
    category: 'process',
    icon: '📦',
    params: { quality: 85, format: 'jpeg' },
    estimatedTime: 1,
  },
  // 导出类
  {
    id: 'step-exp-download',
    name: '下载到本地',
    description: '打包下载所有结果',
    category: 'export',
    icon: '💾',
    params: { format: 'zip' },
    estimatedTime: 3,
  },
  {
    id: 'step-exp-upload-cos',
    name: '上传到COS',
    description: '上传到腾讯云对象存储',
    category: 'export',
    icon: '☁️',
    params: { bucket: '', path: '' },
    estimatedTime: 5,
  },
  {
    id: 'step-exp-share',
    name: '生成分享链接',
    description: '创建可分享的在线预览链接',
    category: 'export',
    icon: '🔗',
    params: { expireDays: 7 },
    estimatedTime: 1,
  },
];

/**
 * 流水线编排页面
 */
export default function PipelinesPage() {
  // 我的流水线
  const [myPipelines, setMyPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);

  // 编辑器状态
  const [currentSteps, setCurrentSteps] = useState<PipelineStep[]>([]);
  const [editorVisible, setEditorVisible] = useState(false);

  // 执行状态
  const [executing, setExecuting] = useState(false);
  const [currentExecution, setCurrentExecution] = useState<ExecutionRecord | null>(null);
  const [executionHistory, setExecutionHistory] = useState<ExecutionRecord[]>([]);

  const [form] = Form.useForm();

  /**
   * 加载我的流水线
   */
  const loadMyPipelines = async () => {
    try {
      const response = await fetch('/api/workspace/pipelines');
      if (!response.ok) throw new Error('加载失败');

      const data = await response.json();
      setMyPipelines(data.pipelines || []);
    } catch (error: any) {
      message.error(`加载失败: ${error.message}`);
    }
  };

  useEffect(() => {
    loadMyPipelines();
  }, []);

  /**
   * 添加步骤
   */
  const handleAddStep = (step: Step) => {
    const newStep: PipelineStep = {
      id: `step-instance-${Date.now()}`,
      stepId: step.id,
      name: step.name,
      params: { ...step.params },
      status: 'pending',
      progress: 0,
    };

    setCurrentSteps([...currentSteps, newStep]);
    message.success(`已添加步骤: ${step.name}`);
  };

  /**
   * 删除步骤
   */
  const handleRemoveStep = (stepId: string) => {
    setCurrentSteps(currentSteps.filter((s) => s.id !== stepId));
  };

  /**
   * 移动步骤
   */
  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...currentSteps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newSteps.length) return;

    const currentStep = newSteps[index];
    const targetStep = newSteps[targetIndex];
    if (!currentStep || !targetStep) return;

    newSteps[index] = targetStep;
    newSteps[targetIndex] = currentStep;
    setCurrentSteps(newSteps);
  };

  /**
   * 保存流水线
   */
  const handleSavePipeline = async () => {
    if (currentSteps.length === 0) {
      message.warning('请至少添加一个步骤');
      return;
    }

    setEditorVisible(true);
    form.setFieldsValue({
      name: selectedPipeline?.name || '',
      description: selectedPipeline?.description || '',
    });
  };

  const handleEditorOk = async () => {
    try {
      const values = await form.validateFields();

      const pipeline: Pipeline = {
        id: selectedPipeline?.id || `pipeline-${Date.now()}`,
        name: values.name,
        description: values.description,
        steps: currentSteps,
        created_at: selectedPipeline?.created_at || Date.now(),
        updated_at: Date.now(),
        run_count: selectedPipeline?.run_count || 0,
      };

      const response = await fetch('/api/workspace/pipelines', {
        method: selectedPipeline ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pipeline),
      });

      if (!response.ok) throw new Error('保存失败');

      message.success(selectedPipeline ? '流水线已更新' : '流水线已保存');
      setEditorVisible(false);
      loadMyPipelines();
    } catch (error: any) {
      message.error(`保存失败: ${error.message}`);
    }
  };

  /**
   * 加载流水线
   */
  const handleLoadPipeline = (pipeline: Pipeline) => {
    setSelectedPipeline(pipeline);
    setCurrentSteps([...pipeline.steps]);
    message.success(`已加载流水线: ${pipeline.name}`);
  };

  /**
   * 删除流水线
   */
  const handleDeletePipeline = (pipelineId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这个流水线吗？',
      onOk: async () => {
        try {
          const response = await fetch(`/api/workspace/pipelines/${pipelineId}`, {
            method: 'DELETE',
          });
          if (!response.ok) throw new Error('删除失败');

          message.success('流水线已删除');
          loadMyPipelines();

          if (selectedPipeline?.id === pipelineId) {
            setSelectedPipeline(null);
            setCurrentSteps([]);
          }
        } catch (error: any) {
          message.error(`删除失败: ${error.message}`);
        }
      },
    });
  };

  /**
   * 执行流水线
   */
  const handleExecute = async () => {
    if (currentSteps.length === 0) {
      message.warning('请至少添加一个步骤');
      return;
    }

    setExecuting(true);

    const execution: ExecutionRecord = {
      id: `exec-${Date.now()}`,
      pipelineId: selectedPipeline?.id || 'temp',
      pipelineName: selectedPipeline?.name || '临时流水线',
      status: 'running',
      steps: currentSteps.map((s) => ({ ...s, status: 'pending', progress: 0 })),
      startTime: Date.now(),
      totalSteps: currentSteps.length,
      completedSteps: 0,
    };

    setCurrentExecution(execution);

    try {
      // 逐步执行
      for (let i = 0; i < execution.steps.length; i++) {
        const step = execution.steps[i];
        if (!step) {
          continue;
        }
        step.status = 'running';
        step.startTime = Date.now();

        setCurrentExecution({ ...execution });

        // 调用执行API
        const response = await fetch('/api/workspace/pipelines/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stepId: step.stepId,
            params: step.params,
          }),
        });

        if (!response.ok) {
          throw new Error(`步骤 ${step.name} 执行失败`);
        }

        const result = await response.json();

        // 更新步骤状态
        step.status = 'completed';
        step.progress = 100;
        step.endTime = Date.now();
        step.output = result;

        execution.completedSteps++;
        setCurrentExecution({ ...execution });

        // 模拟进度更新
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // 全部完成
      execution.status = 'completed';
      execution.endTime = Date.now();
      message.success('流水线执行完成！');

      // 保存到历史
      setExecutionHistory([execution, ...executionHistory]);
    } catch (error: any) {
      execution.status = 'failed';
      execution.endTime = Date.now();

      // 标记失败步骤
      const failedIndex = execution.steps.findIndex((s) => s.status === 'running');
      if (failedIndex >= 0) {
        const failedStep = execution.steps[failedIndex];
        if (failedStep) {
          failedStep.status = 'failed';
          failedStep.error = error.message;
        }
      }

      message.error(`执行失败: ${error.message}`);
      setCurrentExecution(execution);
    } finally {
      setExecuting(false);
    }
  };

  /**
   * 从指定步骤重试
   */
  const handleRetryFrom = (stepIndex: number) => {
    if (!currentExecution) return;

    // 重置从指定步骤开始的所有状态
    const newSteps = currentExecution.steps.map((s, i) => {
      if (i >= stepIndex) {
        return { ...s, status: 'pending' as const, progress: 0, error: undefined };
      }
      return s;
    });

    setCurrentSteps(newSteps);
    setCurrentExecution(null);
    message.info(`将从步骤 ${stepIndex + 1} 开始重试`);
  };

  /**
   * 导出流水线
   */
  const handleExport = () => {
    if (!selectedPipeline) {
      message.warning('请先选择一个流水线');
      return;
    }

    const json = JSON.stringify(selectedPipeline, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedPipeline.name}.json`;
    a.click();
    URL.revokeObjectURL(url);

    message.success('流水线已导出');
  };

  /**
   * 导入流水线
   */
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const pipeline: Pipeline = JSON.parse(text);

        // 重新生成ID
        pipeline.id = `pipeline-${Date.now()}`;
        pipeline.created_at = Date.now();
        pipeline.updated_at = Date.now();

        setCurrentSteps(pipeline.steps);
        setSelectedPipeline(pipeline);

        message.success(`已导入流水线: ${pipeline.name}`);
      } catch (error: any) {
        message.error(`导入失败: ${error.message}`);
      }
    };
    input.click();
  };

  /**
   * 渲染步骤库
   */
  const renderStepLibrary = () => {
    const categories = [
      { key: 'generate', label: '生成', color: 'blue' },
      { key: 'enhance', label: '增强', color: 'green' },
      { key: 'process', label: '处理', color: 'orange' },
      { key: 'export', label: '导出', color: 'purple' },
    ];

    return (
      <Card title="步骤库" size="small">
        <Tabs
          items={categories.map((cat) => ({
            key: cat.key,
            label: <Tag color={cat.color}>{cat.label}</Tag>,
            children: (
              <List
                size="small"
                dataSource={STEP_LIBRARY.filter((s) => s.category === cat.key)}
                renderItem={(step) => (
                  <List.Item
                    actions={[
                      <Button
                        key="add"
                        type="link"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => handleAddStep(step)}
                      >
                        添加
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<Text style={{ fontSize: 24 }}>{step.icon}</Text>}
                      title={step.name}
                      description={
                        <Space direction="vertical" size={0}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {step.description}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            预计耗时: {step.estimatedTime}秒
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ),
          }))}
        />
      </Card>
    );
  };

  /**
   * 渲染当前流水线
   */
  const renderCurrentPipeline = () => {
    if (currentSteps.length === 0) {
      return (
        <Card>
          <Empty description="从左侧选择步骤开始构建流水线" />
        </Card>
      );
    }

    const totalTime = currentSteps.reduce((sum, step) => {
      const stepDef = STEP_LIBRARY.find((s) => s.id === step.stepId);
      return sum + (stepDef?.estimatedTime || 0);
    }, 0);

    return (
      <Card
        title={
          <Space>
            <BranchesOutlined />
            <Text strong>{selectedPipeline?.name || '新流水线'}</Text>
            <Badge count={currentSteps.length} showZero />
            <Tag color="blue">预计 {totalTime}秒</Tag>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<SaveOutlined />} onClick={handleSavePipeline}>
              保存流水线
            </Button>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleExecute}
              loading={executing}
              disabled={executing}
            >
              执行
            </Button>
          </Space>
        }
      >
        <List
          dataSource={currentSteps}
          renderItem={(step, index) => {
            const stepDef = STEP_LIBRARY.find((s) => s.id === step.stepId);

            return (
              <List.Item
                actions={[
                  <Tooltip title="上移" key="up">
                    <Button
                      size="small"
                      disabled={index === 0}
                      onClick={() => handleMoveStep(index, 'up')}
                    >
                      ↑
                    </Button>
                  </Tooltip>,
                  <Tooltip title="下移" key="down">
                    <Button
                      size="small"
                      disabled={index === currentSteps.length - 1}
                      onClick={() => handleMoveStep(index, 'down')}
                    >
                      ↓
                    </Button>
                  </Tooltip>,
                  <Tooltip title="删除" key="delete">
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemoveStep(step.id)}
                    />
                  </Tooltip>,
                ]}
              >
                <List.Item.Meta
                  avatar={<Text style={{ fontSize: 32 }}>{stepDef?.icon}</Text>}
                  title={
                    <Space>
                      <Tag color="blue">步骤 {index + 1}</Tag>
                      <Text strong>{step.name}</Text>
                      {step.status === 'completed' && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                      {step.status === 'failed' && <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                      {step.status === 'running' && <SyncOutlined spin style={{ color: '#1890ff' }} />}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {stepDef?.description && <Text type="secondary">{stepDef.description}</Text>}
                      {step.status === 'running' && (
                        <Progress percent={step.progress} status="active" size="small" />
                      )}
                      {step.status === 'failed' && (
                        <Alert
                          message={step.error}
                          type="error"
                          showIcon
                          action={
                            <Button size="small" onClick={() => handleRetryFrom(index)}>
                              从此处重试
                            </Button>
                          }
                        />
                      )}
                    </Space>
                  }
                />
              </List.Item>
            );
          }}
        />
      </Card>
    );
  };

  /**
   * 渲染我的流水线
   */
  const renderMyPipelines = () => {
    return (
      <Card
        title={
          <Space>
            <CloudDownloadOutlined />
            <Text strong>我的流水线</Text>
          </Space>
        }
        extra={
          <Space>
            <Button size="small" icon={<ImportOutlined />} onClick={handleImport}>
              导入
            </Button>
            <Button size="small" icon={<ExportOutlined />} onClick={handleExport} disabled={!selectedPipeline}>
              导出
            </Button>
          </Space>
        }
        size="small"
      >
        {myPipelines.length === 0 ? (
          <Empty description="暂无保存的流水线" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            size="small"
            dataSource={myPipelines}
            renderItem={(pipeline) => (
              <List.Item
                actions={[
                  <Button
                    key="load"
                    type="link"
                    size="small"
                    onClick={() => handleLoadPipeline(pipeline)}
                  >
                    加载
                  </Button>,
                  <Button
                    key="delete"
                    type="link"
                    size="small"
                    danger
                    onClick={() => handleDeletePipeline(pipeline.id)}
                  >
                    删除
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={pipeline.name}
                  description={
                    <Space size={4}>
                      <Tag>{pipeline.steps.length} 个步骤</Tag>
                      {pipeline.run_count && pipeline.run_count > 0 && (
                        <Tag color="green">运行 {pipeline.run_count} 次</Tag>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    );
  };

  /**
   * 渲染执行历史
   */
  const renderExecutionHistory = () => {
    return (
      <Card
        title={
          <Space>
            <HistoryOutlined />
            <Text strong>执行历史</Text>
          </Space>
        }
        size="small"
      >
        {executionHistory.length === 0 ? (
          <Empty description="暂无执行记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            size="small"
            dataSource={executionHistory}
            renderItem={(record) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space>
                      <Text>{record.pipelineName}</Text>
                      {record.status === 'completed' && <Tag color="success">成功</Tag>}
                      {record.status === 'failed' && <Tag color="error">失败</Tag>}
                      {record.status === 'running' && <Tag color="processing">运行中</Tag>}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={0}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {record.completedSteps}/{record.totalSteps} 步骤完成
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(record.startTime).toLocaleString()}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={2}>
            <BranchesOutlined /> 流水线编排
          </Title>
          <Text type="secondary">可视化构建AI生成流水线，保存并分享给团队</Text>
        </div>

        <Row gutter={16}>
          {/* 左侧：步骤库 */}
          <Col span={6}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {renderStepLibrary()}
              {renderMyPipelines()}
              {renderExecutionHistory()}
            </Space>
          </Col>

          {/* 右侧：当前流水线 */}
          <Col span={18}>{renderCurrentPipeline()}</Col>
        </Row>
      </Space>

      {/* 保存流水线弹窗 */}
      <Modal
        title="保存流水线"
        open={editorVisible}
        onCancel={() => setEditorVisible(false)}
        onOk={handleEditorOk}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="流水线名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：商品图生成流水线" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <TextArea rows={3} placeholder="流水线的详细说明" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
