'use client';

/**
 * React Flow节点类型定义
 * 艹，定义PROVIDER/CONDITION/POST_PROCESS/END/FORK/JOIN六种节点！
 */

import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { ApiOutlined, BranchesOutlined, ToolOutlined, CheckCircleOutlined } from '@ant-design/icons';
import ForkNode from './nodes/ForkNode';
import JoinNode from './nodes/JoinNode';

/**
 * Provider节点（AI Provider调用）
 */
export function ProviderNode({ data }: NodeProps) {
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
            {data.label || 'Provider节点'}
          </div>
          {data.providerRef && (
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              {data.providerRef}
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
            {data.label || '条件节点'}
          </div>
          {data.condition && (
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              {data.condition}
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
            {data.label || '后处理'}
          </div>
          {data.processor && (
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              {data.processor}
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
          {data.label || '结束'}
        </div>
      </div>
    </div>
  );
}

/**
 * 节点类型映射 (CMS-206: 新增FORK/JOIN并行节点)
 * 艹，这个tm必须稳定引用，不然React Flow会重新渲染！
 */
export const nodeTypes = {
  provider: ProviderNode,
  condition: ConditionNode,
  postProcess: PostProcessNode,
  end: EndNode,
  fork: ForkNode,
  join: JoinNode,
};
