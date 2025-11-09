/**
 * Pipeline 执行系统完整类型定义
 * 艹！这个tm文件定义Pipeline执行的所有具体类型，消除any！
 *
 * @author 老王
 */

import { NodeType, NodeStatus as EngineNodeStatus, NodeErrorType } from './types.js';

/**
 * 执行状态枚举
 */
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * 节点状态枚举
 */
export type NodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * 执行模式枚举
 */
export type ExecutionMode = 'mock' | 'real';

/**
 * Pipeline 节点定义（数据库模型）
 */
export interface PipelineNodeDefinition {
  id: string;
  node_id: string; // 节点ID（在流程中的唯一标识）
  node_type: string; // 节点类型（input/output/transform/condition/loop/parallel/merge）
  node_name: string; // 节点名称
  config: NodeConfig; // 节点配置（具体类型根据node_type不同）
  position?: {
    x: number;
    y: number;
  };
  created_at?: string;
  updated_at?: string;
}

/**
 * 节点配置联合类型
 */
export type NodeConfig =
  | InputNodeConfig
  | OutputNodeConfig
  | TransformNodeConfig
  | ConditionNodeConfig
  | LoopNodeConfig
  | ParallelNodeConfig
  | MergeNodeConfig;

/**
 * Input 节点配置
 */
export interface InputNodeConfig {
  node_type: 'input';
  input_config?: {
    mapping?: Record<string, string>; // 输入映射（源字段 -> 目标字段）
    validation?: {
      required?: string[]; // 必需字段
      types?: Record<string, string>; // 字段类型约束
    };
  };
  dependencies?: string[]; // 依赖的其他节点ID
}

/**
 * Output 节点配置
 */
export interface OutputNodeConfig {
  node_type: 'output';
  output_config?: {
    ports?: Record<string, OutputPort>; // 输出端口配置
    format?: 'json' | 'text' | 'binary'; // 输出格式
  };
  dependencies?: string[]; // 依赖的其他节点ID
}

/**
 * 输出端口配置
 */
export interface OutputPort {
  name: string; // 端口名称
  source: string; // 数据来源（节点ID或表达式）
  transform?: string; // 转换表达式
}

/**
 * Transform 节点配置
 */
export interface TransformNodeConfig {
  node_type: 'transform';
  transform_config?: {
    type?: string; // 转换类型（text_summary/image_process等）
    parameters?: Record<string, unknown>; // 转换参数
    timeout?: number; // 超时时间（毫秒）
  };
  mock?: {
    type?: string; // mock数据类型
    data?: unknown; // mock数据
  };
  dependencies?: string[]; // 依赖的其他节点ID
}

/**
 * Condition 节点配置
 */
export interface ConditionNodeConfig {
  node_type: 'condition';
  condition_config?: {
    condition?: ConditionExpression; // 条件表达式
    true_branch?: string; // 条件为true时的分支节点ID
    false_branch?: string; // 条件为false时的分支节点ID
  };
  dependencies?: string[]; // 依赖的其他节点ID
}

/**
 * 条件表达式
 */
export interface ConditionExpression {
  type: 'exists' | 'equals' | 'gt' | 'lt' | 'contains' | 'regex' | 'and' | 'or' | 'not';
  variable?: string; // 变量名
  value?: unknown; // 比较值
  conditions?: ConditionExpression[]; // 子条件（用于and/or/not）
  pattern?: string; // 正则表达式（用于regex类型）
}

/**
 * Loop 节点配置
 */
export interface LoopNodeConfig {
  node_type: 'loop';
  loop_config?: {
    iterations?: number; // 迭代次数
    array_source?: string; // 数组数据源（节点ID或变量名）
    loop_variable?: string; // 循环变量名
    break_condition?: ConditionExpression; // 中断条件
    body_nodes?: string[]; // 循环体节点ID列表
  };
  dependencies?: string[]; // 依赖的其他节点ID
}

/**
 * Parallel 节点配置
 */
export interface ParallelNodeConfig {
  node_type: 'parallel';
  parallel_config?: {
    branches?: ParallelBranch[]; // 并行分支
    merge_strategy?: 'all' | 'first' | 'race'; // 合并策略
    error_handling?: 'ignore' | 'fail_fast' | 'collect'; // 错误处理策略
  };
  dependencies?: string[]; // 依赖的其他节点ID
}

/**
 * 并行分支
 */
export interface ParallelBranch {
  id: string; // 分支ID
  name?: string; // 分支名称
  nodes?: string[]; // 分支中的节点ID列表
  timeout?: number; // 分支超时时间（毫秒）
}

/**
 * Merge 节点配置
 */
export interface MergeNodeConfig {
  node_type: 'merge';
  merge_config?: {
    strategy?: 'concat' | 'merge' | 'reduce'; // 合并策略
    reducer?: string; // reduce函数表达式
  };
  dependencies?: string[]; // 依赖的其他节点ID
}

/**
 * JSON Schema 结构（节点输入/输出）
 */
export interface JsonSchema {
  type?: string;
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema | JsonSchema[];
  required?: string[];
  enum?: Array<string | number>;
  format?: string;
  default?: unknown;
  examples?: unknown[];
  definitions?: Record<string, JsonSchema>;
  additionalProperties?: boolean | JsonSchema;
  [key: string]: unknown;
}

/**
 * 流程结构定义（编辑器保存的原始结构）
 */
export interface PipelineSchemaDefinition {
  nodes?: PipelineNodeDefinition[];
  edges?: PipelineEdgeDefinition[];
  metadata?: PipelineSchemaMetadata;
  [key: string]: unknown;
}

export type VariableMappingSource = 'input' | 'output' | 'node' | 'transform' | 'context';

export interface VariableMappingDefinition {
  source: VariableMappingSource;
  variable?: string;
  node_id?: string;
  field?: string;
  transform?: string;
  description?: string;
  required?: boolean;
  default_value?: unknown;
}

export type VariableMappings = Record<string, VariableMappingDefinition>;

export type ValidationSeverity = 'error' | 'warning';

export interface SchemaValidationRule {
  id?: string;
  name?: string;
  type: string;
  target?: string;
  message?: string;
  severity?: ValidationSeverity;
  config?: Record<string, unknown>;
  conditions?: ConditionExpression[];
}

export interface SchemaConstraintConfig {
  max_nodes?: number;
  max_edges?: number;
  allowed_node_types?: string[];
  required_nodes?: string[];
  max_parallel_branches?: number;
  max_depth?: number;
  required_inputs?: string[];
  required_outputs?: string[];
  [key: string]: unknown;
}

/**
 * Pipeline Schema（数据库模型）
 */
export interface PipelineSchema {
  id: string | number;
  name: string;
  description?: string | null;
  category?: string | null;
  version: string;
  schema_definition: PipelineSchemaDefinition;
  node_definitions: PipelineNodeDefinition[]; // 节点定义列表
  edge_definitions: PipelineEdgeDefinition[]; // 边定义列表
  input_schema?: JsonSchema | null; // 输入schema
  output_schema?: JsonSchema | null; // 输出schema
  variable_mappings?: VariableMappings;
  validation_rules?: SchemaValidationRule[];
  constraints?: SchemaConstraintConfig;
  metadata?: PipelineSchemaMetadata;
  status: 'draft' | 'active' | 'deprecated' | string;
  is_valid: boolean;
  validation_errors?: string | null;
  created_by?: string | number | null;
  updated_by?: string | number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Pipeline 边定义
 */
export interface PipelineEdgeDefinition {
  id: string;
  source_node_id: string; // 来源节点ID
  target_node_id: string; // 目标节点ID
  source_port?: string; // 来源端口名
  target_port?: string; // 目标端口名
  condition?: ConditionExpression; // 边的条件（可选）
}

/**
 * Pipeline Schema 元数据
 */
export interface PipelineSchemaMetadata {
  author?: string;
  tags?: string[];
  category?: string;
  version_notes?: string;
  [key: string]: unknown;
}

/**
 * Pipeline 执行实例（运行时数据）
 */
export interface PipelineExecution {
  id: string; // 执行ID
  schema_id: string; // Schema ID
  schema?: PipelineSchema; // Schema对象（关联数据）
  execution_mode: ExecutionMode; // 执行模式
  status: ExecutionStatus; // 执行状态
  input_data: Record<string, unknown>; // 输入数据
  output_data: Record<string, unknown> | null; // 输出数据
  execution_context: ExecutionContext; // 执行上下文
  execution_metadata: ExecutionMetadata; // 执行元数据
  started_at: string | null; // 开始时间
  completed_at: string | null; // 完成时间
  duration_ms: number | null; // 执行时长（毫秒）
  error_message: string | null; // 错误信息
  error_details: ErrorDetails | null; // 错误详情
}

/**
 * 执行上下文
 */
export interface ExecutionContext {
  mode: ExecutionMode; // 执行模式
  variables: Record<string, unknown>; // 变量存储
  state: Record<string, unknown>; // 状态存储
  user_id?: string; // 用户ID
  trace_id?: string; // 追踪ID
  parent_execution_id?: string; // 父执行ID（用于子流程）
  [key: string]: unknown;
}

/**
 * 执行元数据
 */
export interface ExecutionMetadata {
  created_at: string; // 创建时间
  created_by: string | null; // 创建者
  node_count: number; // 节点总数
  step_count: number; // 步骤总数
  retry_count?: number; // 重试次数
  [key: string]: unknown;
}

/**
 * 错误详情
 */
export interface ErrorDetails {
  error_code?: string; // 错误码
  error_type?: NodeErrorType; // 错误类型
  failed_node_id?: string; // 失败的节点ID
  stack_trace?: string; // 堆栈追踪
  context?: Record<string, unknown>; // 错误上下文
  [key: string]: unknown;
}

/**
 * 执行步骤（节点执行记录）
 */
export interface ExecutionStep {
  id: string; // 步骤ID
  execution_id: string; // 执行ID
  node_id: string; // 节点ID
  node_type: string; // 节点类型
  status: NodeStatus; // 步骤状态
  input_data: Record<string, unknown> | null; // 输入数据
  output_data: Record<string, unknown> | null; // 输出数据
  error_message: string | null; // 错误信息
  started_at: string | null; // 开始时间
  completed_at: string | null; // 完成时间
  duration_ms: number | null; // 执行时长（毫秒）
  retry_count?: number; // 重试次数
  metadata?: Record<string, unknown>; // 步骤元数据
  config?: Record<string, unknown>; // 节点配置（运行时需要）
}

/**
 * 节点执行结果
 */
export interface NodeExecutionResult {
  node_id: string; // 节点ID
  success: boolean; // 是否成功
  output: Record<string, unknown> | null; // 输出数据
  error?: {
    message: string;
    code?: string;
    type?: NodeErrorType;
    details?: Record<string, unknown>;
  };
  duration_ms: number; // 执行时长
  metadata?: Record<string, unknown>; // 结果元数据
}

/**
 * Transform 节点执行结果
 */
export interface TransformResult {
  node_id: string;
  processed_at: string;
  summary?: string; // text_summary类型
  width?: number; // image_process类型
  height?: number; // image_process类型
  format?: string; // image_process类型
  output_format?: string; // 通用输出格式
  data_size?: number; // 数据大小
  processed_data?: Record<string, unknown>; // 处理后的数据
  transformation_applied?: string; // 应用的转换类型
  [key: string]: unknown;
}

/**
 * Condition 节点执行结果
 */
export interface ConditionResult {
  condition_result: boolean; // 条件结果
  selected_branch: 'true' | 'false'; // 选中的分支
  evaluated_at?: string; // 评估时间
}

/**
 * Loop 节点执行结果
 */
export interface LoopResult {
  iterations: unknown[]; // 每次迭代的结果
  total_iterations: number; // 总迭代次数
  completed_iterations?: number; // 完成的迭代次数
  break_reason?: string; // 中断原因（如果提前中断）
}

/**
 * Parallel 节点执行结果
 */
export interface ParallelResult {
  branches: ParallelBranchResult[]; // 各分支结果
  successful_branches: number; // 成功的分支数
  failed_branches?: number; // 失败的分支数
  total_duration_ms?: number; // 总时长
}

/**
 * 并行分支执行结果
 */
export interface ParallelBranchResult {
  branch_index: number; // 分支索引
  branch_id?: string; // 分支ID
  success: boolean; // 是否成功
  result?: unknown; // 分支结果
  error?: string; // 错误信息
  duration_ms?: number; // 执行时长
}

/**
 * 执行事件
 */
export interface ExecutionEvent {
  event_type:
    | 'execution:started'
    | 'execution:completed'
    | 'execution:failed'
    | 'execution:cancelled'
    | 'step:started'
    | 'step:completed'
    | 'step:failed'
    | 'loop:iteration'
    | 'parallel:branch_completed';
  execution_id: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * 输入映射结果
 */
export interface MappedInput {
  [key: string]: unknown;
}

/**
 * 合并结果
 */
export interface MergedResult {
  [key: string]: unknown;
}

/**
 * Pipeline 验证结果
 */
export interface ValidationResult {
  valid: boolean; // 是否有效
  errors?: ValidationError[]; // 验证错误列表
  warnings?: ValidationWarning[]; // 验证警告列表
}

/**
 * 验证错误
 */
export interface ValidationError {
  code: string; // 错误码
  message: string; // 错误信息
  node_id?: string; // 相关节点ID
  field?: string; // 相关字段
  severity: 'error';
}

/**
 * 验证警告
 */
export interface ValidationWarning {
  code: string; // 警告码
  message: string; // 警告信息
  node_id?: string; // 相关节点ID
  field?: string; // 相关字段
  severity: 'warning';
}

/**
 * 类型守卫：检查是否为特定节点配置类型
 */
export function isInputNodeConfig(config: NodeConfig): config is InputNodeConfig {
  return config.node_type === 'input';
}

export function isOutputNodeConfig(config: NodeConfig): config is OutputNodeConfig {
  return config.node_type === 'output';
}

export function isTransformNodeConfig(config: NodeConfig): config is TransformNodeConfig {
  return config.node_type === 'transform';
}

export function isConditionNodeConfig(config: NodeConfig): config is ConditionNodeConfig {
  return config.node_type === 'condition';
}

export function isLoopNodeConfig(config: NodeConfig): config is LoopNodeConfig {
  return config.node_type === 'loop';
}

export function isParallelNodeConfig(config: NodeConfig): config is ParallelNodeConfig {
  return config.node_type === 'parallel';
}

export function isMergeNodeConfig(config: NodeConfig): config is MergeNodeConfig {
  return config.node_type === 'merge';
}
