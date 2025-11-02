/**
 * FORK节点组件 (CMS-206)
 * 艹！将执行流分叉到多个并行分支！
 */

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Tag } from 'antd';
import { BranchesOutlined } from '@ant-design/icons';

interface ForkNodeProps {
  data: {
    label?: string;
    branches?: number; // 分支数量
    [key: string]: any;
  };
}

/**
 * FORK节点
 * 艹！一个输入，多个输出！
 */
export const ForkNode: React.FC<ForkNodeProps> = ({ data }) => {
  const branches = data.branches || 2; // 默认2个分支

  return (
    <div
      style={{
        padding: '12px 16px',
        border: '2px solid #1890ff',
        borderRadius: '8px',
        background: 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)',
        minWidth: '150px',
        position: 'relative',
      }}
    >
      {/* 输入Handle */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: '#1890ff',
          width: '12px',
          height: '12px',
          border: '2px solid #fff',
        }}
      />

      {/* 节点内容 */}
      <div style={{ textAlign: 'center' }}>
        <BranchesOutlined style={{ fontSize: '20px', color: '#1890ff', marginBottom: '6px' }} />
        <div style={{ fontWeight: 600, fontSize: '14px', color: '#1890ff', marginBottom: '4px' }}>
          {data.label || 'FORK'}
        </div>
        <Tag color="blue" style={{ fontSize: '11px' }}>
          {branches} 个分支
        </Tag>
      </div>

      {/* 输出Handles - 多个 */}
      {Array.from({ length: branches }).map((_, index) => (
        <Handle
          key={`branch-${index}`}
          type="source"
          position={Position.Bottom}
          id={`branch-${index}`}
          style={{
            background: '#1890ff',
            width: '10px',
            height: '10px',
            border: '2px solid #fff',
            left: `${((index + 1) * 100) / (branches + 1)}%`,
          }}
        />
      ))}
    </div>
  );
};

export default ForkNode;
