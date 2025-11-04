/**
 * 业务埋点使用示例
 * 艹，这个文件展示了如何在各个业务流程中正确使用埋点！
 *
 * @author 老王
 */

import { businessMetrics } from './metrics';

// ==================== 聊天功能埋点示例 ====================

/**
 * 聊天开始埋点
 */
export function trackChatStart(messageType: 'text' | 'image' | 'file', messageLength?: number) {
  businessMetrics.trackEvent({
    eventName: 'chat_start',
    category: 'chat',
    action: 'start',
    properties: {
      messageType,
      messageLength
    }
  });
}

/**
 * 聊天成功埋点
 */
export function trackChatSuccess(
  messageType: 'text' | 'image' | 'file',
  responseTime: number,
  model?: string,
  tokens?: { input: number; output: number },
  messageLength?: number
) {
  businessMetrics.trackChat({
    eventName: 'chat_success',
    action: 'success',
    properties: {
      messageType,
      responseTime,
      model,
      messageLength,
      tokens: tokens || { input: 0, output: 0 }
    }
  });
}

/**
 * 聊天失败埋点
 */
export function trackChatError(
  messageType: 'text' | 'image' | 'file',
  errorMessage: string,
  errorStack?: string
) {
  businessMetrics.trackEvent({
    eventName: 'chat_error',
    category: 'chat',
    action: 'error',
    properties: {
      messageType,
      errorType: 'api_error'
    },
    error: {
      message: errorMessage,
      stack: errorStack
    }
  });
}

// ==================== 上传功能埋点示例 ====================

/**
 * 上传开始埋点
 */
export function trackUploadStart(
  fileType: 'image' | 'document' | 'video' | 'other',
  fileSize: number,
  uploadType: 'kb' | 'avatar' | 'chat' | 'other'
) {
  businessMetrics.trackUpload({
    eventName: 'upload_start',
    action: 'start',
    properties: {
      fileType,
      fileSize,
      uploadType,
      chunkCount: Math.ceil(fileSize / (1024 * 1024)), // 1MB chunks
      retryCount: 0
    }
  });
}

/**
 * 上传成功埋点
 */
export function trackUploadSuccess(
  fileType: 'image' | 'document' | 'video' | 'other',
  fileSize: number,
  uploadType: 'kb' | 'avatar' | 'chat' | 'other',
  processingTime: number,
  retryCount = 0
) {
  businessMetrics.trackUpload({
    eventName: 'upload_success',
    action: 'success',
    duration: processingTime,
    properties: {
      fileType,
      fileSize,
      uploadType,
      chunkCount: Math.ceil(fileSize / (1024 * 1024)),
      retryCount
    }
  });
}

/**
 * 上传失败埋点
 */
export function trackUploadError(
  fileType: 'image' | 'document' | 'video' | 'other',
  fileSize: number,
  uploadType: 'kb' | 'avatar' | 'chat' | 'other',
  errorMessage: string,
  retryCount = 0
) {
  businessMetrics.trackUpload({
    eventName: 'upload_error',
    action: 'failure',
    properties: {
      fileType,
      fileSize,
      uploadType,
      chunkCount: Math.ceil(fileSize / (1024 * 1024)),
      retryCount,
      errorType: 'upload_failed'
    },
    error: {
      message: errorMessage
    }
  });
}

// ==================== 商拍功能埋点示例 ====================

/**
 * 商拍任务开始埋点
 */
export function trackCommerceTaskStart(
  toolType: 'product-shoot' | 'background-remove' | 'recolor' | 'other',
  parameterCount: number,
  imageCount: number
) {
  businessMetrics.trackCommerce({
    eventName: 'commerce_task_start',
    action: 'start',
    properties: {
      toolType,
      parameterCount,
      imageCount,
      processingTime: 0
    }
  });
}

/**
 * 商拍任务完成埋点
 */
export function trackCommerceTaskComplete(
  toolType: 'product-shoot' | 'background-remove' | 'recolor' | 'other',
  parameterCount: number,
  imageCount: number,
  processingTime: number,
  outputFormat?: string
) {
  businessMetrics.trackCommerce({
    eventName: 'commerce_task_complete',
    action: 'success',
    duration: processingTime,
    properties: {
      toolType,
      parameterCount,
      imageCount,
      processingTime,
      outputFormat
    }
  });
}

/**
 * 商拍任务失败埋点
 */
export function trackCommerceTaskError(
  toolType: 'product-shoot' | 'background-remove' | 'recolor' | 'other',
  parameterCount: number,
  imageCount: number,
  errorMessage: string,
  processingTime?: number
) {
  businessMetrics.trackCommerce({
    eventName: 'commerce_task_error',
    action: 'failure',
    duration: processingTime,
    properties: {
      toolType,
      parameterCount,
      imageCount,
      processingTime: processingTime || 0,
      errorType: 'processing_failed'
    },
    error: {
      message: errorMessage
    }
  });
}

// ==================== 工具使用埋点示例 ====================

/**
 * 工具操作开始埋点
 */
export function trackToolOperationStart(
  toolName: string,
  operation: string,
  parameters: Record<string, any>
) {
  businessMetrics.trackTool({
    eventName: 'tool_operation_start',
    action: 'start',
    properties: {
      toolName,
      operation,
      parameters,
      resultCount: 0,
      processingTime: 0
    }
  });
}

/**
 * 工具操作成功埋点
 */
export function trackToolOperationSuccess(
  toolName: string,
  operation: string,
  parameters: Record<string, any>,
  resultCount?: number,
  processingTime?: number
) {
  businessMetrics.trackTool({
    eventName: 'tool_operation_success',
    action: 'success',
    duration: processingTime,
    properties: {
      toolName,
      operation,
      parameters,
      resultCount: resultCount || 0,
      processingTime: processingTime || 0
    }
  });
}

/**
 * 工具操作失败埋点
 */
export function trackToolOperationError(
  toolName: string,
  operation: string,
  parameters: Record<string, any>,
  errorMessage: string,
  processingTime?: number
) {
  businessMetrics.trackTool({
    eventName: 'tool_operation_error',
    action: 'failure',
    duration: processingTime,
    properties: {
      toolName,
      operation,
      parameters,
      resultCount: 0,
      processingTime: processingTime || 0,
      errorType: 'operation_failed'
    },
    error: {
      message: errorMessage
    }
  });
}

// ==================== 实际使用示例 ====================

/**
 * 聊天功能完整使用示例
 */
export async function exampleChatFunction(userMessage: string) {
  const startTime = Date.now();
  const messageType = userMessage.length > 100 ? 'text' : 'text'; // 简化判断

  try {
    // 1. 记录聊天开始
    trackChatStart(messageType, userMessage.length);

    // 2. 模拟API调用
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: userMessage })
    });

    const data = await response.json();
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      // 3. 记录聊天成功
      trackChatSuccess(
        messageType,
        responseTime,
        data.model,
        data.tokens,
        data.response?.length
      );
      return data;
    } else {
      // 4. 记录聊天失败
      throw new Error(data.error || 'Unknown error');
    }

  } catch (error: any) {
    // 5. 记录聊天错误
    trackChatError(messageType, error.message, error.stack);
    throw error;
  }
}

/**
 * 文件上传完整使用示例
 */
export async function exampleFileUpload(file: File, uploadType: 'kb' | 'avatar' | 'chat' | 'other') {
  const startTime = Date.now();

  // 判断文件类型
  const fileType = file.type.startsWith('image/') ? 'image' :
                  file.type.startsWith('video/') ? 'video' :
                  file.type.includes('document') ? 'document' : 'other';

  try {
    // 1. 记录上传开始
    trackUploadStart(fileType, file.size, uploadType);

    // 2. 模拟上传过程
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', uploadType);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    const processingTime = Date.now() - startTime;

    if (response.ok) {
      // 3. 记录上传成功
      trackUploadSuccess(fileType, file.size, uploadType, processingTime);
      return await response.json();
    } else {
      // 4. 记录上传失败
      const errorData = await response.json();
      throw new Error(errorData.error || 'Upload failed');
    }

  } catch (error: any) {
    // 5. 记录上传错误
    trackUploadError(fileType, file.size, uploadType, error.message);
    throw error;
  }
}

/**
 * 商拍工具完整使用示例
 */
export async function exampleCommerceShooting(params: {
  toolType: 'product-shoot' | 'background-remove' | 'recolor';
  images: File[];
  settings: Record<string, any>;
}) {
  const startTime = Date.now();
  const { toolType, images, settings } = params;

  try {
    // 1. 记录任务开始
    trackCommerceTaskStart(toolType, Object.keys(settings).length, images.length);

    // 2. 模拟处理过程
    const response = await fetch('/api/commerce/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolType,
        imageCount: images.length,
        settings
      })
    });

    const processingTime = Date.now() - startTime;

    if (response.ok) {
      // 3. 记录任务成功
      trackCommerceTaskComplete(
        toolType,
        Object.keys(settings).length,
        images.length,
        processingTime,
        'png' // 假设输出格式
      );
      return await response.json();
    } else {
      // 4. 记录任务失败
      const errorData = await response.json();
      throw new Error(errorData.error || 'Processing failed');
    }

  } catch (error: any) {
    // 5. 记录任务错误
    trackCommerceTaskError(
      toolType,
      Object.keys(settings).length,
      images.length,
      error.message,
      Date.now() - startTime
    );
    throw error;
  }
}

// ==================== 业务埋点配置 ====================

/**
 * 初始化业务埋点（在应用启动时调用）
 */
export function initializeBusinessTracking(userId?: string) {
  // 设置用户ID
  if (userId) {
    businessMetrics.setUserId(userId);
  }

  // 记录应用启动
  businessMetrics.trackEvent({
    eventName: 'app_start',
    category: 'system',
    action: 'start',
    properties: {
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
      url: typeof window !== 'undefined' ? window.location.href : 'server',
      timestamp: Date.now()
    }
  });

  // 监听页面卸载
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      businessMetrics.trackEvent({
        eventName: 'app_end',
        category: 'system',
        action: 'complete',
        properties: {
          sessionDuration: Date.now() - (window as any).__appStartTime
        }
      });
    });

    // 记录应用启动时间
    (window as any).__appStartTime = Date.now();
  }
}

/**
 * 设置用户信息（用户登录后调用）
 */
export function setBusinessTrackingUser(userId: string, userName?: string) {
  businessMetrics.setUserId(userId);

  businessMetrics.trackEvent({
    eventName: 'user_login',
    category: 'system',
    action: 'success',
    properties: {
      userId,
      userName
    }
  });
}