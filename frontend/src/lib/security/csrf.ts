/**
 * CSRF Token 工具函数
 * 艹!防止跨站请求伪造攻击!
 *
 * @author 老王
 */

import { cookies } from 'next/headers';
import { randomBytes, createHmac } from 'crypto';

/**
 * CSRF Token 配置
 */
const CSRF_TOKEN_NAME = 'csrf-token';
const CSRF_SECRET_NAME = 'csrf-secret';
const TOKEN_LENGTH = 32; // 256 bits
const TOKEN_EXPIRY = 60 * 60 * 1000; // 1小时

/**
 * 生成随机token
 */
function generateToken(): string {
  return randomBytes(TOKEN_LENGTH).toString('base64url');
}

/**
 * 生成HMAC签名
 */
function generateSignature(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('base64url');
}

/**
 * 服务端:生成CSRF token并设置到cookie
 *
 * @returns CSRF token
 */
export async function generateCsrfToken(): Promise<string> {
  const cookieStore = await cookies();

  // 生成token和secret
  const token = generateToken();
  const secret = generateToken();
  const signature = generateSignature(token, secret);

  // 组合token: token.signature
  const csrfToken = `${token}.${signature}`;

  // 设置token到cookie (HttpOnly, SameSite=Strict)
  cookieStore.set(CSRF_TOKEN_NAME, csrfToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: TOKEN_EXPIRY / 1000,
    path: '/',
  });

  // 设置secret到cookie (用于验证)
  cookieStore.set(CSRF_SECRET_NAME, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: TOKEN_EXPIRY / 1000,
    path: '/',
  });

  return csrfToken;
}

/**
 * 服务端:验证CSRF token
 *
 * @param token - 客户端提交的token
 * @returns 验证是否通过
 */
export async function verifyCsrfToken(token: string | null): Promise<boolean> {
  if (!token) {
    console.warn('[CSRF] Token不存在');
    return false;
  }

  const cookieStore = await cookies();
  const csrfToken = cookieStore.get(CSRF_TOKEN_NAME)?.value;
  const secret = cookieStore.get(CSRF_SECRET_NAME)?.value;

  if (!csrfToken || !secret) {
    console.warn('[CSRF] Cookie中没有token或secret');
    return false;
  }

  // 验证token是否匹配
  if (token !== csrfToken) {
    console.warn('[CSRF] Token不匹配');
    return false;
  }

  // 验证签名
  const [tokenPart, signaturePart] = csrfToken.split('.');
  if (!tokenPart || !signaturePart) {
    console.error('[CSRF] Token格式不正确!');
    return false;
  }
  const expectedSignature = generateSignature(tokenPart, secret);

  if (signaturePart !== expectedSignature) {
    console.error('[CSRF] 签名验证失败!可能存在CSRF攻击!');
    return false;
  }

  return true;
}

/**
 * 客户端:从cookie获取CSRF token
 * 注意:这个函数在客户端使用,通过读取非HttpOnly的cookie
 */
export function getCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookies = document.cookie.split(';');
  const csrfCookie = cookies.find(c => c.trim().startsWith(`${CSRF_TOKEN_NAME}=`));

  if (!csrfCookie) {
    return null;
  }

  const [, value] = csrfCookie.split('=');
  return value?.trim() ?? null;
}

/**
 * 客户端:从meta标签获取CSRF token
 * 这是另一种常见的CSRF token传递方式
 */
export function getCsrfTokenFromMeta(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta?.getAttribute('content') || null;
}
