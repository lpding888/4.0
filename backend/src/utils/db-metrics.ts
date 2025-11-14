/**
 * 数据库连接池监控工具
 * 艹，这个工具负责监控数据库性能，包括连接池状态、慢查询分析、EXPLAIN分析！
 *
 * 功能：
 * - 连接池状态监控（active/idle/waiting connections）
 * - 慢查询检测与记录（超过1秒的查询）
 * - EXPLAIN分析与优化建议
 * - 健康检查与问题诊断
 */

import { db } from '../config/database.js';
import logger from './logger.js';
import type { Knex } from 'knex';

/**
 * 连接池指标
 */
export interface ConnectionMetrics {
  active: number;
  idle: number;
  total: number;
  waiting: number;
}

/**
 * 慢查询记录
 */
export interface SlowQuery {
  sql: string;
  params: unknown[];
  duration: number;
  timestamp: Date;
}

/**
 * 性能指标
 */
interface PerformanceMetrics {
  slowQueries: SlowQuery[];
  avgResponseTime: number;
  totalQueries: number;
  failedQueries: number;
}

/**
 * EXPLAIN分析结果
 */
export interface ExplainAnalysis extends Record<string, unknown> {
  id: number;
  select_type: string;
  table: string;
  type: string;
  possible_keys: string | null;
  key: string | null;
  key_len: number | null;
  ref: string | null;
  rows: number;
  filtered: number | null;
  extra: string | null;
  // 分析结果
  queryType: string;
  indexUsage: {
    usingIndex: boolean;
    efficiency: 'excellent' | 'good' | 'medium' | 'poor';
    indexName?: string;
    keyLen?: number;
    reason?: string;
  };
  performance: {
    level: 'excellent' | 'good' | 'fair' | 'poor';
    estimatedRows?: number;
    reason?: string;
  };
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    message: string;
    suggestion: string;
  }>;
}

/**
 * EXPLAIN基线查询
 */
interface BaselineQuery {
  sql: string;
  explain: ExplainAnalysis;
  timestamp: Date;
}

/**
 * EXPLAIN指标
 */
interface ExplainMetrics {
  baselineQueries: Map<number, BaselineQuery>;
  lastAnalysis: Date | null;
}

/**
 * 连接池状态
 */
export interface PoolStatus extends ConnectionMetrics {
  healthy: boolean;
  utilization: string;
}

/**
 * 健康问题
 */
export interface HealthIssue {
  type: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
}

/**
 * 指标报告
 */
export interface MetricsReport {
  timestamp: Date;
  pool: PoolStatus;
  performance: {
    slowQueries: SlowQuery[];
    avgResponseTime: number;
    totalQueries: number;
    failedQueries: number;
    slowQueriesCount: number;
  };
  explain: {
    baselineCount: number;
    lastAnalysis: Date | null;
  };
  health: {
    status: 'healthy' | 'warning' | 'unhealthy';
    issues: HealthIssue[];
  };
}

type PoolWithEvents = {
  on: (event: string, listener: (...args: unknown[]) => void) => void;
};

type ExplainRow = {
  id: number;
  select_type: string;
  table: string | null;
  type: string | null;
  possible_keys: string | null;
  key: string | null;
  key_len: number | null;
  ref: string | null;
  rows: number;
  filtered: number | null;
  extra: string | null;
};

/**
 * 数据库监控指标类
 * 艹，这个类负责所有数据库性能监控！
 */
class DatabaseMetrics {
  private metrics: {
    connections: ConnectionMetrics;
    performance: PerformanceMetrics;
    explain: ExplainMetrics;
  };

  constructor() {
    this.metrics = {
      connections: {
        active: 0,
        idle: 0,
        total: 0,
        waiting: 0
      },
      performance: {
        slowQueries: [],
        avgResponseTime: 0,
        totalQueries: 0,
        failedQueries: 0
      },
      explain: {
        baselineQueries: new Map(),
        lastAnalysis: null
      }
    };

    this.setupEventListeners();
  }

  /**
   * 设置连接池事件监听
   */
  private setupEventListeners(): void {
    const knexClient = db as unknown;
    if (knexClient && typeof knexClient === 'object' && 'client' in knexClient) {
      const client = (knexClient as { client?: { pool?: unknown } }).client;
      const pool = client?.pool as PoolWithEvents | undefined;
      if (pool) {
        pool.on('acquire', (connection: unknown) => {
          this.metrics.connections.active++;
          this.metrics.connections.idle--;
          logger.debug('[DB Metrics] 连接获取', {
            active: this.metrics.connections.active,
            idle: this.metrics.connections.idle,
            total: this.metrics.connections.total
          });
        });

        pool.on('release', (connection: unknown) => {
          this.metrics.connections.active--;
          this.metrics.connections.idle++;
          logger.debug('[DB Metrics] 连接释放', {
            active: this.metrics.connections.active,
            idle: this.metrics.connections.idle
          });
        });

        pool.on('destroy', (connection: unknown) => {
          this.metrics.connections.total--;
          logger.info('[DB Metrics] 连接销毁', {
            total: this.metrics.connections.total
          });
        });

        pool.on('enqueue', () => {
          this.metrics.connections.waiting++;
          logger.warn('[DB Metrics] 连接等待', {
            waiting: this.metrics.connections.waiting
          });
        });

        pool.on('dequeue', () => {
          this.metrics.connections.waiting--;
        });
      }
    }
  }

  /**
   * 获取连接池状态
   */
  getPoolStatus(): PoolStatus {
    const { active, idle, total, waiting } = this.metrics.connections;
    return {
      active,
      idle,
      total,
      waiting,
      healthy: waiting === 0,
      utilization: total > 0 ? ((active / total) * 100).toFixed(2) + '%' : '0%'
    };
  }

  /**
   * 分析查询性能
   * @param sql - SQL语句
   * @param params - 查询参数
   * @param duration - 执行时间（毫秒）
   */
  recordQuery(sql: string, params: unknown[], duration: number): void {
    this.metrics.performance.totalQueries++;

    // 更新平均响应时间
    this.metrics.performance.avgResponseTime =
      (this.metrics.performance.avgResponseTime * (this.metrics.performance.totalQueries - 1) +
        duration) /
      this.metrics.performance.totalQueries;

    // 记录慢查询（超过1秒）
    if (duration > 1000) {
      this.metrics.performance.slowQueries.push({
        sql: this.sanitizeSQL(sql),
        params,
        duration,
        timestamp: new Date()
      });

      // 只保留最近100个慢查询
      if (this.metrics.performance.slowQueries.length > 100) {
        this.metrics.performance.slowQueries = this.metrics.performance.slowQueries.slice(-100);
      }

      logger.warn('[DB Metrics] 慢查询检测', {
        sql: this.sanitizeSQL(sql),
        duration: `${duration}ms`
      });
    }
  }

  /**
   * 清理SQL语句中的敏感信息
   * @param sql - SQL语句
   */
  private sanitizeSQL(sql: string): string {
    // 移除可能的敏感数据
    return (
      sql
        .replace(/'.*?'/g, "'?") // 替换字符串字面量
        .replace(/\d{4}-\d{2}-\d{2}/g, 'YYYY-MM-DD') // 替换日期
        .replace(/\b\d{13,}\b/g, 'BIGINT') // 替换大整数（时间戳等）
        .substring(0, 200) + (sql.length > 200 ? '...' : '')
    );
  }

  /**
   * 执行EXPLAIN分析
   * @param sql - SQL语句
   * @param params - 查询参数
   */
  async analyzeQuery(sql: string, params: unknown[] = []): Promise<ExplainAnalysis> {
    try {
      const explainSQL = `EXPLAIN ${sql}`;
      const result = await db.raw(explainSQL, params);

      const analysis = this.analyzeExplainResult(result[0][0]);

      // 存储基线结果
      const queryHash = this.hashSQL(sql);
      this.metrics.explain.baselineQueries.set(queryHash, {
        sql: this.sanitizeSQL(sql),
        explain: analysis,
        timestamp: new Date()
      });

      this.metrics.explain.lastAnalysis = new Date();

      logger.info('[DB Metrics] EXPLAIN分析完成', {
        queryType: analysis.queryType,
        table: analysis.table,
        type: analysis.type,
        rows: analysis.rows
      });

      return analysis;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('[DB Metrics] EXPLAIN分析失败', {
        sql: this.sanitizeSQL(sql),
        error: err.message
      });
      throw error;
    }
  }

  /**
   * 分析EXPLAIN结果
   * @param row - EXPLAIN查询结果
   */
  private analyzeExplainResult(row: Record<string, unknown>): ExplainAnalysis {
    const normalized = this.normalizeExplainRow(row);
    return {
      id: normalized.id,
      select_type: normalized.select_type,
      table: normalized.table ?? 'unknown',
      type: normalized.type ?? 'UNKNOWN',
      possible_keys: normalized.possible_keys,
      key: normalized.key,
      key_len: normalized.key_len,
      ref: normalized.ref,
      rows: normalized.rows,
      filtered: normalized.filtered,
      extra: normalized.extra,
      // 分析结果
      queryType: this.classifyQuery(normalized),
      indexUsage: this.analyzeIndexUsage(normalized),
      performance: this.analyzePerformance(normalized),
      recommendations: this.generateRecommendations(normalized)
    };
  }

  /**
   * 分类查询类型
   */
  private classifyQuery(row: ExplainRow): string {
    const extra = row.extra || '';

    if (extra.includes('Using where') && extra.includes('Using index')) {
      return 'index-lookup';
    } else if (extra.includes('Using filesort')) {
      return 'filesort';
    } else if (extra.includes('Using temporary')) {
      return 'temporary-table';
    } else if (row.type === 'ALL') {
      return 'full-scan';
    } else if (row.key) {
      return 'index-scan';
    } else {
      return 'unknown';
    }
  }

  /**
   * 分析索引使用情况
   */
  private analyzeIndexUsage(row: ExplainRow): ExplainAnalysis['indexUsage'] {
    if (!row.key) {
      return {
        usingIndex: false,
        efficiency: 'poor',
        reason: 'no-index-used'
      };
    }

    const efficiency = row.key_len ? row.key_len / this.getExpectedKeyLength(row) : 1;

    return {
      usingIndex: true,
      efficiency:
        efficiency > 0.8
          ? 'excellent'
          : efficiency > 0.5
            ? 'good'
            : efficiency > 0.3
              ? 'medium'
              : 'poor',
      indexName: row.key ?? undefined,
      keyLen: row.key_len ?? undefined
    };
  }

  /**
   * 估算期望的键长度
   */
  private getExpectedKeyLength(row: ExplainRow): number {
    // 简单的启发式估算
    if (row.table === 'users') return 20;
    if (row.table === 'tasks') return 32;
    if (row.table === 'orders') return 32;
    return 20;
  }

  /**
   * 分析性能
   */
  private analyzePerformance(row: ExplainRow): ExplainAnalysis['performance'] {
    const estimatedRows = row.rows || 0;

    if (estimatedRows === 0) {
      return { level: 'excellent', reason: 'empty-result' };
    } else if (estimatedRows < 100) {
      return { level: 'excellent', estimatedRows };
    } else if (estimatedRows < 1000) {
      return { level: 'good', estimatedRows };
    } else if (estimatedRows < 10000) {
      return { level: 'fair', estimatedRows };
    } else {
      return { level: 'poor', estimatedRows };
    }
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(row: ExplainRow): ExplainAnalysis['recommendations'] {
    const recommendations: ExplainAnalysis['recommendations'] = [];
    const extra = row.extra || '';

    // 全表扫描建议
    if (row.type === 'ALL') {
      recommendations.push({
        priority: 'high',
        message: '存在全表扫描，建议添加索引',
        suggestion: `在WHERE条件涉及的列上创建索引`
      });
    }

    // 文件排序建议
    if (extra.includes('Using filesort')) {
      recommendations.push({
        priority: 'medium',
        message: '需要文件排序，影响性能',
        suggestion: '在ORDER BY子句的列上创建索引或优化查询'
      });
    }

    // 临时表建议
    if (extra.includes('Using temporary')) {
      recommendations.push({
        priority: 'medium',
        message: '使用了临时表，影响性能',
        suggestion: '优化查询逻辑，避免临时表创建'
      });
    }

    // 索引使用效率低
    if (row.key && row.key_len && row.key_len < 10) {
      recommendations.push({
        priority: 'low',
        message: '索引使用率可能不高',
        suggestion: '检查索引是否被有效利用'
      });
    }

    return recommendations;
  }

  /**
   * 生成SQL哈希
   */
  private hashSQL(sql: string): number {
    // 简单的哈希函数
    return sql
      .replace(/\s+/g, ' ')
      .trim()
      .split('')
      .reduce((acc, char) => {
        return ((acc << 5) - acc + char.charCodeAt(0)) & 0xffffffff;
      }, 0);
  }

  private normalizeExplainRow(row: Record<string, unknown>): ExplainRow {
    return {
      id: this.toNumber(row.id),
      select_type: this.toString(row.select_type, 'UNKNOWN'),
      table: this.toStringOrNull(row.table),
      type: this.toStringOrNull(row.type),
      possible_keys: this.toStringOrNull(row.possible_keys),
      key: this.toStringOrNull(row.key),
      key_len: this.toNumberOrNull(row.key_len),
      ref: this.toStringOrNull(row.ref),
      rows: this.toNumber(row.rows),
      filtered: this.toNumberOrNull(row.filtered),
      extra: this.toStringOrNull(row.extra)
    };
  }

  private toNumber(value: unknown, fallback = 0): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
  }

  private toNumberOrNull(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private toString(value: unknown, fallback = ''): string {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
    return fallback;
  }

  private toStringOrNull(value: unknown): string | null {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
    return null;
  }

  /**
   * 获取完整的指标报告
   */
  getMetricsReport(): MetricsReport {
    return {
      timestamp: new Date(),
      pool: this.getPoolStatus(),
      performance: {
        ...this.metrics.performance,
        slowQueriesCount: this.metrics.performance.slowQueries.length
      },
      explain: {
        baselineCount: this.metrics.explain.baselineQueries.size,
        lastAnalysis: this.metrics.explain.lastAnalysis
      },
      health: {
        status: this.getHealthStatus(),
        issues: this.getHealthIssues()
      }
    };
  }

  /**
   * 获取健康状态
   */
  private getHealthStatus(): 'healthy' | 'warning' | 'unhealthy' {
    const poolStatus = this.getPoolStatus();
    const slowQueryRate =
      this.metrics.performance.totalQueries > 0
        ? (this.metrics.performance.slowQueries.length / this.metrics.performance.totalQueries) *
          100
        : 0;

    if (poolStatus.waiting > 0 || slowQueryRate > 5) {
      return 'unhealthy';
    } else if (slowQueryRate > 1 || parseFloat(poolStatus.utilization) > 80) {
      return 'warning';
    } else {
      return 'healthy';
    }
  }

  /**
   * 获取健康问题
   */
  private getHealthIssues(): HealthIssue[] {
    const issues: HealthIssue[] = [];
    const poolStatus = this.getPoolStatus();

    if (poolStatus.waiting > 0) {
      issues.push({
        type: 'pool_waiting',
        severity: 'high',
        message: `有 ${poolStatus.waiting} 个连接在等待`
      });
    }

    const slowQueryRate =
      this.metrics.performance.totalQueries > 0
        ? (this.metrics.performance.slowQueries.length / this.metrics.performance.totalQueries) *
          100
        : 0;

    if (slowQueryRate > 5) {
      issues.push({
        type: 'slow_queries',
        severity: 'high',
        message: `慢查询率过高: ${slowQueryRate.toFixed(2)}%`
      });
    }

    if (parseFloat(poolStatus.utilization) > 90) {
      issues.push({
        type: 'pool_utilization',
        severity: 'medium',
        message: `连接池利用率过高: ${poolStatus.utilization}`
      });
    }

    return issues;
  }

  /**
   * 获取最近的慢查询
   */
  public getRecentSlowQueries(limit = 20): SlowQuery[] {
    return this.metrics.performance.slowQueries.slice(-limit);
  }

  /**
   * 对外暴露的SQL脱敏方法
   */
  public publicSanitize(sql: string): string {
    return this.sanitizeSQL(sql);
  }

  /**
   * 对外暴露的SQL哈希方法
   */
  public publicHash(sql: string): number {
    return this.hashSQL(sql);
  }
}

// 创建全局实例
const dbMetrics = new DatabaseMetrics();

export default dbMetrics;
