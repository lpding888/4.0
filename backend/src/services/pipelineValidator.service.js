/**
 * Pipeline拓扑校验服务 (CMS-204)
 * 艹！实现Kahn算法检测环 + 变量可达性校验！
 */

const logger = require('../utils/logger');

/**
 * 校验Pipeline拓扑结构
 * 艹！这是核心函数，检查Pipeline是否合法！
 *
 * @param {object} pipelineData - Pipeline数据 { nodes: [], edges: [] }
 * @returns {object} { valid: boolean, errors: string[], warnings: string[] }
 */
function validatePipelineTopology(pipelineData) {
  const errors = [];
  const warnings = [];

  try {
    const { nodes = [], edges = [] } = pipelineData;

    // 1. 基本检查
    if (nodes.length === 0) {
      errors.push('Pipeline必须至少包含一个节点');
      return { valid: false, errors, warnings };
    }

    // 2. 检查必须有start节点
    const startNodes = nodes.filter((n) => n.type === 'start');
    if (startNodes.length === 0) {
      errors.push('Pipeline必须包含start节点');
    } else if (startNodes.length > 1) {
      errors.push('Pipeline只能有一个start节点');
    }

    // 3. 检查是否有end节点
    const endNodes = nodes.filter((n) => n.type === 'end');
    if (endNodes.length === 0) {
      warnings.push('建议添加end节点以明确Pipeline终点');
    }

    // 4. 使用Kahn算法检测环
    const cycleDetection = detectCyclesUsingKahn(nodes, edges);
    if (!cycleDetection.isDAG) {
      errors.push('Pipeline存在循环依赖（环），无法执行');
      if (cycleDetection.remainingNodes.length > 0) {
        errors.push(`涉及节点: ${cycleDetection.remainingNodes.join(', ')}`);
      }
    }

    // 5. 检查入度出度规则
    const degreeErrors = validateDegreeRules(nodes, edges);
    errors.push(...degreeErrors);

    // 6. 检查孤立节点（没有连接的节点）
    const isolatedNodes = findIsolatedNodes(nodes, edges);
    if (isolatedNodes.length > 0) {
      warnings.push(`发现${isolatedNodes.length}个孤立节点（未连接）: ${isolatedNodes.join(', ')}`);
    }

    // 7. 检查变量可达性
    const varErrors = validateVariableReachability(nodes, edges);
    errors.push(...varErrors);

    logger.info('[PipelineValidator] 校验完成', {
      nodesCount: nodes.length,
      edgesCount: edges.length,
      errorsCount: errors.length,
      warningsCount: warnings.length,
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    logger.error('[PipelineValidator] 校验失败', error);
    return {
      valid: false,
      errors: [`校验过程出错: ${error.message}`],
      warnings,
    };
  }
}

/**
 * 使用Kahn算法检测有向图中的环
 * 艹！拓扑排序的经典算法，如果无法完成排序则说明有环！
 *
 * @param {array} nodes - 节点数组
 * @param {array} edges - 边数组
 * @returns {object} { isDAG: boolean, topologicalOrder: string[], remainingNodes: string[] }
 */
function detectCyclesUsingKahn(nodes, edges) {
  // 构建邻接表和入度表
  const adjacencyMap = new Map(); // nodeId => [targetIds]
  const inDegreeMap = new Map(); // nodeId => count

  // 初始化
  nodes.forEach((node) => {
    adjacencyMap.set(node.id, []);
    inDegreeMap.set(node.id, 0);
  });

  // 构建图结构
  edges.forEach((edge) => {
    const { source, target } = edge;

    // 检查节点是否存在
    if (!adjacencyMap.has(source) || !adjacencyMap.has(target)) {
      logger.warn('[Kahn] 边引用了不存在的节点', { source, target });
      return;
    }

    adjacencyMap.get(source).push(target);
    inDegreeMap.set(target, inDegreeMap.get(target) + 1);
  });

  // Kahn算法：从入度为0的节点开始
  const queue = [];
  const topologicalOrder = [];

  // 找到所有入度为0的节点
  inDegreeMap.forEach((degree, nodeId) => {
    if (degree === 0) {
      queue.push(nodeId);
    }
  });

  // BFS遍历
  while (queue.length > 0) {
    const currentNodeId = queue.shift();
    topologicalOrder.push(currentNodeId);

    // 获取当前节点的所有邻居
    const neighbors = adjacencyMap.get(currentNodeId) || [];

    neighbors.forEach((neighborId) => {
      // 减少邻居的入度
      const newDegree = inDegreeMap.get(neighborId) - 1;
      inDegreeMap.set(neighborId, newDegree);

      // 如果入度变为0，加入队列
      if (newDegree === 0) {
        queue.push(neighborId);
      }
    });
  }

  // 如果拓扑排序包含了所有节点，则说明是DAG（无环）
  const isDAG = topologicalOrder.length === nodes.length;

  // 找出未被访问的节点（说明它们在环中）
  const remainingNodes = nodes
    .filter((node) => !topologicalOrder.includes(node.id))
    .map((node) => node.id);

  return {
    isDAG,
    topologicalOrder,
    remainingNodes,
  };
}

/**
 * 检查入度出度规则
 * 艹！确保节点类型符合拓扑规则！
 *
 * @param {array} nodes - 节点数组
 * @param {array} edges - 边数组
 * @returns {string[]} 错误信息数组
 */
function validateDegreeRules(nodes, edges) {
  const errors = [];

  // 计算每个节点的入度和出度
  const inDegreeMap = new Map();
  const outDegreeMap = new Map();

  nodes.forEach((node) => {
    inDegreeMap.set(node.id, 0);
    outDegreeMap.set(node.id, 0);
  });

  edges.forEach((edge) => {
    const { source, target } = edge;

    if (outDegreeMap.has(source)) {
      outDegreeMap.set(source, outDegreeMap.get(source) + 1);
    }

    if (inDegreeMap.has(target)) {
      inDegreeMap.set(target, inDegreeMap.get(target) + 1);
    }
  });

  // 规则检查
  nodes.forEach((node) => {
    const inDegree = inDegreeMap.get(node.id) || 0;
    const outDegree = outDegreeMap.get(node.id) || 0;

    // Start节点：入度必须为0
    if (node.type === 'start' && inDegree > 0) {
      errors.push(`Start节点 "${node.id}" 的入度必须为0（当前: ${inDegree}）`);
    }

    // Start节点：出度至少为1
    if (node.type === 'start' && outDegree === 0) {
      errors.push(`Start节点 "${node.id}" 必须连接到至少一个后续节点`);
    }

    // End节点：出度必须为0
    if (node.type === 'end' && outDegree > 0) {
      errors.push(`End节点 "${node.id}" 的出度必须为0（当前: ${outDegree}）`);
    }

    // End节点：入度至少为1
    if (node.type === 'end' && inDegree === 0) {
      errors.push(`End节点 "${node.id}" 必须连接到至少一个前置节点`);
    }

    // Provider/Transform节点：入度至少为1
    if (['provider', 'transform'].includes(node.type) && inDegree === 0) {
      errors.push(`节点 "${node.id}" (${node.type}) 缺少输入连接`);
    }

    // Provider/Transform节点：出度至少为1（除非是end前的最后一个节点）
    if (['provider', 'transform'].includes(node.type) && outDegree === 0) {
      const hasEndNode = nodes.some((n) => n.type === 'end');
      if (hasEndNode) {
        // 如果有end节点，必须连接
        errors.push(`节点 "${node.id}" (${node.type}) 缺少输出连接`);
      }
    }
  });

  return errors;
}

/**
 * 查找孤立节点（没有任何连接的节点）
 * 艹！孤立节点不会被执行，应该给警告！
 *
 * @param {array} nodes - 节点数组
 * @param {array} edges - 边数组
 * @returns {string[]} 孤立节点ID数组
 */
function findIsolatedNodes(nodes, edges) {
  const connectedNodeIds = new Set();

  // 收集所有有连接的节点
  edges.forEach((edge) => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });

  // 找出没有连接的节点
  const isolatedNodes = nodes
    .filter((node) => !connectedNodeIds.has(node.id))
    .map((node) => node.id);

  return isolatedNodes;
}

/**
 * 校验变量可达性
 * 艹！确保每个节点引用的变量都能从上游获取！
 *
 * @param {array} nodes - 节点数组
 * @param {array} edges - 边数组
 * @returns {string[]} 错误信息数组
 */
function validateVariableReachability(nodes, edges) {
  const errors = [];

  // 构建邻接表（反向：target => [sources]）
  const reverseAdjacencyMap = new Map();

  nodes.forEach((node) => {
    reverseAdjacencyMap.set(node.id, []);
  });

  edges.forEach((edge) => {
    const { source, target } = edge;

    if (reverseAdjacencyMap.has(target)) {
      reverseAdjacencyMap.get(target).push(source);
    }
  });

  // 为每个节点计算可达的变量来源
  nodes.forEach((node) => {
    // 跳过start和end节点
    if (node.type === 'start' || node.type === 'end') return;

    // 提取节点的inputMapping中引用的变量
    const referencedVars = extractReferencedVars(node.data?.inputMapping || '');

    if (referencedVars.length === 0) return;

    // 获取可达的变量源（通过DFS遍历上游节点）
    const reachableVars = getReachableVars(node.id, nodes, reverseAdjacencyMap);

    // 检查每个引用的变量是否可达
    referencedVars.forEach((varPath) => {
      if (!isVarReachable(varPath, reachableVars)) {
        errors.push(`节点 "${node.id}" 引用了不可达的变量: {{${varPath}}}`);
      }
    });
  });

  return errors;
}

/**
 * 提取字符串中引用的变量路径
 * 艹！扫描{{variable.path}}提取所有变量！
 *
 * @param {string} template - 模板字符串
 * @returns {string[]} 变量路径数组
 */
function extractReferencedVars(template) {
  if (typeof template !== 'string') return [];

  const regex = /\{\{([^}]+)\}\}/g;
  const vars = [];
  let match;

  while ((match = regex.exec(template)) !== null) {
    const varPath = match[1].trim();

    // 跳过helpers和特殊语法
    if (varPath.startsWith('#') || varPath.startsWith('/') || varPath.startsWith('!')) {
      continue;
    }

    // 提取变量路径的第一部分（如 form.imageUrl => form）
    const rootVar = varPath.split('.')[0].split(' ')[0];

    if (rootVar && !vars.includes(varPath)) {
      vars.push(varPath);
    }
  }

  return vars;
}

/**
 * 获取节点可达的所有变量
 * 艹！DFS遍历上游节点，收集所有可用变量！
 *
 * @param {string} nodeId - 当前节点ID
 * @param {array} nodes - 所有节点
 * @param {Map} reverseAdjacencyMap - 反向邻接表
 * @returns {Set<string>} 可达的变量路径集合
 */
function getReachableVars(nodeId, nodes, reverseAdjacencyMap) {
  const reachableVars = new Set();
  const visited = new Set();

  // DFS遍历上游节点
  function dfs(currentNodeId) {
    if (visited.has(currentNodeId)) return;
    visited.add(currentNodeId);

    const currentNode = nodes.find((n) => n.id === currentNodeId);
    if (!currentNode) return;

    // 收集此节点提供的变量
    // 1. form.* 来自start节点
    if (currentNode.type === 'start') {
      reachableVars.add('form');
    }

    // 2. system.* 始终可用
    reachableVars.add('system');

    // 3. 节点的outputKey
    if (currentNode.data?.outputKey) {
      reachableVars.add(currentNode.data.outputKey);
    }

    // 继续遍历上游节点
    const upstreamNodes = reverseAdjacencyMap.get(currentNodeId) || [];
    upstreamNodes.forEach((upstreamId) => {
      dfs(upstreamId);
    });
  }

  dfs(nodeId);

  return reachableVars;
}

/**
 * 检查变量是否可达
 * 艹！检查变量路径是否存在于可达变量集合中！
 *
 * @param {string} varPath - 变量路径，如 'form.imageUrl'
 * @param {Set<string>} reachableVars - 可达的变量根路径集合
 * @returns {boolean}
 */
function isVarReachable(varPath, reachableVars) {
  // 提取根变量名（如 form.imageUrl => form）
  const rootVar = varPath.split('.')[0];

  return reachableVars.has(rootVar);
}

module.exports = {
  validatePipelineTopology,
  detectCyclesUsingKahn,
  validateDegreeRules,
  findIsolatedNodes,
  validateVariableReachability,
};
