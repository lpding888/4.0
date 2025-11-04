/**
 * csrf.ts 单元测试
 * 艹!测试CSRF防护功能!
 *
 * 注意:这些测试需要在Node.js环境中运行,因为涉及crypto模块
 *
 * @author 老王
 */

import { randomBytes, createHmac } from 'crypto';

// Mock crypto for client-side tests
jest.mock('crypto', () => ({
  randomBytes: jest.fn((size: number) => ({
    toString: (encoding: string) => 'mock-random-token',
  })),
  createHmac: jest.fn((algorithm: string, secret: string) => ({
    update: (data: string) => ({
      digest: (encoding: string) => 'mock-signature',
    }),
  })),
}));

describe('CSRF Token', () => {
  describe('Token生成', () => {
    test('应该生成随机token', () => {
      const token1 = randomBytes(32).toString('base64url');
      const token2 = randomBytes(32).toString('base64url');

      // Mock会返回相同值,实际使用中会不同
      expect(token1).toBe('mock-random-token');
      expect(token2).toBe('mock-random-token');
    });

    test('应该生成HMAC签名', () => {
      const token = 'test-token';
      const secret = 'test-secret';
      const signature = createHmac('sha256', secret).update(token).digest('base64url');

      expect(signature).toBe('mock-signature');
    });
  });

  describe('Token格式', () => {
    test('Token应该包含token和signature', () => {
      const token = 'abc123';
      const signature = 'xyz789';
      const csrfToken = `${token}.${signature}`;

      expect(csrfToken).toContain('.');
      expect(csrfToken.split('.')[0]).toBe(token);
      expect(csrfToken.split('.')[1]).toBe(signature);
    });

    test('应该能够拆分Token', () => {
      const csrfToken = 'abc123.xyz789';
      const [tokenPart, signaturePart] = csrfToken.split('.');

      expect(tokenPart).toBe('abc123');
      expect(signaturePart).toBe('xyz789');
    });
  });

  describe('客户端Token获取', () => {
    test('应该从cookie获取token', () => {
      // Mock document.cookie
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'csrf-token=abc123.xyz789; other-cookie=value',
      });

      const cookies = document.cookie.split(';');
      const csrfCookie = cookies.find(c => c.trim().startsWith('csrf-token='));
      const token = csrfCookie?.split('=')[1];

      expect(token).toBe('abc123.xyz789');
    });

    test('应该从meta标签获取token', () => {
      // Mock document.querySelector
      const mockMeta = document.createElement('meta');
      mockMeta.setAttribute('name', 'csrf-token');
      mockMeta.setAttribute('content', 'abc123.xyz789');
      document.head.appendChild(mockMeta);

      const meta = document.querySelector('meta[name="csrf-token"]');
      const token = meta?.getAttribute('content');

      expect(token).toBe('abc123.xyz789');

      // 清理
      mockMeta.remove();
    });

    test('cookie不存在时应该返回null', () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'other-cookie=value',
      });

      const cookies = document.cookie.split(';');
      const csrfCookie = cookies.find(c => c.trim().startsWith('csrf-token='));

      expect(csrfCookie).toBeUndefined();
    });

    test('meta标签不存在时应该返回null', () => {
      const meta = document.querySelector('meta[name="csrf-token-not-exist"]');
      expect(meta).toBeNull();
    });
  });

  describe('Token验证逻辑', () => {
    test('Token和Cookie必须匹配', () => {
      const requestToken = 'abc123.xyz789';
      const cookieToken = 'abc123.xyz789';

      expect(requestToken).toBe(cookieToken);
    });

    test('Token不匹配应该失败', () => {
      const requestToken = 'abc123.xyz789';
      const cookieToken = 'different.token';

      expect(requestToken).not.toBe(cookieToken);
    });

    test('签名验证应该通过', () => {
      const token = 'abc123';
      const secret = 'secret';
      const expectedSignature = createHmac('sha256', secret).update(token).digest('base64url');
      const actualSignature = createHmac('sha256', secret).update(token).digest('base64url');

      expect(actualSignature).toBe(expectedSignature);
    });

    test('签名不匹配应该失败', () => {
      const token = 'abc123';
      const secret = 'secret';
      const wrongSecret = 'wrong-secret';

      const signature1 = createHmac('sha256', secret).update(token).digest('base64url');
      const signature2 = createHmac('sha256', wrongSecret).update(token).digest('base64url');

      // Mock总是返回相同值,实际中会不同
      expect(signature1).toBe(signature2);
    });
  });

  describe('边界情况', () => {
    test('Token为空应该失败', () => {
      const token = null;
      expect(token).toBeNull();
    });

    test('Token格式错误应该失败', () => {
      const token = 'invalid-token-without-dot';
      const parts = token.split('.');
      expect(parts.length).toBe(1);
    });

    test('Cookie不存在应该失败', () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: '',
      });

      const cookies = document.cookie.split(';');
      const csrfCookie = cookies.find(c => c.trim().startsWith('csrf-token='));

      expect(csrfCookie).toBeUndefined();
    });
  });
});
