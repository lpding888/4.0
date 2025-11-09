/**
 * 业务埋点监控
 * 艹，这个模块必须收集所有关键业务指标，用于看板展示！
 *
 * @author 老王
 */

// 业务埋点事件类型
export interface BusinessEvent {
  eventName: string;
  category: 'chat' | 'upload' | 'commerce' | 'tool' | 'system';
  action: 'success' | 'failure' | 'start' | 'complete' | 'error';
  timestamp: number;
  userId?: string;
  sessionId: string;
  duration?: number; // 耗时（毫秒）
  properties?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
  };
}

// 聊天埋点事件
export interface ChatEvent extends Omit<BusinessEvent, 'category'> {
  category: 'chat';
  properties: {
    messageType: 'text' | 'image' | 'file';
    messageLength?: number;
    model?: string;
    tokens?: {
      input: number;
      output: number;
    };
    responseTime: number; // 响应时间（毫秒）
  };
}

// 上传埋点事件
export interface UploadEvent extends Omit<BusinessEvent, 'category'> {
  category: 'upload';
  properties: {
    fileType: 'image' | 'document' | 'video' | 'other';
    fileSize: number; // 字节
    uploadType: 'kb' | 'avatar' | 'chat' | 'other';
    chunkCount?: number;
    retryCount?: number;
    errorType?: string;
  };
}

// 商拍埋点事件
export interface CommerceEvent extends Omit<BusinessEvent, 'category'> {
  category: 'commerce';
  properties: {
    toolType: 'product-shoot' | 'background-remove' | 'recolor' | 'other';
    parameterCount: number;
    imageCount: number;
    processingTime: number; // 处理时间（毫秒）
    outputFormat?: string;
    errorType?: string;
  };
}

// 工具使用埋点事件
export interface ToolEvent extends Omit<BusinessEvent, 'category'> {
  category: 'tool';
  properties: {
    toolName: string;
    operation: string;
    parameters: Record<string, any>;
    resultCount?: number;
    processingTime?: number;
    errorType?: string;
  };
}

// 业务指标汇总
export interface BusinessMetrics {
  // 聊天指标
  chatMetrics: {
    totalRequests: number;
    successRate: number;
    averageResponseTime: number;
    averageTokens: {
      input: number;
      output: number;
    };
  };

  // 上传指标
  uploadMetrics: {
    totalUploads: number;
    successRate: number;
    averageFileSize: number;
    kbUploadSuccessRate: number;
  };

  // 商拍指标
  commerceMetrics: {
    totalTasks: number;
    averageProcessingTime: number;
    successRate: number;
    toolUsageStats: Record<string, number>;
  };

  // 工具失败率指标
  toolFailureMetrics: {
    totalOperations: number;
    failureRate: number;
    toolFailureStats: Record<string, {
      failures: number;
      total: number;
      rate: number;
    }>;
  };

  // 系统指标
  systemMetrics: {
    sessionCount: number;
    activeUsers: number;
    errorRate: number;
    averageSessionDuration: number;
  };
}

/**
 * 业务埋点收集器
 */
class BusinessMetricsCollector {
  private events: BusinessEvent[] = [];
  private sessionId: string;
  private userId?: string;
  private startTime: number;

  // 指标缓存
  private metricsCache: BusinessMetrics | null = null;
  private lastCacheUpdate: number = 0;
  private readonly CACHE_TTL = 60000; // 1分钟缓存

  constructor() {
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();

    // 页面卸载时上报剩余事件
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flushEvents();
      });
    }
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 设置用户ID
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * 记录聊天事件
   */
  trackChat(event: Omit<ChatEvent, 'timestamp' | 'sessionId'>): void {
    const chatEvent: ChatEvent = {
      ...event,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId
    };

    this.addEvent(chatEvent);
  }

  /**
   * 记录上传事件
   */
  trackUpload(event: Omit<UploadEvent, 'timestamp' | 'sessionId'>): void {
    const uploadEvent: UploadEvent = {
      ...event,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId
    };

    this.addEvent(uploadEvent);
  }

  /**
   * 记录商拍事件
   */
  trackCommerce(event: Omit<CommerceEvent, 'timestamp' | 'sessionId'>): void {
    const commerceEvent: CommerceEvent = {
      ...event,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId
    };

    this.addEvent(commerceEvent);
  }

  /**
   * 记录工具使用事件
   */
  trackTool(event: Omit<ToolEvent, 'timestamp' | 'sessionId'>): void {
    const toolEvent: ToolEvent = {
      ...event,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId
    };

    this.addEvent(toolEvent);
  }

  /**
   * 记录通用业务事件
   */
  trackEvent(event: Omit<BusinessEvent, 'timestamp' | 'sessionId'>): void {
    const businessEvent: BusinessEvent = {
      ...event,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId
    };

    this.addEvent(businessEvent);
  }

  /**
   * 添加事件到队列
   */
  private addEvent(event: BusinessEvent): void {
    this.events.push(event);

    // 每10个事件或重要事件立即上报
    if (this.events.length >= 10 || event.action === 'error' || event.action === 'failure') {
      this.flushEvents();
    }
  }

  /**
   * 上报事件到服务器
   */
  private async flushEvents(): Promise<void> {
    if (this.events.length === 0) return;

    const eventsToSend = [...this.events];
    this.events = [];

    try {
      // 发送到后端API
      await fetch('/api/metrics/business', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          events: eventsToSend,
          meta: {
            userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
            url: typeof window !== 'undefined' ? window.location.href : 'server',
            sessionId: this.sessionId,
            userId: this.userId,
            timestamp: Date.now()
          }
        })
      });

      // 开发环境打印日志
      if (process.env.NODE_ENV === 'development') {
        console.log(`[业务埋点] 上报 ${eventsToSend.length} 个事件:`, eventsToSend);
      }

    } catch (error) {
      console.error('[业务埋点] 上报失败:', error);
      // 上报失败时重新加入队列（最多保留100个）
      this.events = [...eventsToSend.slice(-100), ...this.events];
    }
  }

  /**
   * 计算业务指标
   */
  calculateMetrics(): BusinessMetrics {
    const now = Date.now();

    // 使用缓存
    if (this.metricsCache && (now - this.lastCacheUpdate) < this.CACHE_TTL) {
      return this.metricsCache;
    }

    // 从localStorage获取历史事件
    const allEvents = this.getHistoricalEvents();

    // 计算聊天指标
    const chatEvents = allEvents.filter(e => e.category === 'chat');
    const chatSuccessEvents = chatEvents.filter(e => e.action === 'success');
    const chatMetrics = {
      totalRequests: chatEvents.length,
      successRate: chatEvents.length > 0 ? (chatSuccessEvents.length / chatEvents.length) * 100 : 0,
      averageResponseTime: this.calculateAverage(chatEvents, e => (e as ChatEvent).properties.responseTime),
      averageTokens: {
        input: this.calculateAverage(chatSuccessEvents, e => (e as ChatEvent).properties.tokens?.input || 0),
        output: this.calculateAverage(chatSuccessEvents, e => (e as ChatEvent).properties.tokens?.output || 0)
      }
    };

    // 计算上传指标
    const uploadEvents = allEvents.filter(e => e.category === 'upload');
    const uploadSuccessEvents = uploadEvents.filter(e => e.action === 'success');
    const kbEvents = uploadEvents.filter(e => (e as UploadEvent).properties.uploadType === 'kb');
    const kbSuccessEvents = kbEvents.filter(e => e.action === 'success');
    const uploadMetrics = {
      totalUploads: uploadEvents.length,
      successRate: uploadEvents.length > 0 ? (uploadSuccessEvents.length / uploadEvents.length) * 100 : 0,
      averageFileSize: this.calculateAverage(uploadEvents, e => (e as UploadEvent).properties.fileSize),
      kbUploadSuccessRate: kbEvents.length > 0 ? (kbSuccessEvents.length / kbEvents.length) * 100 : 0
    };

    // 计算商拍指标
    const commerceEvents = allEvents.filter(e => e.category === 'commerce');
    const commerceSuccessEvents = commerceEvents.filter(e => e.action === 'success');
    const toolUsageStats: Record<string, number> = {};
    commerceEvents.forEach(e => {
      const toolType = (e as CommerceEvent).properties.toolType;
      toolUsageStats[toolType] = (toolUsageStats[toolType] || 0) + 1;
    });
    const commerceMetrics = {
      totalTasks: commerceEvents.length,
      averageProcessingTime: this.calculateAverage(commerceEvents, e => (e as CommerceEvent).properties.processingTime),
      successRate: commerceEvents.length > 0 ? (commerceSuccessEvents.length / commerceEvents.length) * 100 : 0,
      toolUsageStats
    };

    // 计算工具失败率指标
    const toolEvents = allEvents.filter(e => e.category === 'tool');
    const toolFailureEvents = toolEvents.filter(e => e.action === 'failure' || e.action === 'error');
    const toolFailureStats: Record<string, {failures: number; total: number; rate: number}> = {};

    // 按工具名称统计
    const toolGroups: Record<string, BusinessEvent[]> = {};
    toolEvents.forEach(e => {
      const toolName = (e as ToolEvent).properties.toolName;
      if (!toolGroups[toolName]) toolGroups[toolName] = [];
      toolGroups[toolName].push(e);
    });

    Object.entries(toolGroups).forEach(([toolName, events]) => {
      const failures = events.filter(e => e.action === 'failure' || e.action === 'error').length;
      toolFailureStats[toolName] = {
        failures,
        total: events.length,
        rate: events.length > 0 ? (failures / events.length) * 100 : 0
      };
    });

    const toolFailureMetrics = {
      totalOperations: toolEvents.length,
      failureRate: toolEvents.length > 0 ? (toolFailureEvents.length / toolEvents.length) * 100 : 0,
      toolFailureStats
    };

    // 计算系统指标
    const sessionEvents = allEvents.filter(e => e.sessionId === this.sessionId);
    const errorEvents = allEvents.filter(e => e.action === 'error');
    const systemMetrics = {
      sessionCount: this.getUniqueSessionCount(allEvents),
      activeUsers: this.getUniqueUserCount(allEvents),
      errorRate: allEvents.length > 0 ? (errorEvents.length / allEvents.length) * 100 : 0,
      averageSessionDuration: this.calculateAverageSessionDuration(allEvents)
    };

    const metrics: BusinessMetrics = {
      chatMetrics,
      uploadMetrics,
      commerceMetrics,
      toolFailureMetrics,
      systemMetrics
    };

    // 更新缓存
    this.metricsCache = metrics;
    this.lastCacheUpdate = now;

    return metrics;
  }

  /**
   * 获取历史事件（从localStorage）
   */
  private getHistoricalEvents(): BusinessEvent[] {
    if (typeof window === 'undefined') return [];

    try {
      const stored = localStorage.getItem('business_events');
      if (stored) {
        const events = JSON.parse(stored);
        // 只保留最近24小时的事件
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        return events.filter((e: BusinessEvent) => e.timestamp > oneDayAgo);
      }
    } catch (error) {
      console.error('[业务埋点] 读取历史事件失败:', error);
    }
    return [];
  }

  /**
   * 计算平均值
   */
  private calculateAverage(events: BusinessEvent[], getValue: (e: BusinessEvent) => number): number {
    if (events.length === 0) return 0;
    const total = events.reduce((sum, event) => sum + getValue(event), 0);
    return total / events.length;
  }

  /**
   * 获取唯一会话数
   */
  private getUniqueSessionCount(events: BusinessEvent[]): number {
    const sessions = new Set(events.map(e => e.sessionId));
    return sessions.size;
  }

  /**
   * 获取唯一用户数
   */
  private getUniqueUserCount(events: BusinessEvent[]): number {
    const users = new Set(events.map(e => e.userId).filter(Boolean));
    return users.size;
  }

  /**
   * 计算平均会话时长
   */
  private calculateAverageSessionDuration(events: BusinessEvent[]): number {
    if (events.length === 0) return 0;

    // 按会话分组
    const sessionGroups: Record<string, BusinessEvent[]> = {};
    events.forEach(e => {
      if (!sessionGroups[e.sessionId]) sessionGroups[e.sessionId] = [];
      sessionGroups[e.sessionId]!.push(e);
    });

    // 计算每个会话的时长
    const durations = Object.values(sessionGroups).map(sessionEvents => {
      const timestamps = sessionEvents.map(e => e.timestamp).sort();
      return timestamps.length > 1 ? timestamps[timestamps.length - 1]! - timestamps[0]! : 0;
    });

    return durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0;
  }

  /**
   * 获取当前会话信息
   */
  getSessionInfo() {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      startTime: this.startTime,
      duration: Date.now() - this.startTime,
      eventCount: this.events.length
    };
  }
}

// 单例实例
export const businessMetrics = new BusinessMetricsCollector();

