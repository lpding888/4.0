/**
 * sanitize.ts 单元测试
 * 艹!测试XSS防护功能!
 *
 * @author 老王
 */

import { sanitizeHtml, sanitizeUrl, sanitizeFilename, sanitizeObject } from '../sanitize';

describe('sanitizeHtml', () => {
  describe('XSS攻击防护', () => {
    test('应该移除<script>标签', () => {
      const input = '<script>alert("XSS")</script>Hello World';
      const output = sanitizeHtml(input, 'basic');
      expect(output).not.toContain('<script>');
      expect(output).not.toContain('alert');
      expect(output).toContain('Hello World');
    });

    test('应该移除事件处理器', () => {
      const input = '<img src="x" onerror="alert(1)">';
      const output = sanitizeHtml(input, 'basic');
      expect(output).not.toContain('onerror');
      expect(output).not.toContain('alert');
    });

    test('应该移除onclick等内联事件', () => {
      const input = '<button onclick="malicious()">Click</button>';
      const output = sanitizeHtml(input, 'basic');
      expect(output).not.toContain('onclick');
      expect(output).not.toContain('malicious');
    });

    test('应该移除javascript:协议', () => {
      const input = '<a href="javascript:alert(1)">Link</a>';
      const output = sanitizeHtml(input, 'basic');
      expect(output).not.toContain('javascript:');
    });

    test('应该移除data:协议', () => {
      const input = '<a href="data:text/html,<script>alert(1)</script>">Link</a>';
      const output = sanitizeHtml(input, 'basic');
      expect(output).not.toContain('data:');
    });
  });

  describe('strict模式', () => {
    test('应该移除所有HTML标签', () => {
      const input = '<p>Hello</p><strong>World</strong>';
      const output = sanitizeHtml(input, 'strict');
      expect(output).not.toContain('<p>');
      expect(output).not.toContain('<strong>');
      expect(output).toContain('Hello');
      expect(output).toContain('World');
    });

    test('应该保留纯文本', () => {
      const input = 'Hello World';
      const output = sanitizeHtml(input, 'strict');
      expect(output).toBe('Hello World');
    });
  });

  describe('basic模式', () => {
    test('应该允许基本格式化标签', () => {
      const input = '<p>Hello</p><strong>World</strong>';
      const output = sanitizeHtml(input, 'basic');
      expect(output).toContain('<p>');
      expect(output).toContain('<strong>');
    });

    test('应该移除不允许的标签', () => {
      const input = '<p>Hello</p><script>alert(1)</script>';
      const output = sanitizeHtml(input, 'basic');
      expect(output).toContain('<p>');
      expect(output).not.toContain('<script>');
    });
  });

  describe('rich模式', () => {
    test('应该允许富文本标签', () => {
      const input = '<h1>Title</h1><p>Content</p><img src="test.jpg" alt="test">';
      const output = sanitizeHtml(input, 'rich');
      expect(output).toContain('<h1>');
      expect(output).toContain('<img');
      expect(output).toContain('src=');
    });

    test('应该允许链接', () => {
      const input = '<a href="https://example.com">Link</a>';
      const output = sanitizeHtml(input, 'rich');
      expect(output).toContain('<a');
      expect(output).toContain('href=');
    });
  });

  describe('template模式', () => {
    test('应该允许表单元素', () => {
      const input = '<input type="text" placeholder="Name"><button>Submit</button>';
      const output = sanitizeHtml(input, 'template');
      expect(output).toContain('<input');
      expect(output).toContain('<button');
    });

    test('应该移除危险标签', () => {
      const input = '<button>Safe</button><script>alert(1)</script>';
      const output = sanitizeHtml(input, 'template');
      expect(output).toContain('<button');
      expect(output).not.toContain('<script>');
    });
  });

  describe('边界情况', () => {
    test('应该处理空字符串', () => {
      const output = sanitizeHtml('', 'basic');
      expect(output).toBe('');
    });

    test('应该处理null输入', () => {
      const output = sanitizeHtml(null as any, 'basic');
      expect(output).toBe('');
    });

    test('应该处理undefined输入', () => {
      const output = sanitizeHtml(undefined as any, 'basic');
      expect(output).toBe('');
    });
  });
});

describe('sanitizeUrl', () => {
  test('应该允许https协议', () => {
    const input = 'https://example.com';
    const output = sanitizeUrl(input);
    expect(output).toBe(input);
  });

  test('应该允许http协议', () => {
    const input = 'http://example.com';
    const output = sanitizeUrl(input);
    expect(output).toBe(input);
  });

  test('应该允许mailto协议', () => {
    const input = 'mailto:test@example.com';
    const output = sanitizeUrl(input);
    expect(output).toBe(input);
  });

  test('应该允许tel协议', () => {
    const input = 'tel:+1234567890';
    const output = sanitizeUrl(input);
    expect(output).toBe(input);
  });

  test('应该允许相对路径', () => {
    const input = '/path/to/page';
    const output = sanitizeUrl(input);
    expect(output).toBe(input);
  });

  test('应该阻止javascript:协议', () => {
    const input = 'javascript:alert(1)';
    const output = sanitizeUrl(input);
    expect(output).toBe('');
  });

  test('应该阻止data:协议', () => {
    const input = 'data:text/html,<script>alert(1)</script>';
    const output = sanitizeUrl(input);
    expect(output).toBe('');
  });

  test('应该阻止vbscript:协议', () => {
    const input = 'vbscript:msgbox(1)';
    const output = sanitizeUrl(input);
    expect(output).toBe('');
  });

  test('应该阻止file:协议', () => {
    const input = 'file:///etc/passwd';
    const output = sanitizeUrl(input);
    expect(output).toBe('');
  });

  test('应该处理大小写混合', () => {
    const input = 'JaVaScRiPt:alert(1)';
    const output = sanitizeUrl(input);
    expect(output).toBe('');
  });

  test('应该处理空格', () => {
    const input = '  javascript:alert(1)  ';
    const output = sanitizeUrl(input);
    expect(output).toBe('');
  });
});

describe('sanitizeFilename', () => {
  test('应该允许正常文件名', () => {
    const input = 'document.pdf';
    const output = sanitizeFilename(input);
    expect(output).toBe(input);
  });

  test('应该移除路径分隔符', () => {
    const input = '../../../etc/passwd';
    const output = sanitizeFilename(input);
    expect(output).not.toContain('/');
    expect(output).not.toContain('\\');
    expect(output).not.toContain('..');
  });

  test('应该移除Windows不允许的字符', () => {
    const input = 'file<>:|?*.txt';
    const output = sanitizeFilename(input);
    expect(output).not.toContain('<');
    expect(output).not.toContain('>');
    expect(output).not.toContain('|');
    expect(output).not.toContain('?');
    expect(output).not.toContain('*');
  });

  test('应该处理空文件名', () => {
    const input = '';
    const output = sanitizeFilename(input);
    expect(output).toBe('untitled');
  });

  test('应该处理只有特殊字符的文件名', () => {
    const input = '<>:|?*';
    const output = sanitizeFilename(input);
    expect(output).toBe('untitled');
  });
});

describe('sanitizeObject', () => {
  test('应该净化对象中的字符串', () => {
    const input = {
      name: '<script>alert(1)</script>John',
      bio: '<strong>Developer</strong>',
    };
    const output = sanitizeObject(input, 'basic');
    expect(output.name).not.toContain('<script>');
    expect(output.name).toContain('John');
    expect(output.bio).toContain('<strong>');
  });

  test('应该递归净化嵌套对象', () => {
    const input = {
      user: {
        name: '<script>alert(1)</script>John',
        profile: {
          bio: '<strong>Developer</strong>',
        },
      },
    };
    const output = sanitizeObject(input, 'basic');
    expect(output.user.name).not.toContain('<script>');
    expect(output.user.profile.bio).toContain('<strong>');
  });

  test('应该净化数组中的字符串', () => {
    const input = {
      tags: ['<script>alert(1)</script>tag1', '<strong>tag2</strong>'],
    };
    const output = sanitizeObject(input, 'basic');
    expect(output.tags[0]).not.toContain('<script>');
    expect(output.tags[1]).toContain('<strong>');
  });

  test('应该保留非字符串值', () => {
    const input = {
      name: 'John',
      age: 30,
      active: true,
      score: null,
      metadata: undefined,
    };
    const output = sanitizeObject(input, 'basic');
    expect(output.age).toBe(30);
    expect(output.active).toBe(true);
    expect(output.score).toBeNull();
    expect(output.metadata).toBeUndefined();
  });
});
