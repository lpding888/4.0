/**
 * 基于角色的访问控制 (RBAC) 工具
 */

// 用户角色定义
const USER_ROLES = {
  VIEWER: 'viewer',
  EDITOR: 'editor',
  ADMIN: 'admin'
};

// 资源定义
const RESOURCES = {
  FEATURES: 'features',
  PROVIDERS: 'providers',
  MCP_ENDPOINTS: 'mcp_endpoints',
  PROMPT_TEMPLATES: 'prompt_templates',
  PIPELINES: 'pipelines',
  SECURITY: 'security',
  USERS: 'users'
};

// 操作定义
const ACTIONS = {
  READ: 'read',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  PUBLISH: 'publish',
  ROLLBACK: 'rollback',
  TEST: 'test',
  MANAGE: 'manage'
};

// 权限矩阵
const PERMISSION_MATRIX = {
  [USER_ROLES.VIEWER]: {
    [RESOURCES.FEATURES]: [ACTIONS.READ],
    [RESOURCES.PROVIDERS]: [ACTIONS.READ],
    [RESOURCES.MCP_ENDPOINTS]: [ACTIONS.READ],
    [RESOURCES.PROMPT_TEMPLATES]: [ACTIONS.READ],
    [RESOURCES.PIPELINES]: [ACTIONS.READ],
    [RESOURCES.SECURITY]: [ACTIONS.READ],
    [RESOURCES.USERS]: [ACTIONS.READ]
  },
  [USER_ROLES.EDITOR]: {
    [RESOURCES.FEATURES]: [ACTIONS.READ, ACTIONS.CREATE, ACTIONS.UPDATE],
    [RESOURCES.PROVIDERS]: [ACTIONS.READ, ACTIONS.CREATE, ACTIONS.UPDATE, ACTIONS.TEST],
    [RESOURCES.MCP_ENDPOINTS]: [ACTIONS.READ, ACTIONS.CREATE, ACTIONS.UPDATE, ACTIONS.TEST],
    [RESOURCES.PROMPT_TEMPLATES]: [ACTIONS.READ, ACTIONS.CREATE, ACTIONS.UPDATE, ACTIONS.TEST],
    [RESOURCES.PIPELINES]: [ACTIONS.READ, ACTIONS.CREATE, ACTIONS.UPDATE, ACTIONS.TEST],
    [RESOURCES.SECURITY]: [ACTIONS.READ, ACTIONS.TEST],
    [RESOURCES.USERS]: [ACTIONS.READ]
  },
  [USER_ROLES.ADMIN]: {
    [RESOURCES.FEATURES]: [ACTIONS.READ, ACTIONS.CREATE, ACTIONS.UPDATE, ACTIONS.DELETE, ACTIONS.PUBLISH, ACTIONS.ROLLBACK],
    [RESOURCES.PROVIDERS]: [ACTIONS.READ, ACTIONS.CREATE, ACTIONS.UPDATE, ACTIONS.DELETE, ACTIONS.TEST],
    [RESOURCES.MCP_ENDPOINTS]: [ACTIONS.READ, ACTIONS.CREATE, ACTIONS.UPDATE, ACTIONS.DELETE, ACTIONS.TEST],
    [RESOURCES.PROMPT_TEMPLATES]: [ACTIONS.READ, ACTIONS.CREATE, ACTIONS.UPDATE, ACTIONS.DELETE, ACTIONS.PUBLISH, ACTIONS.TEST],
    [RESOURCES.PIPELINES]: [ACTIONS.READ, ACTIONS.CREATE, ACTIONS.UPDATE, ACTIONS.DELETE, ACTIONS.TEST],
    [RESOURCES.SECURITY]: [ACTIONS.READ, ACTIONS.MANAGE, ACTIONS.TEST],
    [RESOURCES.USERS]: [ACTIONS.READ, ACTIONS.CREATE, ACTIONS.UPDATE, ACTIONS.DELETE, ACTIONS.MANAGE]
  }
};

/**
 * 检查用户是否有指定权限
 * @param {string} userRole - 用户角色
 * @param {string} resource - 资源
 * @param {string} action - 操作
 * @returns {boolean} 是否有权限
 */
function hasPermission(userRole, resource, action) {
  const rolePermissions = PERMISSION_MATRIX[userRole];
  if (!rolePermissions) {
    return false;
  }

  const resourcePermissions = rolePermissions[resource];
  if (!resourcePermissions) {
    return false;
  }

  return resourcePermissions.includes(action);
}

/**
 * 检查路由权限
 * @param {string} userRole - 用户角色
 * @param {string} method - HTTP方法
 * @param {string} path - 路由路径
 * @returns {boolean} 是否有权限
 */
function checkRoutePermission(userRole, method, path) {
  // 将HTTP方法映射到操作
  const methodToAction = {
    'GET': ACTIONS.READ,
    'POST': ACTIONS.CREATE,
    'PUT': ACTIONS.UPDATE,
    'PATCH': ACTIONS.UPDATE,
    'DELETE': ACTIONS.DELETE
  };

  const action = methodToAction[method];
  if (!action) {
    return false;
  }

  // 从路径提取资源类型
  let resource = null;
  if (path.includes('/features')) {
    resource = RESOURCES.FEATURES;
  } else if (path.includes('/providers')) {
    resource = RESOURCES.PROVIDERS;
  } else if (path.includes('/mcp-endpoints')) {
    resource = RESOURCES.MCP_ENDPOINTS;
  } else if (path.includes('/prompt-templates')) {
    resource = RESOURCES.PROMPT_TEMPLATES;
  } else if (path.includes('/pipelines')) {
    resource = RESOURCES.PIPELINES;
  } else if (path.includes('/security')) {
    resource = RESOURCES.SECURITY;
  } else if (path.includes('/users')) {
    resource = RESOURCES.USERS;
  }

  if (!resource) {
    return true; // 未知路径默认允许
  }

  return hasPermission(userRole, resource, action);
}

/**
 * 记录权限访问日志
 * @param {Object} logData - 日志数据
 */
function logPermissionAccess(logData) {
  const { userId, userRole, resource, action, path, method, ip, userAgent } = logData;

  console.log(`[RBAC] ${new Date().toISOString()} - User: ${userId}(${userRole}) - ${method} ${path} - ${resource}:${action} - IP: ${ip}`);
}

/**
 * 获取用户的所有权限
 * @param {string} userRole - 用户角色
 * @returns {Object} 权限对象
 */
function getUserPermissions(userRole) {
  return PERMISSION_MATRIX[userRole] || {};
}

/**
 * 检查角色是否有效
 * @param {string} role - 角色
 * @returns {boolean} 是否有效
 */
function isValidRole(role) {
  return Object.values(USER_ROLES).includes(role);
}

/**
 * 检查资源是否有效
 * @param {string} resource - 资源
 * @returns {boolean} 是否有效
 */
function isValidResource(resource) {
  return Object.values(RESOURCES).includes(resource);
}

/**
 * 检查操作是否有效
 * @param {string} action - 操作
 * @returns {boolean} 是否有效
 */
function isValidAction(action) {
  return Object.values(ACTIONS).includes(action);
}

module.exports = {
  USER_ROLES,
  RESOURCES,
  ACTIONS,
  PERMISSION_MATRIX,
  hasPermission,
  checkRoutePermission,
  logPermissionAccess,
  getUserPermissions,
  isValidRole,
  isValidResource,
  isValidAction
};