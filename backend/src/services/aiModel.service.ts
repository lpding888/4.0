import { nanoid } from 'nanoid';
import logger from '../utils/logger.js';
import taskService from './task.service.js';
import contentAuditService from './contentAudit.service.js';
import systemConfigService from './systemConfig.service.js';
import { db } from '../config/database.js';
import { createHttpClient } from '../utils/httpClient.js';

interface SystemConfigService {
  get(key: string, defaultValue?: string): Promise<string | unknown>;
}

interface TaskStatusPayload {
  errorMessage?: string;
  resultUrls?: string[];
}

interface RunningHubResponse {
  taskId?: string;
  status?: string;
  outputs?: string[];
  data?: {
    data?: {
      taskId?: string;
    };
    taskId?: string;
    status?: string;
    outputs?: string[];
  };
}

class AIModelService {
  private config = {
    apiUrl: process.env.RUNNING_HUB_API_URL || 'https://www.runninghub.cn/task/openapi/ai-app/run',
    timeout: 180000
  };

  private runningHubClient = createHttpClient({
    serviceName: 'runninghub',
    timeoutMs: this.config.timeout,
    maxRetries: 2
  });

  private dynamicConfig: {
    webappId: string | null;
    nodePrompt: string | null;
    nodeImage: string | null;
  } = {
    webappId: null,
    nodePrompt: null,
    nodeImage: null
  };

  private promptTemplatesCache: Record<string, unknown> | null = null;
  private initialized = false;
  private cachedApiKey: string | null = null;

  private async _initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      this.dynamicConfig.webappId = String(
        await (systemConfigService as unknown as SystemConfigService).get(
          'runninghub_webapp_id',
          '1982694711750213634'
        )
      );
      this.dynamicConfig.nodePrompt = String(
        await (systemConfigService as unknown as SystemConfigService).get(
          'runninghub_node_prompt',
          '103'
        )
      );
      this.dynamicConfig.nodeImage = String(
        await (systemConfigService as unknown as SystemConfigService).get(
          'runninghub_node_image',
          '74'
        )
      );
      this.initialized = true;
      logger.info('[AIModelService] 动态配置加载完成', this.dynamicConfig);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[AIModelService] 动态配置加载失败,使用默认值', errorMessage);
      this.dynamicConfig.webappId = '1982694711750213634';
      this.dynamicConfig.nodePrompt = '103';
      this.dynamicConfig.nodeImage = '74';
      this.initialized = true;
    }
  }

  private async getApiKey(): Promise<string> {
    if (this.cachedApiKey) {
      return this.cachedApiKey;
    }
    const configValue = (await (systemConfigService as unknown as SystemConfigService).get(
      'runninghub_api_key'
    )) as string | null;
    const apiKey = (configValue ?? '').trim();
    if (!apiKey) {
      throw new Error('RunningHub API Key 未配置，请在系统配置 runninghub_api_key 中设置');
    }
    this.cachedApiKey = apiKey;
    return apiKey;
  }

  async generatePrompt(scene: string, category: string): Promise<string> {
    try {
      const configKey = `ai_model_prompt_${scene}_${category}`;
      const prompt = await (systemConfigService as unknown as SystemConfigService).get(configKey);
      if (!prompt) {
        logger.warn(`[AIModelService] 未找到配置 ${configKey},使用默认Prompt`);
        return this._getDefaultPrompt(scene, category);
      }
      logger.info(`[AIModelService] 使用动态Prompt配置 ${configKey}`);
      return String(prompt);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[AIModelService] 加载Prompt配置失败: ${errorMessage}`, { scene, category });
      return this._getDefaultPrompt(scene, category);
    }
  }

  private _getDefaultPrompt(scene: string, category: string): string {
    const defaults: Record<string, Record<string, string>> = {
      street: {
        shoes:
          '这是一个模特拍摄，鞋子为主题，参考图片，帮我生成12张不同分镜摆姿图片，场景为街拍风格，不同运镜和角度，不同的视角和景别',
        dress:
          '这是一个模特拍摄，连衣裙为主题，参考图片，帮我生成12张不同分镜摆姿图片，场景为街拍风格，不同运镜和角度，不同的视角和景别',
        hoodie:
          '这是一个模特拍摄，卫衣为主题，参考图片，帮我生成12张不同分镜摆姿图片，场景为街拍风格，不同运镜和角度，不同的视角和景别'
      },
      studio: {
        shoes:
          '这是一个模特拍摄，鞋子为主题，参考图片，帮我生成12张不同分镜摆姿图片，场景为白棚摄影棚，不同运镜和角度，不同的视角和景别',
        dress:
          '这是一个模特拍摄，连衣裙为主题，参考图片，帮我生成12张不同分镜摆姿图片，场景为白棚摄影棚，不同运镜和角度，不同的视角和景别',
        hoodie:
          '这是一个模特拍摄，卫衣为主题，参考图片，帮我生成12张不同分镜摆姿图片，场景为白棚摄影棚，不同运镜和角度，不同的视角和景别'
      },
      indoor: {
        shoes:
          '这是一个模特拍摄，鞋子为主题，参考图片，帮我生成12张不同分镜摆姿图片，场景为室内居家环境，不同运镜和角度，不同的视角和景别',
        dress:
          '这是一个模特拍摄，连衣裙为主题，参考图片，帮我生成12张不同分镜摆姿图片，场景为室内居家环境，不同运镜和角度，不同的视角和景别',
        hoodie:
          '这是一个模特拍摄，卫衣为主题，参考图片，帮我生成12张不同分镜摆姿图片，场景为室内居家环境，不同运镜和角度，不同的视角和景别'
      }
    };
    const prompt = defaults[scene]?.[category];
    if (!prompt) throw new Error(`不支持的场景或品类: ${scene}/${category}`);
    return prompt;
  }

  async createModelTask(
    taskId: string,
    inputImageUrl: string,
    params: Record<string, unknown> = {}
  ) {
    try {
      const scene = (params.scene as string) || 'street';
      const category = (params.category as string) || 'dress';
      logger.info(
        `[AIModelService] 创建AI模特任务 taskId=${taskId} scene=${scene} category=${category}`
      );
      await this._initialize();
      await taskService.updateStatus(taskId, 'processing', {});
      const prompt = await this.generatePrompt(scene, category);
      const runningHubTaskId = await this.submitToRunningHub(inputImageUrl, prompt);
      await this.saveRunningHubTaskId(taskId, runningHubTaskId);
      logger.info(
        `[AIModelService] AI模特任务已提交 taskId=${taskId} rhTaskId=${runningHubTaskId}`
      );
      this.startPolling(taskId, runningHubTaskId).catch((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger.error(`[AIModelService] 轮询失败: ${errorMessage}`, { taskId });
      });
      return { taskId, runningHubTaskId, status: 'processing' };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'AI模特任务创建失败';
      logger.error(`[AIModelService] 创建AI模特任务失败: ${errorMessage}`, { taskId, error });
      await taskService.updateStatus(taskId, 'failed', {
        errorMessage
      } as TaskStatusPayload);
      throw error;
    }
  }

  async submitToRunningHub(imageUrl: string, prompt: string): Promise<string> {
    try {
      const imageKey = this.extractImageKey(imageUrl);
      const apiKey = await this.getApiKey();
      const requestBody: Record<string, unknown> = {
        webappId: this.dynamicConfig.webappId,
        apiKey,
        nodeInfoList: [
          {
            nodeId: this.dynamicConfig.nodePrompt,
            fieldName: 'text',
            fieldValue: prompt,
            description: '输入提示词'
          },
          {
            nodeId: this.dynamicConfig.nodeImage,
            fieldName: 'image',
            fieldValue: imageKey,
            description: '输入图片'
          }
        ]
      };
      logger.info('[AIModelService] 调用RunningHub API (使用动态配置)', {
        webappId: this.dynamicConfig.webappId,
        nodePrompt: this.dynamicConfig.nodePrompt,
        nodeImage: this.dynamicConfig.nodeImage,
        imageKey
      });
      const data = await this.runningHubClient.post<RunningHubResponse>(
        this.config.apiUrl,
        requestBody,
        {
          headers: { Host: 'www.runninghub.cn', 'Content-Type': 'application/json' },
          timeoutMs: 30000
        }
      );
      const taskId = (data?.data?.taskId ?? data?.taskId) as string | undefined;
      if (!taskId) throw new Error('RunningHub未返回任务ID');
      logger.info(`[AIModelService] RunningHub任务已创建 taskId=${taskId}`);
      return taskId;
    } catch (error: unknown) {
      const axiosError = error as Record<string, unknown>;
      if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ENOTFOUND') {
        logger.warn('[AIModelService] RunningHub未配置,使用模拟任务ID');
        return `mock_${nanoid()}`;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[AIModelService] RunningHub调用失败: ${errorMessage}`, error);
      throw new Error(`RunningHub调用失败: ${errorMessage}`);
    }
  }

  extractImageKey(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const parts = pathname.split('/');
      return parts[parts.length - 1];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[AIModelService] 提取图片key失败: ${errorMessage}`, { url });
      throw new Error('无效的图片URL');
    }
  }

  async saveRunningHubTaskId(taskId: string, runningHubTaskId: string): Promise<void> {
    await db('tasks')
      .where('id', taskId)
      .update({ params: db.raw('JSON_SET(params, "$.runningHubTaskId", ?)', [runningHubTaskId]) });
  }

  async startPolling(taskId: string, runningHubTaskId: string): Promise<void> {
    const maxAttempts = 60;
    let attempts = 0;
    const poll = async (): Promise<void> => {
      try {
        attempts++;
        const task = await db('tasks').where('id', taskId).first();
        if (!task || task.status !== 'processing') {
          logger.info('[AIModelService] 任务已不在处理中,停止轮询', { taskId });
          return;
        }
        const status = await this.queryRunningHubStatus(runningHubTaskId);
        if (status === 'SUCCESS') {
          const resultUrls = await this.fetchResults(runningHubTaskId);
          logger.info('[AIModelService] 结果拉取完成,开始内容审核', {
            taskId,
            count: resultUrls.length
          });
          const auditResult = await contentAuditService.auditTaskResults(taskId, resultUrls);
          if (!auditResult.pass) {
            logger.warn('[AIModelService] 内容审核未通过', { taskId });
            return;
          }
          await taskService.updateStatus(taskId, 'success', { resultUrls } as TaskStatusPayload);
          logger.info('[AIModelService] AI模特任务完成', { taskId, count: resultUrls.length });
          return;
        } else if (status === 'FAILED') {
          await taskService.updateStatus(taskId, 'failed', {
            errorMessage: 'RunningHub处理失败'
          } as TaskStatusPayload);
          return;
        }
        if (attempts < maxAttempts) {
          setTimeout(poll, 3000);
        } else {
          await taskService.updateStatus(taskId, 'failed', {
            errorMessage: '处理超时(3分钟)'
          } as TaskStatusPayload);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[AIModelService] 轮询错误', { taskId, attempts, error: errorMessage });
        if (attempts < maxAttempts) {
          setTimeout(poll, 3000);
        }
      }
    };
    setTimeout(poll, 3000);
  }

  async queryRunningHubStatus(runningHubTaskId: string): Promise<'SUCCESS' | 'FAILED' | 'PENDING'> {
    try {
      const apiKey = await this.getApiKey();
      const data = await this.runningHubClient.get<RunningHubResponse>(
        `${this.config.apiUrl}/v1/status/${runningHubTaskId}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeoutMs: 10000
        }
      );
      const status = String(data?.status || 'PENDING');
      if (['SUCCESS', 'FAILED', 'PENDING'].includes(status)) {
        return status as 'SUCCESS' | 'FAILED' | 'PENDING';
      }
      return 'PENDING';
    } catch (error: unknown) {
      const axiosError = error as Record<string, unknown>;
      if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ENOTFOUND') {
        return runningHubTaskId.startsWith('mock_') ? 'SUCCESS' : 'PENDING';
      }
      throw error;
    }
  }

  async fetchResults(runningHubTaskId: string): Promise<string[]> {
    try {
      const apiKey = await this.getApiKey();
      const data = await this.runningHubClient.get<RunningHubResponse>(
        `${this.config.apiUrl}/v1/outputs/${runningHubTaskId}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeoutMs: 30000
        }
      );
      const outputs = data?.outputs;
      if (Array.isArray(outputs)) {
        return outputs as string[];
      }
      return [];
    } catch (error: unknown) {
      const axiosError = error as Record<string, unknown>;
      if (axiosError.code === 'ECONNREFUSED' || axiosError.code === 'ENOTFOUND') {
        const mockUrls: string[] = [];
        for (let i = 0; i < 12; i++) mockUrls.push(`https://mock-cdn.com/result_${i + 1}.png`);
        return mockUrls;
      }
      throw error;
    }
  }
}

export default new AIModelService();
