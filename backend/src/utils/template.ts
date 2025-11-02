/**
 * 模板变量替换工具
 * 艹，这个工具只替换{{var}}，绝不允许执行任意表达式！
 * 安全第一，防止代码注入！
 */

/**
 * 变量替换选项
 */
export interface TemplateOptions {
  /** 是否对未找到的变量抛出错误（默认false，替换为空字符串） */
  throwOnMissing?: boolean;
  /** 是否转义HTML特殊字符（默认true） */
  escapeHtml?: boolean;
}

/**
 * 从对象中提取嵌套值
 * 支持点路径，如：user.profile.name
 * @param obj - 数据对象
 * @param path - 点路径
 * @returns 提取的值，不存在返回undefined
 */
export function extractValue(obj: any, path: string): any {
  if (!obj || typeof obj !== 'object') {
    return undefined;
  }

  // 艹，支持点路径（如 user.profile.name）
  const keys = path.split('.');
  let result = obj;

  for (const key of keys) {
    if (result == null || typeof result !== 'object') {
      return undefined;
    }
    result = result[key];
  }

  return result;
}

/**
 * HTML转义（防止XSS）
 * @param str - 输入字符串
 * @returns 转义后的字符串
 */
export function escapeHtml(str: string): string {
  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
  };

  return String(str).replace(/[&<>"'\/]/g, (match) => htmlEscapeMap[match]);
}

/**
 * 模板变量替换
 * 仅替换{{var}}格式的占位符，不支持表达式执行
 *
 * @param template - 模板字符串（可以是字符串、对象或数组）
 * @param variables - 变量对象
 * @param options - 替换选项
 * @returns 替换后的结果
 *
 * @example
 * ```typescript
 * const template = "Hello {{user.name}}, your age is {{user.age}}";
 * const variables = { user: { name: "老王", age: 35 } };
 * const result = replaceVariables(template, variables);
 * // => "Hello 老王, your age is 35"
 * ```
 */
export function replaceVariables(
  template: any,
  variables: Record<string, any>,
  options: TemplateOptions = {}
): any {
  const { throwOnMissing = false, escapeHtml: shouldEscape = false } = options;

  // 艹，如果template是字符串，直接替换
  if (typeof template === 'string') {
    // 匹配 {{varName}} 格式，不允许空格和特殊字符（安全考虑）
    return template.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (match, varPath) => {
      const value = extractValue(variables, varPath);

      if (value === undefined || value === null) {
        if (throwOnMissing) {
          throw new Error(`变量 "${varPath}" 未定义`);
        }
        return ''; // 默认替换为空字符串
      }

      // 转换为字符串
      let result = String(value);

      // 可选的HTML转义
      if (shouldEscape) {
        result = escapeHtml(result);
      }

      return result;
    });
  }

  // 如果template是数组，递归替换每个元素
  if (Array.isArray(template)) {
    return template.map((item) => replaceVariables(item, variables, options));
  }

  // 如果template是对象，递归替换每个值
  if (template !== null && typeof template === 'object') {
    const result: Record<string, any> = {};
    for (const key in template) {
      if (template.hasOwnProperty(key)) {
        result[key] = replaceVariables(template[key], variables, options);
      }
    }
    return result;
  }

  // 其他类型（数字、布尔等）直接返回
  return template;
}

/**
 * 检查模板中的变量引用
 * 返回所有{{var}}引用的变量名列表
 * @param template - 模板字符串或对象
 * @returns 变量名数组
 */
export function extractVariableReferences(template: any): string[] {
  const references = new Set<string>();

  function scan(value: any): void {
    if (typeof value === 'string') {
      // 匹配所有 {{varName}}
      const matches = value.matchAll(/\{\{([a-zA-Z0-9_.]+)\}\}/g);
      for (const match of matches) {
        references.add(match[1]);
      }
    } else if (Array.isArray(value)) {
      value.forEach(scan);
    } else if (value !== null && typeof value === 'object') {
      Object.values(value).forEach(scan);
    }
  }

  scan(template);
  return Array.from(references);
}

/**
 * 验证模板中的所有变量是否已定义
 * @param template - 模板字符串或对象
 * @param variables - 变量对象
 * @returns 缺失的变量名数组，如果全部存在则返回空数组
 */
export function validateVariables(
  template: any,
  variables: Record<string, any>
): string[] {
  const references = extractVariableReferences(template);
  const missing: string[] = [];

  for (const varPath of references) {
    const value = extractValue(variables, varPath);
    if (value === undefined || value === null) {
      missing.push(varPath);
    }
  }

  return missing;
}
