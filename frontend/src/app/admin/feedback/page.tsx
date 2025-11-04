'use client';

/**
 * 用户反馈管理页面
 * 艹！这个页面让管理员查看和处理用户反馈，包括NPS统计！
 *
 * @author 老王
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Select,
  message,
  Typography,
  Tabs,
  Progress,
  Image,
  Divider,
  Alert,
  Spin,
} from 'antd';
import {
  MessageOutlined,
  SmileOutlined,
  MehOutlined,
  FrownOutlined,
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  TrophyOutlined,
  RiseOutlined,
  FallOutlined,
} from '@ant-design/icons';
import type { ColumnType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { FeedbackType, NPSScore } from '@/components/feedback/FeedbackModal';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

/**
 * 反馈记录
 */
export interface FeedbackRecord {
  id: string;
  user_id: string;
  user_email: string;
  nps_score?: NPSScore;
  feedback_type: FeedbackType;
  title: string;
  content: string;
  contact?: string;
  screenshots?: string[]; // 截图URLs
  status: 'pending' | 'processing' | 'resolved' | 'closed';
  created_at: string;
  resolved_at?: string;
  resolver?: string;
  resolution?: string;
}

/**
 * NPS统计数据
 */
interface NPSStats {
  total_responses: number; // 总回复数
  nps_score: number; // NPS得分 (-100 to 100)
  promoters: number; // 推荐者数量（9-10分）
  passives: number; // 中立者数量（7-8分）
  detractors: number; // 贬损者数量（0-6分）
  promoter_percentage: number; // 推荐者百分比
  passive_percentage: number; // 中立者百分比
  detractor_percentage: number; // 贬损者百分比
  avg_score: number; // 平均分
  trend: 'up' | 'down' | 'stable'; // 趋势
  trend_percentage: number; // 趋势百分比
}

/**
 * 反馈类型配置
 */
const FEEDBACK_TYPE_CONFIG: Record<FeedbackType, { label: string; color: string }> = {
  bug: { label: '错误反馈', color: 'red' },
  feature: { label: '功能建议', color: 'blue' },
  improvement: { label: '优化建议', color: 'cyan' },
  complaint: { label: '投诉建议', color: 'orange' },
  praise: { label: '表扬鼓励', color: 'green' },
  other: { label: '其他反馈', color: 'default' },
};

/**
 * 反馈状态配置
 */
const STATUS_CONFIG: Record<FeedbackRecord['status'], { label: string; color: string }> = {
  pending: { label: '待处理', color: 'orange' },
  processing: { label: '处理中', color: 'blue' },
  resolved: { label: '已解决', color: 'green' },
  closed: { label: '已关闭', color: 'default' },
};

/**
 * 用户反馈管理页面
 */
export default function FeedbackManagementPage() {
  const [npsStats, setNpsStats] = useState<NPSStats | null>(null);
  const [feedbackRecords, setFeedbackRecords] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // 详情Modal
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackRecord | null>(null);

  /**
   * 加载NPS统计
   */
  const loadNPSStats = async () => {
    try {
      const response = await fetch('/api/admin/feedback/nps-stats');
      if (!response.ok) throw new Error('获取NPS统计失败');

      const data = await response.json();
      setNpsStats(data.stats);
    } catch (error: any) {
      console.error('[反馈管理] 获取NPS统计失败:', error);
      message.error(error.message || '获取NPS统计失败');
    }
  };

  /**
   * 加载反馈记录
   */
  const loadFeedbackRecords = async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/admin/feedback/records?${params.toString()}`);
      if (!response.ok) throw new Error('获取反馈记录失败');

      const data = await response.json();
      setFeedbackRecords(data.records || []);
    } catch (error: any) {
      console.error('[反馈管理] 获取反馈记录失败:', error);
      message.error(error.message || '获取反馈记录失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 查看详情
   */
  const handleViewDetail = (record: FeedbackRecord) => {
    setSelectedFeedback(record);
    setDetailModalVisible(true);
  };

  /**
   * 标记为已解决
   */
  const handleResolve = async (record: FeedbackRecord) => {
    try {
      const response = await fetch(`/api/admin/feedback/${record.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution: '问题已处理' }),
      });

      if (!response.ok) throw new Error('标记失败');

      message.success('已标记为已解决');
      loadFeedbackRecords();
    } catch (error: any) {
      console.error('[反馈管理] 标记失败:', error);
      message.error(error.message || '标记失败');
    }
  };

  /**
   * 初始化
   */
  useEffect(() => {
    loadNPSStats();
    loadFeedbackRecords();
  }, [statusFilter]);

  /**
   * 反馈表格列
   */
  const columns: ColumnType<FeedbackRecord>[] = [
    {
      title: 'NPS评分',
      dataIndex: 'nps_score',
      key: 'nps_score',
      width: 100,
      render: (score?: NPSScore) => {
        if (score === undefined) return '-';

        let color = '';
        let icon = null;
        if (score >= 9) {
          color = '#52c41a';
          icon = <SmileOutlined />;
        } else if (score >= 7) {
          color = '#faad14';
          icon = <MehOutlined />;
        } else {
          color = '#ff4d4f';
          icon = <FrownOutlined />;
        }

        return (
          <Text strong style={{ color, fontSize: 16 }}>
            {icon} {score}分
          </Text>
        );
      },
    },
    {
      title: '反馈类型',
      dataIndex: 'feedback_type',
      key: 'feedback_type',
      width: 120,
      render: (type: FeedbackType) => {
        const config = FEEDBACK_TYPE_CONFIG[type];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '反馈标题',
      dataIndex: 'title',
      key: 'title',
      width: 250,
      ellipsis: true,
    },
    {
      title: '用户',
      dataIndex: 'user_email',
      key: 'user_email',
      width: 180,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: FeedbackRecord['status']) => {
        const config = STATUS_CONFIG[status];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            查看
          </Button>
          {record.status !== 'resolved' && record.status !== 'closed' && (
            <Button
              size="small"
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => handleResolve(record)}
            >
              解决
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <MessageOutlined style={{ marginRight: 8 }} />
          用户反馈管理
        </Title>
      </div>

      {/* NPS统计卡片 */}
      {npsStats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="NPS得分"
                value={npsStats.nps_score}
                precision={0}
                valueStyle={{
                  color: npsStats.nps_score >= 50 ? '#52c41a' : npsStats.nps_score >= 0 ? '#faad14' : '#ff4d4f',
                }}
                prefix={<TrophyOutlined />}
                suffix={
                  <span style={{ fontSize: 14 }}>
                    {npsStats.trend === 'up' && <RiseOutlined style={{ color: '#52c41a' }} />}
                    {npsStats.trend === 'down' && <FallOutlined style={{ color: '#ff4d4f' }} />}
                    {npsStats.trend !== 'stable' && ` ${npsStats.trend_percentage.toFixed(1)}%`}
                  </span>
                }
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="推荐者"
                value={npsStats.promoters}
                suffix={`/ ${npsStats.total_responses}`}
                valueStyle={{ color: '#52c41a' }}
                prefix={<SmileOutlined />}
              />
              <Progress
                percent={npsStats.promoter_percentage}
                strokeColor="#52c41a"
                showInfo={false}
                size="small"
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="中立者"
                value={npsStats.passives}
                suffix={`/ ${npsStats.total_responses}`}
                valueStyle={{ color: '#faad14' }}
                prefix={<MehOutlined />}
              />
              <Progress
                percent={npsStats.passive_percentage}
                strokeColor="#faad14"
                showInfo={false}
                size="small"
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="贬损者"
                value={npsStats.detractors}
                suffix={`/ ${npsStats.total_responses}`}
                valueStyle={{ color: '#ff4d4f' }}
                prefix={<FrownOutlined />}
              />
              <Progress
                percent={npsStats.detractor_percentage}
                strokeColor="#ff4d4f"
                showInfo={false}
                size="small"
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* NPS说明 */}
      <Alert
        message="NPS得分说明"
        description={
          <div>
            <div>NPS = 推荐者% - 贬损者%，取值范围：-100 到 100</div>
            <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
              <li>
                <Text strong style={{ color: '#52c41a' }}>
                  推荐者（9-10分）
                </Text>
                ：非常满意，愿意推荐给朋友
              </li>
              <li>
                <Text strong style={{ color: '#faad14' }}>
                  中立者（7-8分）
                </Text>
                ：比较满意，但不会主动推荐
              </li>
              <li>
                <Text strong style={{ color: '#ff4d4f' }}>
                  贬损者（0-6分）
                </Text>
                ：不满意，可能会负面评价
              </li>
            </ul>
          </div>
        }
        type="info"
        showIcon
        closable
        style={{ marginBottom: 24 }}
      />

      {/* 反馈列表 */}
      <Card
        title="反馈记录"
        extra={
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 120 }}
            options={[
              { label: '全部状态', value: 'all' },
              { label: '待处理', value: 'pending' },
              { label: '处理中', value: 'processing' },
              { label: '已解决', value: 'resolved' },
              { label: '已关闭', value: 'closed' },
            ]}
          />
        }
      >
        <Table
          columns={columns}
          dataSource={feedbackRecords}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
            defaultPageSize: 10,
          }}
        />
      </Card>

      {/* 详情Modal */}
      <Modal
        title="反馈详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={800}
      >
        {selectedFeedback && (
          <div>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Text type="secondary">反馈ID：</Text>
                <Text copyable>{selectedFeedback.id}</Text>
              </Col>
              <Col span={12}>
                <Text type="secondary">NPS评分：</Text>
                {selectedFeedback.nps_score !== undefined ? (
                  <Text strong style={{ fontSize: 16 }}>
                    {selectedFeedback.nps_score}分
                  </Text>
                ) : (
                  <Text>未评分</Text>
                )}
              </Col>

              <Col span={12}>
                <Text type="secondary">反馈类型：</Text>
                <Tag color={FEEDBACK_TYPE_CONFIG[selectedFeedback.feedback_type].color}>
                  {FEEDBACK_TYPE_CONFIG[selectedFeedback.feedback_type].label}
                </Tag>
              </Col>

              <Col span={12}>
                <Text type="secondary">状态：</Text>
                <Tag color={STATUS_CONFIG[selectedFeedback.status].color}>
                  {STATUS_CONFIG[selectedFeedback.status].label}
                </Tag>
              </Col>

              <Col span={24}>
                <Text type="secondary">反馈标题：</Text>
                <br />
                <Text strong>{selectedFeedback.title}</Text>
              </Col>

              <Col span={24}>
                <Text type="secondary">详细描述：</Text>
                <br />
                <Text>{selectedFeedback.content}</Text>
              </Col>

              {selectedFeedback.screenshots && selectedFeedback.screenshots.length > 0 && (
                <Col span={24}>
                  <Text type="secondary">截图附件：</Text>
                  <br />
                  <Image.PreviewGroup>
                    <Space>
                      {selectedFeedback.screenshots.map((url, index) => (
                        <Image key={index} src={url} width={100} />
                      ))}
                    </Space>
                  </Image.PreviewGroup>
                </Col>
              )}

              <Col span={12}>
                <Text type="secondary">用户：</Text>
                <Text>{selectedFeedback.user_email}</Text>
              </Col>

              {selectedFeedback.contact && (
                <Col span={12}>
                  <Text type="secondary">联系方式：</Text>
                  <Text copyable>{selectedFeedback.contact}</Text>
                </Col>
              )}

              <Col span={12}>
                <Text type="secondary">提交时间：</Text>
                <Text>{dayjs(selectedFeedback.created_at).format('YYYY-MM-DD HH:mm:ss')}</Text>
              </Col>

              {selectedFeedback.resolved_at && (
                <Col span={12}>
                  <Text type="secondary">解决时间：</Text>
                  <Text>{dayjs(selectedFeedback.resolved_at).format('YYYY-MM-DD HH:mm:ss')}</Text>
                </Col>
              )}
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
}
