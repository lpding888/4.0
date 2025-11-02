/**
 * 表单Schema API服务层
 * 艹！对接CMS-105后端API，支持版本管理！
 */

import { api } from '../api';

/**
 * 表单Schema数据结构
 */
export interface FormSchema {
  schema_id: string;
  version: number;
  fields: any; // JSON数据
  is_current: boolean;
  version_description?: string;
  publish_status: 'draft' | 'published' | 'archived';
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * 表单Schema列表查询参数
 */
export interface FormSchemaListParams {
  limit?: number;
  offset?: number;
  publish_status?: 'draft' | 'published' | 'archived';
}

/**
 * 表单Schema列表响应
 */
export interface FormSchemaListResponse {
  schemas: FormSchema[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * 版本信息
 */
export interface FormSchemaVersion {
  version: number;
  version_description?: string;
  publish_status: 'draft' | 'published' | 'archived';
  is_current: boolean;
  created_at: string;
}

/**
 * 表单Schema管理API类
 * 艹！老王我按照规范实现的统一API封装！
 */
export const formSchemas = {
  /**
   * 获取表单Schema列表
   */
  async list(params?: FormSchemaListParams): Promise<FormSchemaListResponse> {
    const response = await api.client.get<any>('/admin/form-schemas', { params });
    return response.data.data;
  },

  /**
   * 获取单个Schema（当前版本或指定版本）
   */
  async get(schemaId: string, version?: number): Promise<FormSchema> {
    const params = version ? { version } : {};
    const response = await api.client.get<any>(`/admin/form-schemas/${schemaId}`, {
      params,
    });
    return response.data.data;
  },

  /**
   * 获取Schema所有版本
   */
  async getVersions(
    schemaId: string
  ): Promise<{ versions: FormSchemaVersion[]; total: number }> {
    const response = await api.client.get<any>(
      `/admin/form-schemas/${schemaId}/versions`
    );
    return response.data.data;
  },

  /**
   * 创建新Schema
   */
  async create(data: {
    schema_id: string;
    fields: any;
    version_description?: string;
  }): Promise<FormSchema> {
    const response = await api.client.post<any>('/admin/form-schemas', data);
    return response.data.data;
  },

  /**
   * 创建新版本
   */
  async createVersion(
    schemaId: string,
    data: {
      fields: any;
      version_description?: string;
    }
  ): Promise<FormSchema> {
    const response = await api.client.post<any>(
      `/admin/form-schemas/${schemaId}/versions`,
      data
    );
    return response.data.data;
  },

  /**
   * 发布Schema版本
   */
  async publish(schemaId: string, version: number): Promise<void> {
    await api.client.patch(
      `/admin/form-schemas/${schemaId}/versions/${version}/publish`
    );
  },

  /**
   * 切换当前版本
   */
  async switchVersion(schemaId: string, version: number): Promise<void> {
    await api.client.patch(
      `/admin/form-schemas/${schemaId}/versions/${version}/switch`
    );
  },

  /**
   * 删除Schema（归档）
   */
  async delete(schemaId: string): Promise<void> {
    await api.client.delete(`/admin/form-schemas/${schemaId}`);
  },
};
