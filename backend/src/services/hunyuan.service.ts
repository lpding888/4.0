import logger from '../utils/logger.js';
import systemConfigService from './systemConfig.service.js';
import { createHttpClient } from '../utils/httpClient.js';

type PromptParameters = {
  clothingType?: string;
  requirements?: string;
  [key: string]: unknown;
};

type PromptTemplateConfig = {
  template: string;
  variables?: string[];
};

const isPromptTemplateConfig = (value: unknown): value is PromptTemplateConfig =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as PromptTemplateConfig).template === 'string';

type HunyuanChoice = {
  message?: {
    content?: string;
  };
};

type HunyuanResponse = {
  choices?: HunyuanChoice[];
};

class HunyuanService {
  private initialized = false;

  private apiKey?: string;

  private apiSecret?: string;

  private baseUrl: string = process.env.HUNYUAN_API_URL ?? 'https://hunyuan.tencentcloudapi.com';

  private client = createHttpClient({
    serviceName: 'hunyuan',
    // 不设置baseURL，直接在调用里拼完整URL，避免和动态配置打架
    timeoutMs: 10_000,
    maxRetries: 1
  });

  private async _initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const configuredKey = (await systemConfigService.get('hunyuan_api_key')) as
        | string
        | null
        | undefined;
      const configuredSecret = (await systemConfigService.get('hunyuan_api_secret')) as
        | string
        | null
        | undefined;
      const configuredBaseUrl = (await systemConfigService.get('hunyuan_api_url')) as
        | string
        | null
        | undefined;

      this.apiKey = configuredKey ?? process.env.HUNYUAN_API_KEY;
      this.apiSecret = configuredSecret ?? process.env.HUNYUAN_API_SECRET;
      this.baseUrl = configuredBaseUrl ?? this.baseUrl;

      if (!this.apiKey || !this.apiSecret) {
        logger.error('[HunyuanService] 混元API密钥未配置，请通过管理后台配置API密钥');
        throw new Error('混元API密钥未配置，请通过管理后台配置API密钥');
      }

      this.initialized = true;
      logger.info('[HunyuanService] 混元服务初始化成功（使用动态配置）');
    } catch (error) {
      logger.error('[HunyuanService] 初始化失败:', error);
      throw error;
    }
  }

  async generateShootingScript(imageUrl: string, params: PromptParameters = {}): Promise<string> {
    await this._initialize();

    try {
      const prompt = await this.buildPrompt(imageUrl, params);

      logger.info('[HunyuanService] 开始生成拍摄脚本', { imageUrl });

      const response = await this.callHunyuanAPI(prompt);

      logger.info('[HunyuanService] 拍摄脚本生成成功', {
        imageUrl,
        scriptLength: response.length
      });

      return response;
    } catch (error) {
      const err = error as Error;
      logger.error('[HunyuanService] 生成拍摄脚本失败', {
        imageUrl,
        error: err.message
      });
      throw new Error(`拍摄脚本生成失败: ${err.message}`);
    }
  }

  async buildPrompt(imageUrl: string, params: PromptParameters = {}): Promise<string> {
    try {
      const promptConfig = await systemConfigService.get<PromptTemplateConfig>(
        'video_shooting_prompt_template'
      );

      if (isPromptTemplateConfig(promptConfig)) {
        let prompt: string = promptConfig.template;
        const replacements: Record<string, string> = {
          imageUrl,
          clothingType: params.clothingType ?? '未指定',
          requirements: params.requirements ?? '标准商业拍摄'
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
      }

      return this._getDefaultPrompt(imageUrl, params);
    } catch (error) {
      logger.error('[HunyuanService] 构建提示词失败，使用默认模板', error);
      return this._getDefaultPrompt(imageUrl, params);
    }
  }

  private _getDefaultPrompt(imageUrl: string, _params: PromptParameters): string {
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

  async callHunyuanAPI(prompt: string): Promise<string> {
    await this._initialize();

    const requestData = {
      prompt,
      max_tokens: 500,
      temperature: 0.7
    };

    try {
      const data = await this.client.post<HunyuanResponse>(
        `${this.baseUrl}/v1/chat/completions`,
        requestData,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeoutMs: 10_000
        }
      );

      const content = data?.choices?.[0]?.message?.content?.trim();
      if (content) {
        return content;
      }

      throw new Error('混元API返回格式异常');
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ECONNABORTED') {
        throw new Error('混元API调用超时');
      }
      throw err;
    }
  }

  validateScript(script: string): boolean {
    if (!script || script.length < 100) {
      return false;
    }

    const requiredKeywords = ['镜头1', '镜头2', '镜头3', '镜头4'];
    const hasAllShots = requiredKeywords.every((keyword) => script.includes(keyword));
    const isReasonableLength = script.length >= 200 && script.length <= 500;

    return hasAllShots && isReasonableLength;
  }
}

const hunyuanService = new HunyuanService();

export default hunyuanService;
