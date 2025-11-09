/**
 * 向量搜索客户端
 * 艹！这个客户端负责文本embedding、向量相似度搜索、异步触发！
 *
 * @author 老王
 */

/**
 * 搜索模式
 */
export type SearchMode = 'text' | 'color' | 'style' | 'image' | 'hybrid';

/**
 * 向量配置
 */
export interface VecConfig {
  endpoint: string; // 向量服务端点
  model: string; // embedding模型，默认'text-embedding-ada-002'
  dimension: number; // 向量维度，默认1536
  similarity_metric: 'cosine' | 'euclidean' | 'dot_product'; // 相似度度量
  enable_cache: boolean; // 启用embedding缓存
  cache_ttl: number; // 缓存TTL（秒），默认86400（1天）
  batch_size: number; // 批量embedding大小，默认100
  timeout: number; // 请求超时（毫秒），默认10000
}

/**
 * 文本embedding请求
 */
export interface TextEmbeddingRequest {
  texts: string[];
  model?: string;
}

/**
 * 文本embedding响应
 */
export interface TextEmbeddingResponse {
  embeddings: number[][];
  model: string;
  dimension: number;
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * 向量搜索请求
 */
export interface VecSearchRequest {
  mode: SearchMode;
  query?: string; // 文本查询
  query_vector?: number[]; // 查询向量
  color?: string; // 颜色查询（hex）
  style?: string; // 风格标签
  image_url?: string; // 图片URL（反搜）
  filters?: Record<string, any>; // 元数据过滤
  top_k?: number; // 返回结果数，默认20
  min_score?: number; // 最小相似度分数，默认0.0
  include_metadata?: boolean; // 是否包含元数据，默认true
}

/**
 * 搜索结果项
 */
export interface VecSearchResult {
  id: string;
  score: number; // 相似度分数 [0, 1]
  metadata?: Record<string, any>;
  vector?: number[];
}

/**
 * 向量搜索响应
 */
export interface VecSearchResponse {
  results: VecSearchResult[];
  total: number;
  mode: SearchMode;
  query_time_ms: number;
}

/**
 * 异步embedding任务
 */
export interface EmbeddingTask {
  id: string;
  resource_type: string;
  resource_id: string;
  content: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: number;
  completed_at?: number;
  error?: string;
}

/**
 * 向量搜索客户端
 */
export class VecClient {
  private config: Required<VecConfig>;
  private embeddingCache: Map<string, { embedding: number[]; expireAt: number }> = new Map();
  private pendingBatch: string[] = [];
  private batchTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<VecConfig> = {}) {
    this.config = {
      endpoint: '/api/vec',
      model: 'text-embedding-ada-002',
      dimension: 1536,
      similarity_metric: 'cosine',
      enable_cache: true,
      cache_ttl: 86400,
      batch_size: 100,
      timeout: 10000,
      ...config,
    };
  }

  /**
   * 生成文本embedding
   */
  async embed(text: string): Promise<number[]> {
    const [embedding] = await this.embedBatch([text]);
    if (!embedding) {
      console.warn('[VecClient] 未获取到embedding结果');
      return [];
    }
    return embedding;
  }

  /**
   * 批量生成embedding
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    console.log('[VecClient] 生成embedding:', texts.length, '条文本');

    const startTime = Date.now();
    const results: number[][] = [];
    const uncachedTexts: string[] = [];
    const uncachedIndices: number[] = [];

    // 检查缓存
    if (this.config.enable_cache) {
      const now = Date.now();
      texts.forEach((text, index) => {
        const cacheKey = this.getCacheKey(text);
        const cached = this.embeddingCache.get(cacheKey);

        if (cached && cached.expireAt > now) {
          results[index] = cached.embedding;
        } else {
          uncachedTexts.push(text);
          uncachedIndices.push(index);
        }
      });

      if (uncachedTexts.length === 0) {
        console.log('[VecClient] 全部命中缓存，耗时:', Date.now() - startTime, 'ms');
        return results;
      }
    } else {
      uncachedTexts.push(...texts);
      uncachedIndices.push(...texts.map((_, i) => i));
    }

    // 分批请求
    const batches: string[][] = [];
    for (let i = 0; i < uncachedTexts.length; i += this.config.batch_size) {
      batches.push(uncachedTexts.slice(i, i + this.config.batch_size));
    }

    let uncachedResults: number[][] = [];
    for (const batch of batches) {
      const response = await fetch(`${this.config.endpoint}/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: batch,
          model: this.config.model,
        } as TextEmbeddingRequest),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        throw new Error(`Embedding生成失败: ${response.status} ${response.statusText}`);
      }

      const data: TextEmbeddingResponse = await response.json();
      uncachedResults.push(...data.embeddings);

      // 写入缓存
      if (this.config.enable_cache) {
        const expireAt = Date.now() + this.config.cache_ttl * 1000;
        batch.forEach((text, index) => {
          const cacheKey = this.getCacheKey(text);
          const embedding = data.embeddings[index];
          if (!embedding) {
            console.warn('[VecClient] 缓存写入时缺少embedding', { text });
            return;
          }
          this.embeddingCache.set(cacheKey, { embedding, expireAt });
        });
      }
    }

    // 合并结果
    uncachedIndices.forEach((index, i) => {
      const embedding = uncachedResults[i];
      if (!embedding) {
        console.warn('[VecClient] 未获取到对应的embedding结果', { index });
        return;
      }
      results[index] = embedding;
    });

    console.log(
      '[VecClient] Embedding生成完成:',
      uncachedTexts.length,
      '条未缓存,',
      texts.length - uncachedTexts.length,
      '条缓存命中, 耗时:',
      Date.now() - startTime,
      'ms'
    );

    return results;
  }

  /**
   * 向量搜索
   */
  async search(request: VecSearchRequest): Promise<VecSearchResponse> {
    console.log('[VecClient] 向量搜索:', request.mode, request.query || request.image_url);

    const startTime = Date.now();

    // 文本模式：先生成query embedding
    if (request.mode === 'text' && request.query) {
      request.query_vector = await this.embed(request.query);
    }

    // 图片模式：先提取图片embedding
    if (request.mode === 'image' && request.image_url) {
      request.query_vector = await this.extractImageEmbedding(request.image_url);
    }

    const response = await fetch(`${this.config.endpoint}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...request,
        top_k: request.top_k || 20,
        min_score: request.min_score || 0.0,
        include_metadata: request.include_metadata !== false,
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      throw new Error(`搜索失败: ${response.status} ${response.statusText}`);
    }

    const data: VecSearchResponse = await response.json();
    data.query_time_ms = Date.now() - startTime;

    console.log('[VecClient] 搜索完成:', data.results.length, '条结果, 耗时:', data.query_time_ms, 'ms');

    return data;
  }

  /**
   * 文本搜索（快捷方法）
   */
  async searchText(
    query: string,
    options: Partial<VecSearchRequest> = {}
  ): Promise<VecSearchResponse> {
    return this.search({
      mode: 'text',
      query,
      ...options,
    });
  }

  /**
   * 颜色搜索（快捷方法）
   */
  async searchColor(
    color: string,
    options: Partial<VecSearchRequest> = {}
  ): Promise<VecSearchResponse> {
    return this.search({
      mode: 'color',
      color,
      ...options,
    });
  }

  /**
   * 风格搜索（快捷方法）
   */
  async searchStyle(
    style: string,
    options: Partial<VecSearchRequest> = {}
  ): Promise<VecSearchResponse> {
    return this.search({
      mode: 'style',
      style,
      ...options,
    });
  }

  /**
   * 图片搜索（快捷方法）
   */
  async searchImage(
    imageUrl: string,
    options: Partial<VecSearchRequest> = {}
  ): Promise<VecSearchResponse> {
    return this.search({
      mode: 'image',
      image_url: imageUrl,
      ...options,
    });
  }

  /**
   * 混合搜索（快捷方法）
   */
  async searchHybrid(
    params: {
      query?: string;
      color?: string;
      style?: string;
      image_url?: string;
    },
    options: Partial<VecSearchRequest> = {}
  ): Promise<VecSearchResponse> {
    return this.search({
      mode: 'hybrid',
      ...params,
      ...options,
    });
  }

  /**
   * 异步触发embedding（生成后触发）
   */
  async triggerEmbedding(
    resourceType: string,
    resourceId: string,
    content: string
  ): Promise<EmbeddingTask> {
    console.log('[VecClient] 触发异步embedding:', resourceType, resourceId);

    const response = await fetch(`${this.config.endpoint}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resource_type: resourceType,
        resource_id: resourceId,
        content,
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      throw new Error(`触发embedding失败: ${response.status} ${response.statusText}`);
    }

    const task: EmbeddingTask = await response.json();
    console.log('[VecClient] Embedding任务已创建:', task.id);

    return task;
  }

  /**
   * 批量异步触发
   */
  async triggerEmbeddingBatch(
    tasks: Array<{ resourceType: string; resourceId: string; content: string }>
  ): Promise<EmbeddingTask[]> {
    console.log('[VecClient] 批量触发embedding:', tasks.length, '个任务');

    const response = await fetch(`${this.config.endpoint}/tasks/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tasks: tasks.map((t) => ({
          resource_type: t.resourceType,
          resource_id: t.resourceId,
          content: t.content,
        })),
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      throw new Error(`批量触发embedding失败: ${response.status} ${response.statusText}`);
    }

    const result: EmbeddingTask[] = await response.json();
    console.log('[VecClient] 批量任务已创建:', result.length, '个');

    return result;
  }

  /**
   * 查询embedding任务状态
   */
  async getTask(taskId: string): Promise<EmbeddingTask> {
    const response = await fetch(`${this.config.endpoint}/tasks/${taskId}`, {
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      throw new Error(`查询任务失败: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 提取图片embedding
   */
  private async extractImageEmbedding(imageUrl: string): Promise<number[]> {
    console.log('[VecClient] 提取图片embedding:', imageUrl);

    const response = await fetch(`${this.config.endpoint}/embed/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl }),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      throw new Error(`图片embedding提取失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.embedding;
  }

  /**
   * 计算相似度
   */
  calculateSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('向量维度不匹配');
    }

    switch (this.config.similarity_metric) {
      case 'cosine':
        return this.cosineSimilarity(vec1, vec2);
      case 'euclidean':
        return this.euclideanDistance(vec1, vec2);
      case 'dot_product':
        return this.dotProduct(vec1, vec2);
      default:
        return this.cosineSimilarity(vec1, vec2);
    }
  }

  /**
   * 余弦相似度
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    const dotProd = this.dotProduct(vec1, vec2);
    const mag1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
    const mag2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
    return dotProd / (mag1 * mag2);
  }

  /**
   * 欧氏距离（转换为相似度）
   */
  private euclideanDistance(vec1: number[], vec2: number[]): number {
    const distance = Math.sqrt(
      vec1.reduce((sum, val, i) => sum + Math.pow(val - vec2[i]!, 2), 0)
    );
    // 转换为相似度 [0, 1]
    return 1 / (1 + distance);
  }

  /**
   * 点积
   */
  private dotProduct(vec1: number[], vec2: number[]): number {
    return vec1.reduce((sum, val, i) => sum + val * vec2[i]!, 0);
  }

  /**
   * 获取缓存key
   */
  private getCacheKey(text: string): string {
    // 简单哈希（生产环境应使用crypto.subtle）
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `${this.config.model}_${Math.abs(hash).toString(16)}`;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.embeddingCache.clear();
    console.log('[VecClient] 缓存已清除');
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    const now = Date.now();
    const validEntries = Array.from(this.embeddingCache.values()).filter(
      (entry) => entry.expireAt > now
    );

    return {
      total: this.embeddingCache.size,
      valid: validEntries.length,
      expired: this.embeddingCache.size - validEntries.length,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<VecConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[VecClient] 配置已更新:', config);
  }

  /**
   * 获取当前配置
   */
  getConfig(): Readonly<VecConfig> {
    return { ...this.config };
  }
}

/**
 * 全局向量搜索客户端
 */
export const vecClient = new VecClient({
  endpoint: '/api/vec',
  model: 'text-embedding-ada-002',
  dimension: 1536,
  similarity_metric: 'cosine',
  enable_cache: true,
  cache_ttl: 86400,
  batch_size: 100,
  timeout: 10000,
});

/**
 * React Hook for 向量搜索
 */
import React from 'react';

export function useVecSearch(initialRequest?: VecSearchRequest) {
  const [results, setResults] = React.useState<VecSearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [queryTime, setQueryTime] = React.useState<number>(0);

  const search = React.useCallback(async (request: VecSearchRequest) => {
    setLoading(true);
    setError(null);

    try {
      const response = await vecClient.search(request);
      setResults(response.results);
      setQueryTime(response.query_time_ms);
    } catch (err: any) {
      setError(err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (initialRequest) {
      search(initialRequest);
    }
  }, []);

  return {
    results,
    loading,
    error,
    queryTime,
    search,
  };
}
