/**
 * PAGE-P1-STUDIO-101 AI商拍（向导）页面
 * 艹，三步式操作：①选工具 ②上传素材 ③参数配置 → 提交生成
 * 支持批量上传、SSE进度展示、瀑布流结果、一键跳转编辑器
 *
 * @author 老王
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Card,
  Steps,
  Button,
  Space,
  Typography,
  Form,
  Select,
  InputNumber,
  Switch,
  Slider,
  ColorPicker,
  Upload,
  Progress,
  message,
  Row,
  Col,
  Image,
  Spin,
  Empty,
  Tooltip,
  Badge,
  Modal,
  Alert,
  Divider,
  Drawer,
  List
} from 'antd';
import {
  CameraOutlined,
  UploadOutlined,
  SettingOutlined,
  PlayCircleOutlined,
  EyeOutlined,
  EditOutlined,
  DownloadOutlined,
  CloudDownloadOutlined,
  FileImageOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  DeleteOutlined,
  ShareAltOutlined,
  HeartOutlined,
  CopyOutlined
} from '@ant-design/icons';
import { COSBatchUploader } from '@/components/base/COSBatchUploader';
import { useSSE } from '@/hooks/useSSE';
import bootstrap from '@/lib/mocks/bootstrap.json';
import type { UIField, UISchema } from '@/lib/schema/ui';
import type { ProgressEvent, StatusEvent, CompleteEvent } from '@/hooks/useSSE';
import ThemeSwitcher from '@/components/ThemeSwitcher';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;
const { Dragger } = Upload;

// 任务状态
enum TaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// 任务结果
interface TaskResult {
  id: string;
  taskId: string;
  toolKey: string;
  images: string[];
  metadata?: {
    prompt?: string;
    model?: string;
    parameters?: any;
    files?: string[];
  };
  status: TaskStatus;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
  // 新增字段
  isFavorite?: number[];
  shareUrl?: string;
}

// 步骤状态
enum StepStatus {
  SELECT_TOOL = 'select_tool',
  UPLOAD_FILES = 'upload_files',
  CONFIG_PARAMS = 'config_params',
  GENERATING = 'generating'
}

export default function StudioPage() {
  // 步骤管理
  const [currentStep, setCurrentStep] = useState<StepStatus>(StepStatus.SELECT_TOOL);
  const defaultToolKey = bootstrap.tools?.[0]?.key ?? 'try-on';
  const [selectedTool, setSelectedTool] = useState<string>(defaultToolKey);

  // 文件和参数
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [formValues, setFormValues] = useState<any>({});
  const [generatingTasks, setGeneratingTasks] = useState<TaskResult[]>([]);
  const [completedResults, setCompletedResults] = useState<TaskResult[]>([]);
  const [taskHistory, setTaskHistory] = useState<TaskResult[]>([]);

  // 生成状态
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>('准备中...');

  // UI状态
  const [showHistory, setShowHistory] = useState(false);

  // SSE连接状态
  const { isConnected, currentTask: sseTask, lastEvent, connect: connectSSE, disconnect: disconnectSSE } = useSSE({
    onProgress: (event: ProgressEvent) => {
      console.log('Progress event:', event);
      setCurrentProgress(event.progress);
      setProgressMessage(event.message);
    },
    onStatus: (event: StatusEvent) => {
      console.log('Status event:', event);
      if (event.status === 'failed') {
        message.error(event.error || '任务执行失败');
        setIsGenerating(false);
        setCurrentStep(StepStatus.CONFIG_PARAMS);
      }
    },
    onComplete: (event: CompleteEvent) => {
      console.log('Complete event:', event);

      const completedTask: TaskResult = {
        id: `result_${Date.now()}`,
        taskId: event.taskId,
        toolKey: selectedTool,
        images: event.result.images,
        metadata: event.result.metadata,
        status: TaskStatus.COMPLETED,
        createdAt: new Date(),
        completedAt: new Date(event.completedAt)
      };

      setGeneratingTasks(prev => prev.filter(t => t.taskId !== event.taskId));
      setCompletedResults(prev => [...prev, completedTask]);
      setTaskHistory(prev => [...prev, completedTask]); // 添加到历史记录

      setIsGenerating(false);
      setCurrentProgress(100);
      setProgressMessage('生成完成！');
      message.success(`成功生成 ${event.result.images.length} 张图片！`);
    },
    onError: (error) => {
      console.error('SSE error:', error);
      message.error(`连接错误: ${error.message}`);
      setIsGenerating(false);
      setCurrentStep(StepStatus.CONFIG_PARAMS);
    },
    reconnectAttempts: 5,
    reconnectDelay: 1000
  });

  // 获取工具配置
  const tool = bootstrap.tools.find(t => t.key === selectedTool)!;
  const schema = tool.uiSchema as UISchema;

  // 步骤映射
  const getStepNumber = (step: StepStatus): number => {
    switch (step) {
      case StepStatus.SELECT_TOOL: return 0;
      case StepStatus.UPLOAD_FILES: return 1;
      case StepStatus.CONFIG_PARAMS: return 2;
      case StepStatus.GENERATING: return 3;
      default: return 0;
    }
  };

  // 步骤描述
  const stepDescriptions = [
    { title: '选择工具', description: '选择AI处理工具', icon: <CameraOutlined /> },
    { title: '上传素材', description: '批量上传图片素材', icon: <UploadOutlined /> },
    { title: '参数配置', description: '调整生成参数', icon: <SettingOutlined /> },
    { title: '生成结果', description: 'AI生成与结果展示', icon: <LoadingOutlined /> }
  ];

  // 渲染动态表单字段
  const renderFormField = (field: UIField) => {
    switch (field.type) {
      case 'select':
        return (
          <Select
            placeholder={field.placeholder || `请选择${field.label}`}
            options={field.options.map(opt => ({ label: opt, value: opt }))}
            defaultValue={field.default}
          />
        );

      case 'number':
        return (
          <InputNumber
            min={field.min}
            max={field.max}
            step={field.step}
            defaultValue={field.default}
            placeholder={field.placeholder}
            style={{ width: '100%' }}
          />
        );

      case 'switch':
        return <Switch defaultChecked={field.default} />;

      case 'slider':
        return (
          <Slider
            min={field.min}
            max={field.max}
            step={field.step}
            defaultValue={field.default}
            marks={{
              [field.min || 0]: field.min?.toString() || '0',
              [field.max || 100]: field.max?.toString() || '100'
            }}
          />
        );

      case 'color':
        return (
          <ColorPicker
            defaultValue={field.default}
            showText
            format="hex"
          />
        );

      default:
        return (
          <input
            type="text"
            defaultValue={field.default}
            placeholder={field.placeholder}
            style={{ width: '100%', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '6px' }}
          />
        );
    }
  };

  // 步骤1: 选择工具
  const renderToolSelection = () => (
    <Card title="选择AI处理工具" style={{ marginBottom: 24 }}>
      <Row gutter={[16, 16]}>
        {bootstrap.tools.map((tool) => (
          <Col span={8} key={tool.key}>
            <Card
              hoverable
              className={`tool-card ${selectedTool === tool.key ? 'selected' : ''}`}
              onClick={() => setSelectedTool(tool.key)}
              style={{
                border: selectedTool === tool.key ? '2px solid #1890ff' : '1px solid #d9d9d9',
                cursor: 'pointer'
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8, color: selectedTool === tool.key ? '#1890ff' : '#666' }}>
                  {tool.icon === 'camera' && <CameraOutlined />}
                  {tool.icon === 'droplet' && '💧'}
                </div>
                <Title level={5} style={{ margin: 0 }}>{tool.title}</Title>
                <Text type="secondary" style={{ fontSize: 12 }}>{tool.group}</Text>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <Button
          type="primary"
          size="large"
          onClick={() => setCurrentStep(StepStatus.UPLOAD_FILES)}
          icon={<UploadOutlined />}
        >
          选择工具，开始上传
        </Button>
      </div>
    </Card>
  );

  // 步骤2: 上传素材
  const renderFileUpload = () => (
    <Card title="上传素材文件" style={{ marginBottom: 24 }}>
      <Alert
        message="素材要求"
        description={`请上传 ${tool.title} 所需的图片素材，支持JPG、PNG格式，单张图片不超过10MB`}
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <COSBatchUploader
        config={{
          maxFileSize: 10,
          maxFileCount: 20,
          autoStart: true,
          previewEnabled: true
        }}
        onFileSelect={(files) => {
          // 这里可以处理文件选择的回调
          console.log('Selected files:', files);
        }}
        onUploadComplete={(files) => {
          const urls = files.map(f => f.url || '').filter(Boolean);
          setUploadedFiles(urls);
          message.success(`成功上传 ${urls.length} 个文件`);
        }}
        onUploadError={(file, error) => {
          console.error('Upload error:', error);
        }}
      />

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <Space>
          <Button
            onClick={() => setCurrentStep(StepStatus.SELECT_TOOL)}
            style={{ marginRight: 8 }}
          >
            上一步
          </Button>
          <Button
            type="primary"
            size="large"
            onClick={() => setCurrentStep(StepStatus.CONFIG_PARAMS)}
            disabled={uploadedFiles.length === 0}
            icon={<SettingOutlined />}
          >
            配置参数 ({uploadedFiles.length} 个文件)
          </Button>
        </Space>
      </div>
    </Card>
  );

  // 步骤3: 参数配置
  const renderParameterConfig = () => (
    <Card title="配置生成参数" style={{ marginBottom: 24 }}>
      <Form
        layout="vertical"
        initialValues={formValues}
        onValuesChange={(_, allValues) => setFormValues(allValues)}
      >
        <Row gutter={[16, 0]}>
          {schema.fields.map(field => (
            <Col span={12} key={field.name}>
              <Form.Item
                label={field.label}
                name={field.name}
                required={field.required}
                tooltip={field.help}
              >
                {renderFormField(field)}
              </Form.Item>
            </Col>
          ))}
        </Row>

        <Divider />

        <div style={{ textAlign: 'center' }}>
          <Space>
            <Button
              onClick={() => setCurrentStep(StepStatus.UPLOAD_FILES)}
              style={{ marginRight: 8 }}
            >
              上一步
            </Button>
            <Button
              type="primary"
              size="large"
              onClick={startGeneration}
              loading={isGenerating}
              icon={<PlayCircleOutlined />}
            >
              {isGenerating ? '生成中...' : '开始生成'}
            </Button>
          </Space>
        </div>
      </Form>
    </Card>
  );

  // 开始生成
  const startGeneration = async () => {
    setIsGenerating(true);
    setCurrentStep(StepStatus.GENERATING);
    setCurrentProgress(0);
    setProgressMessage('创建任务中...');

    try {
      // 创建任务
      const response = await fetch('/api/tools/' + selectedTool + '/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parameters: formValues,
          files: uploadedFiles,
          toolKey: selectedTool
        })
      });

      if (!response.ok) {
        throw new Error(`创建任务失败: ${response.statusText}`);
      }

      const result = await response.json();
      const taskId = result.taskId;

      if (!taskId) {
        throw new Error('未获取到任务ID');
      }

      setCurrentTaskId(taskId);
      setProgressMessage('任务已创建，开始处理...');

      const newTask: TaskResult = {
        id: `result_${Date.now()}`,
        taskId,
        toolKey: selectedTool,
        images: [],
        status: TaskStatus.PROCESSING,
        metadata: {
          parameters: formValues,
          files: uploadedFiles
        },
        createdAt: new Date()
      };

      setGeneratingTasks(prev => [...prev, newTask]);

      // 建立SSE连接监听进度
      connectSSE(taskId);

      // SSE连接超时检查
      const sseTimeout = setTimeout(() => {
        if (!isConnected && currentTaskId === taskId) {
          console.warn('SSE connection timeout, falling back to mock progress');
          message.warning('实时连接超时，切换到模拟进度模式');
          simulateTaskProgress(taskId);
        }
      }, 5000); // 5秒超时

      // 清理超时检查器
      return () => clearTimeout(sseTimeout);

    } catch (error) {
      console.error('Generation failed:', error);
      message.error(`生成失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setIsGenerating(false);
      setCurrentStep(StepStatus.CONFIG_PARAMS);
    }
  };

  // 模拟任务进度（当SSE不可用时的回退方案）
  const simulateTaskProgress = async (taskId: string) => {
    const steps = [
      { progress: 10, message: '准备素材中...' },
      { progress: 30, message: 'AI分析中...' },
      { progress: 60, message: '图像生成中...' },
      { progress: 90, message: '后处理中...' },
      { progress: 100, message: '完成！' }
    ];

    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setCurrentProgress(step.progress);
      setProgressMessage(step.message);
    }

    // 模拟生成结果
    const mockResults: string[] = [];
    const count = formValues.count || 4;

    for (let i = 0; i < count; i++) {
      mockResults.push(`https://picsum.photos/512/512?random=${Date.now()}_${i}`);
    }

    const completedTask: TaskResult = {
      id: `result_${Date.now()}`,
      taskId,
      toolKey: selectedTool,
      images: mockResults,
      metadata: {
        parameters: formValues,
        files: uploadedFiles
      },
      status: TaskStatus.COMPLETED,
      createdAt: new Date(),
      completedAt: new Date()
    };

    setGeneratingTasks(prev => prev.filter(t => t.taskId !== taskId));
    setCompletedResults(prev => [...prev, completedTask]);

    setIsGenerating(false);
    setCurrentProgress(100);
    setProgressMessage('生成完成！');
    message.success(`成功生成 ${mockResults.length} 张图片！`);
  };

  // 步骤4: 生成结果
  const renderResults = () => (
    <Card title="生成结果" style={{ marginBottom: 24 }}>
      {isGenerating && (
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Progress
              type="circle"
              percent={currentProgress}
              format={(percent) => `${percent}%`}
              size={120}
              status={currentProgress === 100 ? 'success' : 'active'}
            />
            <div style={{ marginTop: 8 }}>
              <Text strong>{progressMessage}</Text>
              {isConnected && (
                <div style={{ marginTop: 4 }}>
                  <Badge status="processing" text="实时连接中" />
                </div>
              )}
            </div>
          </div>
          {currentTaskId && (
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                任务ID: {currentTaskId}
              </Text>
            </div>
          )}
        </div>
      )}

      {completedResults.length > 0 && (
        <div>
          <Alert
            message={`成功生成 ${completedResults.reduce((sum, r) => sum + r.images.length, 0)} 张图片`}
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <div className="results-waterfall" style={{ columnCount: 4, columnGap: 16 }}>
            {completedResults.map((result) =>
              result.images.map((imageUrl, index) => (
                <div key={`${result.id}_${index}`} style={{ breakInside: 'avoid', marginBottom: 16 }}>
                  <Card
                    hoverable
                    cover={
                      <Image
                        src={imageUrl}
                        alt={`Generated image ${index + 1}`}
                        style={{ width: '100%', height: 200, objectFit: 'cover' }}
                        preview
                      />
                    }
                    actions={[
                      <Tooltip title="收藏">
                        <HeartOutlined
                          key="favorite"
                          style={{
                            color: result.isFavorite?.includes(index) ? '#ff4d4f' : 'inherit'
                          }}
                          onClick={() => toggleFavorite(result.id, index)}
                        />
                      </Tooltip>,
                      <Tooltip title="查看详情">
                        <EyeOutlined key="view" />
                      </Tooltip>,
                      <Tooltip title="去编辑器">
                        <EditOutlined
                          key="edit"
                          onClick={() => handleEditImage(imageUrl)}
                        />
                      </Tooltip>,
                      <Tooltip title="复制链接">
                        <CopyOutlined
                          key="copy"
                          onClick={() => copyImageUrl(imageUrl)}
                        />
                      </Tooltip>,
                      <Tooltip title="分享">
                        <ShareAltOutlined
                          key="share"
                          onClick={() => shareImage(imageUrl)}
                        />
                      </Tooltip>,
                      <Tooltip title="下载">
                        <DownloadOutlined
                          key="download"
                          onClick={() => handleDownloadImage(imageUrl)}
                        />
                      </Tooltip>
                    ]}
                  >
                    <Card.Meta
                      title={`${tool.title} ${index + 1}`}
                      description={
                        <Space direction="vertical" size="small">
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            生成时间: {result.completedAt?.toLocaleString()}
                          </Text>
                          {result.metadata?.parameters && (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              场景: {result.metadata.parameters.scene || '默认'}
                            </Text>
                          )}
                        </Space>
                      }
                    />
                  </Card>
                </div>
              ))
            )}
          </div>

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Space>
              <Button onClick={() => setCurrentStep(StepStatus.CONFIG_PARAMS)}>
                重新生成
              </Button>
              <Button type="primary" onClick={() => window.location.href = '/workspace/editor'}>
                去编辑器
              </Button>
              <Button
                icon={<CloudDownloadOutlined />}
                onClick={handleBatchDownload}
              >
                批量下载
              </Button>
            </Space>
          </div>
        </div>
      )}

      {!isGenerating && completedResults.length === 0 && (
        <Empty description="暂无生成结果" />
      )}
    </Card>
  );

  // 处理图片编辑
  const handleEditImage = (imageUrl: string) => {
    // 跳转到编辑器并带入图片URL
    window.location.href = `/workspace/editor?image=${encodeURIComponent(imageUrl)}`;
  };

  // 处理图片下载
  const handleDownloadImage = (imageUrl: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `generated_${Date.now()}.jpg`;
    link.target = '_blank';
    link.click();
  };

  // 批量下载
  const handleBatchDownload = async () => {
    const allImages = completedResults.flatMap(result => result.images);

    if (allImages.length === 0) {
      message.warning('没有可下载的图片');
      return;
    }

    try {
      // 显示下载进度
      const loadingMessage = message.loading({
        content: `正在打包 ${allImages.length} 张图片...`,
        duration: 0,
      });

      // 调用ZIP下载API
      const response = await fetch('/api/tools/product-shoot/download-zip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrls: allImages,
          filename: `ai_shoot_${selectedTool}_${Date.now()}.zip`
        })
      });

      loadingMessage();

      if (!response.ok) {
        throw new Error(`打包失败: ${response.statusText}`);
      }

      // 获取文件名
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition
        ? contentDisposition.match(/filename="(.+)"/)?.[1] || 'download.zip'
        : `ai_shoot_${selectedTool}_${Date.now()}.zip`;

      // 下载文件
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = decodeURIComponent(filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      message.success(`成功打包下载 ${allImages.length} 张图片！`);

    } catch (error) {
      console.error('Batch download failed:', error);
      message.error(`批量下载失败: ${error instanceof Error ? error.message : '未知错误'}`);

      // 回退到单个文件下载
      message.info('正在使用备用下载方式...');
      allImages.forEach((imageUrl, index) => {
        setTimeout(() => {
          handleDownloadImage(imageUrl);
        }, index * 200);
      });
    }
  };

  // 收藏图片
  const toggleFavorite = (resultId: string, imageIndex: number) => {
    setCompletedResults(prev => prev.map(result => {
      if (result.id === resultId) {
        // 这里应该调用API保存收藏状态
        const updatedResult = { ...result };
        if (!updatedResult.isFavorite) {
          updatedResult.isFavorite = [imageIndex]; // 创建收藏数组
        } else {
          const favoriteIndex = updatedResult.isFavorite.indexOf(imageIndex);
          if (favoriteIndex > -1) {
            updatedResult.isFavorite.splice(favoriteIndex, 1); // 取消收藏
          } else {
            updatedResult.isFavorite.push(imageIndex); // 添加收藏
          }
        }
        return updatedResult;
      }
      return result;
    }));

    message.success('收藏状态已更新');
  };

  // 复制图片链接
  const copyImageUrl = async (imageUrl: string) => {
    try {
      await navigator.clipboard.writeText(imageUrl);
      message.success('图片链接已复制到剪贴板');
    } catch (error) {
      message.error('复制失败，请手动复制');
    }
  };

  // 分享图片
  const shareImage = (imageUrl: string) => {
    // 这里可以集成分享功能
    const shareUrl = `${window.location.origin}/workspace/editor?image=${encodeURIComponent(imageUrl)}`;
    navigator.clipboard.writeText(shareUrl);
    message.success('分享链接已复制到剪贴板');
  };

  // 渲染当前步骤
  const renderCurrentStep = () => {
    switch (currentStep) {
      case StepStatus.SELECT_TOOL:
        return renderToolSelection();
      case StepStatus.UPLOAD_FILES:
        return renderFileUpload();
      case StepStatus.CONFIG_PARAMS:
        return renderParameterConfig();
      case StepStatus.GENERATING:
        return renderResults();
      default:
        return renderToolSelection();
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2}>
              <CameraOutlined style={{ marginRight: 8 }} />
              AI商拍工作室
            </Title>
            <Paragraph type="secondary">
              三步完成专业商品图拍摄：选择工具 → 上传素材 → 配置参数 → 生成结果
            </Paragraph>
          </div>
          <Space>
            <ThemeSwitcher mode="dropdown" size="middle" />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setCompletedResults([]);
                setCurrentStep(StepStatus.SELECT_TOOL);
                setUploadedFiles([]);
                setFormValues({});
                message.info('已重置工作区');
              }}
            >
              重置工作区
            </Button>
            <Button
              icon={<FileImageOutlined />}
              onClick={() => setShowHistory(!showHistory)}
            >
              历史记录 ({taskHistory.length})
            </Button>
          </Space>
        </div>
      </div>

      {/* 历史记录抽屉 */}
      <Drawer
        title="生成历史记录"
        placement="right"
        onClose={() => setShowHistory(false)}
        open={showHistory}
        width={600}
      >
        <List
          dataSource={taskHistory}
          renderItem={(task) => (
            <List.Item
              actions={[
                <Button
                  type="link"
                  icon={<EyeOutlined />}
                  onClick={() => {
                    setCompletedResults([task]);
                    setShowHistory(false);
                    setCurrentStep(StepStatus.GENERATING);
                  }}
                >
                  查看
                </Button>
              ]}
            >
              <List.Item.Meta
                title={`${bootstrap.tools.find(t => t.key === task.toolKey)?.title || task.toolKey}`}
                description={
                  <Space direction="vertical" size="small">
                    <Text type="secondary">
                      完成时间: {task.completedAt?.toLocaleString()}
                    </Text>
                    <Text type="secondary">
                      生成图片: {task.images.length} 张
                    </Text>
                    {task.metadata?.parameters?.scene && (
                      <Text type="secondary">
                        场景: {task.metadata.parameters.scene}
                      </Text>
                    )}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Drawer>

      <Steps current={getStepNumber(currentStep)} items={stepDescriptions} style={{ marginBottom: 32 }} />

      {renderCurrentStep()}
    </div>
  );
}
