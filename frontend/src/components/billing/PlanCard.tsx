/**
 * 套餐卡片组件
 * 艹！这个组件展示套餐的价格、权益和购买按钮！
 *
 * @author 老王
 */

import React from 'react';
import { Card, Button, Badge, List, Typography } from 'antd';
import { CheckCircleOutlined, CrownOutlined, RocketOutlined, TrophyOutlined } from '@ant-design/icons';
import type { PlanType } from '@/store/quota';

const { Title, Text, Paragraph } = Typography;

/**
 * 套餐配置
 */
export interface PlanConfig {
  plan_type: PlanType;
  plan_name: string;
  price: number; // 价格（元/月）
  original_price?: number; // 原价（用于显示折扣）
  quota: number; // 配额（次数/月）
  features: string[]; // 权益列表
  is_popular?: boolean; // 是否推荐
  is_current?: boolean; // 是否当前套餐
  color?: string; // 主题色
  icon?: React.ReactNode; // 图标
}

/**
 * PlanCard Props
 */
interface PlanCardProps {
  plan: PlanConfig;
  onPurchase?: (planType: PlanType) => void;
  loading?: boolean;
}

/**
 * 套餐图标映射
 */
const PLAN_ICONS: Record<PlanType, React.ReactNode> = {
  free: <CheckCircleOutlined style={{ fontSize: 32 }} />,
  pro: <CrownOutlined style={{ fontSize: 32 }} />,
  enterprise: <TrophyOutlined style={{ fontSize: 32 }} />,
};

/**
 * 套餐主题色映射
 */
const PLAN_COLORS: Record<PlanType, string> = {
  free: '#52c41a',
  pro: '#1890ff',
  enterprise: '#722ed1',
};

/**
 * 套餐卡片组件
 */
export const PlanCard: React.FC<PlanCardProps> = ({ plan, onPurchase, loading = false }) => {
  const {
    plan_type,
    plan_name,
    price,
    original_price,
    quota,
    features,
    is_popular = false,
    is_current = false,
    color = PLAN_COLORS[plan_type],
    icon = PLAN_ICONS[plan_type],
  } = plan;

  /**
   * 处理购买点击
   */
  const handlePurchaseClick = () => {
    if (onPurchase && !is_current) {
      onPurchase(plan_type);
    }
  };

  /**
   * 获取按钮文本
   */
  const getButtonText = () => {
    if (is_current) return '当前套餐';
    if (plan_type === 'free') return '免费使用';
    return '立即购买';
  };

  return (
    <Badge.Ribbon
      text={is_popular ? '推荐' : is_current ? '当前' : undefined}
      color={is_popular ? '#ff4d4f' : '#52c41a'}
      style={{ display: is_popular || is_current ? 'block' : 'none' }}
    >
      <Card
        hoverable={!is_current}
        style={{
          height: '100%',
          borderColor: is_current ? color : undefined,
          borderWidth: is_current ? 2 : 1,
        }}
        bodyStyle={{ padding: 24 }}
      >
        {/* 套餐图标和名称 */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ color, marginBottom: 16 }}>{icon}</div>
          <Title level={3} style={{ margin: 0, color }}>
            {plan_name}
          </Title>
        </div>

        {/* 价格 */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          {original_price && original_price > price && (
            <Text delete style={{ fontSize: 14, color: '#999', marginRight: 8 }}>
              ¥{original_price}
            </Text>
          )}
          <div>
            <Text style={{ fontSize: 40, fontWeight: 600, color: '#000' }}>
              {price === 0 ? '免费' : `¥${price}`}
            </Text>
            {price > 0 && (
              <Text style={{ fontSize: 16, color: '#666', marginLeft: 4 }}>/月</Text>
            )}
          </div>
          <Text style={{ fontSize: 14, color: '#999', marginTop: 8, display: 'block' }}>
            {quota.toLocaleString()} 次/月
          </Text>
        </div>

        {/* 权益列表 */}
        <List
          dataSource={features}
          renderItem={(feature) => (
            <List.Item style={{ border: 'none', padding: '8px 0' }}>
              <CheckCircleOutlined style={{ color, marginRight: 8, fontSize: 16 }} />
              <Text>{feature}</Text>
            </List.Item>
          )}
          style={{ marginBottom: 24 }}
        />

        {/* 购买按钮 */}
        <Button
          type={is_current ? 'default' : 'primary'}
          size="large"
          block
          onClick={handlePurchaseClick}
          loading={loading}
          disabled={is_current}
          style={{
            backgroundColor: !is_current ? color : undefined,
            borderColor: !is_current ? color : undefined,
          }}
        >
          {getButtonText()}
        </Button>
      </Card>
    </Badge.Ribbon>
  );
};

/**
 * 默认套餐配置（示例）
 */
export const DEFAULT_PLANS: PlanConfig[] = [
  {
    plan_type: 'free',
    plan_name: '免费版',
    price: 0,
    quota: 100,
    features: [
      '每月 100 次生成额度',
      '基础 AI 模型',
      '标准图片质量',
      '社区支持',
      '基础模板库',
    ],
    color: PLAN_COLORS.free,
  },
  {
    plan_type: 'pro',
    plan_name: '专业版',
    price: 99,
    original_price: 199,
    quota: 1000,
    features: [
      '每月 1000 次生成额度',
      '高级 AI 模型',
      '高清图片质量',
      '优先客服支持',
      '完整模板库',
      '无水印导出',
      '批量处理功能',
    ],
    is_popular: true,
    color: PLAN_COLORS.pro,
  },
  {
    plan_type: 'enterprise',
    plan_name: '企业版',
    price: 999,
    quota: 10000,
    features: [
      '每月 10000 次生成额度',
      '顶级 AI 模型',
      '超清图片质量',
      '专属客服支持',
      '定制模板开发',
      'API 接口访问',
      '团队协作功能',
      '数据统计分析',
      '私有化部署',
    ],
    color: PLAN_COLORS.enterprise,
  },
];
