/**
 * 规则引擎 DSL 类型定义
 * 艹！这个类型系统支持触发器、条件、动作的完整定义！
 *
 * @author 老王
 */

/**
 * 规则触发器类型
 */
export type TriggerType = 'event' | 'schedule';

/**
 * 条件类型
 */
export type ConditionType = 'attribute' | 'quota' | 'experiment' | 'time' | 'custom';

/**
 * 动作类型
 */
export type ActionType = 'webhook' | 'notification' | 'experiment_toggle' | 'quota_adjust' | 'custom';

/**
 * 条件操作符
 */
export type ConditionOperator =
  | 'eq' // 等于
  | 'ne' // 不等于
  | 'gt' // 大于
  | 'gte' // 大于等于
  | 'lt' // 小于
  | 'lte' // 小于等于
  | 'in' // 包含于
  | 'not_in' // 不包含于
  | 'contains' // 字符串包含
  | 'matches'; // 正则匹配

/**
 * 事件触发器
 */
export interface EventTrigger {
  type: 'event';
  event_name: string; // 事件名称，如 'user.login', 'template.created'
  debounce?: number; // 防抖延迟（毫秒）
  throttle?: number; // 节流延迟（毫秒）
}

/**
 * 定时触发器
 */
export interface ScheduleTrigger {
  type: 'schedule';
  cron: string; // Cron表达式
  timezone?: string; // 时区，默认 'Asia/Shanghai'
}

/**
 * 触发器定义
 */
export type Trigger = EventTrigger | ScheduleTrigger;

/**
 * 条件定义
 */
export interface Condition {
  type: ConditionType;
  field: string; // 字段名
  operator: ConditionOperator;
  value: any; // 比较值
  and?: Condition[]; // AND条件组
  or?: Condition[]; // OR条件组
}

/**
 * Webhook动作
 */
export interface WebhookAction {
  type: 'webhook';
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number; // 超时时间（毫秒），默认5000
  retries?: number; // 重试次数，默认3
}

/**
 * 通知动作
 */
export interface NotificationAction {
  type: 'notification';
  channel: 'email' | 'sms' | 'push' | 'webhook';
  recipients: string[]; // 接收者列表
  template: string; // 模板ID或内容
  data?: Record<string, any>; // 模板数据
}

/**
 * 实验开关动作
 */
export interface ExperimentToggleAction {
  type: 'experiment_toggle';
  experiment_id: string;
  enabled: boolean;
}

/**
 * 配额调整动作
 */
export interface QuotaAdjustAction {
  type: 'quota_adjust';
  quota_type: string;
  adjustment: number; // 调整量（正数增加，负数减少）
  reason?: string;
}

/**
 * 自定义动作
 */
export interface CustomAction {
  type: 'custom';
  handler: string; // 处理器名称
  params?: Record<string, any>;
}

/**
 * 动作定义
 */
export type Action =
  | WebhookAction
  | NotificationAction
  | ExperimentToggleAction
  | QuotaAdjustAction
  | CustomAction;

/**
 * 规则状态
 */
export type RuleStatus = 'enabled' | 'disabled' | 'draft';

/**
 * 规则定义
 */
export interface Rule {
  id: string;
  name: string;
  description?: string;
  status: RuleStatus;
  trigger: Trigger;
  conditions: Condition[];
  actions: Action[];
  priority?: number; // 优先级，数字越大越优先
  created_at: number;
  updated_at: number;
  created_by?: string;
  version?: number; // 版本号
}

/**
 * 规则执行上下文
 */
export interface RuleContext {
  event_name?: string; // 事件名称
  event_data?: any; // 事件数据
  user_id?: string;
  tenant_id?: string;
  user_email?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * 规则执行结果
 */
export interface RuleExecutionResult {
  rule_id: string;
  rule_name: string;
  triggered: boolean;
  conditions_met: boolean;
  actions_executed: number;
  actions_failed: number;
  errors?: Array<{
    action_index: number;
    error: string;
  }>;
  duration_ms: number;
  timestamp: number;
}

/**
 * 规则引擎配置
 */
export interface RuleEngineConfig {
  enabled: boolean;
  max_concurrent_actions?: number; // 最大并发动作数，默认10
  default_action_timeout?: number; // 默认动作超时时间（毫秒），默认5000
  enable_logging?: boolean; // 是否启用日志
  enable_metrics?: boolean; // 是否启用指标
}
