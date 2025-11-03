const db = require('../config/database');
const logger = require('./logger');

/**
 * 数据库连接池监控工具
 *
 * 提供连接池状态监控、性能指标收集和EXPLAIN分析功能
 */
class DatabaseMetrics {
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
  setupEventListeners() {
    if (db.client && db.client.pool) {
      const pool = db.client.pool;

      pool.on('acquire', (connection) => {
        this.metrics.connections.active++;
        this.metrics.connections.idle--;
        logger.debug('[DB Metrics] 连接获取', {
          active: this.metrics.connections.active,
          idle: this.metrics.connections.idle,
          total: this.metrics.connections.total
        });
      });

      pool.on('release', (connection) => {
        this.metrics.connections.active--;
        this.metrics.connections.idle++;
        logger.debug('[DB Metrics] 连接释放', {
          active: this.metrics.connections.active,
          idle: this.metrics.connections.idle
        });
      });

      pool.on('destroy', (connection) => {
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

  /**
   * 获取连接池状态
   */
  getPoolStatus() {
    return {
      ...this.metrics.connections,
      healthy: this.metrics.connections.waiting === 0,
      utilization: this.metrics.connections.total > 0
        ? (this.metrics.connections.active / this.metrics.connections.total * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * 分析查询性能
   * @param {string} sql - SQL语句
   * @param {Array} params - 查询参数
   * @param {number} duration - 执行时间（毫秒）
   */
  recordQuery(sql, params, duration) {
    this.metrics.performance.totalQueries++;

    // 更新平均响应时间
    this.metrics.performance.avgResponseTime =
      (this.metrics.performance.avgResponseTime * (this.metrics.performance.totalQueries - 1) + duration)
      / this.metrics.performance.totalQueries;

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
   * @param {string} sql - SQL语句
   */
  sanitizeSQL(sql) {
    // 移除可能的敏感数据
    return sql
      .replace(/'.*?'/g, "'?") // 替换字符串字面量
      .replace(/\d{4}-\d{2}-\d{2}/g, 'YYYY-MM-DD') // 替换日期
      .replace(/\b\d{13,}\b/g, 'BIGINT') // 替换大整数（时间戳等）
      .substring(0, 200) + (sql.length > 200 ? '...' : '');
  }

  /**
   * 执行EXPLAIN分析
   * @param {string} sql - SQL语句
   * @param {Array} params - 查询参数
   */
  async analyzeQuery(sql, params = []) {
    try {
      const explainSQL = `EXPLAIN ${sql}`;
      const result = await db.raw(explainSQL, params);

      const analysis = this.analyzeExplainResult(result);

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
        rows: analysis.rows,
        cost: analysis.cost
      });

      return analysis;
    } catch (error) {
      logger.error('[DB Metrics] EXPLAIN分析失败', {
        sql: this.sanitizeSQL(sql),
        error: error.message
      });
      throw error;
    }
  }

  /**
   * 分析EXPLAIN结果
   * @param {Array} explainResult - EXPLAIN查询结果
   */
  analyzeExplainResult(explainResult) {
    const row = explainResult[0] || {};

    return {
      id: row.id,
      select_type: row.select_type,
      table: row.table,
      type: row.type,
      possible_keys: row.possible_keys,
      key: row.key,
      key_len: row.key_len,
      ref: row.ref,
      rows: row.rows,
      filtered: row.filtered,
      extra: row.extra,
      // 分析结果
      queryType: this.classifyQuery(row),
      indexUsage: this.analyzeIndexUsage(row),
      performance: this.analyzePerformance(row),
      recommendations: this.generateRecommendations(row)
    };
  }

  /**
   * 分类查询类型
   */
  classifyQuery(row) {
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
  analyzeIndexUsage(row) {
    if (!row.key) {
      return {
        usingIndex: false,
        efficiency: 'poor',
        reason: 'no-index-used'
      };
    }

    const efficiency = row.key_len ?
      (row.key_len / this.getExpectedKeyLength(row)) : 1;

    return {
      usingIndex: true,
      efficiency: efficiency > 0.8 ? 'good' : efficiency > 0.5 ? 'medium' : 'poor',
      indexName: row.key,
      keyLen: row.key_len
    };
  }

  /**
   * 估算期望的键长度
   */
  getExpectedKeyLength(row) {
    // 简单的启发式估算
    if (row.table === 'users') return 20;
    if (row.table === 'tasks') return 32;
    if (row.table === 'orders') return 32;
    return 20;
  }

  /**
   * 分析性能
   */
  analyzePerformance(row) {
    const estimatedRows = parseInt(row.rows) || 0;

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
  generateRecommendations(row) {
    const recommendations = [];
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
  hashSQL(sql) {
    // 简单的哈希函数
    return sql.replace(/\s+/g, ' ').trim().split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0) & 0xffffffff;
    }, 0);
  }

  /**
   * 获取完整的指标报告
   */
  getMetricsReport() {
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
  getHealthStatus() {
    const poolStatus = this.getPoolStatus();
    const slowQueryRate = this.metrics.performance.totalQueries > 0
      ? (this.metrics.performance.slowQueries.length / this.metrics.performance.totalQueries * 100)
      : 0;

    if (poolStatus.waiting > 0 || slowQueryRate > 5) {
      return 'unhealthy';
    } else if (slowQueryRate > 1 || poolStatus.utilization > 80) {
      return 'warning';
    } else {
      return 'healthy';
    }
  }

  /**
   * 获取健康问题
   */
  getHealthIssues() {
    const issues = [];
    const poolStatus = this.getPoolStatus();

    if (poolStatus.waiting > 0) {
      issues.push({
        type: 'pool_waiting',
        severity: 'high',
        message: `有 ${poolStatus.waiting} 个连接在等待`
      });
    }

    const slowQueryRate = this.metrics.performance.totalQueries > 0
      ? (this.metrics.performance.slowQueries.length / this.metrics.performance.totalQueries * 100)
      : 0;

    if (slowQueryRate > 5) {
      issues.push({
        type: 'slow_queries',
        severity: 'high',
        message: `慢查询率过高: ${slowQueryRate.toFixed(2)}%`
      });
    }

    if (poolStatus.utilization > 90) {
      issues.push({
        type: 'pool_utilization',
        severity: 'medium',
        message: `连接池利用率过高: ${poolStatus.utilization}`
      });
    }

    return issues;
  }
}

// 创建全局实例
const dbMetrics = new DatabaseMetrics();

module.exports = dbMetrics;