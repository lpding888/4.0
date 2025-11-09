'use client';

/**
 * 个性化推荐演示页面
 * 艹！这个页面演示推荐SDK的各种功能！
 *
 * @author 老王
 */

import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Space,
  Typography,
  Divider,
  Select,
  Tag,
  Badge,
  Alert,
  Statistic,
  List,
  Tooltip,
} from 'antd';
import {
  ThunderboltOutlined,
  ReloadOutlined,
  EyeOutlined,
  AimOutlined,
  RocketOutlined,
  HeartOutlined,
  StarOutlined,
  TrophyOutlined,
  FireOutlined,
} from '@ant-design/icons';
import { useReco, recoClient, type RecoStrategy } from '@/lib/reco/client';

const { Title, Text, Paragraph } = Typography;

/**
 * 推荐演示页面
 */
export default function RecoDemoPage() {
  const [strategy, setStrategy] = useState<RecoStrategy>('personalized');
  const [stats, setStats] = useState<any>(null);

  // 使用推荐Hook
  const { items, loading, sessionId, reload, trackClick, trackGenerate } = useReco('template', {
    strategy,
    limit: 6,
  });

  /**
   * 加载统计信息
   */
  const loadStats = async () => {
    try {
      const response = await fetch('/api/reco/stats');
      if (!response.ok) throw new Error('获取统计失败');

      const data = await response.json();
      setStats(data.stats);
    } catch (error) {
      console.error('[Reco] 获取统计失败:', error);
    }
  };

  React.useEffect(() => {
    loadStats();
  }, []);

  /**
   * 处理模板点击
   */
  const handleTemplateClick = (item: any, index: number) => {
    trackClick(item.id, item.type, index);
    console.log('点击模板:', item.metadata.name);
  };

  /**
   * 处理生成
   */
  const handleGenerate = (item: any, index: number) => {
    trackGenerate(item.id, item.type, index);
    console.log('生成:', item.metadata.name);
  };

  /**
   * 处理点赞
   */
  const handleLike = (item: any, index: number) => {
    recoClient.trackLike({
      scene: 'template',
      item_id: item.id,
      item_type: item.type,
      session_id: sessionId,
      position: index,
    });
    console.log('点赞:', item.metadata.name);
  };

  /**
   * 策略图标
   */
  const getStrategyIcon = (strat: RecoStrategy) => {
    switch (strat) {
      case 'personalized':
        return <StarOutlined />;
      case 'popular':
        return <TrophyOutlined />;
      case 'trending':
        return <FireOutlined />;
      case 'embedding':
        return <ThunderboltOutlined />;
      case 'collaborative':
        return <HeartOutlined />;
      default:
        return <StarOutlined />;
    }
  };

  /**
   * 策略说明
   */
  const getStrategyDescription = (strat: RecoStrategy) => {
    switch (strat) {
      case 'personalized':
        return '综合用户行为、兴趣标签、协同过滤的个性化推荐';
      case 'popular':
        return '基于热度和人气的推荐，展示最受欢迎的内容';
      case 'trending':
        return '基于趋势上升的推荐，展示最近热门的内容';
      case 'embedding':
        return '基于向量相似度的推荐，展示风格相似的内容';
      case 'collaborative':
        return '基于协同过滤的推荐，展示相似用户喜欢的内容';
      default:
        return '';
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <Card>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2}>
            <ThunderboltOutlined style={{ marginRight: 8 }} />
            个性化推荐演示
          </Title>
          <Paragraph type="secondary">
            演示推荐SDK的多种推荐策略和行为追踪
          </Paragraph>
        </div>

        {/* SDK统计 */}
        <Alert
          message="SDK 状态"
          description={
            <div>
              <Text>
                队列大小: <Text strong>{recoClient.getStats().queue_size}</Text> |
                缓存大小: <Text strong>{recoClient.getStats().cache_size}</Text> |
                会话ID: <Text code>{sessionId}</Text>
              </Text>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        {/* 全局统计 */}
        {stats && (
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={6}>
              <Card size="small">
                <Statistic
                  title="总请求数"
                  value={stats.total_requests}
                  prefix={<EyeOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card size="small">
                <Statistic
                  title="总追踪数"
                  value={stats.total_tracks}
                  prefix={<AimOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card size="small">
                <Statistic
                  title="平均CTR"
                  value={(stats.avg_ctr * 100).toFixed(2)}
                  suffix="%"
                  prefix={<RocketOutlined />}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={6}>
              <Card size="small">
                <Statistic
                  title="平均转化率"
                  value={(stats.avg_conversion * 100).toFixed(2)}
                  suffix="%"
                  prefix={<HeartOutlined />}
                  valueStyle={{ color: '#cf1322' }}
                />
              </Card>
            </Col>
          </Row>
        )}

        <Divider>推荐策略</Divider>

        {/* 策略选择 */}
        <Card size="small" style={{ marginBottom: 24 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>选择推荐策略：</Text>
              <Select
                value={strategy}
                onChange={(value) => {
                  setStrategy(value);
                  setTimeout(reload, 100);
                }}
                style={{ width: 250, marginLeft: 16 }}
              >
                <Select.Option value="personalized">
                  <Space>
                    <StarOutlined />
                    个性化推荐
                  </Space>
                </Select.Option>
                <Select.Option value="popular">
                  <Space>
                    <TrophyOutlined />
                    热门推荐
                  </Space>
                </Select.Option>
                <Select.Option value="trending">
                  <Space>
                    <FireOutlined />
                    趋势推荐
                  </Space>
                </Select.Option>
                <Select.Option value="embedding">
                  <Space>
                    <ThunderboltOutlined />
                    向量相似
                  </Space>
                </Select.Option>
                <Select.Option value="collaborative">
                  <Space>
                    <HeartOutlined />
                    协同过滤
                  </Space>
                </Select.Option>
              </Select>
              <Button
                icon={<ReloadOutlined />}
                onClick={reload}
                loading={loading}
                style={{ marginLeft: 16 }}
              >
                刷新推荐
              </Button>
            </div>

            <Alert
              message={
                <Space>
                  {getStrategyIcon(strategy)}
                  <Text strong>{strategy}</Text>
                </Space>
              }
              description={getStrategyDescription(strategy)}
              type="info"
              showIcon={false}
            />
          </Space>
        </Card>

        <Divider>推荐结果</Divider>

        {/* 推荐列表 */}
        <Row gutter={[16, 16]}>
          {loading ? (
            <Col span={24}>
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Text type="secondary">加载中...</Text>
              </div>
            </Col>
          ) : items.length === 0 ? (
            <Col span={24}>
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Text type="secondary">暂无推荐</Text>
              </div>
            </Col>
          ) : (
            items.map((item, index) => {
              const metadata = item.metadata || {
                name: '未命名模板',
                category: '未知',
                tags: [] as string[],
                popularity: 0,
              };

              return (
                <Col xs={24} sm={12} md={8} key={item.id}>
                  <Card
                    size="small"
                    hoverable
                    onClick={() => handleTemplateClick(item, index)}
                    extra={
                      <Badge
                        count={
                          <Tooltip title="推荐分数">
                            <Tag color="blue">{(item.score * 100).toFixed(0)}%</Tag>
                          </Tooltip>
                        }
                      />
                    }
                  >
                    <div style={{ marginBottom: 8 }}>
                      <Text strong>{metadata.name}</Text>
                      <div style={{ marginTop: 4 }}>
                        <Tag color="purple">{metadata.category}</Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {item.reason}
                        </Text>
                      </div>
                    </div>

                    <div style={{ marginBottom: 8 }}>
                      <Space size={[0, 4]} wrap>
                        {metadata.tags.map((tag: string) => (
                          <Tag key={tag} style={{ fontSize: 11 }}>
                            {tag}
                          </Tag>
                        ))}
                      </Space>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
                      <div style={{ flex: 1 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          <FireOutlined style={{ marginRight: 4 }} />
                          热度: {metadata.popularity}
                        </Text>
                      </div>
                      <Space size="small">
                        <Tooltip title="生成">
                          <Button
                            size="small"
                            type="primary"
                            icon={<RocketOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGenerate(item, index);
                            }}
                          />
                        </Tooltip>
                        <Tooltip title="点赞">
                          <Button
                            size="small"
                            icon={<HeartOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLike(item, index);
                            }}
                          />
                        </Tooltip>
                      </Space>
                    </div>
                  </Card>
                </Col>
              );
            })
          )}
        </Row>

        {/* 策略对比 */}
        {stats && (
          <>
            <Divider>策略对比</Divider>
            <Card size="small" title="各策略CTR对比">
              <List
                dataSource={stats.top_strategies}
                renderItem={(item: any) => (
                  <List.Item>
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Space>
                          {getStrategyIcon(item.strategy)}
                          <Text strong>{item.strategy}</Text>
                        </Space>
                        <Space>
                          <Text type="secondary">使用率: {(item.usage * 100).toFixed(1)}%</Text>
                          <Text>CTR: <Text type="success" strong>{(item.ctr * 100).toFixed(2)}%</Text></Text>
                        </Space>
                      </div>
                      <div
                        style={{
                          height: 8,
                          background: '#f0f0f0',
                          borderRadius: 4,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${item.ctr * 1000}%`,
                            height: '100%',
                            background: '#1890ff',
                          }}
                        />
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          </>
        )}
      </Card>
    </div>
  );
}
