'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

export default function TokenSyncProvider() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    const syncFromStorage = () => {
      const accessToken = localStorage.getItem('token');
      const refreshToken = localStorage.getItem('refresh_token');
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;

      if (accessToken) {
        setAuth(user, accessToken, refreshToken);
      } else {
        logout();
      }
    };

    // 初次挂载时同步一次，防止刷新后状态不同步
    if (typeof window !== 'undefined') {
      syncFromStorage();
    }

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || !['token', 'refresh_token', 'user'].includes(event.key)) {
        return;
      }
      syncFromStorage();
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [setAuth, logout]);

  return null;
}
