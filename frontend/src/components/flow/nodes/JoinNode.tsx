/**
 * JOIN节点组件 (CMS-206)
 * 艹！汇合多个并行分支的执行流！
 */

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Tag } from 'antd';
import { MergeCellsOutlined } from '@ant-design/icons';

interface JoinNodeProps {
  data: {
    label?: string;
    strategy?: 'ALL' | 'ANY' | 'FIRST'; // 汇合策略
    [key: string]: any;
  };
}

/**
 * JOIN节点
 * 艹！多个输入，一个输出！
 */
export const JoinNode: React.FC<JoinNodeProps> = ({ data }) => {
  const strategy = data.strategy || 'ALL'; // 默认ALL策略

  const strategyColors = {
    ALL: '#52c41a',
    ANY: '#faad14',
    FIRST: '#1890ff',
  };

  const strategyDescriptions = {
    ALL: '等待所有分支',
    ANY: '任一分支完成',
    FIRST: '首个完成分支',
  };

  return (
    <div
      style={{
        padding: '12px 16px',
        border: `2px solid ${strategyColors[strategy]}`,
        borderRadius: '8px',
        background: `linear-gradient(135deg, ${strategyColors[strategy]}22 0%, ${strategyColors[strategy]}44 100%)`,
        minWidth: '150px',
        position: 'relative',
      }}
    >
      {/* 输入Handles - 多个 */}
      <Handle
        type="target"
        position={Position.Top}
        id="branch-0"
        style={{
          background: strategyColors[strategy],
          width: '10px',
          height: '10px',
          border: '2px solid #fff',
          left: '30%',
        }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="branch-1"
        style={{
          background: strategyColors[strategy],
          width: '10px',
          height: '10px',
          border: '2px solid #fff',
          left: '50%',
        }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="branch-2"
        style={{
          background: strategyColors[strategy],
          width: '10px',
          height: '10px',
          border: '2px solid #fff',
          left: '70%',
        }}
      />

      {/* 节点内容 */}
      <div style={{ textAlign: 'center' }}>
        <MergeCellsOutlined
          style={{ fontSize: '20px', color: strategyColors[strategy], marginBottom: '6px' }}
        />
        <div
          style={{
            fontWeight: 600,
            fontSize: '14px',
            color: strategyColors[strategy],
            marginBottom: '4px',
          }}
        >
          {data.label || 'JOIN'}
        </div>
        <Tag color={strategy === 'ALL' ? 'green' : strategy === 'ANY' ? 'orange' : 'blue'} style={{ fontSize: '11px' }}>
          {strategyDescriptions[strategy]}
        </Tag>
      </div>

      {/* 输出Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: strategyColors[strategy],
          width: '12px',
          height: '12px',
          border: '2px solid #fff',
        }}
      />
    </div>
  );
};

export default JoinNode;
