/**
 * 模板渲染器
 * 负责加载模板并进行变量替换
 */

const fs = require('fs');
const path = require('path');
const logger = require('../../common/logger');

/**
 * 加载模板文件
 * @param {string} templateName - 模板名称
 * @param {string} basePath - 模板基础路径
 * @returns {Object} 模板对象
 */
function loadTemplate(templateName, basePath = './templates') {
  try {
    const templatePath = path.join(basePath, `${templateName}.json`);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`模板不存在: ${templateName}`);
    }

    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const template = JSON.parse(templateContent);

    logger.debug('模板加载成功', { templateName, templatePath });
    return template;

  } catch (error) {
    logger.error('模板加载失败', { templateName, error: error.message });
    throw new Error(`模板加载失败: ${error.message}`);
  }
}

/**
 * 替换模板变量
 * @param {string} text - 包含变量的文本
 * @param {Object} variables - 变量对象
 * @returns {string} 替换后的文本
 */
function replaceVariables(text, variables) {
  let result = text;

  // 替换 {{variable_name}} 格式的变量
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value);
  }

  return result;
}

/**
 * 渲染模板
 * @param {string} templateName - 模板名称
 * @param {Object} data - 渲染数据
 * @param {Array<string>} data.skuNames - SKU名称列表
 * @param {string} data.launchDate - 上新日期
 * @param {string} data.storeName - 店铺名称
 * @param {string} basePath - 模板基础路径
 * @returns {Object} 渲染后的文案包
 */
function render(templateName, data, basePath = './templates') {
  try {
    logger.info('开始渲染模板', { templateName, data });

    // 1. 加载模板
    const template = loadTemplate(templateName, basePath);

    // 2. 准备变量
    const variables = {
      sku_count: data.skuNames ? data.skuNames.length : 0,
      sku_list: data.skuNames ? data.skuNames.join('、') : '',
      launch_date: data.launchDate || '',
      store_name: data.storeName || '店铺'
    };

    // 3. 渲染各个字段
    const result = {
      template_name: template.template_name,
      title: replaceVariables(template.title, variables),
      description: replaceVariables(template.description, variables),
      subtitle: template.subtitle || '',
      call_to_action: template.call_to_action || '',
      hashtags: template.hashtags || [],
      emoji_prefix: template.emoji_prefix || '',
      footer: template.footer || ''
    };

    logger.info('模板渲染完成', { templateName, result });
    return result;

  } catch (error) {
    logger.error('模板渲染失败', { templateName, error: error.message });
    throw new Error(`模板渲染失败: ${error.message}`);
  }
}

/**
 * 获取所有可用模板列表
 * @param {string} basePath - 模板基础路径
 * @returns {Array<string>} 模板名称列表
 */
function listTemplates(basePath = './templates') {
  try {
    const files = fs.readdirSync(basePath);
    const templates = files
      .filter(file => file.endsWith('.json'))
      .map(file => path.basename(file, '.json'));

    logger.debug('可用模板列表', { templates });
    return templates;

  } catch (error) {
    logger.error('获取模板列表失败', { error: error.message });
    return [];
  }
}

module.exports = {
  render,
  loadTemplate,
  listTemplates
};
