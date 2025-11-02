/**
 * Step 3: 流程编排步骤（CMS-208核心）
 * 艹！集成React Flow可视化编排Pipeline！
 */

'use client';

import { useState, useCallback } from 'react';
import { Card, Button, Space, message, Alert } from 'antd';
import { SaveOutlined, EyeOutlined } from '@ant-design/icons';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  BackgroundVariant,
  Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from '@/components/flow/NodeTypes';
import NodeInspector from '@/app/admin/pipelines/editor/components/NodeInspector';

interface PipelineEditorStepProps {
  data: any;
  onUpdate: (data: any) => void;
  onNext: () => void;
  onPrev: () => void;
}

/**
 * 初始节点
 */
const initialNodes: Node[] = [
  {
    id: 'start',
    type: 'start',
    position: { x: 250, y: 50 },
    data: { label: '开始' },
  },
];

const initialEdges: any[] = [];

export default function PipelineEditorStep({
  data,
  onUpdate,
  onNext,
  onPrev,
}: PipelineEditorStepProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    data.pipeline_schema_data?.nodes || initialNodes
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    data.pipeline_schema_data?.edges || initialEdges
  );
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  /**
   * 连线回调
   */
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  /**
   * 节点点击回调
   */
  const onNodeClick = useCallback((_event: any, node: Node) => {
    setSelectedNode(node);
  }, []);

  /**
   * 添加Provider节点
   */
  const handleAddProviderNode = () => {
    const newNode: Node = {
      id: `provider-${Date.now()}`,
      type: 'provider',
      position: { x: 250, y: nodes.length * 150 + 50 },
      data: { label: '新Provider节点', providerRef: '' },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  /**
   * 保存Pipeline Schema
   */
  const handleSavePipeline = () => {
    if (nodes.length === 0) {
      message.warning('Pipeline为空，请至少添加一个节点');
      return;
    }

    // 更新Feature数据
    onUpdate({
      pipeline_schema_id: `pipeline-${data.feature_id}`,
      pipeline_schema_data: {
        nodes,
        edges,
      },
    });

    message.success('Pipeline已保存');
  };

  /**
   * 下一步（保存并继续）
   */
  const handleNext = () => {
    handleSavePipeline();
    onNext();
  };

  return (
    <Card
      title="流程编排 - Pipeline可视化编辑器"
      extra={
        <Space>
          <Button onClick={handleAddProviderNode}>添加Provider节点</Button>
          <Button icon={<SaveOutlined />} onClick={handleSavePipeline}>
            保存Pipeline
          </Button>
          <Button icon={<EyeOutlined />} type="primary" onClick={handleNext}>
            下一步：预览发布
          </Button>
        </Space>
      }
    >
      <Alert
        message="操作提示"
        description="从左侧添加节点，拖拽连线构建Pipeline流程。点击节点可在右侧配置详细参数。"
        type="info"
        showIcon
        style={{ marginBottom: '16px' }}
        closable
      />

      <div style={{ display: 'flex', gap: '16px' }}>
        {/* React Flow画布 */}
        <div style={{ flex: 1, height: '600px', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
          >
            <Controls />
            <MiniMap />
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          </ReactFlow>
        </div>

        {/* 节点配置面板 */}
        <div style={{ width: '350px' }}>
          {selectedNode ? (
            <NodeInspector
              nodeId={selectedNode.id}
              nodeType={selectedNode.type}
              nodeData={selectedNode.data}
              onChange={(nodeId, newData) => {
                setNodes((nds) =>
                  nds.map((node) =>
                    node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node
                  )
                );
              }}
            />
          ) : (
            <Card title="节点配置">
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                请选择一个节点进行配置
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* 底部操作栏 */}
      <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={onPrev}>上一步</Button>
        <Space>
          <Button onClick={handleSavePipeline}>保存Pipeline</Button>
          <Button type="primary" onClick={handleNext}>
            下一步：预览发布
          </Button>
        </Space>
      </div>
    </Card>
  );
}
