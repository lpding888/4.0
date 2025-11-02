/**
 * Pipeline Schema Zod校验器
 * 艹，这个tm负责Pipeline数据结构的严格校验！前后端复用！
 */

import { z } from 'zod';
import { PipelineNodeType } from '../types/pipeline';

/**
 * Pipeline节点位置校验
 */
export const PipelineNodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

/**
 * Provider节点数据校验
 */
export const ProviderNodeDataSchema = z.object({
  label: z.string().min(1, '节点名称不能为空'),
  providerRef: z.string().min(1, 'Provider引用不能为空'),
  prompt: z.string().optional(),
  outputKey: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive('maxTokens必须为正数').optional(),
});

/**
 * 条件节点数据校验
 */
export const ConditionNodeDataSchema = z.object({
  label: z.string().min(1, '节点名称不能为空'),
  condition: z.string().min(1, '条件表达式不能为空'),
});

/**
 * 后处理节点数据校验
 */
export const PostProcessNodeDataSchema = z.object({
  label: z.string().min(1, '节点名称不能为空'),
  processor: z.string().min(1, '处理器类型不能为空'),
  processorParams: z.string().optional(),
});

/**
 * 结束节点数据校验
 */
export const EndNodeDataSchema = z.object({
  label: z.string().min(1, '节点名称不能为空'),
  outputKey: z.string().optional(),
});

/**
 * Fork节点数据校验
 */
export const ForkNodeDataSchema = z.object({
  label: z.string().min(1, '节点名称不能为空'),
  branches: z.array(z.string()).min(2, 'Fork节点至少需要2个分支'),
});

/**
 * Join节点数据校验
 */
export const JoinNodeDataSchema = z.object({
  label: z.string().min(1, '节点名称不能为空'),
  strategy: z.enum(['all', 'any', 'first'], {
    errorMap: () => ({ message: '无效的Join策略' }),
  }),
});

/**
 * Pipeline节点数据联合校验
 * 艹，根据节点类型选择不同的data schema！
 */
export const PipelineNodeDataSchema = z.union([
  ProviderNodeDataSchema,
  ConditionNodeDataSchema,
  PostProcessNodeDataSchema,
  EndNodeDataSchema,
  ForkNodeDataSchema,
  JoinNodeDataSchema,
]);

/**
 * Pipeline节点校验
 */
export const PipelineNodeSchema = z.object({
  id: z.string()
    .min(1, '节点ID不能为空')
    .regex(/^[a-zA-Z0-9_-]+$/, '节点ID只能包含字母、数字、下划线和连字符'),
  type: z.union([
    z.nativeEnum(PipelineNodeType),
    z.string(), // 允许自定义类型
  ]),
  position: PipelineNodePositionSchema,
  data: z.record(z.any()), // 使用any，在superRefine中做详细校验
  selected: z.boolean().optional(),
  dragging: z.boolean().optional(),
}).superRefine((node, ctx) => {
  // 艹，根据节点类型校验data
  try {
    switch (node.type) {
      case PipelineNodeType.PROVIDER:
      case 'provider':
        ProviderNodeDataSchema.parse(node.data);
        break;
      case PipelineNodeType.CONDITION:
      case 'condition':
        ConditionNodeDataSchema.parse(node.data);
        break;
      case PipelineNodeType.POST_PROCESS:
      case 'postProcess':
        PostProcessNodeDataSchema.parse(node.data);
        break;
      case PipelineNodeType.END:
      case 'end':
        EndNodeDataSchema.parse(node.data);
        break;
      case PipelineNodeType.FORK:
      case 'fork':
        ForkNodeDataSchema.parse(node.data);
        break;
      case PipelineNodeType.JOIN:
      case 'join':
        JoinNodeDataSchema.parse(node.data);
        break;
      default:
        // 自定义类型，只检查基本字段
        if (!node.data.label) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: '节点data必须包含label字段',
            path: ['data', 'label'],
          });
        }
    }
  } catch (error: any) {
    if (error.errors) {
      error.errors.forEach((err: any) => {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: err.message,
          path: ['data', ...err.path],
        });
      });
    }
  }
});

/**
 * Pipeline连接线校验
 */
export const PipelineEdgeSchema = z.object({
  id: z.string().min(1, '连接线ID不能为空'),
  source: z.string().min(1, '源节点ID不能为空'),
  target: z.string().min(1, '目标节点ID不能为空'),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  label: z.string().optional(),
  animated: z.boolean().optional(),
  style: z.record(z.any()).optional(),
});

/**
 * Pipeline元数据校验
 */
export const PipelineMetadataSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  version: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * Pipeline Schema完整校验
 */
export const PipelineSchemaValidator = z.object({
  version: z.string().min(1, 'version不能为空'),
  nodes: z.array(PipelineNodeSchema).min(1, '至少需要一个节点'),
  edges: z.array(PipelineEdgeSchema),
  metadata: PipelineMetadataSchema.optional(),
  variables: z.record(z.any()).optional(),
}).superRefine((schema, ctx) => {
  const nodeIds = schema.nodes.map((n) => n.id);

  // 艹，检查节点ID唯一性
  const duplicateNodeIds = nodeIds.filter((id, index) => nodeIds.indexOf(id) !== index);
  if (duplicateNodeIds.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `节点ID重复: ${duplicateNodeIds.join(', ')}`,
      path: ['nodes'],
    });
  }

  // 艹，检查连接线引用的节点是否存在
  schema.edges.forEach((edge, index) => {
    if (!nodeIds.includes(edge.source)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `连接线 ${edge.id} 的source节点不存在: ${edge.source}`,
        path: ['edges', index, 'source'],
      });
    }
    if (!nodeIds.includes(edge.target)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `连接线 ${edge.id} 的target节点不存在: ${edge.target}`,
        path: ['edges', index, 'target'],
      });
    }
  });

  // 艹，检查连接线ID唯一性
  const edgeIds = schema.edges.map((e) => e.id);
  const duplicateEdgeIds = edgeIds.filter((id, index) => edgeIds.indexOf(id) !== index);
  if (duplicateEdgeIds.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `连接线ID重复: ${duplicateEdgeIds.join(', ')}`,
      path: ['edges'],
    });
  }

  // 艹，检查是否有孤立节点（没有任何连接）
  const connectedNodes = new Set<string>();
  schema.edges.forEach((edge) => {
    connectedNodes.add(edge.source);
    connectedNodes.add(edge.target);
  });

  const isolatedNodes = nodeIds.filter((id) => !connectedNodes.has(id));
  if (isolatedNodes.length > 0 && schema.nodes.length > 1) {
    console.warn(`[Pipeline校验] 发现孤立节点: ${isolatedNodes.join(', ')}`);
    // 只警告，不报错
  }

  // 艹，检查Join节点必须有多个入边
  schema.nodes.forEach((node, index) => {
    if (node.type === PipelineNodeType.JOIN || node.type === 'join') {
      const incomingEdges = schema.edges.filter((e) => e.target === node.id);
      if (incomingEdges.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Join节点 ${node.id} 必须有至少2个入边`,
          path: ['nodes', index],
        });
      }
    }
  });
});

/**
 * 校验Pipeline Schema
 * 艹，这个tm函数是主要导出的校验入口！
 */
export function validatePipelineSchema(schema: unknown): {
  success: boolean;
  data?: any;
  errors?: string[];
  warnings?: string[];
} {
  try {
    const result = PipelineSchemaValidator.safeParse(schema);

    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    } else {
      return {
        success: false,
        errors: result.error.errors.map((err) => {
          const path = err.path.join('.');
          return `${path ? `${path}: ` : ''}${err.message}`;
        }),
      };
    }
  } catch (error: any) {
    return {
      success: false,
      errors: [error.message || '未知错误'],
    };
  }
}

/**
 * 校验单个Pipeline节点
 * 艹，用于实时校验Pipeline编辑器中的节点！
 */
export function validatePipelineNode(node: unknown): {
  success: boolean;
  data?: any;
  errors?: string[];
} {
  try {
    const result = PipelineNodeSchema.safeParse(node);

    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    } else {
      return {
        success: false,
        errors: result.error.errors.map((err) => err.message),
      };
    }
  } catch (error: any) {
    return {
      success: false,
      errors: [error.message || '未知错误'],
    };
  }
}

/**
 * 校验Pipeline连接线
 * 艹，用于实时校验连接线！
 */
export function validatePipelineEdge(edge: unknown): {
  success: boolean;
  data?: any;
  errors?: string[];
} {
  try {
    const result = PipelineEdgeSchema.safeParse(edge);

    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    } else {
      return {
        success: false,
        errors: result.error.errors.map((err) => err.message),
      };
    }
  } catch (error: any) {
    return {
      success: false,
      errors: [error.message || '未知错误'],
    };
  }
}
