/**
 * COMP-P0-001 BaseCard 基础卡片组件
 * 艹，这个基础组件必须好用，不然老王我要骂街！
 *
 * 功能清单：
 * 1. 统一的卡片样式和布局
 * 2. 支持不同尺寸和主题
 * 3. 内置加载状态
 * 4. 支持自定义操作按钮
 * 5. 响应式设计
 * 6. 可配置的边框和阴影
 * 7. 支持展开/收起功能
 *
 * @author 老王
 */

import React, { useState } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Tooltip,
  Badge,
  Collapse,
  Spin
} from 'antd';
import {
  ExpandOutlined,
  CompressOutlined,
  ReloadOutlined,
  SettingOutlined,
  MoreOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined
} from '@ant-design/icons';
import type { CardProps } from 'antd';
import Dropdown from 'antd/es/dropdown';

const { Title, Text } = Typography;
const { Panel } = Collapse;

// 卡片尺寸
export type BaseCardSize = 'small' | 'middle' | 'large';

// 卡片主题
export type BaseCardTheme = 'default' | 'primary' | 'success' | 'warning' | 'error';

// 操作按钮配置
export interface BaseCardAction {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  tooltip?: string;
}

// 卡片统计信息
export interface BaseCardStats {
  label: string;
  value: string | number;
  color?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
}

// 基础卡片属性
export interface BaseCardProps extends Omit<CardProps, 'size' | 'title' | 'extra' | 'actions'> {
  // 基础属性
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;

  // 尺寸和主题
  size?: BaseCardSize;
  theme?: BaseCardTheme;
  bordered?: boolean;
  shadow?: boolean;

  // 操作区域
  actions?: BaseCardAction[];
  extra?: React.ReactNode;
  showExpand?: boolean;
  defaultExpanded?: boolean;

  // 统计信息
  stats?: BaseCardStats[];

  // 状态
  loading?: boolean;
  error?: React.ReactNode;
  empty?: React.ReactNode;

  // 样式
  className?: string;
  bodyStyle?: React.CSSProperties;
  headStyle?: React.CSSProperties;

  // 回调函数
  onRefresh?: () => void;
  onSettings?: () => void;
  onFullscreen?: () => void;
}

export function BaseCard({
  title,
  subtitle,
  description,
  size = 'middle',
  theme = 'default',
  bordered = true,
  shadow = true,
  actions = [],
  extra,
  showExpand = false,
  defaultExpanded = true,
  stats,
  loading = false,
  error,
  empty,
  className = '',
  bodyStyle,
  headStyle,
  onRefresh,
  onSettings,
  onFullscreen,
  children,
  ...cardProps
}: BaseCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [fullscreen, setFullscreen] = useState(false);

  // 处理展开/收起
  const handleExpand = () => {
    setExpanded(!expanded);
  };

  // 处理全屏
  const handleFullscreen = () => {
    setFullscreen(!fullscreen);
    onFullscreen?.();
  };

  // 获取主题样式
  const getThemeClass = () => {
    const themeMap = {
      default: 'base-card-default',
      primary: 'base-card-primary',
      success: 'base-card-success',
      warning: 'base-card-warning',
      error: 'base-card-error'
    };
    return themeMap[theme];
  };

  // 获取尺寸样式
  const getSizeClass = () => {
    const sizeMap = {
      small: 'base-card-small',
      middle: 'base-card-middle',
      large: 'base-card-large'
    };
    return sizeMap[size];
  };

  // 渲染统计信息
  const renderStats = () => {
    if (!stats || stats.length === 0) return null;

    return (
      <div className="base-card-stats">
        <Space size="large">
          {stats.map((stat, index) => (
            <div key={index} className="base-card-stat-item">
              <div className="stat-label">
                <Text type="secondary">{stat.label}</Text>
              </div>
              <div className="stat-value">
                <Title level={4} style={{ margin: 0, color: stat.color }}>
                  {stat.value}
                </Title>
              </div>
              {stat.trend && (
                <div className={`stat-trend ${stat.trend.direction}`}>
                  <Text type={stat.trend.direction === 'up' ? 'success' : 'danger'}>
                    {stat.trend.direction === 'up' ? '↑' : '↓'} {Math.abs(stat.trend.value)}%
                  </Text>
                </div>
              )}
            </div>
          ))}
        </Space>
      </div>
    );
  };

  // 渲染操作按钮
  const renderActions = () => {
    const actionItems: BaseCardAction[] = [];

    // 刷新按钮
    if (onRefresh) {
      actionItems.push({
        key: 'refresh',
        label: '刷新',
        icon: <ReloadOutlined />,
        onClick: onRefresh
      });
    }

    // 设置按钮
    if (onSettings) {
      actionItems.push({
        key: 'settings',
        label: '设置',
        icon: <SettingOutlined />,
        onClick: onSettings
      });
    }

    // 全屏按钮
    if (showExpand) {
      actionItems.push({
        key: 'fullscreen',
        label: fullscreen ? '退出全屏' : '全屏',
        icon: fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />,
        onClick: handleFullscreen
      });
    }

    // 自定义操作按钮
    actionItems.push(...actions);

    if (actionItems.length === 0) return null;

    // 如果按钮太多，显示更多菜单
    if (actionItems.length > 3) {
      const visibleActions = actionItems.slice(0, 2);
      const moreActions = actionItems.slice(2);

      const moreMenu = (
        <div className="base-card-dropdown">
          {moreActions.map(action => (
            <div
              key={action.key}
              className={`base-card-dropdown-item ${action.danger ? 'danger' : ''} ${action.disabled ? 'disabled' : ''}`}
              onClick={() => !action.disabled && action.onClick?.()}
            >
              {action.icon && <span className="action-icon">{action.icon}</span>}
              <span className="action-label">{action.label}</span>
            </div>
          ))}
        </div>
      );

      return (
        <Space>
          {visibleActions.map(action => (
            <Tooltip key={action.key} title={action.tooltip}>
              <Button
                type="text"
                size="small"
                icon={action.icon}
                onClick={action.onClick}
                disabled={action.disabled}
                danger={action.danger}
              />
            </Tooltip>
          ))}
          <Dropdown overlay={moreMenu} trigger={['click']} placement="bottomRight">
            <Button type="text" size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      );
    }

    return (
      <Space>
        {actionItems.map(action => (
          <Tooltip key={action.key} title={action.tooltip}>
            <Button
              type="text"
              size="small"
              icon={action.icon}
              onClick={action.onClick}
              disabled={action.disabled}
              danger={action.danger}
            >
              {action.label}
            </Button>
          </Tooltip>
        ))}
      </Space>
    );
  };

  // 渲染标题区域
  const renderTitle = () => {
    if (!title && !subtitle) return null;

    return (
      <div className="base-card-header">
        <div className="base-card-title-section">
          {title && (
            <div className="base-card-title">
              {typeof title === 'string' ? (
                <Title level={size === 'small' ? 5 : 4} style={{ margin: 0 }}>
                  {title}
                </Title>
              ) : (
                title
              )}
            </div>
          )}
          {subtitle && (
            <div className="base-card-subtitle">
              <Text type="secondary">{subtitle}</Text>
            </div>
          )}
        </div>

        {(extra || renderActions()) && (
          <div className="base-card-extra">
            <Space>
              {extra}
              {renderActions()}
            </Space>
          </div>
        )}
      </div>
    );
  };

  // 渲染内容区域
  const renderContent = () => {
    if (loading) {
      return (
        <div className="base-card-loading">
          <Spin size="large" tip="加载中..." />
        </div>
      );
    }

    if (error) {
      return (
        <div className="base-card-error">
          <div className="error-content">
            <Text type="danger">{error}</Text>
            {onRefresh && (
              <Button type="primary" size="small" onClick={onRefresh} style={{ marginTop: 8 }}>
                重试
              </Button>
            )}
          </div>
        </div>
      );
    }

    if (empty) {
      return (
        <div className="base-card-empty">
          {empty}
        </div>
      );
    }

    return children;
  };

  // 卡片样式类名
  const cardClassName = [
    'base-card',
    getThemeClass(),
    getSizeClass(),
    shadow ? 'base-card-shadow' : '',
    bordered ? '' : 'base-card-no-border',
    fullscreen ? 'base-card-fullscreen' : '',
    className
  ].filter(Boolean).join(' ');

  // 合并样式
  const mergedBodyStyle = {
    ...bodyStyle,
    ...(expanded ? {} : { display: 'none' })
  };

  const mergedHeadStyle = {
    ...headStyle,
    padding: size === 'small' ? '12px 16px' : '16px 24px'
  };

  return (
    <div className={cardClassName}>
      <Card
        {...cardProps}
        title={renderTitle()}
        bordered={bordered}
        styles={{ body: mergedBodyStyle, header: mergedHeadStyle }}
        className="base-card-wrapper"
      >
        {/* 统计信息 */}
        {stats && stats.length > 0 && expanded && renderStats()}

        {/* 描述信息 */}
        {description && expanded && (
          <div className="base-card-description">
            <Text type="secondary">{description}</Text>
          </div>
        )}

        {/* 展开按钮 */}
        {showExpand && (
          <div className="base-card-expand-trigger">
            <Button
              type="text"
              size="small"
              icon={expanded ? <CompressOutlined /> : <ExpandOutlined />}
              onClick={handleExpand}
            >
              {expanded ? '收起' : '展开'}
            </Button>
          </div>
        )}

        {/* 内容区域 */}
        {expanded && renderContent()}
      </Card>

      <style jsx>{`
        .base-card {
          position: relative;
          transition: all 0.3s ease;
        }

        .base-card-shadow {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .base-card-shadow:hover {
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        }

        .base-card-no-border {
          border: none;
        }

        .base-card-fullscreen {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1000;
          border-radius: 0;
        }

        .base-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          width: 100%;
        }

        .base-card-title-section {
          flex: 1;
        }

        .base-card-title {
          margin-bottom: 4px;
        }

        .base-card-subtitle {
          margin-top: 2px;
        }

        .base-card-extra {
          flex-shrink: 0;
          margin-left: 16px;
        }

        .base-card-stats {
          margin-bottom: 16px;
          padding: 16px;
          background: var(--ant-color-bg-container);
          border-radius: 6px;
          border: 1px solid var(--ant-color-border);
        }

        .base-card-stat-item {
          text-align: center;
        }

        .stat-label {
          margin-bottom: 4px;
        }

        .stat-value {
          margin-bottom: 4px;
        }

        .stat-trend {
          font-size: 12px;
        }

        .base-card-description {
          margin-bottom: 16px;
          padding: 12px;
          background: var(--ant-color-bg-container-disabled);
          border-radius: 6px;
        }

        .base-card-expand-trigger {
          text-align: center;
          padding: 8px 0;
          border-top: 1px solid var(--ant-color-border);
        }

        .base-card-loading,
        .base-card-error,
        .base-card-empty {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 200px;
          text-align: center;
        }

        .error-content {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .base-card-dropdown {
          background: white;
          border-radius: 6px;
          box-shadow: 0 3px 6px -4px rgba(0, 0, 0, 0.12);
          border: 1px solid var(--ant-color-border);
          padding: 4px 0;
        }

        .base-card-dropdown-item {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          cursor: pointer;
          transition: background-color 0.3s;
        }

        .base-card-dropdown-item:hover {
          background-color: var(--ant-color-bg-container-disabled);
        }

        .base-card-dropdown-item.danger {
          color: var(--ant-color-error);
        }

        .base-card-dropdown-item.disabled {
          color: var(--ant-color-text-disabled);
          cursor: not-allowed;
        }

        .action-icon {
          margin-right: 8px;
        }

        .action-label {
          flex: 1;
        }

        /* 主题样式 */
        .base-card-default {
          border-color: var(--ant-color-border);
        }

        .base-card-primary {
          border-color: var(--ant-color-primary);
          border-left: 4px solid var(--ant-color-primary);
        }

        .base-card-success {
          border-color: var(--ant-color-success);
          border-left: 4px solid var(--ant-color-success);
        }

        .base-card-warning {
          border-color: var(--ant-color-warning);
          border-left: 4px solid var(--ant-color-warning);
        }

        .base-card-error {
          border-color: var(--ant-color-error);
          border-left: 4px solid var(--ant-color-error);
        }

        /* 尺寸样式 */
        .base-card-small {
          font-size: 12px;
        }

        .base-card-small .base-card-title {
          font-size: 14px;
        }

        .base-card-middle {
          font-size: 14px;
        }

        .base-card-large {
          font-size: 16px;
        }

        .base-card-large .base-card-title {
          font-size: 18px;
        }
      `}</style>
    </div>
  );
}

export default BaseCard;
