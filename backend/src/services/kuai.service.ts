import logger from '../utils/logger.js';
import { createHttpClient } from '../utils/httpClient.js';

type KuaiCreateResponse = {
  id: string;
  status: string;
  enhanced_prompt?: string;
};

type KuaiStatusResponse = {
  id: string;
  status: string;
  video_url?: string;
  error_message?: string;
  status_update_time?: string;
};

class KuaiService {
  private apiKey?: string;

  private baseUrl = 'https://apis.kuai.host';

  private initialized = false;

  private client = createHttpClient({
    serviceName: 'kuai',
    timeoutMs: 15_000,
    maxRetries: 1
  });

  private initialize() {
    if (this.initialized) return;

    this.apiKey = process.env.KUAI_API_KEY;
    if (!this.apiKey) {
      logger.error('[KuaiService] KUAI API密钥未配置');
      throw new Error('KUAI API密钥未配置，请在.env文件中配置KUAI_API_KEY');
    }

    this.initialized = true;
    logger.info('[KuaiService] KUAI服务初始化成功');
  }

  async createVideoTask(
    script: string,
    imageUrl: string,
    params: Record<string, unknown> = {}
  ): Promise<{ vendorTaskId: string; status: string; enhancedPrompt?: string }> {
    this.initialize();

    try {
      const requestData = {
        model: (params.model as string) || 'veo3-fast',
        prompt: script,
        images: [imageUrl],
        aspect_ratio: '16:9',
        enhance_prompt: true,
        enable_upsample: false
      };

      logger.info('[KuaiService] 开始创建视频任务', {
        imageUrl,
        model: requestData.model,
        scriptLength: script.length
      });

      const data = await this.client.post<KuaiCreateResponse>(
        `${this.baseUrl}/v1/video/create`,
        requestData,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          timeoutMs: 15_000
        }
      );

      if (data?.id) {
        logger.info('[KuaiService] 视频任务创建成功', {
          vendorTaskId: data.id,
          status: data.status
        });

        return {
          vendorTaskId: data.id,
          status: data.status,
          enhancedPrompt: data.enhanced_prompt
        };
      }

      throw new Error('KUAI API返回格式异常');
    } catch (error: unknown) {
      const err = error as Error & {
        response?: { data?: unknown; status?: number };
        code?: string;
      };
      logger.error('[KuaiService] 创建视频任务失败', {
        imageUrl,
        error: err.message,
        response: err.response?.data
      });

      if (err.code === 'ECONNABORTED') {
        throw new Error('KUAI API调用超时');
      }
      if (err.response?.status === 401) {
        throw new Error('KUAI API密钥无效');
      }
      if (err.response?.status === 429) {
        throw new Error('KUAI API调用频率限制');
      }

      throw new Error(`视频任务创建失败: ${err.message}`);
    }
  }

  async queryVideoStatus(vendorTaskId: string): Promise<{
    vendorTaskId: string;
    status: string;
    videoUrl?: string;
    errorMessage?: string;
    statusUpdateTime?: string;
  }> {
    this.initialize();

    try {
      logger.info('[KuaiService] 查询视频任务状态', { vendorTaskId });

      const data = await this.client.get<KuaiStatusResponse>(
        `${this.baseUrl}/v1/video/query`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: 'application/json'
          },
          params: { id: vendorTaskId },
          timeoutMs: 10_000
        }
      );
      if (data) {
        logger.info('[KuaiService] 视频状态查询成功', {
          vendorTaskId: data.id,
          status: data.status,
          hasVideo: Boolean(data.video_url),
          hasError: Boolean(data.error_message)
        });

        return {
          vendorTaskId: data.id,
          status: data.status,
          videoUrl: data.video_url,
          errorMessage: data.error_message,
          statusUpdateTime: data.status_update_time
        };
      }

      throw new Error('KUAI API返回格式异常');
    } catch (error: unknown) {
      const err = error as Error & { response?: { data?: unknown }; code?: string };
      logger.error('[KuaiService] 查询视频状态失败', {
        vendorTaskId,
        error: err.message,
        response: err.response?.data
      });

      if (err.code === 'ECONNABORTED') {
        throw new Error('KUAI API调用超时');
      }

      throw new Error(`视频状态查询失败: ${err.message}`);
    }
  }

  isTimeout(createdAt: Date, timeoutHours = 2): boolean {
    const now = new Date();
    const timeoutMs = timeoutHours * 60 * 60 * 1000;
    return now.getTime() - createdAt.getTime() > timeoutMs;
  }

  getErrorMessage(errorCode: string): string {
    const errorMap: Record<string, string> = {
      KUAI_GENERATION_FAILED: '视频生成失败，请重试',
      CONTENT_VIOLATION: '生成内容违规，请更换图片',
      API_RATE_LIMIT: 'API调用频率限制，请稍后重试',
      TIMEOUT: '处理超时，请重试',
      NETWORK_ERROR: '网络连接失败，请重试'
    };

    return errorMap[errorCode] || '视频生成失败，请重试';
  }
}

const kuaiService = new KuaiService();
export default kuaiService;
