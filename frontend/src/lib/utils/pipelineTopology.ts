/**
 * Pipeline拓扑校验工具
 * 艹，这个tm负责检测环、变量可达性、孤立节点等！
 */

import { PipelineSchema, PipelineNode, PipelineEdge, PipelineNodeType } from '../types/pipeline';

/**
 * 拓扑校验结果
 */
export interface TopologyValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sortedNodeIds?: string[]; // Kahn算法拓扑排序结果
  reachableVariables?: Map<string, Set<string>>; // 每个节点的可达变量
}

/**
 * 节点输出的变量
 * 艹，根据节点类型分析输出变量！
 */
function getNodeOutputVariables(node: PipelineNode): string[] {
  const vars: string[] = [];

  switch (node.type) {
    case PipelineNodeType.PROVIDER:
    case 'provider':
      // Provider输出：nodeId.output, nodeId.tokens
      const outputKey = (node.data as any).outputKey || 'output';
      vars.push(`${node.id}.${outputKey}`);
      vars.push(`${node.id}.tokens`);
      break;

    case PipelineNodeType.POST_PROCESS:
    case 'postProcess':
      // PostProcess输出：nodeId.result
      vars.push(`${node.id}.result`);
      break;

    case PipelineNodeType.CONDITION:
    case 'condition':
      // Condition输出：nodeId.result (条件判断结果)
      vars.push(`${node.id}.result`);
      break;

    case PipelineNodeType.FORK:
    case 'fork':
      // Fork输出：nodeId.branches (分支信息)
      vars.push(`${node.id}.branches`);
      break;

    case PipelineNodeType.JOIN:
    case 'join':
      // Join输出：nodeId.merged (合并后的结果)
      vars.push(`${node.id}.merged`);
      break;

    case PipelineNodeType.END:
    case 'end':
      // End节点不输出变量
      break;

    default:
      // 自定义类型，假设输出 nodeId.output
      vars.push(`${node.id}.output`);
  }

  return vars;
}

/**
 * 从节点配置中提取引用的变量
 * 艹，解析 {{variable}} 模板语法！
 */
function extractReferencedVariables(text: string | undefined): string[] {
  if (!text) return [];

  const vars: string[] = [];
  // 匹配 {{variable}} 或 {{node.variable}}
  const regex = /\{\{([a-zA-Z0-9_.]+)\}\}/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    vars.push(match[1]);
  }

  return vars;
}

/**
 * 获取节点引用的变量
 * 艹，分析节点data中使用的变量！
 */
function getNodeReferencedVariables(node: PipelineNode): string[] {
  const vars: string[] = [];
  const data = node.data as any;

  switch (node.type) {
    case PipelineNodeType.PROVIDER:
    case 'provider':
      // Provider的prompt中可能引用变量
      if (data.prompt) {
        vars.push(...extractReferencedVariables(data.prompt));
      }
      break;

    case PipelineNodeType.CONDITION:
    case 'condition':
      // Condition的condition表达式中可能引用变量
      if (data.condition) {
        vars.push(...extractReferencedVariables(data.condition));
      }
      break;

    case PipelineNodeType.POST_PROCESS:
    case 'postProcess':
      // PostProcess的processorParams中可能引用变量
      if (data.processorParams) {
        vars.push(...extractReferencedVariables(data.processorParams));
      }
      break;

    case PipelineNodeType.END:
    case 'end':
      // End节点可能引用outputKey
      if (data.outputKey) {
        vars.push(...extractReferencedVariables(data.outputKey));
      }
      break;
  }

  return vars;
}

/**
 * Kahn算法拓扑排序
 * 艹，检测有向图是否有环！
 * @returns 排序后的节点ID数组，如果有环则返回null
 */
function kahnTopologicalSort(
  nodes: PipelineNode[],
  edges: PipelineEdge[]
): string[] | null {
  // 构建邻接表和入度表
  const adjList = new Map<string, string[]>(); // nodeId -> [targetNodeIds]
  const inDegree = new Map<string, number>(); // nodeId -> inDegree

  // 初始化
  nodes.forEach((node) => {
    adjList.set(node.id, []);
    inDegree.set(node.id, 0);
  });

  // 构建图
  edges.forEach((edge) => {
    const from = edge.source;
    const to = edge.target;

    if (adjList.has(from)) {
      adjList.get(from)!.push(to);
    }
    if (inDegree.has(to)) {
      inDegree.set(to, inDegree.get(to)! + 1);
    }
  });

  // Kahn算法：找出所有入度为0的节点
  const queue: string[] = [];
  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) {
      queue.push(nodeId);
    }
  });

  const sorted: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    // 处理当前节点的所有邻居
    const neighbors = adjList.get(current) || [];
    neighbors.forEach((neighbor) => {
      const newDegree = inDegree.get(neighbor)! - 1;
      inDegree.set(neighbor, newDegree);

      if (newDegree === 0) {
        queue.push(neighbor);
      }
    });
  }

  // 如果排序后的节点数小于总节点数，说明有环
  if (sorted.length < nodes.length) {
    return null; // 有环
  }

  return sorted;
}

/**
 * 变量可达性分析
 * 艹，根据拓扑顺序，计算每个节点可以访问的变量！
 */
function analyzeVariableReachability(
  nodes: PipelineNode[],
  sortedNodeIds: string[],
  edges: PipelineEdge[],
  globalVariables?: Record<string, any>
): Map<string, Set<string>> {
  const nodeMap = new Map<string, PipelineNode>();
  nodes.forEach((node) => nodeMap.set(node.id, node));

  const reachableVars = new Map<string, Set<string>>();

  // 初始化全局变量
  const globalVars = new Set<string>();
  if (globalVariables) {
    Object.keys(globalVariables).forEach((key) => globalVars.add(key));
  }

  // 构建前驱节点映射
  const predecessors = new Map<string, string[]>();
  nodes.forEach((node) => predecessors.set(node.id, []));
  edges.forEach((edge) => {
    if (predecessors.has(edge.target)) {
      predecessors.get(edge.target)!.push(edge.source);
    }
  });

  // 按拓扑顺序遍历节点
  sortedNodeIds.forEach((nodeId) => {
    const node = nodeMap.get(nodeId);
    if (!node) return;

    // 当前节点可达变量 = 全局变量 + 所有前驱节点输出的变量
    const vars = new Set<string>(globalVars);

    const preds = predecessors.get(nodeId) || [];
    preds.forEach((predId) => {
      const predNode = nodeMap.get(predId);
      if (predNode) {
        const predOutputs = getNodeOutputVariables(predNode);
        predOutputs.forEach((v) => vars.add(v));
      }

      // 同时继承前驱节点的可达变量
      const predReachable = reachableVars.get(predId);
      if (predReachable) {
        predReachable.forEach((v) => vars.add(v));
      }
    });

    reachableVars.set(nodeId, vars);
  });

  return reachableVars;
}

/**
 * 检测孤立节点
 * 艹，找出没有连接的节点！
 */
function detectIsolatedNodes(
  nodes: PipelineNode[],
  edges: PipelineEdge[]
): string[] {
  if (nodes.length <= 1) return []; // 单节点不算孤立

  const connectedNodes = new Set<string>();
  edges.forEach((edge) => {
    connectedNodes.add(edge.source);
    connectedNodes.add(edge.target);
  });

  const isolated: string[] = [];
  nodes.forEach((node) => {
    if (!connectedNodes.has(node.id)) {
      isolated.push(node.id);
    }
  });

  return isolated;
}

/**
 * 完整的Pipeline拓扑校验
 * 艹，这个tm是主要导出函数！
 */
export function validatePipelineTopology(
  schema: PipelineSchema
): TopologyValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { nodes, edges, variables } = schema;

  // 1. 基本检查
  if (nodes.length === 0) {
    errors.push('Pipeline至少需要一个节点');
    return { valid: false, errors, warnings };
  }

  // 2. Kahn算法检测环
  const sortedNodeIds = kahnTopologicalSort(nodes, edges);
  if (!sortedNodeIds) {
    errors.push('Pipeline存在循环依赖（检测到环）');
    return { valid: false, errors, warnings };
  }

  // 3. 检测孤立节点
  const isolatedNodes = detectIsolatedNodes(nodes, edges);
  if (isolatedNodes.length > 0) {
    warnings.push(`发现孤立节点: ${isolatedNodes.join(', ')}`);
  }

  // 4. 变量可达性分析
  const reachableVars = analyzeVariableReachability(nodes, sortedNodeIds, edges, variables);

  // 5. 检查每个节点引用的变量是否可达
  nodes.forEach((node) => {
    const referencedVars = getNodeReferencedVariables(node);
    const reachable = reachableVars.get(node.id) || new Set();

    referencedVars.forEach((varName) => {
      if (!reachable.has(varName)) {
        errors.push(
          `节点 ${node.id} (${(node.data as any).label || node.id}) 引用了不可达的变量: ${varName}`
        );
      }
    });
  });

  // 6. 检查流程完整性
  const hasEndNode = nodes.some(
    (n) => n.type === PipelineNodeType.END || n.type === 'end'
  );
  if (!hasEndNode) {
    warnings.push('Pipeline缺少结束节点（END）');
  }

  // 7. 检查入度为0的节点（起始节点）
  const inDegree = new Map<string, number>();
  nodes.forEach((node) => inDegree.set(node.id, 0));
  edges.forEach((edge) => {
    const current = inDegree.get(edge.target) || 0;
    inDegree.set(edge.target, current + 1);
  });

  const startNodes = Array.from(inDegree.entries())
    .filter(([_, degree]) => degree === 0)
    .map(([nodeId]) => nodeId);

  if (startNodes.length === 0) {
    errors.push('Pipeline没有起始节点（所有节点都有入边）');
  } else if (startNodes.length > 1) {
    warnings.push(
      `Pipeline有多个起始节点: ${startNodes.join(', ')}，建议使用单一入口`
    );
  }

  // 8. 检查出度为0的节点（终止节点）
  const outDegree = new Map<string, number>();
  nodes.forEach((node) => outDegree.set(node.id, 0));
  edges.forEach((edge) => {
    const current = outDegree.get(edge.source) || 0;
    outDegree.set(edge.source, current + 1);
  });

  const endNodes = Array.from(outDegree.entries())
    .filter(([_, degree]) => degree === 0)
    .map(([nodeId]) => nodeId);

  if (endNodes.length === 0 && nodes.length > 1) {
    warnings.push('Pipeline没有终止节点（所有节点都有出边）');
  }

  // 9. 检查Join节点的入度
  nodes.forEach((node) => {
    if (node.type === PipelineNodeType.JOIN || node.type === 'join') {
      const inCount = inDegree.get(node.id) || 0;
      if (inCount < 2) {
        errors.push(
          `Join节点 ${node.id} (${(node.data as any).label || node.id}) 必须有至少2个入边，当前只有${inCount}个`
        );
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    sortedNodeIds,
    reachableVariables: reachableVars,
  };
}

/**
 * 获取节点的拓扑层级
 * 艹，用于可视化分层显示！
 */
export function getNodeLevels(
  nodes: PipelineNode[],
  edges: PipelineEdge[]
): Map<string, number> {
  const levels = new Map<string, number>();

  // 构建前驱节点映射
  const predecessors = new Map<string, string[]>();
  nodes.forEach((node) => predecessors.set(node.id, []));
  edges.forEach((edge) => {
    if (predecessors.has(edge.target)) {
      predecessors.get(edge.target)!.push(edge.source);
    }
  });

  // DFS计算层级
  function dfs(nodeId: string, visited: Set<string>): number {
    if (visited.has(nodeId)) return levels.get(nodeId) || 0;
    if (levels.has(nodeId)) return levels.get(nodeId)!;

    visited.add(nodeId);

    const preds = predecessors.get(nodeId) || [];
    if (preds.length === 0) {
      levels.set(nodeId, 0);
      return 0;
    }

    let maxPredLevel = -1;
    preds.forEach((predId) => {
      const predLevel = dfs(predId, visited);
      maxPredLevel = Math.max(maxPredLevel, predLevel);
    });

    const level = maxPredLevel + 1;
    levels.set(nodeId, level);
    return level;
  }

  nodes.forEach((node) => {
    dfs(node.id, new Set());
  });

  return levels;
}
