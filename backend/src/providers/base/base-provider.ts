/**
 * BaseProvider基类
 * 提供通用的重试、超时、日志等功能
 * 这tm的是所有Provider的基础，必须继承！
 */

import {
  IProvider,
  ExecContext,
  ExecResult,
  RetryPolicy,
  ProviderError,
  ProviderErrorCode,
  DEFAULT_RETRY_POLICY,
  DEFAULT_TIMEOUT,
} from '../types';

/**
 * 日志接口
 * Provider可以通过这个接口输出日志
 */
export interface ILogger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

/**
 * 默认日志实现（使用console）
 * 生产环境应该替换成Winston等专业日志库
 */
class ConsoleLogger implements ILogger {
  info(message: string, meta?: any): void {
    console.log(`[INFO] ${message}`, meta || '');
  }

  warn(message: string, meta?: any): void {
    console.warn(`[WARN] ${message}`, meta || '');
  }

  error(message: string, meta?: any): void {
    console.error(`[ERROR] ${message}`, meta || '');
  }

  debug(message: string, meta?: any): void {
    console.debug(`[DEBUG] ${message}`, meta || '');
  }
}

/**
 * BaseProvider抽象基类
 * 实现了通用的重试、超时控制、日志等功能
 */
export abstract class BaseProvider implements IProvider {
  /** Provider唯一标识 */
  public abstract readonly key: string;

  /** Provider显示名称 */
  public abstract readonly name: string;

  /** 重试策略配置 */
  protected retryPolicy: RetryPolicy;

  /** 日志接口 */
  protected logger: ILogger;

  /** 默认超时时间（毫秒） */
  protected defaultTimeout: number;

  constructor(
    retryPolicy: RetryPolicy = DEFAULT_RETRY_POLICY,
    logger: ILogger = new ConsoleLogger(),
    defaultTimeout: number = DEFAULT_TIMEOUT
  ) {
    this.retryPolicy = retryPolicy;
    this.logger = logger;
    this.defaultTimeout = defaultTimeout;
  }

  /**
   * 参数校验（子类必须实现）
   * @param input - 输入数据
   * @returns 校验错误信息，null表示校验通过
   */
  public abstract validate(input: any): string | null;

  /**
   * 执行Provider任务（带重试和超时控制）
   * 这个tm的方法是模板方法，子类不应该重写！
   * @param context - 执行上下文
   * @returns Promise<ExecResult> - 执行结果
   */
  public async execute(context: ExecContext): Promise<ExecResult> {
    const startTime = Date.now();

    // 1. 参数校验
    const validationError = this.validate(context.input);
    if (validationError) {
      this.logger.error(`[${this.key}] 参数校验失败`, {
        taskId: context.taskId,
        error: validationError,
      });
      return {
        success: false,
        error: {
          code: ProviderErrorCode.ERR_PROVIDER_VALIDATION_FAILED,
          message: validationError,
        },
        duration: Date.now() - startTime,
      };
    }

    // 2. 设置超时控制
    const timeout = context.timeout || this.defaultTimeout;
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeout);

    // 艹，如果用户传入了signal，需要监听它并同步到内部的abortController
    if (context.signal) {
      context.signal.addEventListener('abort', () => {
        abortController.abort();
      });
    }

    try {
      // 3. 带重试的执行
      const result = await this.executeWithRetry({
        ...context,
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);
      return {
        ...result,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      clearTimeout(timeoutId);

      // 处理超时错误
      if (error.name === 'AbortError' || abortController.signal.aborted) {
        this.logger.error(`[${this.key}] 执行超时`, {
          taskId: context.taskId,
          timeout,
        });
        return {
          success: false,
          error: {
            code: ProviderErrorCode.ERR_PROVIDER_TIMEOUT,
            message: `执行超时（${timeout}ms）`,
            details: { timeout },
          },
          duration: Date.now() - startTime,
        };
      }

      // 处理其他错误
      this.logger.error(`[${this.key}] 执行失败`, {
        taskId: context.taskId,
        error: error.message,
        stack: error.stack,
      });

      return {
        success: false,
        error: {
          code:
            error instanceof ProviderError
              ? error.code
              : ProviderErrorCode.ERR_PROVIDER_EXECUTION_FAILED,
          message: error.message || '执行失败',
          details: error.details || { stack: error.stack },
        },
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 带重试的执行逻辑
   * 使用指数退避算法进行重试
   * @param context - 执行上下文
   * @returns Promise<ExecResult> - 执行结果
   */
  protected async executeWithRetry(
    context: ExecContext
  ): Promise<ExecResult> {
    let lastError: any = null;
    let attempt = 0;

    while (attempt <= this.retryPolicy.maxRetries) {
      try {
        this.logger.debug(
          `[${this.key}] 开始执行 (尝试 ${attempt + 1}/${this.retryPolicy.maxRetries + 1})`,
          { taskId: context.taskId }
        );

        // 调用子类实现的doExecute方法
        const result = await this.doExecute(context);

        if (result.success) {
          if (attempt > 0) {
            this.logger.info(
              `[${this.key}] 重试成功 (尝试 ${attempt + 1}/${this.retryPolicy.maxRetries + 1})`,
              { taskId: context.taskId }
            );
          }
          return result;
        }

        // 执行失败，判断是否可重试
        const errorCode = result.error?.code || '';
        const isRetryable = this.isRetryableError(errorCode);

        if (!isRetryable || attempt >= this.retryPolicy.maxRetries) {
          this.logger.warn(
            `[${this.key}] 执行失败，不再重试 (错误码: ${errorCode}, 可重试: ${isRetryable})`,
            { taskId: context.taskId }
          );
          return result;
        }

        lastError = result.error;
        this.logger.warn(
          `[${this.key}] 执行失败，准备重试 (尝试 ${attempt + 1}/${this.retryPolicy.maxRetries + 1})`,
          { taskId: context.taskId, error: errorCode }
        );
      } catch (error: any) {
        // 捕获doExecute抛出的异常
        lastError = error;

        // 检查是否被中止（超时）
        if (context.signal?.aborted) {
          throw error;
        }

        const isRetryable = this.isRetryableError(
          error.code || ProviderErrorCode.ERR_PROVIDER_EXECUTION_FAILED
        );

        // 艹，如果不可重试，直接throw
        if (!isRetryable) {
          throw error;
        }

        // 如果已经达到最大重试次数，不throw，让循环结束后返回MAX_RETRIES_EXCEEDED
        if (attempt >= this.retryPolicy.maxRetries) {
          this.logger.warn(
            `[${this.key}] 执行异常，已达最大重试次数 (尝试 ${attempt + 1}/${this.retryPolicy.maxRetries + 1})`,
            { taskId: context.taskId, error: error.message }
          );
          // 不throw，让程序继续，最后会走到循环后面返回MAX_RETRIES_EXCEEDED
        } else {
          this.logger.warn(
            `[${this.key}] 执行异常，准备重试 (尝试 ${attempt + 1}/${this.retryPolicy.maxRetries + 1})`,
            { taskId: context.taskId, error: error.message }
          );
        }
      }

      // 计算延迟时间（指数退避）
      attempt++;
      if (attempt <= this.retryPolicy.maxRetries) {
        const delay = this.calculateBackoffDelay(attempt);
        this.logger.debug(`[${this.key}] 等待 ${delay}ms 后重试`, {
          taskId: context.taskId,
        });

        // 等待一段时间后重试，同时检查是否被中止
        try {
          await this.sleep(delay, context.signal);
        } catch (sleepError: any) {
          // sleep被中止，直接抛出
          if (sleepError.name === 'AbortError' || context.signal?.aborted) {
            throw sleepError;
          }
          throw sleepError;
        }
      }
    }

    // 重试次数耗尽
    this.logger.error(`[${this.key}] 重试次数耗尽`, {
      taskId: context.taskId,
      maxRetries: this.retryPolicy.maxRetries,
    });

    // 艹，重试次数耗尽了，返回MAX_RETRIES_EXCEEDED错误结果
    return {
      success: false,
      error: {
        code: ProviderErrorCode.ERR_PROVIDER_MAX_RETRIES_EXCEEDED,
        message: `重试次数耗尽（${this.retryPolicy.maxRetries}次）`,
        details: { lastError },
      },
    };
  }

  /**
   * 实际执行逻辑（子类必须实现）
   * 这个tm的方法才是真正干活的地方！
   * @param context - 执行上下文
   * @returns Promise<ExecResult> - 执行结果
   */
  protected abstract doExecute(context: ExecContext): Promise<ExecResult>;

  /**
   * 健康检查（子类可选实现）
   * @returns Promise<boolean> - true表示健康，false表示不可用
   */
  public async healthCheck(): Promise<boolean> {
    // 默认实现：假设总是健康
    // 子类可以重写这个方法，实现真正的健康检查
    return true;
  }

  /**
   * 判断错误是否可重试
   * @param errorCode - 错误码
   * @returns boolean - true表示可重试
   */
  protected isRetryableError(errorCode: string): boolean {
    // 如果retryableErrors为空，则所有错误都可重试
    if (
      !this.retryPolicy.retryableErrors ||
      this.retryPolicy.retryableErrors.length === 0
    ) {
      // 但超时和参数校验错误不应该重试
      const nonRetryableErrors = [
        ProviderErrorCode.ERR_PROVIDER_TIMEOUT,
        ProviderErrorCode.ERR_PROVIDER_VALIDATION_FAILED,
      ];
      return !nonRetryableErrors.includes(errorCode as ProviderErrorCode);
    }

    // 否则检查错误码是否在可重试列表中
    return this.retryPolicy.retryableErrors.includes(errorCode);
  }

  /**
   * 计算指数退避延迟时间
   * @param attempt - 当前重试次数（从1开始）
   * @returns number - 延迟时间（毫秒）
   */
  protected calculateBackoffDelay(attempt: number): number {
    const delay =
      this.retryPolicy.initialDelay *
      Math.pow(this.retryPolicy.backoffMultiplier, attempt - 1);
    return Math.min(delay, this.retryPolicy.maxDelay);
  }

  /**
   * 可中断的sleep
   * @param ms - 延迟时间（毫秒）
   * @param signal - AbortSignal，用于取消等待
   */
  protected sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        resolve();
      }, ms);

      // 监听中止信号
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          const error = new Error('执行被中止');
          error.name = 'AbortError'; // 艹，这个name很重要！
          reject(error);
        });
      }
    });
  }
}
