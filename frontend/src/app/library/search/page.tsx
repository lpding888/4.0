'use client';

/**
 * 资产搜索页面
 * 艹！这个页面支持文本、颜色、风格、图片四种搜索模式！
 *
 * @author 老王
 */

import React, { useState, useCallback } from 'react';
import {
  Card,
  Input,
  Select,
  Button,
  Space,
  Row,
  Col,
  Typography,
  Tag,
  Image,
  Empty,
  Spin,
  Upload,
  message,
  Tabs,
  Slider,
  ColorPicker,
  Badge,
  Statistic,
  Divider,
  Tooltip,
  Radio,
} from 'antd';
import {
  SearchOutlined,
  ClearOutlined,
  PictureOutlined,
  BgColorsOutlined,
  TagsOutlined,
  ThunderboltOutlined,
  UploadOutlined,
  FilterOutlined,
  StarOutlined,
  StarFilled,
  DownloadOutlined,
} from '@ant-design/icons';
import { vecClient, VecSearchRequest, VecSearchResult } from '@/lib/vec/client';
import type { Color } from 'antd/es/color-picker';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

/**
 * 搜索模式
 */
type SearchMode = 'text' | 'color' | 'style' | 'image' | 'hybrid';

/**
 * 风格标签
 */
const STYLE_TAGS = [
  '现代简约',
  '复古怀旧',
  '科技未来',
  '自然清新',
  '商务专业',
  '艺术创意',
  '温馨可爱',
  '炫酷动感',
  '优雅高端',
  '趣味幽默',
  '中国风',
  '日系',
  '欧美风',
  '扁平化',
  '3D立体',
  '手绘插画',
  '摄影写实',
  '抽象几何',
];

/**
 * 资源类型
 */
const RESOURCE_TYPES = [
  { label: '全部', value: 'all' },
  { label: '模板', value: 'template' },
  { label: '产品', value: 'product' },
  { label: 'Prompt', value: 'prompt' },
  { label: '图片', value: 'image' },
  { label: '素材', value: 'asset' },
];

/**
 * 资产搜索页面
 */
export default function LibrarySearchPage() {
  // 搜索状态
  const [searchMode, setSearchMode] = useState<SearchMode>('text');
  const [textQuery, setTextQuery] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>('#1890ff');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [resourceType, setResourceType] = useState<string>('all');
  const [minScore, setMinScore] = useState<number>(0.7);
  const [topK, setTopK] = useState<number>(20);

  // 结果状态
  const [results, setResults] = useState<VecSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [queryTime, setQueryTime] = useState<number>(0);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  /**
   * 执行搜索
   */
  const handleSearch = useCallback(async () => {
    if (!validateSearch()) {
      return;
    }

    setLoading(true);

    try {
      const startTime = Date.now();

      // 构建搜索请求
      const request: VecSearchRequest = {
        mode: searchMode,
        top_k: topK,
        min_score: minScore,
        include_metadata: true,
        filters:
          resourceType !== 'all'
            ? {
                resource_type: resourceType,
              }
            : undefined,
      };

      // 根据模式添加查询参数
      if (searchMode === 'text') {
        request.query = textQuery;
      } else if (searchMode === 'color') {
        request.color = selectedColor;
      } else if (searchMode === 'style') {
        request.style = selectedStyles.join(',');
      } else if (searchMode === 'image') {
        request.image_url = uploadedImage || undefined;
      } else if (searchMode === 'hybrid') {
        request.query = textQuery || undefined;
        request.color = selectedColor;
        request.style = selectedStyles.join(',') || undefined;
        request.image_url = uploadedImage || undefined;
      }

      const response = await vecClient.search(request);

      setResults(response.results);
      setQueryTime(Date.now() - startTime);

      console.log('[Search] 搜索完成:', response.results.length, '条结果, 耗时:', queryTime, 'ms');

      if (response.results.length === 0) {
        message.info('未找到匹配结果，请尝试调整搜索条件');
      }
    } catch (error: any) {
      console.error('[Search] 搜索失败:', error);
      message.error(`搜索失败: ${error.message}`);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchMode, textQuery, selectedColor, selectedStyles, uploadedImage, resourceType, topK, minScore]);

  /**
   * 验证搜索条件
   */
  const validateSearch = (): boolean => {
    if (searchMode === 'text' && !textQuery.trim()) {
      message.warning('请输入搜索关键词');
      return false;
    }

    if (searchMode === 'style' && selectedStyles.length === 0) {
      message.warning('请选择至少一个风格标签');
      return false;
    }

    if (searchMode === 'image' && !uploadedImage) {
      message.warning('请上传参考图片');
      return false;
    }

    if (searchMode === 'hybrid') {
      if (!textQuery && selectedStyles.length === 0 && !uploadedImage) {
        message.warning('请至少设置一个搜索条件');
        return false;
      }
    }

    return true;
  };

  /**
   * 清空搜索
   */
  const handleClear = () => {
    setTextQuery('');
    setSelectedStyles([]);
    setUploadedImage(null);
    setResults([]);
    setQueryTime(0);
  };

  /**
   * 上传图片
   */
  const handleUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage(e.target?.result as string);
      message.success('图片已上传');
    };
    reader.readAsDataURL(file);
    return false; // 阻止自动上传
  };

  /**
   * 切换收藏
   */
  const toggleFavorite = (id: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(id)) {
      newFavorites.delete(id);
    } else {
      newFavorites.add(id);
    }
    setFavorites(newFavorites);
  };

  /**
   * 渲染搜索控制栏
   */
  const renderSearchControls = () => {
    return (
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 搜索模式选择 */}
          <div>
            <Text strong style={{ marginRight: 16 }}>
              搜索模式:
            </Text>
            <Radio.Group value={searchMode} onChange={(e) => setSearchMode(e.target.value)}>
              <Radio.Button value="text">
                <SearchOutlined /> 文本搜索
              </Radio.Button>
              <Radio.Button value="color">
                <BgColorsOutlined /> 颜色搜索
              </Radio.Button>
              <Radio.Button value="style">
                <TagsOutlined /> 风格搜索
              </Radio.Button>
              <Radio.Button value="image">
                <PictureOutlined /> 图片搜索
              </Radio.Button>
              <Radio.Button value="hybrid">
                <ThunderboltOutlined /> 混合搜索
              </Radio.Button>
            </Radio.Group>
          </div>

          {/* 文本搜索 */}
          {(searchMode === 'text' || searchMode === 'hybrid') && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                关键词:
              </Text>
              <Input.Search
                placeholder="输入关键词搜索资产..."
                value={textQuery}
                onChange={(e) => setTextQuery(e.target.value)}
                onSearch={handleSearch}
                enterButton={<SearchOutlined />}
                size="large"
                allowClear
              />
            </div>
          )}

          {/* 颜色搜索 */}
          {(searchMode === 'color' || searchMode === 'hybrid') && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                主题颜色:
              </Text>
              <Space>
                <ColorPicker
                  value={selectedColor}
                  onChange={(color: Color) => setSelectedColor(color.toHexString())}
                  showText
                  size="large"
                />
                <Text type="secondary">选择资产的主题颜色</Text>
              </Space>
            </div>
          )}

          {/* 风格搜索 */}
          {(searchMode === 'style' || searchMode === 'hybrid') && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                风格标签:
              </Text>
              <Space size={[8, 8]} wrap>
                {STYLE_TAGS.map((style) => (
                  <Tag.CheckableTag
                    key={style}
                    checked={selectedStyles.includes(style)}
                    onChange={(checked) => {
                      if (checked) {
                        setSelectedStyles([...selectedStyles, style]);
                      } else {
                        setSelectedStyles(selectedStyles.filter((s) => s !== style));
                      }
                    }}
                    style={{
                      fontSize: 14,
                      padding: '4px 12px',
                      borderRadius: 16,
                    }}
                  >
                    {style}
                  </Tag.CheckableTag>
                ))}
              </Space>
            </div>
          )}

          {/* 图片搜索 */}
          {(searchMode === 'image' || searchMode === 'hybrid') && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                参考图片:
              </Text>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Upload
                  accept="image/*"
                  beforeUpload={handleUpload}
                  showUploadList={false}
                  maxCount={1}
                >
                  <Button icon={<UploadOutlined />}>上传参考图片</Button>
                </Upload>
                {uploadedImage && (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <Image
                      src={uploadedImage}
                      alt="参考图片"
                      width={200}
                      height={200}
                      style={{ objectFit: 'cover', borderRadius: 8 }}
                    />
                    <Button
                      danger
                      size="small"
                      onClick={() => setUploadedImage(null)}
                      style={{ position: 'absolute', top: 8, right: 8 }}
                    >
                      删除
                    </Button>
                  </div>
                )}
              </Space>
            </div>
          )}

          <Divider />

          {/* 高级筛选 */}
          <Row gutter={16}>
            <Col span={8}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                资源类型:
              </Text>
              <Select
                value={resourceType}
                onChange={setResourceType}
                style={{ width: '100%' }}
                options={RESOURCE_TYPES}
              />
            </Col>
            <Col span={8}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                最小相似度: {(minScore * 100).toFixed(0)}%
              </Text>
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={minScore}
                onChange={setMinScore}
                marks={{
                  0: '0%',
                  0.5: '50%',
                  1: '100%',
                }}
              />
            </Col>
            <Col span={8}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                返回结果数: {topK}
              </Text>
              <Slider
                min={5}
                max={100}
                step={5}
                value={topK}
                onChange={setTopK}
                marks={{
                  5: '5',
                  50: '50',
                  100: '100',
                }}
              />
            </Col>
          </Row>

          {/* 操作按钮 */}
          <Space>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} size="large">
              搜索
            </Button>
            <Button icon={<ClearOutlined />} onClick={handleClear}>
              清空
            </Button>
          </Space>
        </Space>
      </Card>
    );
  };

  /**
   * 渲染搜索结果
   */
  const renderSearchResults = () => {
    if (loading) {
      return (
        <Card>
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" tip="正在搜索..." />
          </div>
        </Card>
      );
    }

    if (results.length === 0 && queryTime === 0) {
      return (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="输入搜索条件开始搜索"
            style={{ padding: '60px 0' }}
          />
        </Card>
      );
    }

    if (results.length === 0 && queryTime > 0) {
      return (
        <Card>
          <Empty description="未找到匹配结果" style={{ padding: '60px 0' }}>
            <Button type="primary" onClick={handleClear}>
              重新搜索
            </Button>
          </Empty>
        </Card>
      );
    }

    return (
      <Card
        title={
          <Space>
            <Text strong>搜索结果</Text>
            <Badge count={results.length} showZero />
            <Tag color="blue">
              <ThunderboltOutlined /> {queryTime}ms
            </Tag>
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          {results.map((result) => (
            <Col key={result.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                cover={
                  result.metadata?.thumbnail ? (
                    <Image
                      src={result.metadata.thumbnail}
                      alt={result.metadata?.name || result.id}
                      height={200}
                      style={{ objectFit: 'cover' }}
                      preview={{
                        src: result.metadata.image_url || result.metadata.thumbnail,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        height: 200,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#f0f0f0',
                      }}
                    >
                      <PictureOutlined style={{ fontSize: 48, color: '#ccc' }} />
                    </div>
                  )
                }
                actions={[
                  <Tooltip title={favorites.has(result.id) ? '取消收藏' : '收藏'} key="favorite">
                    {favorites.has(result.id) ? (
                      <StarFilled
                        style={{ color: '#faad14' }}
                        onClick={() => toggleFavorite(result.id)}
                      />
                    ) : (
                      <StarOutlined onClick={() => toggleFavorite(result.id)} />
                    )}
                  </Tooltip>,
                  <Tooltip title="下载" key="download">
                    <DownloadOutlined />
                  </Tooltip>,
                ]}
              >
                <Card.Meta
                  title={
                    <Space direction="vertical" size={0} style={{ width: '100%' }}>
                      <Text strong ellipsis>
                        {result.metadata?.name || `资产 ${result.id.slice(0, 8)}`}
                      </Text>
                      <Space size={4}>
                        <Tag color="green">{(result.score * 100).toFixed(1)}%</Tag>
                        {result.metadata?.resource_type && (
                          <Tag>{result.metadata.resource_type}</Tag>
                        )}
                      </Space>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      {result.metadata?.description && (
                        <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ marginBottom: 0 }}>
                          {result.metadata.description}
                        </Paragraph>
                      )}
                      {result.metadata?.tags && (
                        <Space size={4} wrap>
                          {result.metadata.tags.slice(0, 3).map((tag: string) => (
                            <Tag key={tag} style={{ fontSize: 12 }}>
                              {tag}
                            </Tag>
                          ))}
                        </Space>
                      )}
                    </Space>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 页面标题 */}
        <div>
          <Title level={2}>
            <SearchOutlined /> 资产搜索
          </Title>
          <Text type="secondary">使用AI向量搜索快速找到匹配的资产</Text>
        </div>

        {/* 搜索控制栏 */}
        {renderSearchControls()}

        {/* 搜索结果 */}
        {renderSearchResults()}
      </Space>
    </div>
  );
}
