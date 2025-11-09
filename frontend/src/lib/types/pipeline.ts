/**
 * Pipeline数据结构类型定义
 * 艹，这个tm定义规范的Pipeline JSON Schema！
 */

/**
 * Pipeline节点类型枚举
 */
export enum PipelineNodeType {
  PROVIDER = 'provider',
  CONDITION = 'condition',
  POST_PROCESS = 'postProcess',
  END = 'end',
  FORK = 'fork',
  JOIN = 'join',
}

/**
 * Pipeline节点位置
 */
export interface PipelineNodePosition {
  x: number;
  y: number;
}

/**
 * Provider节点数据
 */
export interface ProviderNodeData {
  label: string;
  providerRef: string;
  prompt?: string;
  outputKey?: string;
  temperature?: number;
  maxTokens?: number;
  [key: string]: any;
}

/**
 * 条件节点数据
 */
export interface ConditionNodeData {
  label: string;
  condition: string;
  [key: string]: any;
}

/**
 * 后处理节点数据
 */
export interface PostProcessNodeData {
  label: string;
  processor: string;
  processorParams?: string;
  [key: string]: any;
}

/**
 * 结束节点数据
 */
export interface EndNodeData {
  label: string;
  outputKey?: string;
  [key: string]: any;
}

/**
 * Fork节点数据（并行分支）
 */
export interface ForkNodeData {
  label: string;
  branches: string[];
  [key: string]: any;
}

/**
 * Join节点数据（合并分支）
 */
export interface JoinNodeData {
  label: string;
  strategy: 'all' | 'any' | 'first';
  [key: string]: any;
}

/**
 * Pipeline节点数据联合类型
 */
export type PipelineNodeData =
  | ProviderNodeData
  | ConditionNodeData
  | PostProcessNodeData
  | EndNodeData
  | ForkNodeData
  | JoinNodeData;

/**
 * Pipeline节点
 */
export interface PipelineNode {
  id: string;
  type: PipelineNodeType | string;
  position: PipelineNodePosition;
  data: PipelineNodeData;
  selected?: boolean;
  dragging?: boolean;
}

/**
 * Pipeline连接线
 */
export interface PipelineEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  animated?: boolean;
  style?: Record<string, any>;
  [key: string]: any;
}

/**
 * Pipeline元数据
 */
export interface PipelineMetadata {
  title?: string;
  description?: string;
  version?: string;
  createdAt?: string;
  updatedAt?: string;
  author?: string;
  tags?: string[];
  exportedAt?: string;
  nodesCount?: number;
  edgesCount?: number;
}

/**
 * Pipeline JSON Schema
 * 艹，这是完整的Pipeline定义！
 */
export interface PipelineSchema {
  version: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  metadata?: PipelineMetadata;
  variables?: Record<string, any>;
}

/**
 * Pipeline保存/读取DTO
 */
export interface PipelineDTO {
  pipeline_id?: string;
  feature_ref?: string;
  pipeline_name: string;
  pipeline_json: PipelineSchema;
  status?: 'draft' | 'published' | 'archived';
  created_at?: string;
  updated_at?: string;
}

/**
 * Pipeline列表查询参数
 */
export interface PipelineListParams {
  page?: number;
  pageSize?: number;
  featureRef?: string;
  status?: 'draft' | 'published' | 'archived';
  search?: string;
}

/**
 * Pipeline列表响应
 */
export interface PipelineListResponse {
  items: PipelineDTO[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Pipeline执行上下文
 */
export interface PipelineExecutionContext {
  pipelineId: string;
  input: Record<string, any>;
  variables: Record<string, any>;
  trace?: PipelineExecutionTrace[];
}

/**
 * Pipeline执行追踪
 */
export interface PipelineExecutionTrace {
  nodeId: string;
  nodeType: string;
  timestamp: string;
  input: any;
  output: any;
  duration: number;
  error?: string;
}

/**
 * Pipeline执行结果
 */
export interface PipelineExecutionResult {
  success: boolean;
  output: any;
  trace: PipelineExecutionTrace[];
  duration: number;
  error?: string;
}
