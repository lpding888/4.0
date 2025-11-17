/**
 * HTML 净化工具 - DOMPurify 封装
 * 艹!防止XSS攻击,净化所有富文本输入!
 *
 * @author 老王
 */

/* eslint-disable @typescript-eslint/no-var-requires */
import type { DOMPurifyI } from 'dompurify';

type DOMPurifyInstance = DOMPurifyI & typeof import('dompurify');

let DOMPurify: DOMPurifyInstance;

function ensureDOMPurify(): DOMPurifyInstance {
  if (DOMPurify) {
    return DOMPurify;
  }

  try {
    // 优先使用isomorphic版本，兼容SSR
    DOMPurify = require('isomorphic-dompurify');
  } catch (error) {
    // Jest/某些环境可能无法解析isomorphic版本，回退到dompurify + jsdom
    const createDOMPurify = require('dompurify');
    if (typeof window !== 'undefined' && window.document) {
      DOMPurify = createDOMPurify(window);
    } else {
      const { JSDOM } = require('jsdom');
      const { window: jsdomWindow } = new JSDOM('<!DOCTYPE html>');
      DOMPurify = createDOMPurify(jsdomWindow as unknown as Window);
    }
  }

  return DOMPurify;
}

ensureDOMPurify();

/**
 * 默认配置:允许的HTML标签
 */
const DEFAULT_ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's', 'span', 'div',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'a', 'img',
  'blockquote', 'code', 'pre',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
];

/**
 * 默认配置:允许的属性
 */
const DEFAULT_ALLOWED_ATTR = [
  'class', 'id', 'style',
  'href', 'target', 'rel',
  'src', 'alt', 'width', 'height',
];

/**
 * 严格模式:只允许纯文本
 */
const STRICT_CONFIG = {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true, // 保留文本内容,只去除标签
};

/**
 * 基础模式:允许基本格式化标签
 */
const BASIC_CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'span'],
  ALLOWED_ATTR: ['class'],
};

/**
 * 富文本模式:允许完整的富文本标签
 */
const RICH_TEXT_CONFIG = {
  ALLOWED_TAGS: DEFAULT_ALLOWED_TAGS,
  ALLOWED_ATTR: DEFAULT_ALLOWED_ATTR,
  ALLOW_DATA_ATTR: false, // 禁止data-*属性,防止存储型XSS
};

/**
 * 模板预览模式:允许模板中的特殊标签
 */
const TEMPLATE_CONFIG = {
  ALLOWED_TAGS: [...DEFAULT_ALLOWED_TAGS, 'button', 'input', 'form', 'label'],
  ALLOWED_ATTR: [...DEFAULT_ALLOWED_ATTR, 'type', 'placeholder', 'disabled', 'readonly'],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed'], // 明确禁止危险标签
  FORBID_ATTR: ['onclick', 'onerror', 'onload'], // 明确禁止事件属性
};

/**
 * 净化HTML内容
 *
 * @param dirty - 待净化的HTML字符串
 * @param mode - 净化模式 ('strict' | 'basic' | 'rich' | 'template')
 * @returns 净化后的安全HTML字符串
 */
export function sanitizeHtml(
  dirty: string,
  mode: 'strict' | 'basic' | 'rich' | 'template' = 'basic'
): string {
  if (!dirty) {
    return '';
  }

  // 根据模式选择配置
  let config;
  switch (mode) {
    case 'strict':
      config = STRICT_CONFIG;
      break;
    case 'basic':
      config = BASIC_CONFIG;
      break;
    case 'rich':
      config = RICH_TEXT_CONFIG;
      break;
    case 'template':
      config = TEMPLATE_CONFIG;
      break;
    default:
      config = BASIC_CONFIG;
  }

  try {
    // 使用DOMPurify净化
    const purifier = ensureDOMPurify();
    const clean = purifier.sanitize(dirty, config);
    return clean;
  } catch (error) {
    console.error('[Sanitize] HTML净化失败:', error);
    // 失败时返回纯文本(移除所有HTML标签)
    return dirty.replace(/<[^>]*>/g, '');
  }
}

/**
 * 净化URL,防止javascript:协议等危险URL
 *
 * @param url - 待净化的URL字符串
 * @returns 净化后的安全URL,如果不安全则返回空字符串
 */
export function sanitizeUrl(url: string): string {
  if (!url) {
    return '';
  }

  // 转换为小写检查协议
  const lowerUrl = url.toLowerCase().trim();

  // 危险协议列表
  const dangerousProtocols = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'about:',
  ];

  // 检查是否包含危险协议
  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      console.warn(`[Sanitize] 检测到危险URL协议: ${protocol}`);
      return '';
    }
  }

  // 只允许http/https/mailto/tel协议
  const safeProtocols = ['http://', 'https://', 'mailto:', 'tel:', '/'];
  const isSafe = safeProtocols.some(protocol => lowerUrl.startsWith(protocol));

  if (!isSafe && lowerUrl.includes(':')) {
    console.warn(`[Sanitize] URL协议不在白名单中: ${url}`);
    return '';
  }

  return url;
}

/**
 * 净化文件名,防止路径遍历攻击
 *
 * @param filename - 待净化的文件名
 * @returns 净化后的安全文件名
 */
export function sanitizeFilename(filename: string): string {
  // 如果输入为空或null,返回默认文件名
  if (!filename || filename.trim() === '') {
    return 'untitled';
  }

  // 移除路径分隔符和特殊字符
  let clean = filename
    .replace(/[/\\]/g, '') // 移除路径分隔符
    .replace(/\.\./g, '') // 移除父目录引用
    .replace(/[<>:"|?*\x00-\x1f]/g, '') // 移除Windows不允许的字符
    .trim();

  // 如果清理后为空,使用默认文件名
  if (!clean) {
    clean = 'untitled';
  }

  return clean;
}

/**
 * 净化对象的所有字符串值(递归)
 * 用于净化API响应或用户输入的对象
 *
 * @param obj - 待净化的对象
 * @param mode - 净化模式
 * @returns 净化后的对象
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  mode: 'strict' | 'basic' | 'rich' | 'template' = 'basic'
): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sanitized: any = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    const value = obj[key];

    if (typeof value === 'string') {
      // 字符串类型:净化HTML
      sanitized[key] = sanitizeHtml(value, mode);
    } else if (typeof value === 'object' && value !== null) {
      // 对象或数组:递归净化
      sanitized[key] = sanitizeObject(value, mode);
    } else {
      // 其他类型:直接复制
      sanitized[key] = value;
    }
  }

  return sanitized;
}
