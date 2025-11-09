import COS from 'cos-nodejs-sdk-v5';

/**
 * COS配置接口
 * P0-005优化: 添加CDN加速和缓存控制
 */
export interface CosConfig {
  bucket: string;
  region: string;
  imageDomain?: string;
  cdnDomain?: string;      // P0-005: CDN加速域名(优先使用,降低成本)
  cosDomain?: string;      // P0-005: COS源站域名
  cacheControl: {          // P0-005: 缓存控制策略
    input: string;         // 输入图片缓存策略
    output: string;        // 输出结果缓存策略
    temp: string;          // 临时文件缓存策略
  };
}

/**
 * COS客户端实例
 * 艹！全局单例,别tm重复创建
 */
const cosClient = new COS({
  SecretId: process.env.TENCENT_SECRET_ID ?? '',
  SecretKey: process.env.TENCENT_SECRET_KEY ?? ''
});

/**
 * COS配置参数
 * P0-005优化重点:
 * - CDN加速: 优先使用CDN域名,减少COS直接访问成本
 * - 缓存控制: 根据文件类型设置合理的缓存策略
 * - 多域名支持: CDN/COS/Image三种域名,智能选择
 */
export const cosConfig: CosConfig = {
  bucket: process.env.COS_BUCKET ?? '',
  region: process.env.COS_REGION ?? '',

  // P0-005: CDN加速域名(优先使用,降低成本)
  cdnDomain: process.env.COS_CDN_DOMAIN || undefined,

  // P0-005: COS源站域名
  cosDomain:
    process.env.COS_BUCKET && process.env.COS_REGION
      ? `https://${process.env.COS_BUCKET}.cos.${process.env.COS_REGION}.myqcloud.com`
      : undefined,

  // 数据万象域名(图片处理)
  imageDomain: process.env.COS_IMAGE_DOMAIN,

  // P0-005: 缓存控制策略(减少重复请求,降低成本)
  cacheControl: {
    // 输入图片: 缓存1小时(用户上传后不会变)
    input: 'public, max-age=3600',
    // 输出结果: 缓存7天(AI处理结果固定)
    output: 'public, max-age=604800',
    // 临时文件: 不缓存
    temp: 'no-cache, no-store, must-revalidate'
  }
};

/**
 * 获取对象访问URL - P0-005核心优化方法
 * 艹！智能选择CDN/COS/Image域名,降低成本
 *
 * @param key - COS对象键
 * @param type - 类型: 'cdn'(优先) | 'cos' | 'image'
 * @returns 完整URL
 *
 * @example
 * // 优先使用CDN(成本最低)
 * getObjectUrl('uploads/user123/photo.jpg', 'cdn')
 * // 返回: https://cdn.example.com/uploads/user123/photo.jpg
 *
 * // 使用数据万象(图片处理)
 * getObjectUrl('uploads/user123/photo.jpg', 'image')
 * // 返回: https://image.example.com/uploads/user123/photo.jpg
 */
export function getObjectUrl(key: string, type: 'cdn' | 'cos' | 'image' = 'cdn'): string {
  // 优先使用CDN(成本最低,速度最快)
  if (type === 'cdn' && cosConfig.cdnDomain) {
    return `${cosConfig.cdnDomain}/${key}`;
  }

  // 使用数据万象(图片处理专用)
  if (type === 'image' && cosConfig.imageDomain) {
    return `${cosConfig.imageDomain}/${key}`;
  }

  // 默认使用COS源站域名
  if (cosConfig.cosDomain) {
    return `${cosConfig.cosDomain}/${key}`;
  }

  // 艹！所有域名都没配置,只能返回相对路径
  return `/${key}`;
}

export { cosClient };
