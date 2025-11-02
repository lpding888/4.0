/**
 * Step 4: 预览发布步骤
 * 艹！最终确认并发布Feature！
 */

'use client';

import { useState } from 'react';
import { Card, Button, Space, Descriptions, Tag, Alert, Modal, message, Divider } from 'antd';
import { LeftOutlined, CheckCircleOutlined, EyeOutlined, RocketOutlined } from '@ant-design/icons';
import { ReactFlow, Background, Controls, BackgroundVariant } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface PreviewPublishStepProps {
  data: any;
  onFinish: () => void;
  onPrev: () => void;
}

export default function PreviewPublishStep({
  data,
  onFinish,
  onPrev,
}: PreviewPublishStepProps) {
  const [loading, setLoading] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);

  /**
   * 发布Feature
   */
  const handlePublish = () => {
    Modal.confirm({
      title: '确认发布Feature？',
      content: (
        <div>
          <p>确认要发布以下Feature吗？</p>
          <p>
            <strong>Feature ID:</strong> {data.feature_id}
          </p>
          <p>
            <strong>显示名称:</strong> {data.display_name}
          </p>
          <Alert
            message="发布后用户将可以看到并使用此功能"
            type="info"
            showIcon
            style={{ marginTop: '12px' }}
          />
        </div>
      ),
      okText: '确认发布',
      cancelText: '取消',
      onOk: async () => {
        setLoading(true);
        try {
          // 调用onFinish回调（会触发API调用）
          await onFinish();
        } catch (error: any) {
          message.error(`发布失败: ${error.message}`);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  /**
   * 获取Pipeline节点/边数
   */
  const getPipelineStats = () => {
    if (!data.pipeline_schema_data) {
      return { nodes: 0, edges: 0 };
    }

    return {
      nodes: data.pipeline_schema_data.nodes?.length || 0,
      edges: data.pipeline_schema_data.edges?.length || 0,
    };
  };

  const pipelineStats = getPipelineStats();

  return (
    <Card
      title="Step 4: 预览发布"
      extra={<Tag color="green">最终确认</Tag>}
    >
      <Alert
        message="操作提示"
        description="请仔细检查所有配置，确认无误后点击"发布Feature"按钮。"
        type="success"
        showIcon
        style={{ marginBottom: '24px' }}
        closable
      />

      {/* 基本信息预览 */}
      <Card
        title="基本信息"
        size="small"
        style={{ marginBottom: '16px' }}
        headStyle={{ background: '#fafafa' }}
      >
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Feature ID">
            <code style={{ padding: '2px 6px', background: '#f0f0f0', borderRadius: '3px' }}>
              {data.feature_id || '-'}
            </code>
          </Descriptions.Item>
          <Descriptions.Item label="显示名称">{data.display_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="功能描述" span={2}>
            {data.description || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="功能分类">
            <Tag color="blue">{data.category || '-'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="图标">
            <Tag>{data.icon || '-'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="所需会员计划">
            <Tag color={
              data.plan_required === 'free' ? 'green' :
              data.plan_required === 'basic' ? 'blue' :
              data.plan_required === 'pro' ? 'purple' : 'red'
            }>
              {data.plan_required?.toUpperCase() || '-'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="访问控制">
            <Tag color="orange">{data.access_scope || '-'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="配额消耗">
            {data.quota_cost || 0} 点/次
          </Descriptions.Item>
          <Descriptions.Item label="速率限制">
            {data.rate_limit_policy || '无限制'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 表单Schema预览 */}
      <Card
        title="表单配置"
        size="small"
        style={{ marginBottom: '16px' }}
        headStyle={{ background: '#fafafa' }}
      >
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Form Schema ID">
            <code style={{ padding: '2px 6px', background: '#f0f0f0', borderRadius: '3px' }}>
              {data.form_schema_id || '-'}
            </code>
            {data._newSchema && (
              <Tag color="orange" style={{ marginLeft: '8px' }}>新建</Tag>
            )}
          </Descriptions.Item>
        </Descriptions>
        {!data.form_schema_id && (
          <Alert
            message="未配置Form Schema"
            type="warning"
            showIcon
            style={{ marginTop: '12px' }}
          />
        )}
      </Card>

      {/* Pipeline预览 */}
      <Card
        title={
          <Space>
            <span>流程编排</span>
            <Tag color="cyan">{pipelineStats.nodes} 节点</Tag>
            <Tag color="cyan">{pipelineStats.edges} 连线</Tag>
          </Space>
        }
        size="small"
        style={{ marginBottom: '16px' }}
        headStyle={{ background: '#fafafa' }}
        extra={
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setPreviewModalVisible(true)}
            disabled={!data.pipeline_schema_data || pipelineStats.nodes === 0}
          >
            预览Pipeline
          </Button>
        }
      >
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Pipeline Schema ID">
            <code style={{ padding: '2px 6px', background: '#f0f0f0', borderRadius: '3px' }}>
              {data.pipeline_schema_id || '-'}
            </code>
          </Descriptions.Item>
          <Descriptions.Item label="节点数">{pipelineStats.nodes}</Descriptions.Item>
          <Descriptions.Item label="连线数">{pipelineStats.edges}</Descriptions.Item>
        </Descriptions>
        {pipelineStats.nodes === 0 && (
          <Alert
            message="Pipeline为空，至少需要一个节点"
            type="warning"
            showIcon
            style={{ marginTop: '12px' }}
          />
        )}
      </Card>

      {/* Pipeline预览弹窗 */}
      <Modal
        title="Pipeline流程预览"
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        footer={null}
        width={800}
      >
        <div style={{ height: '500px', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
          {data.pipeline_schema_data && (
            <ReactFlow
              nodes={data.pipeline_schema_data.nodes || []}
              edges={data.pipeline_schema_data.edges || []}
              fitView
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
            >
              <Controls showInteractive={false} />
              <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
            </ReactFlow>
          )}
        </div>
      </Modal>

      {/* 验证提示 */}
      <Divider />
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontWeight: 500, marginBottom: '12px' }}>发布前检查:</div>
        <Space direction="vertical" style={{ width: '100%' }}>
          {/* 检查Feature ID */}
          {data.feature_id ? (
            <div style={{ color: '#52c41a' }}>
              <CheckCircleOutlined /> Feature ID已配置
            </div>
          ) : (
            <div style={{ color: '#ff4d4f' }}>✗ Feature ID未配置</div>
          )}

          {/* 检查显示名称 */}
          {data.display_name ? (
            <div style={{ color: '#52c41a' }}>
              <CheckCircleOutlined /> 显示名称已配置
            </div>
          ) : (
            <div style={{ color: '#ff4d4f' }}>✗ 显示名称未配置</div>
          )}

          {/* 检查Form Schema */}
          {data.form_schema_id ? (
            <div style={{ color: '#52c41a' }}>
              <CheckCircleOutlined /> Form Schema已配置
            </div>
          ) : (
            <div style={{ color: '#faad14' }}>⚠ Form Schema未配置（可选）</div>
          )}

          {/* 检查Pipeline */}
          {pipelineStats.nodes > 0 ? (
            <div style={{ color: '#52c41a' }}>
              <CheckCircleOutlined /> Pipeline已配置 ({pipelineStats.nodes} 节点)
            </div>
          ) : (
            <div style={{ color: '#ff4d4f' }}>✗ Pipeline为空，至少需要一个节点</div>
          )}
        </Space>
      </div>

      {/* 底部操作栏 */}
      <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between' }}>
        <Button icon={<LeftOutlined />} onClick={onPrev}>
          上一步
        </Button>
        <Button
          type="primary"
          icon={<RocketOutlined />}
          onClick={handlePublish}
          loading={loading}
          disabled={!data.feature_id || !data.display_name || pipelineStats.nodes === 0}
        >
          发布Feature
        </Button>
      </div>
    </Card>
  );
}
