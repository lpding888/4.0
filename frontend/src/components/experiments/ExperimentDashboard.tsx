/**
 * A/B实验数据看板组件
 * 艹！这个组件展示实验的详细数据和分析结果！
 *
 * @author 老王
 */

import React from 'react';
import { Card, Row, Col, Statistic, Table, Progress, Tag, Typography, Divider } from 'antd';
import {
  EyeOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  RiseOutlined,
  FallOutlined,
} from '@ant-design/icons';
import type { ColumnType } from 'antd/es/table';

const { Title, Text } = Typography;

interface Experiment {
  traffic_allocation: number;
  variants: Array<{ id: string }>;
  start_date?: string | null;
  end_date?: string | null;
  description?: string;
}

/**
 * 变体数据
 */
interface VariantMetrics {
  variant_id: string;
  variant_name: string;
  exposure_count: number; // 曝光数
  conversion_count: number; // 转化数
  conversion_rate: number; // 转化率
  avg_value: number; // 平均转化价值
  confidence: number; // 置信度 (0-100)
  is_winner: boolean; // 是否获胜变体
}

/**
 * 实验数据
 */
export interface ExperimentMetrics {
  experiment: Experiment;
  variants_metrics: VariantMetrics[];
  total_exposure: number;
  total_conversion: number;
  duration_days: number; // 实验运行天数
  statistical_significance: number; // 统计显著性 (0-100)
}

/**
 * ExperimentDashboard Props
 */
interface ExperimentDashboardProps {
  metrics: ExperimentMetrics;
}

/**
 * A/B实验数据看板
 */
export const ExperimentDashboard: React.FC<ExperimentDashboardProps> = ({ metrics }) => {
  const { experiment, variants_metrics, total_exposure, total_conversion, duration_days } =
    metrics;

  // 找出获胜变体
  const winnerVariant = variants_metrics.find((v) => v.is_winner);
  const controlVariant = variants_metrics.find((v) => v.variant_id === 'control');

  // 计算提升率
  const calculateLift = (variantCVR: number, controlCVR: number): number => {
    if (controlCVR === 0) return 0;
    return ((variantCVR - controlCVR) / controlCVR) * 100;
  };

  /**
   * 变体数据表格列
   */
  const columns: ColumnType<VariantMetrics>[] = [
    {
      title: '变体',
      dataIndex: 'variant_name',
      key: 'variant_name',
      width: 150,
      render: (name: string, record: VariantMetrics) => (
        <div>
          <Text strong>{name}</Text>
          {record.is_winner && (
            <Tag color="gold" icon={<TrophyOutlined />} style={{ marginLeft: 8 }}>
              获胜
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: '曝光数',
      dataIndex: 'exposure_count',
      key: 'exposure_count',
      width: 120,
      render: (count: number) => count.toLocaleString(),
    },
    {
      title: '转化数',
      dataIndex: 'conversion_count',
      key: 'conversion_count',
      width: 120,
      render: (count: number) => count.toLocaleString(),
    },
    {
      title: '转化率',
      dataIndex: 'conversion_rate',
      key: 'conversion_rate',
      width: 120,
      render: (rate: number) => (
        <Text strong style={{ color: '#52c41a', fontSize: 16 }}>
          {(rate * 100).toFixed(2)}%
        </Text>
      ),
    },
    {
      title: '提升率',
      key: 'lift',
      width: 120,
      render: (_, record: VariantMetrics) => {
        if (!controlVariant || record.variant_id === 'control') return '-';

        const lift = calculateLift(record.conversion_rate, controlVariant.conversion_rate);
        const isPositive = lift > 0;

        return (
          <Text
            strong
            style={{
              color: isPositive ? '#52c41a' : '#ff4d4f',
              fontSize: 16,
            }}
          >
            {isPositive ? <RiseOutlined /> : <FallOutlined />}
            {' '}
            {lift > 0 ? '+' : ''}
            {lift.toFixed(2)}%
          </Text>
        );
      },
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 150,
      render: (confidence: number) => (
        <div>
          <Progress
            percent={confidence}
            size="small"
            status={confidence >= 95 ? 'success' : confidence >= 80 ? 'normal' : 'exception'}
          />
        </div>
      ),
    },
    {
      title: '平均价值',
      dataIndex: 'avg_value',
      key: 'avg_value',
      width: 120,
      render: (value: number) => `¥${value.toFixed(2)}`,
    },
  ];

  return (
    <div>
      {/* 总览统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总曝光数"
              value={total_exposure}
              prefix={<EyeOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总转化数"
              value={total_conversion}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="运行天数"
              value={duration_days}
              suffix="天"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="统计显著性"
              value={metrics.statistical_significance}
              suffix="%"
              prefix={
                metrics.statistical_significance >= 95 ? (
                  <TrophyOutlined />
                ) : undefined
              }
              valueStyle={{
                color:
                  metrics.statistical_significance >= 95
                    ? '#52c41a'
                    : metrics.statistical_significance >= 80
                      ? '#faad14'
                      : '#ff4d4f',
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* 获胜变体提示 */}
      {winnerVariant && controlVariant && (
        <Card
          style={{
            marginBottom: 24,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
          }}
        >
          <div style={{ color: 'white' }}>
            <Title level={4} style={{ color: 'white', marginBottom: 16 }}>
              <TrophyOutlined style={{ marginRight: 8 }} />
              实验结论
            </Title>

            <Text style={{ fontSize: 16, color: 'white' }}>
              <strong>{winnerVariant.variant_name}</strong> 获胜！转化率为{' '}
              <strong>{(winnerVariant.conversion_rate * 100).toFixed(2)}%</strong>，相比对照组提升{' '}
              <strong style={{ fontSize: 18 }}>
                {calculateLift(
                  winnerVariant.conversion_rate,
                  controlVariant.conversion_rate
                ).toFixed(2)}
                %
              </strong>
            </Text>

            <Divider style={{ background: 'rgba(255, 255, 255, 0.2)', margin: '16px 0' }} />

            <Text style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
              统计显著性: {metrics.statistical_significance.toFixed(1)}%
              {metrics.statistical_significance >= 95 && ' (结果可靠)'}
            </Text>
          </div>
        </Card>
      )}

      {/* 变体数据表格 */}
      <Card title="变体数据对比" style={{ marginBottom: 24 }}>
        <Table
          columns={columns}
          dataSource={variants_metrics}
          rowKey="variant_id"
          pagination={false}
          scroll={{ x: 900 }}
        />
      </Card>

      {/* 实验配置信息 */}
      <Card title="实验配置">
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Text type="secondary">流量分配比例：</Text>
            <Text strong>{experiment.traffic_allocation}%</Text>
          </Col>

          <Col span={12}>
            <Text type="secondary">变体数量：</Text>
            <Text strong>{experiment.variants.length}</Text>
          </Col>

          <Col span={12}>
            <Text type="secondary">开始时间：</Text>
            <Text strong>{experiment.start_date || '-'}</Text>
          </Col>

          <Col span={12}>
            <Text type="secondary">结束时间：</Text>
            <Text strong>{experiment.end_date || '-'}</Text>
          </Col>

          <Col span={24}>
            <Text type="secondary">实验描述：</Text>
            <br />
            <Text>{experiment.description}</Text>
          </Col>
        </Row>
      </Card>
    </div>
  );
};
