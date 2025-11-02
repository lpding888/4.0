/**
 * ScfProvider - 腾讯云云函数（SCF）Provider
 *
 * 职责：
 * - 支持同步/异步调用腾讯云SCF
 * - 支持传递自定义事件参数
 * - 严格的参数校验（auth、functionName、payload、invokeType）
 * - 统一的错误处理和日志
 *
 * 艹，这个Provider遵循最小权限、幂等、重试+死信、可观测四大基线！
 */

import { BaseProvider } from '../base/base-provider';
import {
  ExecContext,
  ExecResult,
  ProviderErrorCode,
} from '../types';

// 导入腾讯云SCF SDK
const tencentcloud = require('tencentcloud-sdk-nodejs');
const ScfClient = tencentcloud.scf.v20180416.Client;

/**
 * SCF认证配置接口
 */
export interface ScfAuth {
  /** 腾讯云SecretId */
  secretId: string;

  /** 腾讯云SecretKey */
  secretKey: string;

  /** 临时密钥Token（可选，使用临时密钥时必填） */
  token?: string;

  /** 地域（如 ap-guangzhou、ap-shanghai） */
  region: string;
}

/**
 * SCF调用参数接口
 */
export interface ScfParams {
  /** 函数名称（必填） */
  functionName: string;

  /** 函数命名空间（可选，默认default） */
  namespace?: string;

  /** 函数版本/别名（可选，默认$LATEST） */
  qualifier?: string;

  /** 调用类型（必填：sync=同步、async=异步） */
  invokeType: 'sync' | 'async';

  /** 事件参数（必填，传递给云函数的数据） */
  payload: any;

  /** 日志类型（可选：None=不返回日志、Tail=返回日志） */
  logType?: 'None' | 'Tail';
}

/**
 * SCF Provider输入格式
 */
export interface ScfInput {
  /** 认证配置 */
  auth: ScfAuth;

  /** 调用参数 */
  params: ScfParams;
}

/**
 * ScfProvider实现
 * 继承BaseProvider，自动获得重试、超时控制、日志等能力
 *
 * 乖乖，这个Provider严格遵循SOLID原则和SCF Worker规范！
 */
export class ScfProvider extends BaseProvider {
  public readonly key = 'scf';
  public readonly name = 'Tencent Cloud SCF Provider';

  /**
   * 参数校验
   * 艹，这个方法必须严格校验所有参数！
   * @param input - 输入数据
   * @returns 校验错误信息，null表示校验通过
   */
  public validate(input: any): string | null {
    if (!input || typeof input !== 'object') {
      return '输入参数必须是对象';
    }

    const { auth, params } = input as ScfInput;

    // 校验auth配置
    if (!auth) {
      return '缺少必填字段: auth';
    }

    if (!auth.secretId || typeof auth.secretId !== 'string') {
      return '缺少或无效的auth.secretId';
    }

    if (!auth.secretKey || typeof auth.secretKey !== 'string') {
      return '缺少或无效的auth.secretKey';
    }

    if (!auth.region || typeof auth.region !== 'string') {
      return '缺少或无效的auth.region';
    }

    // 校验region格式（如 ap-guangzhou）
    const regionPattern = /^[a-z]+-[a-z]+(-\d+)?$/;
    if (!regionPattern.test(auth.region)) {
      return `region格式无效: ${auth.region}，应为 ap-guangzhou、ap-shanghai 等格式`;
    }

    // 校验params配置
    if (!params) {
      return '缺少必填字段: params';
    }

    if (!params.functionName || typeof params.functionName !== 'string') {
      return '缺少或无效的params.functionName';
    }

    if (!params.invokeType) {
      return '缺少必填字段: params.invokeType';
    }

    // 校验invokeType
    if (!['sync', 'async'].includes(params.invokeType)) {
      return `invokeType无效: ${params.invokeType}，必须为 sync 或 async`;
    }

    // 校验payload（必须存在，可以是任意类型）
    if (params.payload === undefined) {
      return '缺少必填字段: params.payload';
    }

    // 校验logType（可选）
    if (params.logType && !['None', 'Tail'].includes(params.logType)) {
      return `logType无效: ${params.logType}，必须为 None 或 Tail`;
    }

    return null;
  }

  /**
   * 执行SCF调用
   * 艹，这个方法才是真正干活的地方！
   * @param context - 执行上下文
   * @returns Promise<ExecResult> - 执行结果
   */
  protected async doExecute(context: ExecContext): Promise<ExecResult> {
    const input = context.input as ScfInput;
    const { auth, params } = input;

    try {
      this.logger.info(`[${this.key}] 准备调用SCF`, {
        taskId: context.taskId,
        functionName: params.functionName,
        namespace: params.namespace || 'default',
        invokeType: params.invokeType,
      });

      // 1. 初始化SCF客户端
      const client = new ScfClient({
        credential: {
          secretId: auth.secretId,
          secretKey: auth.secretKey,
          token: auth.token, // 临时密钥Token（可选）
        },
        region: auth.region,
        profile: {
          httpProfile: {
            endpoint: 'scf.tencentcloudapi.com',
          },
        },
      });

      // 2. 构建调用参数
      const invokeParams: any = {
        FunctionName: params.functionName,
        Namespace: params.namespace || 'default',
        Qualifier: params.qualifier || '$LATEST',
        // 艹，invokeType需要转换成腾讯云的枚举值
        InvocationType: params.invokeType === 'sync' ? 'RequestResponse' : 'Event',
        LogType: params.logType || 'None',
        // 艹，payload需要转成JSON字符串（如果不是字符串的话）
        ClientContext: typeof params.payload === 'string'
          ? params.payload
          : JSON.stringify(params.payload),
      };

      this.logger.debug(`[${this.key}] SCF调用参数`, {
        taskId: context.taskId,
        invokeParams: {
          ...invokeParams,
          ClientContext: `${invokeParams.ClientContext.substring(0, 100)}...`, // 只打印前100字符
        },
      });

      // 3. 执行云函数调用
      const startTime = Date.now();
      const response = await client.Invoke(invokeParams);
      const duration = Date.now() - startTime;

      this.logger.info(`[${this.key}] SCF调用成功`, {
        taskId: context.taskId,
        functionName: params.functionName,
        duration,
        requestId: response.RequestId,
      });

      // 4. 解析响应结果
      const result = this.parseScfResponse(response, params.invokeType);

      // 5. 返回成功结果
      return {
        success: true,
        data: {
          invokeType: params.invokeType,
          functionName: params.functionName,
          namespace: params.namespace || 'default',
          qualifier: params.qualifier || '$LATEST',
          requestId: response.RequestId,
          result: result,
          duration,
          // 可选：返回日志（仅当logType=Tail时）
          log: response.Log ? Buffer.from(response.Log, 'base64').toString('utf-8') : undefined,
        },
      };
    } catch (error: any) {
      // 艹，SCF调用失败了！
      this.logger.error(`[${this.key}] SCF调用失败`, {
        taskId: context.taskId,
        functionName: params.functionName,
        error: error.message,
        code: error.code,
      });

      // 处理腾讯云API错误
      return this.handleScfError(error, context.taskId, params.functionName);
    }
  }

  /**
   * 解析SCF响应结果
   * @param response - SCF API响应
   * @param invokeType - 调用类型
   * @returns 解析后的结果
   */
  private parseScfResponse(response: any, invokeType: 'sync' | 'async'): any {
    // 异步调用没有返回结果
    if (invokeType === 'async') {
      return {
        message: '异步调用已提交',
        requestId: response.RequestId,
      };
    }

    // 同步调用需要解析Result字段
    if (!response.Result) {
      return null;
    }

    try {
      // 艹，Result是JSON字符串，需要解析
      const resultStr = response.Result.FunctionRequestId
        ? response.Result.RetMsg // 老版本API
        : response.Result; // 新版本API

      // 如果Result是对象，直接返回
      if (typeof resultStr === 'object') {
        return resultStr;
      }

      // 尝试解析JSON
      return JSON.parse(resultStr);
    } catch (error) {
      // 解析失败，返回原始字符串
      this.logger.warn(`[${this.key}] 无法解析SCF返回结果为JSON`, {
        result: response.Result,
      });
      return response.Result;
    }
  }

  /**
   * 处理SCF错误（归一化错误码）
   * @param error - 错误对象
   * @param taskId - 任务ID
   * @param functionName - 函数名称
   * @returns ExecResult - 执行结果
   */
  private handleScfError(error: any, taskId: string, functionName: string): ExecResult {
    let errorCode = ProviderErrorCode.ERR_PROVIDER_EXECUTION_FAILED;
    let message = `SCF调用失败: ${error.message}`;
    const details: any = {
      taskId,
      functionName,
      originalCode: error.code,
      originalMessage: error.message,
    };

    // 艹，根据腾讯云错误码归一化
    if (error.code) {
      switch (error.code) {
        // 认证/权限错误
        case 'AuthFailure.SecretIdNotFound':
        case 'AuthFailure.SignatureFailure':
        case 'AuthFailure.TokenFailure':
        case 'AuthFailure.InvalidSecretId':
          message = `认证失败: ${error.message}`;
          details.category = 'auth';
          break;

        case 'UnauthorizedOperation':
        case 'UnauthorizedOperation.Role':
          message = `权限不足: ${error.message}`;
          details.category = 'permission';
          break;

        // 参数错误
        case 'InvalidParameterValue':
        case 'InvalidParameter':
        case 'MissingParameter':
          errorCode = ProviderErrorCode.ERR_PROVIDER_VALIDATION_FAILED;
          message = `参数错误: ${error.message}`;
          details.category = 'parameter';
          break;

        // 资源不存在
        case 'ResourceNotFound.Function':
        case 'ResourceNotFound.FunctionName':
        case 'ResourceNotFound.Namespace':
          message = `资源不存在: ${error.message}`;
          details.category = 'not_found';
          break;

        // 限流/配额
        case 'LimitExceeded':
        case 'RequestLimitExceeded':
        case 'ResourceInUse.FunctionName':
          message = `配额限制: ${error.message}`;
          details.category = 'quota';
          break;

        // 超时
        case 'ResourceUnavailable.FunctionInsufficientBalance':
          errorCode = ProviderErrorCode.ERR_PROVIDER_TIMEOUT;
          message = `函数执行超时: ${error.message}`;
          details.category = 'timeout';
          break;

        // 内部错误（可重试）
        case 'InternalError':
        case 'InternalError.System':
          message = `内部错误: ${error.message}`;
          details.category = 'internal';
          details.retryable = true;
          break;

        default:
          message = `SCF调用失败: ${error.message} (${error.code})`;
          details.category = 'unknown';
          break;
      }
    }

    // 记录详细错误
    this.logger.error(`[${this.key}] SCF错误详情`, {
      ...details,
      stack: error.stack,
    });

    return {
      success: false,
      error: {
        code: errorCode,
        message,
        details,
      },
    };
  }

  /**
   * 健康检查（可选）
   * 艹，这里可以调用一个测试函数检查SCF是否可达
   * @returns Promise<boolean> - true表示健康
   */
  public async healthCheck(): Promise<boolean> {
    // TODO: 实现真正的健康检查（可选）
    // 例如：调用一个预设的健康检查函数
    return true;
  }
}

// 导出默认实例（兼容ProviderLoader）
export default ScfProvider;
