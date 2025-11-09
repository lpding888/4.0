'use client';

/**
 * React Flow节点类型定义
 * 艹，定义PROVIDER/CONDITION/POST_PROCESS/END/FORK/JOIN六种节点！
 */

import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import type { NodeTypes } from '@xyflow/react';
import { ApiOutlined, BranchesOutlined, ToolOutlined, CheckCircleOutlined } from '@ant-design/icons';
import ForkNode from './nodes/ForkNode';
import JoinNode from './nodes/JoinNode';

type BaseNodeData = {
  label?: React.ReactNode;
};

type ProviderNodeData = BaseNodeData & {
  providerRef?: string;
};

type ConditionNodeData = BaseNodeData & {
  condition?: string;
};

type PostProcessNodeData = BaseNodeData & {
  processor?: string;
};

type EndNodeData = BaseNodeData;

/**
 * Provider节点（AI Provider调用）
 */
export function ProviderNode({ data }: NodeProps) {
  const nodeData = data as ProviderNodeData;
  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        border: '2px solid #1890ff',
        background: '#e6f7ff',
        minWidth: '180px',
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ApiOutlined style={{ fontSize: '18px', color: '#1890ff' }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: '14px' }}>
            {nodeData.label || 'Provider节点'}
          </div>
          {nodeData.providerRef && (
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              {nodeData.providerRef}
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

/**
 * Condition节点（条件判断）
 */
export function ConditionNode({ data }: NodeProps) {
  const nodeData = data as ConditionNodeData;
  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        border: '2px solid #52c41a',
        background: '#f6ffed',
        minWidth: '160px',
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <BranchesOutlined style={{ fontSize: '18px', color: '#52c41a' }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: '14px' }}>
            {nodeData.label || '条件节点'}
          </div>
          {nodeData.condition && (
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              {nodeData.condition}
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} id="true" style={{ left: '30%' }} />
      <Handle type="source" position={Position.Bottom} id="false" style={{ left: '70%' }} />
    </div>
  );
}

/**
 * PostProcess节点（后处理）
 */
export function PostProcessNode({ data }: NodeProps) {
  const nodeData = data as PostProcessNodeData;
  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        border: '2px solid #fa8c16',
        background: '#fff7e6',
        minWidth: '160px',
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ToolOutlined style={{ fontSize: '18px', color: '#fa8c16' }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: '14px' }}>
            {nodeData.label || '后处理'}
          </div>
          {nodeData.processor && (
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              {nodeData.processor}
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

/**
 * End节点（结束）
 */
export function EndNode({ data }: NodeProps) {
  const nodeData = data as EndNodeData;
  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        border: '2px solid #722ed1',
        background: '#f9f0ff',
        minWidth: '120px',
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
        <CheckCircleOutlined style={{ fontSize: '18px', color: '#722ed1' }} />
        <div style={{ fontWeight: 600, fontSize: '14px' }}>
          {nodeData.label || '结束'}
        </div>
      </div>
    </div>
  );
}

/**
 * 节点类型映射 (CMS-206: 新增FORK/JOIN并行节点)
 * 艹，这个tm必须稳定引用，不然React Flow会重新渲染！
 */
export const nodeTypes: NodeTypes = {
  provider: ProviderNode as any,
  condition: ConditionNode as any,
  postProcess: PostProcessNode as any,
  end: EndNode as any,
  fork: ForkNode,
  join: JoinNode,
};
