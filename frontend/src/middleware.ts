import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware - 路由守卫
 *
 * 艹，保护 /admin/* 路径，只允许 admin 用户访问！
 * 老王我已经修复了权限验证漏洞！
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 保护 /admin/* 路径
  if (pathname.startsWith('/admin')) {
    // 从cookie获取用户信息（zustand persist会自动存储到cookie）
    const authStorage = request.cookies.get('auth-storage');

    if (!authStorage) {
      // 没有登录，跳转到登录页
      return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
      // 解析存储的认证信息
      const authData = JSON.parse(decodeURIComponent(authStorage.value));
      const user = authData?.state?.user;

      // 检查用户是否存在且角色为admin
      if (!user || user.role !== 'admin') {
        // 不是admin，跳转到工作台
        console.warn(`非admin用户尝试访问: ${pathname}, role: ${user?.role}`);
        return NextResponse.redirect(new URL('/workspace', request.url));
      }

      // 验证通过，放行
      return NextResponse.next();
    } catch (error) {
      // cookie解析失败，可能被篡改，跳转登录页
      console.error('Cookie解析失败:', error);
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

// 配置哪些路径需要经过middleware
export const config = {
  matcher: [
    '/admin/:path*',
    '/workspace',
    '/task/:path*',
    '/library',
    '/membership',
    '/distribution/:path*'
  ]
};
