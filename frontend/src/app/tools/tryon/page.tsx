/**
 * PAGE-P1-TRY-103 AI试衣页面
 * 艹，人物照+服装图，体型/遮挡参数，批量处理，前后对比，必须专业！
 *
 * 功能清单：
 * 1. 人物照和服装图双图上传
 * 2. 体型参数调节（身高、体重、体型）
 * 3. 遮挡参数调节（遮挡级别、保留区域）
 * 4. 批量处理多个服装
 * 5. 前后对比展示（滑动对比、并排对比）
 * 6. 实时进度和结果管理
 *
 * @author 老王
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import NextImage from 'next/image';
import {
  Card,
  Row,
  Col,
  Button,
  Typography,
  Upload,
  Slider,
  Select,
  Switch,
  Progress,
  message,
  Space,
  Alert,
  Image,
  Spin,
  Tooltip,
  Badge,
  Divider,
  Empty,
  Modal,
  List,
  Tag,
  Radio,
  InputNumber,
  Tabs
} from 'antd';
import {
  UserOutlined,
  SkinOutlined,
  UploadOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  EyeOutlined,
  FileImageOutlined,
  SwapOutlined,
  ZoomInOutlined,
  DownloadOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  DeleteOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { COSBatchUploader } from '@/components/base/COSBatchUploader';
import { useSSE } from '@/hooks/useSSE';
import type { ProgressEvent, StatusEvent, CompleteEvent } from '@/hooks/useSSE';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

// 体型配置
const BODY_TYPES = [
  { label: '纤细', value: 'slim', description: '身材纤细，骨架小' },
  { label: '标准', value: 'standard', description: '标准身材，比例协调' },
  { label: '健美', value: 'athletic', description: '肌肉线条明显，体型健美' },
  { label: '丰满', value: 'curvy', description: '身材丰满，曲线明显' }
];

// 遮挡级别配置
const OCCLUSION_LEVELS = [
  { label: '无遮挡', value: 'none', description: '完全可见，无遮挡' },
  { label: '轻微遮挡', value: 'light', description: '轻微遮挡，主要部分可见' },
  { label: '中度遮挡', value: 'medium', description: '中度遮挡，关键部分可见' },
  { label: '重度遮挡', value: 'heavy', description: '重度遮挡，仅部分可见' }
];

// 试衣任务状态
interface TryOnTask {
  id: string;
  taskId: string;
  personImage: string;
  clothingImage: string;
  clothingName: string;
  bodyType: string;
  height: number;
  weight: number;
  occlusionLevel: string;
  preserveFace: boolean;
  preserveHair: boolean;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  resultImage?: string;
  originalClothingImage?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

// 对比模式
type ComparisonMode = 'slider' | 'side-by-side' | 'overlay';

export default function TryOnPage() {
  // 人物图片
  const [personImage, setPersonImage] = useState<string>('');

  // 服装图片列表
  const [clothingImages, setClothingImages] = useState<Array<{url: string, name: string}>>([]);

  // 体型参数
  const [bodyType, setBodyType] = useState<string>('standard');
  const [height, setHeight] = useState<number>(170);
  const [weight, setWeight] = useState<number>(60);

  // 遮挡参数
  const [occlusionLevel, setOcclusionLevel] = useState<string>('light');
  const [preserveFace, setPreserveFace] = useState<boolean>(true);
  const [preserveHair, setPreserveHair] = useState<boolean>(true);

  // 任务管理
  const [tasks, setTasks] = useState<TryOnTask[]>([]);
  const [completedTasks, setCompletedTasks] = useState<TryOnTask[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [overallProgress, setOverallProgress] = useState<number>(0);

  // 对比展示
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('slider');
  const [selectedTask, setSelectedTask] = useState<TryOnTask | null>(null);
  const [comparisonVisible, setComparisonVisible] = useState<boolean>(false);

  // SSE连接
  const { isConnected, connect: connectSSE, disconnect: disconnectSSE } = useSSE({
    onProgress: (event: ProgressEvent) => {
      console.log('TryOn progress:', event);

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

      updateOverallProgress();
    },
    onComplete: (event: CompleteEvent) => {
      console.log('TryOn completed:', event);

      setTasks(prev => prev.map(task => {
        if (task.taskId === event.taskId) {
          const completedTask = {
            ...task,
            status: 'completed' as const,
            progress: 100,
            resultImage: event.result.images[0],
            originalClothingImage: event.result.metadata?.originalImage || task.clothingImage,
            completedAt: new Date(event.completedAt)
          };

          setCompletedTasks(prev => [...prev, completedTask]);
          return completedTask;
        }
        return task;
      }));

      updateOverallProgress();
    },
    onError: (error) => {
      console.error('TryOn SSE error:', error);
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

  // 人物图片上传处理
  const handlePersonImageUpload = (files: any[]) => {
    if (files.length > 0) {
      setPersonImage(files[0].url || '');
      message.success('人物图片上传成功');
    }
  };

  // 服装图片上传处理
  const handleClothingImagesUpload = (files: any[]) => {
    const newClothingImages = files.map(file => ({
      url: file.url || '',
      name: file.name || `服装图片_${Date.now()}`
    }));

    setClothingImages(prev => [...prev, ...newClothingImages]);
    message.success(`成功上传 ${newClothingImages.length} 件服装`);
  };

  // 删除服装图片
  const removeClothingImage = (index: number) => {
    setClothingImages(prev => prev.filter((_, i) => i !== index));
  };

  // 开始试衣处理
  const startTryOn = async () => {
    if (!personImage) {
      message.error('请先上传人物图片');
      return;
    }

    if (clothingImages.length === 0) {
      message.error('请至少上传一件服装');
      return;
    }

    setIsProcessing(true);
    const newTasks: TryOnTask[] = [];

    // 为每个服装创建任务
    clothingImages.forEach((clothing, index) => {
      const task: TryOnTask = {
        id: `tryon_${Date.now()}_${index}`,
        taskId: '',
        personImage,
        clothingImage: clothing.url,
        clothingName: clothing.name,
        bodyType,
        height,
        weight,
        occlusionLevel,
        preserveFace,
        preserveHair,
        status: 'pending',
        progress: 0,
        createdAt: new Date()
      };

      newTasks.push(task);
    });

    setTasks(newTasks);
    setCompletedTasks([]);

    message.info(`开始为 ${clothingImages.length} 件服装进行AI试衣`);

    // 逐个提交任务
    for (const task of newTasks) {
      try {
        const response = await fetch('/api/tools/ai_tryon/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            parameters: {
              body_type: bodyType,
              height: height,
              weight: weight,
              occlusion_level: occlusionLevel,
              preserve_face: preserveFace,
              preserve_hair: preserveHair,
              tryon_mode: 'professional'
            },
            files: [personImage, task.clothingImage],
            toolKey: 'ai_tryon'
          })
        });

        if (response.ok) {
          const result = await response.json();
          task.taskId = result.taskId;
          connectSSE(task.taskId);

          // 小间隔后处理下一个任务
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          task.status = 'failed';
          task.error = '创建任务失败';
        }
      } catch (error) {
        console.error('Failed to create tryon task:', error);
        task.status = 'failed';
        task.error = error instanceof Error ? error.message : '未知错误';
      }

      setTasks(prev => [...prev]);
    }

    message.success('所有试衣任务已提交，正在AI处理中...');
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
        const response = await fetch('/api/tools/ai_tryon/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            parameters: {
              body_type: task.bodyType,
              height: task.height,
              weight: task.weight,
              occlusion_level: task.occlusionLevel,
              preserve_face: task.preserveFace,
              preserve_hair: task.preserveHair,
              tryon_mode: 'professional'
            },
            files: [task.personImage, task.clothingImage],
            toolKey: 'ai_tryon'
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
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  // 打开对比展示
  const openComparison = (task: TryOnTask) => {
    setSelectedTask(task);
    setComparisonVisible(true);
  };

  // 清空结果
  const clearResults = () => {
    setTasks([]);
    setCompletedTasks([]);
    setOverallProgress(0);
    setIsProcessing(false);
  };

  // 渲染对比组件
  const renderComparison = (task: TryOnTask) => {
    if (!task.resultImage || !task.originalClothingImage) return null;

    switch (comparisonMode) {
      case 'slider':
        return (
          <div style={{ position: 'relative', width: '100%', height: 400 }}>
            <NextImage
              src={task.originalClothingImage}
              alt="Original"
              fill
              style={{ objectFit: 'cover' }}
              unoptimized
            />
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '100%', overflow: 'hidden' }}>
              <NextImage
                src={task.resultImage}
                alt="TryOn Result"
                fill
                style={{ objectFit: 'cover' }}
                unoptimized
              />
            </div>
            <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.7)', color: 'white', padding: '4px 8px', borderRadius: 4 }}>
              <Text style={{ color: 'white', fontSize: 12 }}>滑动对比模式</Text>
            </div>
          </div>
        );

      case 'side-by-side':
        return (
          <Row gutter={16}>
            <Col span={12}>
              <div style={{ textAlign: 'center' }}>
                <Text strong>原服装</Text>
                <NextImage
                  src={task.originalClothingImage}
                  alt="Original"
                  width={600}
                  height={350}
                  style={{ width: '100%', height: 350, objectFit: 'cover', marginTop: 8 }}
                  unoptimized
                />
              </div>
            </Col>
            <Col span={12}>
              <div style={{ textAlign: 'center' }}>
                <Text strong>试穿效果</Text>
                <NextImage
                  src={task.resultImage}
                  alt="TryOn Result"
                  width={600}
                  height={350}
                  style={{ width: '100%', height: 350, objectFit: 'cover', marginTop: 8 }}
                  unoptimized
                />
              </div>
            </Col>
          </Row>
        );

      case 'overlay':
        return (
          <div style={{ position: 'relative', width: '100%', height: 400 }}>
            <NextImage
              src={task.originalClothingImage}
              alt="Original"
              fill
              style={{ objectFit: 'cover', opacity: 0.5 }}
              unoptimized
            />
            <NextImage
              src={task.resultImage}
              alt="TryOn Result"
              fill
              style={{ objectFit: 'cover', opacity: 0.8 }}
              unoptimized
            />
            <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.7)', color: 'white', padding: '4px 8px', borderRadius: 4 }}>
              <Text style={{ color: 'white', fontSize: 12 }}>叠加对比模式</Text>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // 渲染人物图片上传
  const renderPersonImageUpload = () => (
    <Card title="上传人物图片" style={{ marginBottom: 16 }}>
      <div style={{ textAlign: 'center' }}>
        {personImage ? (
          <div>
            <Image
              src={personImage}
              alt="Person"
              style={{ maxWidth: 200, maxHeight: 200, objectFit: 'cover' }}
            />
            <div style={{ marginTop: 8 }}>
              <Button
                size="small"
                onClick={() => setPersonImage('')}
                icon={<DeleteOutlined />}
              >
                重新上传
              </Button>
            </div>
          </div>
        ) : (
          <COSBatchUploader
            config={{
              maxFileSize: 10,
              maxFileCount: 1,
              autoStart: true,
              previewEnabled: false
            }}
            onUploadComplete={handlePersonImageUpload}
          />
        )}
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            请上传正面站立的人物照片，建议清晰展示全身轮廓
          </Text>
        </div>
      </div>
    </Card>
  );

  // 渲染服装图片上传
  const renderClothingImageUpload = () => (
    <Card title="上传服装图片" style={{ marginBottom: 16 }}>
      <COSBatchUploader
        config={{
          maxFileSize: 10,
          maxFileCount: 20,
          autoStart: true,
          previewEnabled: true
        }}
        onUploadComplete={handleClothingImagesUpload}
      />

      {clothingImages.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Text strong>已上传服装 ({clothingImages.length}件)</Text>
          <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
            {clothingImages.map((clothing, index) => (
              <Col span={6} key={index}>
                <div style={{ position: 'relative' }}>
                  <Image
                    src={clothing.url}
                    alt={clothing.name}
                    style={{ width: '100%', height: 80, objectFit: 'cover' }}
                  />
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeClothingImage(index)}
                    style={{ position: 'absolute', top: 0, right: 0 }}
                  />
                </div>
                <Text ellipsis style={{ fontSize: 12, display: 'block' }}>
                  {clothing.name}
                </Text>
              </Col>
            ))}
          </Row>
        </div>
      )}
    </Card>
  );

  // 渲染体型参数设置
  const renderBodyParameters = () => (
    <Card title="体型参数" style={{ marginBottom: 16 }}>
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <div style={{ marginBottom: 8 }}>
            <Text strong>体型类型</Text>
          </div>
          <Select
            value={bodyType}
            onChange={setBodyType}
            style={{ width: '100%' }}
            options={BODY_TYPES.map(type => ({
              label: type.label,
              value: type.value
            }))}
          />
          <div style={{ marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {BODY_TYPES.find(t => t.value === bodyType)?.description}
            </Text>
          </div>
        </Col>

        <Col span={6}>
          <div style={{ marginBottom: 8 }}>
            <Text strong>身高 (cm)</Text>
          </div>
          <InputNumber
            min={140}
            max={200}
            value={height}
            onChange={(value) => setHeight(value || 170)}
            style={{ width: '100%' }}
          />
        </Col>

        <Col span={6}>
          <div style={{ marginBottom: 8 }}>
            <Text strong>体重 (kg)</Text>
          </div>
          <InputNumber
            min={35}
            max={120}
            value={weight}
            onChange={(value) => setWeight(value || 60)}
            style={{ width: '100%' }}
          />
        </Col>
      </Row>

      <div style={{ marginTop: 16 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          BMI: {(weight / ((height / 100) ** 2)).toFixed(1)} -
          {weight / ((height / 100) ** 2) < 18.5 ? ' 偏瘦' :
           weight / ((height / 100) ** 2) < 24 ? ' 正常' :
           weight / ((height / 100) ** 2) < 28 ? ' 偏胖' : ' 肥胖'}
        </Text>
      </div>
    </Card>
  );

  // 渲染遮挡参数设置
  const renderOcclusionParameters = () => (
    <Card title="遮挡参数" style={{ marginBottom: 16 }}>
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <div style={{ marginBottom: 8 }}>
            <Text strong>遮挡级别</Text>
          </div>
          <Select
            value={occlusionLevel}
            onChange={setOcclusionLevel}
            style={{ width: '100%' }}
            options={OCCLUSION_LEVELS.map(level => ({
              label: level.label,
              value: level.value
            }))}
          />
          <div style={{ marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {OCCLUSION_LEVELS.find(l => l.value === occlusionLevel)?.description}
            </Text>
          </div>
        </Col>

        <Col span={12}>
          <div style={{ marginBottom: 16 }}>
            <Text strong>保留设置</Text>
          </div>
          <Space direction="vertical">
            <div>
              <Switch
                checked={preserveFace}
                onChange={setPreserveFace}
              />
              <Text style={{ marginLeft: 8 }}>保留面部特征</Text>
            </div>
            <div>
              <Switch
                checked={preserveHair}
                onChange={setPreserveHair}
              />
              <Text style={{ marginLeft: 8 }}>保留发型</Text>
            </div>
          </Space>
        </Col>
      </Row>
    </Card>
  );

  // 渲染处理进度
  const renderProcessingProgress = () => (
    <Card title={`试衣进度 (${completedTasks.length}/${tasks.length})`}>
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
        dataSource={tasks}
        renderItem={(task) => (
          <List.Item
            key={task.id}
            actions={task.status === 'completed' ? [
              <Button
                key="compare"
                type="link"
                icon={<SwapOutlined />}
                onClick={() => openComparison(task)}
              >
                对比
              </Button>
            ] : []}
          >
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
              title={task.clothingName}
              description={
                <div>
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      体型: {BODY_TYPES.find(t => t.value === task.bodyType)?.label} |
                      遮挡: {OCCLUSION_LEVELS.find(l => l.value === task.occlusionLevel)?.label}
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
      title={`试衣结果 (${completedTasks.length}件)`}
      extra={
        <Space>
          <Button onClick={clearResults}>
            清空结果
          </Button>
        </Space>
      }
    >
      {completedTasks.length > 0 ? (
        <Row gutter={[16, 16]}>
          {completedTasks.map((task) => (
            <Col span={8} key={task.id}>
              <Card
                hoverable
                cover={
                  <Image
                    src={task.resultImage}
                    alt={task.clothingName}
                    style={{ width: '100%', height: 200, objectFit: 'cover' }}
                    preview
                  />
                }
                actions={[
                  <Tooltip key="compare" title="对比查看">
                    <SwapOutlined onClick={() => openComparison(task)} />
                  </Tooltip>,
                  <Tooltip key="download" title="下载">
                    <DownloadOutlined
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = task.resultImage!;
                        link.download = `tryon_${task.clothingName}_${Date.now()}.jpg`;
                        link.click();
                      }}
                    />
                  </Tooltip>
                ]}
              >
                <Card.Meta
                  title={
                    <Text ellipsis style={{ fontSize: 14 }}>
                      {task.clothingName}
                    </Text>
                  }
                  description={
                    <Space direction="vertical" size="small">
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {BODY_TYPES.find(t => t.value === task.bodyType)?.label}
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
        <Empty description="暂无试衣结果" />
      )}
    </Card>
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>
          <UserOutlined style={{ marginRight: 8 }} />
          AI试衣
        </Title>
        <Paragraph type="secondary">
          上传人物照和服装图片，AI智能试穿，支持体型调节和前后对比
        </Paragraph>
      </div>

      <Row gutter={[24, 24]}>
        {/* 左侧：图片上传 */}
        <Col span={12}>
          {renderPersonImageUpload()}
          {renderClothingImageUpload()}
        </Col>

        {/* 右侧：参数设置 */}
        <Col span={12}>
          {renderBodyParameters()}
          {renderOcclusionParameters()}
        </Col>
      </Row>

      {/* 操作按钮 */}
      <Row style={{ marginBottom: 24, textAlign: 'center', marginTop: 24 }}>
        <Col span={24}>
          <Space size="large">
            <Button
              type="primary"
              size="large"
              onClick={startTryOn}
              loading={isProcessing}
              disabled={!personImage || clothingImages.length === 0}
              icon={<PlayCircleOutlined />}
            >
              {isProcessing ? '试衣中...' : `开始AI试衣 (${clothingImages.length}件)`}
            </Button>

            {tasks.some(t => t.status === 'failed') && (
              <Button
                icon={<ReloadOutlined />}
                onClick={retryFailedTasks}
                disabled={isProcessing}
              >
                重试失败 ({tasks.filter(t => t.status === 'failed').length})
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      {/* 进度和结果 */}
      <Row gutter={[24, 24]}>
        {tasks.length > 0 && (
          <Col span={24}>
            {renderProcessingProgress()}
          </Col>
        )}
        {completedTasks.length > 0 && (
          <Col span={24}>
            {renderResults()}
          </Col>
        )}
      </Row>

      {/* 对比展示弹窗 */}
      <Modal
        title={
          <Space>
            <SwapOutlined />
            <span>试衣对比 - {selectedTask?.clothingName}</span>
          </Space>
        }
        open={comparisonVisible}
        onCancel={() => setComparisonVisible(false)}
        width={900}
        footer={[
          <Radio.Group
            key="mode"
            value={comparisonMode}
            onChange={(e) => setComparisonMode(e.target.value)}
            size="small"
          >
            <Radio.Button value="slider">滑动对比</Radio.Button>
            <Radio.Button value="side-by-side">并排对比</Radio.Button>
            <Radio.Button value="overlay">叠加对比</Radio.Button>
          </Radio.Group>,
          <Button key="download" type="primary" icon={<DownloadOutlined />}>
            下载对比图
          </Button>
        ]}
      >
        {selectedTask && renderComparison(selectedTask)}
      </Modal>
    </div>
  );
}
