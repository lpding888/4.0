import axios from 'axios';
import COS from 'cos-nodejs-sdk-v5';
import logger from '../utils/logger.js';
import taskService from './task.service.js';
import contentAuditService from './contentAudit.service.js';

interface PicOperations {
  is_pic_info: number;
  rules: Array<{
    fileid: string;
    rule: string;
  }>;
}

interface CosProcessResult {
  ProcessResults?: {
    Object?: unknown | unknown[];
  };
}

interface ProcessedObject {
  Location?: string;
}

interface ImageInfo {
  format?: string;
  size?: number;
  width?: number;
  height?: number;
}

interface CosCallback {
  (err: unknown, data: unknown): void;
}

interface CosProcessResultObject {
  Location?: string;
  [key: string]: unknown;
}

type CosClient = InstanceType<typeof COS>;

class ImageProcessService {
  private config = {
    bucket: process.env.COS_BUCKET,
    region: process.env.COS_REGION,
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY
  };

  private cos: CosClient;
  private useMock: boolean;

  constructor() {
    this.cos = new COS({
      SecretId: this.config.secretId,
      SecretKey: this.config.secretKey
    }) as CosClient;
    if (!this.config.bucket || !this.config.secretId || !this.config.secretKey) {
      logger.warn('[ImageProcessService] 腾讯云配置不完整，将使用Mock模式');
      this.useMock = true;
    } else {
      this.useMock = false;
      logger.info('[ImageProcessService] 腾讯云数据万象服务已初始化', {
        bucket: this.config.bucket,
        region: this.config.region
      });
    }
  }

  async processBasicClean(
    taskId: string,
    inputImageUrl: string,
    params: Record<string, unknown> = {}
  ) {
    try {
      logger.info(`[ImageProcessService] 开始处理基础修图 taskId=${taskId}`, {
        inputImageUrl,
        useMock: this.useMock
      });
      await taskService.updateStatus(taskId, 'processing', {});
      let resultUrls: string[];
      if (this.useMock) {
        resultUrls = await this.mockProcessBasicClean(taskId, inputImageUrl);
      } else {
        const picOperations = this.buildPicOperations(taskId, params);
        if (inputImageUrl.includes(String(this.config.bucket))) {
          resultUrls = await this.processCloudImage(inputImageUrl, picOperations);
        } else {
          resultUrls = await this.processExternalImage(taskId, inputImageUrl, picOperations);
        }
      }
      logger.info(`[ImageProcessService] 图片处理完成,开始内容审核 taskId=${taskId}`);
      const auditResult = await contentAuditService.auditTaskResults(taskId, resultUrls);
      if (!auditResult.pass) {
        logger.warn(`[ImageProcessService] 内容审核未通过 taskId=${taskId}`);
        throw new Error('内容审核未通过');
      }
      await taskService.updateStatus(taskId, 'success', { resultUrls });
      logger.info(`[ImageProcessService] 基础修图完成 taskId=${taskId} count=${resultUrls.length}`);
      return resultUrls;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '未知错误';
      logger.error(`[ImageProcessService] 基础修图失败: ${message}`, { taskId, error });
      await taskService.updateStatus(taskId, 'failed', {
        errorMessage: message || '图片处理失败'
      });
      throw error;
    }
  }

  buildPicOperations(taskId: string, _params: Record<string, unknown> = {}): PicOperations {
    return {
      is_pic_info: 1,
      rules: [
        { fileid: `output/${taskId}/matting.png`, rule: 'imageMogr2/cut-out' },
        {
          fileid: `output/${taskId}/white-bg.png`,
          rule: 'imageMogr2/cut-out|imageMogr2/background/color/ffffff'
        },
        {
          fileid: `output/${taskId}/enhanced.png`,
          rule: 'imageMogr2/cut-out|imageMogr2/background/color/ffffff|imageMogr2/sharpen/1|imageMogr2/bright/10'
        }
      ]
    };
  }

  async processCloudImage(imageUrl: string, picOperations: PicOperations): Promise<string[]> {
    try {
      const objectKey = this.extractObjectKeyFromUrl(imageUrl);
      if (!objectKey) throw new Error('无法从URL中提取COS对象键');
      logger.info('[ImageProcessService] 开始云上数据处理', {
        objectKey,
        rulesCount: picOperations.rules.length
      });
      const result: CosProcessResult = await new Promise((resolve, reject) => {
        const callback: CosCallback = (err: unknown, data: unknown) => {
          if (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error('[ImageProcessService] 云上数据处理失败', err);
            reject(new Error(`数据万象处理失败: ${message}`));
          } else {
            resolve(data as CosProcessResult);
          }
        };
        this.cos.processObject(
          {
            Bucket: this.config.bucket,
            Region: this.config.region,
            Key: objectKey,
            PicOperations: JSON.stringify(picOperations)
          },
          callback
        );
      });
      const outputUrls: string[] = [];
      const objects = result?.ProcessResults?.Object;
      const list = Array.isArray(objects) ? objects : objects ? [objects] : [];
      list.forEach((obj: unknown): void => {
        const processedObj = obj as ProcessedObject;
        if (processedObj.Location) {
          let url: string = processedObj.Location;
          if (url.startsWith('//')) url = 'https:' + url;
          outputUrls.push(url);
        }
      });
      if (outputUrls.length === 0) throw new Error('数据万象处理完成但未返回结果');
      return outputUrls;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('[ImageProcessService] 云上数据处理异常', { imageUrl, error: message });
      throw error;
    }
  }

  async processExternalImage(
    taskId: string,
    imageUrl: string,
    picOperations: PicOperations
  ): Promise<string[]> {
    try {
      logger.info('[ImageProcessService] 开始处理外部图片', {
        taskId,
        imageUrl,
        rulesCount: picOperations.rules.length
      });
      const imageBuffer = await this.downloadImage(imageUrl);
      const originalKey = `input/${taskId}/original.jpg`;
      await this.uploadImageToCos(originalKey, imageBuffer, imageUrl);
      const uploadedUrl = `https://${this.config.bucket}.cos.${this.config.region}.myqcloud.com/${originalKey}`;
      const resultUrls = await this.processCloudImage(uploadedUrl, picOperations);
      logger.info('[ImageProcessService] 外部图片处理完成', {
        taskId,
        originalKey,
        outputCount: resultUrls.length
      });
      return resultUrls;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('[ImageProcessService] 外部图片处理异常', {
        taskId,
        imageUrl,
        error: message
      });
      throw error;
    }
  }

  async downloadImage(url: string): Promise<Buffer> {
    try {
      logger.info('[ImageProcessService] 开始下载图片', { url });
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      const buffer = Buffer.from(response.data);
      logger.info('[ImageProcessService] 图片下载完成', {
        url,
        size: buffer.length,
        contentType: response.headers['content-type']
      });
      return buffer;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[ImageProcessService] 下载图片失败: ${message}`, { url });
      throw new Error(`下载图片失败: ${message}`);
    }
  }

  async uploadImageToCos(key: string, buffer: Buffer, originalUrl: string): Promise<void> {
    try {
      logger.info('[ImageProcessService] 开始上传图片到COS', { key, size: buffer.length });
      let contentType = 'image/jpeg';
      try {
        const head = await axios.head(originalUrl, { timeout: 5000 });
        contentType = head.headers['content-type'] || contentType;
      } catch {
        logger.warn('[ImageProcessService] 无法获取原始图片Content-Type，使用默认值');
      }
      await new Promise<void>((resolve, reject) => {
        const callback: CosCallback = (err: unknown, data: unknown) => {
          if (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error('[ImageProcessService] COS上传失败', err);
            reject(new Error(`COS上传失败: ${message}`));
          } else {
            resolve();
          }
        };
        this.cos.putObject(
          {
            Bucket: this.config.bucket,
            Region: this.config.region,
            Key: key,
            Body: buffer,
            ContentType: contentType
          },
          callback
        );
      });
      logger.info('[ImageProcessService] COS上传完成', { key });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('[ImageProcessService] COS上传异常', { key, error: message });
      throw error;
    }
  }

  async getImageInfo(imageUrl: string): Promise<ImageInfo> {
    try {
      const infoUrl = `${imageUrl}?imageInfo`;
      const response = await axios.get(infoUrl, { timeout: 10000 });
      return response.data as ImageInfo;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[ImageProcessService] 获取图片信息失败: ${message}`, { imageUrl });
      throw new Error('获取图片信息失败');
    }
  }

  async validateImage(imageUrl: string): Promise<boolean> {
    const info = await this.getImageInfo(imageUrl);
    const format = String(info.format || '').toLowerCase();
    if (!['jpg', 'jpeg', 'png'].includes(format)) throw new Error('不支持的图片格式,仅支持JPG/PNG');
    const maxSize = 10 * 1024 * 1024;
    if (typeof info.size !== 'number' || info.size > maxSize)
      throw new Error('图片大小超过10MB限制');
    if (typeof info.width !== 'number' || typeof info.height !== 'number')
      throw new Error('图片尺寸信息异常');
    if (info.width < 100 || info.height < 100) throw new Error('图片尺寸过小,最小100x100像素');
    return true;
  }

  async mockProcessBasicClean(taskId: string, _inputImageUrl: string): Promise<string[]> {
    logger.info('[ImageProcessService] Mock模式处理基础修图', { taskId });
    await new Promise((r) => setTimeout(r, 2000));
    return [
      `http://localhost:3000/mock-images/${taskId}/matting.png`,
      `http://localhost:3000/mock-images/${taskId}/white-bg.png`,
      `http://localhost:3000/mock-images/${taskId}/enhanced.png`
    ];
  }

  extractObjectKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      if (!urlObj.hostname.includes('cos.') || !urlObj.hostname.includes('myqcloud.com')) {
        logger.warn('[ImageProcessService] 非COS域名URL', { url });
        return null;
      }
      let objectKey = urlObj.pathname;
      if (objectKey.startsWith('/')) objectKey = objectKey.substring(1);
      const queryIndex = objectKey.indexOf('?');
      if (queryIndex > -1) objectKey = objectKey.substring(0, queryIndex);
      return objectKey;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('[ImageProcessService] 解析COS URL失败', { url, error: message });
      return null;
    }
  }

  async retry<T>(fn: () => Promise<T>, maxRetries = 3, delay = 1000): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: unknown) {
        if (i === maxRetries - 1) throw error;
        const message = error instanceof Error ? error.message : String(error);
        logger.warn('[ImageProcessService] 操作失败，准备重试', {
          attempt: i + 1,
          maxRetries,
          error: message
        });
        await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
      }
    }
    throw new Error('未能完成重试操作');
  }
}

export default new ImageProcessService();
