/**
 * Prometheus监控服务 - TypeScript ESM版本
 * 艹！收集和暴露各种业务指标，用Prometheus抓取并在Grafana展示 (P1-014)
 *
 * 指标类型:
 * - Counter: 只增不减的计数器（请求总数、错误总数等）
 * - Gauge: 可增可减的仪表盘（当前在线用户数、队列长度等）
 * - Histogram: 直方图（请求耗时分布等）
 */

import promClient from 'prom-client';
import logger from '../utils/logger.js';

class MetricsService {
  private enabled: boolean;
  private register: promClient.Registry;

  // HTTP指标
  private httpRequestsTotal: promClient.Counter<string>;
  private httpRequestDuration: promClient.Histogram<string>;

  // 任务指标
  private taskCreatedTotal: promClient.Counter<string>;
  private taskCompletedTotal: promClient.Counter<string>;
  private taskFailedTotal: promClient.Counter<string>;
  private taskDuration: promClient.Histogram<string>;
  private activeTasks: promClient.Gauge<string>;

  // 用户指标
  private userRegisteredTotal: promClient.Counter<string>;
  private activeUsers: promClient.Gauge<string>;
  private memberUsers: promClient.Gauge<string>;

  // 订单指标
  private orderCreatedTotal: promClient.Counter<string>;
  private orderCompletedTotal: promClient.Counter<string>;
  private orderRevenue: promClient.Counter<string>;

  // WebSocket指标
  private wsConnectionsActive: promClient.Gauge<string>;
  private wsMessagesTotal: promClient.Counter<string>;

  // 分销指标
  private distributorRegisteredTotal: promClient.Counter<string>;
  private commissionTotal: promClient.Counter<string>;

  // 缓存指标
  private cacheHits: promClient.Counter<string>;
  private cacheMisses: promClient.Counter<string>;

  constructor() {
    // 默认启用Prometheus指标收集
    this.enabled = process.env.PROMETHEUS_ENABLED !== 'false';

    if (!this.enabled) {
      logger.info('[Metrics] Prometheus指标收集已禁用');
      // 艹！禁用时创建空对象，避免后续调用报错
      this.register = new promClient.Registry();
      this.httpRequestsTotal = new promClient.Counter({ name: 'dummy', help: 'dummy' });
      this.httpRequestDuration = new promClient.Histogram({ name: 'dummy2', help: 'dummy' });
      this.taskCreatedTotal = new promClient.Counter({ name: 'dummy3', help: 'dummy' });
      this.taskCompletedTotal = new promClient.Counter({ name: 'dummy4', help: 'dummy' });
      this.taskFailedTotal = new promClient.Counter({ name: 'dummy5', help: 'dummy' });
      this.taskDuration = new promClient.Histogram({ name: 'dummy6', help: 'dummy' });
      this.activeTasks = new promClient.Gauge({ name: 'dummy7', help: 'dummy' });
      this.userRegisteredTotal = new promClient.Counter({ name: 'dummy8', help: 'dummy' });
      this.activeUsers = new promClient.Gauge({ name: 'dummy9', help: 'dummy' });
      this.memberUsers = new promClient.Gauge({ name: 'dummy10', help: 'dummy' });
      this.orderCreatedTotal = new promClient.Counter({ name: 'dummy11', help: 'dummy' });
      this.orderCompletedTotal = new promClient.Counter({ name: 'dummy12', help: 'dummy' });
      this.orderRevenue = new promClient.Counter({ name: 'dummy13', help: 'dummy' });
      this.wsConnectionsActive = new promClient.Gauge({ name: 'dummy14', help: 'dummy' });
      this.wsMessagesTotal = new promClient.Counter({ name: 'dummy15', help: 'dummy' });
      this.distributorRegisteredTotal = new promClient.Counter({ name: 'dummy16', help: 'dummy' });
      this.commissionTotal = new promClient.Counter({ name: 'dummy17', help: 'dummy' });
      this.cacheHits = new promClient.Counter({ name: 'dummy18', help: 'dummy' });
      this.cacheMisses = new promClient.Counter({ name: 'dummy19', help: 'dummy' });
      return;
    }

    // 创建注册表
    this.register = new promClient.Registry();

    // 启用默认指标（Node.js进程指标）
    promClient.collectDefaultMetrics({
      register: this.register,
      prefix: 'aiphoto_'
    });

    // ========== HTTP指标 ==========

    // HTTP请求总数
    this.httpRequestsTotal = new promClient.Counter({
      name: 'aiphoto_http_requests_total',
      help: 'HTTP请求总数',
      labelNames: ['method', 'path', 'status_code'],
      registers: [this.register]
    });

    // HTTP请求耗时
    this.httpRequestDuration = new promClient.Histogram({
      name: 'aiphoto_http_request_duration_seconds',
      help: 'HTTP请求耗时（秒）',
      labelNames: ['method', 'path', 'status_code'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10], // 秒
      registers: [this.register]
    });

    // ========== 任务指标 ==========

    // 任务创建总数
    this.taskCreatedTotal = new promClient.Counter({
      name: 'aiphoto_task_created_total',
      help: '任务创建总数',
      labelNames: ['task_type'],
      registers: [this.register]
    });

    // 任务完成总数
    this.taskCompletedTotal = new promClient.Counter({
      name: 'aiphoto_task_completed_total',
      help: '任务完成总数',
      labelNames: ['task_type'],
      registers: [this.register]
    });

    // 任务失败总数
    this.taskFailedTotal = new promClient.Counter({
      name: 'aiphoto_task_failed_total',
      help: '任务失败总数',
      labelNames: ['task_type', 'error_type'],
      registers: [this.register]
    });

    // 任务执行耗时
    this.taskDuration = new promClient.Histogram({
      name: 'aiphoto_task_duration_seconds',
      help: '任务执行耗时（秒）',
      labelNames: ['task_type'],
      buckets: [1, 5, 10, 30, 60, 120, 300, 600], // 秒
      registers: [this.register]
    });

    // 当前活跃任务数
    this.activeTasks = new promClient.Gauge({
      name: 'aiphoto_active_tasks',
      help: '当前活跃任务数',
      labelNames: ['task_type'],
      registers: [this.register]
    });

    // ========== 用户指标 ==========

    // 用户注册总数
    this.userRegisteredTotal = new promClient.Counter({
      name: 'aiphoto_user_registered_total',
      help: '用户注册总数',
      labelNames: ['registration_type'],
      registers: [this.register]
    });

    // 当前活跃用户数
    this.activeUsers = new promClient.Gauge({
      name: 'aiphoto_active_users',
      help: '当前活跃用户数',
      registers: [this.register]
    });

    // 会员用户数
    this.memberUsers = new promClient.Gauge({
      name: 'aiphoto_member_users',
      help: '会员用户数',
      registers: [this.register]
    });

    // ========== 订单指标 ==========

    // 订单创建总数
    this.orderCreatedTotal = new promClient.Counter({
      name: 'aiphoto_order_created_total',
      help: '订单创建总数',
      labelNames: ['order_type'],
      registers: [this.register]
    });

    // 订单完成总数
    this.orderCompletedTotal = new promClient.Counter({
      name: 'aiphoto_order_completed_total',
      help: '订单完成总数',
      labelNames: ['order_type'],
      registers: [this.register]
    });

    // 订单收入
    this.orderRevenue = new promClient.Counter({
      name: 'aiphoto_order_revenue_yuan',
      help: '订单收入（元）',
      labelNames: ['order_type'],
      registers: [this.register]
    });

    // ========== WebSocket指标 ==========

    // 当前WebSocket连接数
    this.wsConnectionsActive = new promClient.Gauge({
      name: 'aiphoto_ws_connections_active',
      help: '当前WebSocket连接数',
      registers: [this.register]
    });

    // WebSocket消息总数
    this.wsMessagesTotal = new promClient.Counter({
      name: 'aiphoto_ws_messages_total',
      help: 'WebSocket消息总数',
      labelNames: ['message_type', 'direction'],
      registers: [this.register]
    });

    // ========== 分销指标 ==========

    // 分销商注册总数
    this.distributorRegisteredTotal = new promClient.Counter({
      name: 'aiphoto_distributor_registered_total',
      help: '分销商注册总数',
      registers: [this.register]
    });

    // 佣金总额
    this.commissionTotal = new promClient.Counter({
      name: 'aiphoto_commission_total_yuan',
      help: '佣金总额（元）',
      labelNames: ['commission_type'],
      registers: [this.register]
    });

    // ========== 缓存指标 ==========

    // 缓存命中次数
    this.cacheHits = new promClient.Counter({
      name: 'aiphoto_cache_hits_total',
      help: '缓存命中次数',
      labelNames: ['cache_name'],
      registers: [this.register]
    });

    // 缓存未命中次数
    this.cacheMisses = new promClient.Counter({
      name: 'aiphoto_cache_misses_total',
      help: '缓存未命中次数',
      labelNames: ['cache_name'],
      registers: [this.register]
    });

    logger.info('[Metrics] ✅ Prometheus监控服务已启动');
  }

  // ========== HTTP指标记录方法 ==========

  /**
   * 记录HTTP请求
   * 艹！每个HTTP请求都要记录，用于监控API性能
   */
  recordHttpRequest(method: string, path: string, statusCode: number, duration: number): void {
    if (!this.enabled) return;

    this.httpRequestsTotal.inc({
      method,
      path,
      status_code: statusCode.toString()
    });

    this.httpRequestDuration.observe(
      {
        method,
        path,
        status_code: statusCode.toString()
      },
      duration
    );
  }

  // ========== 任务指标记录方法 ==========

  recordTaskCreated(taskType: string): void {
    if (!this.enabled) return;
    this.taskCreatedTotal.inc({ task_type: taskType });
    this.activeTasks.inc({ task_type: taskType });
  }

  recordTaskCompleted(taskType: string, duration: number): void {
    if (!this.enabled) return;
    this.taskCompletedTotal.inc({ task_type: taskType });
    this.taskDuration.observe({ task_type: taskType }, duration);
    this.activeTasks.dec({ task_type: taskType });
  }

  recordTaskFailed(taskType: string, errorType: string): void {
    if (!this.enabled) return;
    this.taskFailedTotal.inc({ task_type: taskType, error_type: errorType });
    this.activeTasks.dec({ task_type: taskType });
  }

  // ========== 用户指标记录方法 ==========

  recordUserRegistered(registrationType: string): void {
    if (!this.enabled) return;
    this.userRegisteredTotal.inc({ registration_type: registrationType });
  }

  setActiveUsers(count: number): void {
    if (!this.enabled) return;
    this.activeUsers.set(count);
  }

  setMemberUsers(count: number): void {
    if (!this.enabled) return;
    this.memberUsers.set(count);
  }

  // ========== 订单指标记录方法 ==========

  recordOrderCreated(orderType: string): void {
    if (!this.enabled) return;
    this.orderCreatedTotal.inc({ order_type: orderType });
  }

  recordOrderCompleted(orderType: string, revenue: number): void {
    if (!this.enabled) return;
    this.orderCompletedTotal.inc({ order_type: orderType });
    this.orderRevenue.inc({ order_type: orderType }, revenue);
  }

  // ========== WebSocket指标记录方法 ==========

  incrementWsConnections(): void {
    if (!this.enabled) return;
    this.wsConnectionsActive.inc();
  }

  decrementWsConnections(): void {
    if (!this.enabled) return;
    this.wsConnectionsActive.dec();
  }

  recordWsMessage(messageType: string, direction: 'in' | 'out'): void {
    if (!this.enabled) return;
    this.wsMessagesTotal.inc({ message_type: messageType, direction });
  }

  // ========== 分销指标记录方法 ==========

  recordDistributorRegistered(): void {
    if (!this.enabled) return;
    this.distributorRegisteredTotal.inc();
  }

  recordCommission(commissionType: string, amount: number): void {
    if (!this.enabled) return;
    this.commissionTotal.inc({ commission_type: commissionType }, amount);
  }

  // ========== 缓存指标记录方法 ==========

  recordCacheHit(cacheName: string): void {
    if (!this.enabled) return;
    this.cacheHits.inc({ cache_name: cacheName });
  }

  recordCacheMiss(cacheName: string): void {
    if (!this.enabled) return;
    this.cacheMisses.inc({ cache_name: cacheName });
  }

  // ========== Prometheus端点方法 ==========

  /**
   * 获取Content-Type
   * 艹！Prometheus需要特定的Content-Type
   */
  getContentType(): string {
    return this.register.contentType;
  }

  /**
   * 获取所有指标
   * 艹！Prometheus从这个接口抓取指标
   */
  async getMetrics(): Promise<string> {
    return await this.register.metrics();
  }

  /**
   * 重置所有指标（仅测试环境使用）
   * 艹！生产环境别tm调用这个方法
   */
  resetMetrics(): void {
    if (process.env.NODE_ENV === 'production') {
      logger.warn('[Metrics] ⚠️ 生产环境不允许重置指标');
      return;
    }
    this.register.resetMetrics();
    logger.info('[Metrics] 📊 指标已重置');
  }
}

// 导出单例
const metricsService = new MetricsService();
export default metricsService;
