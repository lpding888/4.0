/**
 * 管理后台布局
 * 艹！使用新的GPT5架构：SideNav组件！
 */

'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from 'antd';
import { useAuthStore } from '@/store/authStore';
import { SideNav } from '@/shared/ui/SideNav';
import type { MenuItem } from '@/shared/ui/SideNav';

const { Content } = Layout;

/**
 * Admin布局
 * 艹！管理员专用布局，统一暖色专业风格！
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  /**
   * 权限检查
   * 艹！必须是admin才能访问！
   */
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (user.role !== 'admin') {
      router.push('/workspace');
      return;
    }
  }, [user, router]);

  /**
   * 菜单配置
   * 艹！使用新的 MenuItem 结构！
   */
  const menuItems: MenuItem[] = useMemo(
    () => [
      {
        key: '/admin/features',
        label: '功能卡片管理',
        icon: 'AppstoreOutlined',
        path: '/admin/features',
      },
      {
        key: '/admin/forms',
        label: '表单设计器',
        icon: 'FormOutlined',
        path: '/admin/forms/builder',
      },
      {
        key: '/admin/pipelines',
        label: '流程编辑器',
        icon: 'ApartmentOutlined',
        path: '/admin/pipelines/editor',
      },
      {
        key: 'distribution',
        label: '分销管理',
        icon: 'DollarOutlined',
        children: [
          {
            key: '/admin/distributors',
            label: '分销员管理',
            path: '/admin/distributors',
          },
          {
            key: '/admin/withdrawals',
            label: '提现审核',
            path: '/admin/withdrawals',
          },
          {
            key: '/admin/distribution/stats',
            label: '分销统计',
            path: '/admin/distribution/stats',
          },
          {
            key: '/admin/distribution/settings',
            label: '分销设置',
            path: '/admin/distribution/settings',
          },
        ],
      },
      {
        key: 'cms',
        label: 'CMS配置',
        icon: 'SettingOutlined',
        children: [
          {
            key: '/admin/providers',
            label: 'Provider管理',
            path: '/admin/providers',
          },
          {
            key: '/admin/announcements',
            label: '公告管理',
            path: '/admin/announcements',
          },
          {
            key: '/admin/banners',
            label: 'Banner管理',
            path: '/admin/banners',
          },
        ],
      },
    ],
    []
  );

  /**
   * 如果用户未登录或不是admin，不渲染内容
   */
  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <Layout style={{ minHeight: '100vh', background: '#FFFFFF' }}>
      {/* 艹！使用新的 SideNav 组件！ */}
      <SideNav
        items={menuItems}
        title="AI照 - 管理后台"
        onTitleClick={() => router.push('/workspace')}
        width={240}
        enablePermission={false} // Admin不需要权限检查，都能看到
        headerStyle={{
          background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
          color: '#92400E',
          borderBottom: '1px solid var(--border-primary)',
        }}
      />

      {/* 主内容区 - 纯白背景 */}
      <Layout>
        <Content
          style={{
            background: '#F9FAFB',
            minHeight: '100vh',
            overflow: 'auto',
            padding: '24px',
          }}
        >
          {children}</Content>
      </Layout>
    </Layout>
  );
}
