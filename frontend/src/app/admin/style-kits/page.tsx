/**
 * ADMIN-P1-SK-109 Style Kits（品牌样式包）
 * 艹，这个Style Kits必须完美，支持品牌色/字体/水印/价签组件，还要能一键套用！
 *
 * @author 老王
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Upload,
  Tag,
  Typography,
  Row,
  Col,
  Divider,
  Popconfirm,
  message,
  Tabs,
  Switch,
  InputNumber,
  Tooltip,
  Badge,
  Avatar,
  ColorPicker,
  Slider,
  Alert,
  Collapse,
  Transfer
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  UploadOutlined,
  SaveOutlined,
  CloseOutlined,
  ReloadOutlined,
  ExportOutlined,
  ImportOutlined,
  SearchOutlined,
  FilterOutlined,
  TagOutlined,
  PictureOutlined,
  FontColorsOutlined,
  BgColorsOutlined,
  SettingOutlined,
  AppstoreOutlined,
  ThunderboltOutlined,
  UndoOutlined,
  CheckCircleOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { ColumnsType } from 'antd/es/table';
import type { Color } from 'antd/es/color-picker';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;
const { Panel } = Collapse;

// 数据接口定义
interface StyleKit {
  id: string;
  name: string;
  code: string;
  description: string;
  brand: string;
  status: 'active' | 'inactive' | 'draft';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  colors: BrandColor[];
  fonts: BrandFont[];
  watermarks: Watermark[];
  priceTags: PriceTag[];
  preview?: string;
}

interface BrandColor {
  id: string;
  name: string;
  hex: string;
  rgb: { r: number; g: number; b: number };
  usage: string[];
  isPrimary: boolean;
}

type ComponentTab = 'colors' | 'fonts' | 'watermarks' | 'priceTags';

interface BrandFont {
  id: string;
  name: string;
  family: string;
  weights: number[];
  sizes: number[];
  lineHeight: number;
  letterSpacing: number;
  usage: string[];
}

interface Watermark {
  id: string;
  name: string;
  type: 'logo' | 'text' | 'pattern';
  content: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  opacity: number;
  size: number;
  rotation: number;
  imageUrl?: string;
}

interface PriceTag {
  id: string;
  name: string;
  template: string;
  fields: PriceTagField[];
  style: PriceTagStyle;
}

interface PriceTagField {
  key: string;
  label: string;
  type: 'text' | 'price' | 'currency' | 'discount';
  required: boolean;
  defaultValue?: string;
}

interface PriceTagStyle {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  fontSize: number;
  fontWeight: number;
  padding: { top: number; right: number; bottom: number; left: number };
}

// 模拟数据
const mockStyleKits: StyleKit[] = [
  {
    id: 'kit_001',
    name: '经典品牌样式',
    code: 'CLASSIC-001',
    description: '适用于经典品牌的样式包，包含传统配色和字体',
    brand: '品牌A',
    status: 'active',
    createdAt: '2025-11-01T10:00:00Z',
    updatedAt: '2025-11-03T09:30:00Z',
    createdBy: '设计师张三',
    colors: [
      {
        id: 'color_001',
        name: '经典红',
        hex: '#C41E3A',
        rgb: { r: 196, g: 30, b: 58 },
        usage: ['logo', 'buttons', 'highlights'],
        isPrimary: true
      },
      {
        id: 'color_002',
        name: '深蓝',
        hex: '#1E3A8A',
        rgb: { r: 30, g: 58, b: 138 },
        usage: ['headers', 'backgrounds'],
        isPrimary: false
      }
    ],
    fonts: [
      {
        id: 'font_001',
        name: '品牌主字体',
        family: 'PingFang SC',
        weights: [400, 500, 700],
        sizes: [12, 14, 16, 18, 24, 32],
        lineHeight: 1.5,
        letterSpacing: 0,
        usage: ['headings', 'body']
      }
    ],
    watermarks: [
      {
        id: 'watermark_001',
        name: '品牌Logo水印',
        type: 'logo',
        content: 'Brand Logo',
        position: 'bottom-right',
        opacity: 0.3,
        size: 80,
        rotation: 45
      }
    ],
    priceTags: [
      {
        id: 'tag_001',
        name: '经典价签',
        template: 'classic',
        fields: [
          { key: 'price', label: '价格', type: 'price', required: true },
          { key: 'currency', label: '货币', type: 'currency', required: true },
          { key: 'discount', label: '折扣', type: 'discount', required: false }
        ],
        style: {
          backgroundColor: '#FFFFFF',
          textColor: '#333333',
          borderColor: '#E5E5E5',
          borderWidth: 1,
          borderRadius: 4,
          fontSize: 14,
          fontWeight: 400,
          padding: { top: 8, right: 12, bottom: 8, left: 12 }
        }
      }
    ],
    preview: 'https://api.dicebear.com/7.x/avataaars/svg?seed=stylekit1'
  }
];

const brands = ['品牌A', '品牌B', '品牌C', '品牌D'];

export default function StyleKitsPage() {
  // 状态管理
  const [styleKits, setStyleKits] = useState<StyleKit[]>(mockStyleKits);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [applyModalVisible, setApplyModalVisible] = useState(false);
  const [currentKit, setCurrentKit] = useState<StyleKit | null>(null);
  const [modalType, setModalType] = useState<'create' | 'edit' | 'preview' | 'apply'>('create');
  const [form] = Form.useForm();

  // 样式组件编辑状态
  const [activeComponent, setActiveComponent] = useState<ComponentTab>('colors');
  const [tempColors, setTempColors] = useState<BrandColor[]>([]);
  const [tempFonts, setTempFonts] = useState<BrandFont[]>([]);
  const [tempWatermarks, setTempWatermarks] = useState<Watermark[]>([]);
  const [tempPriceTags, setTempPriceTags] = useState<PriceTag[]>([]);

  // 表格列配置
  const columns: ColumnsType<StyleKit> = [
    {
      title: '预览',
      dataIndex: 'preview',
      width: 80,
      render: (preview) => (
        <Avatar size={40} src={preview} icon={<AppstoreOutlined />} />
      )
    },
    {
      title: '样式包名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{record.code}</Text>
        </div>
      )
    },
    {
      title: '品牌',
      dataIndex: 'brand',
      key: 'brand',
      render: (brand) => <Tag color="blue">{brand}</Tag>
    },
    {
      title: '组件数量',
      key: 'components',
      render: (_, record) => (
        <Space wrap>
          <Tag color="red">{record.colors.length} 配色</Tag>
          <Tag color="green">{record.fonts.length} 字体</Tag>
          <Tag color="blue">{record.watermarks.length} 水印</Tag>
          <Tag color="purple">{record.priceTags.length} 价签</Tag>
        </Space>
      )
    },
    {
      title: '创建者',
      dataIndex: 'createdBy',
      key: 'createdBy'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Badge
          status={status === 'active' ? 'success' : status === 'inactive' ? 'error' : 'warning'}
          text={status === 'active' ? '启用' : status === 'inactive' ? '禁用' : '草稿'}
        />
      )
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (date) => new Date(date).toLocaleDateString()
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="预览">
            <Button
              type="text"
              icon={<EyeOutlined />}
              size="small"
              onClick={() => handlePreview(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title="应用">
            <Button
              type="text"
              icon={<ThunderboltOutlined />}
              size="small"
              onClick={() => handleApply(record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm
              title="确定删除这个样式包吗？"
              onConfirm={() => handleDelete(record.id)}
            >
              <Button type="text" danger icon={<DeleteOutlined />} size="small" />
            </Popconfirm>
          </Tooltip>
        </Space>
      )
    }
  ];

  // 处理预览
  const handlePreview = (kit: StyleKit) => {
    setCurrentKit(kit);
    setModalType('preview');
    setPreviewModalVisible(true);
  };

  // 处理编辑
  const handleEdit = (kit: StyleKit) => {
    setCurrentKit(kit);
    setModalType('edit');
    setModalVisible(true);
    setTempColors(kit.colors);
    setTempFonts(kit.fonts);
    setTempWatermarks(kit.watermarks);
    setTempPriceTags(kit.priceTags);

    setTimeout(() => {
      form.setFieldsValue(kit);
    }, 100);
  };

  // 处理应用
  const handleApply = (kit: StyleKit) => {
    setCurrentKit(kit);
    setModalType('apply');
    setApplyModalVisible(true);
  };

  // 处理删除
  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setStyleKits(prev => prev.filter(kit => kit.id !== id));
      message.success('删除成功');
    } catch (error) {
      message.error('删除失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理新增
  const handleAdd = () => {
    setModalType('create');
    setCurrentKit(null);
    setModalVisible(true);
    setTempColors([]);
    setTempFonts([]);
    setTempWatermarks([]);
    setTempPriceTags([]);
    form.resetFields();
  };

  // 处理Modal提交
  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      await new Promise(resolve => setTimeout(resolve, 1000));

      const kitData = {
        ...values,
        colors: tempColors,
        fonts: tempFonts,
        watermarks: tempWatermarks,
        priceTags: tempPriceTags
      };

      if (modalType === 'create') {
        const newKit: StyleKit = {
          id: `kit_${Date.now()}`,
          ...kitData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: '当前用户'
        };

        setStyleKits(prev => [...prev, newKit]);
        message.success('创建成功');
      } else {
        const updatedKit = {
          ...currentKit,
          ...kitData,
          updatedAt: new Date().toISOString()
        };

        setStyleKits(prev => prev.map(kit =>
          kit.id === currentKit?.id ? updatedKit : kit
        ));
        message.success('更新成功');
      }

      setModalVisible(false);
      form.resetFields();
      setCurrentKit(null);
    } catch (error) {
      console.error('Submit failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // 应用样式包
  const handleApplyKit = async () => {
    if (!currentKit) return;

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 这里应该调用编辑器API来应用样式
      console.log('Applying style kit:', currentKit.name);

      message.success(`样式包 "${currentKit.name}" 已成功应用到编辑器`);
      setApplyModalVisible(false);
    } catch (error) {
      message.error('应用失败');
    } finally {
      setLoading(false);
    }
  };

  // 添加品牌色
  const addBrandColor = () => {
    const newColor: BrandColor = {
      id: `color_${Date.now()}`,
      name: '新颜色',
      hex: '#000000',
      rgb: { r: 0, g: 0, b: 0 },
      usage: [],
      isPrimary: false
    };
    setTempColors(prev => [...prev, newColor]);
  };

  // 添加品牌字体
  const addBrandFont = () => {
    const newFont: BrandFont = {
      id: `font_${Date.now()}`,
      name: '新字体',
      family: 'Arial',
      weights: [400],
      sizes: [14],
      lineHeight: 1.5,
      letterSpacing: 0,
      usage: []
    };
    setTempFonts(prev => [...prev, newFont]);
  };

  // 添加水印
  const addWatermark = () => {
    const newWatermark: Watermark = {
      id: `watermark_${Date.now()}`,
      name: '新水印',
      type: 'logo',
      content: '',
      position: 'bottom-right',
      opacity: 0.3,
      size: 80,
      rotation: 45
    };
    setTempWatermarks(prev => [...prev, newWatermark]);
  };

  // 添加价签
  const addPriceTag = () => {
    const newPriceTag: PriceTag = {
      id: `tag_${Date.now()}`,
      name: '新价签',
      template: 'default',
      fields: [
        { key: 'price', label: '价格', type: 'price', required: true }
      ],
      style: {
        backgroundColor: '#FFFFFF',
        textColor: '#333333',
        borderColor: '#E5E5E5',
        borderWidth: 1,
        borderRadius: 4,
        fontSize: 14,
        fontWeight: 400,
        padding: { top: 8, right: 12, bottom: 8, left: 12 }
      }
    };
    setTempPriceTags(prev => [...prev, newPriceTag]);
  };

  // 渲染颜色编辑器
  const renderColorEditor = () => (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="dashed" icon={<PlusOutlined />} onClick={addBrandColor} block>
          添加品牌色
        </Button>
      </div>
      <div className="color-list">
        {tempColors.map((color, index) => (
          <Card key={color.id} size="small" style={{ marginBottom: 12 }}>
            <Row gutter={16} align="middle">
              <Col span={4}>
                <ColorPicker
                  value={color.hex}
                  onChange={(colorValue) => {
                    const hex = typeof colorValue === 'string' ? colorValue : colorValue.toHexString();
                    const newColors = [...tempColors];
                    const existingColor = newColors[index];
                    if (!existingColor) {
                      return;
                    }
                    newColors[index] = {
                      ...existingColor,
                      hex,
                      rgb: {
                        r: parseInt(hex.slice(1, 3), 16),
                        g: parseInt(hex.slice(3, 5), 16),
                        b: parseInt(hex.slice(5, 7), 16)
                      }
                    };
                    setTempColors(newColors);
                  }}
                />
              </Col>
              <Col span={6}>
                <Input
                  placeholder="颜色名称"
                  value={color.name}
                  onChange={(e) => {
                    const newColors = [...tempColors];
                    const existingColor = newColors[index];
                    if (!existingColor) {
                      return;
                    }
                    newColors[index] = { ...existingColor, name: e.target.value };
                    setTempColors(newColors);
                  }}
                />
              </Col>
              <Col span={6}>
                <Input
                  placeholder="HEX值"
                  value={color.hex}
                  onChange={(e) => {
                    const newColors = [...tempColors];
                    const existingColor = newColors[index];
                    if (!existingColor) {
                      return;
                    }
                    newColors[index] = { ...existingColor, hex: e.target.value };
                    setTempColors(newColors);
                  }}
                />
              </Col>
              <Col span={4}>
                <Switch
                  checkedChildren="主色"
                  unCheckedChildren="辅色"
                  checked={color.isPrimary}
                  onChange={(checked) => {
                    const newColors = [...tempColors];
                    const existingColor = newColors[index];
                    if (!existingColor) {
                      return;
                    }
                    newColors[index] = { ...existingColor, isPrimary: checked };
                    setTempColors(newColors);
                  }}
                />
              </Col>
              <Col span={4}>
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => {
                    setTempColors(prev => prev.filter(c => c.id !== color.id));
                  }}
                />
              </Col>
            </Row>
          </Card>
        ))}
      </div>
    </div>
  );

  // 渲染字体编辑器
  const renderFontEditor = () => (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="dashed" icon={<PlusOutlined />} onClick={addBrandFont} block>
          添加品牌字体
        </Button>
      </div>
      <div className="font-list">
        {tempFonts.map((font, index) => (
          <Card key={font.id} size="small" style={{ marginBottom: 12 }}>
            <Row gutter={16}>
              <Col span={8}>
                <Input
                  placeholder="字体名称"
                  value={font.name}
                  onChange={(e) => {
                    const newFonts = [...tempFonts];
                    const existingFont = newFonts[index];
                    if (!existingFont) {
                      return;
                    }
                    newFonts[index] = { ...existingFont, name: e.target.value };
                    setTempFonts(newFonts);
                  }}
                />
              </Col>
              <Col span={8}>
                <Input
                  placeholder="字体族"
                  value={font.family}
                  onChange={(e) => {
                    const newFonts = [...tempFonts];
                    const existingFont = newFonts[index];
                    if (!existingFont) {
                      return;
                    }
                    newFonts[index] = { ...existingFont, family: e.target.value };
                    setTempFonts(newFonts);
                  }}
                />
              </Col>
              <Col span={4}>
                <InputNumber
                  placeholder="行高"
                  value={font.lineHeight}
                  min={1}
                  max={3}
                  step={0.1}
                  onChange={(value) => {
                    const newFonts = [...tempFonts];
                    const existingFont = newFonts[index];
                    if (!existingFont) {
                      return;
                    }
                    newFonts[index] = { ...existingFont, lineHeight: value || 1.5 };
                    setTempFonts(newFonts);
                  }}
                />
              </Col>
              <Col span={4}>
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => {
                    setTempFonts(prev => prev.filter(f => f.id !== font.id));
                  }}
                />
              </Col>
            </Row>
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>Style Kits管理</Title>
        <Text type="secondary">
          管理品牌样式包，包含品牌配色、字体、水印和价签组件，支持编辑器一键套用
        </Text>
      </div>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              新增样式包
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
              刷新
            </Button>
            <Button icon={<ExportOutlined />}>
              导出
            </Button>
            <Button icon={<ImportOutlined />}>
              导入
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={styleKits}
          rowKey="id"
          loading={loading}
          pagination={{
            total: styleKits.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `显示 ${range[0]}-${range[1]} 条，共 ${total} 条记录`
          }}
        />
      </Card>

      {/* 新增/编辑Modal */}
      <Modal
        title={modalType === 'create' ? '新增样式包' : '编辑样式包'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setCurrentKit(null);
        }}
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={handleModalSubmit} loading={loading}>
            {modalType === 'create' ? '创建' : '更新'}
          </Button>
        ]}
        width={1200}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="样式包名称"
                rules={[{ required: true, message: '请输入样式包名称' }]}
              >
                <Input placeholder="请输入样式包名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="code"
                label="样式包代码"
                rules={[{ required: true, message: '请输入样式包代码' }]}
              >
                <Input placeholder="请输入样式包代码" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="brand"
                label="品牌"
                rules={[{ required: true, message: '请选择品牌' }]}
              >
                <Select placeholder="请选择品牌">
                  {brands.map(brand => (
                    <Option key={brand} value={brand}>{brand}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="status"
                label="状态"
                initialValue="active"
              >
                <Select>
                  <Option value="active">启用</Option>
                  <Option value="inactive">禁用</Option>
                  <Option value="draft">草稿</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={3} placeholder="请输入描述" />
          </Form.Item>

          <Divider>组件配置</Divider>

          <Tabs activeKey={activeComponent} onChange={(key) => setActiveComponent(key as ComponentTab)}>
            <TabPane tab={`品牌色 (${tempColors.length})`} key="colors">
              {renderColorEditor()}
            </TabPane>
            <TabPane tab={`字体 (${tempFonts.length})`} key="fonts">
              {renderFontEditor()}
            </TabPane>
            <TabPane tab={`水印 (${tempWatermarks.length})`} key="watermarks">
              <div style={{ marginBottom: 16 }}>
                <Button type="dashed" icon={<PlusOutlined />} onClick={addWatermark} block>
                  添加水印
                </Button>
              </div>
            </TabPane>
            <TabPane tab={`价签 (${tempPriceTags.length})`} key="priceTags">
              <div style={{ marginBottom: 16 }}>
                <Button type="dashed" icon={<PlusOutlined />} onClick={addPriceTag} block>
                  添加价签
                </Button>
              </div>
            </TabPane>
          </Tabs>
        </Form>
      </Modal>

      {/* 预览Modal */}
      <Modal
        title="样式包预览"
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewModalVisible(false)}>
            关闭
          </Button>,
          <Button
            key="apply"
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={() => {
              setPreviewModalVisible(false);
              if (currentKit) handleApply(currentKit);
            }}
          >
            应用到编辑器
          </Button>
        ]}
        width={800}
      >
        {currentKit && (
          <div>
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={8}>
                <Avatar size={80} src={currentKit.preview} icon={<AppstoreOutlined />} />
              </Col>
              <Col span={16}>
                <Title level={4}>{currentKit.name}</Title>
                <Text type="secondary">{currentKit.description}</Text>
                <div style={{ marginTop: 8 }}>
                  <Tag color="blue">{currentKit.brand}</Tag>
                  <Badge
                    status={currentKit.status === 'active' ? 'success' : 'warning'}
                    text={currentKit.status === 'active' ? '启用' : '草稿'}
                  />
                </div>
              </Col>
            </Row>

            <Collapse>
              <Panel header={`品牌色 (${currentKit.colors.length})`} key="colors">
                <Row gutter={16}>
                  {currentKit.colors.map(color => (
                    <Col span={6} key={color.id} style={{ textAlign: 'center', marginBottom: 16 }}>
                      <div
                        style={{
                          width: 60,
                          height: 60,
                          backgroundColor: color.hex,
                          margin: '0 auto 8px',
                          borderRadius: 8,
                          border: '1px solid #d9d9d9'
                        }}
                      />
                      <div>
                        <Text strong>{color.name}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>{color.hex}</Text>
                      </div>
                    </Col>
                  ))}
                </Row>
              </Panel>
              <Panel header={`字体 (${currentKit.fonts.length})`} key="fonts">
                {currentKit.fonts.map(font => (
                  <div key={font.id} style={{ marginBottom: 12 }}>
                    <Text strong>{font.name}</Text>
                    <div style={{ fontFamily: font.family, fontSize: 16, marginTop: 4 }}>
                      示例文字展示效果
                    </div>
                  </div>
                ))}
              </Panel>
              <Panel header={`水印 (${currentKit.watermarks.length})`} key="watermarks">
                {currentKit.watermarks.map(watermark => (
                  <Tag key={watermark.id} style={{ margin: 4 }}>
                    {watermark.name}
                  </Tag>
                ))}
              </Panel>
              <Panel header={`价签 (${currentKit.priceTags.length})`} key="priceTags">
                {currentKit.priceTags.map(priceTag => (
                  <Tag key={priceTag.id} style={{ margin: 4 }}>
                    {priceTag.name}
                  </Tag>
                ))}
              </Panel>
            </Collapse>
          </div>
        )}
      </Modal>

      {/* 应用Modal */}
      <Modal
        title="应用样式包"
        open={applyModalVisible}
        onCancel={() => setApplyModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setApplyModalVisible(false)}>
            取消
          </Button>,
          <Button key="apply" type="primary" onClick={handleApplyKit} loading={loading}>
            确认应用
          </Button>
        ]}
      >
        {currentKit && (
          <div>
            <Alert
              message="即将应用样式包到编辑器"
              description={`应用 "${currentKit.name}" 样式包将会更新编辑器的配色、字体、水印和价签设置。`}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <div>
              <Text strong>包含组件：</Text>
              <div style={{ marginTop: 8 }}>
                <Tag color="red">{currentKit.colors.length} 个品牌色</Tag>
                <Tag color="green">{currentKit.fonts.length} 个字体</Tag>
                <Tag color="blue">{currentKit.watermarks.length} 个水印</Tag>
                <Tag color="purple">{currentKit.priceTags.length} 个价签</Tag>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
