/**
 * Handlebars模板渲染工具 (CMS-303)
 * 艹！用于将{{变量}}替换为实际值！
 */

import Handlebars from 'handlebars';

/**
 * 渲染Handlebars模板
 *
 * @param template 模板字符串，如 '{"url": "{{form.imageUrl}}"}'
 * @param context 变量上下文对象，如 { form: { imageUrl: 'https://...' } }
 * @returns 渲染后的字符串
 *
 * @example
 * const template = '{"url": "{{form.imageUrl}}", "user": "{{system.userId}}"}';
 * const context = {
 *   form: { imageUrl: 'https://example.com/image.jpg' },
 *   system: { userId: 'user123' }
 * };
 * const result = renderTemplate(template, context);
 * // 结果: '{"url": "https://example.com/image.jpg", "user": "user123"}'
 */
export function renderTemplate(template: string, context: any): string {
  try {
    const compiledTemplate = Handlebars.compile(template);
    return compiledTemplate(context);
  } catch (error: any) {
    console.error('[Template] 渲染失败:', error);
    throw new Error(`模板渲染失败: ${error.message}`);
  }
}

/**
 * 安全渲染模板（捕获异常，返回错误信息）
 *
 * @param template 模板字符串
 * @param context 变量上下文
 * @returns { success: boolean, result?: string, error?: string }
 */
export function safeRenderTemplate(
  template: string,
  context: any
): { success: boolean; result?: string; error?: string } {
  try {
    const result = renderTemplate(template, context);
    return { success: true, result };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 批量渲染模板对象
 * 艹！遍历对象的所有字段，对字符串字段进行模板渲染！
 *
 * @param obj 包含模板字符串的对象
 * @param context 变量上下文
 * @returns 渲染后的对象
 *
 * @example
 * const obj = {
 *   url: '{{form.imageUrl}}',
 *   method: 'POST',
 *   headers: {
 *     Authorization: 'Bearer {{system.token}}'
 *   }
 * };
 * const context = {
 *   form: { imageUrl: 'https://example.com/image.jpg' },
 *   system: { token: 'abc123' }
 * };
 * const result = renderObjectTemplate(obj, context);
 * // 结果: {
 * //   url: 'https://example.com/image.jpg',
 * //   method: 'POST',
 * //   headers: { Authorization: 'Bearer abc123' }
 * // }
 */
export function renderObjectTemplate(obj: any, context: any): any {
  if (typeof obj === 'string') {
    // 字符串直接渲染
    return renderTemplate(obj, context);
  }

  if (Array.isArray(obj)) {
    // 数组递归渲染每个元素
    return obj.map((item) => renderObjectTemplate(item, context));
  }

  if (obj !== null && typeof obj === 'object') {
    // 对象递归渲染每个字段
    const result: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = renderObjectTemplate(obj[key], context);
      }
    }
    return result;
  }

  // 其他类型（number, boolean, null等）直接返回
  return obj;
}

/**
 * 检测模板中的变量引用
 * 艹！提取模板中所有{{}}包裹的变量路径！
 *
 * @param template 模板字符串
 * @returns 变量路径数组，如 ['form.imageUrl', 'system.userId']
 *
 * @example
 * const template = '{"url": "{{form.imageUrl}}", "user": "{{system.userId}}"}';
 * const vars = extractTemplateVars(template);
 * // 结果: ['form.imageUrl', 'system.userId']
 */
export function extractTemplateVars(template: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const vars: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(template)) !== null) {
    const varPath = match[1]!.trim();
    if (varPath && !vars.includes(varPath)) {
      vars.push(varPath);
    }
  }

  return vars;
}

/**
 * 校验模板变量是否都存在于context中
 *
 * @param template 模板字符串
 * @param context 变量上下文
 * @returns { valid: boolean, missingVars: string[] }
 *
 * @example
 * const template = '{"url": "{{form.imageUrl}}", "user": "{{system.userId}}"}';
 * const context = { form: { imageUrl: 'https://...' } }; // 缺少 system.userId
 * const validation = validateTemplateVars(template, context);
 * // 结果: { valid: false, missingVars: ['system.userId'] }
 */
export function validateTemplateVars(
  template: string,
  context: any
): { valid: boolean; missingVars: string[] } {
  const vars = extractTemplateVars(template);
  const missingVars: string[] = [];

  vars.forEach((varPath) => {
    const parts = varPath.split('.');
    let current = context;

    for (const part of parts) {
      if (current === null || current === undefined || !(part in current)) {
        missingVars.push(varPath);
        break;
      }
      current = current[part];
    }
  });

  return {
    valid: missingVars.length === 0,
    missingVars,
  };
}

/**
 * 注册Handlebars Helper
 * 艹！扩展Handlebars功能，支持更多操作！
 */
export function registerHelpers() {
  // 格式化日期
  Handlebars.registerHelper('formatDate', (date: Date | string, format: string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    // 简单格式化实现
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return format
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day);
  });

  // JSON stringify
  Handlebars.registerHelper('json', (obj: any) => {
    return JSON.stringify(obj);
  });

  // 大写
  Handlebars.registerHelper('uppercase', (str: string) => {
    return str.toUpperCase();
  });

  // 小写
  Handlebars.registerHelper('lowercase', (str: string) => {
    return str.toLowerCase();
  });

  console.log('[Template] Handlebars Helpers已注册');
}

// 自动注册Helpers
registerHelpers();
