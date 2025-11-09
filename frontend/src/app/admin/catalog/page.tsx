/**
 * ADMIN-P1-CAT-108 服饰Catalog（SKU元数据）
 * 艹，这个Catalog必须完美，支持Style/Colorway/Size/Fabric/Artwork的CRUD，还要能联动！
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
  Transfer,
  DatePicker,
  Switch,
  InputNumber,
  Tooltip,
  Badge,
  Avatar
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
  PictureOutlined
} from '@ant-design/icons';
import { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

// 数据接口定义
interface Style {
  id: string;
  name: string;
  code: string;
  category: string;
  description: string;
  season: string;
  designer: string;
  status: 'active' | 'inactive' | 'draft';
  createdAt: string;
  updatedAt: string;
  colorways: Colorway[];
  image?: string;
}

interface Colorway {
  id: string;
  name: string;
  code: string;
  primaryColor: string;
  secondaryColors: string[];
  materials: string[];
  images: string[];
  status: 'active' | 'inactive' | 'discontinued';
  createdAt: string;
  updatedAt: string;
}

interface Size {
  id: string;
  name: string;
  code: string;
  category: string;
  measurements: {
    chest?: number;
    waist?: number;
    hips?: number;
    length?: number;
    sleeve?: number;
  };
  fit: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

interface Fabric {
  id: string;
  name: string;
  code: string;
  type: string;
  composition: string;
  weight: number;
  properties: string[];
  care: string[];
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

interface Artwork {
  id: string;
  name: string;
  code: string;
  type: 'graphic' | 'pattern' | 'logo' | 'text';
  category: string;
  images: string[];
  description: string;
  usage: string[];
  restrictions: string[];
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

// 模拟数据
const mockStyles: Style[] = [
  {
    id: 'style_001',
    name: '经典T恤',
    code: 'TSH-001',
    category: '上装',
    description: '基础款经典T恤，适合日常穿着',
    season: '四季',
    designer: '设计团队A',
    status: 'active',
    createdAt: '2025-11-01T10:00:00Z',
    updatedAt: '2025-11-03T09:30:00Z',
    colorways: [],
    image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=tshirt1'
  },
  {
    id: 'style_002',
    name: '牛仔裤',
    code: 'JEA-001',
    category: '下装',
    description: '经典直筒牛仔裤，百搭单品',
    season: '四季',
    designer: '设计团队B',
    status: 'active',
    createdAt: '2025-10-28T14:20:00Z',
    updatedAt: '2025-11-02T16:45:00Z',
    colorways: [],
    image: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jean1'
  }
];

const mockColorways: Colorway[] = [
  {
    id: 'color_001',
    name: '海军蓝',
    code: 'NV-001',
    primaryColor: '#000080',
    secondaryColors: ['#191970', '#4169E1'],
    materials: ['纯棉', '氨纶'],
    images: ['https://picsum.photos/200/200?random=1'],
    status: 'active',
    createdAt: '2025-11-01T10:00:00Z',
    updatedAt: '2025-11-03T09:30:00Z'
  },
  {
    id: 'color_002',
    name: '米白色',
    code: 'MW-001',
    primaryColor: '#F5F5DC',
    secondaryColors: ['#FAEBD7', '#F0E68C'],
    materials: ['纯棉'],
    images: ['https://picsum.photos/200/200?random=2'],
    status: 'active',
    createdAt: '2025-10-28T14:20:00Z',
    updatedAt: '2025-11-02T16:45:00Z'
  }
];

const mockSizes: Size[] = [
  {
    id: 'size_001',
    name: 'S',
    code: 'S-001',
    category: '上装',
    measurements: {
      chest: 96,
      waist: 80,
      hips: 96,
      length: 66,
      sleeve: 60
    },
    fit: '修身',
    status: 'active',
    createdAt: '2025-11-01T10:00:00Z',
    updatedAt: '2025-11-03T09:30:00Z'
  },
  {
    id: 'size_002',
    name: 'M',
    code: 'M-001',
    category: '上装',
    measurements: {
      chest: 100,
      waist: 84,
      hips: 100,
      length: 68,
      sleeve: 62
    },
    fit: '修身',
    status: 'active',
    createdAt: '2025-10-28T14:20:00Z',
    updatedAt: '2025-11-02T16:45:00Z'
  }
];

const mockFabrics: Fabric[] = [
  {
    id: 'fabric_001',
    name: '纯棉针织',
    code: 'COT-KN-001',
    type: '针织',
    composition: '100%纯棉',
    weight: 180,
    properties: ['透气', '柔软', '吸湿'],
    care: ['冷水洗涤', '低温烘干', '不可漂白'],
    status: 'active',
    createdAt: '2025-11-01T10:00:00Z',
    updatedAt: '2025-11-03T09:30:00Z'
  },
  {
    id: 'fabric_002',
    name: '弹力牛仔',
    code: 'DEN-ELA-001',
    type: '梭织',
    composition: '98%棉 2%氨纶',
    weight: 320,
    properties: ['弹力', '耐磨', '挺括'],
    care: ['冷水洗涤', '中温烘干', '不可漂白'],
    status: 'active',
    createdAt: '2025-10-28T14:20:00Z',
    updatedAt: '2025-11-02T16:45:00Z'
  }
];

const mockArtworks: Artwork[] = [
  {
    id: 'art_001',
    name: '品牌Logo',
    code: 'LOGO-001',
    type: 'logo',
    category: '品牌标识',
    images: ['https://picsum.photos/200/200?random=10'],
    description: '官方品牌标识图案',
    usage: ['胸贴', '领标', '洗水标'],
    restrictions: ['不可修改比例', '不可变色'],
    status: 'active',
    createdAt: '2025-11-01T10:00:00Z',
    updatedAt: '2025-11-03T09:30:00Z'
  }
];

export default function CatalogPage() {
  // 状态管理
  const [activeTab, setActiveTab] = useState('styles');
  const [styles, setStyles] = useState<Style[]>(mockStyles);
  const [colorways, setColorways] = useState<Colorway[]>(mockColorways);
  const [sizes, setSizes] = useState<Size[]>(mockSizes);
  const [fabrics, setFabrics] = useState<Fabric[]>(mockFabrics);
  const [artworks, setArtworks] = useState<Artwork[]>(mockArtworks);

  // Modal状态
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'create' | 'edit'>('create');
  const [currentRecord, setCurrentRecord] = useState<any>(null);
  const [form] = Form.useForm();

  // 加载状态
  const [loading, setLoading] = useState(false);

  // Style表格列配置
  const styleColumns: ColumnsType<Style> = [
    {
      title: '预览',
      dataIndex: 'image',
      width: 80,
      render: (image) => (
        <Avatar size={40} src={image} icon={<PictureOutlined />} />
      )
    },
    {
      title: '款式名称',
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
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (category) => <Tag color="blue">{category}</Tag>
    },
    {
      title: '季节',
      dataIndex: 'season',
      key: 'season',
      render: (season) => <Tag color="green">{season}</Tag>
    },
    {
      title: '设计师',
      dataIndex: 'designer',
      key: 'designer'
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
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看">
            <Button type="text" icon={<EyeOutlined />} size="small" />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEdit('styles', record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm
              title="确定删除这个款式吗？"
              onConfirm={() => handleDelete('styles', record.id)}
            >
              <Button type="text" danger icon={<DeleteOutlined />} size="small" />
            </Popconfirm>
          </Tooltip>
        </Space>
      )
    }
  ];

  // Colorway表格列配置
  const colorwayColumns: ColumnsType<Colorway> = [
    {
      title: '颜色',
      dataIndex: 'primaryColor',
      width: 60,
      render: (color, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 20,
              height: 20,
              backgroundColor: color,
              border: '1px solid #d9d9d9',
              borderRadius: 4
            }}
          />
          <Text>{record.name}</Text>
        </div>
      )
    },
    {
      title: '颜色代码',
      dataIndex: 'code',
      key: 'code'
    },
    {
      title: '材质',
      dataIndex: 'materials',
      key: 'materials',
      render: (materials: string[] = []) => (
        <Space wrap>
          {materials.map((material, index) => (
            <Tag key={index}>{material}</Tag>
          ))}
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Badge
          status={status === 'active' ? 'success' : status === 'inactive' ? 'error' : 'warning'}
          text={status === 'active' ? '启用' : status === 'inactive' ? '禁用' : '停产'}
        />
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEdit('colorways', record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm
              title="确定删除这个颜色吗？"
              onConfirm={() => handleDelete('colorways', record.id)}
            >
              <Button type="text" danger icon={<DeleteOutlined />} size="small" />
            </Popconfirm>
          </Tooltip>
        </Space>
      )
    }
  ];

  // Size表格列配置
  const sizeColumns: ColumnsType<Size> = [
    {
      title: '尺码',
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
      title: '分类',
      dataIndex: 'category',
      key: 'category'
    },
    {
      title: '版型',
      dataIndex: 'fit',
      key: 'fit',
      render: (fit) => <Tag color="purple">{fit}</Tag>
    },
    {
      title: '胸围',
      dataIndex: ['measurements', 'chest'],
      key: 'chest',
      render: (value) => value ? `${value}cm` : '-'
    },
    {
      title: '腰围',
      dataIndex: ['measurements', 'waist'],
      key: 'waist',
      render: (value) => value ? `${value}cm` : '-'
    },
    {
      title: '衣长',
      dataIndex: ['measurements', 'length'],
      key: 'length',
      render: (value) => value ? `${value}cm` : '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Badge
          status={status === 'active' ? 'success' : 'error'}
          text={status === 'active' ? '启用' : '禁用'}
        />
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEdit('sizes', record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm
              title="确定删除这个尺码吗？"
              onConfirm={() => handleDelete('sizes', record.id)}
            >
              <Button type="text" danger icon={<DeleteOutlined />} size="small" />
            </Popconfirm>
          </Tooltip>
        </Space>
      )
    }
  ];

  // Fabric表格列配置
  const fabricColumns: ColumnsType<Fabric> = [
    {
      title: '面料名称',
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
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => <Tag color="cyan">{type}</Tag>
    },
    {
      title: '成分',
      dataIndex: 'composition',
      key: 'composition'
    },
    {
      title: '克重',
      dataIndex: 'weight',
      key: 'weight',
      render: (weight) => `${weight}g/m²`
    },
    {
      title: '特性',
      dataIndex: 'properties',
      key: 'properties',
      render: (properties: string[] = []) => (
        <Space wrap>
          {properties.map((prop, index) => (
            <Tag key={index}>{prop}</Tag>
          ))}
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Badge
          status={status === 'active' ? 'success' : 'error'}
          text={status === 'active' ? '启用' : '禁用'}
        />
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEdit('fabrics', record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm
              title="确定删除这个面料吗？"
              onConfirm={() => handleDelete('fabrics', record.id)}
            >
              <Button type="text" danger icon={<DeleteOutlined />} size="small" />
            </Popconfirm>
          </Tooltip>
        </Space>
      )
    }
  ];

  // Artwork表格列配置
  const artworkColumns: ColumnsType<Artwork> = [
    {
      title: '图案',
      dataIndex: 'images',
      width: 80,
      render: (images) => (
        <Avatar size={40} src={images[0]} icon={<PictureOutlined />} />
      )
    },
    {
      title: '名称',
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
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => {
        const typeMap: Record<string, string> = {
          graphic: '图形',
          pattern: '图案',
          logo: 'Logo',
          text: '文字'
        };
        return <Tag color="orange">{typeMap[type] || type}</Tag>;
      }
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category'
    },
    {
      title: '用途',
      dataIndex: 'usage',
      key: 'usage',
      render: (usage: string[] = []) => (
        <Space wrap>
          {usage.map((item, index) => (
            <Tag key={index}>{item}</Tag>
          ))}
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Badge
          status={status === 'active' ? 'success' : 'error'}
          text={status === 'active' ? '启用' : '禁用'}
        />
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEdit('artworks', record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm
              title="确定删除这个图案吗？"
              onConfirm={() => handleDelete('artworks', record.id)}
            >
              <Button type="text" danger icon={<DeleteOutlined />} size="small" />
            </Popconfirm>
          </Tooltip>
        </Space>
      )
    }
  ];

  // 处理编辑
  const handleEdit = (type: string, record: any) => {
    setModalType('edit');
    setCurrentRecord(record);
    setModalVisible(true);

    // 延迟设置表单值，确保modal已经打开
    setTimeout(() => {
      form.setFieldsValue(record);
    }, 100);
  };

  // 处理删除
  const handleDelete = async (type: string, id: string) => {
    setLoading(true);
    try {
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000));

      switch (type) {
        case 'styles':
          setStyles(prev => prev.filter(item => item.id !== id));
          break;
        case 'colorways':
          setColorways(prev => prev.filter(item => item.id !== id));
          break;
        case 'sizes':
          setSizes(prev => prev.filter(item => item.id !== id));
          break;
        case 'fabrics':
          setFabrics(prev => prev.filter(item => item.id !== id));
          break;
        case 'artworks':
          setArtworks(prev => prev.filter(item => item.id !== id));
          break;
      }

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
    setCurrentRecord(null);
    setModalVisible(true);
    form.resetFields();
  };

  // 处理Modal提交
  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (modalType === 'create') {
        const newRecord = {
          id: `${activeTab}_${Date.now()}`,
          ...values,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        switch (activeTab) {
          case 'styles':
            setStyles(prev => [...prev, newRecord]);
            break;
          case 'colorways':
            setColorways(prev => [...prev, newRecord]);
            break;
          case 'sizes':
            setSizes(prev => [...prev, newRecord]);
            break;
          case 'fabrics':
            setFabrics(prev => [...prev, newRecord]);
            break;
          case 'artworks':
            setArtworks(prev => [...prev, newRecord]);
            break;
        }

        message.success('创建成功');
      } else {
        // 更新逻辑
        const updatedRecord = {
          ...currentRecord,
          ...values,
          updatedAt: new Date().toISOString()
        };

        switch (activeTab) {
          case 'styles':
            setStyles(prev => prev.map(item =>
              item.id === currentRecord.id ? updatedRecord : item
            ));
            break;
          case 'colorways':
            setColorways(prev => prev.map(item =>
              item.id === currentRecord.id ? updatedRecord : item
            ));
            break;
          case 'sizes':
            setSizes(prev => prev.map(item =>
              item.id === currentRecord.id ? updatedRecord : item
            ));
            break;
          case 'fabrics':
            setFabrics(prev => prev.map(item =>
              item.id === currentRecord.id ? updatedRecord : item
            ));
            break;
          case 'artworks':
            setArtworks(prev => prev.map(item =>
              item.id === currentRecord.id ? updatedRecord : item
            ));
            break;
        }

        message.success('更新成功');
      }

      setModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error('Submit failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // 渲染表单内容
  const renderFormContent = () => {
    switch (activeTab) {
      case 'styles':
        return (
          <>
            <Form.Item
              name="name"
              label="款式名称"
              rules={[{ required: true, message: '请输入款式名称' }]}
            >
              <Input placeholder="请输入款式名称" />
            </Form.Item>
            <Form.Item
              name="code"
              label="款式代码"
              rules={[{ required: true, message: '请输入款式代码' }]}
            >
              <Input placeholder="请输入款式代码" />
            </Form.Item>
            <Form.Item
              name="category"
              label="分类"
              rules={[{ required: true, message: '请选择分类' }]}
            >
              <Select placeholder="请选择分类">
                <Option value="上装">上装</Option>
                <Option value="下装">下装</Option>
                <Option value="外套">外套</Option>
                <Option value="套装">套装</Option>
                <Option value="配饰">配饰</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="season"
              label="季节"
              rules={[{ required: true, message: '请选择季节' }]}
            >
              <Select placeholder="请选择季节">
                <Option value="春季">春季</Option>
                <Option value="夏季">夏季</Option>
                <Option value="秋季">秋季</Option>
                <Option value="冬季">冬季</Option>
                <Option value="四季">四季</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="designer"
              label="设计师"
              rules={[{ required: true, message: '请输入设计师' }]}
            >
              <Input placeholder="请输入设计师" />
            </Form.Item>
            <Form.Item
              name="description"
              label="描述"
            >
              <TextArea rows={4} placeholder="请输入描述" />
            </Form.Item>
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
          </>
        );

      case 'colorways':
        return (
          <>
            <Form.Item
              name="name"
              label="颜色名称"
              rules={[{ required: true, message: '请输入颜色名称' }]}
            >
              <Input placeholder="请输入颜色名称" />
            </Form.Item>
            <Form.Item
              name="code"
              label="颜色代码"
              rules={[{ required: true, message: '请输入颜色代码' }]}
            >
              <Input placeholder="请输入颜色代码" />
            </Form.Item>
            <Form.Item
              name="primaryColor"
              label="主色调"
              rules={[{ required: true, message: '请选择主色调' }]}
            >
              <Input type="color" />
            </Form.Item>
            <Form.Item
              name="materials"
              label="材质"
            >
              <Select mode="tags" placeholder="请选择或输入材质">
                <Option value="纯棉">纯棉</Option>
                <Option value="涤纶">涤纶</Option>
                <Option value="氨纶">氨纶</Option>
                <Option value="羊毛">羊毛</Option>
                <Option value="丝绸">丝绸</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="status"
              label="状态"
              initialValue="active"
            >
              <Select>
                <Option value="active">启用</Option>
                <Option value="inactive">禁用</Option>
                <Option value="discontinued">停产</Option>
              </Select>
            </Form.Item>
          </>
        );

      case 'sizes':
        return (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="name"
                  label="尺码名称"
                  rules={[{ required: true, message: '请输入尺码名称' }]}
                >
                  <Input placeholder="如：S, M, L" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="code"
                  label="尺码代码"
                  rules={[{ required: true, message: '请输入尺码代码' }]}
                >
                  <Input placeholder="请输入尺码代码" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item
              name="category"
              label="分类"
              rules={[{ required: true, message: '请选择分类' }]}
            >
              <Select placeholder="请选择分类">
                <Option value="上装">上装</Option>
                <Option value="下装">下装</Option>
                <Option value="外套">外套</Option>
                <Option value="套装">套装</Option>
              </Select>
            </Form.Item>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name={['measurements', 'chest']} label="胸围(cm)">
                  <InputNumber style={{ width: '100%' }} placeholder="胸围" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name={['measurements', 'waist']} label="腰围(cm)">
                  <InputNumber style={{ width: '100%' }} placeholder="腰围" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name={['measurements', 'hips']} label="臀围(cm)">
                  <InputNumber style={{ width: '100%' }} placeholder="臀围" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name={['measurements', 'length']} label="衣长(cm)">
                  <InputNumber style={{ width: '100%' }} placeholder="衣长" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name={['measurements', 'sleeve']} label="袖长(cm)">
                  <InputNumber style={{ width: '100%' }} placeholder="袖长" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="fit"
                  label="版型"
                  rules={[{ required: true, message: '请选择版型' }]}
                >
                  <Select placeholder="请选择版型">
                    <Option value="修身">修身</Option>
                    <Option value="宽松">宽松</Option>
                    <Option value="紧身">紧身</Option>
                    <Option value="标准">标准</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Form.Item
              name="status"
              label="状态"
              initialValue="active"
            >
              <Select>
                <Option value="active">启用</Option>
                <Option value="inactive">禁用</Option>
              </Select>
            </Form.Item>
          </>
        );

      case 'fabrics':
        return (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="name"
                  label="面料名称"
                  rules={[{ required: true, message: '请输入面料名称' }]}
                >
                  <Input placeholder="请输入面料名称" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="code"
                  label="面料代码"
                  rules={[{ required: true, message: '请输入面料代码' }]}
                >
                  <Input placeholder="请输入面料代码" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="type"
                  label="类型"
                  rules={[{ required: true, message: '请选择类型' }]}
                >
                  <Select placeholder="请选择类型">
                    <Option value="针织">针织</Option>
                    <Option value="梭织">梭织</Option>
                    <Option value="无纺">无纺</Option>
                    <Option value="复合">复合</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="weight" label="克重(g/m²)">
                  <InputNumber style={{ width: '100%' }} placeholder="克重" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item
              name="composition"
              label="成分"
              rules={[{ required: true, message: '请输入成分' }]}
            >
              <Input placeholder="如：100%纯棉" />
            </Form.Item>
            <Form.Item
              name="properties"
              label="特性"
            >
              <Select mode="tags" placeholder="请选择或输入特性">
                <Option value="透气">透气</Option>
                <Option value="柔软">柔软</Option>
                <Option value="弹力">弹力</Option>
                <Option value="耐磨">耐磨</Option>
                <Option value="防水">防水</Option>
                <Option value="吸湿">吸湿</Option>
                <Option value="挺括">挺括</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="care"
              label="护理说明"
            >
              <Select mode="tags" placeholder="请选择或输入护理说明">
                <Option value="冷水洗涤">冷水洗涤</Option>
                <Option value="温水洗涤">温水洗涤</Option>
                <Option value="低温烘干">低温烘干</Option>
                <Option value="中温烘干">中温烘干</Option>
                <Option value="不可漂白">不可漂白</Option>
                <Option value="不可干洗">不可干洗</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="status"
              label="状态"
              initialValue="active"
            >
              <Select>
                <Option value="active">启用</Option>
                <Option value="inactive">禁用</Option>
              </Select>
            </Form.Item>
          </>
        );

      case 'artworks':
        return (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="name"
                  label="图案名称"
                  rules={[{ required: true, message: '请输入图案名称' }]}
                >
                  <Input placeholder="请输入图案名称" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="code"
                  label="图案代码"
                  rules={[{ required: true, message: '请输入图案代码' }]}
                >
                  <Input placeholder="请输入图案代码" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="type"
                  label="类型"
                  rules={[{ required: true, message: '请选择类型' }]}
                >
                  <Select placeholder="请选择类型">
                    <Option value="graphic">图形</Option>
                    <Option value="pattern">图案</Option>
                    <Option value="logo">Logo</Option>
                    <Option value="text">文字</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="category"
                  label="分类"
                  rules={[{ required: true, message: '请输入分类' }]}
                >
                  <Input placeholder="请输入分类" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item
              name="description"
              label="描述"
            >
              <TextArea rows={4} placeholder="请输入描述" />
            </Form.Item>
            <Form.Item
              name="usage"
              label="用途"
            >
              <Select mode="tags" placeholder="请选择或输入用途">
                <Option value="胸贴">胸贴</Option>
                <Option value="领标">领标</Option>
                <Option value="洗水标">洗水标</Option>
                <Option value="袖标">袖标</Option>
                <Option value="口袋">口袋</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="restrictions"
              label="限制"
            >
              <Select mode="tags" placeholder="请选择或输入限制">
                <Option value="不可修改比例">不可修改比例</Option>
                <Option value="不可变色">不可变色</Option>
                <Option value="不可缩放">不可缩放</Option>
                <Option value="仅限单色">仅限单色</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="status"
              label="状态"
              initialValue="active"
            >
              <Select>
                <Option value="active">启用</Option>
                <Option value="inactive">禁用</Option>
              </Select>
            </Form.Item>
          </>
        );

      default:
        return null;
    }
  };

  // 获取当前表格数据
  const getCurrentTableData = () => {
    switch (activeTab) {
      case 'styles':
        return { data: styles, columns: styleColumns };
      case 'colorways':
        return { data: colorways, columns: colorwayColumns };
      case 'sizes':
        return { data: sizes, columns: sizeColumns };
      case 'fabrics':
        return { data: fabrics, columns: fabricColumns };
      case 'artworks':
        return { data: artworks, columns: artworkColumns };
      default:
        return { data: [], columns: [] };
    }
  };

  const { data: tableData, columns: tableColumns } = getCurrentTableData();

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>服饰Catalog管理</Title>
        <Text type="secondary">
          管理款式、颜色、尺码、面料、图案等SKU元数据，为工具和编辑器提供数据支持
        </Text>
      </div>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab={`款式 (${styles.length})`} key="styles" />
          <TabPane tab={`颜色 (${colorways.length})`} key="colorways" />
          <TabPane tab={`尺码 (${sizes.length})`} key="sizes" />
          <TabPane tab={`面料 (${fabrics.length})`} key="fabrics" />
          <TabPane tab={`图案 (${artworks.length})`} key="artworks" />
        </Tabs>

        <div style={{ marginTop: 16, marginBottom: 16 }}>
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              新增
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

        <Table<any>
          columns={tableColumns}
          dataSource={tableData}
          rowKey="id"
          loading={loading}
          pagination={{
            total: tableData.length,
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
        title={modalType === 'create' ? '新增' : '编辑'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={handleModalSubmit} loading={loading}>
            {modalType === 'create' ? '创建' : '更新'}
          </Button>
        ]}
        width={800}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          {renderFormContent()}
        </Form>
      </Modal>
    </div>
  );
}
