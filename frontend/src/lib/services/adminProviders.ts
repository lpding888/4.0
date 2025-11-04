/**
 * Provider管理API服务层
 * 艹，这个tm负责与后端Provider管理接口对接！
 */

import { api } from '../api';

/**
 * Provider质量档位
 * 艹！低/中/高三档，成本控制必须清晰！
 */
export type QualityTier = 'low' | 'medium' | 'high';

/**
 * Provider端点数据结构
 */
export interface Provider {
  provider_ref: string;
  provider_name: string;
  endpoint_url: string;
  credentials_encrypted?: any; // 加密后的凭证（前端只读，不修改）
  auth_type: 'api_key' | 'bearer' | 'basic' | 'oauth2';
  quality_tier?: QualityTier; // 质量档位（低/中/高）
  weight?: number; // 路由权重（1-100），权重越高，被选中概率越大
  cost_per_1k_tokens?: number; // 每1K tokens成本（美元）
  enabled?: boolean; // 是否启用
  created_at?: string;
  updated_at?: string;
}

/**
 * Provider创建/更新输入
 */
export interface ProviderInput {
  provider_ref: string;
  provider_name: string;
  endpoint_url: string;
  credentials: Record<string, any>; // 明文凭证（会被后端加密）
  auth_type: 'api_key' | 'bearer' | 'basic' | 'oauth2';
  quality_tier?: QualityTier; // 质量档位
  weight?: number; // 路由权重（1-100）
  cost_per_1k_tokens?: number; // 每1K tokens成本（美元）
  enabled?: boolean; // 是否启用
}

/**
 * Provider列表查询参数
 */
export interface ProviderListParams {
  limit?: number;
  offset?: number;
  auth_type?: string;
}

/**
 * Provider列表响应
 */
export interface ProviderListResponse {
  items: Provider[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * 测试连接响应
 */
export interface TestConnectionResponse {
  healthy: boolean;
  message: string;
  tested_at: string;
}

/**
 * Provider管理API类
 * 艹，老王我按照规范实现的统一API封装！
 */
export const adminProviders = {
  /**
   * 获取Provider列表
   */
  async list(params?: ProviderListParams): Promise<ProviderListResponse> {
    const response = await api.client.get<any>('/admin/providers', { params });
    return response.data;
  },

  /**
   * 获取单个Provider
   */
  async get(providerRef: string): Promise<Provider> {
    const response = await api.client.get<any>(`/admin/providers/${providerRef}`);
    return response.data;
  },

  /**
   * 创建Provider
   */
  async create(data: ProviderInput): Promise<Provider> {
    const response = await api.client.post<any>('/admin/providers', data);
    return response.data;
  },

  /**
   * 更新Provider
   */
  async update(providerRef: string, data: Partial<ProviderInput>): Promise<Provider> {
    const response = await api.client.put<any>(`/admin/providers/${providerRef}`, data);
    return response.data;
  },

  /**
   * 删除Provider
   */
  async delete(providerRef: string): Promise<void> {
    await api.client.delete(`/admin/providers/${providerRef}`);
  },

  /**
   * 测试Provider连接
   */
  async testConnection(providerRef: string): Promise<TestConnectionResponse> {
    const response = await api.client.post<any>(`/admin/providers/${providerRef}/test-connection`);
    return response.data;
  },
};
