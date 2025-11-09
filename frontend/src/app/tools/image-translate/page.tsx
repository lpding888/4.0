'use client';

import React, { useState } from 'react';
import {
  Card,
  Steps,
  Button,
  Upload,
  Select,
  Space,
  Progress,
  Row,
  Col,
  Image,
  Typography,
  Tag,
  message,
  Spin,
  Divider,
  Alert,
  Radio,
  Tooltip,
  Descriptions,
  List,
} from 'antd';
import {
  UploadOutlined,
  TranslationOutlined,
  FileImageOutlined,
  DownloadOutlined,
  ReloadOutlined,
  EyeOutlined,
  EditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import ThemeSwitcher from '@/components/ThemeSwitcher';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;

// 语言配置
export interface Language {
  code: string;
  name: string;
  flag: string;
}

// 支持的6种语言
const supportedLanguages: Language[] = [
  { code: 'zh-CN', name: '简体中文', flag: '🇨🇳' },
  { code: 'zh-TW', name: '繁体中文', flag: '🇹🇼' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
];

// OCR识别的文本区域
export interface TextRegion {
  id: string;
  text: string;
  translated: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  confidence: number; // OCR识别置信度
}

// 翻译任务
export interface TranslationTask {
  id: string;
  sourceLanguage: string;
  targetLanguages: string[];
  image: string;
  regions: TextRegion[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: Date;
}

// 导出格式
export type ExportFormat = 'png' | 'jpg' | 'pdf' | 'zip';

export default function ImageTranslatePage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploadedImage, setUploadedImage] = useState<string>('');
  const [detectedLanguage, setDetectedLanguage] = useState<string>('');
  const [sourceLanguage, setSourceLanguage] = useState<string>('');
  const [targetLanguages, setTargetLanguages] = useState<string[]>(['en']);
  const [textRegions, setTextRegions] = useState<TextRegion[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [translationProgress, setTranslationProgress] = useState(0);
  const [currentTask, setCurrentTask] = useState<TranslationTask | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  // Mock OCR识别
  const mockOCRRegions: TextRegion[] = [
    {
      id: 'region_1',
      text: '春季新品上市',
      translated: '',
      x: 50,
      y: 80,
      width: 300,
      height: 60,
      fontSize: 48,
      fontFamily: 'Noto Sans SC',
      color: '#000000',
      confidence: 0.98,
    },
    {
      id: 'region_2',
      text: '全场5折起',
      translated: '',
      x: 50,
      y: 160,
      width: 200,
      height: 40,
      fontSize: 32,
      fontFamily: 'Noto Sans SC',
      color: '#ff4d4f',
      confidence: 0.95,
    },
    {
      id: 'region_3',
      text: '限时优惠 · 仅此一周',
      translated: '',
      x: 50,
      y: 220,
      width: 280,
      height: 30,
      fontSize: 24,
      fontFamily: 'Noto Sans SC',
      color: '#666666',
      confidence: 0.92,
    },
  ];

  // 模拟语言检测
  const detectLanguage = async (imageUrl: string) => {
    setIsProcessing(true);
    setOcrProgress(0);

    // 模拟OCR处理进度
    const interval = setInterval(() => {
      setOcrProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    // 模拟API延迟
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 检测到的语言
    const detected = 'zh-CN';
    setDetectedLanguage(detected);
    setSourceLanguage(detected);
    setTextRegions(mockOCRRegions);
    setIsProcessing(false);
    setOcrProgress(100);

    message.success('语言检测和OCR识别完成！');
  };

  // 图片上传处理
  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      setUploadedImage(imageUrl);
      setFileList([
        {
          uid: '-1',
          name: file.name,
          status: 'done',
          url: imageUrl,
        },
      ]);
      // 自动进行语言检测
      detectLanguage(imageUrl);
    };
    reader.readAsDataURL(file);
    return false; // 阻止默认上传行为
  };

  // 执行翻译
  const performTranslation = async () => {
    if (targetLanguages.length === 0) {
      message.warning('请至少选择一种目标语言！');
      return;
    }

    setIsProcessing(true);
    setTranslationProgress(0);
    setCurrentStep(2);

    // 模拟翻译进度
    const interval = setInterval(() => {
      setTranslationProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 5;
      });
    }, 300);

    // 模拟翻译延迟
    await new Promise((resolve) => setTimeout(resolve, 6000));

    // Mock翻译结果
    const translationMap: Record<string, Record<string, string>> = {
      '春季新品上市': {
        en: 'Spring New Arrivals',
        ja: '春の新作発売',
        ko: '봄 신상품 출시',
        es: 'Nuevos productos de primavera',
        'zh-TW': '春季新品上市',
      },
      '全场5折起': {
        en: '50% OFF Sitewide',
        ja: '全品50%オフ',
        ko: '전품 50% 할인',
        es: '50% de descuento en todo',
        'zh-TW': '全場5折起',
      },
      '限时优惠 · 仅此一周': {
        en: 'Limited Time · One Week Only',
        ja: '期間限定 · 1週間のみ',
        ko: '한정 특가 · 일주일만',
        es: 'Oferta limitada · Solo una semana',
        'zh-TW': '限時優惠 · 僅此一週',
      },
    };

    // 更新翻译结果（使用第一个目标语言）
    const primaryTarget = targetLanguages[0];
    const translated = textRegions.map((region) => ({
      ...region,
      translated:
        (primaryTarget && translationMap[region.text]?.[primaryTarget]) ||
        region.text,
    }));

    setTextRegions(translated);
    setIsProcessing(false);
    setTranslationProgress(100);

    // 创建翻译任务
    const task: TranslationTask = {
      id: `task_${Date.now()}`,
      sourceLanguage,
      targetLanguages,
      image: uploadedImage,
      regions: translated,
      status: 'completed',
      progress: 100,
      createdAt: new Date(),
    };

    setCurrentTask(task);
    message.success('翻译完成！');
  };

  // 导出翻译结果
  const exportTranslation = async () => {
    if (!currentTask) return;

    message.loading('正在导出...', 0);

    // 模拟导出延迟
    await new Promise((resolve) => setTimeout(resolve, 1500));

    message.destroy();
    message.success(`已导出为 ${exportFormat.toUpperCase()} 格式！`);

    // 实际项目中这里会调用后端API生成文件并下载
    console.log('导出配置：', {
      format: exportFormat,
      targetLanguages,
      regions: textRegions,
    });
  };

  // 重新开始
  const handleReset = () => {
    setCurrentStep(0);
    setFileList([]);
    setUploadedImage('');
    setDetectedLanguage('');
    setSourceLanguage('');
    setTargetLanguages(['en']);
    setTextRegions([]);
    setIsProcessing(false);
    setOcrProgress(0);
    setTranslationProgress(0);
    setCurrentTask(null);
    setSelectedRegion(null);
  };

  // 编辑文本区域
  const handleEditRegion = (regionId: string) => {
    message.info('编辑功能开发中...');
    setSelectedRegion(regionId);
  };

  // 步骤配置
  const steps = [
    {
      title: '上传图片',
      icon: <FileImageOutlined />,
    },
    {
      title: '语言配置',
      icon: <TranslationOutlined />,
    },
    {
      title: '预览和导出',
      icon: <DownloadOutlined />,
    },
  ];

  return (
    <div style={{ padding: 'var(--spacing-lg)' }}>
      {/* 页面头部 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--spacing-xl)',
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0 }}>
            <TranslationOutlined style={{ marginRight: 'var(--spacing-sm)' }} />
            图片翻译
          </Title>
          <Text type="secondary">
            上传图片 → 自动识别文字 → 翻译成多种语言 → 导出翻译结果
          </Text>
        </div>
        <ThemeSwitcher mode="dropdown" />
      </div>

      {/* 步骤指示器 */}
      <Card style={{ marginBottom: 'var(--spacing-lg)' }}>
        <Steps current={currentStep} items={steps} />
      </Card>

      {/* Step 1: 上传图片 */}
      {currentStep === 0 && (
        <Card
          title={
            <Space>
              <UploadOutlined />
              上传图片
            </Space>
          }
          extra={
            fileList.length > 0 && (
              <Button type="link" onClick={handleReset} icon={<ReloadOutlined />}>
                重新上传
              </Button>
            )
          }
        >
          <Row gutter={[24, 24]}>
            <Col span={12}>
              <Upload.Dragger
                name="image"
                listType="picture-card"
                fileList={fileList}
                beforeUpload={handleUpload}
                onRemove={() => {
                  setFileList([]);
                  setUploadedImage('');
                }}
                accept="image/*"
                maxCount={1}
              >
                {fileList.length === 0 && (
                  <div>
                    <p className="ant-upload-drag-icon">
                      <FileImageOutlined />
                    </p>
                    <p className="ant-upload-text">点击或拖拽图片到此区域上传</p>
                    <p className="ant-upload-hint">
                      支持 JPG、PNG、GIF 格式，文件大小不超过 10MB
                    </p>
                  </div>
                )}
              </Upload.Dragger>

              {isProcessing && ocrProgress < 100 && (
                <div style={{ marginTop: 'var(--spacing-lg)' }}>
                  <Spin tip="正在进行OCR识别...">
                    <Progress percent={ocrProgress} status="active" />
                  </Spin>
                </div>
              )}

              {!isProcessing && detectedLanguage && (
                <Alert
                  message="检测完成"
                  description={
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Text>
                        检测到的语言：
                        <Tag color="blue" style={{ marginLeft: 'var(--spacing-sm)' }}>
                          {
                            supportedLanguages.find(
                              (lang) => lang.code === detectedLanguage
                            )?.flag
                          }{' '}
                          {
                            supportedLanguages.find(
                              (lang) => lang.code === detectedLanguage
                            )?.name
                          }
                        </Tag>
                      </Text>
                      <Text>识别到 {textRegions.length} 个文本区域</Text>
                    </Space>
                  }
                  type="success"
                  showIcon
                  icon={<CheckCircleOutlined />}
                  style={{ marginTop: 'var(--spacing-lg)' }}
                />
              )}
            </Col>

            <Col span={12}>
              <Card
                title="功能说明"
                size="small"
                style={{ backgroundColor: 'var(--color-bg-layout)' }}
              >
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <div>
                    <Text strong>✨ 智能OCR识别</Text>
                    <Paragraph type="secondary" style={{ margin: 0 }}>
                      自动识别图片中的文字内容，保留原始布局和样式
                    </Paragraph>
                  </div>

                  <div>
                    <Text strong>🌍 多语言翻译</Text>
                    <Paragraph type="secondary" style={{ margin: 0 }}>
                      支持6种语言互译：中文简繁体、英语、日语、韩语、西班牙语
                    </Paragraph>
                  </div>

                  <div>
                    <Text strong>🎨 布局保留</Text>
                    <Paragraph type="secondary" style={{ margin: 0 }}>
                      智能保留原图布局、字体大小、颜色等视觉元素
                    </Paragraph>
                  </div>

                  <div>
                    <Text strong>📦 多格式导出</Text>
                    <Paragraph type="secondary" style={{ margin: 0 }}>
                      支持PNG、JPG、PDF、ZIP多格式导出
                    </Paragraph>
                  </div>
                </Space>
              </Card>

              {textRegions.length > 0 && (
                <Card
                  title="识别结果"
                  size="small"
                  style={{
                    marginTop: 'var(--spacing-md)',
                    backgroundColor: 'var(--color-bg-layout)',
                  }}
                >
                  <List
                    dataSource={textRegions}
                    renderItem={(region) => (
                      <List.Item>
                        <List.Item.Meta
                          title={
                            <Space>
                              <Text>{region.text}</Text>
                              <Tag color="green">
                                置信度: {(region.confidence * 100).toFixed(0)}%
                              </Tag>
                            </Space>
                          }
                          description={
                            <Text type="secondary">
                              位置: ({region.x}, {region.y}) · 大小: {region.width}x
                              {region.height}
                            </Text>
                          }
                        />
                      </List.Item>
                    )}
                  />
                </Card>
              )}
            </Col>
          </Row>

          <Divider />

          <div style={{ textAlign: 'center' }}>
            <Button
              type="primary"
              size="large"
              onClick={() => setCurrentStep(1)}
              disabled={!uploadedImage || !detectedLanguage}
            >
              下一步：配置语言
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: 语言配置 */}
      {currentStep === 1 && (
        <Card
          title={
            <Space>
              <TranslationOutlined />
              语言配置
            </Space>
          }
        >
          <Row gutter={[24, 24]}>
            <Col span={12}>
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <div>
                  <Text strong style={{ fontSize: '16px' }}>
                    源语言
                  </Text>
                  <Select
                    value={sourceLanguage}
                    onChange={setSourceLanguage}
                    style={{ width: '100%', marginTop: 'var(--spacing-sm)' }}
                    size="large"
                    disabled
                  >
                    {supportedLanguages.map((lang) => (
                      <Select.Option key={lang.code} value={lang.code}>
                        {lang.flag} {lang.name}
                      </Select.Option>
                    ))}
                  </Select>
                  <Text type="secondary" style={{ display: 'block', marginTop: 'var(--spacing-xs)' }}>
                    已自动检测图片中的语言
                  </Text>
                </div>

                <div>
                  <Text strong style={{ fontSize: '16px' }}>
                    目标语言
                  </Text>
                  <Select
                    mode="multiple"
                    value={targetLanguages}
                    onChange={setTargetLanguages}
                    style={{ width: '100%', marginTop: 'var(--spacing-sm)' }}
                    size="large"
                    placeholder="选择一种或多种目标语言"
                    maxTagCount="responsive"
                  >
                    {supportedLanguages
                      .filter((lang) => lang.code !== sourceLanguage)
                      .map((lang) => (
                        <Select.Option key={lang.code} value={lang.code}>
                          {lang.flag} {lang.name}
                        </Select.Option>
                      ))}
                  </Select>
                  <Text type="secondary" style={{ display: 'block', marginTop: 'var(--spacing-xs)' }}>
                    可选择多种语言，系统将生成多个翻译版本
                  </Text>
                </div>

                {isProcessing && (
                  <div>
                    <Spin tip="正在翻译...">
                      <Progress percent={translationProgress} status="active" />
                    </Spin>
                  </div>
                )}
              </Space>
            </Col>

            <Col span={12}>
              <Card
                title="图片预览"
                size="small"
                style={{ backgroundColor: 'var(--color-bg-layout)' }}
              >
                <Image
                  src={uploadedImage}
                  alt="上传的图片"
                  style={{ width: '100%', borderRadius: 'var(--border-radius-md)' }}
                />

                <Divider />

                <Descriptions column={1} size="small">
                  <Descriptions.Item label="识别文本数">
                    {textRegions.length} 个
                  </Descriptions.Item>
                  <Descriptions.Item label="平均置信度">
                    {(
                      (textRegions.reduce((sum, r) => sum + r.confidence, 0) /
                        textRegions.length) *
                      100
                    ).toFixed(0)}
                    %
                  </Descriptions.Item>
                  <Descriptions.Item label="目标语言数">
                    {targetLanguages.length} 种
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
          </Row>

          <Divider />

          <div style={{ textAlign: 'center' }}>
            <Space size="large">
              <Button size="large" onClick={() => setCurrentStep(0)}>
                上一步
              </Button>
              <Button
                type="primary"
                size="large"
                onClick={performTranslation}
                disabled={targetLanguages.length === 0 || isProcessing}
                loading={isProcessing}
              >
                开始翻译
              </Button>
            </Space>
          </div>
        </Card>
      )}

      {/* Step 3: 预览和导出 */}
      {currentStep === 2 && currentTask && (
        <Card
          title={
            <Space>
              <EyeOutlined />
              预览和导出
            </Space>
          }
          extra={
            <Button type="link" onClick={handleReset} icon={<ReloadOutlined />}>
              重新开始
            </Button>
          }
        >
          <Row gutter={[24, 24]}>
            <Col span={12}>
              <Card
                title="原图"
                size="small"
                style={{ backgroundColor: 'var(--color-bg-layout)' }}
              >
                <Image
                  src={uploadedImage}
                  alt="原图"
                  style={{ width: '100%', borderRadius: 'var(--border-radius-md)' }}
                />
              </Card>
            </Col>

            <Col span={12}>
              <Card
                title={
                  <Space>
                    <Text>翻译结果</Text>
                    <Tag color="blue">
                      {
                        supportedLanguages.find(
                          (lang) => lang.code === targetLanguages[0]
                        )?.flag
                      }{' '}
                      {
                        supportedLanguages.find(
                          (lang) => lang.code === targetLanguages[0]
                        )?.name
                      }
                    </Tag>
                  </Space>
                }
                size="small"
                style={{ backgroundColor: 'var(--color-bg-layout)' }}
              >
                <div style={{ position: 'relative' }}>
                  <Image
                    src={uploadedImage}
                    alt="翻译结果"
                    preview={false}
                    style={{ width: '100%', borderRadius: 'var(--border-radius-md)' }}
                  />
                  {/* 这里实际项目中会渲染翻译后的文本覆盖层 */}
                </div>

                <Alert
                  message="布局保留"
                  description="翻译结果已保留原图布局、字体大小和颜色"
                  type="info"
                  showIcon
                  style={{ marginTop: 'var(--spacing-md)' }}
                />
              </Card>
            </Col>
          </Row>

          <Divider />

          <Card
            title="文本对照表"
            size="small"
            style={{ marginBottom: 'var(--spacing-lg)' }}
          >
            <List
              dataSource={textRegions}
              renderItem={(region) => (
                <List.Item
                  actions={[
                    <Tooltip title="编辑翻译" key="edit">
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleEditRegion(region.id)}
                      />
                    </Tooltip>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Tag color="default">原文</Tag>
                        <Text>{region.text}</Text>
                      </Space>
                    }
                    description={
                      <Space>
                        <Tag color="blue">译文</Tag>
                        <Text strong>{region.translated}</Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>

          <Card title="导出设置" size="small">
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Text strong style={{ fontSize: '16px' }}>
                  导出格式
                </Text>
                <Radio.Group
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  style={{ width: '100%', marginTop: 'var(--spacing-sm)' }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Radio value="png">
                      PNG - 高质量图片格式（推荐）
                    </Radio>
                    <Radio value="jpg">
                      JPG - 压缩图片格式
                    </Radio>
                    <Radio value="pdf">
                      PDF - 可打印文档格式
                    </Radio>
                    <Radio value="zip">
                      ZIP - 打包所有语言版本
                    </Radio>
                  </Space>
                </Radio.Group>
              </div>

              {exportFormat === 'zip' && targetLanguages.length > 1 && (
                <Alert
                  message={`将导出 ${targetLanguages.length} 个语言版本`}
                  description="ZIP文件将包含所有选中语言的翻译结果"
                  type="info"
                  showIcon
                />
              )}
            </Space>
          </Card>

          <Divider />

          <div style={{ textAlign: 'center' }}>
            <Space size="large">
              <Button size="large" onClick={() => setCurrentStep(1)}>
                上一步
              </Button>
              <Button
                type="primary"
                size="large"
                icon={<DownloadOutlined />}
                onClick={exportTranslation}
              >
                导出翻译结果
              </Button>
            </Space>
          </div>
        </Card>
      )}
    </div>
  );
}
