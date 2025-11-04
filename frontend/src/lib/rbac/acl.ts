/**
 * RBAC访问控制系统（ACL）
 * 艹！这个系统实现细粒度权限控制，支持字段级权限！
 *
 * @author 老王
 */

/**
 * 操作类型
 */
export type Action = 'create' | 'read' | 'update' | 'delete' | 'export' | 'import' | 'manage';

/**
 * 资源类型
 */
export type Resource =
  | 'template'
  | 'prompt'
  | 'model'
  | 'user'
  | 'role'
  | 'tenant'
  | 'audit_log'
  | 'billing'
  | 'feature'
  | 'catalog'
  | 'experiment'
  | 'feedback'
  | 'analytics'
  | 'config';

/**
 * 角色类型
 */
export type Role = 'owner' | 'admin' | 'member' | 'viewer' | 'guest';

/**
 * 资源属性（用于更细粒度的权限判断）
 */
export interface ResourceAttributes {
  ownerId?: string; // 资源所有者
  tenantId?: string; // 资源所属租户
  status?: string; // 资源状态
  visibility?: 'public' | 'private' | 'team'; // 可见性
  [key: string]: any; // 其他自定义属性
}

/**
 * 权限规则
 */
export interface PermissionRule {
  resource: Resource;
  actions: Action[];
  condition?: (attrs?: ResourceAttributes) => boolean; // 可选条件函数
}

/**
 * 角色权限配置
 * 艹！这个配置定义了每个角色能做什么！
 */
const ROLE_PERMISSIONS: Record<Role, PermissionRule[]> = {
  /**
   * 拥有者：完全控制权
   */
  owner: [
    {
      resource: 'template',
      actions: ['create', 'read', 'update', 'delete', 'export', 'import'],
    },
    {
      resource: 'prompt',
      actions: ['create', 'read', 'update', 'delete', 'export', 'import'],
    },
    {
      resource: 'model',
      actions: ['create', 'read', 'update', 'delete', 'manage'],
    },
    {
      resource: 'user',
      actions: ['create', 'read', 'update', 'delete', 'manage'],
    },
    {
      resource: 'role',
      actions: ['create', 'read', 'update', 'delete', 'manage'],
    },
    {
      resource: 'tenant',
      actions: ['create', 'read', 'update', 'delete', 'manage'],
    },
    {
      resource: 'audit_log',
      actions: ['read', 'export'],
    },
    {
      resource: 'billing',
      actions: ['read', 'update', 'manage'],
    },
    {
      resource: 'feature',
      actions: ['create', 'read', 'update', 'delete', 'manage'],
    },
    {
      resource: 'catalog',
      actions: ['create', 'read', 'update', 'delete', 'manage'],
    },
    {
      resource: 'experiment',
      actions: ['create', 'read', 'update', 'delete', 'manage'],
    },
    {
      resource: 'feedback',
      actions: ['read', 'update', 'delete'],
    },
    {
      resource: 'analytics',
      actions: ['read', 'export'],
    },
    {
      resource: 'config',
      actions: ['create', 'read', 'update', 'delete', 'manage'],
    },
  ],

  /**
   * 管理员：管理权限（无法删除租户和修改拥有者）
   */
  admin: [
    {
      resource: 'template',
      actions: ['create', 'read', 'update', 'delete', 'export', 'import'],
    },
    {
      resource: 'prompt',
      actions: ['create', 'read', 'update', 'delete', 'export', 'import'],
    },
    {
      resource: 'model',
      actions: ['read', 'update', 'manage'],
    },
    {
      resource: 'user',
      actions: ['read', 'update', 'manage'],
      condition: (attrs) => {
        // 不能管理拥有者
        return attrs?.role !== 'owner';
      },
    },
    {
      resource: 'role',
      actions: ['read', 'update'],
    },
    {
      resource: 'tenant',
      actions: ['read', 'update'],
    },
    {
      resource: 'audit_log',
      actions: ['read', 'export'],
    },
    {
      resource: 'billing',
      actions: ['read'],
    },
    {
      resource: 'feature',
      actions: ['create', 'read', 'update', 'delete', 'manage'],
    },
    {
      resource: 'catalog',
      actions: ['create', 'read', 'update', 'delete'],
    },
    {
      resource: 'experiment',
      actions: ['create', 'read', 'update', 'delete'],
    },
    {
      resource: 'feedback',
      actions: ['read', 'update'],
    },
    {
      resource: 'analytics',
      actions: ['read', 'export'],
    },
    {
      resource: 'config',
      actions: ['read', 'update'],
    },
  ],

  /**
   * 成员：标准权限（可以创建和编辑自己的内容）
   */
  member: [
    {
      resource: 'template',
      actions: ['create', 'read', 'update', 'export'],
      condition: (attrs) => {
        // 只能编辑自己创建的或公开的
        return attrs?.visibility === 'public' || attrs?.ownerId === 'current-user';
      },
    },
    {
      resource: 'prompt',
      actions: ['create', 'read', 'update', 'export'],
      condition: (attrs) => {
        return attrs?.visibility === 'public' || attrs?.ownerId === 'current-user';
      },
    },
    {
      resource: 'model',
      actions: ['read'],
    },
    {
      resource: 'user',
      actions: ['read'],
    },
    {
      resource: 'tenant',
      actions: ['read'],
    },
    {
      resource: 'feature',
      actions: ['read'],
    },
    {
      resource: 'catalog',
      actions: ['read'],
    },
    {
      resource: 'experiment',
      actions: ['read'],
    },
    {
      resource: 'feedback',
      actions: ['create', 'read'],
    },
    {
      resource: 'analytics',
      actions: ['read'],
    },
  ],

  /**
   * 访客：只读权限
   */
  viewer: [
    {
      resource: 'template',
      actions: ['read'],
      condition: (attrs) => {
        // 只能查看公开内容
        return attrs?.visibility === 'public';
      },
    },
    {
      resource: 'prompt',
      actions: ['read'],
      condition: (attrs) => {
        return attrs?.visibility === 'public';
      },
    },
    {
      resource: 'model',
      actions: ['read'],
    },
    {
      resource: 'catalog',
      actions: ['read'],
    },
    {
      resource: 'analytics',
      actions: ['read'],
    },
  ],

  /**
   * 游客：最小权限
   */
  guest: [
    {
      resource: 'template',
      actions: ['read'],
      condition: (attrs) => {
        return attrs?.visibility === 'public';
      },
    },
    {
      resource: 'catalog',
      actions: ['read'],
    },
  ],
};

/**
 * 字段级权限配置
 * 艹！控制每个角色能看到哪些字段！
 */
export interface FieldPermissions {
  visible: string[]; // 可见字段
  editable: string[]; // 可编辑字段
  masked: string[]; // 需要脱敏的字段
}

/**
 * 资源字段权限配置
 */
const FIELD_PERMISSIONS: Record<Resource, Record<Role, FieldPermissions>> = {
  user: {
    owner: {
      visible: ['id', 'email', 'name', 'role', 'phone', 'address', 'created_at', 'last_login'],
      editable: ['email', 'name', 'role', 'phone', 'address'],
      masked: [],
    },
    admin: {
      visible: ['id', 'email', 'name', 'role', 'phone', 'created_at', 'last_login'],
      editable: ['email', 'name', 'phone'],
      masked: ['phone'], // 管理员看到的手机号脱敏
    },
    member: {
      visible: ['id', 'email', 'name', 'role', 'created_at'],
      editable: [],
      masked: ['email', 'phone'],
    },
    viewer: {
      visible: ['id', 'name', 'role'],
      editable: [],
      masked: ['email', 'phone', 'address'],
    },
    guest: {
      visible: ['id', 'name'],
      editable: [],
      masked: ['email', 'phone', 'address'],
    },
  },

  billing: {
    owner: {
      visible: ['order_id', 'amount', 'status', 'payment_method', 'created_at', 'invoice_url'],
      editable: ['payment_method'],
      masked: [],
    },
    admin: {
      visible: ['order_id', 'amount', 'status', 'created_at'],
      editable: [],
      masked: ['payment_method'], // 脱敏支付方式
    },
    member: {
      visible: ['order_id', 'amount', 'status', 'created_at'],
      editable: [],
      masked: ['payment_method'],
    },
    viewer: {
      visible: [],
      editable: [],
      masked: ['order_id', 'amount', 'payment_method'],
    },
    guest: {
      visible: [],
      editable: [],
      masked: ['order_id', 'amount', 'payment_method'],
    },
  },

  // 其他资源的字段权限（简化）
  template: {
    owner: { visible: ['*'], editable: ['*'], masked: [] },
    admin: { visible: ['*'], editable: ['*'], masked: [] },
    member: { visible: ['*'], editable: ['name', 'description', 'content'], masked: [] },
    viewer: { visible: ['*'], editable: [], masked: [] },
    guest: { visible: ['id', 'name', 'description'], editable: [], masked: [] },
  },

  prompt: {
    owner: { visible: ['*'], editable: ['*'], masked: [] },
    admin: { visible: ['*'], editable: ['*'], masked: [] },
    member: { visible: ['*'], editable: ['title', 'content'], masked: [] },
    viewer: { visible: ['*'], editable: [], masked: [] },
    guest: { visible: ['id', 'title'], editable: [], masked: [] },
  },

  model: {
    owner: { visible: ['*'], editable: ['*'], masked: [] },
    admin: { visible: ['*'], editable: ['*'], masked: [] },
    member: { visible: ['*'], editable: [], masked: ['api_key'] },
    viewer: { visible: ['id', 'name', 'status'], editable: [], masked: ['api_key'] },
    guest: { visible: [], editable: [], masked: [] },
  },

  role: {
    owner: { visible: ['*'], editable: ['*'], masked: [] },
    admin: { visible: ['*'], editable: ['permissions'], masked: [] },
    member: { visible: ['id', 'name'], editable: [], masked: [] },
    viewer: { visible: ['id', 'name'], editable: [], masked: [] },
    guest: { visible: [], editable: [], masked: [] },
  },

  tenant: {
    owner: { visible: ['*'], editable: ['*'], masked: [] },
    admin: { visible: ['*'], editable: ['name', 'settings'], masked: [] },
    member: { visible: ['id', 'name', 'type'], editable: [], masked: [] },
    viewer: { visible: ['id', 'name'], editable: [], masked: [] },
    guest: { visible: [], editable: [], masked: [] },
  },

  audit_log: {
    owner: { visible: ['*'], editable: [], masked: [] },
    admin: { visible: ['*'], editable: [], masked: [] },
    member: { visible: [], editable: [], masked: [] },
    viewer: { visible: [], editable: [], masked: [] },
    guest: { visible: [], editable: [], masked: [] },
  },

  feature: {
    owner: { visible: ['*'], editable: ['*'], masked: [] },
    admin: { visible: ['*'], editable: ['*'], masked: [] },
    member: { visible: ['*'], editable: [], masked: [] },
    viewer: { visible: ['id', 'name', 'description'], editable: [], masked: [] },
    guest: { visible: [], editable: [], masked: [] },
  },

  catalog: {
    owner: { visible: ['*'], editable: ['*'], masked: [] },
    admin: { visible: ['*'], editable: ['*'], masked: [] },
    member: { visible: ['*'], editable: [], masked: [] },
    viewer: { visible: ['*'], editable: [], masked: [] },
    guest: { visible: ['id', 'name'], editable: [], masked: [] },
  },

  experiment: {
    owner: { visible: ['*'], editable: ['*'], masked: [] },
    admin: { visible: ['*'], editable: ['*'], masked: [] },
    member: { visible: ['*'], editable: [], masked: [] },
    viewer: { visible: [], editable: [], masked: [] },
    guest: { visible: [], editable: [], masked: [] },
  },

  feedback: {
    owner: { visible: ['*'], editable: ['*'], masked: [] },
    admin: { visible: ['*'], editable: ['status', 'resolution'], masked: [] },
    member: { visible: ['id', 'title', 'status'], editable: [], masked: ['user_email'] },
    viewer: { visible: [], editable: [], masked: [] },
    guest: { visible: [], editable: [], masked: [] },
  },

  analytics: {
    owner: { visible: ['*'], editable: [], masked: [] },
    admin: { visible: ['*'], editable: [], masked: [] },
    member: { visible: ['*'], editable: [], masked: ['revenue', 'cost'] },
    viewer: { visible: ['basic_stats'], editable: [], masked: ['revenue', 'cost'] },
    guest: { visible: [], editable: [], masked: [] },
  },

  config: {
    owner: { visible: ['*'], editable: ['*'], masked: [] },
    admin: { visible: ['*'], editable: ['*'], masked: ['api_keys', 'secrets'] },
    member: { visible: ['id', 'name'], editable: [], masked: ['api_keys', 'secrets'] },
    viewer: { visible: [], editable: [], masked: [] },
    guest: { visible: [], editable: [], masked: [] },
  },
};

/**
 * ACL访问控制类
 */
export class ACL {
  private role: Role;

  constructor(role: Role) {
    this.role = role;
  }

  /**
   * 检查是否有权限执行某个操作
   *
   * @param resource 资源类型
   * @param action 操作类型
   * @param attrs 资源属性（可选，用于更细粒度的权限判断）
   * @returns 是否有权限
   */
  can(resource: Resource, action: Action, attrs?: ResourceAttributes): boolean {
    const permissions = ROLE_PERMISSIONS[this.role];
    if (!permissions) return false;

    // 查找匹配的权限规则
    const rule = permissions.find((p) => p.resource === resource);
    if (!rule) return false;

    // 检查操作是否允许
    if (!rule.actions.includes(action)) return false;

    // 检查条件函数（如果有）
    if (rule.condition && attrs) {
      return rule.condition(attrs);
    }

    return true;
  }

  /**
   * 检查是否有权限查看某个字段
   *
   * @param resource 资源类型
   * @param field 字段名
   * @returns 是否可见
   */
  canViewField(resource: Resource, field: string): boolean {
    const fieldPerms = FIELD_PERMISSIONS[resource]?.[this.role];
    if (!fieldPerms) return false;

    const { visible } = fieldPerms;
    return visible.includes('*') || visible.includes(field);
  }

  /**
   * 检查是否有权限编辑某个字段
   *
   * @param resource 资源类型
   * @param field 字段名
   * @returns 是否可编辑
   */
  canEditField(resource: Resource, field: string): boolean {
    const fieldPerms = FIELD_PERMISSIONS[resource]?.[this.role];
    if (!fieldPerms) return false;

    const { editable } = fieldPerms;
    return editable.includes('*') || editable.includes(field);
  }

  /**
   * 检查字段是否需要脱敏
   *
   * @param resource 资源类型
   * @param field 字段名
   * @returns 是否需要脱敏
   */
  isFieldMasked(resource: Resource, field: string): boolean {
    const fieldPerms = FIELD_PERMISSIONS[resource]?.[this.role];
    if (!fieldPerms) return true; // 默认脱敏

    const { masked } = fieldPerms;
    return masked.includes(field);
  }

  /**
   * 获取资源的字段权限
   *
   * @param resource 资源类型
   * @returns 字段权限配置
   */
  getFieldPermissions(resource: Resource): FieldPermissions | null {
    return FIELD_PERMISSIONS[resource]?.[this.role] || null;
  }

  /**
   * 过滤对象，只保留有权限查看的字段
   *
   * @param resource 资源类型
   * @param data 原始数据对象
   * @returns 过滤后的数据对象
   */
  filterFields<T extends Record<string, any>>(resource: Resource, data: T): Partial<T> {
    const fieldPerms = this.getFieldPermissions(resource);
    if (!fieldPerms) return {};

    const { visible, masked } = fieldPerms;
    const filtered: any = {};

    // 如果visible包含'*'，则显示所有字段
    if (visible.includes('*')) {
      Object.keys(data).forEach((key) => {
        if (masked.includes(key)) {
          // 脱敏处理
          filtered[key] = this.maskValue(data[key]);
        } else {
          filtered[key] = data[key];
        }
      });
    } else {
      // 只显示允许的字段
      visible.forEach((field) => {
        if (data.hasOwnProperty(field)) {
          if (masked.includes(field)) {
            filtered[field] = this.maskValue(data[field]);
          } else {
            filtered[field] = data[field];
          }
        }
      });
    }

    return filtered;
  }

  /**
   * 脱敏处理
   *
   * @param value 原始值
   * @returns 脱敏后的值
   */
  private maskValue(value: any): any {
    if (typeof value === 'string') {
      // 邮箱脱敏
      if (value.includes('@')) {
        const [name, domain] = value.split('@');
        return `${name.slice(0, 2)}***@${domain}`;
      }

      // 手机号脱敏
      if (/^1[3-9]\d{9}$/.test(value)) {
        return value.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
      }

      // 其他字符串脱敏
      if (value.length > 4) {
        return value.slice(0, 2) + '***' + value.slice(-2);
      }

      return '***';
    }

    return '***';
  }
}

/**
 * 创建ACL实例
 *
 * @param role 用户角色
 * @returns ACL实例
 */
export function createACL(role: Role): ACL {
  return new ACL(role);
}
