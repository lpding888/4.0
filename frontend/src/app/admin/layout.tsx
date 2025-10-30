'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Layout, Menu } from 'antd';
import {
  AppstoreOutlined,
  TeamOutlined,
  DollarOutlined,
  BarChartOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { useAuthStore } from '@/store/authStore';

const { Sider, Content } = Layout;

/**
 * 管理后台布局
 *
 * 艹！管理员专用布局，左侧导航右侧内容！
 */
export default function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    // 艹，必须是admin才能访问！
    if (!user) {
      router.push('/login');
      return;
    }

    if (user.role !== 'admin') {
      router.push('/workspace');
      return;
    }
  }, [user, router]);

  // 菜单项配置
  const menuItems = [
    {
      key: '/admin/features',
      icon: <AppstoreOutlined />,
      label: '功能卡片管理'
    },
    {
      key: 'distribution',
      icon: <DollarOutlined />,
      label: '分销管理',
      children: [
        {
          key: '/admin/distributors',
          label: '分销员管理'
        },
        {
          key: '/admin/withdrawals',
          label: '提现审核'
        },
        {
          key: '/admin/distribution/stats',
          label: '分销统计'
        },
        {
          key: '/admin/distribution/settings',
          label: '分销设置'
        }
      ]
    }
  ];

  // 计算当前选中的菜单项和展开的子菜单
  const selectedKey = pathname;
  const openKeys = pathname.startsWith('/admin/distribution') ||
                   pathname.startsWith('/admin/distributors') ||
                   pathname.startsWith('/admin/withdrawals')
    ? ['distribution']
    : [];

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 侧边栏 */}
      <Sider
        width={240}
        style={{
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(12px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)'
        }}
        breakpoint="lg"
        collapsedWidth="0"
      >
        {/* Logo */}
        <div
          style={{
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            cursor: 'pointer'
          }}
          onClick={() => router.push('/workspace')}
        >
          <span style={{ color: 'white', fontSize: '18px', fontWeight: '300' }}>
            AI照 - 管理后台
          </span>
        </div>

        {/* 菜单 */}
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={openKeys}
          items={menuItems}
          onClick={({ key }) => router.push(key)}
          style={{
            background: 'transparent',
            border: 'none',
            marginTop: '16px'
          }}
          theme="dark"
        />
      </Sider>

      {/* 主内容区 */}
      <Layout>
        <Content
          style={{
            background: 'linear-gradient(to bottom right, #0f172a, #1e3a8a, #065f46)',
            minHeight: '100vh',
            overflow: 'auto'
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
