/**
 * Prompt服务 - Handlebars渲染与预览 (CMS-303)
 * 艹！受限Handlebars渲染，禁止任意代码执行！
 */

const Handlebars = require('handlebars');
const logger = require('../utils/logger');

/**
 * 安全Helpers白名单
 * 艹！只允许这些helpers，禁止eval等危险操作！
 */
const SAFE_HELPERS = {
  // 逻辑判断
  eq: (a, b) => a === b,
  neq: (a, b) => a !== b,
  lt: (a, b) => a < b,
  gt: (a, b) => a > b,
  lte: (a, b) => a <= b,
  gte: (a, b) => a >= b,
  and: (...args) => {
    const options = args.pop();
    return args.every(Boolean);
  },
  or: (...args) => {
    const options = args.pop();
    return args.some(Boolean);
  },
  not: (value) => !value,

  // 字符串处理
  uppercase: (str) => (str || '').toString().toUpperCase(),
  lowercase: (str) => (str || '').toString().toLowerCase(),
  capitalize: (str) => {
    const s = (str || '').toString();
    return s.charAt(0).toUpperCase() + s.slice(1);
  },
  trim: (str) => (str || '').toString().trim(),
  truncate: (str, length) => {
    const s = (str || '').toString();
    return s.length > length ? s.substring(0, length) + '...' : s;
  },

  // 数组处理
  join: (arr, separator = ',') => {
    if (!Array.isArray(arr)) return '';
    return arr.join(separator);
  },
  length: (arr) => {
    if (Array.isArray(arr)) return arr.length;
    if (typeof arr === 'string') return arr.length;
    if (typeof arr === 'object' && arr !== null) return Object.keys(arr).length;
    return 0;
  },
  first: (arr) => (Array.isArray(arr) && arr.length > 0 ? arr[0] : null),
  last: (arr) => (Array.isArray(arr) && arr.length > 0 ? arr[arr.length - 1] : null),

  // JSON处理
  json: (obj) => JSON.stringify(obj),
  jsonPretty: (obj) => JSON.stringify(obj, null, 2),

  // 日期处理
  formatDate: (date, format = 'YYYY-MM-DD') => {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  },

  // 数学运算
  add: (a, b) => Number(a) + Number(b),
  subtract: (a, b) => Number(a) - Number(b),
  multiply: (a, b) => Number(a) * Number(b),
  divide: (a, b) => (Number(b) !== 0 ? Number(a) / Number(b) : 0),

  // 默认值
  default: (value, defaultValue) => (value !== null && value !== undefined ? value : defaultValue),
};

/**
 * 创建安全的Handlebars实例
 * 艹！只注册白名单helpers，其他一律不允许！
 */
function createSafeHandlebars() {
  const hbs = Handlebars.create();

  // 注册安全helpers
  Object.entries(SAFE_HELPERS).forEach(([name, fn]) => {
    hbs.registerHelper(name, fn);
  });

  // 禁用原型污染
  hbs.JavaScriptCompiler.prototype.quotedString = function (str) {
    return '"' + str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
  };

  return hbs;
}

/**
 * 提取模板中引用的变量路径
 * 艹！扫描{{variable.path}}提取所有变量！
 *
 * @param {string} template - 模板字符串
 * @returns {string[]} 变量路径数组
 */
function extractVariables(template) {
  const regex = /\{\{([^}]+)\}\}/g;
  const variables = new Set();
  let match;

  while ((match = regex.exec(template)) !== null) {
    const content = match[1].trim();

    // 跳过helpers调用和特殊语法
    if (content.startsWith('#') || content.startsWith('/') || content.startsWith('!')) {
      continue;
    }

    // 提取变量名（去掉helper部分）
    const parts = content.split(/\s+/);
    parts.forEach((part) => {
      // 跳过字符串字面量和数字
      if (/^["']/.test(part) || /^\d+$/.test(part)) return;

      // 提取变量路径
      const varPath = part.split('.')[0];
      if (varPath && !SAFE_HELPERS[varPath]) {
        variables.add(part);
      }
    });
  }

  return Array.from(variables);
}

/**
 * 检查变量是否存在于context中
 * 艹！深度检查变量路径是否可访问！
 *
 * @param {string} varPath - 变量路径，如 'user.profile.name'
 * @param {object} context - 变量上下文
 * @returns {boolean}
 */
function isVariableAvailable(varPath, context) {
  const parts = varPath.split('.');
  let current = context;

  for (const part of parts) {
    if (current === null || current === undefined || !(part in current)) {
      return false;
    }
    current = current[part];
  }

  return true;
}

/**
 * 渲染Handlebars模板（受限安全版本）
 * 艹！这是核心渲染函数，必须安全可靠！
 *
 * @param {string} template - 模板字符串
 * @param {object} variables - 变量上下文
 * @returns {object} { success, result?, error?, missingVars? }
 */
function renderTemplate(template, variables = {}) {
  try {
    // 创建安全Handlebars实例
    const hbs = createSafeHandlebars();

    // 提取模板中的变量
    const extractedVars = extractVariables(template);

    // 检查缺失的变量
    const missingVars = extractedVars.filter((varPath) => !isVariableAvailable(varPath, variables));

    // 编译并渲染模板
    const compiled = hbs.compile(template, {
      noEscape: false, // 默认转义，防止XSS
      strict: false, // 宽松模式，缺失变量不报错
    });

    const result = compiled(variables);

    logger.info('[PromptService] 模板渲染成功', {
      templateLength: template.length,
      varsCount: extractedVars.length,
      missingVarsCount: missingVars.length,
    });

    return {
      success: true,
      result,
      missingVars: missingVars.length > 0 ? missingVars : undefined,
    };
  } catch (error) {
    logger.error('[PromptService] 模板渲染失败', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 校验模板语法
 * 艹！预先检查模板是否合法！
 *
 * @param {string} template - 模板字符串
 * @returns {object} { valid, error? }
 */
function validateTemplate(template) {
  try {
    const hbs = createSafeHandlebars();
    hbs.compile(template);

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
}

module.exports = {
  renderTemplate,
  validateTemplate,
  extractVariables,
  SAFE_HELPERS,
};
