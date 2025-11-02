/**
 * Template工具单元测试
 * 艹，模板变量替换必须准确无误！
 */

import {
  extractValue,
  escapeHtml,
  replaceVariables,
  extractVariableReferences,
  validateVariables,
} from '../../../src/utils/template';

describe('Template Utils - 单元测试', () => {
  describe('extractValue', () => {
    test('应该提取简单属性', () => {
      const obj = { name: '老王', age: 35 };
      expect(extractValue(obj, 'name')).toBe('老王');
      expect(extractValue(obj, 'age')).toBe(35);
    });

    test('应该提取嵌套属性', () => {
      const obj = {
        user: {
          profile: {
            name: '老王',
            age: 35,
          },
        },
      };

      expect(extractValue(obj, 'user.profile.name')).toBe('老王');
      expect(extractValue(obj, 'user.profile.age')).toBe(35);
    });

    test('路径不存在时应该返回undefined', () => {
      const obj = { name: '老王' };
      expect(extractValue(obj, 'notexist')).toBeUndefined();
      expect(extractValue(obj, 'user.profile.name')).toBeUndefined();
    });

    test('应该处理null和undefined', () => {
      expect(extractValue(null, 'name')).toBeUndefined();
      expect(extractValue(undefined, 'name')).toBeUndefined();
    });

    test('应该处理数组', () => {
      const obj = {
        items: [{ name: 'item1' }, { name: 'item2' }],
      };

      // 艹，数组索引需要用数字key
      expect(extractValue(obj, 'items.0.name')).toBe('item1');
      expect(extractValue(obj, 'items.1.name')).toBe('item2');
    });
  });

  describe('escapeHtml', () => {
    test('应该转义HTML特殊字符', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
      );
    });

    test('应该转义所有危险字符', () => {
      expect(escapeHtml('&<>"\'/')).toBe('&amp;&lt;&gt;&quot;&#39;&#x2F;');
    });

    test('普通字符串不应该被改变', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
    });
  });

  describe('replaceVariables - 字符串', () => {
    test('应该替换简单变量', () => {
      const template = 'Hello {{name}}!';
      const variables = { name: '老王' };

      expect(replaceVariables(template, variables)).toBe('Hello 老王!');
    });

    test('应该替换多个变量', () => {
      const template = '{{greeting}} {{name}}, you are {{age}} years old';
      const variables = { greeting: 'Hi', name: '老王', age: 35 };

      expect(replaceVariables(template, variables)).toBe(
        'Hi 老王, you are 35 years old'
      );
    });

    test('应该替换嵌套变量', () => {
      const template = 'Hello {{user.name}}, age: {{user.age}}';
      const variables = { user: { name: '老王', age: 35 } };

      expect(replaceVariables(template, variables)).toBe(
        'Hello 老王, age: 35'
      );
    });

    test('未定义的变量应该替换为空字符串', () => {
      const template = 'Hello {{name}}!';
      const variables = {};

      expect(replaceVariables(template, variables)).toBe('Hello !');
    });

    test('throwOnMissing=true时应该抛出错误', () => {
      const template = 'Hello {{name}}!';
      const variables = {};

      expect(() =>
        replaceVariables(template, variables, { throwOnMissing: true })
      ).toThrow('变量 "name" 未定义');
    });

    test('escapeHtml=true时应该转义HTML', () => {
      const template = 'Content: {{html}}';
      const variables = { html: '<script>alert("xss")</script>' };

      const result = replaceVariables(template, variables, {
        escapeHtml: true,
      });

      expect(result).toContain('&lt;script&gt;');
      expect(result).not.toContain('<script>');
    });

    test('应该处理数字和布尔值', () => {
      const template = 'Count: {{count}}, Active: {{active}}';
      const variables = { count: 42, active: true };

      expect(replaceVariables(template, variables)).toBe(
        'Count: 42, Active: true'
      );
    });

    test('应该只替换合法的变量名', () => {
      // 艹，只允许字母、数字、点、下划线
      const template1 = '{{valid_name123}}';
      const template2 = '{{invalid-name}}'; // 不应该被替换（有短横线）
      const template3 = '{{invalid name}}'; // 不应该被替换（有空格）

      const variables = {
        valid_name123: 'OK',
        'invalid-name': 'BAD',
        'invalid name': 'BAD',
      };

      expect(replaceVariables(template1, variables)).toBe('OK');
      expect(replaceVariables(template2, variables)).toBe('{{invalid-name}}');
      expect(replaceVariables(template3, variables)).toBe('{{invalid name}}');
    });
  });

  describe('replaceVariables - 对象和数组', () => {
    test('应该递归替换对象中的变量', () => {
      const template = {
        name: '{{user.name}}',
        age: '{{user.age}}',
        message: 'Hello {{user.name}}!',
      };

      const variables = { user: { name: '老王', age: 35 } };

      expect(replaceVariables(template, variables)).toEqual({
        name: '老王',
        age: '35',
        message: 'Hello 老王!',
      });
    });

    test('应该递归替换数组中的变量', () => {
      const template = ['{{item1}}', '{{item2}}', '{{item3}}'];
      const variables = { item1: 'A', item2: 'B', item3: 'C' };

      expect(replaceVariables(template, variables)).toEqual(['A', 'B', 'C']);
    });

    test('应该处理嵌套的对象和数组', () => {
      const template = {
        users: [
          { name: '{{user1.name}}', age: '{{user1.age}}' },
          { name: '{{user2.name}}', age: '{{user2.age}}' },
        ],
      };

      const variables = {
        user1: { name: '老王', age: 35 },
        user2: { name: '小李', age: 28 },
      };

      expect(replaceVariables(template, variables)).toEqual({
        users: [
          { name: '老王', age: '35' },
          { name: '小李', age: '28' },
        ],
      });
    });

    test('应该保留非字符串类型', () => {
      const template = {
        name: '{{name}}',
        age: 35, // 数字，不替换
        active: true, // 布尔，不替换
      };

      const variables = { name: '老王' };

      expect(replaceVariables(template, variables)).toEqual({
        name: '老王',
        age: 35,
        active: true,
      });
    });
  });

  describe('extractVariableReferences', () => {
    test('应该提取字符串中的变量引用', () => {
      const template = 'Hello {{name}}, you are {{age}} years old';
      const refs = extractVariableReferences(template);

      expect(refs).toEqual(['name', 'age']);
    });

    test('应该提取嵌套变量引用', () => {
      const template = '{{user.profile.name}} lives in {{user.address.city}}';
      const refs = extractVariableReferences(template);

      expect(refs).toContain('user.profile.name');
      expect(refs).toContain('user.address.city');
    });

    test('应该去重', () => {
      const template = '{{name}} and {{name}} again';
      const refs = extractVariableReferences(template);

      expect(refs).toEqual(['name']);
    });

    test('应该递归提取对象中的引用', () => {
      const template = {
        name: '{{user.name}}',
        message: 'Hello {{user.name}}!',
        age: '{{user.age}}',
      };

      const refs = extractVariableReferences(template);

      expect(refs).toContain('user.name');
      expect(refs).toContain('user.age');
      expect(refs.length).toBe(2); // 去重后只有2个
    });

    test('空模板应该返回空数组', () => {
      expect(extractVariableReferences('')).toEqual([]);
      expect(extractVariableReferences({})).toEqual([]);
      expect(extractVariableReferences([])).toEqual([]);
    });
  });

  describe('validateVariables', () => {
    test('所有变量都存在时应该返回空数组', () => {
      const template = 'Hello {{name}}, age: {{age}}';
      const variables = { name: '老王', age: 35 };

      expect(validateVariables(template, variables)).toEqual([]);
    });

    test('应该返回缺失的变量名', () => {
      const template = 'Hello {{name}}, age: {{age}}, city: {{city}}';
      const variables = { name: '老王' };

      const missing = validateVariables(template, variables);

      expect(missing).toContain('age');
      expect(missing).toContain('city');
      expect(missing.length).toBe(2);
    });

    test('应该处理嵌套变量', () => {
      const template = '{{user.name}} lives in {{user.address.city}}';
      const variables = { user: { name: '老王' } }; // 缺少 address.city

      const missing = validateVariables(template, variables);

      expect(missing).toContain('user.address.city');
    });

    test('应该递归检查对象', () => {
      const template = {
        name: '{{user.name}}',
        age: '{{user.age}}',
        city: '{{user.city}}',
      };

      const variables = { user: { name: '老王' } };

      const missing = validateVariables(template, variables);

      expect(missing).toContain('user.age');
      expect(missing).toContain('user.city');
    });
  });

  describe('边界情况', () => {
    test('应该处理空模板', () => {
      expect(replaceVariables('', {})).toBe('');
      expect(replaceVariables(null, {})).toBeNull();
      expect(replaceVariables(undefined, {})).toBeUndefined();
    });

    test('应该处理没有变量的模板', () => {
      const template = 'Hello World';
      expect(replaceVariables(template, {})).toBe('Hello World');
    });

    test('应该处理连续的花括号', () => {
      const template = '{{{name}}}'; // 只有中间的{{name}}会被替换
      const variables = { name: '老王' };

      expect(replaceVariables(template, variables)).toBe('{老王}');
    });

    test('应该处理不完整的花括号', () => {
      const template = '{name} or {{name or {{name}}';
      const variables = { name: '老王' };

      // 只有完整的{{name}}会被替换
      expect(replaceVariables(template, variables)).toBe(
        '{name} or {{name or 老王'
      );
    });
  });
});
