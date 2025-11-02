/**
 * Tencent Cloud COS Service
 * 艹，腾讯云对象存储服务！
 * 支持：
 * 1. 生成临时上传签名（前端直接上传，推荐）
 * 2. 后端直接上传文件
 */

import COS from 'cos-nodejs-sdk-v5';

/**
 * COS配置
 * 艹，从环境变量读取！
 */
const cosConfig = {
  SecretId: process.env.COS_SECRET_ID || '',
  SecretKey: process.env.COS_SECRET_KEY || '',
  Bucket: process.env.COS_BUCKET || '',
  Region: process.env.COS_REGION || 'ap-guangzhou',
};

// 验证配置
function validateConfig() {
  if (!cosConfig.SecretId || !cosConfig.SecretKey || !cosConfig.Bucket) {
    console.warn('[COS] 警告：COS配置未完整设置，相关功能将不可用');
    console.warn('[COS] 需要设置：COS_SECRET_ID, COS_SECRET_KEY, COS_BUCKET');
    return false;
  }
  return true;
}

const isConfigured = validateConfig();

/**
 * 创建COS客户端
 */
const cos = isConfigured
  ? new COS({
      SecretId: cosConfig.SecretId,
      SecretKey: cosConfig.SecretKey,
    })
  : null;

/**
 * 生成预签名上传URL（推荐方式）
 * 前端拿到URL后直接PUT上传到COS，无需经过后端
 */
export async function getUploadSignedUrl(options: {
  key: string; // 对象键（文件路径）
  expiresInSeconds?: number; // 签名有效期（秒），默认30分钟
}): Promise<string> {
  if (!cos) {
    throw new Error('COS未配置，无法生成上传URL');
  }

  const { key, expiresInSeconds = 1800 } = options;

  return new Promise((resolve, reject) => {
    cos.getObjectUrl(
      {
        Bucket: cosConfig.Bucket,
        Region: cosConfig.Region,
        Key: key,
        Method: 'PUT',
        Expires: expiresInSeconds,
        Sign: true,
      },
      (err, data) => {
        if (err) {
          console.error('[COS] 生成预签名URL失败:', err.message);
          reject(new Error(`生成预签名URL失败: ${err.message}`));
          return;
        }

        console.log(`[COS] 生成预签名URL: ${key}, 有效期: ${expiresInSeconds}秒`);
        resolve(data.Url);
      }
    );
  });
}

/**
 * 生成完整的上传信息
 * 包含预签名URL、Bucket、Region等，方便前端直接上传
 */
export async function getUploadCredentials(options: {
  key: string;
  expiresInSeconds?: number;
}): Promise<{
  uploadUrl: string;
  bucket: string;
  region: string;
  key: string;
}> {
  if (!cos) {
    throw new Error('COS未配置，无法生成上传凭证');
  }

  const uploadUrl = await getUploadSignedUrl(options);

  return {
    uploadUrl,
    bucket: cosConfig.Bucket,
    region: cosConfig.Region,
    key: options.key,
  };
}

/**
 * 后端直接上传文件到COS
 * 适用于小文件或需要后端处理的场景
 */
export async function uploadFile(options: {
  key: string; // 对象键（文件路径）
  body: Buffer | string; // 文件内容
  contentType?: string; // 文件MIME类型
}): Promise<string> {
  if (!cos) {
    throw new Error('COS未配置，无法上传文件');
  }

  const { key, body, contentType } = options;

  return new Promise((resolve, reject) => {
    cos.putObject(
      {
        Bucket: cosConfig.Bucket,
        Region: cosConfig.Region,
        Key: key,
        Body: body,
        ContentType: contentType,
      },
      (err, data) => {
        if (err) {
          console.error('[COS] 上传失败:', err.message);
          reject(new Error(`COS上传失败: ${err.message}`));
          return;
        }

        const url = `https://${cosConfig.Bucket}.cos.${cosConfig.Region}.myqcloud.com/${key}`;
        console.log(`[COS] 上传成功: ${url}`);
        resolve(url);
      }
    );
  });
}

/**
 * 删除COS上的文件
 */
export async function deleteFile(key: string): Promise<void> {
  if (!cos) {
    throw new Error('COS未配置，无法删除文件');
  }

  return new Promise((resolve, reject) => {
    cos.deleteObject(
      {
        Bucket: cosConfig.Bucket,
        Region: cosConfig.Region,
        Key: key,
      },
      (err) => {
        if (err) {
          console.error('[COS] 删除失败:', err.message);
          reject(new Error(`COS删除失败: ${err.message}`));
          return;
        }

        console.log(`[COS] 删除成功: ${key}`);
        resolve();
      }
    );
  });
}

/**
 * 生成安全的文件Key（路径）
 * 格式：banners/YYYYMMDD/uuid.ext
 */
export function generateBannerKey(filename: string): string {
  const ext = filename.split('.').pop() || 'jpg';
  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const uuid = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  return `banners/${timestamp}/${uuid}.${ext}`;
}

/**
 * 检查COS是否已配置
 */
export function isCOSConfigured(): boolean {
  return isConfigured;
}
