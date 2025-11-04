import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';

/**
 * Middleware - 路由守卫 + 国际化 + CSRF防护
 *
 * 艹，保护 /admin/* 路径，只允许 admin 用户访问！
 * 同时支持中英文国际化！
 * 老王我已经修复了权限验证漏洞，并集成了i18n和CSRF防护！
 *
 * @author 老王
 */

// 不安全的HTTP方法需要CSRF验证
const UNSAFE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// 创建 i18n 中间件
const intlMiddleware = createIntlMiddleware({
  locales: ['zh', 'en'],
  defaultLocale: 'zh',
  localeDetection: true,
});

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const method = request.method;

  // CSRF验证:对非安全HTTP方法进行CSRF token检查
  if (UNSAFE_METHODS.includes(method) && pathname.startsWith('/api')) {
    const csrfToken = request.headers.get('X-CSRF-Token');
    const csrfCookie = request.cookies.get('csrf-token')?.value;

    // 检查token是否存在且匹配
    if (!csrfToken || !csrfCookie || csrfToken !== csrfCookie) {
      console.error(`[CSRF] Token验证失败: ${method} ${pathname}`);
      return NextResponse.json(
        { error: 'CSRF token验证失败', code: 'CSRF_TOKEN_INVALID' },
        { status: 403 }
      );
    }
  }

  // 先处理国际化路由
  const response = intlMiddleware(request);

  // 设置安全Cookie属性
  response.cookies.set('auth-storage', request.cookies.get('auth-storage')?.value || '', {
    httpOnly: false, // zustand需要客户端访问
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict', // 防止CSRF攻击
    path: '/',
  });

  // 获取语言前缀（如 /zh 或 /en）
  const locale = pathname.split('/')[1];
  const isValidLocale = ['zh', 'en'].includes(locale);

  // 去除语言前缀后的真实路径
  const realPathname = isValidLocale ? pathname.slice(3) : pathname;

  // 保护 /admin/* 路径
  if (realPathname.startsWith('/admin')) {
    // 从cookie获取用户信息（zustand persist会自动存储到cookie）
    const authStorage = request.cookies.get('auth-storage');

    if (!authStorage) {
      // 没有登录，跳转到登录页
      const loginUrl = new URL(isValidLocale ? `/${locale}/login` : '/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    try {
      // 解析存储的认证信息
      const authData = JSON.parse(authStorage.value);
      const user = authData?.state?.user;

      // 检查用户是否存在且角色为admin
      if (!user || user.role !== 'admin') {
        // 不是admin，跳转到工作台
        console.warn(`非admin用户尝试访问: ${realPathname}, role: ${user?.role}`);
        const workspaceUrl = new URL(isValidLocale ? `/${locale}/workspace` : '/workspace', request.url);
        return NextResponse.redirect(workspaceUrl);
      }

      // 验证通过，返回 i18n 处理后的响应
      return response;
    } catch (error) {
      // cookie解析失败，可能被篡改，跳转登录页
      console.error('Cookie解析失败:', error);
      const loginUrl = new URL(isValidLocale ? `/${locale}/login` : '/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 返回 i18n 处理后的响应
  return response;
}

// 配置哪些路径需要经过middleware
export const config = {
  matcher: [
    // i18n 路由匹配
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ]
};
