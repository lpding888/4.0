/**
 * COS STS服务 - 临时密钥生成
 * 艹，这个憨批服务负责生成腾讯云COS临时访问密钥！
 *
 * 功能：
 * - 生成临时密钥（STS Token）
 * - 限制访问权限（只读/只写/读写）
 * - 限制访问路径（prefix限制）
 * - 设置过期时间
 * - 支持前端直传
 */

import STS from 'qcloud-cos-sts';
import logger from '../utils/logger.js';

/**
 * STS权限策略
 */
interface STSPolicy {
  action: string[]; // 允许的操作
  bucket: string; // 存储桶名称
  region: string; // 地域
  prefix: string; // 路径前缀限制
}

interface STSResult {
  credentials: {
    tmpSecretId: string;
    tmpSecretKey: string;
    sessionToken: string;
  };
  expiredTime: number;
  expiration: string;
  startTime: number;
}

interface COSPolicyStatement extends Record<string, unknown> {
  version: string;
  statement: Array<{
    effect: string;
    action: string[];
    resource: string[];
  }>;
}

/**
 * STS临时密钥响应
 */
export interface STSCredentials {
  tmpSecretId: string;
  tmpSecretKey: string;
  sessionToken: string;
  expiredTime: number;
  expiration: string;
  startTime: number;
  bucket: string;
  region: string;
  prefix: string;
}

/**
 * 获取STS临时密钥选项
 */
export interface GetSTSOptions {
  action?: 'upload' | 'download' | 'all'; // 操作类型
  prefix?: string; // 路径前缀
  durationSeconds?: number; // 有效期（秒）
  bucket?: string; // 存储桶（可选，默认使用环境变量）
  region?: string; // 地域（可选，默认使用环境变量）
}

/**
 * COS STS服务类
 */
class CosSTSService {
  private readonly secretId: string;
  private readonly secretKey: string;
  private readonly bucket: string;
  private readonly region: string;
  private readonly proxy?: string;

  // STS配置
  private readonly DEFAULT_DURATION = 1800; // 默认30分钟
  private readonly MAX_DURATION = 7200; // 最大2小时
  private readonly MIN_DURATION = 900; // 最小15分钟

  constructor() {
    // 从环境变量读取配置
    this.secretId = process.env.COS_SECRET_ID || '';
    this.secretKey = process.env.COS_SECRET_KEY || '';
    this.bucket = process.env.COS_BUCKET || '';
    this.region = process.env.COS_REGION || 'ap-guangzhou';
    this.proxy = process.env.COS_PROXY;

    // 验证配置
    if (!this.secretId || !this.secretKey || !this.bucket) {
      logger.warn('[CosSTSService] COS配置不完整，STS服务可能无法正常工作');
    }
  }

  /**
   * 获取STS临时密钥
   * @param userId - 用户ID（用于审计）
   * @param options - 获取选项
   * @returns STS临时密钥
   */
  async getSTSCredentials(userId: string, options: GetSTSOptions = {}): Promise<STSCredentials> {
    try {
      const {
        action = 'upload',
        prefix = `user-${userId}/`,
        durationSeconds = this.DEFAULT_DURATION,
        bucket = this.bucket,
        region = this.region
      } = options;

      // 验证duration
      const validDuration = Math.max(
        this.MIN_DURATION,
        Math.min(durationSeconds, this.MAX_DURATION)
      );

      // 构建权限策略
      const policy = this.buildPolicy({
        action: this.getActions(action),
        bucket,
        region,
        prefix
      });

      logger.info(
        `[CosSTSService] 生成STS临时密钥: userId=${userId} ` +
          `action=${action} prefix=${prefix} duration=${validDuration}s`
      );

      // 调用STS API
      const stsResult = await new Promise<STSResult>((resolve, reject) => {
        STS.getCredential(
          {
            secretId: this.secretId,
            secretKey: this.secretKey,
            proxy: this.proxy,
            durationSeconds: validDuration,
            policy
          },
          (err: Error | null, credential: unknown) => {
            if (err) {
              reject(err);
            } else {
              resolve(credential as STSResult);
            }
          }
        );
      });

      const credentials: STSCredentials = {
        tmpSecretId: stsResult.credentials.tmpSecretId,
        tmpSecretKey: stsResult.credentials.tmpSecretKey,
        sessionToken: stsResult.credentials.sessionToken,
        expiredTime: stsResult.expiredTime,
        expiration: stsResult.expiration,
        startTime: stsResult.startTime,
        bucket,
        region,
        prefix
      };

      logger.info(
        `[CosSTSService] STS临时密钥生成成功: userId=${userId} ` +
          `expiration=${credentials.expiration}`
      );

      return credentials;
    } catch (error) {
      logger.error(`[CosSTSService] 生成STS临时密钥失败: userId=${userId}`, error);
      throw new Error(`Failed to generate STS credentials: ${error}`);
    }
  }

  /**
   * 根据操作类型获取允许的COS操作列表
   * @private
   */
  private getActions(action: string): string[] {
    const actionMap: Record<string, string[]> = {
      upload: [
        'name/cos:PutObject',
        'name/cos:InitiateMultipartUpload',
        'name/cos:UploadPart',
        'name/cos:CompleteMultipartUpload',
        'name/cos:AbortMultipartUpload'
      ],
      download: ['name/cos:GetObject', 'name/cos:HeadObject'],
      all: ['name/cos:*']
    };

    return actionMap[action] || actionMap.upload;
  }

  /**
   * 构建COS权限策略
   * @private
   */
  private buildPolicy(policy: STSPolicy): COSPolicyStatement {
    const { action, bucket, region, prefix } = policy;

    return {
      version: '2.0',
      statement: [
        {
          effect: 'allow',
          action,
          resource: [
            // 允许访问指定前缀下的所有对象
            `qcs::cos:${region}:uid/*:${bucket}/${prefix}*`
          ]
        }
      ]
    };
  }

  /**
   * 验证STS配置
   * @returns 配置是否有效
   */
  validateConfig(): boolean {
    return !!(this.secretId && this.secretKey && this.bucket);
  }

  /**
   * 健康检查
   * @returns 健康状态
   */
  async healthCheck(): Promise<{
    status: string;
    config: {
      hasSecretId: boolean;
      hasSecretKey: boolean;
      bucket: string;
      region: string;
    };
  }> {
    const configValid = this.validateConfig();

    return {
      status: configValid ? 'healthy' : 'unhealthy',
      config: {
        hasSecretId: !!this.secretId,
        hasSecretKey: !!this.secretKey,
        bucket: this.bucket,
        region: this.region
      }
    };
  }

  /**
   * 生成上传签名URL（备用方案）
   * @param key - 文件key
   * @param expires - 过期时间（秒）
   * @returns 签名URL
   */
  generateUploadUrl(key: string, expires: number = 3600): string {
    // 简化实现，实际项目中应使用COS SDK生成签名URL
    const timestamp = Math.floor(Date.now() / 1000) + expires;
    return `https://${this.bucket}.cos.${this.region}.myqcloud.com/${key}?sign=${timestamp}`;
  }

  /**
   * 生成下载签名URL（备用方案）
   * @param key - 文件key
   * @param expires - 过期时间（秒）
   * @returns 签名URL
   */
  generateDownloadUrl(key: string, expires: number = 3600): string {
    const timestamp = Math.floor(Date.now() / 1000) + expires;
    return `https://${this.bucket}.cos.${this.region}.myqcloud.com/${key}?sign=${timestamp}`;
  }
}

// 单例导出
export const cosSTSService = new CosSTSService();

export default cosSTSService;
