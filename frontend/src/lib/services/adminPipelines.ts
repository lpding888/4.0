/**
 * Pipeline管理API服务
 * 艹，这个tm负责Pipeline的CRUD操作！
 */

import api from '../api';
import {
  PipelineDTO,
  PipelineSchema,
  PipelineListParams,
  PipelineListResponse,
  PipelineExecutionContext,
  PipelineExecutionResult,
} from '../types/pipeline';

/**
 * Pipeline管理API
 */
export const adminPipelines = {
  /**
   * 获取Pipeline列表
   * 艹，支持分页、筛选、搜索！
   */
  async list(params: PipelineListParams = {}): Promise<PipelineListResponse> {
    const response = await api.client.get('/admin/pipelines', { params });
    return response.data;
  },

  /**
   * 获取单个Pipeline详情
   */
  async get(pipelineId: string): Promise<PipelineDTO> {
    const response = await api.client.get(`/admin/pipelines/${pipelineId}`);
    return response.data;
  },

  /**
   * 创建新Pipeline
   * 艹，传入Pipeline Schema和元数据！
   */
  async create(data: {
    pipeline_name: string;
    pipeline_json: PipelineSchema;
    feature_ref?: string;
    status?: 'draft' | 'published';
  }): Promise<PipelineDTO> {
    const response = await api.client.post('/admin/pipelines', data);
    return response.data;
  },

  /**
   * 更新Pipeline
   * 艹，部分更新或全量更新都支持！
   */
  async update(
    pipelineId: string,
    data: Partial<{
      pipeline_name: string;
      pipeline_json: PipelineSchema;
      status: 'draft' | 'published' | 'archived';
    }>
  ): Promise<PipelineDTO> {
    const response = await api.client.put(`/admin/pipelines/${pipelineId}`, data);
    return response.data;
  },

  /**
   * 删除Pipeline
   */
  async delete(pipelineId: string): Promise<void> {
    await api.client.delete(`/admin/pipelines/${pipelineId}`);
  },

  /**
   * 发布Pipeline
   * 艹，从草稿状态发布为正式版本！
   */
  async publish(pipelineId: string): Promise<PipelineDTO> {
    const response = await api.client.post(`/admin/pipelines/${pipelineId}/publish`);
    return response.data;
  },

  /**
   * 归档Pipeline
   * 艹，不再使用的Pipeline归档处理！
   */
  async archive(pipelineId: string): Promise<PipelineDTO> {
    const response = await api.client.post(`/admin/pipelines/${pipelineId}/archive`);
    return response.data;
  },

  /**
   * 克隆Pipeline
   * 艹，复制一个现有的Pipeline作为新的！
   */
  async clone(pipelineId: string, newName: string): Promise<PipelineDTO> {
    const response = await api.client.post(`/admin/pipelines/${pipelineId}/clone`, {
      pipeline_name: newName,
    });
    return response.data;
  },

  /**
   * 导出Pipeline为JSON
   * 艹，下载Pipeline定义文件！
   */
  exportJSON(pipeline: PipelineDTO): void {
    const json = JSON.stringify(pipeline.pipeline_json, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline-${pipeline.pipeline_name}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * 从JSON导入Pipeline
   * 艹，解析JSON文件创建Pipeline！
   */
  async importJSON(file: File): Promise<PipelineSchema> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          resolve(json as PipelineSchema);
        } catch (error) {
          reject(new Error('无效的JSON格式'));
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  },

  /**
   * 验证Pipeline Schema
   * 艹，检查Pipeline定义是否合法！
   */
  async validate(pipelineJson: PipelineSchema): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    try {
      const response = await api.client.post('/admin/pipelines/validate', {
        pipeline_json: pipelineJson,
      });
      return response.data;
    } catch (error: any) {
      return {
        valid: false,
        errors: [error.message || '验证失败'],
      };
    }
  },

  /**
   * 测试运行Pipeline
   * 艹，用测试数据运行Pipeline看效果！
   */
  async testRun(
    pipelineId: string,
    context: PipelineExecutionContext
  ): Promise<PipelineExecutionResult> {
    const response = await api.client.post(`/admin/pipelines/${pipelineId}/test`, context);
    return response.data;
  },

  /**
   * 获取Pipeline执行历史
   * 艹，查看Pipeline的运行记录！
   */
  async getExecutionHistory(
    pipelineId: string,
    params: {
      page?: number;
      pageSize?: number;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<{
    items: PipelineExecutionResult[];
    total: number;
  }> {
    const response = await api.client.get(`/admin/pipelines/${pipelineId}/executions`, {
      params,
    });
    return response.data;
  },
};
