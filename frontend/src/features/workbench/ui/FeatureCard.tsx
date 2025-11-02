/**
 * FeatureCard 功能卡片组件
 * 艹，这个组件显示单个功能卡片，支持点击跳转！
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, Badge, Tag } from 'antd';
import { DynamicIcon } from '@/shared/ui/DynamicIcon';
import type { FeatureCard as FeatureCardType, FeatureCardSize } from '../model/types';

/**
 * FeatureCard Props
 */
export interface FeatureCardProps {
  /** 功能配置 */
  feature: FeatureCardType;

  /** 点击回调 */
  onClick?: (feature: FeatureCardType) => void;

  /** 是否显示禁用状态 */
  showDisabledState?: boolean;

  /** 自定义样式 */
  className?: string;
}

/**
 * 根据卡片大小获取高度
 */
const getSizeHeight = (size: FeatureCardSize): number => {
  switch (size) {
    case 'small':
      return 140;
    case 'medium':
      return 160;
    case 'large':
      return 200;
    default:
      return 160;
  }
};

/**
 * FeatureCard 组件
 */
export const FeatureCard: React.FC<FeatureCardProps> = ({
  feature,
  onClick,
  showDisabledState = true,
  className,
}) => {
  const router = useRouter();

  /**
   * 处理卡片点击
   */
  const handleClick = () => {
    // 禁用的卡片不响应点击
    if (feature.disabled) {
      return;
    }

    // 回调
    onClick?.(feature);

    // 路由跳转
    if (feature.path) {
      router.push(feature.path);
    }
  };

  /**
   * 渲染徽标
   */
  const renderBadge = () => {
    if (feature.badge) {
      return (
        <Badge
          count={feature.badge}
          color={feature.badgeColor}
          style={{ position: 'absolute', top: 12, right: 12 }}
        />
      );
    }
    return null;
  };

  /**
   * 渲染标签
   */
  const renderTags = () => {
    const tags = [];

    if (feature.isNew) {
      tags.push(
        <Tag key="new" color="blue">
          NEW
        </Tag>
      );
    }

    if (feature.isHot) {
      tags.push(
        <Tag key="hot" color="red">
          HOT
        </Tag>
      );
    }

    if (tags.length === 0) {
      return null;
    }

    return <div style={{ marginTop: 8 }}>{tags}</div>;
  };

  // 卡片样式
  const cardStyle: React.CSSProperties = {
    height: getSizeHeight(feature.size),
    cursor: feature.disabled ? 'not-allowed' : 'pointer',
    opacity: showDisabledState && feature.disabled ? 0.5 : 1,
    transition: 'all 0.3s',
    position: 'relative',
  };

  const hoverStyle = feature.disabled
    ? {}
    : {
        transform: 'translateY(-4px)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      };

  return (
    <Card
      className={className}
      style={cardStyle}
      hoverable={!feature.disabled}
      onClick={handleClick}
      styles={{
        body: {
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          padding: '24px 16px',
        },
      }}
    >
      {/* 徽标 */}
      {renderBadge()}

      {/* 图标 */}
      <div style={{ marginBottom: 12 }}>
        <DynamicIcon icon={feature.icon} size={48} color="#1890ff" />
      </div>

      {/* 标题 */}
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          marginBottom: 8,
          color: feature.disabled ? '#999' : '#000',
        }}
      >
        {feature.title}
      </div>

      {/* 描述 */}
      <div
        style={{
          fontSize: 13,
          color: feature.disabled ? '#ccc' : '#666',
          lineHeight: 1.4,
        }}
      >
        {feature.description}
      </div>

      {/* 标签 */}
      {renderTags()}
    </Card>
  );
};

export default FeatureCard;
