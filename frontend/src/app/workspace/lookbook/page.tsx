/**
 * PAGE-P2-LOOK-201 Lookbook生成页面
 * 艹!Lookbook必须让用户快速生成精美的产品画册!
 *
 * 功能清单:
 * 1. SKU选择(多选,支持搜索过滤)
 * 2. 模板选择(联动模板中心)
 * 3. 自动排版(1:1/3:4/9:16三种版式)
 * 4. 导出(PNG/JPG单张,ZIP批量打包)
 * 5. 保存为模板(一键保存配置)
 *
 * @author 老王
 */

'use client';

import React, { useState, useCallback } from 'react';
import {
  Card,
  Button,
  Steps,
  Space,
  Typography,
  Row,
  Col,
  Select,
  Input,
  Checkbox,
  Radio,
  message,
  Spin,
  Empty,
  Modal,
  Form,
  Tag,
  Divider,
  Tooltip,
  Progress,
  Badge
} from 'antd';
import {
  AppstoreOutlined,
  FileImageOutlined,
  LayoutOutlined,
  DownloadOutlined,
  SaveOutlined,
  EyeOutlined,
  DeleteOutlined,
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  CloudDownloadOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import ThemeSwitcher from '@/components/ThemeSwitcher';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;
const { TextArea } = Input;
const { Option } = Select;

// 版式比例类型
export type AspectRatio = '1:1' | '3:4' | '9:16';

// SKU接口
export interface SKU {
  id: string;
  name: string;
  image: string;
  price: number;
  category: string;
  tags: string[];
}

// Lookbook模板接口
export interface LookbookTemplate {
  id: string;
  name: string;
  description: string;
  aspectRatio: AspectRatio;
  thumbnail: string;
  maxItems: number;
}

// Lookbook配置接口
export interface LookbookConfig {
  selectedSKUs: SKU[];
  template: LookbookTemplate | null;
  aspectRatio: AspectRatio;
  title?: string;
  subtitle?: string;
}

// 模拟SKU数据
const mockSKUs: SKU[] = [
  {
    id: 'sku_001',
    name: '经典白色T恤',
    image: 'https://via.placeholder.com/300x400/ffffff/333333?text=White+Tee',
    price: 99,
    category: '上衣',
    tags: ['基础款', '百搭']
  },
  {
    id: 'sku_002',
    name: '修身牛仔裤',
    image: 'https://via.placeholder.com/300x400/4169e1/ffffff?text=Jeans',
    price: 299,
    category: '裤装',
    tags: ['修身', '经典']
  },
  {
    id: 'sku_003',
    name: '针织开衫',
    image: 'https://via.placeholder.com/300x400/f5f5dc/333333?text=Cardigan',
    price: 399,
    category: '外套',
    tags: ['温暖', '舒适']
  },
  {
    id: 'sku_004',
    name: '运动鞋',
    image: 'https://via.placeholder.com/300x400/000000/ffffff?text=Sneakers',
    price: 599,
    category: '鞋类',
    tags: ['运动', '时尚']
  },
  {
    id: 'sku_005',
    name: '棉质连衣裙',
    image: 'https://via.placeholder.com/300x400/ffb6c1/ffffff?text=Dress',
    price: 499,
    category: '裙装',
    tags: ['优雅', '舒适']
  },
  {
    id: 'sku_006',
    name: '休闲外套',
    image: 'https://via.placeholder.com/300x400/8b4513/ffffff?text=Jacket',
    price: 799,
    category: '外套',
    tags: ['休闲', '保暖']
  }
];

// 模拟Lookbook模板
const mockTemplates: LookbookTemplate[] = [
  {
    id: 'tpl_square',
    name: '正方形画册',
    description: '1:1经典正方形布局,适合Instagram发布',
    aspectRatio: '1:1',
    thumbnail: 'https://via.placeholder.com/200x200/1890ff/ffffff?text=1:1',
    maxItems: 4
  },
  {
    id: 'tpl_portrait',
    name: '竖版画册',
    description: '3:4竖版布局,适合小红书、抖音',
    aspectRatio: '3:4',
    thumbnail: 'https://via.placeholder.com/150x200/52c41a/ffffff?text=3:4',
    maxItems: 6
  },
  {
    id: 'tpl_story',
    name: '故事画册',
    description: '9:16故事版式,适合短视频封面',
    aspectRatio: '9:16',
    thumbnail: 'https://via.placeholder.com/112x200/faad14/ffffff?text=9:16',
    maxItems: 3
  }
];

export default function LookbookPage() {
  // 步骤管理
  const [currentStep, setCurrentStep] = useState(0);

  // SKU选择状态
  const [selectedSKUs, setSelectedSKUs] = useState<SKU[]>([]);
  const [skuSearchKeyword, setSkuSearchKeyword] = useState('');
  const [skuCategoryFilter, setSkuCategoryFilter] = useState<string>('all');

  // 模板选择状态
  const [selectedTemplate, setSelectedTemplate] = useState<LookbookTemplate | null>(null);

  // 版式和配置
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [lookbookTitle, setLookbookTitle] = useState('');
  const [lookbookSubtitle, setLookbookSubtitle] = useState('');

  // UI状态
  const [generating, setGenerating] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState(0);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [saveTemplateModalVisible, setSaveTemplateModalVisible] = useState(false);
  const [form] = Form.useForm();

  // 获取分类列表
  const categories = Array.from(new Set(mockSKUs.map(sku => sku.category)));

  // 过滤SKU
  const filteredSKUs = mockSKUs.filter(sku => {
    const matchesSearch = sku.name.toLowerCase().includes(skuSearchKeyword.toLowerCase()) ||
                         sku.tags.some(tag => tag.toLowerCase().includes(skuSearchKeyword.toLowerCase()));
    const matchesCategory = skuCategoryFilter === 'all' || sku.category === skuCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  // 切换SKU选择
  const toggleSKUSelection = (sku: SKU) => {
    if (selectedSKUs.find(s => s.id === sku.id)) {
      setSelectedSKUs(selectedSKUs.filter(s => s.id !== sku.id));
    } else {
      setSelectedSKUs([...selectedSKUs, sku]);
    }
  };

  // 选择模板
  const handleSelectTemplate = (template: LookbookTemplate) => {
    setSelectedTemplate(template);
    setAspectRatio(template.aspectRatio);
  };

  // 生成Lookbook
  const handleGenerate = async () => {
    if (selectedSKUs.length === 0) {
      message.warning('请至少选择一个SKU');
      return;
    }

    if (!selectedTemplate) {
      message.warning('请选择一个模板');
      return;
    }

    setGenerating(true);
    setGeneratingProgress(0);

    try {
      // 模拟生成进度
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setGeneratingProgress(i);
      }

      message.success('Lookbook生成成功!');
      setCurrentStep(2);
    } catch (error) {
      message.error('生成失败,请重试');
    } finally {
      setGenerating(false);
    }
  };

  // 导出单张
  const handleExportSingle = async (format: 'png' | 'jpg') => {
    message.loading({ content: '正在导出...', key: 'export' });

    try {
      // 模拟导出
      await new Promise(resolve => setTimeout(resolve, 1000));
      message.success({ content: `导出${format.toUpperCase()}成功!`, key: 'export' });
    } catch (error) {
      message.error({ content: '导出失败', key: 'export' });
    }
  };

  // 导出ZIP打包
  const handleExportZIP = async () => {
    message.loading({ content: '正在打包下载...', key: 'zip' });

    try {
      // 模拟打包
      await new Promise(resolve => setTimeout(resolve, 2000));
      message.success({ content: 'ZIP打包下载成功!', key: 'zip' });
    } catch (error) {
      message.error({ content: '打包失败', key: 'zip' });
    }
  };

  // 保存为模板
  const handleSaveAsTemplate = async (values: any) => {
    try {
      // 模拟保存
      await new Promise(resolve => setTimeout(resolve, 1000));
      message.success('保存为模板成功!');
      setSaveTemplateModalVisible(false);
      form.resetFields();
    } catch (error) {
      message.error('保存失败,请重试');
    }
  };

  // 步骤1: SKU选择
  const renderSKUSelection = () => (
    <Card title="选择商品SKU" style={{ marginBottom: 24 }}>
      {/* 搜索和筛选 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Input
            placeholder="搜索商品名称或标签..."
            prefix={<SearchOutlined />}
            value={skuSearchKeyword}
            onChange={(e) => setSkuSearchKeyword(e.target.value)}
            allowClear
          />
        </Col>
        <Col span={12}>
          <Select
            value={skuCategoryFilter}
            onChange={setSkuCategoryFilter}
            style={{ width: '100%' }}
          >
            <Option value="all">全部分类</Option>
            {categories.map(cat => (
              <Option key={cat} value={cat}>{cat}</Option>
            ))}
          </Select>
        </Col>
      </Row>

      {/* 已选择的SKU */}
      {selectedSKUs.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text strong>已选择: </Text>
          <Space wrap>
            {selectedSKUs.map(sku => (
              <Tag
                key={sku.id}
                closable
                onClose={() => toggleSKUSelection(sku)}
                color="blue"
              >
                {sku.name}
              </Tag>
            ))}
          </Space>
          <Divider />
        </div>
      )}

      {/* SKU网格 */}
      <Row gutter={[16, 16]}>
        {filteredSKUs.map(sku => {
          const isSelected = !!selectedSKUs.find(s => s.id === sku.id);
          return (
            <Col key={sku.id} xs={12} sm={8} md={6} lg={4}>
              <Card
                hoverable
                cover={
                  <div style={{ position: 'relative' }}>
                    <img
                      src={sku.image}
                      alt={sku.name}
                      style={{ width: '100%', height: 200, objectFit: 'cover' }}
                    />
                    {isSelected && (
                      <div style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        background: '#52c41a',
                        borderRadius: '50%',
                        padding: 4
                      }}>
                        <CheckCircleOutlined style={{ color: 'white', fontSize: 20 }} />
                      </div>
                    )}
                  </div>
                }
                onClick={() => toggleSKUSelection(sku)}
                style={{
                  border: isSelected ? '2px solid #52c41a' : '1px solid #d9d9d9',
                  cursor: 'pointer'
                }}
              >
                <Card.Meta
                  title={<Text ellipsis>{sku.name}</Text>}
                  description={
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      <Text type="danger" strong>¥{sku.price}</Text>
                      <div>
                        {sku.tags.map(tag => (
                          <Tag key={tag}>{tag}</Tag>
                        ))}
                      </div>
                    </Space>
                  }
                />
              </Card>
            </Col>
          );
        })}
      </Row>

      {filteredSKUs.length === 0 && (
        <Empty description="没有找到匹配的商品" />
      )}

      <Divider />

      <div style={{ textAlign: 'center' }}>
        <Button
          type="primary"
          size="large"
          onClick={() => setCurrentStep(1)}
          disabled={selectedSKUs.length === 0}
        >
          下一步: 选择模板 ({selectedSKUs.length} 个商品)
        </Button>
      </div>
    </Card>
  );

  // 步骤2: 模板选择
  const renderTemplateSelection = () => (
    <Card title="选择Lookbook模板" style={{ marginBottom: 24 }}>
      <Row gutter={[24, 24]}>
        {mockTemplates.map(template => {
          const isSelected = selectedTemplate?.id === template.id;
          return (
            <Col key={template.id} span={8}>
              <Card
                hoverable
                cover={
                  <img
                    src={template.thumbnail}
                    alt={template.name}
                    style={{ width: '100%', height: 240, objectFit: 'contain', padding: 20 }}
                  />
                }
                onClick={() => handleSelectTemplate(template)}
                style={{
                  border: isSelected ? '2px solid #1890ff' : '1px solid #d9d9d9'
                }}
              >
                <Card.Meta
                  title={
                    <Space>
                      {template.name}
                      {isSelected && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size="small">
                      <Text type="secondary">{template.description}</Text>
                      <Tag color="blue">比例: {template.aspectRatio}</Tag>
                      <Tag color="green">最多{template.maxItems}个商品</Tag>
                    </Space>
                  }
                />
              </Card>
            </Col>
          );
        })}
      </Row>

      <Divider />

      {/* 自定义配置 */}
      {selectedTemplate && (
        <div style={{ marginTop: 24 }}>
          <Title level={5}>自定义配置</Title>
          <Form layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="Lookbook标题">
                  <Input
                    placeholder="请输入标题..."
                    value={lookbookTitle}
                    onChange={(e) => setLookbookTitle(e.target.value)}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="副标题">
                  <Input
                    placeholder="请输入副标题..."
                    value={lookbookSubtitle}
                    onChange={(e) => setLookbookSubtitle(e.target.value)}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </div>
      )}

      <Divider />

      <div style={{ textAlign: 'center' }}>
        <Space>
          <Button onClick={() => setCurrentStep(0)}>
            上一步
          </Button>
          <Button
            type="primary"
            size="large"
            onClick={handleGenerate}
            loading={generating}
            disabled={!selectedTemplate}
          >
            {generating ? '生成中...' : '生成Lookbook'}
          </Button>
        </Space>
      </div>

      {/* 生成进度 */}
      {generating && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Progress percent={generatingProgress} status="active" />
          <Text type="secondary">正在生成精美的Lookbook画册...</Text>
        </div>
      )}
    </Card>
  );

  // 步骤3: 预览和导出
  const renderPreviewExport = () => (
    <div>
      <Card title="Lookbook预览" style={{ marginBottom: 24 }}>
        {/* 预览区域 */}
        <div style={{
          background: '#f5f5f5',
          padding: 40,
          textAlign: 'center',
          borderRadius: 8,
          minHeight: 400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div>
            <FileImageOutlined style={{ fontSize: 80, color: '#1890ff', marginBottom: 16 }} />
            <Title level={4}>Lookbook预览</Title>
            <Text type="secondary">
              版式: {aspectRatio} | 商品数: {selectedSKUs.length}
            </Text>
            {lookbookTitle && (
              <div style={{ marginTop: 16 }}>
                <Title level={3}>{lookbookTitle}</Title>
                {lookbookSubtitle && <Text type="secondary">{lookbookSubtitle}</Text>}
              </div>
            )}
            <div style={{ marginTop: 24 }}>
              <Row gutter={[16, 16]} justify="center">
                {selectedSKUs.slice(0, selectedTemplate?.maxItems || 4).map(sku => (
                  <Col key={sku.id} span={6}>
                    <img
                      src={sku.image}
                      alt={sku.name}
                      style={{
                        width: '100%',
                        height: 150,
                        objectFit: 'cover',
                        borderRadius: 8
                      }}
                    />
                  </Col>
                ))}
              </Row>
            </div>
          </div>
        </div>
      </Card>

      {/* 导出选项 */}
      <Card title="导出选项">
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <Card size="small" hoverable onClick={() => handleExportSingle('png')}>
              <div style={{ textAlign: 'center' }}>
                <DownloadOutlined style={{ fontSize: 32, color: '#1890ff' }} />
                <Title level={5} style={{ marginTop: 8 }}>导出PNG</Title>
                <Text type="secondary">高质量PNG格式</Text>
              </div>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" hoverable onClick={() => handleExportSingle('jpg')}>
              <div style={{ textAlign: 'center' }}>
                <DownloadOutlined style={{ fontSize: 32, color: '#52c41a' }} />
                <Title level={5} style={{ marginTop: 8 }}>导出JPG</Title>
                <Text type="secondary">压缩JPG格式</Text>
              </div>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" hoverable onClick={handleExportZIP}>
              <div style={{ textAlign: 'center' }}>
                <CloudDownloadOutlined style={{ fontSize: 32, color: '#faad14' }} />
                <Title level={5} style={{ marginTop: 8 }}>批量打包</Title>
                <Text type="secondary">ZIP格式批量下载</Text>
              </div>
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
              type="default"
              icon={<SaveOutlined />}
              onClick={() => setSaveTemplateModalVisible(true)}
            >
              保存为模板
            </Button>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={() => {
                setCurrentStep(0);
                setSelectedSKUs([]);
                setSelectedTemplate(null);
                setLookbookTitle('');
                setLookbookSubtitle('');
                message.info('已重置,可以创建新的Lookbook');
              }}
            >
              创建新画册
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
            <LayoutOutlined style={{ marginRight: 8 }} />
            Lookbook生成器
          </Title>
          <Paragraph type="secondary">
            三步创建精美的商品画册: 选择SKU → 选择模板 → 导出分享
          </Paragraph>
        </div>
        <ThemeSwitcher mode="segmented" size="middle" />
      </div>

      {/* 步骤条 */}
      <Steps current={currentStep} style={{ marginBottom: 32 }}>
        <Step title="选择商品" description="多选SKU" icon={<AppstoreOutlined />} />
        <Step title="选择模板" description="版式和配置" icon={<LayoutOutlined />} />
        <Step title="预览导出" description="下载和分享" icon={<FileImageOutlined />} />
      </Steps>

      {/* 步骤内容 */}
      {currentStep === 0 && renderSKUSelection()}
      {currentStep === 1 && renderTemplateSelection()}
      {currentStep === 2 && renderPreviewExport()}

      {/* 保存为模板模态框 */}
      <Modal
        title="保存为模板"
        open={saveTemplateModalVisible}
        onCancel={() => setSaveTemplateModalVisible(false)}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveAsTemplate}
        >
          <Form.Item
            name="name"
            label="模板名称"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="请输入模板名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="模板描述"
          >
            <TextArea rows={3} placeholder="请描述模板的用途和特点" />
          </Form.Item>

          <Form.Item
            name="isPublic"
            label="公开设置"
            valuePropName="checked"
          >
            <Checkbox>公开此模板(其他用户可以使用)</Checkbox>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setSaveTemplateModalVisible(false)}>
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
