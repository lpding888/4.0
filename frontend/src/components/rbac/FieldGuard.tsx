/**
 * 字段级权限守卫组件
 * 艹！这个组件控制字段的显示、编辑和脱敏！
 *
 * @author 老王
 */

'use client';

import React from 'react';
import { Tooltip } from 'antd';
import { EyeInvisibleOutlined } from '@ant-design/icons';
import { useAbility } from '@/hooks/useAbility';
import type { Resource } from '@/lib/rbac/acl';

/**
 * FieldGuard组件Props
 */
interface FieldGuardProps {
  /** 资源类型 */
  resource: Resource;

  /** 字段名 */
  field: string;

  /** 字段值 */
  value: any;

  /** 是否为编辑模式（可选，默认false） */
  editable?: boolean;

  /** 子组件（可选，用于自定义渲染） */
  children?: React.ReactNode;

  /** 无权限时的fallback（可选） */
  fallback?: React.ReactNode;
}

/**
 * 字段级权限守卫组件
 *
 * 使用示例:
 * ```tsx
 * // 只读模式（自动判断是否脱敏）
 * <FieldGuard resource="user" field="email" value={user.email} />
 *
 * // 编辑模式（检查是否可编辑）
 * <FieldGuard resource="user" field="phone" value={user.phone} editable>
 *   <Input />
 * </FieldGuard>
 *
 * // 自定义无权限fallback
 * <FieldGuard
 *   resource="billing"
 *   field="payment_method"
 *   value={order.payment_method}
 *   fallback={<Text type="secondary">无权限查看</Text>}
 * />
 * ```
 */
export const FieldGuard: React.FC<FieldGuardProps> = ({
  resource,
  field,
  value,
  editable = false,
  children,
  fallback,
}) => {
  const { canViewField, canEditField, isFieldMasked } = useAbility();

  // 检查查看权限
  const canView = canViewField(resource, field);
  const canEdit = editable && canEditField(resource, field);
  const needMask = isFieldMasked(resource, field);

  // 无查看权限
  if (!canView) {
    return (
      <>
        {fallback || (
          <Tooltip title="无权限查看此字段">
            <span style={{ color: '#999', cursor: 'not-allowed' }}>
              <EyeInvisibleOutlined /> ***
            </span>
          </Tooltip>
        )}
      </>
    );
  }

  // 编辑模式但无编辑权限
  if (editable && !canEdit) {
    // 显示只读值
    return <span style={{ color: '#999' }}>{needMask ? maskValue(value) : value}</span>;
  }

  // 有编辑权限且提供了children（自定义编辑组件）
  if (editable && canEdit && children) {
    return <>{children}</>;
  }

  // 只读模式：显示值（可能需要脱敏）
  const displayValue = needMask ? maskValue(value) : value;

  return (
    <span>
      {displayValue}
      {needMask && (
        <Tooltip title="已脱敏处理">
          <EyeInvisibleOutlined style={{ marginLeft: 4, color: '#999', fontSize: 12 }} />
        </Tooltip>
      )}
    </span>
  );
};

/**
 * 脱敏处理辅助函数
 */
function maskValue(value: any): string {
  if (!value) return '***';

  const str = String(value);

  // 邮箱脱敏
  if (str.includes('@')) {
    const [name, domain] = str.split('@');
    return `${name!.slice(0, 2)}***@${domain}`;
  }

  // 手机号脱敏
  if (/^1[3-9]\d{9}$/.test(str)) {
    return str.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  }

  // 银行卡脱敏
  if (/^\d{16,19}$/.test(str)) {
    return str.replace(/(\d{4})\d+(\d{4})/, '$1 **** **** $2');
  }

  // 其他字符串脱敏
  if (str.length > 4) {
    return str.slice(0, 2) + '***' + str.slice(-2);
  }

  return '***';
}
