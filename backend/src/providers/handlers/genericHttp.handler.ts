/**
 * GenericHTTP Provider
 * 艹，这个Provider能处理99%的HTTP请求场景！
 * 支持模板变量替换、extractPath、超时重试
 */

import axios, { AxiosRequestConfig, AxiosError } from 'axios';
import { BaseProvider } from '../base/base-provider';
import {
  ExecContext,
  ExecResult,
  ProviderErrorCode,
  ProviderError,
} from '../types';
import { replaceVariables, extractValue } from '../../utils/template';

/**
 * 请求模板接口
 */
export interface HttpRequestTemplate {
  /** HTTP方法（GET/POST/PUT/DELETE/PATCH） */
  method: string;

  /** 请求URL（支持{{var}}变量替换） */
  url: string;

  /** 请求头（支持{{var}}变量替换） */
  headers?: Record<string, string>;

  /** 请求体（支持{{var}}变量替换） */
  body?: any;

  /** 查询参数（支持{{var}}变量替换） */
  params?: Record<string, string>;

  /** 从响应中提取数据的路径（JSONPath或点路径，如 result.url）*/
  extractPath?: string;

  /** 超时时间（毫秒），不传则使用默认值 */
  timeout?: number;
}

/**
 * GenericHTTP Provider输入格式
 */
export interface GenericHttpInput {
  /** 请求模板 */
  req_template: HttpRequestTemplate;

  /** 变量字典（用于替换模板中的{{var}}） */
  variables?: Record<string, any>;
}

/**
 * GenericHTTP Provider实现
 * 继承BaseProvider，自动获得重试、超时控制、日志等能力
 */
export class GenericHttpProvider extends BaseProvider {
  public readonly key = 'generic-http';
  public readonly name = 'Generic HTTP Provider';

  /**
   * 参数校验
   * @param input - 输入数据
   * @returns 校验错误信息，null表示校验通过
   */
  public validate(input: any): string | null {
    if (!input || typeof input !== 'object') {
      return '输入参数必须是对象';
    }

    const { req_template } = input as GenericHttpInput;

    if (!req_template) {
      return '缺少必填字段: req_template';
    }

    if (!req_template.method) {
      return '缺少必填字段: req_template.method';
    }

    if (!req_template.url) {
      return '缺少必填字段: req_template.url';
    }

    // 验证HTTP方法
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    const method = req_template.method.toUpperCase();
    if (!validMethods.includes(method)) {
      return `不支持的HTTP方法: ${req_template.method}`;
    }

    return null;
  }

  /**
   * 执行HTTP请求
   * @param context - 执行上下文
   * @returns Promise<ExecResult> - 执行结果
   */
  protected async doExecute(context: ExecContext): Promise<ExecResult> {
    const input = context.input as GenericHttpInput;
    const { req_template, variables = {} } = input;

    try {
      // 1. 变量替换（艹，只替换{{var}}，不执行表达式）
      const method = req_template.method.toUpperCase();
      const url = replaceVariables(req_template.url, variables) as string;
      const headers = replaceVariables(
        req_template.headers || {},
        variables
      ) as Record<string, string>;
      const params = replaceVariables(
        req_template.params || {},
        variables
      ) as Record<string, string>;

      let body = req_template.body;
      if (body) {
        body = replaceVariables(body, variables);
      }

      this.logger.debug(`[${this.key}] 准备发送HTTP请求`, {
        taskId: context.taskId,
        method,
        url,
        hasBody: !!body,
      });

      // 2. 构建axios配置
      const axiosConfig: AxiosRequestConfig = {
        method: method as any,
        url,
        headers,
        params,
        timeout: req_template.timeout || this.defaultTimeout,
      };

      // 3. 添加请求体（仅POST/PUT/PATCH）
      if (['POST', 'PUT', 'PATCH'].includes(method) && body) {
        axiosConfig.data = body;
      }

      // 4. 支持AbortSignal（用于超时取消）
      if (context.signal) {
        // 艹，Axios的CancelToken已废弃，使用AbortSignal
        axiosConfig.signal = context.signal as any;
      }

      // 5. 执行HTTP请求
      const response = await axios(axiosConfig);

      this.logger.info(`[${this.key}] HTTP请求成功`, {
        taskId: context.taskId,
        statusCode: response.status,
        url,
      });

      // 6. 提取结果数据（可选）
      let resultData = response.data;
      if (req_template.extractPath) {
        resultData = extractValue(response.data, req_template.extractPath);

        if (resultData === undefined) {
          this.logger.warn(
            `[${this.key}] extractPath未找到数据: ${req_template.extractPath}`,
            { taskId: context.taskId }
          );
        }
      }

      // 7. 返回成功结果
      return {
        success: true,
        data: {
          statusCode: response.status,
          headers: response.headers,
          body: resultData,
          fullResponse: response.data, // 保留完整响应（用于调试）
        },
      };
    } catch (error: any) {
      // 艹，HTTP请求失败了！
      this.logger.error(`[${this.key}] HTTP请求失败`, {
        taskId: context.taskId,
        error: error.message,
        url: req_template.url,
      });

      // 处理Axios错误
      if (axios.isAxiosError(error)) {
        return this.handleAxiosError(error, context.taskId);
      }

      // 处理AbortError（超时）
      if (error.name === 'AbortError' || error.name === 'CanceledError') {
        return {
          success: false,
          error: {
            code: ProviderErrorCode.ERR_PROVIDER_TIMEOUT,
            message: `HTTP请求超时: ${req_template.url}`,
            details: {
              timeout: req_template.timeout || this.defaultTimeout,
            },
          },
        };
      }

      // 其他未知错误
      return {
        success: false,
        error: {
          code: ProviderErrorCode.ERR_PROVIDER_EXECUTION_FAILED,
          message: error.message || 'HTTP请求执行失败',
          details: { stack: error.stack },
        },
      };
    }
  }

  /**
   * 处理Axios错误（归一化错误码）
   * @param error - Axios错误对象
   * @param taskId - 任务ID
   * @returns ExecResult - 执行结果
   */
  private handleAxiosError(error: AxiosError, taskId: string): ExecResult {
    const response = error.response;

    // 艹，根据HTTP状态码归一化错误信息
    if (response) {
      const statusCode = response.status;
      let errorCode = ProviderErrorCode.ERR_PROVIDER_EXECUTION_FAILED;
      let message = `HTTP请求失败 (${statusCode})`;

      // HTTP状态码归一化
      if (statusCode >= 400 && statusCode < 500) {
        // 4xx 客户端错误
        message = `客户端错误 (${statusCode}): ${this.getStatusText(statusCode)}`;
      } else if (statusCode >= 500) {
        // 5xx 服务器错误
        message = `服务器错误 (${statusCode}): ${this.getStatusText(statusCode)}`;
      }

      return {
        success: false,
        error: {
          code: errorCode,
          message,
          details: {
            statusCode,
            statusText: response.statusText,
            responseData: response.data,
            requestUrl: error.config?.url,
          },
        },
      };
    }

    // 网络错误（没有响应）
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return {
        success: false,
        error: {
          code: ProviderErrorCode.ERR_PROVIDER_TIMEOUT,
          message: '请求超时',
          details: {
            requestUrl: error.config?.url,
            timeout: error.config?.timeout,
          },
        },
      };
    }

    // 网络连接失败
    return {
      success: false,
      error: {
        code: ProviderErrorCode.ERR_PROVIDER_EXECUTION_FAILED,
        message: `网络错误: ${error.message}`,
        details: {
          requestUrl: error.config?.url,
          errorCode: error.code,
        },
      },
    };
  }

  /**
   * 获取HTTP状态码的文本描述
   * @param statusCode - HTTP状态码
   * @returns 状态描述
   */
  private getStatusText(statusCode: number): string {
    const statusTexts: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      405: 'Method Not Allowed',
      408: 'Request Timeout',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout',
    };

    return statusTexts[statusCode] || 'Unknown';
  }

  /**
   * 健康检查（可选）
   * 这里简单返回true，子类可以override实现真正的健康检查
   */
  public async healthCheck(): Promise<boolean> {
    // 乖乖，这里可以ping一个健康检查端点
    return true;
  }
}

// 导出默认实例（兼容旧代码）
export default GenericHttpProvider;
