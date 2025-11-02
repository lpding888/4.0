/**
 * COS 上传器
 * 负责将处理后的文件上传到腾讯云对象存储
 */

const COS = require('cos-nodejs-sdk-v5');
const fs = require('fs');
const path = require('path');
const logger = require('../../common/logger');

/**
 * 创建 COS 客户端
 * @param {Object} config - COS 配置
 * @returns {Object} COS 客户端实例
 */
function createClient(config) {
  return new COS({
    SecretId: config.secretId,
    SecretKey: config.secretKey
  });
}

/**
 * 上传文件到 COS
 * @param {string} localPath - 本地文件路径
 * @param {Object} options - 上传选项
 * @param {string} options.bucket - COS 桶名
 * @param {string} options.region - COS 地域
 * @param {string} options.path - COS 中的文件路径
 * @param {string} options.contentType - 文件类型
 * @param {Object} cosConfig - COS 配置
 * @returns {Promise<string>} 上传后的文件URL
 */
async function upload(localPath, options, cosConfig) {
  const { bucket, region, path: cosPath, contentType } = options;

  try {
    logger.info('开始上传文件到COS', { localPath, cosPath });

    const cos = createClient(cosConfig);

    // 读取文件
    const fileContent = fs.readFileSync(localPath);

    // 上传到 COS
    const result = await new Promise((resolve, reject) => {
      cos.putObject({
        Bucket: bucket,
        Region: region,
        Key: cosPath,
        Body: fileContent,
        ContentType: contentType || 'application/octet-stream'
      }, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });

    // 构建文件URL（COS标准格式）
    const fileUrl = `https://${bucket}.cos.${region}.myqcloud.com/${cosPath}`;

    logger.info('文件上传成功', {
      localPath,
      cosPath,
      fileUrl,
      etag: result.ETag
    });

    return fileUrl;

  } catch (error) {
    logger.error('文件上传失败', {
      localPath,
      cosPath,
      error: error.message
    });
    throw new Error(`COS上传失败: ${error.message}`);
  }
}

module.exports = { upload };
