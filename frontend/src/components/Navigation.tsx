'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import {
  AppstoreOutlined,
  HistoryOutlined,
  FolderOutlined,
  CrownOutlined,
  SettingOutlined,
  LogoutOutlined,
  LoginOutlined
} from '@ant-design/icons';

/**
 * Navigation - 导航栏组件
 *
 * 艹，未登录显示Logo和登录按钮，已登录显示完整菜单！
 */
export default function Navigation() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  // 如果是登录页，不显示导航栏
  if (pathname === '/login') {
    return null;
  }

  // 菜单项配置（只在已登录时构建）
  const menuItems = user ? [
    {
      key: '/workspace',
      label: '工作台',
      icon: <AppstoreOutlined />
    },
    {
      key: '/task/history',
      label: '任务历史',
      icon: <HistoryOutlined />
    },
    {
      key: '/library',
      label: '素材库',
      icon: <FolderOutlined />
    },
    {
      key: '/membership',
      label: '会员中心',
      icon: <CrownOutlined />
    },
    // 如果是admin，添加管理后台入口
    ...(user.role === 'admin' ? [{
      key: '/admin/features',
      label: '管理后台',
      icon: <SettingOutlined />,
      exact: true
    }] : [])
  ] : [];

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  return (
    <nav className="bg-white/5 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div
            onClick={() => router.push(user ? '/workspace' : '/')}
            className="text-white text-xl font-light cursor-pointer hover:text-cyan-300 transition-colors"
          >
            AI照
          </div>

          {/* 未登录：只显示登录按钮 */}
          {!user && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/login')}
                className="px-4 py-2 rounded-lg
                  bg-cyan-500/20 border border-cyan-400/50 text-cyan-300
                  hover:bg-cyan-500/30 hover:border-cyan-300
                  transition-all duration-300
                  flex items-center gap-2"
              >
                <LoginOutlined />
                <span>登录/注册</span>
              </button>
            </div>
          )}

          {/* 已登录：显示完整菜单 */}
          {user && (
            <div className="flex items-center gap-1">
              {menuItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => router.push(item.key)}
                  className={`
                    px-4 py-2 rounded-lg
                    flex items-center gap-2
                    transition-all duration-300
                    ${
                      (item.exact
                        ? pathname === item.key
                        : pathname === item.key || pathname.startsWith(`${item.key}/`))
                        ? 'bg-cyan-500/20 border border-cyan-400/50 text-cyan-300'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }
                  `}
                >
                  {item.icon}
                  <span className="hidden md:inline">{item.label}</span>
                </button>
              ))}

              {/* 退出登录 */}
              <button
                onClick={handleLogout}
                className="ml-4 px-4 py-2 rounded-lg
                  text-white/70 hover:bg-rose-500/20 hover:text-rose-300
                  transition-all duration-300
                  flex items-center gap-2"
              >
                <LogoutOutlined />
                <span className="hidden md:inline">退出</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
