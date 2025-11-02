/**
 * DynamicIcon 动态图标组件
 * 艹，这个组件根据字符串名称动态渲染Ant Design图标！
 */

import React from 'react';
import type { CSSProperties } from 'react';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { getIconComponent } from './iconMap';

/**
 * DynamicIcon Props
 */
export interface DynamicIconProps {
  /**
   * 图标名称（字符串）
   * 例如: "UserOutlined", "HomeOutlined"
   */
  icon: string | undefined | null;

  /**
   * 图标大小（px）
   */
  size?: number;

  /**
   * 图标颜色
   */
  color?: string;

  /**
   * 自定义样式
   */
  style?: CSSProperties;

  /**
   * 自定义className
   */
  className?: string;

  /**
   * 点击事件
   */
  onClick?: (e: React.MouseEvent<HTMLSpanElement>) => void;

  /**
   * 图标不存在时的回退组件
   * 默认: QuestionCircleOutlined
   */
  fallback?: React.ReactNode;

  /**
   * 是否在图标不存在时显示警告
   * 默认: true (仅开发环境)
   */
  showWarning?: boolean;

  /**
   * 旋转动画
   */
  spin?: boolean;

  /**
   * 旋转角度（deg）
   */
  rotate?: number;
}

/**
 * DynamicIcon 组件
 * 艹，这个组件智能处理图标渲染，找不到就显示默认图标！
 */
export const DynamicIcon: React.FC<DynamicIconProps> = ({
  icon,
  size,
  color,
  style,
  className,
  onClick,
  fallback,
  showWarning = true,
  spin,
  rotate,
}) => {
  // 艹，没有图标名就返回空或fallback
  if (!icon) {
    if (fallback !== undefined) {
      return <>{fallback}</>;
    }
    return null;
  }

  // 获取图标组件
  const IconComponent = getIconComponent(icon);

  // 艹，找不到图标就显示默认图标
  if (!IconComponent) {
    if (showWarning && process.env.NODE_ENV === 'development') {
      console.warn(`[DynamicIcon] 图标 "${icon}" 不存在，请检查iconMap.ts`);
    }

    // 使用fallback或默认问号图标
    if (fallback !== undefined) {
      return <>{fallback}</>;
    }

    return (
      <QuestionCircleOutlined
        style={{
          fontSize: size,
          color: color || '#999',
          ...style,
        }}
        className={className}
        onClick={onClick}
      />
    );
  }

  // 合并样式
  const mergedStyle: CSSProperties = {
    fontSize: size,
    color,
    ...style,
  };

  // 渲染图标
  return (
    <IconComponent
      style={mergedStyle}
      className={className}
      onClick={onClick}
      spin={spin}
      rotate={rotate}
    />
  );
};

/**
 * DynamicIcon 默认导出
 */
export default DynamicIcon;
