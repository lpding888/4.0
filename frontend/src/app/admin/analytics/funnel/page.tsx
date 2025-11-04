'use client';

/**
 * 转化漏斗分析页面
 * 艹！这个页面展示用户从访问到支付的完整转化路径！
 *
 * @author 老王
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Select,
  DatePicker,
  Space,
  Typography,
  Divider,
  Alert,
  Spin,
  Tag,
} from 'antd';
import {
  FunnelPlotOutlined,
  RiseOutlined,
  FallOutlined,
  EyeOutlined,
  ThunderboltOutlined,
  DownloadOutlined,
  CreditCardOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { ConversionFunnel } from '@/components/analytics/ConversionFunnel';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

/**
 * 漏斗步骤数据
 */
export interface FunnelStep {
  name: string; // 步骤名称
  count: number; // 用户数
  conversion_rate: number; // 转化率（相对上一步）
  overall_conversion_rate: number; // 整体转化率（相对第一步）
  drop_count: number; // 流失数
  drop_rate: number; // 流失率
  avg_time?: number; // 平均停留时间（秒）
}

/**
 * 漏斗数据
 */
interface FunnelData {
  funnel_name: string;
  date_range: {
    start_date: string;
    end_date: string;
  };
  steps: FunnelStep[];
  total_conversion_rate: number; // 总转化率（最后一步/第一步）
  total_users: number; // 总用户数
  converted_users: number; // 完成转化用户数
}

/**
 * 转化漏斗分析页面
 */
export default function FunnelAnalyticsPage() {
  const [funnelData, setFunnelData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(false);

  // 筛选条件
  const [funnelType, setFunnelType] = useState<string>('purchase'); // 漏斗类型
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(7, 'day'),
    dayjs(),
  ]);

  /**
   * 加载漏斗数据
   */
  const loadFunnelData = async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.append('funnel_type', funnelType);
      params.append('start_date', dateRange[0].format('YYYY-MM-DD'));
      params.append('end_date', dateRange[1].format('YYYY-MM-DD'));

      const response = await fetch(`/api/admin/analytics/funnel?${params.toString()}`);
      if (!response.ok) throw new Error('获取漏斗数据失败');

      const data = await response.json();
      setFunnelData(data.funnel);
    } catch (error: any) {
      console.error('[漏斗分析] 获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 初始化
   */
  useEffect(() => {
    loadFunnelData();
  }, [funnelType, dateRange]);

  /**
   * 格式化时间
   */
  const formatTime = (seconds?: number) => {
    if (!seconds) return '-';

    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
    return `${Math.floor(seconds / 3600)}小时${Math.floor((seconds % 3600) / 60)}分`;
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>
          <FunnelPlotOutlined style={{ marginRight: 8 }} />
          转化漏斗分析
        </Title>

        <Space>
          {/* 漏斗类型选择 */}
          <Select
            value={funnelType}
            onChange={setFunnelType}
            style={{ width: 180 }}
            options={[
              { label: '购买转化漏斗', value: 'purchase' },
              { label: '注册转化漏斗', value: 'signup' },
              { label: '模板使用漏斗', value: 'template_usage' },
            ]}
          />

          {/* 日期范围选择 */}
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0], dates[1]]);
              }
            }}
            format="YYYY-MM-DD"
          />
        </Space>
      </div>

      <Spin spinning={loading}>
        {funnelData && (
          <>
            {/* 总览统计卡片 */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="总用户数"
                    value={funnelData.total_users}
                    prefix={<EyeOutlined />}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>

              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="完成转化用户"
                    value={funnelData.converted_users}
                    prefix={<TrophyOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>

              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="总转化率"
                    value={funnelData.total_conversion_rate}
                    precision={2}
                    suffix="%"
                    prefix={<ThunderboltOutlined />}
                    valueStyle={{
                      color:
                        funnelData.total_conversion_rate >= 20
                          ? '#52c41a'
                          : funnelData.total_conversion_rate >= 10
                            ? '#faad14'
                            : '#ff4d4f',
                    }}
                  />
                </Card>
              </Col>

              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="漏斗步骤"
                    value={funnelData.steps.length}
                    suffix="步"
                    valueStyle={{ color: '#722ed1' }}
                  />
                </Card>
              </Col>
            </Row>

            {/* 转化率说明 */}
            <Alert
              message="转化率指标说明"
              description={
                <div>
                  <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                    <li>
                      <Text strong>步骤转化率</Text>：当前步骤用户数 / 上一步骤用户数
                    </li>
                    <li>
                      <Text strong>整体转化率</Text>：当前步骤用户数 / 第一步用户数
                    </li>
                    <li>
                      <Text strong>总转化率</Text>：最后一步用户数 / 第一步用户数
                    </li>
                    <li>
                      <Text strong>流失率</Text>：(上一步用户数 - 当前步用户数) / 上一步用户数
                    </li>
                  </ul>
                </div>
              }
              type="info"
              showIcon
              closable
              style={{ marginBottom: 24 }}
            />

            {/* 漏斗可视化 */}
            <Card title="转化漏斗图" style={{ marginBottom: 24 }}>
              <ConversionFunnel steps={funnelData.steps} />
            </Card>

            {/* 漏斗详细数据 */}
            <Card title="漏斗详细数据">
              <Row gutter={[16, 16]}>
                {funnelData.steps.map((step, index) => (
                  <Col xs={24} key={index}>
                    <Card
                      size="small"
                      style={{
                        background:
                          index === 0
                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                            : index === funnelData.steps.length - 1
                              ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                              : '#fafafa',
                        border: index === 0 || index === funnelData.steps.length - 1 ? 'none' : undefined,
                      }}
                    >
                      <Row gutter={16} align="middle">
                        {/* 步骤序号和名称 */}
                        <Col xs={24} sm={8}>
                          <Space>
                            <Tag
                              color={index === 0 ? 'purple' : index === funnelData.steps.length - 1 ? 'red' : 'blue'}
                              style={{ fontSize: 16, padding: '4px 12px' }}
                            >
                              步骤 {index + 1}
                            </Tag>
                            <Text
                              strong
                              style={{
                                fontSize: 16,
                                color: index === 0 || index === funnelData.steps.length - 1 ? 'white' : undefined,
                              }}
                            >
                              {step.name}
                            </Text>
                          </Space>
                        </Col>

                        {/* 用户数 */}
                        <Col xs={12} sm={4}>
                          <div>
                            <Text
                              type="secondary"
                              style={{
                                display: 'block',
                                marginBottom: 4,
                                color: index === 0 || index === funnelData.steps.length - 1 ? 'rgba(255,255,255,0.8)' : undefined,
                              }}
                            >
                              用户数
                            </Text>
                            <Text
                              strong
                              style={{
                                fontSize: 18,
                                color: index === 0 || index === funnelData.steps.length - 1 ? 'white' : '#1890ff',
                              }}
                            >
                              {step.count.toLocaleString()}
                            </Text>
                          </div>
                        </Col>

                        {/* 步骤转化率 */}
                        {index > 0 && (
                          <Col xs={12} sm={4}>
                            <div>
                              <Text
                                type="secondary"
                                style={{
                                  display: 'block',
                                  marginBottom: 4,
                                  color: index === funnelData.steps.length - 1 ? 'rgba(255,255,255,0.8)' : undefined,
                                }}
                              >
                                步骤转化率
                              </Text>
                              <Text
                                strong
                                style={{
                                  fontSize: 18,
                                  color:
                                    index === funnelData.steps.length - 1
                                      ? 'white'
                                      : step.conversion_rate >= 50
                                        ? '#52c41a'
                                        : step.conversion_rate >= 30
                                          ? '#faad14'
                                          : '#ff4d4f',
                                }}
                              >
                                {step.conversion_rate >= 50 ? <RiseOutlined /> : <FallOutlined />}{' '}
                                {step.conversion_rate.toFixed(2)}%
                              </Text>
                            </div>
                          </Col>
                        )}

                        {/* 整体转化率 */}
                        <Col xs={12} sm={4}>
                          <div>
                            <Text
                              type="secondary"
                              style={{
                                display: 'block',
                                marginBottom: 4,
                                color: index === 0 || index === funnelData.steps.length - 1 ? 'rgba(255,255,255,0.8)' : undefined,
                              }}
                            >
                              整体转化率
                            </Text>
                            <Text
                              strong
                              style={{
                                fontSize: 18,
                                color: index === 0 || index === funnelData.steps.length - 1 ? 'white' : '#722ed1',
                              }}
                            >
                              {step.overall_conversion_rate.toFixed(2)}%
                            </Text>
                          </div>
                        </Col>

                        {/* 流失数和流失率 */}
                        {index > 0 && (
                          <Col xs={12} sm={4}>
                            <div>
                              <Text
                                type="secondary"
                                style={{
                                  display: 'block',
                                  marginBottom: 4,
                                  color: index === funnelData.steps.length - 1 ? 'rgba(255,255,255,0.8)' : undefined,
                                }}
                              >
                                流失
                              </Text>
                              <Text
                                strong
                                style={{
                                  fontSize: 16,
                                  color: index === funnelData.steps.length - 1 ? 'white' : '#ff4d4f',
                                }}
                              >
                                {step.drop_count.toLocaleString()} ({step.drop_rate.toFixed(2)}%)
                              </Text>
                            </div>
                          </Col>
                        )}

                        {/* 平均停留时间 */}
                        {step.avg_time && (
                          <Col xs={24} sm={index === 0 ? 16 : 12}>
                            <div>
                              <Text
                                type="secondary"
                                style={{
                                  display: 'block',
                                  marginBottom: 4,
                                  color: index === 0 || index === funnelData.steps.length - 1 ? 'rgba(255,255,255,0.8)' : undefined,
                                }}
                              >
                                平均停留时间
                              </Text>
                              <Text
                                style={{
                                  fontSize: 14,
                                  color: index === 0 || index === funnelData.steps.length - 1 ? 'white' : undefined,
                                }}
                              >
                                {formatTime(step.avg_time)}
                              </Text>
                            </div>
                          </Col>
                        )}
                      </Row>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Card>
          </>
        )}
      </Spin>
    </div>
  );
}
