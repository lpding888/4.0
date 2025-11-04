/**
 * 租户切换器
 * 艹！这个组件让用户在多个租户之间切换！
 *
 * @author 老王
 */

'use client';

import React, { useEffect } from 'react';
import { Dropdown, Avatar, Space, Typography, Badge, Spin, message } from 'antd';
import {
  TeamOutlined,
  UserOutlined,
  CrownOutlined,
  CheckOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useTenant } from '@/store/tenant';

const { Text } = Typography;

/**
 * 租户类型图标
 */
const TENANT_TYPE_ICON = {
  personal: <UserOutlined />,
  team: <TeamOutlined />,
  enterprise: <CrownOutlined />,
};

/**
 * 租户类型标签
 */
const TENANT_TYPE_LABEL = {
  personal: '个人',
  team: '团队',
  enterprise: '企业',
};

/**
 * 租户切换器组件
 */
export const TenantSwitcher: React.FC = () => {
  const { activeTenant, tenants, isLoading, fetchTenants, setTenant } = useTenant();

  /**
   * 初始化：加载租户列表
   */
  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  /**
   * 切换租户
   */
  const handleSwitchTenant = (tenantId: string) => {
    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant) {
      message.error('租户不存在');
      return;
    }

    if (tenant.id === activeTenant?.id) {
      // 已经是当前租户
      return;
    }

    // 切换租户
    setTenant(tenant);
    message.success(`已切换到：${tenant.name}`);
  };

  /**
   * 构建下拉菜单
   */
  const menuItems: MenuProps['items'] = tenants.map((tenant) => ({
    key: tenant.id,
    label: (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minWidth: 200,
          padding: '4px 0',
        }}
      >
        <Space>
          {/* 租户头像 */}
          <Avatar
            size={32}
            src={tenant.avatar}
            icon={TENANT_TYPE_ICON[tenant.type]}
            style={{
              backgroundColor: tenant.type === 'enterprise' ? '#722ed1' : tenant.type === 'team' ? '#1890ff' : '#52c41a',
            }}
          />

          {/* 租户信息 */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Text strong>{tenant.name}</Text>
              {tenant.id === activeTenant?.id && (
                <CheckOutlined style={{ color: '#52c41a', fontSize: 12 }} />
              )}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {TENANT_TYPE_LABEL[tenant.type]} · {tenant.role === 'owner' ? '拥有者' : tenant.role === 'admin' ? '管理员' : tenant.role === 'member' ? '成员' : '访客'}
              {tenant.member_count !== undefined && ` · ${tenant.member_count} 人`}
            </Text>
          </div>
        </Space>

        {/* 当前租户标记 */}
        {tenant.id === activeTenant?.id && (
          <Badge status="processing" />
        )}
      </div>
    ),
    onClick: () => handleSwitchTenant(tenant.id),
  }));

  /**
   * 加载中状态
   */
  if (isLoading && !activeTenant) {
    return (
      <div style={{ padding: '0 16px' }}>
        <Spin size="small" />
      </div>
    );
  }

  /**
   * 没有租户
   */
  if (!activeTenant) {
    return null;
  }

  return (
    <Dropdown
      menu={{ items: menuItems }}
      placement="bottomRight"
      trigger={['click']}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 12px',
          borderRadius: 8,
          cursor: 'pointer',
          transition: 'all 0.2s',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        }}
      >
        {/* 租户头像 */}
        <Avatar
          size={28}
          src={activeTenant.avatar}
          icon={TENANT_TYPE_ICON[activeTenant.type]}
          style={{
            backgroundColor:
              activeTenant.type === 'enterprise'
                ? '#722ed1'
                : activeTenant.type === 'team'
                  ? '#1890ff'
                  : '#52c41a',
          }}
        />

        {/* 租户名称 */}
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <Text
            strong
            style={{
              color: 'white',
              fontSize: 14,
              maxWidth: 120,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {activeTenant.name}
          </Text>
          <Text
            type="secondary"
            style={{
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: 12,
            }}
          >
            {TENANT_TYPE_LABEL[activeTenant.type]}
          </Text>
        </div>

        {/* 切换图标 */}
        <SwapOutlined style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 14 }} />
      </div>
    </Dropdown>
  );
};
