/**
 * Pipeline校验结果面板 (CMS-209)
 * 艹！显示错误和警告列表，支持点击定位节点！
 */

'use client';

import React from 'react';
import { Alert, Card, List, Tag, Space, Button, Divider } from 'antd';
import { CheckCircleOutlined, WarningOutlined, CloseCircleOutlined, AimOutlined } from '@ant-design/icons';

/**
 * 校验结果接口
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary?: {
    nodesCount: number;
    edgesCount: number;
    errorsCount: number;
    warningsCount: number;
  };
}

/**
 * ValidationPanel Props
 */
export interface ValidationPanelProps {
  /** 校验结果 */
  validation: ValidationResult | null;

  /** 是否正在校验 */
  loading?: boolean;

  /** 点击错误时的回调（用于定位节点） */
  onErrorClick?: (error: string) => void;

  /** 点击警告时的回调 */
  onWarningClick?: (warning: string) => void;

  /** 重新校验 */
  onRevalidate?: () => void;
}

/**
 * 从错误消息中提取节点ID
 * 艹！解析错误消息，找到节点ID以便定位！
 *
 * @param message - 错误消息，如 'Start节点 "start-1" 的入度必须为0'
 * @returns 节点ID，如 "start-1"
 */
function extractNodeIdFromMessage(message: string): string | null {
  // 匹配引号中的节点ID: "xxx"
  const match = message.match(/"([^"]+)"/);
  return match && match[1] ? match[1] : null;
}

/**
 * ValidationPanel组件
 * 艹！这个组件显示Pipeline校验结果，支持点击错误定位节点！
 */
export const ValidationPanel: React.FC<ValidationPanelProps> = ({
  validation,
  loading = false,
  onErrorClick,
  onWarningClick,
  onRevalidate,
}) => {
  /**
   * 处理错误项点击
   */
  const handleErrorClick = (error: string) => {
    const nodeId = extractNodeIdFromMessage(error);

    if (nodeId) {
      console.log('[ValidationPanel] 定位节点:', nodeId);
      onErrorClick?.(nodeId);
    } else {
      console.log('[ValidationPanel] 无法从错误消息中提取节点ID:', error);
      onErrorClick?.(error);
    }
  };

  /**
   * 处理警告项点击
   */
  const handleWarningClick = (warning: string) => {
    const nodeId = extractNodeIdFromMessage(warning);

    if (nodeId) {
      console.log('[ValidationPanel] 定位节点:', nodeId);
      onWarningClick?.(nodeId);
    } else {
      onWarningClick?.(warning);
    }
  };

  // 如果没有校验结果
  if (!validation && !loading) {
    return (
      <Card title="校验结果" size="small">
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>
          <WarningOutlined style={{ fontSize: '32px', marginBottom: '12px' }} />
          <p style={{ margin: 0 }}>尚未进行校验</p>
          {onRevalidate && (
            <Button type="primary" size="small" onClick={onRevalidate} style={{ marginTop: '12px' }}>
              立即校验
            </Button>
          )}
        </div>
      </Card>
    );
  }

  // 加载中
  if (loading) {
    return (
      <Card title="校验结果" size="small" loading={true}>
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <p>正在校验中...</p>
        </div>
      </Card>
    );
  }

  if (!validation) return null;

  const { valid, errors = [], warnings = [], summary } = validation;

  return (
    <Card
      title={
        <Space>
          <span>校验结果</span>
          {valid ? (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              通过
            </Tag>
          ) : (
            <Tag color="error" icon={<CloseCircleOutlined />}>
              不通过
            </Tag>
          )}
        </Space>
      }
      size="small"
      extra={
        onRevalidate && (
          <Button size="small" onClick={onRevalidate}>
            重新校验
          </Button>
        )
      }
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      bodyStyle={{ flex: 1, overflow: 'auto' }}
    >
      {/* 总结信息 */}
      {summary && (
        <div style={{ marginBottom: '16px' }}>
          <Space wrap>
            <Tag>节点: {summary.nodesCount}</Tag>
            <Tag>连线: {summary.edgesCount}</Tag>
            <Tag color={summary.errorsCount > 0 ? 'red' : 'default'}>
              错误: {summary.errorsCount}
            </Tag>
            <Tag color={summary.warningsCount > 0 ? 'orange' : 'default'}>
              警告: {summary.warningsCount}
            </Tag>
          </Space>
        </div>
      )}

      {/* 通过校验 */}
      {valid && errors.length === 0 && (
        <Alert
          message="校验通过"
          description="Pipeline拓扑结构合法，所有变量引用正确。"
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          style={{ marginBottom: '16px' }}
        />
      )}

      {/* 错误列表 */}
      {errors.length > 0 && (
        <div style={{ marginBottom: warnings.length > 0 ? '16px' : 0 }}>
          <div style={{ fontWeight: 500, marginBottom: '8px', color: '#ff4d4f' }}>
            <CloseCircleOutlined style={{ marginRight: '6px' }} />
            错误 ({errors.length}):
          </div>
          <List
            size="small"
            bordered
            dataSource={errors}
            renderItem={(error, index) => (
              <List.Item
                key={index}
                style={{ cursor: onErrorClick ? 'pointer' : 'default' }}
                onClick={() => handleErrorClick(error)}
                extra={
                  onErrorClick && extractNodeIdFromMessage(error) ? (
                    <Button type="link" size="small" icon={<AimOutlined />}>
                      定位
                    </Button>
                  ) : null
                }
              >
                <List.Item.Meta
                  avatar={<CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: '16px' }} />}
                  description={
                    <span style={{ color: '#ff4d4f', fontSize: '13px' }}>
                      {error}
                    </span>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      )}

      {/* 警告列表 */}
      {warnings.length > 0 && (
        <div>
          {errors.length > 0 && <Divider style={{ margin: '12px 0' }} />}
          <div style={{ fontWeight: 500, marginBottom: '8px', color: '#faad14' }}>
            <WarningOutlined style={{ marginRight: '6px' }} />
            警告 ({warnings.length}):
          </div>
          <List
            size="small"
            bordered
            dataSource={warnings}
            renderItem={(warning, index) => (
              <List.Item
                key={index}
                style={{ cursor: onWarningClick ? 'pointer' : 'default' }}
                onClick={() => handleWarningClick(warning)}
                extra={
                  onWarningClick && extractNodeIdFromMessage(warning) ? (
                    <Button type="link" size="small" icon={<AimOutlined />}>
                      定位
                    </Button>
                  ) : null
                }
              >
                <List.Item.Meta
                  avatar={<WarningOutlined style={{ color: '#faad14', fontSize: '16px' }} />}
                  description={
                    <span style={{ color: '#faad14', fontSize: '13px' }}>
                      {warning}
                    </span>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      )}
    </Card>
  );
};

export default ValidationPanel;
