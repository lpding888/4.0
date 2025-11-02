const axios = require('axios');
const logger = require('../utils/logger');
const systemConfigService = require('./systemConfig.service');

/**
 * 混元大模型服务 - 生成服装视频拍摄脚本
 */
class HunyuanService {
  constructor() {
    // 延迟初始化，不在构造函数中强制检查配置
    this._initialized = false;
  }

  /**
   * 初始化配置（懒加载）- 使用动态配置
   */
  async _initialize() {
    if (this._initialized) return;

    try {
      // 优先从动态配置获取，回退到环境变量
      this.apiKey = await systemConfigService.get('hunyuan_api_key', process.env.HUNYUAN_API_KEY);
      this.apiSecret = await systemConfigService.get('hunyuan_api_secret', process.env.HUNYUAN_API_SECRET);
      this.baseUrl = await systemConfigService.get('hunyuan_api_url', process.env.HUNYUAN_API_URL || 'https://hunyuan.tencentcloudapi.com');

      if (!this.apiKey || !this.apiSecret) {
        logger.error('[HunyuanService] 混元API密钥未配置，请通过管理后台配置API密钥');
        throw new Error('混元API密钥未配置，请通过管理后台配置API密钥');
      }

      this._initialized = true;
      logger.info('[HunyuanService] 混元服务初始化成功（使用动态配置）');
    } catch (error) {
      logger.error('[HunyuanService] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 生成服装视频拍摄脚本
   * @param {string} imageUrl - 服装图片URL
   * @param {Object} params - 额外参数
   * @returns {Promise<string>} 拍摄脚本内容
   */
  async generateShootingScript(imageUrl, params = {}) {
    await this._initialize();

    try {
      const prompt = await this.buildPrompt(imageUrl, params);

      logger.info('[HunyuanService] 开始生成拍摄脚本', { imageUrl });

      // 调用混元API
      const response = await this.callHunyuanAPI(prompt);

      logger.info('[HunyuanService] 拍摄脚本生成成功', {
        imageUrl,
        scriptLength: response.length
      });

      return response;

    } catch (error) {
      logger.error('[HunyuanService] 生成拍摄脚本失败', {
        imageUrl,
        error: error.message
      });
      throw new Error(`拍摄脚本生成失败: ${error.message}`);
    }
  }

  /**
   * 构建拍摄脚本提示词（使用动态配置）
   * @param {string} imageUrl - 服装图片URL
   * @param {Object} params - 额外参数
   * @returns {string} 完整的提示词
   */
  async buildPrompt(imageUrl, params) {
    try {
      // 从动态配置获取提示词模板
      const promptConfig = await systemConfigService.get('video_shooting_prompt_template');

      if (promptConfig && promptConfig.template) {
        // 使用动态模板
        let prompt = promptConfig.template;

        // 替换模板变量
        const replacements = {
          imageUrl: imageUrl,
          clothingType: params.clothingType || '未指定',
          requirements: params.requirements || '标准商业拍摄'
        };

        Object.entries(replacements).forEach(([key, value]) => {
          const placeholder = `{{${key}}}`;
          prompt = prompt.replace(new RegExp(placeholder, 'g'), value);
        });

        logger.info('[HunyuanService] 使用动态提示词模板', {
          templateLength: promptConfig.template.length,
          variables: promptConfig.variables || []
        });

        return prompt;
      } else {
        // 回退到默认模板
        return this._getDefaultPrompt(imageUrl, params);
      }
    } catch (error) {
      logger.error('[HunyuanService] 构建提示词失败，使用默认模板', error);
      return this._getDefaultPrompt(imageUrl, params);
    }
  }

  /**
   * 默认提示词模板（回退方案）
   * @private
   */
  _getDefaultPrompt(imageUrl, params) {
    return `你是一个专业的视频编导。根据这张服装图片，为一个8秒的短视频编写详细拍摄脚本。

脚本应包括以下4个镜头：
[镜头1] 开场镜头：简洁介绍服装和品牌风格
[镜头2] 主体展示：模特穿着该服装走动、转身、展示
[镜头3] 细节特写：服装细节、面料、工艺等的特写
[镜头4] 结束镜头：最终效果展示和品牌形象传达

内容要素要求：
- 服装类型识别：根据图片识别是上衣/裙子/裤子等
- 动作设计：符合服装特点和风格的自然动作
- 运镜方式：专业的摄影机运动（推拉摇移跟升降）
- 灯光设置：与服装风格相匹配的灯光搭配
- 背景氛围：专业级别的商业展示背景
- 音乐建议：适合的背景音乐类型和节奏

脚本要求：
- 总长度：200-300字
- 语言：中文描述
- 风格：专业、具体、可执行
- 格式：按镜头分段描述

图片URL: ${imageUrl}

请严格按照上述要求生成专业的拍摄脚本。`;
  }

  /**
   * 调用混元API
   * @param {string} prompt - 提示词
   * @returns {Promise<string>} 生成的文本
   */
  async callHunyuanAPI(prompt) {
    await this._initialize();

    // 这里实现混元API的具体调用
    // 根据混元大模型的API文档进行实现

    const requestData = {
      // 混元API的请求参数
      // 具体参数需要参考混元API文档
      prompt: prompt,
      max_tokens: 500,
      temperature: 0.7,
      // ... 其他参数
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/chat/completions`,
        requestData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10秒超时
        }
      );

      if (response.data && response.data.choices && response.data.choices.length > 0) {
        return response.data.choices[0].message.content.trim();
      } else {
        throw new Error('混元API返回格式异常');
      }

    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('混元API调用超时');
      }
      throw error;
    }
  }

  /**
   * 验证拍摄脚本质量
   * @param {string} script - 生成的脚本
   * @returns {boolean} 是否通过验证
   */
  validateScript(script) {
    if (!script || script.length < 100) {
      return false;
    }

    // 检查是否包含必要的镜头信息
    const requiredKeywords = ['镜头1', '镜头2', '镜头3', '镜头4'];
    const hasAllShots = requiredKeywords.every(keyword =>
      script.includes(keyword)
    );

    // 检查脚本长度是否合理
    const isReasonableLength = script.length >= 200 && script.length <= 500;

    return hasAllShots && isReasonableLength;
  }
}

module.exports = new HunyuanService();