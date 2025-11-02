const promClient = require('prom-client');
const logger = require('../utils/logger');

/**
 * Prometheus监控服务 (P1-014)
 * 艹！收集和暴露各种业务指标，用Prometheus抓取并在Grafana展示
 *
 * 指标类型:
 * - Counter: 只增不减的计数器（请求总数、错误总数等）
 * - Gauge: 可增可减的仪表盘（当前在线用户数、队列长度等）
 * - Histogram: 直方图（请求耗时分布等）
 * - Summary: 汇总（与Histogram类似但计算方式不同）
 */
class MetricsService {
  constructor() {
    // 默认启用Prometheus指标收集
    this.enabled = process.env.PROMETHEUS_ENABLED !== 'false';

    if (!this.enabled) {
      logger.info('[Metrics] Prometheus指标收集已禁用');
      return;
    }

    // 创建注册表
    this.register = new promClient.Registry();

    // 启用默认指标（Node.js进程指标）
    promClient.collectDefaultMetrics({
      register: this.register,
      prefix: 'aiphoto_',
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

    // ========== 业务指标 ==========

    // 任务总数
    this.tasksTotal = new promClient.Counter({
      name: 'aiphoto_tasks_total',
      help: '任务总数',
      labelNames: ['type', 'status'], // type: basic_clean/model_pose12/video_generate, status: pending/processing/success/failed
      registers: [this.register]
    });

    // 任务处理耗时
    this.taskDuration = new promClient.Histogram({
      name: 'aiphoto_task_duration_seconds',
      help: '任务处理耗时（秒）',
      labelNames: ['type'],
      buckets: [1, 5, 10, 30, 60, 120, 300, 600], // 秒
      registers: [this.register]
    });

    // 当前处理中的任务数
    this.tasksInProgress = new promClient.Gauge({
      name: 'aiphoto_tasks_in_progress',
      help: '当前处理中的任务数',
      labelNames: ['type'],
      registers: [this.register]
    });

    // 用户注册总数
    this.usersTotal = new promClient.Counter({
      name: 'aiphoto_users_total',
      help: '用户注册总数',
      registers: [this.register]
    });

    // 会员购买总数
    this.membershipsTotal = new promClient.Counter({
      name: 'aiphoto_memberships_total',
      help: '会员购买总数',
      labelNames: ['tier'], // tier: basic/pro/enterprise
      registers: [this.register]
    });

    // 订单总数
    this.ordersTotal = new promClient.Counter({
      name: 'aiphoto_orders_total',
      help: '订单总数',
      labelNames: ['type', 'status'], // type: membership/quota, status: pending/paid/failed
      registers: [this.register]
    });

    // 订单金额
    this.orderAmount = new promClient.Counter({
      name: 'aiphoto_order_amount_yuan',
      help: '订单金额（元）',
      labelNames: ['type'],
      registers: [this.register]
    });

    // 配额扣除总数
    this.quotaDeducted = new promClient.Counter({
      name: 'aiphoto_quota_deducted_total',
      help: '配额扣除总数',
      registers: [this.register]
    });

    // 配额返还总数
    this.quotaRefunded = new promClient.Counter({
      name: 'aiphoto_quota_refunded_total',
      help: '配额返还总数',
      registers: [this.register]
    });

    // ========== WebSocket指标 ==========

    // WebSocket连接总数
    this.websocketConnectionsTotal = new promClient.Counter({
      name: 'aiphoto_websocket_connections_total',
      help: 'WebSocket连接总数',
      labelNames: ['event'], // event: connected/disconnected
      registers: [this.register]
    });

    // 当前WebSocket在线用户数
    this.websocketOnlineUsers = new promClient.Gauge({
      name: 'aiphoto_websocket_online_users',
      help: '当前WebSocket在线用户数',
      registers: [this.register]
    });

    // WebSocket消息推送总数
    this.websocketMessagesTotal = new promClient.Counter({
      name: 'aiphoto_websocket_messages_total',
      help: 'WebSocket消息推送总数',
      labelNames: ['event'], // event: task:status/task:progress/task:error/task:completed/system:message
      registers: [this.register]
    });

    // ========== 分销指标 ==========

    // 分销员总数
    this.distributorsTotal = new promClient.Counter({
      name: 'aiphoto_distributors_total',
      help: '分销员总数',
      registers: [this.register]
    });

    // 佣金总额
    this.commissionsTotal = new promClient.Counter({
      name: 'aiphoto_commissions_yuan',
      help: '佣金总额（元）',
      labelNames: ['status'], // status: pending/frozen/available
      registers: [this.register]
    });

    // 提现总数
    this.withdrawalsTotal = new promClient.Counter({
      name: 'aiphoto_withdrawals_total',
      help: '提现总数',
      labelNames: ['status'], // status: pending/approved/rejected
      registers: [this.register]
    });

    // 提现金额
    this.withdrawalAmount = new promClient.Counter({
      name: 'aiphoto_withdrawal_amount_yuan',
      help: '提现金额（元）',
      labelNames: ['status'],
      registers: [this.register]
    });

    // ========== Redis缓存指标 ==========

    // 缓存命中率
    this.cacheHits = new promClient.Counter({
      name: 'aiphoto_cache_hits_total',
      help: '缓存命中总数',
      registers: [this.register]
    });

    this.cacheMisses = new promClient.Counter({
      name: 'aiphoto_cache_misses_total',
      help: '缓存未命中总数',
      registers: [this.register]
    });

    logger.info('[Metrics] Prometheus指标服务已初始化');
  }

  /**
   * 记录HTTP请求
   * 艹！在Express中间件中调用
   *
   * @param {string} method - HTTP方法
   * @param {string} path - 请求路径
   * @param {number} statusCode - 响应状态码
   * @param {number} duration - 请求耗时（秒）
   */
  recordHttpRequest(method, path, statusCode, duration) {
    if (!this.enabled) return;

    this.httpRequestsTotal.inc({ method, path, status_code: statusCode });
    this.httpRequestDuration.observe({ method, path, status_code: statusCode }, duration);
  }

  /**
   * 记录任务创建
   *
   * @param {string} type - 任务类型
   */
  recordTaskCreated(type) {
    if (!this.enabled) return;

    this.tasksTotal.inc({ type, status: 'pending' });
    this.tasksInProgress.inc({ type });
  }

  /**
   * 记录任务完成
   *
   * @param {string} type - 任务类型
   * @param {string} status - 最终状态 (success/failed)
   * @param {number} duration - 处理耗时（秒）
   */
  recordTaskCompleted(type, status, duration) {
    if (!this.enabled) return;

    this.tasksTotal.inc({ type, status });
    this.tasksInProgress.dec({ type });
    this.taskDuration.observe({ type }, duration);
  }

  /**
   * 记录用户注册
   */
  recordUserRegistered() {
    if (!this.enabled) return;

    this.usersTotal.inc();
  }

  /**
   * 记录会员购买
   *
   * @param {string} tier - 会员等级
   */
  recordMembershipPurchased(tier) {
    if (!this.enabled) return;

    this.membershipsTotal.inc({ tier });
  }

  /**
   * 记录订单创建
   *
   * @param {string} type - 订单类型 (membership/quota)
   * @param {string} status - 订单状态
   * @param {number} amount - 订单金额（元）
   */
  recordOrder(type, status, amount) {
    if (!this.enabled) return;

    this.ordersTotal.inc({ type, status });
    if (amount > 0) {
      this.orderAmount.inc({ type }, amount);
    }
  }

  /**
   * 记录配额扣除
   *
   * @param {number} amount - 扣除数量
   */
  recordQuotaDeducted(amount) {
    if (!this.enabled) return;

    this.quotaDeducted.inc(amount);
  }

  /**
   * 记录配额返还
   *
   * @param {number} amount - 返还数量
   */
  recordQuotaRefunded(amount) {
    if (!this.enabled) return;

    this.quotaRefunded.inc(amount);
  }

  /**
   * 记录WebSocket连接
   *
   * @param {string} event - 事件类型 (connected/disconnected)
   */
  recordWebSocketConnection(event) {
    if (!this.enabled) return;

    this.websocketConnectionsTotal.inc({ event });
  }

  /**
   * 更新WebSocket在线用户数
   *
   * @param {number} count - 在线用户数
   */
  updateWebSocketOnlineUsers(count) {
    if (!this.enabled) return;

    this.websocketOnlineUsers.set(count);
  }

  /**
   * 记录WebSocket消息推送
   *
   * @param {string} event - 事件类型
   */
  recordWebSocketMessage(event) {
    if (!this.enabled) return;

    this.websocketMessagesTotal.inc({ event });
  }

  /**
   * 记录分销员注册
   */
  recordDistributorRegistered() {
    if (!this.enabled) return;

    this.distributorsTotal.inc();
  }

  /**
   * 记录佣金
   *
   * @param {string} status - 佣金状态 (pending/frozen/available)
   * @param {number} amount - 佣金金额（元）
   */
  recordCommission(status, amount) {
    if (!this.enabled) return;

    this.commissionsTotal.inc({ status }, amount);
  }

  /**
   * 记录提现
   *
   * @param {string} status - 提现状态 (pending/approved/rejected)
   * @param {number} amount - 提现金额（元）
   */
  recordWithdrawal(status, amount) {
    if (!this.enabled) return;

    this.withdrawalsTotal.inc({ status });
    this.withdrawalAmount.inc({ status }, amount);
  }

  /**
   * 记录缓存命中
   */
  recordCacheHit() {
    if (!this.enabled) return;

    this.cacheHits.inc();
  }

  /**
   * 记录缓存未命中
   */
  recordCacheMiss() {
    if (!this.enabled) return;

    this.cacheMisses.inc();
  }

  /**
   * 获取Prometheus指标
   *
   * @returns {Promise<string>} Prometheus格式的指标数据
   */
  async getMetrics() {
    if (!this.enabled) {
      return '# Prometheus metrics disabled\n';
    }

    return await this.register.metrics();
  }

  /**
   * 获取指标内容类型
   *
   * @returns {string} Content-Type
   */
  getContentType() {
    return this.register.contentType;
  }

  /**
   * 重置所有指标（用于测试）
   */
  resetMetrics() {
    if (!this.enabled) return;

    this.register.resetMetrics();
  }
}

module.exports = new MetricsService();
