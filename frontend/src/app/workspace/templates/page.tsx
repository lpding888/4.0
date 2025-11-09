/**
 * PAGE-P0-TPL-007 模板中心页面
 * 艹，模板中心必须让用户能快速找到和使用模板！
 *
 * 功能清单：
 * 1. 模板分类展示与浏览
 * 2. 模板搜索与筛选
 * 3. 模板预览功能
 * 4. 模板使用/复制/编辑
 * 5. 自定义模板创建
 * 6. 模板收藏和管理
 * 7. 模板分享功能
 * 8. 模板版本管理
 *
 * @author 老王
 */

'use client';

import React, { useState } from 'react';
import {
  Button,
  Space,
  Tag,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  Card,
  Row,
  Col,
  Avatar,
  Tooltip,
  message,
  Divider,
  Rate,
  Dropdown,
  Spin,
  Empty,
  Pagination
} from 'antd';
import {
  AppstoreOutlined,
  FileTextOutlined,
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  StarOutlined,
  StarFilled,
  CopyOutlined,
  EyeOutlined,
  SortAscendingOutlined,
  HeartOutlined,
  HeartFilled,
  MoreOutlined,
  ThunderboltOutlined,
  BulbOutlined,
  CodeOutlined,
  PictureOutlined,
  FileMarkdownOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FilePdfOutlined
} from '@ant-design/icons';
import { DataTablePro, type DataTableColumn } from '@/components/base/DataTablePro';
import BaseCard from '@/components/base/BaseCard';
import ThemeSwitcher from '@/components/ThemeSwitcher';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// 模板类型枚举
enum TemplateType {
  DOCUMENT = 'document',
  CODE = 'code',
  PRESENTATION = 'presentation',
  FORM = 'form',
  EMAIL = 'email',
  REPORT = 'report',
  CONTRACT = 'contract',
  PROPOSAL = 'proposal'
}

// 模板分类枚举
enum TemplateCategory {
  BUSINESS = 'business',
  TECHNICAL = 'technical',
  CREATIVE = 'creative',
  EDUCATION = 'education',
  PERSONAL = 'personal',
  MARKETING = 'marketing'
}

// 模板复杂度
enum TemplateComplexity {
  BASIC = 'basic',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced'
}

// 模板接口定义
interface Template {
  id: string;
  name: string;
  description: string;
  type: TemplateType;
  category: TemplateCategory;
  complexity: TemplateComplexity;
  tags: string[];
  content: string;
  thumbnail?: string;
  preview?: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  rating: number;
  ratingCount: number;
  isPublic: boolean;
  isOfficial: boolean;
  isFavorite: boolean;
  version: string;
  variables?: TemplateVariable[];
  dependencies?: string[];
}

// 模板变量定义
interface TemplateVariable {
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea';
  label: string;
  required: boolean;
  defaultValue?: string;
  options?: string[];
  placeholder?: string;
}

// 模板表单数据
interface TemplateFormData {
  name: string;
  description: string;
  type: TemplateType;
  category: TemplateCategory;
  complexity: TemplateComplexity;
  tags: string[];
  content: string;
  isPublic: boolean;
  variables?: TemplateVariable[];
}

// 模拟模板数据
const mockTemplates: Template[] = [
  {
    id: 'tpl_001',
    name: '项目计划书模板',
    description: '专业的项目计划书模板，包含项目概述、目标、时间线、资源分配等完整内容。',
    type: TemplateType.DOCUMENT,
    category: TemplateCategory.BUSINESS,
    complexity: TemplateComplexity.INTERMEDIATE,
    tags: ['项目管理', '计划书', '商业'],
    content: '# 项目计划书\n\n## 项目概述\n\n{{projectName}} 是一个 {{projectType}} 项目...\n\n## 项目目标\n\n1. {{goal1}}\n2. {{goal2}}\n3. {{goal3}}\n\n## 时间线\n\n- 开始时间：{{startDate}}\n- 结束时间：{{endDate}}\n\n## 资源需求\n\n- 人力资源：{{teamSize}} 人\n- 预算：{{budget}}',
    thumbnail: 'https://via.placeholder.com/300x200/1890ff/ffffff?text=项目计划书',
    preview: '专业的项目计划书模板，帮助您快速创建完整的项目规划文档...',
    author: {
      id: 'user_001',
      name: '张经理',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=manager'
    },
    createdAt: '2024-10-15T00:00:00Z',
    updatedAt: '2025-11-01T10:30:00Z',
    usageCount: 156,
    rating: 4.8,
    ratingCount: 42,
    isPublic: true,
    isOfficial: true,
    isFavorite: false,
    version: '1.2.0',
    variables: [
      { name: 'projectName', type: 'text', label: '项目名称', required: true, placeholder: '请输入项目名称' },
      { name: 'projectType', type: 'select', label: '项目类型', required: true, options: ['软件开发', '市场营销', '产品设计', '其他'] },
      { name: 'goal1', type: 'text', label: '主要目标', required: true, placeholder: '请输入主要目标' },
      { name: 'goal2', type: 'text', label: '次要目标', required: false, placeholder: '请输入次要目标' },
      { name: 'goal3', type: 'text', label: '其他目标', required: false, placeholder: '请输入其他目标' },
      { name: 'startDate', type: 'date', label: '开始日期', required: true },
      { name: 'endDate', type: 'date', label: '结束日期', required: true },
      { name: 'teamSize', type: 'number', label: '团队规模', required: true, defaultValue: '5' },
      { name: 'budget', type: 'text', label: '项目预算', required: true, placeholder: '请输入预算金额' }
    ]
  },
  {
    id: 'tpl_002',
    name: '代码审查清单',
    description: '全面的代码审查清单，确保代码质量和规范。',
    type: TemplateType.CODE,
    category: TemplateCategory.TECHNICAL,
    complexity: TemplateComplexity.BASIC,
    tags: ['代码审查', '质量保证', '开发'],
    content: '# 代码审查清单\n\n## 基础检查\n\n- [ ] 代码遵循{{codingStandard}}\n- [ ] 函数/方法命名清晰\n- [ ] 变量命名有意义\n- [ ] 注释充分且准确\n\n## 安全检查\n\n- [ ] 输入验证\n- [ ] SQL注入防护\n- [ ] XSS防护\n- [ ] 权限检查\n\n## 性能检查\n\n- [ ] 算法复杂度合理\n- [ ] 数据库查询优化\n- [ ] 缓存策略适当\n\n## 测试检查\n\n- [ ] 单元测试覆盖\n- [ ] 集成测试通过\n- [ ] 边界条件测试',
    thumbnail: 'https://via.placeholder.com/300x200/52c41a/ffffff?text=代码审查',
    preview: '全面的代码审查清单，帮助开发团队保证代码质量...',
    author: {
      id: 'user_002',
      name: '李工程师',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=developer'
    },
    createdAt: '2024-09-20T00:00:00Z',
    updatedAt: '2025-10-28T16:45:00Z',
    usageCount: 89,
    rating: 4.6,
    ratingCount: 28,
    isPublic: true,
    isOfficial: false,
    isFavorite: true,
    version: '1.1.0',
    variables: [
      { name: 'codingStandard', type: 'select', label: '编码规范', required: true, options: ['ESLint', 'Prettier', 'Google Style Guide', 'Airbnb Style Guide'] }
    ]
  },
  {
    id: 'tpl_003',
    name: '会议纪要模板',
    description: '标准的会议纪要模板，包含参会人员、议题讨论、行动项等。',
    type: TemplateType.DOCUMENT,
    category: TemplateCategory.BUSINESS,
    complexity: TemplateComplexity.BASIC,
    tags: ['会议', '纪要', '办公'],
    content: '# 会议纪要\n\n**会议主题：** {{meetingTitle}}\n**日期时间：** {{meetingDate}} {{meetingTime}}\n**会议地点：** {{meetingLocation}}\n**主持人：** {{meetingHost}}\n**记录人：** {{meetingRecorder}}\n\n## 参会人员\n\n{{attendees}}\n\n## 会议议题\n\n### 1. {{topic1}}\n- 讨论内容：\n- 结论：\n- 负责人：\n- 完成时间：\n\n### 2. {{topic2}}\n- 讨论内容：\n- 结论：\n- 负责人：\n- 完成时间：\n\n## 行动项\n\n| 事项 | 负责人 | 完成时间 | 状态 |\n|------|--------|----------|------|\n| {{action1}} | {{action1Owner}} | {{action1Deadline}} | 待完成 |\n| {{action2}} | {{action2Owner}} | {{action2Deadline}} | 待完成 |\n\n## 下次会议\n\n**时间：** {{nextMeetingDate}}\n**地点：** {{nextMeetingLocation}}',
    thumbnail: 'https://via.placeholder.com/300x200/faad14/ffffff?text=会议纪要',
    preview: '标准的会议纪要模板，帮助您高效记录和整理会议内容...',
    author: {
      id: 'user_003',
      name: '王助理',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=assistant'
    },
    createdAt: '2024-08-10T00:00:00Z',
    updatedAt: '2025-10-15T14:20:00Z',
    usageCount: 234,
    rating: 4.5,
    ratingCount: 67,
    isPublic: true,
    isOfficial: true,
    isFavorite: false,
    version: '1.0.0',
    variables: [
      { name: 'meetingTitle', type: 'text', label: '会议主题', required: true, placeholder: '请输入会议主题' },
      { name: 'meetingDate', type: 'date', label: '会议日期', required: true },
      { name: 'meetingTime', type: 'text', label: '会议时间', required: true, placeholder: '14:00-16:00' },
      { name: 'meetingLocation', type: 'text', label: '会议地点', required: true, placeholder: '会议室A' },
      { name: 'meetingHost', type: 'text', label: '主持人', required: true, placeholder: '请输入主持人姓名' },
      { name: 'meetingRecorder', type: 'text', label: '记录人', required: true, placeholder: '请输入记录人姓名' },
      { name: 'attendees', type: 'textarea', label: '参会人员', required: true, placeholder: '张三、李四、王五...' },
      { name: 'topic1', type: 'text', label: '议题1', required: true, placeholder: '请输入第一个议题' },
      { name: 'topic2', type: 'text', label: '议题2', required: false, placeholder: '请输入第二个议题' },
      { name: 'action1', type: 'text', label: '行动项1', required: false, placeholder: '请输入第一个行动项' },
      { name: 'action1Owner', type: 'text', label: '负责人1', required: false, placeholder: '请输入负责人' },
      { name: 'action1Deadline', type: 'date', label: '完成时间1', required: false },
      { name: 'action2', type: 'text', label: '行动项2', required: false, placeholder: '请输入第二个行动项' },
      { name: 'action2Owner', type: 'text', label: '负责人2', required: false, placeholder: '请输入负责人' },
      { name: 'action2Deadline', type: 'date', label: '完成时间2', required: false },
      { name: 'nextMeetingDate', type: 'date', label: '下次会议日期', required: false },
      { name: 'nextMeetingLocation', type: 'text', label: '下次会议地点', required: false, placeholder: '会议室B' }
    ]
  }
];

export default function TemplateCenter() {
  const [templates, setTemplates] = useState<Template[]>(mockTemplates);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchValue, setSearchValue] = useState('');
  const [sortBy, setSortBy] = useState<string>('popular');
  const [showFavorites, setShowFavorites] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [useModalVisible, setUseModalVisible] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null);
  const [form] = Form.useForm();
  const [useForm] = Form.useForm();

  // 配置信息
  const typeConfig = {
    [TemplateType.DOCUMENT]: { label: '文档', icon: <FileTextOutlined />, color: 'blue' },
    [TemplateType.CODE]: { label: '代码', icon: <CodeOutlined />, color: 'green' },
    [TemplateType.PRESENTATION]: { label: '演示', icon: <PictureOutlined />, color: 'orange' },
    [TemplateType.FORM]: { label: '表单', icon: <FileWordOutlined />, color: 'purple' },
    [TemplateType.EMAIL]: { label: '邮件', icon: <FileMarkdownOutlined />, color: 'cyan' },
    [TemplateType.REPORT]: { label: '报告', icon: <FileExcelOutlined />, color: 'red' },
    [TemplateType.CONTRACT]: { label: '合同', icon: <FilePdfOutlined />, color: 'magenta' },
    [TemplateType.PROPOSAL]: { label: '提案', icon: <BulbOutlined />, color: 'gold' }
  };

  const categoryConfig = {
    [TemplateCategory.BUSINESS]: { label: '商务', color: 'blue' },
    [TemplateCategory.TECHNICAL]: { label: '技术', color: 'green' },
    [TemplateCategory.CREATIVE]: { label: '创意', color: 'orange' },
    [TemplateCategory.EDUCATION]: { label: '教育', color: 'purple' },
    [TemplateCategory.PERSONAL]: { label: '个人', color: 'cyan' },
    [TemplateCategory.MARKETING]: { label: '营销', color: 'red' }
  };

  const complexityConfig = {
    [TemplateComplexity.BASIC]: { label: '基础', color: 'green' },
    [TemplateComplexity.INTERMEDIATE]: { label: '中级', color: 'orange' },
    [TemplateComplexity.ADVANCED]: { label: '高级', color: 'red' }
  };

  // 过滤和排序模板
  const getFilteredTemplates = () => {
    let filtered = templates;

    // 搜索过滤
    if (searchValue) {
      const searchLower = searchValue.toLowerCase();
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(searchLower) ||
        template.description.toLowerCase().includes(searchLower) ||
        template.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // 分类过滤
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(template => template.category === selectedCategory);
    }

    // 类型过滤
    if (selectedType !== 'all') {
      filtered = filtered.filter(template => template.type === selectedType);
    }

    // 收藏过滤
    if (showFavorites) {
      filtered = filtered.filter(template => template.isFavorite);
    }

    // 排序
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return b.usageCount - a.usageCount;
        case 'rating':
          return b.rating - a.rating;
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return filtered;
  };

  // 分页数据
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;
  const filteredTemplates = getFilteredTemplates();
  const paginatedTemplates = filteredTemplates.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // 切换收藏状态
  const handleToggleFavorite = (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedTemplates = templates.map(template =>
      template.id === templateId
        ? { ...template, isFavorite: !template.isFavorite }
        : template
    );
    setTemplates(updatedTemplates);

    const template = templates.find(t => t.id === templateId);
    if (template) {
      message.success(template.isFavorite ? '已取消收藏' : '已添加到收藏');
    }
  };

  // 使用模板
  const handleUseTemplate = (template: Template) => {
    setCurrentTemplate(template);
    setUseModalVisible(true);
    // 预填充变量默认值
    const initialValues: Record<string, any> = {};
    template.variables?.forEach(variable => {
      if (variable.defaultValue) {
        initialValues[variable.name] = variable.defaultValue;
      }
    });
    useForm.setFieldsValue(initialValues);
  };

  // 预览模板
  const handlePreviewTemplate = (template: Template) => {
    setCurrentTemplate(template);
    setPreviewModalVisible(true);
  };

  // 复制模板
  const handleCopyTemplate = (template: Template) => {
    setCurrentTemplate(template);
    form.setFieldsValue({
      ...template,
      name: `${template.name} (副本)`,
      isPublic: false
    });
    setCreateModalVisible(true);
  };

  // 创建模板
  const handleCreateTemplate = () => {
    setCurrentTemplate(null);
    form.resetFields();
    setCreateModalVisible(true);
  };

  // 保存模板
  const handleSaveTemplate = async (values: TemplateFormData) => {
    try {
      if (currentTemplate) {
        // 更新模板
        const updatedTemplates = templates.map(template =>
          template.id === currentTemplate.id
            ? {
                ...template,
                ...values,
                updatedAt: new Date().toISOString(),
                version: getNextVersion(template.version)
              }
            : template
        );
        setTemplates(updatedTemplates);
        message.success('模板已更新');
      } else {
        // 创建新模板
        const newTemplate: Template = {
          id: `tpl_${Date.now()}`,
          ...values,
          author: {
            id: 'current_user',
            name: '当前用户',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=currentuser'
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          usageCount: 0,
          rating: 0,
          ratingCount: 0,
          isFavorite: false,
          isOfficial: false,
          version: '1.0.0'
        };
        setTemplates([...templates, newTemplate]);
        message.success('模板创建成功');
      }
      setCreateModalVisible(false);
      form.resetFields();
    } catch (error) {
      message.error('操作失败，请重试');
    }
  };

  // 删除模板
  const handleDeleteTemplate = (templateId: string) => {
    const updatedTemplates = templates.filter(template => template.id !== templateId);
    setTemplates(updatedTemplates);
    message.success('模板已删除');
  };

  // 使用模板生成内容
  const handleGenerateContent = (values: Record<string, any>) => {
    if (!currentTemplate) return;

    let content = currentTemplate.content;

    // 替换变量
    currentTemplate.variables?.forEach(variable => {
      const value = values[variable.name] || '';
      const regex = new RegExp(`{{${variable.name}}}`, 'g');
      content = content.replace(regex, value);
    });

    // 这里可以打开编辑器或显示生成的内容
    message.success('内容生成成功');
    setUseModalVisible(false);

    // 可以进一步处理生成的内容，比如打开编辑器
    console.log('Generated content:', content);
  };

  // 获取下一个版本号
  const getNextVersion = (currentVersion: string): string => {
    const parts = currentVersion.split('.');
    const patch = parseInt(parts[2] || '0') + 1;
    return `${parts[0]}.${parts[1]}.${patch}`;
  };

  const stats = {
    totalTemplates: templates.length,
    officialTemplates: templates.filter(t => t.isOfficial).length,
    favoriteTemplates: templates.filter(t => t.isFavorite).length,
    totalUsage: templates.reduce((sum, t) => sum + t.usageCount, 0)
  };

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* 页面标题 */}
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>模板中心</Title>
            <Text type="secondary">发现、创建和使用各种专业模板</Text>
          </div>
          <ThemeSwitcher mode="segmented" size="middle" />
        </div>

        {/* 统计卡片 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <BaseCard size="small" stats={[
              { label: '总模板数', value: stats.totalTemplates, color: '#1890ff' }
            ]}>
              <AppstoreOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            </BaseCard>
          </Col>
          <Col span={6}>
            <BaseCard size="small" stats={[
              { label: '官方模板', value: stats.officialTemplates, color: '#52c41a' }
            ]}>
              <StarFilled style={{ fontSize: 24, color: '#52c41a' }} />
            </BaseCard>
          </Col>
          <Col span={6}>
            <BaseCard size="small" stats={[
              { label: '我的收藏', value: stats.favoriteTemplates, color: '#faad14' }
            ]}>
              <HeartFilled style={{ fontSize: 24, color: '#faad14' }} />
            </BaseCard>
          </Col>
          <Col span={6}>
            <BaseCard size="small" stats={[
              { label: '总使用次数', value: stats.totalUsage, color: '#13c2c2' }
            ]}>
              <ThunderboltOutlined style={{ fontSize: 24, color: '#13c2c2' }} />
            </BaseCard>
          </Col>
        </Row>

        {/* 主要内容区域 */}
        <BaseCard>
          {/* 工具栏 */}
          <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
            <Col flex="auto">
              <Space size="middle" wrap>
                {/* 搜索框 */}
                <Input.Search
                  placeholder="搜索模板名称、描述或标签..."
                  allowClear
                  style={{ width: 300 }}
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                />

                {/* 分类筛选 */}
                <Select
                  value={selectedCategory}
                  onChange={setSelectedCategory}
                  style={{ width: 120 }}
                  placeholder="分类"
                >
                  <Select.Option value="all">全部分类</Select.Option>
                  {Object.entries(categoryConfig).map(([key, config]) => (
                    <Select.Option key={key} value={key}>
                      {config.label}
                    </Select.Option>
                  ))}
                </Select>

                {/* 类型筛选 */}
                <Select
                  value={selectedType}
                  onChange={setSelectedType}
                  style={{ width: 120 }}
                  placeholder="类型"
                >
                  <Select.Option value="all">全部类型</Select.Option>
                  {Object.entries(typeConfig).map(([key, config]) => (
                    <Select.Option key={key} value={key}>
                      {config.label}
                    </Select.Option>
                  ))}
                </Select>

                {/* 排序 */}
                <Select
                  value={sortBy}
                  onChange={setSortBy}
                  style={{ width: 120 }}
                  suffixIcon={<SortAscendingOutlined />}
                >
                  <Select.Option value="popular">最受欢迎</Select.Option>
                  <Select.Option value="rating">评分最高</Select.Option>
                  <Select.Option value="newest">最新发布</Select.Option>
                  <Select.Option value="name">按名称</Select.Option>
                </Select>

                {/* 收藏筛选 */}
                <Button
                  type={showFavorites ? 'primary' : 'default'}
                  icon={showFavorites ? <HeartFilled /> : <HeartOutlined />}
                  onClick={() => setShowFavorites(!showFavorites)}
                >
                  {showFavorites ? '全部模板' : '我的收藏'}
                </Button>
              </Space>
            </Col>

            <Col flex="none">
              <Space>
                {/* 视图切换 */}
                <Button.Group>
                  <Button
                    type={viewMode === 'grid' ? 'primary' : 'default'}
                    icon={<AppstoreOutlined />}
                    onClick={() => setViewMode('grid')}
                  />
                  <Button
                    type={viewMode === 'list' ? 'primary' : 'default'}
                    icon={<FileTextOutlined />}
                    onClick={() => setViewMode('list')}
                  />
                </Button.Group>

                {/* 创建模板 */}
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateTemplate}>
                  创建模板
                </Button>
              </Space>
            </Col>
          </Row>

          {/* 模板展示区域 */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '100px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">加载模板中...</Text>
              </div>
            </div>
          ) : paginatedTemplates.length === 0 ? (
            <Empty
              description="暂无模板"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{ padding: '100px 0' }}
            >
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateTemplate}>
                创建第一个模板
              </Button>
            </Empty>
          ) : viewMode === 'grid' ? (
            <Row gutter={[16, 16]}>
              {paginatedTemplates.map(template => (
                <Col key={template.id} xs={24} sm={12} lg={8} xl={6}>
                  <Card
                    hoverable
                    cover={
                      <div
                        style={{
                          height: 160,
                          background: `linear-gradient(135deg, ${typeConfig[template.type].color} 0%, ${typeConfig[template.type].color}dd 100%)`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: 48
                        }}
                      >
                        {typeConfig[template.type].icon}
                      </div>
                    }
                    actions={[
                      <Tooltip title="预览">
                        <EyeOutlined onClick={() => handlePreviewTemplate(template)} />
                      </Tooltip>,
                      <Tooltip title="使用">
                        <ThunderboltOutlined onClick={() => handleUseTemplate(template)} />
                      </Tooltip>,
                      <Tooltip title="收藏">
                        {template.isFavorite ? (
                          <HeartFilled
                            style={{ color: '#ff4d4f' }}
                            onClick={(e) => handleToggleFavorite(template.id, e)}
                          />
                        ) : (
                          <HeartOutlined onClick={(e) => handleToggleFavorite(template.id, e)} />
                        )}
                      </Tooltip>,
                      <Dropdown
                        overlay={
                          <div style={{ background: 'white', borderRadius: 6, boxShadow: '0 3px 6px -4px rgba(0,0,0,.12)' }}>
                            <div
                              style={{ padding: '8px 12px', cursor: 'pointer' }}
                              onClick={() => handleCopyTemplate(template)}
                            >
                              <CopyOutlined style={{ marginRight: 8 }} />
                              复制模板
                            </div>
                            {!template.isOfficial && (
                              <div
                                style={{ padding: '8px 12px', cursor: 'pointer', color: '#ff4d4f' }}
                                onClick={() => handleDeleteTemplate(template.id)}
                              >
                                <DeleteOutlined style={{ marginRight: 8 }} />
                                删除模板
                              </div>
                            )}
                          </div>
                        }
                        trigger={['click']}
                      >
                        <MoreOutlined />
                      </Dropdown>
                    ]}
                  >
                    <Card.Meta
                      title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Text strong style={{ flex: 1 }}>{template.name}</Text>
                          {template.isOfficial && (
                            <Tag color="gold">官方</Tag>
                          )}
                        </div>
                      }
                      description={
                        <div>
                          <Paragraph
                            ellipsis={{ rows: 2 }}
                            style={{ marginBottom: 8, height: 40 }}
                          >
                            {template.description}
                          </Paragraph>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <Tag color={categoryConfig[template.category].color}>
                              {categoryConfig[template.category].label}
                            </Tag>
                            <Tag color={complexityConfig[template.complexity].color}>
                              {complexityConfig[template.complexity].label}
                            </Tag>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Space size="small">
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <StarFilled style={{ color: '#faad14', fontSize: 12 }} />
                                <Text style={{ fontSize: 12 }}>{template.rating}</Text>
                              </div>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {template.usageCount} 次使用
                              </Text>
                            </Space>
                            <Avatar size="small" src={template.author.avatar} />
                          </div>
                        </div>
                      }
                    />
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <DataTablePro
              columns={[
                {
                  key: 'name',
                  title: '模板名称',
                  dataIndex: 'name',
                  render: (_, record) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          background: typeConfig[record.type].color,
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white'
                        }}
                      >
                        {typeConfig[record.type].icon}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500, marginBottom: 4 }}>
                          {record.name}
                          {record.isOfficial && (
                            <Tag color="gold" style={{ marginLeft: 8 }}>官方</Tag>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: '#666' }}>
                          {record.description}
                        </div>
                      </div>
                    </div>
                  )
                },
                {
                  key: 'category',
                  title: '分类',
                  dataIndex: 'category',
                  width: 100,
                  render: (category: TemplateCategory) => (
                    <Tag color={categoryConfig[category].color}>
                      {categoryConfig[category].label}
                    </Tag>
                  )
                },
                {
                  key: 'complexity',
                  title: '复杂度',
                  dataIndex: 'complexity',
                  width: 100,
                  render: (complexity: TemplateComplexity) => (
                    <Tag color={complexityConfig[complexity].color}>
                      {complexityConfig[complexity].label}
                    </Tag>
                  )
                },
                {
                  key: 'rating',
                  title: '评分',
                  dataIndex: 'rating',
                  width: 120,
                  render: (rating: number, record) => (
                    <div>
                      <Rate disabled value={rating} style={{ fontSize: 14 }} />
                      <div style={{ fontSize: 12, color: '#666' }}>
                        {rating} ({record.ratingCount})
                      </div>
                    </div>
                  )
                },
                {
                  key: 'usageCount',
                  title: '使用次数',
                  dataIndex: 'usageCount',
                  width: 100,
                  sorter: true
                },
                {
                  key: 'actions',
                  title: '操作',
                  width: 180,
                  render: (_, record) => (
                    <Space size="small">
                      <Tooltip title="预览">
                        <Button
                          type="text"
                          size="small"
                          icon={<EyeOutlined />}
                          onClick={() => handlePreviewTemplate(record)}
                        />
                      </Tooltip>
                      <Tooltip title="使用">
                        <Button
                          type="text"
                          size="small"
                          icon={<ThunderboltOutlined />}
                          onClick={() => handleUseTemplate(record)}
                        />
                      </Tooltip>
                      <Tooltip title={record.isFavorite ? '取消收藏' : '收藏'}>
                        <Button
                          type="text"
                          size="small"
                          icon={record.isFavorite ? <HeartFilled style={{ color: '#ff4d4f' }} /> : <HeartOutlined />}
                          onClick={(e) => handleToggleFavorite(record.id, e)}
                        />
                      </Tooltip>
                      <Tooltip title="更多">
                        <Dropdown
                          overlay={
                            <div style={{ background: 'white', borderRadius: 6, boxShadow: '0 3px 6px -4px rgba(0,0,0,.12)' }}>
                              <div
                                style={{ padding: '8px 12px', cursor: 'pointer' }}
                                onClick={() => handleCopyTemplate(record)}
                              >
                                <CopyOutlined style={{ marginRight: 8 }} />
                                复制模板
                              </div>
                              {!record.isOfficial && (
                                <div
                                  style={{ padding: '8px 12px', cursor: 'pointer', color: '#ff4d4f' }}
                                  onClick={() => handleDeleteTemplate(record.id)}
                                >
                                  <DeleteOutlined style={{ marginRight: 8 }} />
                                  删除模板
                                </div>
                              )}
                            </div>
                          }
                          trigger={['click']}
                        >
                          <Button type="text" size="small" icon={<MoreOutlined />} />
                        </Dropdown>
                      </Tooltip>
                    </Space>
                  )
                }
              ]}
              dataSource={paginatedTemplates}
              pagination={{
                current: currentPage,
                pageSize,
                total: filteredTemplates.length,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: true,
                onChange: setCurrentPage
              }}
            />
          )}

          {/* 分页 */}
          {viewMode === 'grid' && filteredTemplates.length > pageSize && (
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={filteredTemplates.length}
                showSizeChanger
                showQuickJumper
                showTotal={(total) => `共 ${total} 个模板`}
                onChange={setCurrentPage}
              />
            </div>
          )}
        </BaseCard>

        {/* 创建/编辑模板模态框 */}
        <Modal
          title={currentTemplate ? '编辑模板' : '创建模板'}
          open={createModalVisible}
          onCancel={() => setCreateModalVisible(false)}
          footer={null}
          width={900}
          destroyOnClose
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSaveTemplate}
            initialValues={{
              type: TemplateType.DOCUMENT,
              category: TemplateCategory.BUSINESS,
              complexity: TemplateComplexity.BASIC,
              tags: [],
              isPublic: false
            }}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="name"
                  label="模板名称"
                  rules={[{ required: true, message: '请输入模板名称' }]}
                >
                  <Input placeholder="请输入模板名称" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="type"
                  label="模板类型"
                  rules={[{ required: true, message: '请选择模板类型' }]}
                >
                  <Select placeholder="请选择模板类型">
                    {Object.entries(typeConfig).map(([key, config]) => (
                      <Select.Option key={key} value={key}>
                        {config.icon} {config.label}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="category"
                  label="模板分类"
                  rules={[{ required: true, message: '请选择模板分类' }]}
                >
                  <Select placeholder="请选择模板分类">
                    {Object.entries(categoryConfig).map(([key, config]) => (
                      <Select.Option key={key} value={key}>
                        {config.label}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="complexity"
                  label="复杂度"
                  rules={[{ required: true, message: '请选择复杂度' }]}
                >
                  <Select placeholder="请选择复杂度">
                    {Object.entries(complexityConfig).map(([key, config]) => (
                      <Select.Option key={key} value={key}>
                        {config.label}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="description"
              label="模板描述"
              rules={[{ required: true, message: '请输入模板描述' }]}
            >
              <TextArea rows={3} placeholder="请描述模板的用途和特点" />
            </Form.Item>

            <Form.Item
              name="content"
              label="模板内容"
              rules={[{ required: true, message: '请输入模板内容' }]}
            >
              <TextArea
                rows={12}
                placeholder="请输入模板内容，可以使用 {{变量名}} 的格式定义变量"
              />
            </Form.Item>

            <Form.Item
              name="tags"
              label="标签"
            >
              <Select
                mode="tags"
                placeholder="请输入标签，按回车添加"
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Form.Item
              name="isPublic"
              label="公开设置"
              valuePropName="checked"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" />
                <Text>公开此模板（其他用户可以使用）</Text>
              </div>
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setCreateModalVisible(false)}>
                  取消
                </Button>
                <Button type="primary" htmlType="submit">
                  {currentTemplate ? '更新' : '创建'}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* 预览模板模态框 */}
        <Modal
          title={`预览模板 - ${currentTemplate?.name}`}
          open={previewModalVisible}
          onCancel={() => setPreviewModalVisible(false)}
          footer={[
            <Button key="use" type="primary" onClick={() => {
              setPreviewModalVisible(false);
              if (currentTemplate) handleUseTemplate(currentTemplate);
            }}>
              使用模板
            </Button>,
            <Button key="close" onClick={() => setPreviewModalVisible(false)}>
              关闭
            </Button>
          ]}
          width={1000}
        >
          {currentTemplate && (
            <div>
              <Row gutter={24} style={{ marginBottom: 16 }}>
                <Col span={6}>
                  <div>
                    <Text strong>模板类型：</Text>
                    <Tag color={typeConfig[currentTemplate.type].color} style={{ marginLeft: 8 }}>
                      {typeConfig[currentTemplate.type].icon} {typeConfig[currentTemplate.type].label}
                    </Tag>
                  </div>
                </Col>
                <Col span={6}>
                  <div>
                    <Text strong>分类：</Text>
                    <Tag color={categoryConfig[currentTemplate.category].color} style={{ marginLeft: 8 }}>
                      {categoryConfig[currentTemplate.category].label}
                    </Tag>
                  </div>
                </Col>
                <Col span={6}>
                  <div>
                    <Text strong>复杂度：</Text>
                    <Tag color={complexityConfig[currentTemplate.complexity].color} style={{ marginLeft: 8 }}>
                      {complexityConfig[currentTemplate.complexity].label}
                    </Tag>
                  </div>
                </Col>
                <Col span={6}>
                  <div>
                    <Text strong>版本：</Text>
                    <Text style={{ marginLeft: 8 }}>{currentTemplate.version}</Text>
                  </div>
                </Col>
              </Row>

              <Divider />

              <div style={{ marginBottom: 16 }}>
                <Text strong>描述：</Text>
                <Paragraph style={{ marginTop: 8 }}>{currentTemplate.description}</Paragraph>
              </div>

              {currentTemplate.tags.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <Text strong>标签：</Text>
                  <div style={{ marginTop: 8 }}>
                    <Space wrap>
                      {currentTemplate.tags.map(tag => (
                        <Tag key={tag} color="blue">
                          {tag}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                </div>
              )}

              {currentTemplate.variables && currentTemplate.variables.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <Text strong>模板变量：</Text>
                  <div style={{ marginTop: 8 }}>
                    <Row gutter={[16, 8]}>
                      {currentTemplate.variables.map(variable => (
                        <Col key={variable.name} span={12}>
                          <div style={{ padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
                            <div style={{ fontWeight: 500, marginBottom: 4 }}>
                              {variable.label} ({variable.name})
                              {variable.required && <Text type="danger"> *</Text>}
                            </div>
                            <div style={{ fontSize: 12, color: '#666' }}>
                              类型：{variable.type}
                              {variable.defaultValue && ` | 默认值：${variable.defaultValue}`}
                            </div>
                          </div>
                        </Col>
                      ))}
                    </Row>
                  </div>
                </div>
              )}

              <div>
                <Text strong>模板内容预览：</Text>
                <div style={{ marginTop: 8, padding: 16, background: '#fafafa', borderRadius: 6, maxHeight: 400, overflow: 'auto' }}>
                  <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>
                    {currentTemplate.content}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </Modal>

        {/* 使用模板模态框 */}
        <Modal
          title={`使用模板 - ${currentTemplate?.name}`}
          open={useModalVisible}
          onCancel={() => setUseModalVisible(false)}
          footer={null}
          width={800}
        >
          {currentTemplate && (
            <Form
              form={useForm}
              layout="vertical"
              onFinish={handleGenerateContent}
            >
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary">
                  请填写以下变量来生成内容：
                </Text>
              </div>

              <Row gutter={[16, 0]}>
                {currentTemplate.variables?.map(variable => (
                  <Col key={variable.name} span={12} style={{ marginBottom: 16 }}>
                    <Form.Item
                      name={variable.name}
                      label={
                        <span>
                          {variable.label}
                          {variable.required && <Text type="danger"> *</Text>}
                        </span>
                      }
                      rules={variable.required ? [{ required: true, message: `请输入${variable.label}` }] : []}
                    >
                      {variable.type === 'textarea' ? (
                        <TextArea
                          placeholder={variable.placeholder || `请输入${variable.label}`}
                          rows={3}
                        />
                      ) : variable.type === 'select' ? (
                        <Select placeholder={`请选择${variable.label}`}>
                          {variable.options?.map(option => (
                            <Select.Option key={option} value={option}>
                              {option}
                            </Select.Option>
                          ))}
                        </Select>
                      ) : (
                        <Input
                          type={variable.type}
                          placeholder={variable.placeholder || `请输入${variable.label}`}
                        />
                      )}
                    </Form.Item>
                  </Col>
                ))}
              </Row>

              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Space>
                  <Button onClick={() => setUseModalVisible(false)}>
                    取消
                  </Button>
                  <Button type="primary" htmlType="submit" icon={<ThunderboltOutlined />}>
                    生成内容
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          )}
        </Modal>
      </div>
    </div>
  );
}
