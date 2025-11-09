/**
 * COSBatchUploader - 纯前端降级实现
 * 艹！这玩意儿至少得有个壳子，workspace/editor 才不会直接挂。
 *
 * 真正的腾讯云直传逻辑以后再补，这里先提供一个可用的本地占位上传，
 * 确保调用方拿到可预览的 URL，后续只需要在 requestUpload 里换成真实 COS 流程即可。
 */

export interface UploadResult {
  fileName: string;
  url: string;
  size: number;
  mimeType: string;
  isMock: boolean;
}

export interface COSBatchUploaderOptions {
  uploadEndpoint?: string;
}

export class COSBatchUploader {
  constructor(private readonly options: COSBatchUploaderOptions = {}) {}

  /**
   * 上传单个文件
   */
  async uploadFile(file: File): Promise<UploadResult> {
    try {
      if (this.options.uploadEndpoint) {
        const result = await this.requestUpload(file);
        if (result) {
          return result;
        }
      }
    } catch (error) {
      console.warn('[COSBatchUploader] 真实上传失败，改用本地占位', error);
    }

    // 本地 fallback：返回可预览的 blob url，保证后续流程不中断
    const url = URL.createObjectURL(file);
    return {
      fileName: file.name,
      url,
      size: file.size,
      mimeType: file.type,
      isMock: true,
    };
  }

  /**
   * 批量上传
   */
  async uploadFiles(files: File[]): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    for (const file of files) {
      // 顺序执行，避免占位实现里资源泄漏
      // 真正接入 COS 后可以改成 Promise.all
      // eslint-disable-next-line no-await-in-loop
      const result = await this.uploadFile(file);
      results.push(result);
    }
    return results;
  }

  /**
   * 真实上传逻辑占位
   * TODO: 接入后端的 STS / 临时密钥，再把文件推到 COS
   */
  private async requestUpload(file: File): Promise<UploadResult | null> {
    if (!this.options.uploadEndpoint) {
      return null;
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(this.options.uploadEndpoint, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`上传失败: ${response.status}`);
    }

    const data = await response.json();
    if (!data?.url) {
      return null;
    }

    return {
      fileName: file.name,
      url: data.url,
      size: file.size,
      mimeType: file.type,
      isMock: false,
    };
  }
}

export default COSBatchUploader;
