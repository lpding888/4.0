/**
 * useCsrfToken Hook
 * 艹!客户端获取和使用CSRF token的Hook!
 *
 * @author 老王
 */

'use client';

import { useEffect, useState } from 'react';
import { getCsrfTokenFromMeta } from '@/lib/security/csrf';

/**
 * 获取CSRF token的Hook
 *
 * @returns CSRF token或null
 */
export function useCsrfToken(): string | null {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // 从meta标签获取token
    const csrfToken = getCsrfTokenFromMeta();
    setToken(csrfToken);

    // 如果没有token,警告开发者
    if (!csrfToken) {
      console.warn('[useCsrfToken] 未找到CSRF token,请确保页面包含<meta name="csrf-token">');
    }
  }, []);

  return token;
}

/**
 * 为fetch请求添加CSRF token的Hook
 * 返回一个增强的fetch函数,自动在headers中添加CSRF token
 *
 * @returns 增强的fetch函数
 */
export function useFetchWithCsrf() {
  const token = useCsrfToken();

  return async (url: string, options: RequestInit = {}) => {
    // 合并headers,添加CSRF token
    const headers = new Headers(options.headers);

    if (token) {
      headers.set('X-CSRF-Token', token);
    }

    // 发送请求
    return fetch(url, {
      ...options,
      headers,
    });
  };
}
