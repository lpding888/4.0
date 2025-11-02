/**
 * FeatureGrid 功能卡片网格布局组件
 * 艹，这个组件自动渲染功能卡片网格，支持响应式！
 */

'use client';

import React, { useMemo } from 'react';
import { Row, Col, Empty } from 'antd';
import { FeatureCard } from './FeatureCard';
import type { FeatureCard as FeatureCardType, FeatureCategory } from '../model/types';

/**
 * FeatureGrid Props
 */
export interface FeatureGridProps {
  /** 功能列表 */
  features: FeatureCardType[];

  /** 列数 */
  columns?: number;

  /** 间距 */
  gutter?: number | [number, number];

  /** 是否按分类分组显示 */
  groupByCategory?: boolean;

  /** 卡片点击回调 */
  onFeatureClick?: (feature: FeatureCardType) => void;

  /** 是否显示禁用状态 */
  showDisabledState?: boolean;

  /** 空状态提示 */
  emptyText?: string;

  /** 自定义空状态 */
  emptyRender?: React.ReactNode;
}

/**
 * 分类名称映射
 */
const CATEGORY_LABELS: Record<FeatureCategory, string> = {
  ai: 'AI功能',
  admin: '管理功能',
  analytics: '数据统计',
  user: '用户功能',
  system: '系统功能',
  other: '其他',
};

/**
 * FeatureGrid 组件
 */
export const FeatureGrid: React.FC<FeatureGridProps> = ({
  features,
  columns = 3,
  gutter = [16, 16],
  groupByCategory = false,
  onFeatureClick,
  showDisabledState = true,
  emptyText = '暂无功能',
  emptyRender,
}) => {
  /**
   * 根据分类分组
   */
  const groupedFeatures = useMemo(() => {
    if (!groupByCategory) {
      return null;
    }

    const groups: Record<FeatureCategory, FeatureCardType[]> = {
      ai: [],
      admin: [],
      analytics: [],
      user: [],
      system: [],
      other: [],
    };

    features.forEach((feature) => {
      groups[feature.category].push(feature);
    });

    // 艹，过滤掉空分组
    return Object.entries(groups)
      .filter(([_, items]) => items.length > 0)
      .map(([category, items]) => ({
        category: category as FeatureCategory,
        label: CATEGORY_LABELS[category as FeatureCategory],
        items,
      }));
  }, [features, groupByCategory]);

  /**
   * 计算响应式列配置
   */
  const getColSpan = () => {
    const span = 24 / columns;
    return {
      xs: 24, // 手机：1列
      sm: 12, // 平板：2列
      md: span, // 桌面：按columns配置
    };
  };

  /**
   * 渲染功能卡片
   */
  const renderFeatureCard = (feature: FeatureCardType) => {
    return (
      <Col key={feature.id} {...getColSpan()}>
        <FeatureCard
          feature={feature}
          onClick={onFeatureClick}
          showDisabledState={showDisabledState}
        />
      </Col>
    );
  };

  /**
   * 渲染空状态
   */
  if (features.length === 0) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        {emptyRender || (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={emptyText}
          />
        )}
      </div>
    );
  }

  /**
   * 不分组：直接渲染网格
   */
  if (!groupByCategory || !groupedFeatures) {
    return (
      <Row gutter={gutter}>
        {features.map(renderFeatureCard)}
      </Row>
    );
  }

  /**
   * 分组：按分类渲染
   */
  return (
    <div>
      {groupedFeatures.map((group) => (
        <div key={group.category} style={{ marginBottom: 32 }}>
          {/* 分类标题 */}
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              marginBottom: 16,
              paddingBottom: 8,
              borderBottom: '2px solid #f0f0f0',
            }}
          >
            {group.label}
          </div>

          {/* 分类卡片 */}
          <Row gutter={gutter}>
            {group.items.map(renderFeatureCard)}
          </Row>
        </div>
      ))}
    </div>
  );
};

export default FeatureGrid;
