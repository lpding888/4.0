/**
 * Provider核心类型定义
 * 所有Provider实现必须遵循这些接口
 * 这tm的是规范，必须严格遵守！
 */

/**
 * 执行上下文
 * 包含执行过程中需要的所有元数据和控制参数
 */
export interface ExecContext {
  /** 任务ID，用于日志追踪和关联 */
  taskId: string;

  /** 输入数据（来自上一步或用户输入） */
  input: any;

  /** AbortSignal，用于取消执行（超时控制） */
  signal?: AbortSignal;

  /** 执行超时时间（毫秒），不传则使用默认值 */
  timeout?: number;

  /** 额外的元数据，各Provider可自定义使用 */
  metadata?: Record<string, any>;
}

/**
 * 执行结果
 * 统一的返回格式，便于Pipeline传递数据
 */
export interface ExecResult<T = any> {
  /** 执行是否成功 */
  success: boolean;

  /** 输出数据（成功时必须有） */
  data?: T;

  /** 错误信息（失败时必须有） */
  error?: {
    code: string;
    message: string;
    details?: any;
  };

  /** 执行时长（毫秒） */
  duration?: number;

  /** 额外的元数据 */
  metadata?: Record<string, any>;
}

/**
 * 重试策略配置
 * 指数退避算法参数
 */
export interface RetryPolicy {
  /** 最大重试次数，0表示不重试 */
  maxRetries: number;

  /** 初始延迟时间（毫秒） */
  initialDelay: number;

  /** 最大延迟时间（毫秒），避免指数增长过大 */
  maxDelay: number;

  /** 退避倍数（默认2，即每次延迟翻倍） */
  backoffMultiplier: number;

  /** 可重试的错误码列表，空数组表示所有错误都重试 */
  retryableErrors?: string[];
}

/**
 * Provider接口定义
 * 所有Provider实现必须遵循此接口
 */
export interface IProvider {
  /**
   * Provider唯一标识（如 'openai-gpt4'）
   * 用于日志和调试，这个tm的必须唯一！
   */
  readonly key: string;

  /**
   * Provider显示名称（如 'OpenAI GPT-4'）
   * 用于UI展示
   */
  readonly name: string;

  /**
   * 参数校验
   * 在执行前校验输入参数是否合法
   * @param input - 输入数据
   * @returns 校验错误信息，null表示校验通过
   */
  validate(input: any): string | null;

  /**
   * 执行Provider任务
   * @param context - 执行上下文
   * @returns Promise<ExecResult> - 执行结果
   */
  execute(context: ExecContext): Promise<ExecResult>;

  /**
   * 健康检查
   * 用于检查Provider是否可用（例如API是否可达）
   * @returns Promise<boolean> - true表示健康，false表示不可用
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Provider错误码定义
 * 这些错误码tm的必须严格使用，别瞎搞自定义！
 */
export enum ProviderErrorCode {
  /** Provider不在白名单中 */
  ERR_PROVIDER_NOT_ALLOWED = 'ERR_PROVIDER_NOT_ALLOWED',

  /** Provider加载失败（文件不存在或导入错误） */
  ERR_PROVIDER_LOAD_FAILED = 'ERR_PROVIDER_LOAD_FAILED',

  /** Provider执行超时 */
  ERR_PROVIDER_TIMEOUT = 'ERR_PROVIDER_TIMEOUT',

  /** Provider执行失败 */
  ERR_PROVIDER_EXECUTION_FAILED = 'ERR_PROVIDER_EXECUTION_FAILED',

  /** Provider健康检查失败 */
  ERR_PROVIDER_UNHEALTHY = 'ERR_PROVIDER_UNHEALTHY',

  /** Provider参数校验失败 */
  ERR_PROVIDER_VALIDATION_FAILED = 'ERR_PROVIDER_VALIDATION_FAILED',

  /** Provider重试次数耗尽 */
  ERR_PROVIDER_MAX_RETRIES_EXCEEDED = 'ERR_PROVIDER_MAX_RETRIES_EXCEEDED',
}

/**
 * Provider错误类
 * 这个SB类统一处理所有Provider错误
 */
export class ProviderError extends Error {
  public readonly code: ProviderErrorCode;
  public readonly details?: any;

  constructor(code: ProviderErrorCode, message: string, details?: any) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    this.details = details;

    // 艹，这个tm的是为了在堆栈跟踪中正确显示错误类型
    Object.setPrototypeOf(this, ProviderError.prototype);
  }
}

/**
 * 默认重试策略
 * 最大3次重试，初始延迟1秒，最大延迟10秒，每次翻倍
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: [],
};

/**
 * 默认超时时间（30秒）
 * 这个SB值适用于大部分API调用
 */
export const DEFAULT_TIMEOUT = 30000;
