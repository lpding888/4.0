/**
 * Prompt管理控制器 (CMS-303)
 * 艹！提供模板预览、校验等功能！
 */

const promptService = require('../../services/prompt.service');
const logger = require('../../utils/logger');

/**
 * 预览Prompt模板
 * POST /admin/prompts/preview
 *
 * Body: {
 *   template: string,
 *   variables: object
 * }
 */
async function previewPrompt(req, res, next) {
  try {
    const { template, variables = {} } = req.body;

    // 参数校验
    if (!template || typeof template !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 4001,
          message: '缺少必要参数: template (字符串)',
        },
      });
    }

    if (typeof variables !== 'object' || Array.isArray(variables)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 4001,
          message: 'variables 必须是对象',
        },
      });
    }

    // 渲染模板
    const result = promptService.renderTemplate(template, variables);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 4002,
          message: `模板渲染失败: ${result.error}`,
        },
      });
    }

    logger.info('[PromptsController] 模板预览成功', {
      templateLength: template.length,
      missingVars: result.missingVars?.length || 0,
    });

    res.json({
      success: true,
      data: {
        result: result.result,
        missingVars: result.missingVars || [],
        availableHelpers: Object.keys(promptService.SAFE_HELPERS),
      },
    });
  } catch (error) {
    logger.error('[PromptsController] 预览失败', error);
    next(error);
  }
}

/**
 * 校验Prompt模板语法
 * POST /admin/prompts/validate
 *
 * Body: {
 *   template: string
 * }
 */
async function validatePrompt(req, res, next) {
  try {
    const { template } = req.body;

    if (!template || typeof template !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 4001,
          message: '缺少必要参数: template',
        },
      });
    }

    // 校验语法
    const validation = promptService.validateTemplate(template);

    if (!validation.valid) {
      return res.json({
        success: true,
        data: {
          valid: false,
          error: validation.error,
        },
      });
    }

    // 提取变量
    const variables = promptService.extractVariables(template);

    res.json({
      success: true,
      data: {
        valid: true,
        variables,
      },
    });
  } catch (error) {
    logger.error('[PromptsController] 校验失败', error);
    next(error);
  }
}

/**
 * 获取可用Helpers列表
 * GET /admin/prompts/helpers
 */
async function getHelpers(req, res, next) {
  try {
    const helpers = Object.keys(promptService.SAFE_HELPERS).map((name) => {
      const descriptions = {
        eq: '相等判断: {{#if (eq a b)}}',
        neq: '不等判断: {{#if (neq a b)}}',
        lt: '小于: {{#if (lt a b)}}',
        gt: '大于: {{#if (gt a b)}}',
        lte: '小于等于: {{#if (lte a b)}}',
        gte: '大于等于: {{#if (gte a b)}}',
        and: '逻辑与: {{#if (and a b c)}}',
        or: '逻辑或: {{#if (or a b c)}}',
        not: '逻辑非: {{#if (not a)}}',
        uppercase: '转大写: {{uppercase str}}',
        lowercase: '转小写: {{lowercase str}}',
        capitalize: '首字母大写: {{capitalize str}}',
        trim: '去空格: {{trim str}}',
        truncate: '截断: {{truncate str 100}}',
        join: '数组连接: {{join arr ","}}',
        length: '长度: {{length arr}}',
        first: '首元素: {{first arr}}',
        last: '尾元素: {{last arr}}',
        json: 'JSON化: {{json obj}}',
        jsonPretty: 'JSON美化: {{jsonPretty obj}}',
        formatDate: '格式化日期: {{formatDate date "YYYY-MM-DD"}}',
        add: '加法: {{add a b}}',
        subtract: '减法: {{subtract a b}}',
        multiply: '乘法: {{multiply a b}}',
        divide: '除法: {{divide a b}}',
        default: '默认值: {{default value "默认"}}',
      };

      return {
        name,
        description: descriptions[name] || name,
        category: getCategoryByHelper(name),
      };
    });

    res.json({
      success: true,
      data: {
        helpers,
        total: helpers.length,
      },
    });
  } catch (error) {
    logger.error('[PromptsController] 获取helpers失败', error);
    next(error);
  }
}

/**
 * 辅助函数：根据helper名称获取分类
 */
function getCategoryByHelper(name) {
  const categories = {
    logic: ['eq', 'neq', 'lt', 'gt', 'lte', 'gte', 'and', 'or', 'not'],
    string: ['uppercase', 'lowercase', 'capitalize', 'trim', 'truncate'],
    array: ['join', 'length', 'first', 'last'],
    json: ['json', 'jsonPretty'],
    date: ['formatDate'],
    math: ['add', 'subtract', 'multiply', 'divide'],
    utility: ['default'],
  };

  for (const [category, helpers] of Object.entries(categories)) {
    if (helpers.includes(name)) return category;
  }

  return 'other';
}

module.exports = {
  previewPrompt,
  validatePrompt,
  getHelpers,
};
