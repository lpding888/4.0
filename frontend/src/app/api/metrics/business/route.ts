/**
 * 业务埋点收集API
 * 艹，这个API必须接收所有业务埋点数据，还要支持看板查询！
 *
 * @author 老王
 */

import { NextRequest, NextResponse } from 'next/server';

// 内存存储（生产环境应使用数据库）
let businessEvents: any[] = [];
let metricsCache: any = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 30000; // 30秒缓存

// 请求接口
interface BusinessMetricsRequest {
  events: Array<{
    eventName: string;
    category: string;
    action: string;
    timestamp: number;
    userId?: string;
    sessionId: string;
    duration?: number;
    properties?: Record<string, any>;
    error?: {
      message: string;
      stack?: string;
    };
  }>;
  meta: {
    userAgent: string;
    url: string;
    sessionId: string;
    userId?: string;
    timestamp: number;
  };
}

/**
 * POST - 接收业务埋点数据
 */
export async function POST(request: NextRequest) {
  try {
    const body: BusinessMetricsRequest = await request.json();
    const { events, meta } = body;

    // 验证数据
    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'Invalid events data' },
        { status: 400 }
      );
    }

    // 添加元数据到每个事件
    const enrichedEvents = events.map(event => ({
      ...event,
      meta,
      receivedAt: Date.now(),
      ip: request.ip || 'unknown',
      userAgent: request.headers.get('user-agent') || meta.userAgent
    }));

    // 存储事件（生产环境应写入数据库）
    businessEvents.push(...enrichedEvents);

    // 限制内存使用，只保留最近10000个事件
    if (businessEvents.length > 10000) {
      businessEvents = businessEvents.slice(-10000);
    }

    // 清除缓存
    metricsCache = null;
    lastCacheUpdate = 0;

    // 开发环境日志
    if (process.env.NODE_ENV === 'development') {
      console.log(`[业务埋点API] 接收 ${events.length} 个事件`, {
        sessionId: meta.sessionId,
        userId: meta.userId,
        categories: [...new Set(events.map(e => e.category))]
      });
    }

    return NextResponse.json({
      success: true,
      received: events.length,
      totalEvents: businessEvents.length
    });

  } catch (error) {
    console.error('[业务埋点API] 处理失败:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET - 获取业务指标数据
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'metrics' | 'events' | 'dashboard'
    const category = searchParams.get('category'); // 'chat' | 'upload' | 'commerce' | 'tool'
    const timeRange = searchParams.get('timeRange') || '24h'; // '1h' | '24h' | '7d'

    const now = Date.now();
    let timeLimit = now;

    // 计算时间范围
    switch (timeRange) {
      case '1h':
        timeLimit = now - 60 * 60 * 1000;
        break;
      case '24h':
        timeLimit = now - 24 * 60 * 60 * 1000;
        break;
      case '7d':
        timeLimit = now - 7 * 24 * 60 * 60 * 1000;
        break;
    }

    // 过滤时间范围内的事件
    const filteredEvents = businessEvents.filter(event =>
      event.timestamp > timeLimit || event.receivedAt > timeLimit
    );

    switch (type) {
      case 'metrics':
        return NextResponse.json({
          data: calculateBusinessMetrics(filteredEvents),
          meta: {
            timeRange,
            eventCount: filteredEvents.length,
            calculatedAt: now
          }
        });

      case 'events':
        const categoryFiltered = category
          ? filteredEvents.filter(e => e.category === category)
          : filteredEvents;

        // 分页返回
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const start = (page - 1) * limit;
        const end = start + limit;

        return NextResponse.json({
          data: categoryFiltered.slice(start, end),
          meta: {
            total: categoryFiltered.length,
            page,
            limit,
            timeRange,
            categories: [...new Set(filteredEvents.map(e => e.category))]
          }
        });

      case 'dashboard':
        return NextResponse.json({
          data: calculateDashboardData(filteredEvents),
          meta: {
            timeRange,
            eventCount: filteredEvents.length,
            calculatedAt: now
          }
        });

      default:
        // 返回原始事件数据
        return NextResponse.json({
          events: filteredEvents.slice(0, 100), // 最多返回100个
          meta: {
            total: filteredEvents.length,
            timeRange,
            categories: [...new Set(filteredEvents.map(e => e.category))]
          }
        });
    }

  } catch (error) {
    console.error('[业务埋点API] 查询失败:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 计算业务指标
 */
function calculateBusinessMetrics(events: any[]) {
  // 使用缓存
  const now = Date.now();
  if (metricsCache && (now - lastCacheUpdate) < CACHE_TTL) {
    return metricsCache;
  }

  // 聊天指标
  const chatEvents = events.filter(e => e.category === 'chat');
  const chatSuccessEvents = chatEvents.filter(e => e.action === 'success');
  const chatMetrics = {
    totalRequests: chatEvents.length,
    successRate: chatEvents.length > 0 ? Math.round((chatSuccessEvents.length / chatEvents.length) * 100 * 100) / 100 : 0,
    averageResponseTime: calculateAverage(chatEvents, e => e.properties?.responseTime || 0),
    averageTokens: {
      input: calculateAverage(chatSuccessEvents, e => e.properties?.tokens?.input || 0),
      output: calculateAverage(chatSuccessEvents, e => e.properties?.tokens?.output || 0)
    }
  };

  // 上传指标
  const uploadEvents = events.filter(e => e.category === 'upload');
  const uploadSuccessEvents = uploadEvents.filter(e => e.action === 'success');
  const kbEvents = uploadEvents.filter(e => e.properties?.uploadType === 'kb');
  const kbSuccessEvents = kbEvents.filter(e => e.action === 'success');
  const uploadMetrics = {
    totalUploads: uploadEvents.length,
    successRate: uploadEvents.length > 0 ? Math.round((uploadSuccessEvents.length / uploadEvents.length) * 100 * 100) / 100 : 0,
    averageFileSize: Math.round(calculateAverage(uploadEvents, e => e.properties?.fileSize || 0) / 1024 * 100) / 100, // KB
    kbUploadSuccessRate: kbEvents.length > 0 ? Math.round((kbSuccessEvents.length / kbEvents.length) * 100 * 100) / 100 : 0
  };

  // 商拍指标
  const commerceEvents = events.filter(e => e.category === 'commerce');
  const commerceSuccessEvents = commerceEvents.filter(e => e.action === 'success');
  const toolUsageStats: Record<string, number> = {};
  commerceEvents.forEach(e => {
    const toolType = e.properties?.toolType || 'unknown';
    toolUsageStats[toolType] = (toolUsageStats[toolType] || 0) + 1;
  });
  const commerceMetrics = {
    totalTasks: commerceEvents.length,
    averageProcessingTime: Math.round(calculateAverage(commerceEvents, e => e.properties?.processingTime || 0) / 1000 * 100) / 100, // 秒
    successRate: commerceEvents.length > 0 ? Math.round((commerceSuccessEvents.length / commerceEvents.length) * 100 * 100) / 100 : 0,
    toolUsageStats
  };

  // 工具失败率指标
  const toolEvents = events.filter(e => e.category === 'tool');
  const toolFailureEvents = toolEvents.filter(e => e.action === 'failure' || e.action === 'error');
  const toolFailureStats: Record<string, {failures: number; total: number; rate: number}> = {};

  // 按工具名称统计
  const toolGroups: Record<string, any[]> = {};
  toolEvents.forEach(e => {
    const toolName = e.properties?.toolName || 'unknown';
    if (!toolGroups[toolName]) toolGroups[toolName] = [];
    toolGroups[toolName].push(e);
  });

  Object.entries(toolGroups).forEach(([toolName, events]) => {
    const failures = events.filter(e => e.action === 'failure' || e.action === 'error').length;
    toolFailureStats[toolName] = {
      failures,
      total: events.length,
      rate: events.length > 0 ? Math.round((failures / events.length) * 100 * 100) / 100 : 0
    };
  });

  const toolFailureMetrics = {
    totalOperations: toolEvents.length,
    failureRate: toolEvents.length > 0 ? Math.round((toolFailureEvents.length / toolEvents.length) * 100 * 100) / 100 : 0,
    toolFailureStats
  };

  // 系统指标
  const sessionEvents = events.filter(e => e.sessionId);
  const errorEvents = events.filter(e => e.action === 'error');
  const uniqueSessions = new Set(events.map(e => e.sessionId));
  const uniqueUsers = new Set(events.map(e => e.userId).filter(Boolean));
  const systemMetrics = {
    sessionCount: uniqueSessions.size,
    activeUsers: uniqueUsers.size,
    errorRate: events.length > 0 ? Math.round((errorEvents.length / events.length) * 100 * 100) / 100 : 0,
    averageSessionDuration: calculateAverageSessionDuration(events)
  };

  const metrics = {
    chatMetrics,
    uploadMetrics,
    commerceMetrics,
    toolFailureMetrics,
    systemMetrics,
    summary: {
      totalEvents: events.length,
      successEvents: events.filter(e => e.action === 'success').length,
      errorEvents: errorEvents.length,
      overallSuccessRate: events.length > 0 ? Math.round((events.filter(e => e.action === 'success').length / events.length) * 100 * 100) / 100 : 0
    }
  };

  // 更新缓存
  metricsCache = metrics;
  lastCacheUpdate = now;

  return metrics;
}

/**
 * 计算看板数据
 */
function calculateDashboardData(events: any[]) {
  const metrics = calculateBusinessMetrics(events);

  // 时间序列数据
  const timeSeriesData = generateTimeSeriesData(events);

  // 热门工具统计
  const popularTools = Object.entries(metrics.commerceMetrics.toolUsageStats)
    .sort(([,a]: any, [,b]: any) => b - a)
    .slice(0, 10);

  // 错误趋势
  const errorTrends = generateErrorTrends(events);

  return {
    ...metrics,
    timeSeriesData,
    popularTools,
    errorTrends,
    insights: generateInsights(metrics)
  };
}

/**
 * 生成时间序列数据
 */
function generateTimeSeriesData(events: any[]) {
  const hourlyData: Record<string, any> = {};

  events.forEach(event => {
    const hour = new Date(event.timestamp).getHours();
    const key = `${hour}:00`;

    if (!hourlyData[key]) {
      hourlyData[key] = {
        hour: key,
        total: 0,
        chat: 0,
        upload: 0,
        commerce: 0,
        tool: 0,
        errors: 0
      };
    }

    hourlyData[key].total++;
    hourlyData[key][event.category]++;
    if (event.action === 'error' || event.action === 'failure') {
      hourlyData[key].errors++;
    }
  });

  return Object.values(hourlyData).sort((a: any, b: any) =>
    parseInt(a.hour) - parseInt(b.hour)
  );
}

/**
 * 生成错误趋势
 */
function generateErrorTrends(events: any[]) {
  const errorEvents = events.filter(e => e.action === 'error' || e.action === 'failure');
  const errorTypes: Record<string, number> = {};

  errorEvents.forEach(event => {
    const errorType = event.error?.message || event.eventName || 'unknown';
    errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
  });

  return Object.entries(errorTypes)
    .sort(([,a]: any, [,b]: any) => b - a)
    .slice(0, 10)
    .map(([error, count]) => ({ error, count }));
}

/**
 * 生成洞察
 */
function generateInsights(metrics: any) {
  const insights = [];

  // 聊天成功率洞察
  if (metrics.chatMetrics.successRate < 90) {
    insights.push({
      type: 'warning',
      title: '聊天成功率偏低',
      description: `当前聊天成功率为 ${metrics.chatMetrics.successRate}%，建议检查模型响应稳定性`
    });
  }

  // 上传成功率洞察
  if (metrics.uploadMetrics.successRate < 95) {
    insights.push({
      type: 'warning',
      title: '上传成功率偏低',
      description: `当前上传成功率为 ${metrics.uploadMetrics.successRate}%，建议检查上传服务状态`
    });
  }

  // 商拍处理时间洞察
  if (metrics.commerceMetrics.averageProcessingTime > 30) {
    insights.push({
      type: 'info',
      title: '商拍处理时间较长',
      description: `平均处理时间为 ${metrics.commerceMetrics.averageProcessingTime}秒，可考虑优化处理算法`
    });
  }

  // 工具失败率洞察
  const highFailureTools = Object.entries(metrics.toolFailureMetrics.toolFailureStats)
    .filter(([, stats]: any) => stats.rate > 10);

  if (highFailureTools.length > 0) {
    insights.push({
      type: 'error',
      title: '部分工具失败率过高',
      description: `有 ${highFailureTools.length} 个工具失败率超过10%，需要紧急修复`
    });
  }

  return insights;
}

/**
 * 计算平均值
 */
function calculateAverage(items: any[], getValue: (item: any) => number): number {
  if (items.length === 0) return 0;
  const total = items.reduce((sum, item) => sum + getValue(item), 0);
  return total / items.length;
}

/**
 * 计算平均会话时长
 */
function calculateAverageSessionDuration(events: any[]): number {
  if (events.length === 0) return 0;

  // 按会话分组
  const sessionGroups: Record<string, any[]> = {};
  events.forEach(event => {
    if (!sessionGroups[event.sessionId]) {
      sessionGroups[event.sessionId] = [];
    }
    sessionGroups[event.sessionId]!.push(event);
  });

  // 计算每个会话的时长
  const durations = Object.values(sessionGroups).map(sessionEvents => {
    const timestamps = sessionEvents.map((e: any) => e.timestamp).sort();
    return timestamps.length > 1 ? timestamps[timestamps.length - 1] - timestamps[0] : 0;
  });

  return durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0;
}
