/**
 * PERF-P2-SSR-204: 模板网格展示组件(客户端组件)
 * 艹!这个组件处理交互逻辑,必须是Client Component!
 *
 * @author 老王
 */

'use client';

import React from 'react';
import { Card, Col, Row, Tag, Typography, Tooltip, Dropdown, Avatar, Space } from 'antd';
import {
  EyeOutlined,
  ThunderboltOutlined,
  HeartOutlined,
  HeartFilled,
  CopyOutlined,
  DeleteOutlined,
  MoreOutlined,
  StarFilled,
  AppstoreOutlined,
} from '@ant-design/icons';
import type { Template } from './types';

const { Text, Paragraph } = Typography;

interface TemplateGridProps {
  templates: Template[];
  typeConfig: any;
  categoryConfig: any;
  complexityConfig: any;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onPreview: (template: Template) => void;
  onUse: (template: Template) => void;
  onCopy: (template: Template) => void;
  onDelete: (id: string) => void;
}

/**
 * 艹!模板网格展示组件 - 负责卡片渲染和交互
 */
export default function TemplateGrid({
  templates,
  typeConfig,
  categoryConfig,
  complexityConfig,
  onToggleFavorite,
  onPreview,
  onUse,
  onCopy,
  onDelete,
}: TemplateGridProps) {
  const getTypeStyle = (type?: string) => {
    if (type && typeConfig?.[type]) {
      return typeConfig[type];
    }
    if (typeConfig?.default) {
      return typeConfig.default;
    }
    return {
      color: '#1890ff',
      icon: <AppstoreOutlined />,
    };
  };
  const getCategoryStyle = (category?: string) => {
    if (category && categoryConfig?.[category]) {
      return categoryConfig[category];
    }
    return categoryConfig?.default || { color: '#d9d9d9', label: '未分类' };
  };
  const getComplexityStyle = (complexity?: string) => {
    if (complexity && complexityConfig?.[complexity]) {
      return complexityConfig[complexity];
    }
    return complexityConfig?.default || { color: '#d9d9d9', label: '未知难度' };
  };

  return (
    <Row gutter={[16, 16]}>
      {templates.map(template => {
        const typeStyle = getTypeStyle(template.type);
        const categoryStyle = getCategoryStyle(template.category);
        const complexityStyle = getComplexityStyle(template.complexity);

        return (
        <Col key={template.id} xs={24} sm={12} lg={8} xl={6}>
          <Card
            hoverable
            cover={
              <div
                style={{
                  height: 160,
                  background: `linear-gradient(135deg, ${typeStyle.color} 0%, ${typeStyle.color}dd 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: 48
                }}
              >
                {typeStyle.icon}
              </div>
            }
            actions={[
              <Tooltip key="preview" title="预览">
                <EyeOutlined onClick={() => onPreview(template)} />
              </Tooltip>,
              <Tooltip key="use" title="使用">
                <ThunderboltOutlined onClick={() => onUse(template)} />
              </Tooltip>,
              <Tooltip key="favorite" title="收藏">
                {template.isFavorite ? (
                  <HeartFilled
                    style={{ color: '#ff4d4f' }}
                    onClick={(e) => onToggleFavorite(template.id, e)}
                  />
                ) : (
                  <HeartOutlined onClick={(e) => onToggleFavorite(template.id, e)} />
                )}
              </Tooltip>,
              <Dropdown
                key="more"
                overlay={
                  <div style={{ background: 'white', borderRadius: 6, boxShadow: '0 3px 6px -4px rgba(0,0,0,.12)' }}>
                    <div
                      style={{ padding: '8px 12px', cursor: 'pointer' }}
                      onClick={() => onCopy(template)}
                    >
                      <CopyOutlined style={{ marginRight: 8 }} />
                      复制模板
                    </div>
                    {!template.isOfficial && (
                      <div
                        style={{ padding: '8px 12px', cursor: 'pointer', color: '#ff4d4f' }}
                        onClick={() => onDelete(template.id)}
                      >
                        <DeleteOutlined style={{ marginRight: 8 }} />
                        删除模板
                      </div>
                    )}
                  </div>
                }
                trigger={['click']}
              >
                <MoreOutlined />
              </Dropdown>
            ]}
          >
            <Card.Meta
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text strong style={{ flex: 1 }}>{template.name}</Text>
                  {template.isOfficial && (
                    <Tag color="gold">官方</Tag>
                  )}
                </div>
              }
              description={
                <div>
                  <Paragraph
                    ellipsis={{ rows: 2 }}
                    style={{ marginBottom: 8, height: 40 }}
                  >
                    {template.description}
                  </Paragraph>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Tag color={categoryStyle.color}>
                      {categoryStyle.label}
                    </Tag>
                    <Tag color={complexityStyle.color}>
                      {complexityStyle.label}
                    </Tag>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Space size="small">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <StarFilled style={{ color: '#faad14', fontSize: 12 }} />
                        <Text style={{ fontSize: 12 }}>{template.rating}</Text>
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {template.usageCount} 次使用
                      </Text>
                    </Space>
                    <Avatar size="small" src={template.author?.avatar} />
                  </div>
                </div>
              }
            />
          </Card>
        </Col>
        );
      })}
    </Row>
  );
}
