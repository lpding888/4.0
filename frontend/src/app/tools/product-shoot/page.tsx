/**
 * PAGE-P1-PS-102 商品图快速通道页面
 * 艹，10秒快速生成，批量ZIP导出，必须高效！
 *
 * 功能清单：
 * 1. 多场景选择（纯色台/自然光/棚拍风）
 * 2. 快速批量生成（10秒内）
 * 3. 实时进度展示
 * 4. 批量ZIP导出
 * 5. 失败重试机制
 * 6. 结果预览和管理
 *
 * @author 老王
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Typography,
  Select,
  InputNumber,
  Upload,
  Progress,
  message,
  Space,
  Alert,
  Image,
  Spin,
  Tooltip,
  Badge,
  Tabs,
  Checkbox,
  Divider,
  Empty,
  Modal,
  List,
  Tag
} from 'antd';
import {
  CameraOutlined,
  DownloadOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  EyeOutlined,
  FileImageOutlined,
  FileZipOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  DeleteOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { COSBatchUploader } from '@/components/base/COSBatchUploader';
import { useSSE } from '@/hooks/useSSE';
import type { ProgressEvent, StatusEvent, CompleteEvent } from '@/hooks/useSSE';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

// 场景配置
const SCENARIOS = [
  {
    key: 'pure_color',
    title: '纯色台',
    description: '专业纯色背景，突出商品主体',
    colors: ['#FFFFFF', '#F5F5F5', '#E8E8E8', '#000000'],
    estimatedTime: 8,
    icon: '🎨'
  },
  {
    key: 'natural_light',
    title: '自然光',
    description: '柔和自然光线，还原真实质感',
    colors: ['#FFF8DC', '#F0E68C', '#FFE4B5', '#FAFAD2'],
    estimatedTime: 10,
    icon: '☀️'
  },
  {
    key: 'studio',
    title: '棚拍风',
    description: '专业棚拍效果，商业级质感',
    colors: ['#2C3E50', '#34495E', '#7F8C8D', '#95A5A6'],
    estimatedTime: 12,
    icon: '📸'
  }
];

// 输出尺寸配置
const OUTPUT_SIZES = [
  { label: '正方形 1:1', value: '1024x1024', width: 1024, height: 1024 },
  { label: '竖版 3:4', value: '1024x1365', width: 1024, height: 1365 },
  { label: '横版 4:3', value: '1365x1024', width: 1365, height: 1024 },
  { label: '高清正方形', value: '2048x2048', width: 2048, height: 2048 }
];

// 任务状态
interface TaskItem {
  id: string;
  taskId: string;
  fileUrl: string;
  fileName: string;
  scenario: string;
  size: string;
  color: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  resultUrl?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export default function ProductShootPage() {
  // 基础配置
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>(['pure_color']);
  const [selectedSize, setSelectedSize] = useState<string>('1024x1024');
  const [selectedColor, setSelectedColor] = useState<string>('#FFFFFF');
  const [generateCount, setGenerateCount] = useState<number>(1);

  // 文件和任务
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [completedTasks, setCompletedTasks] = useState<TaskItem[]>([]);

  // 批量操作状态
  const [isGenerating, setIsGenerating] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [currentGeneratingTask, setCurrentGeneratingTask] = useState<string | null>(null);

  // SSE连接
  const { isConnected, connect: connectSSE, disconnect: disconnectSSE } = useSSE({
    onProgress: (event: ProgressEvent) => {
      console.log('Product shoot progress:', event);

      setTasks(prev => prev.map(task => {
        if (task.taskId === event.taskId) {
          return {
            ...task,
            progress: event.progress,
            status: 'processing' as const
          };
        }
        return task;
      }));

      // 更新总体进度
      updateOverallProgress();
    },
    onComplete: (event: CompleteEvent) => {
      console.log('Product shoot completed:', event);

      setTasks(prev => prev.map(task => {
        if (task.taskId === event.taskId) {
          const completedTask = {
            ...task,
            status: 'completed' as const,
            progress: 100,
            resultUrl: event.result.images[0], // 商品图每任务生成一张
            completedAt: new Date(event.completedAt)
          };

          // 移动到完成列表
          setCompletedTasks(prev => [...prev, completedTask]);
          return completedTask;
        }
        return task;
      }));

      updateOverallProgress();
    },
    onError: (error) => {
      console.error('Product shoot SSE error:', error);
      message.error(`连接错误: ${error.message}`);
    }
  });

  // 更新总体进度
  const updateOverallProgress = useCallback(() => {
    const allTasks = [...tasks];
    if (allTasks.length === 0) {
      setOverallProgress(0);
      return;
    }

    const totalProgress = allTasks.reduce((sum, task) => sum + task.progress, 0);
    const avgProgress = Math.round(totalProgress / allTasks.length);
    setOverallProgress(avgProgress);
  }, [tasks]);

  // 场景选择处理
  const handleScenarioChange = (scenarios: string[]) => {
    setSelectedScenarios(scenarios);
  };

  // 颜色选择处理
  const handleColorChange = (color: string) => {
    setSelectedColor(color);
  };

  // 文件上传完成处理
  const handleFileUploadComplete = (files: any[]) => {
    const urls = files.map(f => f.url || '').filter(Boolean);
    setUploadedFiles(urls);
    message.success(`成功上传 ${urls.length} 个文件`);
  };

  // 创建任务列表
  const createTasks = useCallback(() => {
    if (uploadedFiles.length === 0) {
      message.error('请先上传商品图片');
      return [];
    }

    const newTasks: TaskItem[] = [];

    uploadedFiles.forEach((fileUrl, fileIndex) => {
      selectedScenarios.forEach(scenario => {
        for (let i = 0; i < generateCount; i++) {
          const task: TaskItem = {
            id: `task_${Date.now()}_${fileIndex}_${scenario}_${i}`,
            taskId: '', // 将在创建API后填充
            fileUrl,
            fileName: `商品图片_${fileIndex + 1}`,
            scenario,
            size: selectedSize,
            color: selectedColor,
            status: 'pending',
            progress: 0,
            createdAt: new Date()
          };

          newTasks.push(task);
        }
      });
    });

    return newTasks;
  }, [uploadedFiles, selectedScenarios, selectedSize, selectedColor, generateCount]);

  // 开始批量生成
  const startBatchGeneration = async () => {
    const newTasks = createTasks();
    if (newTasks.length === 0) return;

    setIsGenerating(true);
    setTasks(newTasks);
    setCompletedTasks([]);

    message.info(`开始生成 ${newTasks.length} 张商品图`);

    // 逐个提交任务
    for (const task of newTasks) {
      try {
        const response = await fetch('/api/tools/product_shoot/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            parameters: {
              scene: task.scenario,
              size: task.size,
              color: task.color,
              scenario_type: 'quick_product'
            },
            files: [task.fileUrl],
            toolKey: 'product_shoot'
          })
        });

        if (response.ok) {
          const result = await response.json();
          task.taskId = result.taskId;
          setCurrentGeneratingTask(task.taskId);

          // 建立SSE连接
          connectSSE(task.taskId);

          // 小间隔后处理下一个任务
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          task.status = 'failed';
          task.error = '创建任务失败';
        }
      } catch (error) {
        console.error('Failed to create task:', error);
        task.status = 'failed';
        task.error = error instanceof Error ? error.message : '未知错误';
      }

      setTasks(prev => [...prev]);
    }

    message.success('所有任务已提交，正在生成中...');
  };

  // 重试失败的任务
  const retryFailedTasks = async () => {
    const failedTasks = tasks.filter(t => t.status === 'failed');
    if (failedTasks.length === 0) return;

    message.info(`开始重试 ${failedTasks.length} 个失败任务`);

    for (const task of failedTasks) {
      task.status = 'pending';
      task.progress = 0;
      task.error = undefined;

      try {
        const response = await fetch('/api/tools/product_shoot/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            parameters: {
              scene: task.scenario,
              size: task.size,
              color: task.color,
              scenario_type: 'quick_product'
            },
            files: [task.fileUrl],
            toolKey: 'product_shoot'
          })
        });

        if (response.ok) {
          const result = await response.json();
          task.taskId = result.taskId;
          connectSSE(task.taskId);
        }
      } catch (error) {
        task.status = 'failed';
        task.error = '重试失败';
      }

      setTasks(prev => [...prev]);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  // 批量下载ZIP
  const downloadAsZip = async () => {
    const completedImages = completedTasks
      .filter(task => task.resultUrl)
      .map(task => task.resultUrl!);

    if (completedImages.length === 0) {
      message.warning('没有可下载的图片');
      return;
    }

    try {
      message.info('正在打包ZIP文件...');

      const response = await fetch('/api/tools/product-shoot/download-zip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrls: completedImages,
          filename: `product_shoot_${new Date().toISOString().slice(0, 10)}_${completedImages.length}images.zip`
        })
      });

      if (!response.ok) {
        throw new Error(`ZIP打包失败: ${response.statusText}`);
      }

      // 获取文件名
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameFromHeader = contentDisposition
        ?.split('filename=')[1]
        ?.replace(/"/g, '');
      const filename = filenameFromHeader || `product_shoot_${Date.now()}.zip`;

      // 创建下载链接
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      message.success(`成功下载 ${completedImages.length} 张图片的ZIP包`);

    } catch (error) {
      console.error('ZIP download failed:', error);
      message.error(`ZIP下载失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // 清空结果
  const clearResults = () => {
    setTasks([]);
    setCompletedTasks([]);
    setOverallProgress(0);
    setIsGenerating(false);
  };

  // 渲染场景选择
  const renderScenarioSelection = () => (
    <Card title="选择拍摄场景" style={{ marginBottom: 16 }}>
      <Row gutter={[16, 16]}>
        {SCENARIOS.map(scenario => (
          <Col span={8} key={scenario.key}>
            <Card
              hoverable
              className={`scenario-card ${selectedScenarios.includes(scenario.key) ? 'selected' : ''}`}
              onClick={() => {
                if (selectedScenarios.includes(scenario.key)) {
                  setSelectedScenarios(prev => prev.filter(s => s !== scenario.key));
                } else {
                  setSelectedScenarios(prev => [...prev, scenario.key]);
                }
              }}
              style={{
                border: selectedScenarios.includes(scenario.key) ? '2px solid #1890ff' : '1px solid #d9d9d9',
                cursor: 'pointer',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>
                {scenario.icon}
              </div>
              <Title level={5} style={{ margin: 0 }}>{scenario.title}</Title>
              <Text type="secondary" style={{ fontSize: 12 }}>{scenario.description}</Text>
              <div style={{ marginTop: 8 }}>
                <Space>
                  {scenario.colors.slice(0, 3).map(color => (
                    <div
                      key={color}
                      style={{
                        width: 16,
                        height: 16,
                        backgroundColor: color,
                        border: '1px solid #d9d9d9',
                        borderRadius: 2
                      }}
                    />
                  ))}
                </Space>
              </div>
              <div style={{ marginTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  <ClockCircleOutlined /> {scenario.estimatedTime}秒
                </Text>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </Card>
  );

  // 渲染参数配置
  const renderParameterConfig = () => (
    <Card title="快速配置" style={{ marginBottom: 16 }}>
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <div style={{ marginBottom: 8 }}>
            <Text strong>输出尺寸</Text>
          </div>
          <Select
            value={selectedSize}
            onChange={setSelectedSize}
            style={{ width: '100%' }}
            options={OUTPUT_SIZES.map(size => ({
              label: size.label,
              value: size.value
            }))}
          />
        </Col>

        <Col span={8}>
          <div style={{ marginBottom: 8 }}>
            <Text strong>背景颜色</Text>
          </div>
          <Space wrap>
            {['#FFFFFF', '#F5F5F5', '#000000', '#2C3E50'].map(color => (
              <button
                key={color}
                type="button"
                style={{
                  width: 32,
                  height: 32,
                  backgroundColor: color,
                  border: selectedColor === color ? '2px solid #1890ff' : '1px solid #d9d9d9',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                aria-label={`选择背景颜色 ${color}`}
                onClick={() => handleColorChange(color)}
              >
                {selectedColor === color && <CheckCircleOutlined style={{ color: '#1890ff', fontSize: 16 }} />}
              </button>
            ))}
          </Space>
        </Col>

        <Col span={8}>
          <div style={{ marginBottom: 8 }}>
            <Text strong>每张生成数量</Text>
          </div>
          <InputNumber
            min={1}
            max={10}
            value={generateCount}
            onChange={(value) => setGenerateCount(value || 1)}
            style={{ width: '100%' }}
          />
        </Col>
      </Row>
    </Card>
  );

  // 渲染任务进度
  const renderTaskProgress = () => (
    <Card title={`生成进度 (${tasks.filter(t => t.status === 'completed').length}/${tasks.length})`}>
      {tasks.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Progress
            percent={overallProgress}
            status={overallProgress === 100 ? 'success' : 'active'}
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#87d068',
            }}
          />
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <Text type="secondary">
              总体进度: {overallProgress}% |
              已完成: {tasks.filter(t => t.status === 'completed').length} |
              进行中: {tasks.filter(t => t.status === 'processing').length} |
              失败: {tasks.filter(t => t.status === 'failed').length}
            </Text>
          </div>
        </div>
      )}

      <List
        dataSource={tasks.slice(0, 10)} // 只显示前10个
        renderItem={(task) => (
          <List.Item>
            <List.Item.Meta
              avatar={
                <div style={{ width: 40, height: 40, backgroundColor: '#f0f0f0', borderRadius: 4 }}>
                  {task.status === 'completed' ? (
                    <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20, lineHeight: '40px', textAlign: 'center', display: 'block' }} />
                  ) : task.status === 'failed' ? (
                    <ExclamationCircleOutlined style={{ color: '#ff4d4f', fontSize: 20, lineHeight: '40px', textAlign: 'center', display: 'block' }} />
                  ) : (
                    <LoadingOutlined style={{ color: '#1890ff', fontSize: 20, lineHeight: '40px', textAlign: 'center', display: 'block' }} />
                  )}
                </div>
              }
              title={`${task.fileName} - ${SCENARIOS.find(s => s.key === task.scenario)?.title}`}
              description={
                <div>
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      尺寸: {task.size} | 颜色: {task.color}
                    </Text>
                    {task.status === 'processing' && (
                      <Progress percent={task.progress} size="small" />
                    )}
                    {task.error && (
                      <Text type="danger" style={{ fontSize: 12 }}>{task.error}</Text>
                    )}
                  </Space>
                </div>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  );

  // 渲染结果展示
  const renderResults = () => (
    <Card
      title={`生成结果 (${completedTasks.length}张)`}
      extra={
        <Space>
          {completedTasks.length > 0 && (
            <Button
              type="primary"
              icon={<FileZipOutlined />}
              onClick={downloadAsZip}
            >
              下载ZIP
            </Button>
          )}
          <Button onClick={clearResults}>
            清空结果
          </Button>
        </Space>
      }
    >
      {completedTasks.length > 0 ? (
        <Row gutter={[16, 16]}>
          {completedTasks.map((task, index) => (
            <Col span={6} key={task.id}>
              <Card
                hoverable
                cover={
                  <Image
                    src={task.resultUrl}
                    alt={`${task.fileName} - ${SCENARIOS.find(s => s.key === task.scenario)?.title}`}
                    style={{ width: '100%', height: 160, objectFit: 'cover' }}
                    preview
                  />
                }
                actions={[
                  <Tooltip key="preview" title="预览">
                    <EyeOutlined />
                  </Tooltip>,
                  <Tooltip key="download" title="下载">
                    <DownloadOutlined
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = task.resultUrl!;
                        link.download = `${task.fileName}_${task.scenario}_${index + 1}.jpg`;
                        link.click();
                      }}
                    />
                  </Tooltip>
                ]}
              >
                <Card.Meta
                  title={
                    <Text ellipsis style={{ fontSize: 12 }}>
                      {SCENARIOS.find(s => s.key === task.scenario)?.title}
                    </Text>
                  }
                  description={
                    <Space direction="vertical" size="small">
                      <Text type="secondary" style={{ fontSize: 10 }}>
                        {task.size}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 10 }}>
                        {task.completedAt?.toLocaleString()}
                      </Text>
                    </Space>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Empty description="暂无生成结果" />
      )}
    </Card>
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>
          <CameraOutlined style={{ marginRight: 8 }} />
          商品图快速通道
        </Title>
        <Paragraph type="secondary">
          10秒快速生成专业商品图，支持多场景、批量生成、ZIP导出
        </Paragraph>
      </div>

      {/* 配置区域 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          {renderScenarioSelection()}
          {renderParameterConfig()}
        </Col>
      </Row>

      {/* 文件上传区域 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card title="上传商品图片">
            <COSBatchUploader
              config={{
                maxFileSize: 10,
                maxFileCount: 50,
                autoStart: true,
                previewEnabled: true
              }}
              onUploadComplete={handleFileUploadComplete}
            />
          </Card>
        </Col>
      </Row>

      {/* 操作按钮 */}
      <Row style={{ marginBottom: 24, textAlign: 'center' }}>
        <Col span={24}>
          <Space size="large">
            <Button
              type="primary"
              size="large"
              onClick={startBatchGeneration}
              loading={isGenerating}
              disabled={uploadedFiles.length === 0 || selectedScenarios.length === 0}
              icon={<PlayCircleOutlined />}
            >
              {isGenerating ? '生成中...' : `开始生成 (${uploadedFiles.length} × ${selectedScenarios.length} × ${generateCount} = ${uploadedFiles.length * selectedScenarios.length * generateCount}张)`}
            </Button>

            {tasks.some(t => t.status === 'failed') && (
              <Button
                icon={<ReloadOutlined />}
                onClick={retryFailedTasks}
                disabled={isGenerating}
              >
                重试失败 ({tasks.filter(t => t.status === 'failed').length})
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      {/* 进度和结果 */}
      <Row gutter={[16, 16]}>
        {tasks.length > 0 && (
          <Col span={12}>
            {renderTaskProgress()}
          </Col>
        )}
        {completedTasks.length > 0 && (
          <Col span={tasks.length > 0 ? 12 : 24}>
            {renderResults()}
          </Col>
        )}
      </Row>
    </div>
  );
}
