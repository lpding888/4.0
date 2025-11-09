/**
 * PAGE-P2-SV-202 AI带货短视频页面
 * 艹!这个短视频功能必须让用户快速生成专业的带货视频!
 *
 * 功能清单:
 * 1. 脚本生成(AI生成或模板变量)
 * 2. 分镜管理(画面/字幕/时长)
 * 3. 片头片尾模板
 * 4. 视频导出(mp4格式)
 *
 * @author 老王
 */

'use client';

import React, { useState, useCallback } from 'react';
import Image from 'next/image';
import {
  Card,
  Button,
  Steps,
  Space,
  Typography,
  Row,
  Col,
  Input,
  Select,
  Form,
  message,
  Spin,
  Empty,
  Modal,
  Tag,
  Divider,
  Tooltip,
  Progress,
  Badge,
  Timeline,
  Slider,
  InputNumber,
  Radio,
  Upload,
  List,
  Alert
} from 'antd';
import {
  VideoCameraOutlined,
  FileTextOutlined,
  ScissorOutlined,
  DownloadOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  SaveOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  PictureOutlined,
  SoundOutlined,
  CopyOutlined
} from '@ant-design/icons';
import ThemeSwitcher from '@/components/ThemeSwitcher';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;
const { TextArea } = Input;
const { Option } = Select;
const EMPTY_STORYBOARD_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

// 分镜接口
export interface Storyboard {
  id: string;
  title: string;
  duration: number; // 秒
  image?: string;
  subtitle: string;
  transition?: string;
  music?: string;
}

// 视频脚本接口
export interface VideoScript {
  id: string;
  title: string;
  description: string;
  duration: number;
  storyboards: Storyboard[];
  openingTemplate?: string;
  endingTemplate?: string;
}

// 分镜模板
const storyboardTemplates = [
  {
    id: 'template_product',
    name: '产品展示模板',
    description: '适合展示单个产品的详细信息',
    storyboards: [
      { id: 'sb_1', title: '产品全景', duration: 3, subtitle: '展示产品整体外观', transition: 'fade' },
      { id: 'sb_2', title: '细节特写', duration: 3, subtitle: '突出产品细节和质感', transition: 'slide' },
      { id: 'sb_3', title: '使用场景', duration: 4, subtitle: '展示产品实际使用效果', transition: 'zoom' }
    ]
  },
  {
    id: 'template_comparison',
    name: '对比测评模板',
    description: '适合对比多个产品的优劣',
    storyboards: [
      { id: 'sb_1', title: '问题引入', duration: 2, subtitle: '提出用户痛点', transition: 'fade' },
      { id: 'sb_2', title: '产品A介绍', duration: 3, subtitle: '介绍第一款产品', transition: 'slide' },
      { id: 'sb_3', title: '产品B介绍', duration: 3, subtitle: '介绍第二款产品', transition: 'slide' },
      { id: 'sb_4', title: '优劣对比', duration: 3, subtitle: '总结对比结果', transition: 'fade' },
      { id: 'sb_5', title: '购买建议', duration: 2, subtitle: '给出购买建议', transition: 'zoom' }
    ]
  },
  {
    id: 'template_story',
    name: '故事叙述模板',
    description: '适合讲述品牌故事或用户故事',
    storyboards: [
      { id: 'sb_1', title: '开场引入', duration: 2, subtitle: '吸引观众注意', transition: 'fade' },
      { id: 'sb_2', title: '故事起因', duration: 4, subtitle: '讲述故事背景', transition: 'slide' },
      { id: 'sb_3', title: '故事发展', duration: 4, subtitle: '展开故事情节', transition: 'slide' },
      { id: 'sb_4', title: '故事高潮', duration: 3, subtitle: '展示关键转折', transition: 'zoom' },
      { id: 'sb_5', title: '故事结尾', duration: 2, subtitle: '总结和号召行动', transition: 'fade' }
    ]
  }
];

// 片头片尾模板
const openingTemplates = [
  { id: 'opening_minimal', name: '简约开场', duration: 2, description: '简洁的品牌Logo展示' },
  { id: 'opening_dynamic', name: '动感开场', duration: 3, description: '动态效果的品牌展示' },
  { id: 'opening_elegant', name: '优雅开场', duration: 2.5, description: '优雅的淡入效果' }
];

const endingTemplates = [
  { id: 'ending_cta', name: 'CTA结尾', duration: 3, description: '强调购买链接和优惠' },
  { id: 'ending_subscribe', name: '关注结尾', duration: 2, description: '引导关注和点赞' },
  { id: 'ending_brand', name: '品牌结尾', duration: 2.5, description: '品牌Logo和Slogan' }
];

export default function ShortVideoPage() {
  // 步骤管理
  const [currentStep, setCurrentStep] = useState(0);

  // 脚本生成状态
  const [scriptTitle, setScriptTitle] = useState('');
  const [scriptDescription, setScriptDescription] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [generatingScript, setGeneratingScript] = useState(false);

  // 分镜管理状态
  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);
  const [selectedOpening, setSelectedOpening] = useState<string>('opening_minimal');
  const [selectedEnding, setSelectedEnding] = useState<string>('ending_cta');
  const [editingStoryboard, setEditingStoryboard] = useState<Storyboard | null>(null);
  const [storyboardModalVisible, setStoryboardModalVisible] = useState(false);

  // 视频生成状态
  const [generating, setGenerating] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string>('');

  // UI状态
  const [form] = Form.useForm();
  const [storyboardForm] = Form.useForm();

  // 计算总时长
  const getTotalDuration = () => {
    const openingDuration = openingTemplates.find(t => t.id === selectedOpening)?.duration || 0;
    const endingDuration = endingTemplates.find(t => t.id === selectedEnding)?.duration || 0;
    const storyboardsDuration = storyboards.reduce((sum, sb) => sum + sb.duration, 0);
    return openingDuration + storyboardsDuration + endingDuration;
  };

  // 生成脚本
  const handleGenerateScript = async (values: any) => {
    setGeneratingScript(true);

    try {
      // 模拟AI生成脚本
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 根据选择的模板加载分镜
      const template = storyboardTemplates.find(t => t.id === selectedTemplate);
      if (template) {
        setStoryboards(template.storyboards.map((sb, idx) => ({
          ...sb,
          id: `sb_${Date.now()}_${idx}`,
          image: `https://via.placeholder.com/400x300/1890ff/ffffff?text=Scene+${idx + 1}`
        })));
      }

      message.success('脚本生成成功!');
      setCurrentStep(1);
    } catch (error) {
      message.error('脚本生成失败,请重试');
    } finally {
      setGeneratingScript(false);
    }
  };

  // 添加分镜
  const handleAddStoryboard = () => {
    setEditingStoryboard(null);
    storyboardForm.resetFields();
    setStoryboardModalVisible(true);
  };

  // 编辑分镜
  const handleEditStoryboard = (storyboard: Storyboard) => {
    setEditingStoryboard(storyboard);
    storyboardForm.setFieldsValue(storyboard);
    setStoryboardModalVisible(true);
  };

  // 保存分镜
  const handleSaveStoryboard = (values: any) => {
    if (editingStoryboard) {
      // 更新现有分镜
      setStoryboards(storyboards.map(sb =>
        sb.id === editingStoryboard.id ? { ...sb, ...values } : sb
      ));
      message.success('分镜更新成功');
    } else {
      // 添加新分镜
      const newStoryboard: Storyboard = {
        id: `sb_${Date.now()}`,
        ...values,
        image: `https://via.placeholder.com/400x300/52c41a/ffffff?text=New+Scene`
      };
      setStoryboards([...storyboards, newStoryboard]);
      message.success('分镜添加成功');
    }

    setStoryboardModalVisible(false);
  };

  // 删除分镜
  const handleDeleteStoryboard = (id: string) => {
    setStoryboards(storyboards.filter(sb => sb.id !== id));
    message.success('分镜删除成功');
  };

  // 复制分镜
  const handleDuplicateStoryboard = (storyboard: Storyboard) => {
    const newStoryboard: Storyboard = {
      ...storyboard,
      id: `sb_${Date.now()}`,
      title: `${storyboard.title} (副本)`
    };
    setStoryboards([...storyboards, newStoryboard]);
    message.success('分镜复制成功');
  };

  // 生成视频
  const handleGenerateVideo = async () => {
    if (storyboards.length === 0) {
      message.warning('请至少添加一个分镜');
      return;
    }

    setGenerating(true);
    setGeneratingProgress(0);

    try {
      // 模拟视频生成进度
      for (let i = 0; i <= 100; i += 5) {
        await new Promise(resolve => setTimeout(resolve, 300));
        setGeneratingProgress(i);
      }

      setVideoUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
      message.success('视频生成成功!');
      setCurrentStep(2);
    } catch (error) {
      message.error('视频生成失败,请重试');
    } finally {
      setGenerating(false);
    }
  };

  // 导出视频
  const handleExportVideo = () => {
    if (!videoUrl) {
      message.warning('暂无可导出的视频');
      return;
    }

    message.loading({ content: '正在导出视频...', key: 'export' });

    setTimeout(() => {
      message.success({ content: '视频导出成功!', key: 'export' });
      // 实际导出逻辑
      const link = document.createElement('a');
      link.href = videoUrl;
      link.download = `short-video-${Date.now()}.mp4`;
      link.click();
    }, 1000);
  };

  // 步骤1: 脚本生成
  const renderScriptGeneration = () => (
    <Card title="AI脚本生成" style={{ marginBottom: 24 }}>
      <Alert
        message="智能脚本生成"
        description="选择模板或输入产品信息,AI将自动生成专业的视频脚本和分镜方案"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleGenerateScript}
        initialValues={{
          template: 'template_product',
          duration: 15
        }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="title"
              label="视频标题"
              rules={[{ required: true, message: '请输入视频标题' }]}
            >
              <Input
                placeholder="请输入视频标题..."
                value={scriptTitle}
                onChange={(e) => setScriptTitle(e.target.value)}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="duration"
              label="目标时长(秒)"
              rules={[{ required: true, message: '请设置目标时长' }]}
            >
              <InputNumber
                min={10}
                max={60}
                style={{ width: '100%' }}
                placeholder="10-60秒"
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="description"
          label="产品描述"
          rules={[{ required: true, message: '请输入产品描述' }]}
        >
          <TextArea
            rows={4}
            placeholder="请描述产品的特点、卖点、使用场景等..."
            value={scriptDescription}
            onChange={(e) => setScriptDescription(e.target.value)}
          />
        </Form.Item>

        <Form.Item
          name="template"
          label="选择脚本模板"
          rules={[{ required: true, message: '请选择脚本模板' }]}
        >
          <Radio.Group
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            style={{ width: '100%' }}
          >
            <Row gutter={[16, 16]}>
              {storyboardTemplates.map(template => (
                <Col key={template.id} span={8}>
                  <Radio.Button
                    value={template.id}
                    style={{ width: '100%', height: 'auto', padding: 16, textAlign: 'left' }}
                  >
                    <div>
                      <Text strong>{template.name}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {template.description}
                      </Text>
                      <br />
                      <Tag color="blue" style={{ marginTop: 8 }}>
                        {template.storyboards.length}个分镜
                      </Tag>
                    </div>
                  </Radio.Button>
                </Col>
              ))}
            </Row>
          </Radio.Group>
        </Form.Item>

        <Form.Item style={{ textAlign: 'center', marginBottom: 0 }}>
          <Button
            type="primary"
            size="large"
            htmlType="submit"
            loading={generatingScript}
            icon={<ThunderboltOutlined />}
          >
            {generatingScript ? 'AI生成中...' : '智能生成脚本'}
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );

  // 步骤2: 分镜管理
  const renderStoryboardManagement = () => (
    <div>
      <Card
        title="分镜管理"
        extra={
          <Space>
            <Text type="secondary">
              总时长: {getTotalDuration()}秒
            </Text>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddStoryboard}
            >
              添加分镜
            </Button>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        {/* 片头模板选择 */}
        <div style={{ marginBottom: 24 }}>
          <Title level={5}>
            <PictureOutlined style={{ marginRight: 8 }} />
            片头模板
          </Title>
          <Radio.Group
            value={selectedOpening}
            onChange={(e) => setSelectedOpening(e.target.value)}
          >
            <Space wrap>
              {openingTemplates.map(template => (
                <Radio.Button key={template.id} value={template.id}>
                  <Space direction="vertical" size="small">
                    <Text strong>{template.name}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {template.duration}秒 · {template.description}
                    </Text>
                  </Space>
                </Radio.Button>
              ))}
            </Space>
          </Radio.Group>
        </div>

        <Divider />

        {/* 分镜列表 */}
        <div style={{ marginBottom: 24 }}>
          <Title level={5}>
            <ScissorOutlined style={{ marginRight: 8 }} />
            分镜列表 ({storyboards.length})
          </Title>

          {storyboards.length === 0 ? (
            <Empty description="暂无分镜,请添加分镜">
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddStoryboard}>
                添加第一个分镜
              </Button>
            </Empty>
          ) : (
            <Timeline>
              {storyboards.map((storyboard, index) => (
                <Timeline.Item
                  key={storyboard.id}
                  color="blue"
                  dot={<ClockCircleOutlined />}
                >
                  <Card
                    size="small"
                    title={
                      <Space>
                        <Badge count={index + 1} style={{ backgroundColor: '#1890ff' }} />
                        <Text strong>{storyboard.title}</Text>
                        <Tag color="blue">{storyboard.duration}秒</Tag>
                      </Space>
                    }
                    extra={
                      <Space>
                        <Tooltip title="预览">
                          <Button
                            type="text"
                            size="small"
                            icon={<EyeOutlined />}
                          />
                        </Tooltip>
                        <Tooltip title="编辑">
                          <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => handleEditStoryboard(storyboard)}
                          />
                        </Tooltip>
                        <Tooltip title="复制">
                          <Button
                            type="text"
                            size="small"
                            icon={<CopyOutlined />}
                            onClick={() => handleDuplicateStoryboard(storyboard)}
                          />
                        </Tooltip>
                        <Tooltip title="删除">
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleDeleteStoryboard(storyboard.id)}
                          />
                        </Tooltip>
                      </Space>
                    }
                  >
                    <Row gutter={16}>
                      <Col span={8}>
                        <Image
                          src={storyboard.image ?? EMPTY_STORYBOARD_IMAGE}
                          alt={storyboard.title}
                          width={160}
                          height={120}
                          style={{ width: '100%', height: 'auto', borderRadius: 4 }}
                          unoptimized
                        />
                      </Col>
                      <Col span={16}>
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <Text strong>字幕:</Text>
                          <Text>{storyboard.subtitle}</Text>
                          {storyboard.transition && (
                            <Text type="secondary">
                              转场: {storyboard.transition}
                            </Text>
                          )}
                        </Space>
                      </Col>
                    </Row>
                  </Card>
                </Timeline.Item>
              ))}
            </Timeline>
          )}
        </div>

        <Divider />

        {/* 片尾模板选择 */}
        <div>
          <Title level={5}>
            <PictureOutlined style={{ marginRight: 8 }} />
            片尾模板
          </Title>
          <Radio.Group
            value={selectedEnding}
            onChange={(e) => setSelectedEnding(e.target.value)}
          >
            <Space wrap>
              {endingTemplates.map(template => (
                <Radio.Button key={template.id} value={template.id}>
                  <Space direction="vertical" size="small">
                    <Text strong>{template.name}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {template.duration}秒 · {template.description}
                    </Text>
                  </Space>
                </Radio.Button>
              ))}
            </Space>
          </Radio.Group>
        </div>
      </Card>

      <div style={{ textAlign: 'center' }}>
        <Space>
          <Button onClick={() => setCurrentStep(0)}>
            返回脚本
          </Button>
          <Button
            type="primary"
            size="large"
            onClick={handleGenerateVideo}
            loading={generating}
            disabled={storyboards.length === 0}
            icon={<VideoCameraOutlined />}
          >
            {generating ? '生成中...' : '生成视频'}
          </Button>
        </Space>
      </div>

      {/* 生成进度 */}
      {generating && (
        <Card style={{ marginTop: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <Progress
              type="circle"
              percent={generatingProgress}
              status="active"
            />
            <div style={{ marginTop: 16 }}>
              <Text strong>正在合成视频...</Text>
              <br />
              <Text type="secondary">
                预计时长: {getTotalDuration()}秒
              </Text>
            </div>
          </div>
        </Card>
      )}
    </div>
  );

  // 步骤3: 预览和导出
  const renderPreviewExport = () => (
    <div>
      <Card title="视频预览" style={{ marginBottom: 24 }}>
        <div style={{
          background: '#000',
          padding: 20,
          borderRadius: 8,
          textAlign: 'center',
          minHeight: 400
        }}>
          {videoUrl ? (
            <video
              src={videoUrl}
              controls
              style={{
                width: '100%',
                maxWidth: 640,
                borderRadius: 8
              }}
            >
              <track
                kind="captions"
                src="data:text/vtt,WEBVTT"
                srcLang="zh"
                label="自动字幕"
                default
              />
            </video>
          ) : (
            <Empty description="视频生成中..." />
          )}
        </div>
      </Card>

      <Card title="导出选项">
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Card size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>视频信息</Text>
                <Text type="secondary">格式: MP4</Text>
                <Text type="secondary">分辨率: 1080x1920</Text>
                <Text type="secondary">时长: {getTotalDuration()}秒</Text>
                <Text type="secondary">帧率: 30fps</Text>
              </Space>
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>导出选项</Text>
                <Button
                  type="primary"
                  block
                  icon={<DownloadOutlined />}
                  onClick={handleExportVideo}
                  disabled={!videoUrl}
                >
                  下载视频(MP4)
                </Button>
                <Button block icon={<SaveOutlined />}>
                  保存为模板
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>

        <Divider />

        <div style={{ textAlign: 'center' }}>
          <Space>
            <Button onClick={() => setCurrentStep(1)}>
              返回编辑
            </Button>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={() => {
                setCurrentStep(0);
                setStoryboards([]);
                setVideoUrl('');
                form.resetFields();
                message.info('已重置,可以创建新的视频');
              }}
            >
              创建新视频
            </Button>
          </Space>
        </div>
      </Card>
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2}>
            <VideoCameraOutlined style={{ marginRight: 8 }} />
            AI带货短视频
          </Title>
          <Paragraph type="secondary">
            三步创建专业的带货短视频: 生成脚本 → 管理分镜 → 导出视频
          </Paragraph>
        </div>
        <ThemeSwitcher mode="dropdown" size="middle" />
      </div>

      {/* 步骤条 */}
      <Steps current={currentStep} style={{ marginBottom: 32 }}>
        <Step title="脚本生成" description="AI智能生成" icon={<FileTextOutlined />} />
        <Step title="分镜管理" description="编辑和调整" icon={<ScissorOutlined />} />
        <Step title="预览导出" description="生成和下载" icon={<VideoCameraOutlined />} />
      </Steps>

      {/* 步骤内容 */}
      {currentStep === 0 && renderScriptGeneration()}
      {currentStep === 1 && renderStoryboardManagement()}
      {currentStep === 2 && renderPreviewExport()}

      {/* 分镜编辑模态框 */}
      <Modal
        title={editingStoryboard ? '编辑分镜' : '添加分镜'}
        open={storyboardModalVisible}
        onCancel={() => setStoryboardModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={storyboardForm}
          layout="vertical"
          onFinish={handleSaveStoryboard}
          initialValues={{
            duration: 3,
            transition: 'fade'
          }}
        >
          <Form.Item
            name="title"
            label="分镜标题"
            rules={[{ required: true, message: '请输入分镜标题' }]}
          >
            <Input placeholder="请输入分镜标题" />
          </Form.Item>

          <Form.Item
            name="subtitle"
            label="字幕内容"
            rules={[{ required: true, message: '请输入字幕内容' }]}
          >
            <TextArea rows={3} placeholder="请输入字幕内容" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="duration"
                label="时长(秒)"
                rules={[{ required: true, message: '请设置时长' }]}
              >
                <Slider min={1} max={10} marks={{ 1: '1s', 5: '5s', 10: '10s' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="transition"
                label="转场效果"
              >
                <Select placeholder="选择转场效果">
                  <Option value="fade">淡入淡出</Option>
                  <Option value="slide">滑动</Option>
                  <Option value="zoom">缩放</Option>
                  <Option value="none">无</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setStoryboardModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
