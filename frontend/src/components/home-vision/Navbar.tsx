'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

/**
 * Navbar - 导航栏组件
 * Apple 风格极简导航
 */
export default function Navbar() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '64px',
      background: 'rgba(255,255,255,0.8)',
      backdropFilter: 'blur(20px)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      borderBottom: '1px solid rgba(0,0,0,0.05)'
    }}>
      <div style={{ fontWeight: 700, fontSize: '20px', letterSpacing: '-0.5px' }}>
        AI.FASHION <span style={{ fontSize: '12px', fontWeight: 400, color: '#86868B', marginLeft: '8px' }}>PRO</span>
      </div>
      <div style={{ display: 'flex', gap: '16px' }}>
        {user ? (
          <button className="btn-vision" onClick={() => router.push('/workspace')}>
            进入控制台
          </button>
        ) : (
          <>
            <button
              className="btn-vision-secondary"
              onClick={() => router.push('/login')}
              style={{ padding: '8px 20px', fontSize: '14px' }}
            >
              登录
            </button>
            <button
              className="btn-vision"
              onClick={() => router.push('/login')}
              style={{ padding: '8px 20px', fontSize: '14px' }}
            >
              免费试用
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
