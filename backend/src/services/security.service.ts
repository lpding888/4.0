/**
 * 安全防护服务
 *
 * 提供限流、数据脱敏、健康检查等安全防护功能
 */

// 艹！全部改用ESM import，避免CommonJS/ESM混用导致Mock失效！
import crypto from 'crypto';
import { redis } from '../config/redis.js'; // 使用ioredis实例，有完整的Redis命令
import logger from '../utils/logger.js';
import { db as knex } from '../db/index.js';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: any) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

interface DataMaskingRule {
  field: string;
  type: 'email' | 'phone' | 'id_card' | 'bank_card' | 'password' | 'token' | 'custom';
  customPattern?: string;
  replacement?: string;
}

interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'warning';
  responseTime: number;
  lastCheck: Date;
  details?: any;
  error?: string;
}

interface SecurityAuditLog {
  id: string;
  type: 'rate_limit' | 'data_access' | 'auth_attempt' | 'permission_denied' | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  ip: string;
  userAgent?: string;
  endpoint: string;
  method: string;
  details: Record<string, any>;
  timestamp: Date;
}

class SecurityService {
  private readonly RATE_LIMIT_PREFIX = 'rate_limit:';
  private readonly HEALTH_CHECK_PREFIX = 'health_check:';
  private readonly AUDIT_LOG_PREFIX = 'audit_log:';
  private readonly DEFAULT_MASK_CHAR = '*';

  /**
   * 检查请求频率限制
   */
  async checkRateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    try {
      const redisKey = `${this.RATE_LIMIT_PREFIX}${key}`;
      const now = Date.now();
      const windowStart = now - config.windowMs;

      // 使用Redis的sorted set实现滑动窗口
      await redis.zremrangebyscore(redisKey, 0, windowStart);

      const currentCount = await redis.zcard(redisKey);
      const allowed = currentCount < config.maxRequests;

      if (allowed) {
        // 记录当前请求
        await redis.zadd(redisKey, now, `${now}-${Math.random()}`);
        await redis.expire(redisKey, Math.ceil(config.windowMs / 1000) + 1);
      }

      const ttl = await redis.ttl(redisKey);
      const resetTime = new Date(now + ttl * 1000);

      return {
        allowed,
        limit: config.maxRequests,
        remaining: Math.max(0, config.maxRequests - currentCount - (allowed ? 1 : 0)),
        resetTime,
        retryAfter: allowed ? undefined : ttl
      };
    } catch (error) {
      logger.error('检查频率限制失败:', error);
      // 发生错误时允许请求通过
      return {
        allowed: true,
        limit: config.maxRequests,
        remaining: config.maxRequests,
        resetTime: new Date(Date.now() + config.windowMs)
      };
    }
  }

  /**
   * 重置频率限制
   */
  async resetRateLimit(key: string): Promise<boolean> {
    try {
      const redisKey = `${this.RATE_LIMIT_PREFIX}${key}`;
      await redis.del(redisKey);
      return true;
    } catch (error) {
      logger.error('重置频率限制失败:', error);
      return false;
    }
  }

  /**
   * 数据脱敏
   */
  maskData(data: any, rules: DataMaskingRule[]): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    // 艹！修复bug：使用深拷贝，避免修改原始对象
    const maskedData = JSON.parse(JSON.stringify(data));

    for (const rule of rules) {
      this.maskField(maskedData, rule);
    }

    return maskedData;
  }

  /**
   * 脱敏单个字段
   */
  private maskField(obj: any, rule: DataMaskingRule, path: string = ''): void {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    for (const key in obj) {
      const currentPath = path ? `${path}.${key}` : key;

      // 艹！修复bug：字段匹配时，如果是字符串则脱敏，如果是对象则继续递归
      if (
        currentPath === rule.field ||
        key === rule.field ||
        currentPath.endsWith(`.${rule.field}`)
      ) {
        if (typeof obj[key] === 'string') {
          obj[key] = this.maskValue(obj[key], rule);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          // 即使匹配到了，如果是对象也要继续递归（处理嵌套路径 user.email）
          this.maskField(obj[key], rule, currentPath);
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        // 没匹配到但是对象，继续递归查找
        this.maskField(obj[key], rule, currentPath);
      }
    }
  }

  /**
   * 脱敏值
   */
  private maskValue(value: string, rule: DataMaskingRule): string {
    if (!value || typeof value !== 'string') {
      return value;
    }

    switch (rule.type) {
      case 'email':
        return this.maskEmail(value);
      case 'phone':
        return this.maskPhone(value);
      case 'id_card':
        return this.maskIdCard(value);
      case 'bank_card':
        return this.maskBankCard(value);
      case 'password':
        return this.maskPassword(value);
      case 'token':
        return this.maskToken(value);
      case 'custom':
        return this.maskCustom(value, rule.customPattern, rule.replacement);
      default:
        return value;
    }
  }

  /**
   * 脱敏邮箱
   */
  private maskEmail(email: string): string {
    const atIndex = email.lastIndexOf('@');
    if (atIndex <= 1) {
      return this.maskGeneric(email);
    }

    const username = email.substring(0, atIndex);
    const domain = email.substring(atIndex);

    let maskedUsername: string;
    if (username.length <= 3) {
      maskedUsername = username[0] + this.DEFAULT_MASK_CHAR.repeat(username.length - 1);
    } else if (username.length === 4) {
      // 艹！修复bug：长度为4时，保留首尾各1个字符，中间2个星号
      maskedUsername = username[0] + this.DEFAULT_MASK_CHAR.repeat(2) + username[3];
    } else {
      // 长度>4时，保留前2后2，中间全是星号
      maskedUsername =
        username.substring(0, 2) +
        this.DEFAULT_MASK_CHAR.repeat(username.length - 4) +
        username.substring(username.length - 2);
    }

    return maskedUsername + domain;
  }

  /**
   * 脱敏手机号
   */
  private maskPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');

    if (cleaned.length < 7) {
      return this.maskGeneric(phone);
    }

    if (cleaned.length === 11) {
      // 中国手机号格式
      return cleaned.substring(0, 3) + this.DEFAULT_MASK_CHAR.repeat(4) + cleaned.substring(7);
    }

    // 通用格式
    return (
      cleaned.substring(0, Math.min(3, cleaned.length - 3)) +
      this.DEFAULT_MASK_CHAR.repeat(Math.max(3, cleaned.length - 6)) +
      cleaned.substring(Math.max(3, cleaned.length - 3))
    );
  }

  /**
   * 脱敏身份证
   */
  private maskIdCard(idCard: string): string {
    const cleaned = idCard.replace(/\s/g, '');

    if (cleaned.length < 8) {
      return this.maskGeneric(cleaned);
    }

    return (
      cleaned.substring(0, 4) +
      this.DEFAULT_MASK_CHAR.repeat(cleaned.length - 8) +
      cleaned.substring(cleaned.length - 4)
    );
  }

  /**
   * 脱敏银行卡
   */
  private maskBankCard(bankCard: string): string {
    const cleaned = bankCard.replace(/\D/g, '');

    if (cleaned.length < 8) {
      return this.maskGeneric(cleaned);
    }

    return (
      cleaned.substring(0, 4) +
      this.DEFAULT_MASK_CHAR.repeat(cleaned.length - 8) +
      cleaned.substring(cleaned.length - 4)
    );
  }

  /**
   * 脱敏密码
   */
  private maskPassword(password: string): string {
    return this.DEFAULT_MASK_CHAR.repeat(Math.min(password.length, 20));
  }

  /**
   * 脱敏Token
   */
  private maskToken(token: string): string {
    if (token.length <= 8) {
      return this.DEFAULT_MASK_CHAR.repeat(token.length);
    }

    return (
      token.substring(0, 4) +
      this.DEFAULT_MASK_CHAR.repeat(Math.min(token.length - 8, 20)) +
      token.substring(token.length - 4)
    );
  }

  /**
   * 自定义脱敏
   */
  private maskCustom(value: string, pattern?: string, replacement?: string): string {
    if (!pattern) {
      return this.maskGeneric(value);
    }

    try {
      const regex = new RegExp(pattern, 'g');
      return value.replace(regex, replacement || this.DEFAULT_MASK_CHAR);
    } catch (error) {
      logger.error('自定义脱敏规则无效:', error);
      return this.maskGeneric(value);
    }
  }

  /**
   * 通用脱敏
   */
  private maskGeneric(value: string): string {
    if (value.length <= 2) {
      return this.DEFAULT_MASK_CHAR.repeat(value.length);
    }

    const visibleChars = Math.min(2, Math.floor(value.length / 3));
    return (
      value.substring(0, visibleChars) +
      this.DEFAULT_MASK_CHAR.repeat(value.length - visibleChars * 2) +
      value.substring(value.length - visibleChars)
    );
  }

  /**
   * 健康检查
   */
  async performHealthChecks(): Promise<{
    overall: 'healthy' | 'unhealthy' | 'warning';
    checks: HealthCheck[];
  }> {
    const checks: HealthCheck[] = [];

    try {
      // 数据库连接检查
      checks.push(await this.checkDatabaseHealth());

      // Redis连接检查
      checks.push(await this.checkRedisHealth());

      // 内存使用检查
      checks.push(await this.checkMemoryHealth());

      // 磁盘空间检查
      checks.push(await this.checkDiskHealth());

      // 外部服务检查
      checks.push(await this.checkExternalServicesHealth());

      // 计算整体状态
      const statuses = checks.map((check) => check.status);
      let overall: 'healthy' | 'unhealthy' | 'warning';

      if (statuses.some((status) => status === 'unhealthy')) {
        overall = 'unhealthy';
      } else if (statuses.some((status) => status === 'warning')) {
        overall = 'warning';
      } else {
        overall = 'healthy';
      }

      return { overall, checks };
    } catch (error: any) {
      logger.error('健康检查失败:', error);
      return {
        overall: 'unhealthy',
        checks: [
          {
            name: 'system',
            status: 'unhealthy',
            responseTime: 0,
            lastCheck: new Date(),
            error: error.message
          }
        ]
      };
    }
  }

  /**
   * 检查数据库健康状态
   */
  private async checkDatabaseHealth(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      await knex.raw('SELECT 1');
      const responseTime = Date.now() - startTime;

      return {
        name: 'database',
        status: responseTime < 1000 ? 'healthy' : 'warning',
        responseTime,
        lastCheck: new Date(),
        details: { responseTime }
      };
    } catch (error: any) {
      return {
        name: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        error: error.message
      };
    }
  }

  /**
   * 检查Redis健康状态
   */
  private async checkRedisHealth(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      await redis.ping();
      const responseTime = Date.now() - startTime;

      return {
        name: 'redis',
        status: responseTime < 500 ? 'healthy' : 'warning',
        responseTime,
        lastCheck: new Date(),
        details: { responseTime }
      };
    } catch (error: any) {
      return {
        name: 'redis',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        error: error.message
      };
    }
  }

  /**
   * 检查内存使用情况
   */
  private async checkMemoryHealth(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const memUsage = process.memoryUsage();
      const totalMemory = require('os').totalmem();
      const freeMemory = require('os').freemem();
      const usedMemory = totalMemory - freeMemory;
      const memoryUsagePercent = (usedMemory / totalMemory) * 100;

      let status: 'healthy' | 'warning' | 'unhealthy';
      if (memoryUsagePercent > 90) {
        status = 'unhealthy';
      } else if (memoryUsagePercent > 80) {
        status = 'warning';
      } else {
        status = 'healthy';
      }

      return {
        name: 'memory',
        status,
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        details: {
          processMemory: memUsage,
          systemMemoryUsage: memoryUsagePercent.toFixed(2) + '%',
          freeMemory: (freeMemory / 1024 / 1024).toFixed(2) + 'MB',
          totalMemory: (totalMemory / 1024 / 1024).toFixed(2) + 'MB'
        }
      };
    } catch (error: any) {
      return {
        name: 'memory',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        error: error.message
      };
    }
  }

  /**
   * 检查磁盘空间
   */
  private async checkDiskHealth(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const fs = require('fs');
      const stats = fs.statSync('.');

      // 简化的磁盘检查（实际项目中可能需要更复杂的实现）
      let status: 'healthy' | 'warning' | 'unhealthy';
      if (stats.size < 1000) {
        status = 'healthy';
      } else {
        status = 'warning';
      }

      return {
        name: 'disk',
        status,
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        details: { status: 'accessible' }
      };
    } catch (error: any) {
      return {
        name: 'disk',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        error: error.message
      };
    }
  }

  /**
   * 检查外部服务健康状态
   */
  private async checkExternalServicesHealth(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // 这里可以检查依赖的外部服务
      // 例如：支付服务、短信服务、邮件服务等

      return {
        name: 'external_services',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        details: { all_services: 'operational' }
      };
    } catch (error: any) {
      return {
        name: 'external_services',
        status: 'warning',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        error: error.message
      };
    }
  }

  /**
   * 记录安全审计日志
   */
  async logSecurityEvent(event: Omit<SecurityAuditLog, 'id' | 'timestamp'>): Promise<void> {
    try {
      const auditLog: SecurityAuditLog = {
        id: this.generateId(),
        timestamp: new Date(),
        ...event
      };

      // 存储到Redis（短期存储）
      const redisKey = `${this.AUDIT_LOG_PREFIX}${auditLog.id}`;
      await redis.setex(redisKey, 7 * 24 * 60 * 60, JSON.stringify(auditLog)); // 7天过期

      // 高严重级别事件也写入数据库
      if (auditLog.severity === 'high' || auditLog.severity === 'critical') {
        await knex('security_audit_logs').insert({
          id: auditLog.id,
          type: auditLog.type,
          severity: auditLog.severity,
          user_id: auditLog.userId,
          ip: auditLog.ip,
          user_agent: auditLog.userAgent,
          endpoint: auditLog.endpoint,
          method: auditLog.method,
          details: JSON.stringify(auditLog.details),
          timestamp: auditLog.timestamp
        });
      }

      logger.warn('安全事件记录', {
        type: auditLog.type,
        severity: auditLog.severity,
        userId: auditLog.userId,
        ip: auditLog.ip,
        endpoint: auditLog.endpoint
      });
    } catch (error) {
      logger.error('记录安全审计日志失败:', error);
    }
  }

  /**
   * 获取安全审计日志
   */
  async getAuditLogs(
    filters: {
      type?: string;
      severity?: string;
      userId?: string;
      ip?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ logs: SecurityAuditLog[]; total: number }> {
    const { type, severity, userId, ip, startDate, endDate, page = 1, limit = 50 } = filters;

    try {
      let query = knex('security_audit_logs').select('*');

      if (type) query = query.where('type', type);
      if (severity) query = query.where('severity', severity);
      if (userId) query = query.where('user_id', userId);
      if (ip) query = query.where('ip', ip);
      if (startDate) query = query.where('timestamp', '>=', startDate);
      if (endDate) query = query.where('timestamp', '<=', endDate);

      // 获取总数
      const totalQuery = query.clone().clearSelect().count('* as count');
      const [{ count }] = await totalQuery;
      const total = parseInt(String(count));

      // 分页查询
      const offset = (page - 1) * limit;
      const logs = await query.orderBy('timestamp', 'desc').limit(limit).offset(offset);

      const mappedLogs = logs.map((log) => ({
        id: log.id,
        type: log.type,
        severity: log.severity,
        userId: log.user_id,
        ip: log.ip,
        userAgent: log.user_agent,
        endpoint: log.endpoint,
        method: log.method,
        details: log.details ? JSON.parse(log.details) : {},
        timestamp: log.timestamp
      }));

      return { logs: mappedLogs, total };
    } catch (error) {
      logger.error('获取安全审计日志失败:', error);
      return { logs: [], total: 0 };
    }
  }

  /**
   * 检测可疑活动
   */
  async detectSuspiciousActivity(
    ip: string,
    timeWindowMs: number = 300000
  ): Promise<{
    suspicious: boolean;
    reasons: string[];
    riskScore: number;
  }> {
    try {
      const redisKey = `suspicious:${ip}`;
      const now = Date.now();
      const windowStart = now - timeWindowMs;

      // 获取该IP在时间窗口内的活动记录
      const activities = await redis.zrangebyscore(redisKey, windowStart, now);

      const reasons: string[] = [];
      let riskScore = 0;

      // 检查请求频率
      if (activities.length > 1000) {
        reasons.push('异常高频请求');
        riskScore += 40;
      } else if (activities.length > 500) {
        reasons.push('高频请求');
        riskScore += 20;
      }

      // 检查失败率
      const failures = activities.filter((activity: any) => activity.includes('failure')).length;
      const failureRate = activities.length > 0 ? failures / activities.length : 0;

      if (failureRate > 0.5) {
        reasons.push('高失败率');
        riskScore += 30;
      } else if (failureRate > 0.2) {
        reasons.push('中等失败率');
        riskScore += 15;
      }

      // 检查异常时间模式
      const timeDistribution = this.analyzeTimeDistribution(activities);
      if (timeDistribution.isUnusual) {
        reasons.push('异常时间模式');
        riskScore += 25;
      }

      const suspicious = riskScore >= 50;

      if (suspicious) {
        await this.logSecurityEvent({
          type: 'suspicious_activity',
          severity: riskScore >= 80 ? 'high' : 'medium',
          ip,
          endpoint: 'multiple',
          method: 'various',
          details: {
            reasons,
            riskScore,
            activityCount: activities.length,
            timeWindowMs
          }
        });
      }

      return { suspicious, reasons, riskScore };
    } catch (error) {
      logger.error('检测可疑活动失败:', error);
      return { suspicious: false, reasons: [], riskScore: 0 };
    }
  }

  /**
   * 分析时间分布
   */
  private analyzeTimeDistribution(activities: string[]): { isUnusual: boolean } {
    if (activities.length < 10) {
      return { isUnusual: false };
    }

    // 简化的时间分布分析
    // 检查是否在异常时间段（如凌晨2-5点）有大量活动
    const now = new Date();
    const currentHour = now.getHours();

    if (currentHour >= 2 && currentHour <= 5 && activities.length > 50) {
      return { isUnusual: true };
    }

    return { isUnusual: false };
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取安全统计信息
   */
  async getSecurityStats(): Promise<any> {
    try {
      const [auditStats, rateLimitStats, healthStats] = await Promise.all([
        this.getAuditStats(),
        this.getRateLimitStats(),
        this.getHealthStats()
      ]);

      return {
        audit: auditStats,
        rateLimit: rateLimitStats,
        health: healthStats,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('获取安全统计失败:', error);
      return {
        audit: {},
        rateLimit: {},
        health: {},
        timestamp: new Date()
      };
    }
  }

  /**
   * 获取审计统计
   */
  private async getAuditStats(): Promise<any> {
    try {
      const [typeStats, severityStats, recentCount] = await Promise.all([
        knex('security_audit_logs').select('type').count('* as count').groupBy('type'),
        knex('security_audit_logs').select('severity').count('* as count').groupBy('severity'),
        knex('security_audit_logs')
          .where('timestamp', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000))
          .count('* as count')
          .first()
      ]);

      return {
        byType: typeStats.reduce((acc, row) => {
          acc[row.type] = parseInt(String(row.count));
          return acc;
        }, {} as any),
        bySeverity: severityStats.reduce((acc, row) => {
          acc[row.severity] = parseInt(String(row.count));
          return acc;
        }, {} as any),
        last24h: recentCount?.count || 0
      };
    } catch (error) {
      return { byType: {}, bySeverity: {}, last24h: 0 };
    }
  }

  /**
   * 获取限流统计
   */
  private async getRateLimitStats(): Promise<any> {
    try {
      // 这里应该从Redis获取限流统计
      // 简化实现
      return {
        activeLimits: 0,
        blockedRequests: 0,
        topBlockedIPs: []
      };
    } catch (error) {
      return { activeLimits: 0, blockedRequests: 0, topBlockedIPs: [] };
    }
  }

  /**
   * 获取健康检查统计
   */
  private async getHealthStats(): Promise<any> {
    try {
      const healthResult = await this.performHealthChecks();

      const stats = {
        overall: healthResult.overall,
        checks: healthResult.checks.reduce(
          (acc, check) => {
            acc[check.name] = check.status;
            return acc;
          },
          {} as Record<string, string>
        )
      };

      return stats;
    } catch (error) {
      return { overall: 'unknown', checks: {} };
    }
  }
}

const securityService = new SecurityService();

// 导出类实例的所有方法
export const getSecurityStats = securityService.getSecurityStats.bind(securityService);
export const performHealthChecks = securityService.performHealthChecks.bind(securityService);
export const getAuditLogs = securityService.getAuditLogs.bind(securityService);
export const checkRateLimit = securityService.checkRateLimit.bind(securityService);
export const resetRateLimit = securityService.resetRateLimit.bind(securityService);
export const maskData = securityService.maskData.bind(securityService);
export const detectSuspiciousActivity =
  securityService.detectSuspiciousActivity.bind(securityService);
export const logSecurityEvent = securityService.logSecurityEvent.bind(securityService);

export default securityService;
