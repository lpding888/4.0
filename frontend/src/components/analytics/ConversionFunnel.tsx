/**
 * 转化漏斗可视化组件
 * 艹！这个组件绘制漏斗图，展示转化路径！
 *
 * @author 老王
 */

import React from 'react';
import { Typography } from 'antd';
import type { FunnelStep } from '@/app/admin/analytics/funnel/page';

const { Text } = Typography;

/**
 * ConversionFunnel Props
 */
interface ConversionFunnelProps {
  steps: FunnelStep[];
  height?: number; // 漏斗图高度
}

/**
 * 转化漏斗可视化组件
 */
export const ConversionFunnel: React.FC<ConversionFunnelProps> = ({ steps, height = 600 }) => {
  if (steps.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>暂无数据</div>;
  }

  // 计算每个步骤的宽度（基于第一步的100%）
  const maxCount = steps[0]?.count ?? 0;
  const stepHeight = (height - (steps.length - 1) * 20) / steps.length; // 每个步骤的高度（扣除间隔）

  return (
    <div style={{ width: '100%', padding: '20px 0' }}>
      <svg width="100%" height={height} viewBox={`0 0 800 ${height}`}>
        {/* 绘制漏斗 */}
        {steps.map((step, index) => {
          const widthPercentage = maxCount > 0 ? (step.count / maxCount) * 100 : 0;
          const width = (widthPercentage / 100) * 600; // 最大宽度600
          const x = (800 - width) / 2; // 居中
          const y = index * (stepHeight + 20);

          // 颜色渐变（从蓝到红）
          const hue = 200 - (index / (steps.length - 1)) * 60; // 200(蓝) -> 140(绿)
          const color = `hsl(${hue}, 70%, 60%)`;
          const darkColor = `hsl(${hue}, 70%, 50%)`;

          return (
            <g key={index}>
              {/* 漏斗梯形 */}
              <defs>
                <linearGradient id={`gradient-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={darkColor} stopOpacity={0.9} />
                </linearGradient>
              </defs>

              {index === 0 ? (
                // 第一步：矩形
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={stepHeight}
                  fill={`url(#gradient-${index})`}
                  stroke={darkColor}
                  strokeWidth={2}
                  rx={4}
                />
              ) : (
                // 后续步骤：梯形（使用polygon）
                <>
                  {(() => {
                    const prevStep = steps[index - 1];
                    const prevWidthPercentage =
                      maxCount > 0 && prevStep ? (prevStep.count / maxCount) * 100 : 0;
                    const prevWidth = (prevWidthPercentage / 100) * 600;
                    const prevX = (800 - prevWidth) / 2;

                    return (
                      <polygon
                        points={`
                          ${prevX},${y}
                          ${prevX + prevWidth},${y}
                          ${x + width},${y + stepHeight}
                          ${x},${y + stepHeight}
                        `}
                        fill={`url(#gradient-${index})`}
                        stroke={darkColor}
                        strokeWidth={2}
                      />
                    );
                  })()}
                </>
              )}

              {/* 步骤名称 */}
              <text
                x={400}
                y={y + stepHeight / 2 - 20}
                textAnchor="middle"
                fill="white"
                fontSize="18"
                fontWeight="bold"
              >
                {step.name}
              </text>

              {/* 用户数 */}
              <text
                x={400}
                y={y + stepHeight / 2 + 5}
                textAnchor="middle"
                fill="white"
                fontSize="24"
                fontWeight="bold"
              >
                {step.count.toLocaleString()}
              </text>

              {/* 转化率 */}
              {index > 0 && (
                <text
                  x={400}
                  y={y + stepHeight / 2 + 30}
                  textAnchor="middle"
                  fill="white"
                  fontSize="16"
                >
                  转化率: {step.conversion_rate.toFixed(2)}%
                </text>
              )}

              {/* 流失箭头和文字（在步骤之间） */}
              {index < steps.length - 1 && (
                <>
                  {/* 流失数量文字（右侧） */}
                  <text
                    x={x + width + 20}
                    y={y + stepHeight + 10}
                    textAnchor="start"
                    fill="#ff4d4f"
                    fontSize="14"
                    fontWeight="bold"
                  >
                    ↓ 流失 {step.drop_count.toLocaleString()} ({step.drop_rate.toFixed(1)}%)
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* 图例说明 */}
      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <Text type="secondary">
          💡 提示：漏斗宽度代表用户数量，颜色从蓝到绿表示转化进度
        </Text>
      </div>
    </div>
  );
};
