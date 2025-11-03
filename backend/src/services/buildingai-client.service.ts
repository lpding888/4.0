/**
 * BuildingAI Sidecar Client Service
 *
 * BFF层到BuildingAI侧车的调用封装
 * 提供统一的AI推理接口、MCP调用、知识库检索等能力
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import logger from '../utils/logger';

interface BuildingAIConfig {
  baseURL: string;
  timeout: number;
  apiPrefix: string;
  healthCheckInterval?: number;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface ChatResponse {
  id: string;
  model: string;
  choices: Array<{
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  uptime: number;
  timestamp: string;
}

interface MCPToolCall {
  tool: string;
  parameters: Record<string, any>;
}

interface MCPToolResponse {
  tool: string;
  result: any;
  error?: string;
}

interface KnowledgeBaseQuery {
  query: string;
  topK?: number;
  filters?: Record<string, any>;
}

interface KnowledgeBaseResult {
  chunks: Array<{
    content: string;
    score: number;
    metadata: Record<string, any>;
  }>;
}

class BuildingAIClientService {
  private client: AxiosInstance;
  private config: BuildingAIConfig;
  private isHealthy: boolean = false;
  private lastHealthCheck: Date | null = null;

  constructor(config?: Partial<BuildingAIConfig>) {
    this.config = {
      baseURL: process.env.BUILDINGAI_BASE_URL || 'http://localhost:4090',
      timeout: parseInt(process.env.BUILDINGAI_TIMEOUT || '30000'),
      apiPrefix: process.env.BUILDINGAI_API_PREFIX || '/api',
      healthCheckInterval: parseInt(process.env.BUILDINGAI_HEALTH_CHECK_INTERVAL || '60000'),
      ...config
    };

    this.client = axios.create({
      baseURL: `${this.config.baseURL}${this.config.apiPrefix}`,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BFF/1.0.0'
      }
    });

    // 请求拦截器：添加日志和认证
    this.client.interceptors.request.use(
      (config) => {
        const requestId = this.generateRequestId();
        config.headers['X-Request-ID'] = requestId;

        logger.debug('BuildingAI Request', {
          requestId,
          method: config.method,
          url: config.url,
          hasData: !!config.data
        });

        return config;
      },
      (error) => {
        logger.error('BuildingAI Request Error', error);
        return Promise.reject(error);
      }
    );

    // 响应拦截器：统一错误处理
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('BuildingAI Response', {
          requestId: response.config.headers['X-Request-ID'],
          status: response.status,
          hasData: !!response.data
        });
        return response;
      },
      (error) => {
        const requestId = error.config?.headers?.['X-Request-ID'];
        logger.error('BuildingAI Response Error', {
          requestId,
          message: error.message,
          status: error.response?.status,
          data: error.response?.data
        });
        return Promise.reject(this.normalizeError(error));
      }
    );

    // 启动健康检查
    this.startHealthCheck();
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthStatus> {
    try {
      const response = await this.client.get<HealthStatus>('/health');
      this.isHealthy = response.data.status === 'ok';
      this.lastHealthCheck = new Date();

      logger.info('BuildingAI Health Check', {
        status: response.data.status,
        healthy: this.isHealthy
      });

      return response.data;
    } catch (error) {
      this.isHealthy = false;
      this.lastHealthCheck = new Date();

      logger.error('BuildingAI Health Check Failed', error);

      return {
        status: 'down',
        uptime: 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 统一推理接口：Chat
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (!this.isHealthy) {
      logger.warn('BuildingAI service is unhealthy, attempting request anyway');
    }

    try {
      const response = await this.client.post<ChatResponse>('/chat/completions', request);
      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * 统一推理接口：Completions (SSE流式)
   *
   * 注意：SSE流式需要特殊处理，这里返回EventSource或可读流
   */
  async chatStream(request: ChatRequest): Promise<ReadableStream> {
    if (!this.isHealthy) {
      logger.warn('BuildingAI service is unhealthy, attempting stream anyway');
    }

    try {
      const response = await this.client.post('/chat/completions',
        { ...request, stream: true },
        { responseType: 'stream' }
      );

      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * MCP工具调用
   */
  async invokeMCPTool(toolCall: MCPToolCall): Promise<MCPToolResponse> {
    try {
      const response = await this.client.post<MCPToolResponse>('/mcp/invoke', toolCall);
      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * 知识库检索
   */
  async queryKnowledgeBase(query: KnowledgeBaseQuery): Promise<KnowledgeBaseResult> {
    try {
      const response = await this.client.post<KnowledgeBaseResult>('/kb/query', query);
      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * 获取可用模型列表
   */
  async listModels(): Promise<Array<{ id: string; name: string; provider: string }>> {
    try {
      const response = await this.client.get('/models');
      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      healthy: this.isHealthy,
      lastHealthCheck: this.lastHealthCheck,
      baseURL: this.config.baseURL
    };
  }

  // ============ 私有方法 ============

  /**
   * 启动定期健康检查
   */
  private startHealthCheck() {
    // 立即执行一次
    this.healthCheck().catch(err => {
      logger.error('Initial health check failed', err);
    });

    // 定期检查
    if (this.config.healthCheckInterval && this.config.healthCheckInterval > 0) {
      setInterval(() => {
        this.healthCheck().catch(err => {
          logger.error('Periodic health check failed', err);
        });
      }, this.config.healthCheckInterval);
    }
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `bff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * 统一错误格式
   */
  private normalizeError(error: any): Error {
    if (error.response) {
      // BuildingAI返回的错误
      const { status, data } = error.response;
      const message = data?.message || data?.error || 'BuildingAI service error';

      const normalizedError = new Error(message);
      (normalizedError as any).code = data?.code || `BUILDINGAI_${status}`;
      (normalizedError as any).httpStatus = status;
      (normalizedError as any).details = data;

      return normalizedError;
    } else if (error.request) {
      // 请求发送但无响应
      const message = 'BuildingAI service unavailable';
      const normalizedError = new Error(message);
      (normalizedError as any).code = 'BUILDINGAI_UNAVAILABLE';
      (normalizedError as any).httpStatus = 503;

      return normalizedError;
    } else {
      // 其他错误
      return error;
    }
  }
}

// 单例实例
const buildingAIClient = new BuildingAIClientService();

export default buildingAIClient;
export { BuildingAIClientService };
export type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  HealthStatus,
  MCPToolCall,
  MCPToolResponse,
  KnowledgeBaseQuery,
  KnowledgeBaseResult
};
