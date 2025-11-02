/**
 * Next.js中间件 - 路由守卫
 * 艹，这个tm负责路由权限控制！
 *
 * 功能：
 * 1. 检查用户登录状态（从cookie读取）
 * 2. 保护需要登录的路由
 * 3. 保护管理员路由
 * 4. 自动重定向到登录页或首页
 *
 * @author 老王
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * 公开路由（无需登录）
 * 艹，这些路由谁都能访问！
 */
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
];

/**
 * 需要登录的路由前缀
 * 艹，这些路由必须登录才能访问！
 */
const PROTECTED_ROUTES = [
  '/workspace',
  '/membership',
  '/distribution',
  '/profile',
  '/settings',
];

/**
 * 管理员路由前缀
 * 艹，这些路由只有管理员能访问！
 */
const ADMIN_ROUTES = [
  '/admin',
];

/**
 * 检查路径是否匹配前缀列表
 */
function matchesRoutePrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
}

/**
 * 从cookie获取token
 * 艹，检查用户是否登录！
 */
function getTokenFromCookies(request: NextRequest): string | null {
  return request.cookies.get('access_token')?.value || null;
}

/**
 * 从cookie获取用户角色
 * 艹，检查用户权限！
 */
function getRolesFromCookies(request: NextRequest): string[] {
  const rolesStr = request.cookies.get('roles')?.value;
  if (!rolesStr) return [];

  try {
    // 艹，roles在cookie里是JSON数组字符串
    const roles = JSON.parse(decodeURIComponent(rolesStr));
    return Array.isArray(roles) ? roles : [];
  } catch {
    return [];
  }
}

/**
 * 检查是否有管理员角色
 */
function isAdmin(roles: string[]): boolean {
  return roles.includes('admin');
}

/**
 * Middleware函数
 * 艹，这个tm是守卫入口！
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 艹，静态资源和API路由不处理
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') // 艹，文件资源（.js, .css, .png等）
  ) {
    return NextResponse.next();
  }

  const token = getTokenFromCookies(request);
  const roles = getRolesFromCookies(request);
  const isAuthenticated = !!token;

  // 艹，检查是否是公开路由
  const isPublicRoute = matchesRoutePrefix(pathname, PUBLIC_ROUTES);

  // 艹，检查是否是需要登录的路由
  const isProtectedRoute = matchesRoutePrefix(pathname, PROTECTED_ROUTES);

  // 艹，检查是否是管理员路由
  const isAdminRoute = matchesRoutePrefix(pathname, ADMIN_ROUTES);

  console.log('[Middleware]', {
    pathname,
    isAuthenticated,
    roles,
    isPublicRoute,
    isProtectedRoute,
    isAdminRoute,
  });

  // 情况1：访问管理员路由，但不是管理员
  if (isAdminRoute) {
    if (!isAuthenticated) {
      // 艹，未登录，重定向到登录页
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }

    if (!isAdmin(roles)) {
      // 艹，已登录但不是管理员，重定向到首页
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }

    // 艹，是管理员，允许访问
    return NextResponse.next();
  }

  // 情况2：访问需要登录的路由，但未登录
  if (isProtectedRoute && !isAuthenticated) {
    // 艹，重定向到登录页
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // 情况3：已登录用户访问登录页，重定向到首页
  if (pathname === '/login' && isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // 情况4：其他情况，允许访问
  return NextResponse.next();
}

/**
 * 配置Matcher
 * 艹，指定哪些路径需要经过middleware！
 */
export const config = {
  matcher: [
    /*
     * 艹，匹配所有路径，除了：
     * - api路由 (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
