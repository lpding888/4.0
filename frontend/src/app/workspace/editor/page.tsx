/**
 * PAGE-P1-CANVAS-107 画版（圈选+提示词）
 * 艹，这个画版功能必须完美，支持圈选导出mask、Pipeline集成、SSE进度！
 *
 * @author 老王
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card,
  Button,
  Upload,
  Select,
  Input,
  Slider,
  Row,
  Col,
  Space,
  Divider,
  Typography,
  Alert,
  Tooltip,
  Switch,
  Tag,
  Progress,
  Empty,
  Spin
} from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  EyeOutlined,
  SaveOutlined,
  EditOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { useSSE } from '@/hooks/useSSE';
import type { ProgressEvent, StatusEvent, CompleteEvent } from '@/hooks/useSSE';
import { COSBatchUploader } from '@/lib/storage/cos-batch-uploader';
import { ThemeSwitcherCompact } from '@/components/ThemeSwitcher';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// 画布模式
export type CanvasMode = 'inpaint' | 'recolor' | 'dewrinkle';

// 处理结果接口
export interface ProcessingResult {
  id: string;
  imageUrl: string;
  maskUrl?: string;
  mode: CanvasMode;
  parameters: {
    prompt: string;
    strength: number;
    guidance: number;
    steps: number;
    seed: number;
  };
  createdAt: string;
}

// 画布状态接口
export interface CanvasState {
  isDrawing: boolean;
  backgroundImage: string | null;
  masks: Array<{
    id: string;
    path: any;
    type: CanvasMode;
    prompt: string;
  }>;
  currentMask: any;
  zoom: number;
  pan: { x: number; y: number };
}

type CanvasTaskProgress = {
  taskId: string;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message?: string;
  result?: CompleteEvent['result'];
  error?: string;
};

// 处理模式配置
const PROCESSING_MODES = [
  {
    key: 'inpaint' as CanvasMode,
    name: '智能补全',
    description: 'AI智能填充圈选区域',
    promptRequired: true,
    icon: '🎨'
  },
  {
    key: 'recolor' as CanvasMode,
    name: '智能换色',
    description: 'AI为圈选区域更换颜色',
    promptRequired: true,
    icon: '🎨'
  },
  {
    key: 'dewrinkle' as CanvasMode,
    name: '智能去皱',
    description: 'AI去除圈选区域褶皱',
    promptRequired: false,
    icon: '✨'
  }
];

const loadFabric = async () => {
  const fabricModule = await import('fabric');
  return (fabricModule as { fabric?: any; default: any }).fabric ?? fabricModule.default;
};

export default function CanvasPage() {
  // Canvas相关状态
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<any>(null);
  const [canvasState, setCanvasState] = useState<CanvasState>({
    isDrawing: false,
    backgroundImage: null,
    masks: [],
    currentMask: null,
    zoom: 1,
    pan: { x: 0, y: 0 }
  });

  // UI状态
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [selectedMode, setSelectedMode] = useState<CanvasMode>('inpaint');
  const [prompt, setPrompt] = useState('');
  const [parameters, setParameters] = useState({
    strength: 0.8,
    guidance: 7.5,
    steps: 20,
    seed: -1
  });
  const [taskProgress, setTaskProgress] = useState<CanvasTaskProgress | null>(null);

  // SSE和上传器
  const { connect, disconnect, isConnected } = useSSE({
    onProgress: (event: ProgressEvent) => {
      setTaskProgress({
        taskId: event.taskId,
        progress: event.progress,
        status: 'processing',
        message: event.message
      });
    },
    onStatus: (event: StatusEvent) => {
      setTaskProgress((prev) => ({
        taskId: event.taskId,
        progress: prev?.progress ?? 0,
        status: event.status,
        message: event.message,
        error: event.error,
        result: prev?.result
      }));
    },
    onComplete: (event: CompleteEvent) => {
      setTaskProgress({
        taskId: event.taskId,
        progress: 100,
        status: 'completed',
        message: '处理完成',
        result: event.result
      });
    },
    onError: (error) => {
      console.error('Canvas SSE error:', error);
      setTaskProgress((prev) =>
        prev
          ? { ...prev, status: 'failed', error: error.message }
          : {
              taskId: 'unknown',
              progress: 0,
              status: 'failed',
              error: error.message
            }
      );
    }
  });
  const cosUploader = new COSBatchUploader();

  // 初始化Fabric Canvas
  useEffect(() => {
    const initCanvas = async () => {
      if (canvasRef.current && !fabricCanvasRef.current) {
        // 动态导入fabric
        try {
          const fabric = await loadFabric();

          const canvas = new fabric.Canvas(canvasRef.current, {
            width: 800,
            height: 600,
            backgroundColor: '#f0f0f0',
            selection: false,
            preserveObjectStacking: true
          });

          fabricCanvasRef.current = canvas;

          // 设置画笔样式
          canvas.freeDrawingBrush.width = 20;
          canvas.freeDrawingBrush.color = 'rgba(255, 0, 0, 0.5)';

          // 绑定绘图事件
          canvas.on('path:created', handlePathCreated);

          console.log('Canvas initialized');
        } catch (error) {
          console.error('Failed to initialize fabric:', error);
        }
      }
    };

    initCanvas();

    return () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
    };
  }, []);

  // 处理路径创建
  const handlePathCreated = useCallback((e: any) => {
    const path = e.path;
    if (!path || !fabricCanvasRef.current) return;

    // 设置路径样式
    path.set({
      fill: 'rgba(255, 255, 255, 0.3)',
      stroke: '#ff0000',
      strokeWidth: 2,
      selectable: false,
      evented: false
    });

    // 添加到masks数组
    const newMask = {
      id: `mask_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      path,
      type: selectedMode,
      prompt: selectedMode !== 'dewrinkle' ? prompt : ''
    };

    setCanvasState(prev => ({
      ...prev,
      masks: [...prev.masks, newMask]
    }));

    console.log('Mask created:', newMask.id);
  }, [selectedMode, prompt]);

  // 上传背景图片
  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      // 上传到COS
      const uploadedFile = await cosUploader.uploadFile(file);

      // 加载到Canvas
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imgSrc = e.target?.result as string;
      try {
        const fabric = await loadFabric();

          fabric.Image.fromURL(imgSrc, (img: any) => {
            if (!fabricCanvasRef.current) return;

            // 调整图片大小以适应画布
            const canvas = fabricCanvasRef.current;
            const scale = Math.min(
              canvas.width! / img.width!,
              canvas.height! / img.height!
            );

            img.scale(scale * 0.9);
            img.set({
              left: (canvas.width! - img.width! * scale * 0.9) / 2,
              top: (canvas.height! - img.height! * scale * 0.9) / 2,
              selectable: false,
              evented: false
            });

            // 设置为背景
            canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
              backgroundImageOpacity: 1,
              backgroundImageStretch: false
            });

            setCanvasState(prev => ({
              ...prev,
              backgroundImage: uploadedFile.url
            }));

            console.log('Background image loaded');
          });
        } catch (error) {
          console.error('Failed to load image to canvas:', error);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Failed to upload image:', error);
    } finally {
      setUploading(false);
    }
  };

  // 切换绘图模式
  const toggleDrawingMode = () => {
    if (!fabricCanvasRef.current) return;

    const isDrawingMode = fabricCanvasRef.current.isDrawingMode;
    fabricCanvasRef.current.isDrawingMode = !isDrawingMode;

    setCanvasState(prev => ({
      ...prev,
      isDrawing: !isDrawingMode
    }));

    console.log('Drawing mode:', !isDrawingMode);
  };

  // 清除所有遮罩
  const clearAllMasks = () => {
    if (!fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    const objects = canvas.getObjects();

    // 移除所有遮罩对象
    objects.forEach((obj: any) => {
      if (obj.type === 'path') {
        canvas.remove(obj);
      }
    });

    canvas.renderAll();

    setCanvasState(prev => ({
      ...prev,
      masks: []
    }));

    console.log('All masks cleared');
  };

  // 撤销最后一个遮罩
  const undoLastMask = () => {
    if (!fabricCanvasRef.current || canvasState.masks.length === 0) return;

    const canvas = fabricCanvasRef.current;
    const objects = canvas.getObjects();
    const pathObjects = objects.filter((obj: any) => obj.type === 'path');

    if (pathObjects.length > 0) {
      const lastPath = pathObjects[pathObjects.length - 1];
      canvas.remove(lastPath);
      canvas.renderAll();

      setCanvasState(prev => ({
        ...prev,
        masks: prev.masks.slice(0, -1)
      }));
    }
  };

  // 导出Mask为Base64
  const exportMaskToBase64 = useCallback(async (): Promise<string> => {
    if (!fabricCanvasRef.current || !canvasState.backgroundImage) {
      throw new Error('No background image or canvas');
    }

    const canvas = fabricCanvasRef.current;

    // 创建临时canvas用于mask导出
    const fabric = await loadFabric();
    const maskCanvas = new fabric.StaticCanvas(null, {
      width: canvas.width,
      height: canvas.height,
      backgroundColor: 'black'
    });

    // 复制背景图片到mask canvas
    const bgImage = canvas.backgroundImage;
    if (bgImage) {
      maskCanvas.setBackgroundImage(bgImage, maskCanvas.renderAll.bind(maskCanvas));
    }

    // 复制所有遮罩路径到mask canvas
    const objects = canvas.getObjects();
    objects.forEach((obj: any) => {
      if (obj.type === 'path') {
        const path = obj as any;
        const pathClone = fabric.util.object.clone(path);
        pathClone.set({
          fill: 'white',
          stroke: 'white',
          strokeWidth: 0
        });
        maskCanvas.add(pathClone);
      }
    });

    maskCanvas.renderAll();

    // 导出为Base64
    const maskDataURL = maskCanvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 2
    });

    // 清理临时canvas
    maskCanvas.dispose();

    console.log('Mask exported successfully');
    return maskDataURL;
  }, [canvasState.backgroundImage]);

  // 开始处理
  const startProcessing = async () => {
    if (!canvasState.backgroundImage || canvasState.masks.length === 0) {
      console.error('No background image or masks');
      return;
    }

    try {
      setProcessing(true);
      setTaskProgress(null);
      setResults([]);

      // 导出mask
      const maskBase64 = await exportMaskToBase64();

      // 提交处理任务
      const response = await fetch('/api/tools/canvas/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parameters: {
            mode: selectedMode,
            prompt: selectedMode !== 'dewrinkle' ? prompt : '',
            strength: parameters.strength,
            guidance: parameters.guidance,
            steps: parameters.steps,
            seed: parameters.seed,
            mask: maskBase64
          },
          files: [canvasState.backgroundImage],
          toolKey: 'canvas'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit task');
      }

      const { taskId } = await response.json();

      // 连接SSE获取进度
      connect(taskId);

    } catch (error) {
      console.error('Failed to start processing:', error);
      setProcessing(false);
    }
  };

  // SSE进度更新处理
  useEffect(() => {
    if (!taskProgress) {
      return;
    }

    if (taskProgress.status === 'completed' && taskProgress.result) {
      setProcessing(false);
      setResults([{
        id: taskProgress.taskId,
        imageUrl: taskProgress.result?.images[0] || '',
        maskUrl: taskProgress.result?.metadata?.maskUrl || '',
        mode: selectedMode,
        parameters: { ...parameters, prompt },
        createdAt: new Date().toISOString()
      }]);
      disconnect();
    } else if (taskProgress.status === 'failed') {
      setProcessing(false);
      console.error('Processing failed:', taskProgress.error);
      disconnect();
    }
  }, [taskProgress, selectedMode, parameters, prompt, disconnect]);

  // 下载结果
  const downloadResult = async (result: ProcessingResult) => {
    try {
      const response = await fetch(result.imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `canvas_${result.mode}_${Date.now()}.png`;
      link.click();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download result:', error);
    }
  };

  return (
    <div className="canvas-container">
      <Row gutter={[16, 16]}>
        {/* 左侧工具栏 */}
        <Col span={6}>
          <Card title="画版工具" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              {/* 图片上传 */}
              <Upload
                accept="image/*"
                beforeUpload={(file) => {
                  handleImageUpload(file);
                  return false;
                }}
                showUploadList={false}
              >
                <Button
                  icon={<UploadOutlined />}
                  loading={uploading}
                  block
                >
                  {uploading ? '上传中...' : '上传背景图'}
                </Button>
              </Upload>

              <Divider />

              {/* 绘图控制 */}
              <Button
                type={canvasState.isDrawing ? 'primary' : 'default'}
                icon={<EditOutlined />}
                onClick={toggleDrawingMode}
                block
              >
                {canvasState.isDrawing ? '停止绘图' : '开始圈选'}
              </Button>

              <Space>
                <Button
                  icon={<CloseCircleOutlined />}
                  onClick={undoLastMask}
                  disabled={canvasState.masks.length === 0}
                  size="small"
                >
                  撤销
                </Button>
                <Button
                  icon={<DeleteOutlined />}
                  onClick={clearAllMasks}
                  disabled={canvasState.masks.length === 0}
                  size="small"
                >
                  清空
                </Button>
              </Space>

              <Divider />

              {/* 处理模式 */}
              <div>
                <Text strong>处理模式</Text>
                <Select
                  value={selectedMode}
                  onChange={setSelectedMode}
                  style={{ width: '100%', marginTop: 8 }}
                >
                  {PROCESSING_MODES.map(mode => (
                    <Option key={mode.key} value={mode.key}>
                      <Space>
                        <span>{mode.icon}</span>
                        <div>
                          <div>{mode.name}</div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {mode.description}
                          </Text>
                        </div>
                      </Space>
                    </Option>
                  ))}
                </Select>
              </div>

              {/* 提示词输入 */}
              {selectedMode !== 'dewrinkle' && (
                <div>
                  <Text strong>提示词</Text>
                  <TextArea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="描述你想要的效果..."
                    rows={3}
                    style={{ marginTop: 8 }}
                  />
                </div>
              )}

              <Divider />

              {/* 参数调节 */}
              <div>
                <Text strong>处理参数</Text>

                <div style={{ marginTop: 12 }}>
                  <Text>强度: {parameters.strength}</Text>
                  <Slider
                    min={0.1}
                    max={1.0}
                    step={0.1}
                    value={parameters.strength}
                    onChange={(value) => setParameters(prev => ({ ...prev, strength: value }))}
                  />
                </div>

                <div style={{ marginTop: 12 }}>
                  <Text>引导: {parameters.guidance}</Text>
                  <Slider
                    min={1}
                    max={20}
                    step={0.5}
                    value={parameters.guidance}
                    onChange={(value) => setParameters(prev => ({ ...prev, guidance: value }))}
                  />
                </div>

                <div style={{ marginTop: 12 }}>
                  <Text>步数: {parameters.steps}</Text>
                  <Slider
                    min={10}
                    max={50}
                    step={5}
                    value={parameters.steps}
                    onChange={(value) => setParameters(prev => ({ ...prev, steps: value }))}
                  />
                </div>

                <div style={{ marginTop: 12 }}>
                  <Space>
                    <Text>随机种子:</Text>
                    <Switch
                      checked={parameters.seed !== -1}
                      onChange={(checked) => setParameters(prev => ({
                        ...prev,
                        seed: checked ? Math.floor(Math.random() * 1000000) : -1
                      }))}
                    />
                    {parameters.seed !== -1 && (
                      <Text code>{parameters.seed}</Text>
                    )}
                  </Space>
                </div>
              </div>

              <Divider />

              {/* 处理按钮 */}
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={startProcessing}
                loading={processing}
                disabled={!canvasState.backgroundImage || canvasState.masks.length === 0}
                block
                size="large"
              >
                {processing ? '处理中...' : '开始处理'}
              </Button>
            </Space>
          </Card>
        </Col>

        {/* 中间画版区域 */}
        <Col span={12}>
          <Card
            title="画版编辑器"
            extra={
              <Space>
                <ThemeSwitcherCompact size="middle" />
                <Tag color={canvasState.isDrawing ? 'green' : 'default'}>
                  {canvasState.isDrawing ? '绘图模式' : '查看模式'}
                </Tag>
                <Tag color="blue">
                  遮罩: {canvasState.masks.length}
                </Tag>
              </Space>
            }
          >
            {!canvasState.backgroundImage ? (
              <Empty
                description="请先上传背景图片"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Upload
                  accept="image/*"
                  beforeUpload={(file) => {
                    handleImageUpload(file);
                    return false;
                  }}
                  showUploadList={false}
                >
                  <Button type="primary" icon={<UploadOutlined />}>
                    上传背景图片
                  </Button>
                </Upload>
              </Empty>
            ) : (
              <div className="canvas-wrapper" style={{ textAlign: 'center' }}>
                <canvas ref={canvasRef} />

                {canvasState.isDrawing && (
                  <Alert
                    message="绘图模式已启用"
                    description="在图片上绘制圈选区域，系统将自动识别遮罩"
                    type="info"
                    showIcon
                    style={{ marginTop: 12 }}
                  />
                )}
              </div>
            )}

            {/* 处理进度 */}
            {processing && taskProgress && (
              <div style={{ marginTop: 16 }}>
                <Progress
                  percent={taskProgress.progress}
                  status={taskProgress.status === 'processing' ? 'active' : 'normal'}
                  format={(percent) => (
                    <Space>
                      {taskProgress.status === 'processing' && <LoadingOutlined />}
                      <span>{percent}%</span>
                    </Space>
                  )}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {taskProgress.message}
                </Text>
              </div>
            )}
          </Card>
        </Col>

        {/* 右侧结果区域 */}
        <Col span={6}>
          <Card title="处理结果" size="small">
            {results.length === 0 ? (
              <Empty
                description="暂无处理结果"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <Space direction="vertical" style={{ width: '100%' }}>
                {results.map((result) => (
                  <Card
                    key={result.id}
                    size="small"
                    cover={
                      <img
                        src={result.imageUrl}
                        alt="处理结果"
                        style={{
                          width: '100%',
                          height: 150,
                          objectFit: 'cover'
                        }}
                      />
                    }
                    actions={[
                      <EyeOutlined key="view" />,
                      <DownloadOutlined
                        key="download"
                        onClick={() => downloadResult(result)}
                      />,
                      <SaveOutlined key="save" />
                    ]}
                  >
                    <Card.Meta
                      title={
                        <Space>
                          <span>{PROCESSING_MODES.find(m => m.key === result.mode)?.icon}</span>
                          <span>{PROCESSING_MODES.find(m => m.key === result.mode)?.name}</span>
                        </Space>
                      }
                      description={
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {result.parameters.prompt}
                        </Text>
                      }
                    />
                  </Card>
                ))}
              </Space>
            )}
          </Card>

          {/* 使用提示 */}
          <Card title="使用提示" size="small" style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12 }}>
              <p>1. 上传背景图片到画版</p>
              <p>2. 启用绘图模式进行圈选</p>
              <p>3. 选择处理模式和参数</p>
              <p>4. 点击开始处理等待结果</p>
              <p>5. 下载或保存处理结果</p>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
